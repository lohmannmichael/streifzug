import type { LonLat } from "./geo";

const M_PER_DEG_LAT = 111_195;

/** Shortest distance in meters from a point to a line (flat approximation, fine for a few km). */
export function distanceToLineM(p: LonLat, line: readonly LonLat[]): number {
  const mx = M_PER_DEG_LAT * Math.cos((p[1] * Math.PI) / 180);
  const xy = (q: LonLat): [number, number] => [(q[0] - p[0]) * mx, (q[1] - p[1]) * M_PER_DEG_LAT];
  if (line.length === 0) return Infinity;
  if (line.length === 1) return Math.hypot(...xy(line[0]!));
  let best = Infinity;
  for (let i = 1; i < line.length; i++) {
    const [ax, ay] = xy(line[i - 1]!);
    const [bx, by] = xy(line[i]!);
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2));
    best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
  }
  return best;
}

export interface NamedLine {
  name: string;
  coords: readonly LonLat[];
}

/** Name of the nearest named street line within `maxM` of a point (e.g. the middle of a piece). */
export function nameNear(p: LonLat, lines: readonly NamedLine[], maxM = 15): string | null {
  let best: string | null = null;
  let bestD = maxM;
  for (const l of lines) {
    const d = distanceToLineM(p, l.coords);
    if (d <= bestD) {
      bestD = d;
      best = l.name;
    }
  }
  return best;
}

