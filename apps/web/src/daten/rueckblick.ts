import { gefahrenJePunkt, type Fix } from "@streifzug/core";
import { useCallback, useState } from "react";
import { wegeSeit, type KurzWeg } from "./import";
import { alleLaden } from "./speicher";

/**
 * Replay on opening: if outings came in since the last visit (Overland or own), the map
 * runs along them once. Remembers up to when everything has been seen.
 */
const BIS = "streifzug.rueckblick-bis";
// On the very first start only the last 12 hours count, not the whole history.
const ERSTES_MAL_MS = 12 * 3600_000;

export interface Rueckblick {
  nr: number;
  /** Last visit: what was first walked after this is new. */
  seit: number;
  wege: KurzWeg[];
  km: number;
}

export function kuerzen(fixes: Fix[]): [number, number][] {
  return kurzIndizes(fixes.length).map((i) => [fixes[i]!.lon, fixes[i]!.lat]);
}

function kurzIndizes(n: number): number[] {
  const schritt = Math.max(1, Math.ceil(n / 400));
  const out: number[] = [];
  for (let i = 0; i < n; i += schritt) out.push(i);
  if (n > 0 && (n - 1) % schritt !== 0) out.push(n - 1);
  return out;
}

/** Shortened own way for the replay, with its car legs marked (Bauplan 3, F1). */
export function kurzMitArt(fixes: Fix[]): { coords: [number, number][]; gefahren: boolean[] } {
  const g = gefahrenJePunkt(fixes);
  const idx = kurzIndizes(fixes.length);
  return { coords: idx.map((i) => [fixes[i]!.lon, fixes[i]!.lat]), gefahren: idx.map((i) => g[i]!) };
}

/** Everything up to now counts as seen (e.g. after an outing that was watched live). */
export const alsGesehenMerken = () => localStorage.setItem(BIS, String(Date.now()));

export function useRueckblick() {
  const [rueckblick, setRueckblick] = useState<Rueckblick | null>(null);

  const pruefen = useCallback(async () => {
    const seit = Number(localStorage.getItem(BIS)) || Date.now() - ERSTES_MAL_MS;
    const [andere, eigene] = await Promise.all([wegeSeit(seit), alleLaden()]);
    const neu: KurzWeg[] = [
      ...andere,
      ...eigene
        .filter((s) => s.status !== "aktiv" && (s.endedAt ?? s.startedAt) > seit && s.fixes.length > 1)
        .map((s) => ({ id: s.id, startedAt: s.startedAt, endedAt: s.endedAt ?? s.startedAt, distanceM: s.distanceM, ...kurzMitArt(s.fixes) })),
    ].sort((a, b) => a.startedAt - b.startedAt);
    alsGesehenMerken();
    if (neu.length === 0) return;
    // Streets first walked on one of these ways are "new" (their start, not the last visit, counts).
    const ab = neu.reduce((m, w) => Math.min(m, w.startedAt), Infinity);
    setRueckblick((alt) => ({ nr: (alt?.nr ?? 0) + 1, seit: ab, wege: neu, km: neu.reduce((m, w) => m + w.distanceM, 0) / 1000 }));
  }, []);

  return { rueckblick, pruefen, beenden: useCallback(() => setRueckblick(null), []) };
}
