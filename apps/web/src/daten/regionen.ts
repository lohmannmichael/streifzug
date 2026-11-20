import { useEffect, useState } from "react";

export interface Summe {
  strasse_m: number;
  weg_m: number;
}

export interface GebietDaten extends Summe {
  id: string;
  name: string;
  rang: number;
  eltern: string | null;
  regionId: string;
  kinder: string[];
}

export interface Region {
  id: string;
  name: string;
  wurzel: string;
  bbox: [number, number, number, number];
  stand: string;
}

export interface Regionen {
  liste: Region[];
  gebiete: Map<string, GebietDaten>;
}

let laden: Promise<Regionen> | null = null;

async function ladeAlles(): Promise<Regionen> {
  const liste = (await (await fetch("/regionen/index.json")).json()) as Region[];
  const gebiete = new Map<string, GebietDaten>();
  await Promise.all(
    liste.map(async (r) => {
      const s = (await (await fetch(`/regionen/${r.id}/summen.json`)).json()) as {
        gebiete: Record<string, Omit<GebietDaten, "id" | "regionId" | "kinder">>;
      };
      for (const [id, g] of Object.entries(s.gebiete)) gebiete.set(id, { ...g, id, regionId: r.id, kinder: [] });
    }),
  );
  for (const g of gebiete.values()) if (g.eltern) gebiete.get(g.eltern)?.kinder.push(g.id);
  return { liste, gebiete };
}

/** All built regions (see scripts/region.ts) with street totals per area. */
export function useRegionen(): Regionen | null {
  const [daten, setDaten] = useState<Regionen | null>(null);
  useEffect(() => {
    laden ??= ladeAlles();
    let aktiv = true;
    laden.then((d) => aktiv && setDaten(d)).catch(() => (laden = null));
    return () => {
      aktiv = false;
    };
  }, []);
  return daten;
}

/** "Lindenthal, Köln": the names of all parents, nearest first. */
export function elternText(daten: Regionen, id: string): string {
  const namen: string[] = [];
  let g = daten.gebiete.get(id);
  while (g?.eltern) {
    g = daten.gebiete.get(g.eltern);
    if (g) namen.push(g.name);
  }
  return namen.join(", ");
}

export function findeNachName(daten: Regionen, name: string): GebietDaten | undefined {
  for (const g of daten.gebiete.values()) if (g.name === name && g.kinder.length === 0) return g;
  return undefined;
}

/** Total length that counts, depending on the paths switch. */
export function zaehlendeMeter(summe: Summe, wegeZaehlen: boolean): number {
  return summe.strasse_m + (wegeZaehlen ? summe.weg_m : 0);
}

const km = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
export function alsKm(meter: number): string {
  return `${km.format(meter / 1000)} km`;
}

/** Short distances in meters, longer ones in km. */
export function alsStrecke(meter: number): string {
  return meter < 1000 ? `${Math.round(meter)} m` : alsKm(meter);
}

/** Share seen in percent (0–100, whole numbers; "<1" is shown by the caller for tiny values). */
export function prozent(gesehenM: number, gesamtM: number): number {
  if (gesamtM <= 0) return 0;
  return Math.min(100, (gesehenM / gesamtM) * 100);
}

/** Under 10 % with one decimal (every step counts at the start), otherwise whole numbers. */
export function prozentText(p: number): string {
  if (p > 0 && p < 0.1) return "0,1";
  if (p > 0 && p < 10) return (Math.floor(p * 10) / 10).toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return String(Math.floor(p));
}

let punkteLaden: Promise<Map<string, [number, number]>> | null = null;

/** Label point of every area (from namen.geojson), for "In deiner Nähe". */
export function useMittelpunkte(daten: Regionen | null): Map<string, [number, number]> | null {
  const [punkte, setPunkte] = useState<Map<string, [number, number]> | null>(null);
  useEffect(() => {
    if (!daten) return;
    punkteLaden ??= Promise.all(
      daten.liste.map(async (r) => {
        const d = (await (await fetch(`/regionen/${r.id}/namen.geojson`)).json()) as {
          features: { properties: { id: string }; geometry: { coordinates: [number, number] } }[];
        };
        return d.features.map((f) => [String(f.properties.id), f.geometry.coordinates] as const);
      }),
    ).then((teile) => new Map(teile.flat()));
    let aktiv = true;
    punkteLaden.then((p) => aktiv && setPunkte(p)).catch(() => (punkteLaden = null));
    return () => {
      aktiv = false;
    };
  }, [daten]);
  return punkte;
}
