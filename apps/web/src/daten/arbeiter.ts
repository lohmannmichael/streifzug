import type { Anfrage, Antwort } from "./abgleich.worker";

/** The one background worker of the app, and a simple question/answer channel to it. */
let worker: Worker | null = null;
let nummer = 0;
const wartend = new Map<number, { ok: (a: Antwort) => void; fehler: (e: Error) => void }>();
const standHoerer = new Set<(a: Extract<Antwort, { typ: "stand" }>) => void>();

function arbeiter(): Worker {
  if (!worker) {
    worker = new Worker(new URL("./abgleich.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (e: MessageEvent<Antwort>) => {
      const a = e.data;
      if (a.typ === "stand") for (const h of standHoerer) h(a);
      else if (a.typ === "exportStand") window.dispatchEvent(new CustomEvent(EXPORT_STAND, { detail: a.anteil }));
      else {
        const w = wartend.get(a.nr);
        wartend.delete(a.nr);
        if (a.typ === "fehler") w?.fehler(new Error(a.text));
        else w?.ok(a);
      }
    };
  }
  return worker;
}

type OhneNr<T> = T extends unknown ? Omit<T, "nr"> : never;

export function fragen<T extends Antwort["typ"]>(anfrage: OhneNr<Anfrage>): { nr: number; antwort: Promise<Extract<Antwort, { typ: T }>> } {
  const nr = ++nummer;
  const antwort = new Promise<Extract<Antwort, { typ: T }>>((resolve, reject) => wartend.set(nr, { ok: resolve as (a: Antwort) => void, fehler: reject }));
  arbeiter().postMessage({ ...anfrage, nr } as Anfrage);
  return { nr, antwort };
}

export function aufStandHoeren(h: (a: Extract<Antwort, { typ: "stand" }>) => void): () => void {
  standHoerer.add(h);
  return () => standHoerer.delete(h);
}

/** Progress of "Alles exportieren" (0–1), as an event with `detail`. */
export const EXPORT_STAND = "streifzug:export-stand";

/** Other outings changed (import, delete, Overland): progress, logbook and info reload. */
export const ANDERE_GEAENDERT = "streifzug-andere-geaendert";
export const andereGeaendert = () => window.dispatchEvent(new Event(ANDERE_GEAENDERT));
