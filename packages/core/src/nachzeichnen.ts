/**
 * Tracing gaps along the streets (Michi, 22.11.2026): between two points that are further apart,
 * the app looks for the way along the street network and marks it, but only when that way is clear:
 * not much longer than the straight line, and no second way of almost the same length (e.g. around
 * the block on the other side). Unclear gaps stay white; wrong yellow is worse than missing yellow.
 */
import { distanceM, type LonLat } from "./geo";
import type { Piece } from "./pieces";
import type { Fix } from "./track";

export interface NachzeichnenOptionen {
  /** Gaps shorter than this are covered by the normal matching. */
  minM: number;
  /** Gaps longer than this are not traced (too many possibilities). */
  maxM: number;
  /** Points may be this far from the street network. */
  fangM: number;
  /** The way along the streets may be at most this factor of the straight line (plus `zuschlagM`). */
  umwegFaktor: number;
  zuschlagM: number;
  /** A second way shorter than this factor of the best makes the gap unclear. */
  eindeutigFaktor: number;
  /** Share of a piece the traced ways must cover for it to count. */
  anteil: number;
  /**
   * Try every street node within `fangM` of both points, not only the nearest (car rides: two
   * carriageways side by side may not be joined in the map data).
   */
  alleNahen?: boolean;
}

export const NACHZEICHNEN_STANDARD: NachzeichnenOptionen = {
  minM: 15,
  maxM: 150,
  fangM: 20,
  umwegFaktor: 1.3,
  zuschlagM: 20,
  eindeutigFaktor: 1.25,
  anteil: 0.6,
};

interface Kante {
  nach: number;
  laenge: number;
  stueck: string;
}

const M_LAT = 111_195;

/** Street network from pieces: nodes are the vertices (rounded to about 1 m), edges their segments. */
function netz(pieces: readonly Piece[]) {
  const id = new Map<string, number>();
  const lage: LonLat[] = [];
  const kanten: Kante[][] = [];
  const knoten = (p: LonLat) => {
    const k = `${p[0].toFixed(5)},${p[1].toFixed(5)}`;
    let i = id.get(k);
    if (i === undefined) {
      i = lage.length;
      id.set(k, i);
      lage.push(p);
      kanten.push([]);
    }
    return i;
  };
  for (const p of pieces) {
    if (p.kind === "drive") continue;
    for (let i = 1; i < p.coords.length; i++) {
      const a = knoten(p.coords[i - 1]!);
      const b = knoten(p.coords[i]!);
      if (a === b) continue;
      const laenge = distanceM(p.coords[i - 1]!, p.coords[i]!);
      kanten[a]!.push({ nach: b, laenge, stueck: p.id });
      kanten[b]!.push({ nach: a, laenge, stueck: p.id });
    }
  }
  // Grid for finding the nearest node.
  const zelle = 0.0004;
  const raster = new Map<string, number[]>();
  lage.forEach((p, i) => {
    const k = `${Math.floor(p[0] / zelle)},${Math.floor(p[1] / zelle)}`;
    (raster.get(k) ?? raster.set(k, []).get(k)!).push(i);
  });
  /** Nodes within `maxM` of a point, nearest first. */
  const nahe = (p: LonLat, maxM: number): { i: number; d: number }[] => {
    const cx = Math.floor(p[0] / zelle);
    const cy = Math.floor(p[1] / zelle);
    const out: { i: number; d: number }[] = [];
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        for (const i of raster.get(`${cx + dx},${cy + dy}`) ?? []) {
          const d = distanceM(p, lage[i]!);
          if (d <= maxM) out.push({ i, d });
        }
    return out.sort((x, y) => x.d - y.d);
  };
  const naechster = (p: LonLat, maxM: number): number | null => nahe(p, maxM)[0]?.i ?? null;
  return { lage, kanten, naechster, nahe };
}

/** Shortest way from a to b (Dijkstra), not longer than `grenze`; `strafe` makes some edges dearer. */
function weg(kanten: Kante[][], a: number, b: number, grenze: number, strafe?: Set<string>): { laenge: number; kanten: Kante[] } | null {
  const dist = new Map<number, number>([[a, 0]]);
  const vor = new Map<number, { von: number; kante: Kante }>();
  const offen: [number, number][] = [[0, a]];
  const fertig = new Set<number>();
  while (offen.length) {
    // Small graphs and short ways: a sorted list is enough.
    let mi = 0;
    for (let i = 1; i < offen.length; i++) if (offen[i]![0] < offen[mi]![0]) mi = i;
    const [d, u] = offen.splice(mi, 1)[0]!;
    if (fertig.has(u)) continue;
    fertig.add(u);
    if (u === b) break;
    if (d > grenze) return null;
    for (const k of kanten[u]!) {
      const nd = d + k.laenge * (strafe?.has(`${u}>${k.nach}`) ? 3 : 1);
      if (nd < (dist.get(k.nach) ?? Infinity)) {
        dist.set(k.nach, nd);
        vor.set(k.nach, { von: u, kante: k });
        offen.push([nd, k.nach]);
      }
    }
  }
  if (!fertig.has(b)) return null;
  const pfad: Kante[] = [];
  let laenge = 0;
  for (let x = b; x !== a; ) {
    const v = vor.get(x)!;
    pfad.push(v.kante);
    laenge += v.kante.laenge;
    x = v.von;
  }
  return laenge <= grenze ? { laenge, kanten: pfad.reverse() } : null;
}

/**
 * Pieces to add for the walked or cycled points (`folgen`: each a run of points that belong
 * together, e.g. one walk without a drive in between). `schon` are pieces seen already.
 */
export function nachzeichnen(pieces: readonly Piece[], folgen: readonly Fix[][], schon: ReadonlySet<string>, optionen: Partial<NachzeichnenOptionen> = {}): Set<string> {
  const o = { ...NACHZEICHNEN_STANDARD, ...optionen };
  const netzDaten = netz(pieces);
  const { kanten, naechster, nahe } = netzDaten;
  const lage = (i: number) => netzDaten.lage[i]!;
  const laengeJe = new Map(pieces.map((p) => [p.id, p.lengthM]));
  const bedeckt = new Map<string, number>();
  for (const folge of folgen) {
    const punkte = folge.filter((f) => f.acc <= 25);
    for (let i = 1; i < punkte.length; i++) {
      const a: LonLat = [punkte[i - 1]!.lon, punkte[i - 1]!.lat];
      const b: LonLat = [punkte[i]!.lon, punkte[i]!.lat];
      const luft = distanceM(a, b);
      if (luft < o.minM || luft > o.maxM) continue;
      const grenze = luft * o.umwegFaktor + o.zuschlagM;
      let ka = naechster(a, o.fangM);
      let kb = naechster(b, o.fangM);
      let best = ka !== null && kb !== null && ka !== kb ? weg(kanten, ka, kb, grenze) : null;
      if (o.alleNahen) {
        // The shortest way between any nodes near both points (a few each), counting the way to them.
        let bestGesamt = best ? best.laenge + distanceM(a, lage(ka!)) + distanceM(b, lage(kb!)) : Infinity;
        for (const x of nahe(a, o.fangM).slice(0, 6))
          for (const y of nahe(b, o.fangM).slice(0, 6)) {
            if (x.i === y.i) continue;
            const w = weg(kanten, x.i, y.i, grenze);
            if (w && w.laenge + x.d + y.d < bestGesamt) {
              bestGesamt = w.laenge + x.d + y.d;
              best = w;
              ka = x.i;
              kb = y.i;
            }
          }
      }
      if (!best || ka === null || kb === null) continue;
      // A second way that avoids the first one: if it is almost as short, the gap is unclear.
      const strafe = new Set<string>();
      let u = ka;
      for (const k of best.kanten) {
        strafe.add(`${u}>${k.nach}`);
        strafe.add(`${k.nach}>${u}`);
        u = k.nach;
      }
      const zweiter = weg(kanten, ka, kb, best.laenge * o.eindeutigFaktor, strafe);
      if (zweiter && geteilterAnteil(best.kanten, zweiter.kanten) < 0.7) continue;
      for (const k of best.kanten) bedeckt.set(k.stueck, (bedeckt.get(k.stueck) ?? 0) + k.laenge);
    }
  }
  const dazu = new Set<string>();
  for (const [id, m] of bedeckt) if (!schon.has(id) && m >= o.anteil * (laengeJe.get(id) ?? Infinity)) dazu.add(id);
  return dazu;
}

/** Share of the second way's length that runs on the same pieces as the first. */
function geteilterAnteil(erster: Kante[], zweiter: Kante[]): number {
  const stuecke = new Set(erster.map((k) => k.stueck));
  const gesamt = zweiter.reduce((s, k) => s + k.laenge, 0) || 1;
  return zweiter.reduce((s, k) => s + (stuecke.has(k.stueck) ? k.laenge : 0), 0) / gesamt;
}

/** Meters per degree of longitude at a latitude (for tests and callers that build points). */
export const mProGradLon = (lat: number) => M_LAT * Math.cos((lat * Math.PI) / 180);
