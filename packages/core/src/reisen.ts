/**
 * Trips (Bauplan 3, F6). A trip begins when ways lie more than `radiusKm` from home and there is at
 * least one night between its first and last way; it ends with the first way back within the
 * radius. The thresholds are an assumption; Michi decides them.
 */
import { distanceM, type LonLat } from "./geo";

export const REISE_RADIUS_KM = 100;

export interface ReiseWeg {
  id: string;
  start: number;
  ende: number;
  /** A point of the way that stands for it (its middle). */
  punkt: LonLat;
  /** Length in meters. */
  m: number;
}

export interface Reise {
  /** Stable while the trip's first way stays the same ("reise:<start>"). */
  id: string;
  von: number;
  bis: number;
  wege: string[];
  punkte: LonLat[];
  m: number;
}

const tag = (t: number) => new Date(t).toDateString();

/** Trips in the ways (any order), newest first. */
export function reisenFinden(wege: readonly ReiseWeg[], zuhause: LonLat, radiusKm = REISE_RADIUS_KM): Reise[] {
  const sortiert = [...wege].sort((a, b) => a.start - b.start);
  const out: Reise[] = [];
  let lauf: ReiseWeg[] = [];
  const abschliessen = () => {
    if (lauf.length && tag(lauf[0]!.start) !== tag(lauf.at(-1)!.ende))
      out.push({ id: `reise:${lauf[0]!.start}`, von: lauf[0]!.start, bis: lauf.at(-1)!.ende, wege: lauf.map((w) => w.id), punkte: lauf.map((w) => w.punkt), m: lauf.reduce((s, w) => s + w.m, 0) });
    lauf = [];
  };
  for (const w of sortiert) {
    if (distanceM(w.punkt, zuhause) > radiusKm * 1000) lauf.push(w);
    else abschliessen();
  }
  abschliessen();
  return out.reverse();
}

const laenderNamen = (() => {
  try {
    return new Intl.DisplayNames(["de"], { type: "region" });
  } catch {
    return null;
  }
})();

/** Name from the places visited: one place, two places, or the country (renamable by Michi). */
export function reiseName(orte: readonly string[], laender: readonly string[]): string {
  const o = [...new Set(orte)];
  if (o.length === 0) return laender.length === 1 ? (laenderNamen?.of(laender[0]!) ?? laender[0]!) : "Reise";
  if (o.length === 1) return o[0]!;
  if (o.length === 2) return `${o[0]} und ${o[1]}`;
  const l = [...new Set(laender)];
  if (l.length === 1) return laenderNamen?.of(l[0]!) ?? l[0]!;
  return `${o[0]}, ${o[1]} und weitere`;
}
