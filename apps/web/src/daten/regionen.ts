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
