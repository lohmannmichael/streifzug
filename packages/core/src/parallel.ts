import type { LonLat } from "./geo";

export interface WeightInput {
  /** Pieces of the same original line never pair with each other. */
  lineId: number;
  /** Only major roads (trunk, primary, secondary, tertiary) can be dual carriageways. */
  major: boolean;
  coords: readonly LonLat[];
}

const M_PER_DEG_LAT = 111_195;

/**
 * Dual carriageways are mapped as two lines. A piece of a major road that runs closely parallel
 * to another major line counts half, so the road counts once in totals. Walking along one side
 * usually covers both within the 20 m matching distance.
 */
export function parallelWeights(items: readonly WeightInput[], maxDistM = 35, maxAngleDeg = 20): number[] {
  if (items.length === 0) return [];
  const lat0 = items[0]!.coords[0]![1];
  const mx = M_PER_DEG_LAT * Math.cos((lat0 * Math.PI) / 180);
  const toXY = (p: LonLat): [number, number] => [p[0] * mx, p[1] * M_PER_DEG_LAT];

  // Spatial grid of all straight parts of major pieces.
  const cell = maxDistM;
  const grid = new Map<string, { item: number; a: [number, number]; b: [number, number] }[]>();
  const key = (x: number, y: number) => `${Math.floor(x / cell)}:${Math.floor(y / cell)}`;
  items.forEach((it, item) => {
    if (!it.major) return;
    for (let i = 1; i < it.coords.length; i++) {
      const a = toXY(it.coords[i - 1]!);
      const b = toXY(it.coords[i]!);
      const k = key((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
      (grid.get(k) ?? grid.set(k, []).get(k)!).push({ item, a, b });
    }
  });

  return items.map((it, self) => {
    if (!it.major || it.coords.length < 2) return 1;
    const first = toXY(it.coords[0]!);
    const last = toXY(it.coords[it.coords.length - 1]!);
    const mid: [number, number] = [(first[0] + last[0]) / 2, (first[1] + last[1]) / 2];
    const angle = Math.atan2(last[1] - first[1], last[0] - first[0]);
    const cx = Math.floor(mid[0] / cell);
    const cy = Math.floor(mid[1] / cell);
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        for (const part of grid.get(`${cx + dx}:${cy + dy}`) ?? []) {
          if (part.item === self || items[part.item]!.lineId === it.lineId) continue;
          if (distanceToSegment(mid, part.a, part.b) > maxDistM) continue;
          const other = Math.atan2(part.b[1] - part.a[1], part.b[0] - part.a[0]);
          let diff = Math.abs(angle - other) % Math.PI;
          diff = Math.min(diff, Math.PI - diff);
          if ((diff * 180) / Math.PI <= maxAngleDeg) return 0.5;
        }
    return 1;
  });
}

function distanceToSegment(p: [number, number], a: [number, number], b: [number, number]): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}
