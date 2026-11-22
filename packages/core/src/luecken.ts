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
