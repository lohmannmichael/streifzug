import type { Fix, Piece } from "@streifzug/core";
import { pointInGeometry } from "@streifzug/core";
import { useEffect, useRef, useState } from "react";
import type { Antwort, Anfrage, SpurDaten } from "./abgleich.worker";
import { ABGLEICH_VERSION, ladeFlaechen, meterJeGebiet as meterJeGebietListe } from "./rechnen";
import type { Regionen, Summe } from "./regionen";
import { ergebnisMerken } from "./speicher";

export { kachelnFuer } from "./rechnen";

export interface Fortschritt {
  /** Seen pieces, for the yellow layer. */
  stuecke: Piece[];
  /** Seen meters per area id (streets and paths separately). */
  proGebiet: Map<string, Summe>;
}

/** One track to match: an outing (own or imported) or the one being recorded. */
export interface Spur {
  id: string;
  fixes: Fix[];
  /** Imported histories are sparser: connect points up to 60 m apart even if over a minute lies between them. */
  locker?: boolean;
  /** Stored matching result (piece ids) from an earlier session, if still valid. */
  ids?: string[];
}

/** Key under which a stored result is valid: same matching rules, same track. */
export const ergebnisSchluessel = (fixes: Fix[]) => `${ABGLEICH_VERSION}:${fixes.length}`;

// One background worker for the whole app.
let worker: Worker | null = null;
let nummer = 0;
const wartend = new Map<number, (a: Antwort) => void>();
// Outings the worker already knows (id → number of fixes): they are sent without their data.
const imWorker = new Map<string, number>();
const standHoerer = new Set<(a: Extract<Antwort, { typ: "stand" }>) => void>();

function arbeiter(): Worker {
  if (!worker) {
    worker = new Worker(new URL("./abgleich.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (e: MessageEvent<Antwort>) => {
      const a = e.data;
      if (a.typ === "stand") for (const h of standHoerer) h(a);
      else {
        wartend.get(a.nr)?.(a);
        wartend.delete(a.nr);
      }
    };
  }
  return worker;
}

type OhneNr<T> = T extends unknown ? Omit<T, "nr"> : never;

function fragen<T extends Antwort>(anfrage: OhneNr<Anfrage>): { nr: number; antwort: Promise<T> } {
  const nr = ++nummer;
  const antwort = new Promise<T>((resolve) => wartend.set(nr, resolve as (a: Antwort) => void));
  arbeiter().postMessage({ ...anfrage, nr } as Anfrage);
  return { nr, antwort };
}

/** Pieces covered by the given outings (union), from the worker's results. Used by the logbook. */
export async function stueckeVon(spurIds: string[]): Promise<Piece[]> {
  return (await fragen<Extract<Antwort, { typ: "union" }>>({ typ: "union", spurIds }).antwort).stuecke;
}

/** Seen meters per area id (all levels). */
export function meterJeGebiet(stuecke: Iterable<Piece>, daten: Regionen): Promise<Map<string, Summe>> {
  return meterJeGebietListe(stuecke, daten.liste);
}

/**
 * Keeps the progress up to date while outings are added and while recording (every 10 new fixes).
 * The matching runs in the background; `rechnet` tells how far it is when many outings are new.
 */
export function useFortschritt(spuren: Spur[], daten: Regionen | null): { fortschritt: Fortschritt | null; rechnet: { fertig: number; gesamt: number } | null } {
  const [fortschritt, setFortschritt] = useState<Fortschritt | null>(null);
  const [rechnet, setRechnet] = useState<{ fertig: number; gesamt: number } | null>(null);
  const anzahl = spuren.reduce((n, s) => n + s.fixes.length, 0);
  // Which outings take part (switches can change that) and, every 10 fixes, the live track.
  const schluessel = `${spuren.map((s) => s.id).join(",")}:${Math.floor(anzahl / 10)}`;
  const aktuell = useRef(0);
  useEffect(() => {
    if (!daten) return;
    const spurDaten: SpurDaten[] = spuren.map((s) => ({
      id: s.id,
      n: s.fixes.length,
      locker: s.locker ?? false,
      ...(imWorker.get(s.id) === s.fixes.length ? {} : s.ids ? { ids: s.ids } : { fixes: s.fixes }),
    }));
    const { nr, antwort } = fragen<Extract<Antwort, { typ: "ergebnis" }>>({ typ: "berechne", spuren: spurDaten, liste: daten.liste });
    aktuell.current = nr;
    const hoerer = (a: Extract<Antwort, { typ: "stand" }>) => {
      if (a.nr === aktuell.current) setRechnet({ fertig: a.fertig, gesamt: a.gesamt });
    };
    standHoerer.add(hoerer);
    void antwort.then(async (a) => {
      // Store new results on the device, so the next start needs no matching.
      for (const n of a.neu) await ergebnisMerken(n.id, n.ids, `${ABGLEICH_VERSION}:${n.n}`);
      // A complete result means the worker now knows every outing that was sent.
      for (const sd of spurDaten) if (!sd.id.startsWith("live:")) imWorker.set(sd.id, sd.n);
      if (a.nr !== aktuell.current) return;
      setRechnet(null);
      setFortschritt({ stuecke: a.stuecke, proGebiet: new Map(a.proGebiet) });
    });
    return () => {
      standHoerer.delete(hoerer);
    };
    // Recalculate only when the set of outings changes or the live track grows.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schluessel, daten]);
  return { fortschritt, rechnet };
}

/** The smallest area (Stadtteil) that contains a point, or null outside all regions. */
export async function gebietAn(punkt: [number, number], daten: Regionen): Promise<string | null> {
  const [x, y] = punkt;
  for (const r of daten.liste) {
    if (x < r.bbox[0] || x > r.bbox[2] || y < r.bbox[1] || y > r.bbox[3]) continue;
    for (const g of await ladeFlaechen(r.id)) {
      if (x < g.bbox[0] || x > g.bbox[2] || y < g.bbox[1] || y > g.bbox[3]) continue;
      if ((daten.gebiete.get(g.id)?.kinder.length ?? 1) === 0 && pointInGeometry(punkt, g.geometry)) return g.id;
    }
  }
  return null;
}
