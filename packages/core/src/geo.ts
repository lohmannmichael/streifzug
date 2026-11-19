/** A position as [longitude, latitude] in degrees, like GeoJSON. */
export type LonLat = readonly [number, number];

const EARTH_RADIUS_M = 6_371_008.8;
const RAD = Math.PI / 180;

/** Great-circle distance between two points in meters. */
export function distanceM(a: LonLat, b: LonLat): number {
  const dLat = (b[1] - a[1]) * RAD;
  const dLon = (b[0] - a[0]) * RAD;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * RAD) * Math.cos(b[1] * RAD) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function lineLengthM(line: readonly LonLat[]): number {
  let total = 0;
  for (let i = 1; i < line.length; i++) total += distanceM(line[i - 1]!, line[i]!);
  return total;
}

/**
 * The part of a line between two distances from its start.
 * Good enough for street-sized pieces: positions are interpolated linearly in degrees.
 */
export function sliceLine(line: readonly LonLat[], startM: number, endM: number): LonLat[] {
  const out: LonLat[] = [];
  let walked = 0;
  for (let i = 1; i < line.length; i++) {
    const from = line[i - 1]!;
    const to = line[i]!;
    const part = distanceM(from, to);
    const partStart = walked;
    const partEnd = walked + part;
    walked = partEnd;
    if (part === 0 || partEnd < startM) continue;
    if (partStart > endM) break;

    if (out.length === 0) out.push(pointOn(from, to, (startM - partStart) / part));
    if (partEnd < endM) {
      out.push(to);
    } else {
      out.push(pointOn(from, to, (endM - partStart) / part));
      break;
    }
  }
  return out;
}

function pointOn(from: LonLat, to: LonLat, t: number): LonLat {
  const k = Math.min(1, Math.max(0, t));
  return [from[0] + (to[0] - from[0]) * k, from[1] + (to[1] - from[1]) * k];
}
