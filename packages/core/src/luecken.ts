/**
 * Closing small gaps (Michi, 22.11.2026): where GPS points are sparse or you stood at a corner,
 * a short piece between two walked pieces can stay white. Such a piece is counted as walked when
 * both its ends touch walked pieces and it is short.
 */
import { distanceM, type LonLat } from "./geo";
import type { Piece } from "./pieces";

export const LUECKE_MAX_M = 40;

const knoten = (p: LonLat) => `${p[0].toFixed(6)},${p[1].toFixed(6)}`;

/**
 * Ids of pieces that close a gap (not yet seen; the caller adds them to the seen ones). A gap is a
 * group of connected, unwalked pieces of at most `maxM` in total that touches walked pieces at two
 * or more different points (so it lies between them, not at a dead end).
 */
export function lueckenSchliessen(kandidaten: readonly Piece[], gesehen: ReadonlySet<string>, maxM = LUECKE_MAX_M): Set<string> {
  const enden = new Set<string>();
  const offen: Piece[] = [];
  for (const p of kandidaten) {
    const a = knoten(p.coords[0]!);
    const b = knoten(p.coords[p.coords.length - 1]!);
    if (gesehen.has(p.id)) {
      enden.add(a);
      enden.add(b);
    } else if (p.kind !== "drive" && p.lengthM <= maxM) offen.push(p);
  }
  // Open pieces per node, to walk through connected groups.
  const amKnoten = new Map<string, Piece[]>();
  for (const p of offen)
    for (const k of [knoten(p.coords[0]!), knoten(p.coords[p.coords.length - 1]!)]) (amKnoten.get(k) ?? amKnoten.set(k, []).get(k)!).push(p);

  const dazu = new Set<string>();
  const besucht = new Set<string>();
  for (const start of offen) {
    if (besucht.has(start.id)) continue;
    const gruppe: Piece[] = [];
    const beruehrt = new Set<string>();
    let laenge = 0;
    const stapel = [start];
    besucht.add(start.id);
    while (stapel.length) {
      const p = stapel.pop()!;
      gruppe.push(p);
      laenge += p.lengthM;
      for (const k of [knoten(p.coords[0]!), knoten(p.coords[p.coords.length - 1]!)]) {
        if (enden.has(k)) {
          beruehrt.add(k);
          continue; // do not walk past walked streets
        }
        for (const q of amKnoten.get(k) ?? [])
          if (!besucht.has(q.id)) {
            besucht.add(q.id);
            stapel.push(q);
          }
      }
    }
    if (laenge <= maxM && beruehrt.size >= 2) for (const p of gruppe) dazu.add(p.id);
  }
  return dazu;
}

/**
 * Corners (Michi, 22.11.2026): with points 25 m apart the line between two points cuts across a
 * junction, so the short street piece at the corner stays white. Such a piece counts when it joins
 * a walked piece and an accurate point lies close to its middle. (On 22.11. this found 6 of 11
 * white corner pieces and nothing wrong.)
 */
export function eckenSchliessen(
  kandidaten: readonly Piece[],
  gesehen: ReadonlySet<string>,
  fixes: readonly { lon: number; lat: number; acc: number }[],
  radiusM = 10,
  maxM = LUECKE_MAX_M,
): Set<string> {
  const enden = new Set<string>();
  for (const p of kandidaten)
    if (gesehen.has(p.id)) {
      enden.add(knoten(p.coords[0]!));
      enden.add(knoten(p.coords[p.coords.length - 1]!));
    }
  const genau = fixes.filter((f) => f.acc <= 15);
  const dazu = new Set<string>();
  for (const p of kandidaten) {
    if (p.kind !== "street" || gesehen.has(p.id) || p.lengthM > maxM) continue;
    if (!enden.has(knoten(p.coords[0]!)) && !enden.has(knoten(p.coords[p.coords.length - 1]!))) continue;
    if (genau.some((f) => distanceM([f.lon, f.lat], p.mid) <= radiusM)) dazu.add(p.id);
  }
  return dazu;
}

/** A seen piece up to this long with a free end is a stub unless a point came near that end. */
export const STUMMEL_MAX_M = 30;
const STUMMEL_ENDE_M = 15;
/** An end closer than this to another seen piece is joined. */
const ANSCHLUSS_M = 3;

/**
 * Stubs (Michi, 25.11.2026: small crosses and stubs at crossings): the rules that close corners
 * and gaps sometimes take a few meters of a side street you only passed. A seen piece of at most
 * 30 m that goes on straight into no seen piece of its street, with an end that joins no other
 * seen piece, counts only if a GPS point came within 15 m of that end. (26.11.2026: pieces are
 * about 25 m and do not end at crossings, so a corner piece sticks out a little; it stays.)
 * Returns the ids to take out again.
 */
export function stummelEntfernen(kandidaten: readonly Piece[], gesehen: ReadonlySet<string>, fixes: readonly { lat: number; lon: number }[]): Set<string> {
  const raus = new Set<string>();
  const seen = kandidaten.filter((p) => gesehen.has(p.id));
  const kurze = seen.filter((p) => p.lengthM <= STUMMEL_MAX_M && p.coords.length > 1);
  if (kurze.length === 0) return raus;
  const lat0 = kurze[0]!.coords[0]![1];
  const kx = 111_320 * Math.cos((lat0 * Math.PI) / 180);
  const ky = 111_195;
  const xy = (p: LonLat): [number, number] => [p[0] * kx, p[1] * ky];
  // Grid of the seen pieces' segments and of the points (cells of 20 m).
  const ZELLE = 20;
  const k = (x: number, y: number) => `${Math.floor(x / ZELLE)}:${Math.floor(y / ZELLE)}`;
  const segs = new Map<string, { id: string; a: [number, number]; b: [number, number] }[]>();
  for (const p of seen)
    for (let i = 1; i < p.coords.length; i++) {
      const a = xy(p.coords[i - 1]!);
      const b = xy(p.coords[i]!);
      const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / ZELLE));
      const zellen = new Set<string>();
      for (let j = 0; j <= n; j++) zellen.add(k(a[0] + ((b[0] - a[0]) * j) / n, a[1] + ((b[1] - a[1]) * j) / n));
      for (const z of zellen) (segs.get(z) ?? segs.set(z, []).get(z)!).push({ id: p.id, a, b });
    }
  const punkte = new Map<string, [number, number][]>();
  for (const f of fixes) {
    const q = xy([f.lon, f.lat]);
    const z = k(q[0], q[1]);
    (punkte.get(z) ?? punkte.set(z, []).get(z)!).push(q);
  }
  const umgebung = function* <T>(karte: Map<string, T[]>, q: [number, number]) {
    const [cx, cy] = [Math.floor(q[0] / ZELLE), Math.floor(q[1] / ZELLE)];
    for (const dx of [-1, 0, 1]) for (const dy of [-1, 0, 1]) yield* karte.get(`${cx + dx}:${cy + dy}`) ?? [];
  };
  const abstand = (q: [number, number], a: [number, number], b: [number, number]) => {
    const [sx, sy] = [b[0] - a[0], b[1] - a[1]];
    const l = sx * sx + sy * sy;
    const t = l > 0 ? Math.max(0, Math.min(1, ((q[0] - a[0]) * sx + (q[1] - a[1]) * sy) / l)) : 0;
    return Math.hypot(q[0] - a[0] - t * sx, q[1] - a[1] - t * sy);
  };
  // Ends of all seen pieces with the direction of their end segment, for "goes on straight".
  const endenNetz = new Map<string, { id: string; q: [number, number]; r: [number, number] }[]>();
  for (const p of seen) {
    const n = p.coords.length;
    if (n < 2) continue;
    for (const [i, j] of [[0, 1], [n - 1, n - 2]] as const) {
      const q = xy(p.coords[i]!);
      const w = xy(p.coords[j]!);
      const e = { id: p.id, q, r: [w[0] - q[0], w[1] - q[1]] as [number, number] };
      const z = k(q[0], q[1]);
      (endenNetz.get(z) ?? endenNetz.set(z, []).get(z)!).push(e);
    }
  }
  const cosGerade = Math.cos((35 * Math.PI) / 180);
  /** Another seen piece starts or ends here and runs on roughly straight (same street). */
  const gehtWeiter = (q: [number, number], r: [number, number], id: string) => {
    for (const e of umgebung(endenNetz, q)) {
      if (e.id === id || Math.hypot(e.q[0] - q[0], e.q[1] - q[1]) > ANSCHLUSS_M) continue;
      const c = (r[0] * e.r[0] + r[1] * e.r[1]) / (Math.hypot(...r) * Math.hypot(...e.r) || 1);
      // Going on straight: the other piece leaves this end in the opposite direction.
      if (c <= -cosGerade) return true;
    }
    return false;
  };
  for (const p of kurze) {
    const n = p.coords.length;
    // A piece that goes on straight into a seen piece at either end belongs to a walked street
    // (a corner piece sticking out past the crossing, the last piece of a walk): never a stub.
    const anfang = xy(p.coords[0]!);
    const ende = xy(p.coords[n - 1]!);
    const zweiter = xy(p.coords[1]!);
    const vorletzter = xy(p.coords[n - 2]!);
    if (gehtWeiter(anfang, [zweiter[0] - anfang[0], zweiter[1] - anfang[1]], p.id) || gehtWeiter(ende, [vorletzter[0] - ende[0], vorletzter[1] - ende[1]], p.id)) continue;
    const enden = [anfang, ende];
    const frei = enden.filter((e) => {
      for (const s of umgebung(segs, e)) if (s.id !== p.id && abstand(e, s.a, s.b) <= ANSCHLUSS_M) return false;
      return true;
    });
    if (frei.length === 0) continue;
    const erreicht = frei.every((e) => {
      for (const q of umgebung(punkte, e)) if (Math.hypot(q[0] - e[0], q[1] - e[1]) <= STUMMEL_ENDE_M) return true;
      return false;
    });
    if (!erreicht) raus.add(p.id);
  }
  return raus;
}
