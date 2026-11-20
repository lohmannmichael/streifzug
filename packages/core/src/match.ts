import { lineLengthM, pointAlong, type LonLat } from "./geo";
import type { Piece } from "./pieces";
import type { Fix } from "./track";

export interface MatchOptions {
  /** How far the GPS track may be from the street (m). */
  radiusM: number;
  /** Share of the piece that must be covered. */
  minShare: number;
  /** Fixes further apart in time are not connected (s). */
  maxGapS: number;
  /** The track must run roughly along the street (degrees), so crossing a side street does not count. */
  maxAngleDeg: number;
  /**
   * Imported histories are often sparser in time: points further apart than maxGapS are still
   * connected if they are at most this far apart (m). 0 = off (live recording).
   */
  maxGapM: number;
}

export const MATCH_DEFAULTS: MatchOptions = { radiusM: 20, minShare: 0.6, maxGapS: 60, maxAngleDeg: 45, maxGapM: 0 };

const M_PER_DEG_LAT = 111_195;
const SAMPLE_M = 5;
/** A little room at the ends of each track part, so bends in the track leave no gaps. */
const END_SLACK_M = 3;

type XY = [number, number];
interface Seg {
  a: XY;
  b: XY;
  angle: number;
}

/** Ids of the pieces a set of GPS fixes has covered (see docs/PLAN.md, section 2). */
export function seenPieceIds(pieces: readonly Piece[], fixes: readonly Fix[], options: Partial<MatchOptions> = {}): Set<string> {
  const o = { ...MATCH_DEFAULTS, ...options };
  const seen = new Set<string>();
  if (pieces.length === 0 || fixes.length === 0) return seen;

  const lat0 = fixes[0]!.lat;
  const mx = M_PER_DEG_LAT * Math.cos((lat0 * Math.PI) / 180);
  const xy = (p: LonLat): XY => [p[0] * mx, p[1] * M_PER_DEG_LAT];

  // Track as straight parts in local meters, in a grid for quick lookups.
  const cell = o.radiusM;
  const grid = new Map<string, Seg[]>();
  const add = (x: number, y: number, s: Seg) => {
    const k = `${Math.floor(x / cell)}:${Math.floor(y / cell)}`;
    (grid.get(k) ?? grid.set(k, []).get(k)!).push(s);
  };
  for (let i = 1; i < fixes.length; i++) {
    const p = fixes[i - 1]!;
    const q = fixes[i]!;
    const a = xy([p.lon, p.lat]);
    const b = xy([q.lon, q.lat]);
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if ((q.t - p.t) / 1000 > o.maxGapS && len > o.maxGapM) continue;
    if (len < 0.5) continue;
    const s: Seg = { a, b, angle: Math.atan2(b[1] - a[1], b[0] - a[0]) };
    // Register the part in every cell along it.
    const steps = Math.ceil(len / cell);
    for (let k = 0; k <= steps; k++) add(a[0] + ((b[0] - a[0]) * k) / steps, a[1] + ((b[1] - a[1]) * k) / steps, s);
  }
  if (grid.size === 0) return seen;

  const maxAngle = (o.maxAngleDeg * Math.PI) / 180;
  for (const piece of pieces) {
    const length = piece.lengthM || lineLengthM(piece.coords);
    const n = Math.max(2, Math.ceil(length / SAMPLE_M) + 1);
    const start = xy(piece.coords[0]!);
    const end = xy(piece.coords[piece.coords.length - 1]!);
    const pieceAngle = Math.atan2(end[1] - start[1], end[0] - start[0]);
    let covered = 0;
    for (let k = 0; k < n; k++) {
      const p = xy(pointAlong(piece.coords, (length * k) / (n - 1)));
      if (near(p, grid, cell, o.radiusM, pieceAngle, maxAngle)) covered++;
    }
    if (covered / n >= o.minShare) seen.add(piece.id);
  }
  return seen;
}

function near(p: XY, grid: Map<string, Seg[]>, cell: number, radius: number, pieceAngle: number, maxAngle: number): boolean {
  const cx = Math.floor(p[0] / cell);
  const cy = Math.floor(p[1] / cell);
  for (let dx = -1; dx <= 1; dx++)
    for (let dy = -1; dy <= 1; dy++)
      for (const s of grid.get(`${cx + dx}:${cy + dy}`) ?? []) {
        let diff = Math.abs(pieceAngle - s.angle) % Math.PI;
        diff = Math.min(diff, Math.PI - diff);
        if (diff > maxAngle) continue;
        if (distance(p, s.a, s.b) <= radius) return true;
      }
  return false;
}

/**
 * Sideways distance from p to the track part a–b, or Infinity if p lies ahead of or behind it.
 * The 20 m radius is for GPS error to the side; it must not reach beyond where you actually went.
 */
function distance(p: XY, a: XY, b: XY): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Infinity;
  const slack = END_SLACK_M / Math.sqrt(len2);
  const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2;
  if (t < -slack || t > 1 + slack) return Infinity;
  const tc = Math.max(0, Math.min(1, t));
  return Math.hypot(p[0] - (a[0] + tc * dx), p[1] - (a[1] + tc * dy));
}
