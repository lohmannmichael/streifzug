import { faelligeStempel, naechsteStempel, stempelUmstellen, type Gruppe, type Naechster, type Stand, type Stempel } from "@streifzug/core";
import { useEffect, useMemo, useState } from "react";
import type { Etikett, KurzWeg, OffeneStrasse } from "./abgleich.worker";
import { ANDERE_GEAENDERT, fragen } from "./arbeiter";
import { KONTO_DATEN, kontoDatenGeaendert } from "./kontoDaten";
import type { Fortschritt } from "./fortschritt";
import { gesamtMeter, zaehlendeMeter, type Regionen } from "./regionen";

export type { Etikett, OffeneStrasse } from "./abgleich.worker";

/** Newest other outings (Overland, GPX), shortened, from the background worker. */
export async function letzteWege(anzahl: number): Promise<KurzWeg[]> {
  return (await fragen<"wege">({ typ: "letzteWege", anzahl }).antwort).wege;
}

/** "Noch offen": named streets of a quarter with open meters, nearest first. */
export function useOffeneStrassen(daten: Regionen | null, gebietId: string | null, bezug: [number, number] | null, stand: unknown, aktiv: boolean) {
  const [liste, setListe] = useState<OffeneStrasse[] | null>(null);
  const schluessel = bezug ? `${bezug[0].toFixed(3)},${bezug[1].toFixed(3)}` : "";
  useEffect(() => {
    const regionId = gebietId ? daten?.gebiete.get(gebietId)?.regionId : undefined;
    if (!aktiv || !regionId || !gebietId) return;
    let lebt = true;
    setListe(null);
    void fragen<"offen">({ typ: "offen", regionId, gebietId, bezug }).antwort.then((a) => lebt && setListe(a.strassen));
    return () => {
      lebt = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [daten, gebietId, schluessel, stand, aktiv]);
  return liste;
}

/** Last five outings (own and others) for "Zuletzt". */
export function useLetzteWege(eigene: KurzWeg[]): KurzWeg[] {
  const [andere, setAndere] = useState<KurzWeg[]>([]);
  useEffect(() => {
    const laden = () => void letzteWege(5).then(setAndere);
    laden();
    window.addEventListener(ANDERE_GEAENDERT, laden);
    return () => window.removeEventListener(ANDERE_GEAENDERT, laden);
  }, []);
  return useMemo(() => [...eigene, ...andere].sort((a, b) => b.endedAt - a.endedAt).slice(0, 5), [eigene, andere]);
}

/* Stamps given so far (Bauplan 6.5: never taken away). Kept on the device. */

export interface GesetzterStempel extends Stempel {
  gestempeltAm: number;
  /** Place on the passport page (0–1) and rotation, fixed once stamped. */
  x: number;
  y: number;
  drehung: number;
}

const STEMPEL = "streifzug.stempel";

/** Root of the place Köln, once the regions are loaded (for moving old stamps, Bauplan 3, D3). */
let koelnWurzel: string | null = null;

function lesen(): GesetzterStempel[] {
  let liste: GesetzterStempel[];
  try {
    liste = JSON.parse(localStorage.getItem(STEMPEL) ?? "[]") as GesetzterStempel[];
  } catch {
    return [];
  }
  // Old quarter counts belong to Köln now; written back once, the account gets it with the next upload.
  if (koelnWurzel && liste.some((s) => /^veedel-anzahl:\d+$/.test(s.id))) {
    liste = stempelUmstellen(liste, koelnWurzel);
    localStorage.setItem(STEMPEL, JSON.stringify(liste));
    kontoDatenGeaendert();
  }
  return liste;
}

/** Progress as the stamp rules need it: quarter (smallest areas), districts, cities, km. */
export function standAus(daten: Regionen, f: Fortschritt, fremdeOrte = 0): Stand {
  koelnWurzel ??= daten.liste.find((r) => r.id === "koeln")?.wurzel ?? null;
  const veedel = [...daten.gebiete.values()]
    .filter((g) => g.kinder.length === 0)
    .map((g) => ({ id: g.id, aktivM: zaehlendeMeter(f.proGebiet.get(g.id) ?? { strasse_m: 0, weg_m: 0 }, false), gesamtM: gesamtMeter(g, f.abzug) }));
  const blaetter = (id: string): string[] => {
    const g = daten.gebiete.get(id);
    return !g ? [] : g.kinder.length === 0 ? [id] : g.kinder.flatMap(blaetter);
  };
  const gruppen: Gruppe[] = [...daten.gebiete.values()]
    .filter((g) => g.kinder.length > 0)
    .map((g) => ({ id: g.id, art: g.eltern ? "bezirk" : "stadt", veedel: blaetter(g.id) }));
  const aktivKmGesamt = f.stuecke.reduce((m, p) => m + (p.kind === "street" ? p.lengthM * p.weight : 0), 0) / 1000;
  // Places with walked meters (with data, plus those being prepared) and their countries.
  const mitWegen = daten.liste.filter((r) => zaehlendeMeter(f.proGebiet.get(r.wurzel) ?? { strasse_m: 0, weg_m: 0 }, false) >= 1);
  const laender = new Set(mitWegen.map((r) => r.land ?? "DE")).size;
  return { veedel, gruppen, strassenKomplett: 0, aktivKmGesamt, orte: mitWegen.length + fremdeOrte, laender };
}

/** Stamps given so far, read only (for pages that show them). */
export function useGesetzteStempel(): GesetzterStempel[] {
  const [gesetzt, setGesetzt] = useState<GesetzterStempel[]>(lesen);
  useEffect(() => {
    const neu = () => setGesetzt(lesen());
    window.addEventListener(KONTO_DATEN, neu);
    return () => window.removeEventListener(KONTO_DATEN, neu);
  }, []);
  return gesetzt;
}

/**
 * Stamps: given ones from the device; newly earned ones are laid into the passport right away
 * for now (Phase 2). Stamping by hand with sound comes in Phase 3 (Bauplan 5.2).
 */
export function useStempel(stand: Stand | null): { gesetzt: GesetzterStempel[]; naechste: Naechster[] } {
  const [gesetzt, setGesetzt] = useState<GesetzterStempel[]>(lesen);
  // Stamps from the account (another phone, or after signing in) come in here.
  useEffect(() => {
    const neu = () => setGesetzt(lesen());
    window.addEventListener(KONTO_DATEN, neu);
    return () => window.removeEventListener(KONTO_DATEN, neu);
  }, []);
  useEffect(() => {
    if (!stand) return;
    const gesetzt = lesen();
    const vorhanden = new Set(gesetzt.map((s) => s.id));
    const neu = faelligeStempel(stand, vorhanden);
    // Nothing new; the list may still have changed (old stamps moved to Köln).
    if (neu.length === 0) return setGesetzt((alt) => (alt.length === gesetzt.length && alt.every((s, i) => s.id === gesetzt[i]!.id) ? alt : gesetzt));
    const jetzt = Date.now();
    const dazu = neu.map((s, i): GesetzterStempel => {
      // A fixed, slightly random place and tilt, so the page looks stamped by hand.
      const zufall = (k: number) => {
        const h = [...s.id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7 + k);
        return (h % 1000) / 1000;
      };
      return { ...s, gestempeltAm: jetzt, x: zufall(1), y: (gesetzt.length + i) * 0.13 + zufall(2) * 0.08, drehung: zufall(3) * 24 - 12 };
    });
    const alle = [...gesetzt, ...dazu];
    localStorage.setItem(STEMPEL, JSON.stringify(alle));
    setGesetzt(alle);
    kontoDatenGeaendert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stand]);
  return { gesetzt, naechste: stand ? naechsteStempel(stand) : [] };
}

/** The street at a tapped point (within radiusM), for the label. */
export async function etikettAn(punkt: [number, number], radiusM: number): Promise<Etikett | null> {
  return (await fragen<"etikett">({ typ: "etikett", punkt, radiusM }).antwort).etikett;
}
