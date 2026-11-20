import { distanceM } from "./geo";
import { MAX_ACCURACY_M, type Fix, type TrackSummary } from "./track";

/**
 * Reading location history from other apps into plain fixes (time, position, accuracy).
 * Only real recorded points are used; nothing is guessed between them.
 */

/** Accuracy assumed for points that come without one (Google's smoothed path points). */
const ASSUMED_ACC_M = 15;
/** Jumps faster than this are GPS errors (same limit as live recording). */
const MAX_SPEED_MS = 50;

type Json = unknown;
const isObj = (x: Json): x is Record<string, Json> => typeof x === "object" && x !== null && !Array.isArray(x);
const arr = (x: Json): Json[] => (Array.isArray(x) ? x : []);

/** "geo:50.94,6.83", "50.9406794°, 6.8319856°" or "50.94, 6.83" → [lon, lat]. */
export function parseLatLngText(text: string): [number, number] | null {
  const m = /(-?\d+(?:\.\d+)?)°?\s*,\s*(-?\d+(?:\.\d+)?)°?/.exec(text.replace(/^geo:/, ""));
  if (!m) return null;
  const lat = Number(m[1]);
  const lon = Number(m[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return [lon, lat];
}

function zeit(x: Json): number | null {
  if (typeof x === "number") return x > 1e11 ? x : x * 1000;
  if (typeof x !== "string") return null;
  if (/^\d+$/.test(x)) return Number(x);
  const t = Date.parse(x);
  return Number.isNaN(t) ? null : t;
}

function e7(o: Record<string, Json>): [number, number] | null {
  const lat = o.latE7 ?? o.latitudeE7;
  const lon = o.lngE7 ?? o.longitudeE7;
  return typeof lat === "number" && typeof lon === "number" ? [lon / 1e7, lat / 1e7] : null;
}

function punkt(t: number | null, lonLat: [number, number] | null, acc: Json, out: Fix[]) {
  if (t === null || !lonLat) return;
  out.push({ t, lon: lonLat[0], lat: lonLat[1], acc: typeof acc === "number" ? acc : ASSUMED_ACC_M });
}

/**
 * All recorded points of a Google location history export, sorted by time. Understands:
 * the iPhone on-device export (location-history.json), the Android export (Timeline.json with
 * semanticSegments and rawSignals), the old Takeout Records.json and the old monthly
 * "Semantic Location History" files. Visits and start/end-only activities carry no route and are skipped.
 */
export function parseGoogleTimeline(json: Json): Fix[] {
  const out: Fix[] = [];
  const segmente = Array.isArray(json) ? json : isObj(json) ? arr(json.semanticSegments) : [];
  for (const s of segmente) {
    if (!isObj(s)) continue;
    const start = zeit(s.startTime);
    const pfad = arr(s.timelinePath);
    // iPhone: offsets in whole minutes, so several points share one minute; spread them evenly within it.
    const jeMinute = new Map<string, number>();
    for (const p of pfad) if (isObj(p) && p.time === undefined) jeMinute.set(String(p.durationMinutesOffsetFromStartTime), (jeMinute.get(String(p.durationMinutesOffsetFromStartTime)) ?? 0) + 1);
    const gezaehlt = new Map<string, number>();
    for (const p of pfad) {
      if (!isObj(p) || typeof p.point !== "string") continue;
      let t = zeit(p.time);
      if (t === null && start !== null && p.durationMinutesOffsetFromStartTime !== undefined) {
        const k = String(p.durationMinutesOffsetFromStartTime);
        const i = gezaehlt.get(k) ?? 0;
        gezaehlt.set(k, i + 1);
        t = start + Number(k) * 60_000 + Math.round((i * 60_000) / (jeMinute.get(k) ?? 1));
      }
      punkt(t, parseLatLngText(p.point), undefined, out);
    }
  }
  if (isObj(json)) {
    for (const r of arr(json.rawSignals)) {
      const pos = isObj(r) && isObj(r.position) ? r.position : null;
      if (!pos) continue;
      const text = pos.LatLng ?? pos.latLng;
      punkt(zeit(pos.timestamp), typeof text === "string" ? parseLatLngText(text) : null, pos.accuracyMeters, out);
    }
    for (const l of arr(json.locations)) if (isObj(l)) punkt(zeit(l.timestamp ?? l.timestampMs), e7(l), l.accuracy, out);
    for (const o of arr(json.timelineObjects)) {
      const seg = isObj(o) && isObj(o.activitySegment) ? o.activitySegment : null;
      const roh = seg && isObj(seg.simplifiedRawPath) ? arr(seg.simplifiedRawPath.points) : [];
      for (const p of roh) if (isObj(p)) punkt(zeit(p.timestamp ?? p.timestampMs), e7(p), p.accuracyMeters, out);
    }
  }
  return bereinigen(out);
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
    if (Number.isFinite(lat) && Number.isFinite(lon)) punkt(t, [lon, lat], hacc !== undefined ? Number(hacc) : 5, out);
  }
  return bereinigen(out);
}

/** Sorted by time, without duplicates, inaccurate points and jumps. */
function bereinigen(fixes: Fix[]): Fix[] {
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
