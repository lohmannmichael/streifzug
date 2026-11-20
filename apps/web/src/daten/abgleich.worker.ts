/// <reference lib="webworker" />
import type { Fix, Piece } from "@streifzug/core";
import { abgleichen, meterJeGebiet, stueckeFuerIds } from "./rechnen";
import type { Region, Summe } from "./regionen";

/**
 * Background worker: matches tracks to streets and sums them up per area, so the page stays
 * smooth even with hundreds of imported outings. Results are kept per outing (and the page stores
 * them on the device), so each outing is matched only once.
 */

export interface SpurDaten {
  id: string;
  /** Number of fixes: a result is valid only for the same track. */
  n: number;
  fixes?: Fix[];
  /** Stored result from an earlier session (piece ids); then no fixes are needed. */
  ids?: string[];
  locker?: boolean;
}

export type Anfrage =
  | { typ: "berechne"; nr: number; spuren: SpurDaten[]; liste: Region[] }
  | { typ: "union"; nr: number; spurIds: string[] };

export type Antwort =
  | { typ: "stand"; nr: number; fertig: number; gesamt: number }
  | { typ: "ergebnis"; nr: number; stuecke: Piece[]; proGebiet: [string, Summe][]; neu: { id: string; n: number; ids: string[] }[] }
  | { typ: "union"; nr: number; stuecke: Piece[] };

const jeSpur = new Map<string, { n: number; ids: string[] }>();
const stueckNachId = new Map<string, Piece>();
let neueste = 0;

const senden = (a: Antwort) => (self as unknown as DedicatedWorkerGlobalScope).postMessage(a);

async function berechne(nr: number, spuren: SpurDaten[], liste: Region[]) {
  neueste = nr;
  const neu: { id: string; n: number; ids: string[] }[] = [];
  // Stored results first (cheap), then the tracks that still need matching.
  const fehlend: string[] = [];
  for (const s of spuren) {
    const alt = jeSpur.get(s.id);
    if ((!alt || alt.n !== s.n) && s.ids) jeSpur.set(s.id, { n: s.n, ids: s.ids });
    for (const id of jeSpur.get(s.id)?.n === s.n ? jeSpur.get(s.id)!.ids : []) if (!stueckNachId.has(id)) fehlend.push(id);
  }
  for (const p of await stueckeFuerIds(fehlend)) stueckNachId.set(p.id, p);

  const offen = spuren.filter((s) => jeSpur.get(s.id)?.n !== s.n && s.fixes);
  let fertig = 0;
  for (const s of offen) {
    // A newer request (e.g. the next live fixes) takes over; what is done so far stays cached.
    if (neueste !== nr) return;
    if (offen.length > 3) senden({ typ: "stand", nr, fertig, gesamt: offen.length });
    const stuecke = await abgleichen(s.fixes!, s.locker ?? false);
    for (const p of stuecke) stueckNachId.set(p.id, p);
    const ids = stuecke.map((p) => p.id);
    jeSpur.set(s.id, { n: s.n, ids });
    if (!s.id.startsWith("live:")) neu.push({ id: s.id, n: s.n, ids });
    fertig++;
  }
  if (neueste !== nr) return;

  const gesehen = new Map<string, Piece>();
  for (const s of spuren) for (const id of jeSpur.get(s.id)?.ids ?? []) {
    const p = stueckNachId.get(id);
    if (p) gesehen.set(id, p);
  }
  const proGebiet = await meterJeGebiet(gesehen.values(), liste);
  senden({ typ: "ergebnis", nr, stuecke: [...gesehen.values()], proGebiet: [...proGebiet], neu });
}

self.onmessage = (e: MessageEvent<Anfrage>) => {
  const a = e.data;
  if (a.typ === "berechne") void berechne(a.nr, a.spuren, a.liste);
  else {
    const out = new Map<string, Piece>();
    for (const id of a.spurIds) for (const pid of jeSpur.get(id)?.ids ?? []) {
      const p = stueckNachId.get(pid);
      if (p) out.set(pid, p);
    }
    senden({ typ: "union", nr: a.nr, stuecke: [...out.values()] });
  }
};
