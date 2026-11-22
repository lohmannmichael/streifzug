import { distanceM, reiseName, reisenFinden, type LonLat, type Reise } from "@streifzug/core";
import { useEffect, useMemo, useState } from "react";
import { ANDERE_GEAENDERT, fragen } from "./arbeiter";
import type { Fortschritt } from "./fortschritt";
import type { FremderOrt } from "./orte";
import { zaehlendeMeter, type Region, type Regionen } from "./regionen";

/**
 * Trips (Bauplan 3, F6) for the Orte page: found in all ways (time, middle point, length) from
 * the background worker. Home is the place with the most walked meters (as on the Orte page).
 * Names come from the places visited; Michi can rename a trip (kept on the device).
 */
export interface ReiseZeile extends Reise {
  name: string;
  orte: string[];
  box: [[number, number], [number, number]];
}

const NAMEN = "streifzug.reisen-namen";

function namenLesen(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(NAMEN) ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

export function reiseUmbenennen(id: string, name: string) {
  const n = namenLesen();
  if (name.trim()) n[id] = name.trim();
  else delete n[id];
  localStorage.setItem(NAMEN, JSON.stringify(n));
  window.dispatchEvent(new Event(NAMEN));
}

const mitte = (r: Region): LonLat => [(r.bbox[0] + r.bbox[2]) / 2, (r.bbox[1] + r.bbox[3]) / 2];

export function useReisen(daten: Regionen | null, f: Fortschritt | null, fremde: readonly FremderOrt[]): ReiseZeile[] {
  const [wege, setWege] = useState<Parameters<typeof reisenFinden>[0] | null>(null);
  const [namen, setNamen] = useState(namenLesen);
  useEffect(() => {
    let lebt = true;
    const laden = () => void fragen<"reiseWege">({ typ: "reiseWege" }).antwort.then((a) => lebt && setWege(a.wege));
    const umbenannt = () => setNamen(namenLesen());
    laden();
    window.addEventListener(ANDERE_GEAENDERT, laden);
    window.addEventListener(NAMEN, umbenannt);
    return () => {
      lebt = false;
      window.removeEventListener(ANDERE_GEAENDERT, laden);
      window.removeEventListener(NAMEN, umbenannt);
    };
  }, []);
  return useMemo(() => {
    if (!daten || !wege) return [];
    const zuhause = [...daten.liste].sort(
      (a, b) => zaehlendeMeter(f?.proGebiet.get(b.wurzel) ?? { strasse_m: 0, weg_m: 0 }, false) - zaehlendeMeter(f?.proGebiet.get(a.wurzel) ?? { strasse_m: 0, weg_m: 0 }, false),
    )[0];
    if (!zuhause || zaehlendeMeter(f?.proGebiet.get(zuhause.wurzel) ?? { strasse_m: 0, weg_m: 0 }, false) < 1) return [];
    return reisenFinden(wege, mitte(zuhause)).map((r) => {
      const orte: string[] = [];
      const laender: string[] = [];
      for (const p of r.punkte) {
        const region = daten.liste.find((x) => p[0] >= x.bbox[0] && p[0] <= x.bbox[2] && p[1] >= x.bbox[1] && p[1] <= x.bbox[3]);
        if (region) {
          orte.push(region.name);
          laender.push(region.land ?? "DE");
          continue;
        }
        const nah = fremde.filter((o) => distanceM(o.punkt, p) < 25_000).sort((a, b) => distanceM(a.punkt, p) - distanceM(b.punkt, p))[0];
        if (nah) orte.push(nah.name);
      }
      let [w, s, o, n] = [Infinity, Infinity, -Infinity, -Infinity];
      for (const [x, y] of r.punkte) [w, s, o, n] = [Math.min(w, x), Math.min(s, y), Math.max(o, x), Math.max(n, y)];
      const eindeutig = [...new Set(orte)];
      return { ...r, name: namen[r.id] ?? reiseName(eindeutig, laender), orte: eindeutig, box: [[w, s], [o, n]] as [[number, number], [number, number]] };
    });
  }, [daten, wege, f, fremde, namen]);
}
