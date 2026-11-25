/**
 * Drawing ways nicer (Michi, 25.11.2026: "smoother, nicht 100 % auf die GPS-Daten berufen").
 * Only for drawing: counting stays with the matching. Step A: smoothing.
 */
import type { LonLat } from "./geo";

/** Width of the smoothing (m): GPS wobble of a few meters goes, real corners stay. */
const SIGMA_M = 9;
/** A point that jumps away further than this and comes straight back is a GPS spike. */
const SPRUNG_M = 15;

/** Local meters around the first point (good enough for a few kilometres). */
function lokal(coords: readonly LonLat[]) {
  const [x0, y0] = coords[0]!;
  const kx = 111_320 * Math.cos((y0 * Math.PI) / 180);
  const ky = 110_540;
  return {
    hin: coords.map(([x, y]) => [(x - x0) * kx, (y - y0) * ky] as [number, number]),
    zurueck: ([x, y]: [number, number]): LonLat => [x0 + x / kx, y0 + y / ky],
  };
}

/**
 * Smoothed copy of a way, same number of points (so per-point marks like "driven" still fit),
 * same ends: single spikes out and back are taken out, then each point becomes a weighted mean
 * of its neighbours within a few meters along the way.
 */
export function glaetten(coords: readonly LonLat[]): LonLat[] {
  const n = coords.length;
  if (n < 3) return [...coords];
  const { hin, zurueck } = lokal(coords);
  const d = (a: [number, number], b: [number, number]) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  // Spikes: far from both neighbours while the neighbours are close to each other.
  const p = hin.map((q) => [...q] as [number, number]);
  for (let i = 1; i < n - 1; i++) {
    const a = p[i - 1]!;
    const b = hin[i]!;
    const c = hin[i + 1]!;
    const ab = d(a, b);
    const bc = d(b, c);
    if (ab > SPRUNG_M && bc > SPRUNG_M && d(a, c) < 0.5 * Math.min(ab, bc)) p[i] = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2];
  }
  // Distance along the way.
  const s = [0];
  for (let i = 1; i < n; i++) s.push(s[i - 1]! + d(p[i - 1]!, p[i]!));
  const out: LonLat[] = [coords[0]!];
  let von = 0;
  for (let i = 1; i < n - 1; i++) {
    while (s[i]! - s[von]! > 3 * SIGMA_M) von++;
    // Near the ends the window shrinks, so the line runs into its ends.
    const breite = Math.min(SIGMA_M, (s[i]! - s[0]!) / 2 + 0.01, (s[n - 1]! - s[i]!) / 2 + 0.01);
    let [sx, sy, sw] = [0, 0, 0];
    for (let j = von; j < n && s[j]! - s[i]! <= 3 * SIGMA_M; j++) {
      const w = Math.exp(-((s[j]! - s[i]!) ** 2) / (2 * breite * breite));
      sx += p[j]![0] * w;
      sy += p[j]![1] * w;
      sw += w;
    }
    out.push(zurueck([sx / sw, sy / sw]));
  }
  out.push(coords[n - 1]!);
  return out;
}
