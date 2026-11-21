import { distanceM, type LonLat } from "./geo";

/** One GPS position: time (ms since 1970), position, accuracy radius in meters. */
export interface Fix {
  t: number;
  lon: number;
  lat: number;
  acc: number;
  /** iOS motion activity from Overland ("walking", "running", "cycling", "automotive", "stationary", …), if known. */
  motion?: string[];
  /** Speed in m/s as measured by the phone, if known. */
  speed?: number;
}

export type Mode = "foot" | "bike" | "car";

export const MAX_ACCURACY_M = 25;
const MAX_SPEED_MS = 50;
const MAX_GAP_S = 60;
/** Median speed limits: up to 7.2 km/h on foot, up to 30 km/h by bike, faster by car. */
const FOOT_MAX_MS = 2;
const BIKE_MAX_MS = 30 / 3.6;

const pos = (f: Fix): LonLat => [f.lon, f.lat];

/** Whether a new fix is good enough to keep, given the last kept one. */
export function acceptFix(prev: Fix | null, fix: Fix): boolean {
  if (fix.acc > MAX_ACCURACY_M) return false;
  if (!prev) return true;
  const dt = (fix.t - prev.t) / 1000;
  if (dt <= 0) return false;
  return distanceM(pos(prev), pos(fix)) / dt <= MAX_SPEED_MS;
}

export interface TrackSummary {
  distanceM: number;
  durationS: number;
  mode: Mode;
}

/** Distance (no bridging of gaps over a minute), duration and the most likely way of moving. */
export function summarize(fixes: readonly Fix[]): TrackSummary {
  if (fixes.length < 2) return { distanceM: 0, durationS: 0, mode: "foot" };
  let distance = 0;
  const speeds: number[] = [];
  for (let i = 1; i < fixes.length; i++) {
    const dt = (fixes[i]!.t - fixes[i - 1]!.t) / 1000;
    if (dt <= 0 || dt > MAX_GAP_S) continue;
    const d = distanceM(pos(fixes[i - 1]!), pos(fixes[i]!));
    distance += d;
    speeds.push(d / dt);
  }
  speeds.sort((a, b) => a - b);
  const median = speeds.length ? speeds[Math.floor(speeds.length / 2)]! : 0;
  const mode: Mode = median <= FOOT_MAX_MS ? "foot" : median <= BIKE_MAX_MS ? "bike" : "car";
  return { distanceM: distance, durationS: Math.round((fixes[fixes.length - 1]!.t - fixes[0]!.t) / 1000), mode };
}

/**
 * Compact storage format (version 1): start time plus deltas of time (0.1 s),
 * longitude and latitude (1e-6 degrees, about 0.1 m) and the accuracy (m), as one flat list.
 */
export interface EncodedTrack {
  v: 1;
  t0: number;
  d: number[];
}

export function encodeTrack(fixes: readonly Fix[]): EncodedTrack {
  const d: number[] = [];
  let t = fixes[0]?.t ?? 0;
  let lon = 0;
  let lat = 0;
  const t0 = t;
  for (const f of fixes) {
    const ft = Math.round((f.t - t0) / 100);
    const flon = Math.round(f.lon * 1e6);
    const flat = Math.round(f.lat * 1e6);
    d.push(ft - Math.round((t - t0) / 100), flon - lon, flat - lat, Math.round(f.acc));
    t = t0 + ft * 100;
    lon = flon;
    lat = flat;
  }
  return { v: 1, t0, d };
}

export function decodeTrack(enc: EncodedTrack): Fix[] {
  const out: Fix[] = [];
  let t = 0;
  let lon = 0;
  let lat = 0;
  for (let i = 0; i + 3 < enc.d.length; i += 4) {
    t += enc.d[i]!;
    lon += enc.d[i + 1]!;
    lat += enc.d[i + 2]!;
    out.push({ t: enc.t0 + t * 100, lon: lon / 1e6, lat: lat / 1e6, acc: enc.d[i + 3]! });
  }
  return out;
}
