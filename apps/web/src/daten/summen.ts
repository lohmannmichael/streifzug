import { useEffect, useState } from "react";

export interface Summe {
  strasse_m: number;
  weg_m: number;
}

export interface Summen {
  stand: string;
  quelle: string;
  stadt: Summe;
  bezirke: Record<string, Summe>;
  stadtteile: Record<string, Summe & { name: string; bezirk: string }>;
}

let zwischenspeicher: Promise<Summen> | null = null;

/** Street totals per Cologne district, built by scripts/strassen-koeln.ts. */
export function useSummen(): Summen | null {
  const [summen, setSummen] = useState<Summen | null>(null);
  useEffect(() => {
    zwischenspeicher ??= fetch("/gebiete/koeln-summen.json").then((r) => r.json() as Promise<Summen>);
    let aktiv = true;
    zwischenspeicher.then((s) => aktiv && setSummen(s)).catch(() => (zwischenspeicher = null));
    return () => {
      aktiv = false;
    };
  }, []);
  return summen;
}

/** Total length that counts, depending on the paths switch. */
export function zaehlendeMeter(summe: Summe, wegeZaehlen: boolean): number {
  return summe.strasse_m + (wegeZaehlen ? summe.weg_m : 0);
}

const km = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
export function alsKm(meter: number): string {
  return `${km.format(meter / 1000)} km`;
}
