import type { LonLat } from "./geo";
import type { Bounds } from "./tiles";

/**
 * Cuts a polyline to a rectangle (Liang–Barsky per part). Returns the pieces inside.
 * Used to drop the buffer that vector tiles carry beyond their edges, so nothing is counted twice.
 */
export function clipLine(line: readonly LonLat[], b: Bounds): LonLat[][] {
  const parts: LonLat[][] = [];
  let current: LonLat[] = [];
  const flush = () => {
    if (current.length >= 2) parts.push(current);
    current = [];
  };

  for (let i = 1; i < line.length; i++) {
    const piece = clipSegment(line[i - 1]!, line[i]!, b);
    if (!piece) {
      flush();
      continue;
    }
    const [p, q] = piece;
    const last = current[current.length - 1];
    if (!last || last[0] !== p[0] || last[1] !== p[1]) {
      flush();
      current.push(p);
    }
    current.push(q);
    // The segment left the box: the next inside piece starts a new part.
    if (q[0] !== line[i]![0] || q[1] !== line[i]![1]) flush();
  }
  flush();
  return parts;
}

function clipSegment(a: LonLat, c: LonLat, b: Bounds): [LonLat, LonLat] | null {
  const dx = c[0] - a[0];
  const dy = c[1] - a[1];
  let t0 = 0;
  let t1 = 1;
  const checks: [number, number][] = [
    [-dx, a[0] - b.west],
    [dx, b.east - a[0]],
    [-dy, a[1] - b.south],
    [dy, b.north - a[1]],
  ];
  for (const [p, q] of checks) {
    if (p === 0) {
      if (q < 0) return null;
      continue;
    }
    const r = q / p;
    if (p < 0) {
      if (r > t1) return null;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return null;
      if (r < t1) t1 = r;
    }
  }
  if (t0 >= t1) return null;
  const at = (t: number): LonLat => [a[0] + dx * t, a[1] + dy * t];
  return [t0 === 0 ? a : at(t0), t1 === 1 ? c : at(t1)];
}
