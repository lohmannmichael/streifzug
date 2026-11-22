import type { LonLat } from "./geo";
import { MAX_GAP_M } from "./parallel";
import type { Piece } from "./pieces";

/**
 * One line per street on the map (Michi, 22.11.2026): counting already takes every street once,
 * but drawing showed several strokes side by side. Only what is drawn changes:
 * - a path (sidewalk, cycleway) running beside a yellow street is not drawn,
 * - of two yellow carriageways of one street only one is drawn, always the same side (north,
 *   or west for streets running north–south), so the line does not jump between them,
 * - the red pen line is not drawn right beside yellow,
 * - short stubs hanging off the line are not drawn (end of a crossing path, a turning link, a
 *   bit of sidewalk the matching caught): they look like a scribble, not like a walked street.
 */
export interface LinienAbstaende {
  /** Sidewalks and cycleways next to the street. */
  wegM: number;
  /** Red beside yellow. */
  rotM: number;
  /** Largest angle between two lines that still count as running side by side. */
  winkelGrad: number;
  /** Stubs shorter than this are not drawn. */
  stummelM: number;
}

export const LINIEN_STANDARD: LinienAbstaende = { wegM: 18, rotM: 20, winkelGrad: 25, stummelM: 30 };

const M_LAT = 111_195;
type XY = [number, number];
interface Teil {
  stueck: Piece;
  a: XY;
  b: XY;
}

/**
 * Search among `liste`: does a line run beside piece p (not in front or behind it), roughly
 * parallel and within maxM? `passt` gets the other piece and its side: > 0 north (or west).
 */
function nachbarSuche(liste: readonly Piece[], bezugLat: number, winkelGrad: number) {
  const mx = M_LAT * Math.cos((bezugLat * Math.PI) / 180);
  const xy = (p: LonLat): XY => [p[0] * mx, p[1] * M_LAT];
  const zelle = MAX_GAP_M.major;
  const raster = new Map<string, Teil[]>();
  for (const s of liste)
    for (let i = 1; i < s.coords.length; i++) {
      const a = xy(s.coords[i - 1]!);
      const b = xy(s.coords[i]!);
      const k = `${Math.floor((a[0] + b[0]) / 2 / zelle)}:${Math.floor((a[1] + b[1]) / 2 / zelle)}`;
      (raster.get(k) ?? raster.set(k, []).get(k)!).push({ stueck: s, a, b });
    }
  return (p: Piece, maxM: number, passt: (q: Piece, seite: number) => boolean): boolean => {
    // Direction of the longest part (a sidewalk piece may have a small jog at a driveway).
    let [a, b]: [XY, XY] = [xy(p.coords[0]!), xy(p.coords[p.coords.length - 1]!)];
    let laengste = -1;
    for (let i = 1; i < p.coords.length; i++) {
      const u = xy(p.coords[i - 1]!);
      const v = xy(p.coords[i]!);
      const l = Math.hypot(v[0] - u[0], v[1] - u[1]);
      if (l > laengste) [laengste, a, b] = [l, u, v];
    }
    const mitte = xy(p.mid);
    const winkel = Math.atan2(b[1] - a[1], b[0] - a[0]);
    // Mostly east–west: point east (left = north); mostly north–south: point north (left = west).
    let [dx0, dy0] = [b[0] - a[0], b[1] - a[1]];
    if (Math.abs(dx0) >= Math.abs(dy0) ? dx0 < 0 : dy0 < 0) [dx0, dy0] = [-dx0, -dy0];
    const cx = Math.floor(mitte[0] / zelle);
    const cy = Math.floor(mitte[1] / zelle);
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        for (const t of raster.get(`${cx + dx}:${cy + dy}`) ?? []) {
          if (t.stueck.id === p.id) continue;
          const abstand = seitlich(mitte, t.a, t.b);
          if (abstand === null || abstand > maxM) continue;
          let diff = Math.abs(winkel - Math.atan2(t.b[1] - t.a[1], t.b[0] - t.a[0])) % Math.PI;
          diff = Math.min(diff, Math.PI - diff);
          if ((diff * 180) / Math.PI > winkelGrad) continue;
          const tm: XY = [(t.a[0] + t.b[0]) / 2, (t.a[1] + t.b[1]) / 2];
          if (passt(t.stueck, dx0 * (tm[1] - mitte[1]) - dy0 * (tm[0] - mitte[0]))) return true;
        }
    return false;
  };
}

export function eineLinieJeStrasse(gelb: readonly Piece[], rot: readonly Piece[], optionen: Partial<LinienAbstaende> = {}): { gelb: Piece[]; rot: Piece[] } {
  const o = { ...LINIEN_STANDARD, ...optionen };
  const erster = gelb[0] ?? rot[0];
  if (!erster) return { gelb: [], rot: [] };
  const lat = erster.mid[1];
  const strassen = nachbarSuche(
    gelb.filter((p) => p.kind === "street"),
    lat,
    o.winkelGrad,
  );
  const gezeigt = gelb.filter((p) => {
    if (p.kind === "path") return !strassen(p, o.wegM, () => true);
    // Two carriageways (weight 0.5 each): the northern (western) one stands for the street.
    if (p.kind === "street" && p.weight < 1) return !strassen(p, MAX_GAP_M.major, (q, seite) => q.weight < 1 && seite > 0);
    return true;
  });
  const ohneStummel = stummelWeg(gezeigt, lat, o.stummelM, o.wegM);
  const gelbe = nachbarSuche(ohneStummel, lat, o.winkelGrad);
  return { gelb: ohneStummel, rot: rot.filter((p) => !gelbe(p, o.rotM, () => true)) };
}

/** Ends closer than this are one point (pieces are cut at tile edges, coordinates differ a little). */
const GLEICH_M = 2;

/**
 * Removes short stubs and loops: chains of pieces (joined end to end, through points where only
 * two meet) shorter than `maxM` that
 * - hang off the drawing at one crossing, the other end loose (up to twice `maxM` when the loose
 *   end lies at something hidden beside the line: a link over to the other carriageway),
 * - or touch nothing, one end within `naheM` of a drawn piece and the other loose (they end at a
 *   hidden sidewalk or carriageway),
 * - or leave the line at one crossing and come back at another close by (turning loop, up to
 *   twice `maxM` long).
 * A short piece on its own (park path) and a short straight link between two lines stay.
 */
function stummelWeg(liste: readonly Piece[], bezugLat: number, maxM: number, naheM: number): Piece[] {
  if (liste.length < 2) return [...liste];
  const mx = M_LAT * Math.cos((bezugLat * Math.PI) / 180);
  const xy = (p: LonLat): XY => [p[0] * mx, p[1] * M_LAT];
  // Points: piece ends merged when closer than GLEICH_M.
  const punkte: XY[] = [];
  const raster = new Map<string, number[]>();
  const punktVon = (c: LonLat): number => {
    const q = xy(c);
    const cx = Math.floor(q[0] / GLEICH_M);
    const cy = Math.floor(q[1] / GLEICH_M);
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        for (const i of raster.get(`${cx + dx}:${cy + dy}`) ?? []) if (Math.hypot(punkte[i]![0] - q[0], punkte[i]![1] - q[1]) < GLEICH_M) return i;
    punkte.push(q);
    const k = `${cx}:${cy}`;
    (raster.get(k) ?? raster.set(k, []).get(k)!).push(punkte.length - 1);
    return punkte.length - 1;
  };
  const enden = liste.map((p) => [punktVon(p.coords[0]!), punktVon(p.coords[p.coords.length - 1]!)] as const);
  const anPunkt = new Map<number, number[]>();
  enden.forEach(([a, b], i) => {
    for (const k of [a, b]) (anPunkt.get(k) ?? anPunkt.set(k, []).get(k)!).push(i);
  });
  const grad = (k: number) => anPunkt.get(k)?.length ?? 0;
  const suche = nachbarSuche(liste, bezugLat, 180);

  const weg = new Set<number>();
  const besucht = new Set<number>();
  for (let start = 0; start < liste.length; start++) {
    if (besucht.has(start)) continue;
    // Walk the chain through points where exactly two pieces meet, in both directions.
    const kette = [start];
    besucht.add(start);
    const randpunkte: number[] = [];
    for (const richtung of [0, 1] as const) {
      let stueck = start;
      let punkt = enden[start]![richtung];
      for (;;) {
        if (grad(punkt) !== 2) break;
        const weiter = anPunkt.get(punkt)!.find((i) => i !== stueck)!;
        if (besucht.has(weiter)) break;
        besucht.add(weiter);
        kette.push(weiter);
        stueck = weiter;
        punkt = enden[weiter]![0] === punkt ? enden[weiter]![1] : enden[weiter]![0];
      }
      randpunkte.push(punkt);
    }
    const laenge = kette.reduce((m, i) => m + liste[i]!.lengthM, 0);
    // Loops may be up to twice as long as stubs (a turning link down to the other carriageway).
    if (laenge >= 2 * maxM) continue;
    const inKette = new Set(kette.map((i) => liste[i]!.id));
    // A loose end near another drawn piece: it ends at something hidden beside the line (sidewalk,
    // the other carriageway). Pieces at the stub's other end do not count (it is always near them).
    const nahe = (k: number, maxAbstand: number) => {
      const andere = randpunkte.find((r) => r !== k);
      const daneben = new Set((andere === undefined ? [] : (anPunkt.get(andere) ?? [])).map((i) => liste[i]!.id));
      const p = punkte[k]!;
      const lonlat: LonLat = [p[0] / mx, p[1] / M_LAT];
      const punktStueck: Piece = { id: "", kind: "path", weight: 1, lengthM: 0, coords: [lonlat, lonlat], mid: lonlat };
      return suche(punktStueck, maxAbstand, (q) => !inKette.has(q.id) && !daneben.has(q.id));
    };
    const [r0, r1] = randpunkte as [number, number];
    // Attached: three or more pieces meet, or the end lies on another drawn piece between its ends.
    const kreuzung = (k: number) => grad(k) >= 3 || (grad(k) === 1 && nahe(k, GLEICH_M));
    const kreuzungen = (kreuzung(r0) ? 1 : 0) + (kreuzung(r1) ? 1 : 0);
    const lose = [r0, r1].filter((k) => !kreuzung(k));
    // A loose end at something hidden may reach twice as far (a link over to the other carriageway).
    const stummel =
      (kreuzungen === 1 && (laenge < maxM || nahe(lose[0]!, naheM))) ||
      (kreuzungen === 0 && laenge < maxM && lose.filter((k) => nahe(k, naheM)).length === 1);
    // Leaves the line and comes back close by (turning loop, U-turn link, the "V" of a junction
    // down to the other carriageway): ends at most maxM apart and the way between clearly longer.
    const abstand = Math.hypot(punkte[r0]![0] - punkte[r1]![0], punkte[r0]![1] - punkte[r1]![1]);
    const schlaufe = kreuzungen === 2 && r0 !== r1 && abstand <= maxM && laenge >= 1.5 * abstand;
    if (stummel || schlaufe || (kreuzungen === 2 && r0 === r1)) for (const i of kette) weg.add(i);
  }
  return liste.filter((_, i) => !weg.has(i));
}

/** Perpendicular distance from p to segment a–b, or null if p does not lie beside it. */
function seitlich(p: XY, a: XY, b: XY): number | null {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return null;
  const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2;
  if (t < -0.05 || t > 1.05) return null;
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/**
 * Two carriageways of one street (Michi, 22.11.2026): walking along one of them counts the other
 * too, whichever side. Returns the unseen carriageway pieces lying beside a seen one.
 */
export function fahrbahnenErgaenzen(kandidaten: readonly Piece[], gesehen: ReadonlySet<string>, optionen: Partial<LinienAbstaende> = {}): Set<string> {
  const o = { ...LINIEN_STANDARD, ...optionen };
  const halbe = kandidaten.filter((p) => p.kind === "street" && p.weight < 1);
  const dazu = new Set<string>();
  const erster = halbe[0];
  if (!erster) return dazu;
  const suche = nachbarSuche(halbe.filter((p) => gesehen.has(p.id)), erster.mid[1], o.winkelGrad);
  for (const p of halbe) if (!gesehen.has(p.id) && suche(p, MAX_GAP_M.major, () => true)) dazu.add(p.id);
  return dazu;
}
