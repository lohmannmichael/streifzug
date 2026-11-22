import { useEffect, useState } from "react";
import { ortDatei } from "./ortDatei";

export { ortDatei };

export interface Summe {
  strasse_m: number;
  weg_m: number;
  /** First walk in the area (only in the seen meters; for the place and country stamps, F7). */
  seit?: number;
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
  /** Country code, e.g. "DE". */
  land?: string;
  /** The local word for a quarter, e.g. the Kölsch word in Köln (Bauplan 3, D7); missing: "Viertel". */
  wortViertel?: { eins: string; viele: string };
}

interface ViertelWort {
  eins: string;
  viele: string;
}
const VIERTEL: ViertelWort = { eins: "Viertel", viele: "Viertel" };

/** The word for the quarters of the place an area belongs to (the Kölsch word in Köln, else "Viertel"). */
export function viertelWort(daten: Regionen | null, gebietId: string | null | undefined): ViertelWort {
  const regionId = gebietId ? daten?.gebiete.get(gebietId)?.regionId : undefined;
  return daten?.liste.find((r) => r.id === regionId)?.wortViertel ?? VIERTEL;
}

export interface Regionen {
  /** All places from regionen/index.json (small; names, boxes, countries). */
  liste: Region[];
  /** Areas of the places loaded so far (Bauplan 3, E4: places are loaded when needed). */
  gebiete: Map<string, GebietDaten>;
  /** Ids of the places whose areas are in `gebiete`. */
  geladen: ReadonlySet<string>;
}

// One store for the whole app: every loaded place makes a new snapshot, so React draws again.
let stand: Regionen | null = null;
let indexLaden: Promise<Region[]> | null = null;
const ortLaden = new Map<string, Promise<void>>();
const hoerer = new Set<() => void>();
const melden = () => hoerer.forEach((h) => h());

function index(): Promise<Region[]> {
  indexLaden ??= fetch("/regionen/index.json")
    .then((r) => {
      if (!r.ok) throw new Error(`index ${r.status}`);
      return r.json() as Promise<Region[]>;
    })
    .then((liste) => {
      stand ??= { liste, gebiete: new Map(), geladen: new Set() };
      return liste;
    })
    .catch((e: unknown) => {
      indexLaden = null;
      throw e;
    });
  return indexLaden;
}

/** Loads the area totals of one place (once; again after a failure). Unknown ids are ignored. */
export function ortLadenAuf(id: string): Promise<void> {
  let p = ortLaden.get(id);
  if (!p) {
    p = index()
      .then(async (liste) => {
        const r = liste.find((x) => x.id === id);
        if (!r) return;
        const antwort = await fetch(ortDatei(r, "summen.json"));
        if (!antwort.ok) throw new Error(`${id} ${antwort.status}`);
        const s = (await antwort.json()) as { gebiete: Record<string, Omit<GebietDaten, "id" | "regionId" | "kinder">> };
        const gebiete = new Map(stand!.gebiete);
        const neu: GebietDaten[] = [];
        for (const [gid, g] of Object.entries(s.gebiete)) {
          const d = { ...g, id: gid, regionId: r.id, kinder: [] as string[] };
          gebiete.set(gid, d);
          neu.push(d);
        }
        for (const g of neu) if (g.eltern) gebiete.get(g.eltern)?.kinder.push(g.id);
        stand = { liste: stand!.liste, gebiete, geladen: new Set([...stand!.geladen, r.id]) };
        melden();
      })
      .catch((e: unknown) => {
        ortLaden.delete(id);
        throw e;
      });
    ortLaden.set(id, p);
  }
  return p;
}

/** The latest snapshot (also outside React, e.g. after awaiting `ortLadenAuf`). */
export function regionenJetzt(): Regionen | null {
  return stand;
}

/** Loads several places; failures are left for the next try. */
export function orteLaden(ids: Iterable<string>): void {
  for (const id of ids) if (!stand?.geladen.has(id)) ortLadenAuf(id).catch(() => undefined);
}

/**
 * The places (see scripts/region.ts) with street totals per area. Null until the list and the
 * start places (`start`) have arrived; more places come in as they are loaded.
 */
export function useRegionen(start: readonly string[]): Regionen | null {
  const [, neu] = useState(0);
  const [bereit, setBereit] = useState(false);
  useEffect(() => {
    const h = () => neu((n) => n + 1);
    hoerer.add(h);
    let aktiv = true;
    let warten = 0;
    const versuchen = () =>
      void Promise.allSettled([index(), ...start.map(ortLadenAuf)]).then((e) => {
        if (!aktiv) return;
        // Without the list nothing works: try again a little later (no network on opening).
        if (e[0]!.status === "rejected") warten = window.setTimeout(versuchen, 3000);
        else setBereit(true);
      });
    versuchen();
    return () => {
      aktiv = false;
      window.clearTimeout(warten);
      hoerer.delete(h);
    };
    // The start places are read once, on opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return bereit ? stand : null;
}

/** "Lindenthal, Köln": the names of all parents, nearest first. */
export function elternText(daten: Regionen, id: string): string {
  const namen: string[] = [];
  let g = daten.gebiete.get(id);
  while (g?.eltern) {
    g = daten.gebiete.get(g.eltern);
    if (g) namen.push(g.name);
  }
  return namen.join(" · ");
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

/** Counting meters of an area minus the exceptions ("Hier komme ich nicht hin"). */
export function gesamtMeter(g: GebietDaten, abzug: Map<string, Summe> | undefined): number {
  return Math.max(0, zaehlendeMeter(g, false) - zaehlendeMeter(abzug?.get(g.id) ?? { strasse_m: 0, weg_m: 0 }, false));
}
