import { distanceM } from "./geo";
import { MAX_ACCURACY_M, type Fix, type TrackSummary } from "./track";

/**
 * Reading tracks from other apps (GPX) into plain fixes (time, position, accuracy).
 * (A Google Timeline reader existed until 21.11.2026 and was removed on Michi's wish.)
 * Only real recorded points are used; nothing is guessed between them.
 */

/** Jumps faster than this are GPS errors (same limit as live recording). */
const MAX_SPEED_MS = 50;

function zeit(x: string | undefined): number | null {
  if (!x) return null;
  const t = Date.parse(x);
  return Number.isNaN(t) ? null : t;
}

/** Track points of a GPX file (Apple Health workout routes, Strava, Komoot, …). Points without time are skipped. */
export function parseGpx(text: string): Fix[] {
  const out: Fix[] = [];
  const re = /<trkpt\b([^>]*)>([\s\S]*?)<\/trkpt>/g;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    const lat = Number(/\blat="([^"]+)"/.exec(m[1]!)?.[1]);
    const lon = Number(/\blon="([^"]+)"/.exec(m[1]!)?.[1]);
    const t = zeit(/<time>([^<]+)<\/time>/.exec(m[2]!)?.[1]?.trim());
    const hacc = /<(?:\w+:)?hAcc>([^<]+)</.exec(m[2]!)?.[1];
    if (Number.isFinite(lat) && Number.isFinite(lon) && t !== null) out.push({ t, lon, lat, acc: hacc !== undefined ? Number(hacc) : 5 });
  }
  return cleanFixes(out);
}

/** Sorted by time, without duplicates, inaccurate points (over 25 m) and jumps (over 50 m/s). */
export function cleanFixes(fixes: Fix[]): Fix[] {
  fixes.sort((a, b) => a.t - b.t);
  const out: Fix[] = [];
  for (const f of fixes) {
    if (!(f.acc <= MAX_ACCURACY_M)) continue;
    const prev = out.at(-1);
    if (prev) {
      const dt = (f.t - prev.t) / 1000;
      if (dt <= 0) continue;
      if (distanceM([prev.lon, prev.lat], [f.lon, f.lat]) / dt > MAX_SPEED_MS) continue;
    }
    out.push(f);
  }
  return out;
}

/**
 * Splits a long history into outings at pauses (default 10 minutes) and at jumps (default 300 m,
 * so no straight line is ever drawn across town); tiny ones are dropped.
 */
export function splitOutings(fixes: readonly Fix[], options: { maxPauseS?: number; maxJumpM?: number; minPoints?: number; minDistanceM?: number } = {}): Fix[][] {
  const maxPause = (options.maxPauseS ?? 600) * 1000;
  const maxJump = options.maxJumpM ?? 300;
  const minPoints = options.minPoints ?? 3;
  const minDistance = options.minDistanceM ?? 50;
  const teile: Fix[][] = [];
  let aktuell: Fix[] = [];
  for (const f of fixes) {
    const prev = aktuell.at(-1);
    if (prev && (f.t - prev.t > maxPause || distanceM([prev.lon, prev.lat], [f.lon, f.lat]) > maxJump)) {
      teile.push(aktuell);
      aktuell = [];
    }
    aktuell.push(f);
  }
  if (aktuell.length) teile.push(aktuell);
  return teile.filter((t) => {
    if (t.length < minPoints) return false;
    let d = 0;
    for (let i = 1; i < t.length; i++) d += distanceM([t[i - 1]!.lon, t[i - 1]!.lat], [t[i]!.lon, t[i]!.lat]);
    return d >= minDistance;
  });
}

/**
 * How dense an imported history is: the share of consecutive points close enough in time (≤ 60 s)
 * or space (≤ 60 m) to be matched to streets. Google's smoothed paths are often coarser than that.
 */
export function density(outings: readonly Fix[][]): number {
  let gut = 0;
  let alle = 0;
  for (const o of outings)
    for (let i = 1; i < o.length; i++) {
      alle++;
      const a = o[i - 1]!;
      const b = o[i]!;
      if (b.t - a.t <= 60_000 || distanceM([a.lon, a.lat], [b.lon, b.lat]) <= 60) gut++;
    }
  return alle ? gut / alle : 0;
}

const FOOT_MAX_MS = 2;
const BIKE_MAX_MS = 30 / 3.6;

/** Distance, duration and way of moving of an imported outing, also when its points are minutes apart. */
export function summarizeImported(fixes: readonly Fix[]): TrackSummary {
  if (fixes.length < 2) return { distanceM: 0, durationS: 0, mode: "foot" };
  let distance = 0;
  const speeds: number[] = [];
  for (let i = 1; i < fixes.length; i++) {
    const a = fixes[i - 1]!;
    const b = fixes[i]!;
    const dt = (b.t - a.t) / 1000;
    if (dt <= 0) continue;
    const d = distanceM([a.lon, a.lat], [b.lon, b.lat]);
    distance += d;
    speeds.push(d / dt);
  }
  speeds.sort((x, y) => x - y);
  const median = speeds.length ? speeds[Math.floor(speeds.length / 2)]! : 0;
  return {
    distanceM: distance,
    durationS: Math.round((fixes[fixes.length - 1]!.t - fixes[0]!.t) / 1000),
    mode: median <= FOOT_MAX_MS ? "foot" : median <= BIKE_MAX_MS ? "bike" : "car",
  };
}
