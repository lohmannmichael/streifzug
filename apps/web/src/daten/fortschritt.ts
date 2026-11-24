import type { Fix, KompletteStrasse, Korrektur, LonLat, Piece } from "@streifzug/core";
import { pointInGeometry } from "@streifzug/core";
import { useEffect, useRef, useState } from "react";
import type { Draussen, SpurDaten, Zaehlen } from "./abgleich.worker";
import { ANDERE_GEAENDERT, aufStandHoeren, fragen, KOMPLETT } from "./arbeiter";
import { gueltigFuer, kartenStandJetzt, kartenStandSetzen, korrekturHash, ladeFlaechen, meterJeGebiet as meterJeGebietListe } from "./rechnen";

// The map data version of the last calculation, so own outings' stored results can be checked
// before the worker answers (Michi, 24.11.2026).
const KARTEN_STAND = "streifzug.kartenStand";
kartenStandSetzen(localStorage.getItem(KARTEN_STAND) ?? "");
import { ortLadenAuf, regionenJetzt, type Regionen, type Summe } from "./regionen";
import { standLaden, standMerken } from "./stand";

export { kachelnFuer } from "./rechnen";
export type { Zaehlen } from "./abgleich.worker";

export interface Fortschritt {
  /** Pieces covered on foot or by bike ("aktiv"), for the yellow layer and the percentages. */
  stuecke: Piece[];
  /** Pieces only driven (car, bus, train), for the pen line under the yellow. Never counted. */
  gefahren: Piece[];
  /** Seen meters per area id (streets and paths separately). */
  proGebiet: Map<string, Summe>;
  /** When each piece in `stuecke` was first walked (same order): year colours and the replay. */
  erstesMal: number[];
  /** Meters per area taken out of the total ("Hier komme ich nicht hin"). */
  abzug: Map<string, Summe>;
  /** Walked places that have no region yet. */
  draussen: Draussen[];
  /** Complete streets (Bauplan 3, F4); missing in a state stored before F4. */
  komplett?: KompletteStrasse[];
  /** Fine lines for the overview far out (Bauplan 3, F5); missing in a state stored before F5. */
  ueberblick?: { gelb: LonLat[][]; rot: LonLat[][] };
}

/** One track to match: an outing (own or imported) or the one being recorded. */
export interface Spur {
  id: string;
  /** Start time. */
  t: number;
  fixes: Fix[];
  /** Stored matching result (piece ids) from an earlier session, if still valid. */
  ids?: string[];
  gefahren?: string[];
  /** Key the stored result was made under (checked again in the worker). */
  gueltig?: string;
}

/** Key under which a stored result is valid: same matching rules, same track. */
export const ergebnisSchluessel = (fixes: Fix[], korrekturen?: readonly Korrektur[]) => gueltigFuer(fixes.length, korrekturHash(korrekturen));

/** Seen meters per area id (all levels). */
export function meterJeGebiet(stuecke: Iterable<Piece>, daten: Regionen): Promise<Map<string, Summe>> {
  return meterJeGebietListe(stuecke, daten.liste);
}

// The number of the latest calculation (for answers that come afterwards).
let aktuellRef: { current: number } = { current: 0 };

// Own outings the worker already knows (id → number of fixes and corrections): sent without their data.
const imWorker = new Map<string, string>();

/**
 * Keeps the progress up to date while outings are added and while recording (every 10 new fixes).
 * Own outings come from the page; imports and Overland the worker loads itself. The matching runs
 * in the background; `rechnet` tells how far it is when many outings are new.
 */
export function useFortschritt(
  spuren: Spur[],
  zaehlen: Zaehlen,
  daten: Regionen | null,
): { fortschritt: Fortschritt | null; vorlaeufig: boolean; rechnet: { fertig: number; gesamt: number } | null; fehler: string | null; nochmal: () => void } {
  const [fortschritt, setFortschritt] = useState<Fortschritt | null>(null);
  // Until the worker is done, the last stored state is shown (Bauplan 3, E3).
  const [vorlaeufig, setVorlaeufig] = useState(false);
  const echtDa = useRef(false);
  useEffect(() => {
    void standLaden().then((stand) => {
      if (!stand || echtDa.current) return;
      setFortschritt(stand);
      setVorlaeufig(true);
    });
  }, []);
  // Complete streets arrive after the result (Bauplan 3, F4).
  useEffect(() => {
    const neu = (e: Event) => {
      const a = (e as CustomEvent<{ nr: number; komplett: KompletteStrasse[] }>).detail;
      if (a.nr !== aktuellRef.current) return;
      setFortschritt((f) => {
        if (!f) return f;
        const mit = { ...f, komplett: a.komplett };
        standMerken(mit);
        return mit;
      });
    };
    window.addEventListener(KOMPLETT, neu);
    return () => window.removeEventListener(KOMPLETT, neu);
  }, []);
  const [rechnet, setRechnet] = useState<{ fertig: number; gesamt: number } | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [andereStand, setAndereStand] = useState(0);
  // "Nochmal versuchen" after an error: a new key starts the calculation again.
  const [versuch, setVersuch] = useState(0);
  useEffect(() => {
    const neu = () => setAndereStand((n) => n + 1);
    window.addEventListener(ANDERE_GEAENDERT, neu);
    return () => window.removeEventListener(ANDERE_GEAENDERT, neu);
  }, []);
  const anzahl = spuren.reduce((n, s) => n + s.fixes.length, 0);
  // Which outings and sources take part and, every 10 fixes, the live track.
  // A new map data version (known after a calculation) starts it again: stored results may not fit.
  const schluessel = `${spuren.map((s) => s.id).join(",")}:${Math.floor(anzahl / 10)}:${JSON.stringify(zaehlen)}:${andereStand}:${versuch}:${kartenStandJetzt()}`;
  const aktuell = useRef(0);
  aktuellRef = aktuell;
  // Only the list of places matters here; loading more places does not start a new calculation.
  const liste = daten?.liste;
  useEffect(() => {
    if (!liste) return;
    const eigene: SpurDaten[] = spuren.map((s) => ({
      id: s.id,
      n: s.fixes.length,
      t: s.t,
      ...(imWorker.get(s.id) === ergebnisSchluessel(s.fixes, zaehlen.korrekturen?.[s.id]) ? {} : s.ids ? { ids: s.ids, gefahren: s.gefahren ?? [], ...(s.gueltig ? { gueltig: s.gueltig } : {}) } : { fixes: s.fixes }),
    }));
    const { nr, antwort } = fragen<"ergebnis">({ typ: "berechne", eigene, zaehlen: { ...zaehlen, kartenStand: kartenStandJetzt() }, liste });
    aktuell.current = nr;
    const weg = aufStandHoeren((a) => {
      if (a.nr === aktuell.current) setRechnet({ fertig: a.fertig, gesamt: a.gesamt });
    });
    void antwort.then((a) => {
      // A complete result means the worker now knows every own outing that was sent.
      // Skipped ways (e.g. street data did not arrive) are sent again on the next try.
      const nichtDrin = new Set(a.uebersprungen);
      for (const s of spuren) if (!s.id.startsWith("live:") && !nichtDrin.has(s.id)) imWorker.set(s.id, ergebnisSchluessel(s.fixes, zaehlen.korrekturen?.[s.id]));
      if (a.kartenStand !== kartenStandJetzt()) {
        kartenStandSetzen(a.kartenStand);
        localStorage.setItem(KARTEN_STAND, a.kartenStand);
      }
      if (a.nr !== aktuell.current) return;
      setRechnet(null);
      setFehler(a.uebersprungen.length ? `${a.uebersprungen.length} übersprungen (Straßendaten nicht geladen)` : null);
      const f: Fortschritt = { stuecke: a.stuecke, erstesMal: a.erstesMal, gefahren: a.gefahren, proGebiet: new Map(a.proGebiet), abzug: new Map(a.abzug), draussen: a.draussen, komplett: a.komplett, ueberblick: a.ueberblick };
      echtDa.current = true;
      setFortschritt(f);
      setVorlaeufig(false);
      standMerken(f);
    }).catch((e: unknown) => {
      if (nr !== aktuell.current) return;
      setRechnet(null);
      setFehler(e instanceof Error ? e.message : String(e));
    });
    return weg;
    // Recalculate only when the set of outings changes or the live track grows.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schluessel, liste]);
  return { fortschritt, vorlaeufig, rechnet, fehler, nochmal: () => setVersuch((n) => n + 1) };
}

/** The smallest area (Stadtteil) that contains a point, or null outside all regions. Loads the place if needed. */
export async function gebietAn(punkt: [number, number], daten: Regionen): Promise<string | null> {
  const [x, y] = punkt;
  for (const r of daten.liste) {
    if (x < r.bbox[0] || x > r.bbox[2] || y < r.bbox[1] || y > r.bbox[3]) continue;
    await ortLadenAuf(r.id);
    const jetzt = regionenJetzt() ?? daten;
    for (const g of await ladeFlaechen(r)) {
      if (x < g.bbox[0] || x > g.bbox[2] || y < g.bbox[1] || y > g.bbox[3]) continue;
      if ((jetzt.gebiete.get(g.id)?.kinder.length ?? 1) === 0 && pointInGeometry(punkt, g.geometry)) return g.id;
    }
  }
  return null;
}
