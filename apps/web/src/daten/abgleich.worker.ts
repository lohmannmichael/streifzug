/// <reference lib="webworker" />
import { cleanFixes, density, parseGoogleTimeline, parseGpx, splitOutings, summarizeImported, type Fix, type Piece } from "@streifzug/core";
import { abgleichen, ABGLEICH_VERSION, meterJeGebiet, stueckeFuerIds } from "./rechnen";
import type { Region, Summe } from "./regionen";
import { einenLaden, ergebnisseMerken, importeEntfernen, importeLaden, vieleSpeichern, type ImportQuelle, type Streifzug } from "./speicher";

/**
 * Background worker. Everything heavy happens here, so the page stays smooth:
 * matching tracks to streets, sums per area, and all outings that do not come from the
 * page's own recording (imported files, Overland). The page never loads those itself.
 * Results are stored with each outing, so each one is matched only once.
 */

export interface SpurDaten {
  id: string;
  /** Number of fixes: a result is valid only for the same track. */
  n: number;
  fixes?: Fix[];
  /** Stored result from an earlier session (piece ids); then no fixes are needed. */
  ids?: string[];
}

/** Which other sources count, and whether car rides count. */
export interface Zaehlen {
  quellen: Record<ImportQuelle, boolean>;
  auto: boolean;
}

export interface ImportVorschau {
  quelle: "google" | "gpx";
  wege: number;
  km: { fuss: number; rad: number; auto: number };
  dichte: number;
  von: number | null;
  bis: number | null;
  punkteGesamt: number;
}

export type QuellenInfo = Partial<Record<ImportQuelle, { wege: number; km: number; von: number; bis: number }>>;

export type Anfrage =
  | { typ: "berechne"; nr: number; eigene: SpurDaten[]; zaehlen: Zaehlen; liste: Region[] }
  | { typ: "zeitraum"; nr: number; ab: number; bis: number; zaehlen: Zaehlen }
  | { typ: "importLesen"; nr: number; quelle: "google" | "gpx"; dateien: File[]; liste: Region[] }
  | { typ: "importUebernehmen"; nr: number; quelle: "google" | "gpx" }
  | { typ: "quelleLoeschen"; nr: number; quelle: ImportQuelle }
  | { typ: "info"; nr: number }
  | { typ: "overlandAbholen"; nr: number; url: string; schluessel: string; jwt: string; seit: string | null; liste: Region[] };

export type Antwort =
  | { typ: "stand"; nr: number; fertig: number; gesamt: number }
  | { typ: "ergebnis"; nr: number; stuecke: Piece[]; proGebiet: [string, Summe][] }
  | { typ: "stuecke"; nr: number; stuecke: Piece[] }
  | { typ: "vorschau"; nr: number; vorschau: ImportVorschau | null; fehler: string | null }
  | { typ: "info"; nr: number; info: QuellenInfo }
  | { typ: "abgeholt"; nr: number; punkte: number; bis: string | null; fehler: string | null }
  | { typ: "ok"; nr: number };

const senden = (a: Antwort) => (self as unknown as DedicatedWorkerGlobalScope).postMessage(a);
const gueltig = (n: number) => `${ABGLEICH_VERSION}:${n}`;
// Google imports are paused and being removed (they made the app hang); the worker leaves them alone.
const QUELLEN: ImportQuelle[] = ["gpx", "overland"];

// Matching results per outing (own and others) and the pieces behind them.
const jeSpur = new Map<string, { n: number; ids: string[] }>();
const stueckNachId = new Map<string, Piece>();

// Other outings, loaded once from the device storage. Fixes are kept only until matched.
type Kopf = Omit<Streifzug, "fixes"> & { fixes: Fix[] | null; n: number };
let andere: Promise<Map<string, Kopf>> | null = null;

function andereLaden(): Promise<Map<string, Kopf>> {
  andere ??= importeLaden(QUELLEN).then((liste) => {
    const m = new Map<string, Kopf>();
    for (const s of liste) {
      const n = s.fixes.length;
      if (s.stueckIds && s.stueckIdsGueltig === gueltig(n)) {
        jeSpur.set(s.id, { n, ids: s.stueckIds });
        m.set(s.id, { ...s, fixes: null, n });
      } else m.set(s.id, { ...s, n });
    }
    return m;
  });
  return andere;
}

const zaehlt = (k: Pick<Streifzug, "quelle" | "mode">, z: Zaehlen) => (k.mode !== "car" || z.auto) && (k.quelle === undefined || k.quelle === "aufnahme" || z.quellen[k.quelle]);

let neueste = 0;

async function berechne(nr: number, eigene: SpurDaten[], z: Zaehlen, liste: Region[]) {
  neueste = nr;
  // Own outings: stored results first (cheap).
  const fehlend: string[] = [];
  for (const s of eigene) if (s.ids && jeSpur.get(s.id)?.n !== s.n) jeSpur.set(s.id, { n: s.n, ids: s.ids });
  const alle = await andereLaden();
  const zaehlende = [...alle.values()].filter((k) => zaehlt(k, z));
  for (const id of [...eigene.map((s) => s.id), ...zaehlende.map((k) => k.id)]) for (const p of jeSpur.get(id)?.ids ?? []) if (!stueckNachId.has(p)) fehlend.push(p);
  for (const p of await stueckeFuerIds(fehlend)) stueckNachId.set(p.id, p);

  // Then everything that still needs matching (new outings, or after a rules change).
  const offen: { id: string; n: number; fixes: Fix[]; locker: boolean; speichern: boolean }[] = [
    ...eigene.filter((s) => jeSpur.get(s.id)?.n !== s.n && s.fixes).map((s) => ({ id: s.id, n: s.n, fixes: s.fixes!, locker: false, speichern: !s.id.startsWith("live:") })),
    ...zaehlende.filter((k) => jeSpur.get(k.id)?.n !== k.n && k.fixes).map((k) => ({ id: k.id, n: k.n, fixes: k.fixes!, locker: true, speichern: true })),
  ];
  let merken: { id: string; ids: string[]; gueltig: string }[] = [];
  for (let i = 0; i < offen.length; i++) {
    const s = offen[i]!;
    // A newer request (e.g. the next live fixes) takes over; what is done so far is kept.
    if (neueste !== nr) break;
    if (offen.length > 3) senden({ typ: "stand", nr, fertig: i, gesamt: offen.length });
    const stuecke = await abgleichen(s.fixes, s.locker);
    for (const p of stuecke) stueckNachId.set(p.id, p);
    const ids = stuecke.map((p) => p.id);
    jeSpur.set(s.id, { n: s.n, ids });
    const kopf = alle.get(s.id);
    if (kopf) kopf.fixes = null;
    if (s.speichern) merken.push({ id: s.id, ids, gueltig: gueltig(s.n) });
    if (merken.length >= 25) {
      await ergebnisseMerken(merken);
      merken = [];
    }
  }
  await ergebnisseMerken(merken);
  if (neueste !== nr) return;

  const gesehen = new Map<string, Piece>();
  for (const id of [...eigene.map((s) => s.id), ...zaehlende.map((k) => k.id)])
    for (const pid of jeSpur.get(id)?.ids ?? []) {
      const p = stueckNachId.get(pid);
      if (p) gesehen.set(pid, p);
    }
  const proGebiet = await meterJeGebiet(gesehen.values(), liste);
  senden({ typ: "ergebnis", nr, stuecke: [...gesehen.values()], proGebiet: [...proGebiet] });
}

/** Only points in or near a built region are kept (the server keeps everything). */
function inRegionen(fixes: Fix[], liste: Region[]): Fix[] {
  const rand = 0.01;
  return fixes.filter((f) => liste.some((r) => f.lon >= r.bbox[0] - rand && f.lon <= r.bbox[2] + rand && f.lat >= r.bbox[1] - rand && f.lat <= r.bbox[3] + rand));
}

function wegeAus(quelle: ImportQuelle, fixes: Fix[]): Streifzug[] {
  return splitOutings(fixes).map((t) => {
    const sum = summarizeImported(t);
    // Same id for the same outing when data comes again, so nothing is doubled.
    return { id: `${quelle}:${t[0]!.t}`, startedAt: t[0]!.t, endedAt: t.at(-1)!.t, fixes: t, distanceM: sum.distanceM, mode: sum.mode, status: "importiert", quelle };
  });
}

const wartend = new Map<"google" | "gpx", Streifzug[]>();

async function importLesen(nr: number, quelle: "google" | "gpx", dateien: File[], liste: Region[]) {
  try {
    let fixes: Fix[] = [];
    if (quelle === "google") {
      let json: unknown;
      try {
        json = JSON.parse(await dateien[0]!.text());
      } catch {
        throw new Error("Die Datei ist keine JSON-Datei. Bitte die Datei aus „Zeitachsendaten exportieren“ wählen.");
      }
      fixes = parseGoogleTimeline(json);
      if (fixes.length === 0) throw new Error("In der Datei stehen keine Wege. Ist das der Export der Google-Zeitachse?");
    } else {
      // No spread here: tens of thousands of points would overflow the call stack.
      for (const d of dateien) for (const f of parseGpx(await d.text())) fixes.push(f);
      if (fixes.length === 0) throw new Error("In den Dateien stehen keine Wege mit Zeitangaben.");
      fixes.sort((a, b) => a.t - b.t);
    }
    const wege = wegeAus(quelle, inRegionen(fixes, liste));
    wartend.set(quelle, wege);
    const km = { fuss: 0, rad: 0, auto: 0 };
    for (const w of wege) km[w.mode === "foot" ? "fuss" : w.mode === "bike" ? "rad" : "auto"] += w.distanceM / 1000;
    senden({
      typ: "vorschau",
      nr,
      fehler: null,
      vorschau: { quelle, wege: wege.length, km, dichte: density(wege.map((w) => w.fixes)), von: wege[0]?.startedAt ?? null, bis: wege.at(-1)?.endedAt ?? null, punkteGesamt: fixes.length },
    });
  } catch (e) {
    senden({ typ: "vorschau", nr, vorschau: null, fehler: e instanceof Error ? e.message : String(e) });
  }
}

/** New points from the Overland receiver, appended to the last outing if it just continues. */
async function overlandAbholen(nr: number, url: string, schluessel: string, jwt: string, seit: string | null, liste: Region[]) {
  try {
    const neu: Fix[] = [];
    let ab = seit;
    // Page through the points (the server returns at most 1000 at a time).
    for (;;) {
      const filter = ab ? `&t=gt.${encodeURIComponent(ab)}` : "";
      const r = await fetch(`${url}/rest/v1/received_points?select=t,lon,lat,acc&order=t.asc&limit=1000${filter}`, {
        headers: { apikey: schluessel, Authorization: `Bearer ${jwt}` },
      });
      if (!r.ok) throw new Error(`Abholen fehlgeschlagen (${r.status})`);
      const seite = (await r.json()) as { t: string; lon: number; lat: number; acc: number | null }[];
      for (const p of seite) neu.push({ t: Date.parse(p.t), lon: p.lon, lat: p.lat, acc: p.acc ?? 10 });
      if (seite.length < 1000) break;
      ab = seite.at(-1)!.t;
    }
    const bis = neu.length ? new Date(neu.reduce((m, f) => Math.max(m, f.t), 0)).toISOString() : seit;
    const imGebiet = inRegionen(neu, liste);
    if (imGebiet.length > 0) {
      // Continue the last outing if the new points follow on within its pause limit.
      const alle = await andereLaden();
      const letzte = [...alle.values()].filter((k) => k.quelle === "overland").sort((a, b) => b.startedAt - a.startedAt)[0];
      let basis: Fix[] = [];
      if (letzte && (letzte.endedAt ?? 0) >= imGebiet[0]!.t - 600_000) basis = (await einenLaden(letzte.id))?.fixes ?? [];
      const wege = wegeAus("overland", cleanFixes([...basis, ...imGebiet]));
      await vieleSpeichern(wege);
      andere = null;
    }
    senden({ typ: "abgeholt", nr, punkte: neu.length, bis, fehler: null });
  } catch (e) {
    senden({ typ: "abgeholt", nr, punkte: 0, bis: seit, fehler: e instanceof Error ? e.message : String(e) });
  }
}

self.onmessage = async (e: MessageEvent<Anfrage>) => {
  const a = e.data;
  switch (a.typ) {
    case "berechne":
      return void berechne(a.nr, a.eigene, a.zaehlen, a.liste);
    case "zeitraum": {
      // Pieces of the other outings that count and started in [ab, bis) (for the logbook).
      const out = new Map<string, Piece>();
      for (const k of (await andereLaden()).values()) {
        if (k.startedAt < a.ab || k.startedAt >= a.bis || !zaehlt(k, a.zaehlen)) continue;
        for (const pid of jeSpur.get(k.id)?.ids ?? []) {
          const p = stueckNachId.get(pid);
          if (p) out.set(pid, p);
        }
      }
      return senden({ typ: "stuecke", nr: a.nr, stuecke: [...out.values()] });
    }
    case "importLesen":
      return void importLesen(a.nr, a.quelle, a.dateien, a.liste);
    case "importUebernehmen":
      await vieleSpeichern(wartend.get(a.quelle) ?? []);
      wartend.delete(a.quelle);
      andere = null;
      return senden({ typ: "ok", nr: a.nr });
    case "quelleLoeschen":
      await importeEntfernen(a.quelle);
      for (const id of [...jeSpur.keys()]) if (id.startsWith(`${a.quelle}:`)) jeSpur.delete(id);
      andere = null;
      return senden({ typ: "ok", nr: a.nr });
    case "info": {
      const info: QuellenInfo = {};
      for (const k of (await andereLaden()).values()) {
        if (!k.quelle || k.quelle === "aufnahme") continue;
        const i = (info[k.quelle] ??= { wege: 0, km: 0, von: k.startedAt, bis: k.endedAt ?? k.startedAt });
        i.wege++;
        i.km += k.distanceM / 1000;
        i.von = Math.min(i.von, k.startedAt);
        i.bis = Math.max(i.bis, k.endedAt ?? k.startedAt);
      }
      return senden({ typ: "info", nr: a.nr, info });
    }
    case "overlandAbholen":
      return void overlandAbholen(a.nr, a.url, a.schluessel, a.jwt, a.seit, a.liste);
  }
};
