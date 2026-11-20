import type { LonLat } from "./geo";
import type { Piece } from "./pieces";

/** Shares (percent) that earn a stamp in an area. */
export const MILESTONES = [1, 5, 10, 25, 50, 75, 100] as const;

/** The highest milestone passed when an area's share went from `before` to `after` (percent), or null. */
export function milestoneReached(before: number, after: number): number | null {
  let hit: number | null = null;
  for (const m of MILESTONES) if (before < m && after >= m) hit = m;
  return hit;
}

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

export interface Spot {
  piece: Piece;
  distanceM: number;
}

/**
 * "Weißer Fleck in der Nähe": the nearest piece that counts and has not been seen,
 * within `maxM` of a point. Paths only count with the paths switch.
 */
export function nearestUnseen(pieces: readonly Piece[], seen: ReadonlySet<string>, p: LonLat, options: { maxM?: number; paths?: boolean } = {}): Spot | null {
  const maxM = options.maxM ?? 1500;
  let best: Spot | null = null;
  for (const piece of pieces) {
    if (seen.has(piece.id) || (piece.kind === "path" && !options.paths)) continue;
    const d = distanceToLineM(p, piece.coords);
    if (d <= maxM && (!best || d < best.distanceM)) best = { piece, distanceM: d };
  }
  return best;
}

/** For outings in chronological order: which of the pieces each one saw were seen for the first time. */
export function newPerOuting(outings: readonly { id: string; seen: Iterable<string> }[]): Map<string, Set<string>> {
  const known = new Set<string>();
  const result = new Map<string, Set<string>>();
  for (const o of outings) {
    const fresh = new Set<string>();
    for (const id of o.seen) if (!known.has(id)) fresh.add(id);
    for (const id of fresh) known.add(id);
    result.set(o.id, fresh);
  }
  return result;
}
