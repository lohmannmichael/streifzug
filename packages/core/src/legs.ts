import { distanceM } from "./geo";
import { seenPieceIds, type MatchOptions } from "./match";
import type { Piece } from "./pieces";
import { MAX_ACCURACY_M, type Fix } from "./track";

/**
 * Splitting an outing into legs that are either "aktiv" (on foot, by bike: highlighter, counts)
 * or "gefahren" (car, bus, train: pen line, never counts). Rule of thumb: the way of moving
 * only changes when you stand still. See docs/PLAN.md, section 6.2.
 */

export type Art = "aktiv" | "gefahren";

export interface Leg {
  art: Art;
  /** Classified by speed alone in the 30–38 km/h band: could be a fast bike. */
  unsicher: boolean;
  von: number;
  bis: number;
  fixes: Fix[];
}

const MAX_ACC_M = 50;
const MAX_SPEED_MS = 50;
const SMOOTH_MS = 5_000;
const HALT_SPEED_MS = 0.4;
const HALT_MS = 30_000;
const GAP_MS = 60_000;
const MOTION_SWITCH_MS = 20_000;
const FAST_MS = 30 / 3.6;
const SURE_FAST_MS = 38 / 3.6;
const SHORT_MS = 60_000;
const SHORT_M = 150;
const ACTIVE = new Set(["walking", "running", "cycling"]);

const d = (a: Fix, b: Fix) => distanceM([a.lon, a.lat], [b.lon, b.lat]);

/** What the phone says about how one moves at this point, if anything. */
function motionArt(f: Fix): Art | null {
  if (!f.motion || f.motion.length === 0) return null;
  if (f.motion.includes("automotive")) return "gefahren";
  if (f.motion.some((m) => ACTIVE.has(m))) return "aktiv";
  return null;
}

/** Sorted, without duplicates, very inaccurate points (over 50 m) and jumps (over 50 m/s). */
function saeubern(input: readonly Fix[]): Fix[] {
  const sorted = [...input].sort((a, b) => a.t - b.t);
  const out: Fix[] = [];
  for (const f of sorted) {
    if (!(f.acc <= MAX_ACC_M)) continue;
    const prev = out.at(-1);
    if (prev) {
      const dt = (f.t - prev.t) / 1000;
      if (dt <= 0 || d(prev, f) / dt > MAX_SPEED_MS) continue;
    }
    out.push(f);
  }
  return out;
}

/** Speed at each point, averaged over ±5 s of track (m/s). */
function glatteTempi(f: Fix[]): number[] {
  const kum = [0];
  for (let i = 1; i < f.length; i++) kum.push(kum[i - 1]! + d(f[i - 1]!, f[i]!));
  const out: number[] = [];
  let a = 0;
  let b = 0;
  for (let i = 0; i < f.length; i++) {
    while (f[a]!.t < f[i]!.t - SMOOTH_MS) a++;
    while (b + 1 < f.length && f[b + 1]!.t <= f[i]!.t + SMOOTH_MS) b++;
    // Sparse points (Overland sends about one every 30 s): the window always reaches the neighbours,
    // otherwise a lone point would count as standing still.
    const von = a === i && i > 0 ? i - 1 : a;
    const bis = b === i && i + 1 < f.length ? i + 1 : b;
    const dt = (f[bis]!.t - f[von]!.t) / 1000;
    out.push(dt > 0 ? (kum[bis]! - kum[von]!) / dt : (f[i]!.speed ?? 0));
  }
  return out;
}

function quantil(werte: number[], q: number): number {
  if (werte.length === 0) return 0;
  const s = [...werte].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))]!;
}

function einstufen(fixes: Fix[], tempi: number[]): { art: Art; unsicher: boolean } {
  const bekannt = fixes.map(motionArt).filter((a): a is Art => a !== null);
  if (bekannt.length >= fixes.length / 2) {
    const auto = bekannt.filter((a) => a === "gefahren").length / bekannt.length;
    if (auto >= 0.5) return { art: "gefahren", unsicher: false };
    if (1 - auto >= 0.6) return { art: "aktiv", unsicher: false };
  }
  const p90 = quantil(tempi, 0.9);
  if (p90 > SURE_FAST_MS) return { art: "gefahren", unsicher: false };
  if (p90 > FAST_MS) return { art: "gefahren", unsicher: true };
  return { art: "aktiv", unsicher: false };
}

export function splitLegs(input: readonly Fix[]): Leg[] {
  const f = saeubern(input);
  if (f.length < 2) return [];
  const tempi = glatteTempi(f);

  // Halts: runs below 1 m/s that last at least 30 s. Their points belong to no leg.
  const halt = new Array<boolean>(f.length).fill(false);
  for (let i = 0; i < f.length; ) {
    if (tempi[i]! >= HALT_SPEED_MS) {
      i++;
      continue;
    }
    let j = i;
    while (j + 1 < f.length && tempi[j + 1]! < HALT_SPEED_MS) j++;
    if (f[j]!.t - f[i]!.t >= HALT_MS) for (let k = i; k <= j; k++) halt[k] = true;
    i = j + 1;
  }

  // Raw pieces of movement, cut at halts, gaps and lasting changes of the phone's motion activity.
  const teile: number[][] = [];
  let aktuell: number[] = [];
  let artJetzt: Art | null = null;
  const schliessen = () => {
    if (aktuell.length >= 2) teile.push(aktuell);
    aktuell = [];
    artJetzt = null;
  };
  for (let i = 0; i < f.length; i++) {
    if (halt[i]) {
      schliessen();
      continue;
    }
    const prev = aktuell.at(-1);
    if (prev !== undefined && f[i]!.t - f[prev]!.t > GAP_MS) schliessen();
    const m = motionArt(f[i]!);
    if (m && artJetzt && m !== artJetzt) {
      // Only a change that lasts 20 s counts (a short "automotive" on a bike is noise).
      let k = i;
      while (k + 1 < f.length && !halt[k + 1] && (motionArt(f[k + 1]!) ?? m) === m) k++;
      if (f[k]!.t - f[i]!.t >= MOTION_SWITCH_MS) {
        schliessen();
      }
    }
    if (m && !artJetzt) artJetzt = m;
    aktuell.push(i);
  }
  schliessen();

  const legs: Leg[] = teile.map((idx) => {
    const fixes = idx.map((i) => f[i]!);
    return { ...einstufen(fixes, idx.map((i) => tempi[i]!)), von: fixes[0]!.t, bis: fixes.at(-1)!.t, fixes };
  });

  // Smoothing: short legs between two neighbours of the same kind take their kind.
  for (let i = 1; i + 1 < legs.length; i++) {
    const l = legs[i]!;
    const laenge = l.fixes.reduce((m, x, k) => (k ? m + d(l.fixes[k - 1]!, x) : 0), 0);
    if ((l.bis - l.von < SHORT_MS || laenge < SHORT_M) && legs[i - 1]!.art === legs[i + 1]!.art && l.art !== legs[i - 1]!.art) {
      l.art = legs[i - 1]!.art;
      l.unsicher = false;
    }
  }
  return legs;
}

/**
 * What an outing covered, per kind of leg: "aktiv" (streets only, points up to 25 m inaccurate)
 * and "gefahren" (streets and motorways, 30 m to the side, points up to 50 m inaccurate).
 */
export function seenByLegs(pieces: readonly Piece[], fixes: readonly Fix[], options: Partial<MatchOptions> = {}): { aktiv: Set<string>; gefahren: Set<string> } {
  // Paths (park, Tierpark, forest) are recognised too: drawn, but they never count (only streets do).
  const strassen = pieces.filter((p) => p.kind === "street" || p.kind === "path");
  const fahrbar = pieces.filter((p) => p.kind === "street" || p.kind === "drive");
  const aktiv = new Set<string>();
  const gefahren = new Set<string>();
  // Aktiv legs one after another (only a halt between them, nothing driven) are matched as one
  // walk, with the points of the halt: otherwise the street where you slowed down stays white.
  const legs = splitLegs(fixes);
  const sortiert = [...fixes].sort((x, y) => x.t - y.t);
  for (let i = 0; i < legs.length; i++) {
    const leg = legs[i]!;
    if (leg.art !== "aktiv") {
      for (const id of seenPieceIds(fahrbar, leg.fixes, { ...options, radiusM: 30 })) gefahren.add(id);
      continue;
    }
    let j = i;
    while (j + 1 < legs.length && legs[j + 1]!.art === "aktiv") j++;
    const von = leg.von;
    const bis = legs[j]!.bis;
    const genau = sortiert.filter((x) => x.t >= von && x.t <= bis && x.acc <= MAX_ACCURACY_M);
    for (const id of seenPieceIds(strassen, genau, options)) aktiv.add(id);
    i = j;
  }
  return { aktiv, gefahren };
}
