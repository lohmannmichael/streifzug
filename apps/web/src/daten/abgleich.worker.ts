/// <reference lib="webworker" />
import { gpxAus, zipErstellen, cleanFixes, density, distanceToLineM, parseGpx, splitOutings, summarizeImported, tileFor, TILE_ZOOM, type Fix, type Korrektur, type KorrekturArt, type Piece, distanceM, splitLegs } from "@streifzug/core";
import { abgleichen, gueltigFuer, korrekturHash, meterJeGebiet, stueckeFuerIds } from "./rechnen";
import { ortsName, stueckeDerKachel, strassenName } from "./strassen";
import type { Region, Summe } from "./regionen";
import { alleLaden, einenLaden, ergebnisseMerken, importeEntfernen, importeLaden, vieleSpeichern, type ImportQuelle, type Streifzug } from "./speicher";

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
  /** Start time, for "gegangen am …" and the year colours. */
  t: number;
  fixes?: Fix[];
  /** Stored result from an earlier session (piece ids, "aktiv" and "gefahren"); then no fixes are needed. */
  ids?: string[];
  gefahren?: string[];
}

/** Which other sources count. (Car, bus, train never count: that is decided per leg.) */
export interface Zaehlen {
  quellen: Record<ImportQuelle, boolean>;
  /** "Hier komme ich nicht hin": pieces that do not count, neither seen nor in the total. */
  ausnahmen: string[];
  /** Corrected legs per way (Bauplan 3, C2). */
  korrekturen: Record<string, Korrektur[]>;
}

export interface ImportVorschau {
  quelle: "gpx";
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
  | { typ: "importLesen"; nr: number; dateien: File[]; liste: Region[] }
  | { typ: "importUebernehmen"; nr: number }
  | { typ: "quelleLoeschen"; nr: number; quelle: ImportQuelle }
  | { typ: "info"; nr: number }
  | { typ: "overlandAbholen"; nr: number; url: string; schluessel: string; jwt: string; seit: string | null; liste: Region[] }
  | { typ: "wegeSeit"; nr: number; seit: number }
  | { typ: "letzteWege"; nr: number; anzahl: number }
  | { typ: "etikett"; nr: number; punkt: [number, number]; radiusM: number }
  | { typ: "ortsName"; nr: number; punkt: [number, number] }
  | { typ: "export"; nr: number; extra: { name: string; text: string }[] }
  | { typ: "wegeListe"; nr: number; seit: number }
  | { typ: "abschnitte"; nr: number; id: string; korrekturen: Korrektur[] };

export type Antwort =
  | { typ: "stand"; nr: number; fertig: number; gesamt: number }
  | { typ: "ergebnis"; nr: number; stuecke: Piece[]; erstesMal: number[]; gefahren: Piece[]; proGebiet: [string, Summe][]; abzug: [string, Summe][]; draussen: Draussen[]; uebersprungen: string[] }
  | { typ: "stuecke"; nr: number; stuecke: Piece[] }
  | { typ: "vorschau"; nr: number; vorschau: ImportVorschau | null; fehler: string | null }
  | { typ: "info"; nr: number; info: QuellenInfo }
  | { typ: "abgeholt"; nr: number; punkte: number; bis: string | null; fehler: string | null }
  | { typ: "ok"; nr: number }
  | { typ: "wege"; nr: number; wege: KurzWeg[] }
  | { typ: "etikett"; nr: number; etikett: Etikett | null }
  | { typ: "ortsName"; nr: number; name: string | null }
  | { typ: "fehler"; nr: number; text: string }
  | { typ: "exportStand"; nr: number; anteil: number }
  | { typ: "wegeListe"; nr: number; wege: WegKopf[] }
  | { typ: "abschnitte"; nr: number; abschnitte: Abschnitt[] }
  | { typ: "exportFertig"; nr: number; zip: Uint8Array; wege: number };

/** One way in the list (Bauplan 3, C2 / D4): without its points. */
export interface WegKopf {
  id: string;
  startedAt: number;
  endedAt: number;
  distanceM: number;
  quelle: string;
}

/** One leg of a way, as shown for correcting it. */
export interface Abschnitt {
  von: number;
  bis: number;
  /** What it counts as now: corrected, or as recognised (walking/cycling told apart by speed). */
  art: KorrekturArt;
  korrigiert: boolean;
  unsicher: boolean;
  m: number;
}

/** Walked streets outside all regions, per cell of about 5 km (a place that is not prepared yet). */
export interface Draussen {
  zelle: string;
  punkt: [number, number];
  /** Meters walked or cycled there. */
  m: number;
  /** First time walked there. */
  seit: number;
}

const ZELLE = 0.05;
const ausserhalb = (p: [number, number], liste: Region[]) =>
  !liste.some((r) => p[0] >= r.bbox[0] && p[0] <= r.bbox[2] && p[1] >= r.bbox[1] && p[1] <= r.bbox[3]);

/** What the tapped street is (Bauplan 3.2, "Etikett einer Straße"). */
export interface Etikett {
  id: string;
  name: string | null;
  coords: [number, number][];
  zustand: "aktiv" | "gefahren" | "offen";
  /** First time seen in this state. */
  zeit: number | null;
  /** Open meters of this street nearby (same name). */
  restM: number;
  ausnahme: boolean;
}

/** An outing reduced for the replay on opening the app (at most ~400 points). */
export interface KurzWeg {
  id: string;
  startedAt: number;
  endedAt: number;
  distanceM: number;
  coords: [number, number][];
}

export function kuerzen(fixes: Fix[]): [number, number][] {
  const schritt = Math.max(1, Math.ceil(fixes.length / 400));
  const out: [number, number][] = [];
  for (let i = 0; i < fixes.length; i += schritt) out.push([fixes[i]!.lon, fixes[i]!.lat]);
  const letzter = fixes.at(-1);
  if (letzter && (fixes.length - 1) % schritt !== 0) out.push([letzter.lon, letzter.lat]);
  return out;
}

const senden = (a: Antwort) => (self as unknown as DedicatedWorkerGlobalScope).postMessage(a);
const gueltig = (n: number, hash = "") => gueltigFuer(n, hash);
let korrekturenJetzt: Record<string, Korrektur[]> = {};
const hashVon = (id: string) => korrekturHash(korrekturenJetzt[id]);
const QUELLEN: ImportQuelle[] = ["gpx", "overland"];

// Matching results per outing (own and others) and the pieces behind them.
const jeSpur = new Map<string, { key: string; ids: string[]; gefahren: string[] }>();
const stueckNachId = new Map<string, Piece>();

// Other outings, loaded once from the device storage. Fixes are kept only until matched.
type Kopf = Omit<Streifzug, "fixes"> & { fixes: Fix[] | null; n: number };
let andere: Promise<Map<string, Kopf>> | null = null;

function andereLaden(): Promise<Map<string, Kopf>> {
  andere ??= importeLaden(QUELLEN).then((liste) => {
    const m = new Map<string, Kopf>();
    for (const s of liste) {
      const n = s.fixes.length;
      // A stored result for this length (with or without corrections); whether its corrections are
      // still the current ones is checked when calculating.
      if (s.stueckIds && s.stueckIdsGueltig && (s.stueckIdsGueltig === gueltig(n) || s.stueckIdsGueltig.startsWith(`${gueltig(n)}:`))) {
        jeSpur.set(s.id, { key: s.stueckIdsGueltig, ids: s.stueckIds, gefahren: s.stueckIdsGefahren ?? [] });
        m.set(s.id, { ...s, fixes: null, n });
      } else m.set(s.id, { ...s, n });
    }
    return m;
  });
  return andere;
}

const zaehlt = (k: Pick<Streifzug, "quelle">, z: Zaehlen) => k.quelle === undefined || k.quelle === "aufnahme" || z.quellen[k.quelle];

let neueste = 0;
// Pieces covered "aktiv" in the last complete calculation (for "Noch offen").
let zuletztGesehen = new Set<string>();
// First time each piece was seen, per state, and the current exceptions (for the street label).
let ersteAktiv = new Map<string, number>();
let ersteGefahren = new Map<string, number>();
let zuletztAusnahmen = new Set<string>();

/** The counting piece nearest to a tapped point (within radiusM), with its state. */
async function etikettAn(punkt: [number, number], radiusM: number): Promise<Etikett | null> {
  const mitte = tileFor(punkt, TILE_ZOOM);
  let best: { p: Piece; d: number } | null = null;
  const nahe: Piece[] = [];
  for (let dx = -1; dx <= 1; dx++)
    for (let dy = -1; dy <= 1; dy++)
      for (const p of await stueckeDerKachel({ z: TILE_ZOOM, x: mitte.x + dx, y: mitte.y + dy })) {
        if (p.kind !== "street") continue;
        nahe.push(p);
        const d = distanceToLineM(punkt, p.coords);
        if (d <= radiusM && (!best || d < best.d)) best = { p, d };
      }
  if (!best) return null;
  const p = best.p;
  const name = await strassenName(p);
  let restM = 0;
  if (name)
    for (const q of nahe)
      if (!zuletztGesehen.has(q.id) && !zuletztAusnahmen.has(q.id) && (await strassenName(q)) === name) restM += q.lengthM * q.weight;
  const zustand = zuletztGesehen.has(p.id) ? "aktiv" : ersteGefahren.has(p.id) ? "gefahren" : "offen";
  const zeit = zustand === "aktiv" ? (ersteAktiv.get(p.id) ?? null) : zustand === "gefahren" ? (ersteGefahren.get(p.id) ?? null) : null;
  return { id: p.id, name, coords: p.coords.map((c) => [c[0], c[1]] as [number, number]), zustand, zeit, restM, ausnahme: zuletztAusnahmen.has(p.id) };
}

async function berechne(nr: number, eigene: SpurDaten[], z: Zaehlen, liste: Region[]) {
  neueste = nr;
  korrekturenJetzt = z.korrekturen ?? {};
  const keyVon = (id: string, n: number) => gueltig(n, hashVon(id));
  // Own outings: stored results first (cheap). The page sends them only if valid with the corrections.
  const fehlend: string[] = [];
  for (const s of eigene) if (s.ids && jeSpur.get(s.id)?.key !== keyVon(s.id, s.n)) jeSpur.set(s.id, { key: keyVon(s.id, s.n), ids: s.ids, gefahren: s.gefahren ?? [] });
  const alle = await andereLaden();
  const zaehlende = [...alle.values()].filter((k) => zaehlt(k, z));
  for (const id of [...eigene.map((s) => s.id), ...zaehlende.map((k) => k.id)]) {
    const e = jeSpur.get(id);
    for (const p of [...(e?.ids ?? []), ...(e?.gefahren ?? [])]) if (!stueckNachId.has(p)) fehlend.push(p);
  }
  for (const p of await stueckeFuerIds(fehlend)) stueckNachId.set(p.id, p);

  // Then everything that still needs matching (new outings, or after a rules change).
  // Others whose corrections changed need their points again.
  for (const k of zaehlende) if (jeSpur.get(k.id)?.key !== keyVon(k.id, k.n) && !k.fixes) k.fixes = (await einenLaden(k.id))?.fixes ?? null;
  const offen: { id: string; n: number; fixes: Fix[]; locker: boolean; speichern: boolean }[] = [
    ...eigene.filter((s) => jeSpur.get(s.id)?.key !== keyVon(s.id, s.n) && s.fixes).map((s) => ({ id: s.id, n: s.n, fixes: s.fixes!, locker: false, speichern: !s.id.startsWith("live:") })),
    ...zaehlende.filter((k) => jeSpur.get(k.id)?.key !== keyVon(k.id, k.n) && k.fixes).map((k) => ({ id: k.id, n: k.n, fixes: k.fixes!, locker: true, speichern: true })),
  ];
  let merken: { id: string; ids: string[]; gefahren: string[]; gueltig: string }[] = [];
  const uebersprungen: string[] = [];
  for (let i = 0; i < offen.length; i++) {
    const s = offen[i]!;
    // A newer request (e.g. the next live fixes) takes over; what is done so far is kept.
    if (neueste !== nr) break;
    senden({ typ: "stand", nr, fertig: i, gesamt: offen.length });
    // One broken outing must not stop all the others: it is skipped (and tried again next time).
    let r: Awaited<ReturnType<typeof abgleichen>>;
    try {
      r = await abgleichen(s.fixes, s.locker, korrekturenJetzt[s.id] ?? []);
    } catch (e) {
      console.warn("Weg übersprungen", s.id, e);
      uebersprungen.push(s.id);
      continue;
    }
    for (const p of [...r.aktiv, ...r.gefahren]) stueckNachId.set(p.id, p);
    const ids = r.aktiv.map((p) => p.id);
    const gefahren = r.gefahren.map((p) => p.id);
    jeSpur.set(s.id, { key: keyVon(s.id, s.n), ids, gefahren });
    const kopf = alle.get(s.id);
    if (kopf) kopf.fixes = null;
    if (s.speichern) merken.push({ id: s.id, ids, gefahren, gueltig: keyVon(s.id, s.n) });
    if (merken.length >= 25) {
      await ergebnisseMerken(merken);
      merken = [];
    }
  }
  await ergebnisseMerken(merken);
  if (neueste !== nr) return;

  // State per piece: "aktiv" wins over "gefahren" (yellow paints over the pen line).
  // Exceptions ("Hier komme ich nicht hin") count neither as seen nor in the total.
  const ausnahmen = new Set(z.ausnahmen);
  const gesehen = new Map<string, Piece>();
  const gefahren = new Map<string, Piece>();
  const aktivAb = new Map<string, number>();
  const gefahrenAb = new Map<string, number>();
  const start = new Map<string, number>(eigene.map((s) => [s.id, s.t]));
  for (const k of zaehlende) start.set(k.id, k.startedAt);
  for (const [id, t] of start) {
    const e = jeSpur.get(id);
    for (const pid of e?.ids ?? []) {
      const p = stueckNachId.get(pid);
      if (!p) continue;
      if (!ausnahmen.has(pid)) gesehen.set(pid, p);
      if (t < (aktivAb.get(pid) ?? Infinity)) aktivAb.set(pid, t);
    }
    for (const pid of e?.gefahren ?? []) {
      const p = stueckNachId.get(pid);
      if (!p) continue;
      gefahren.set(pid, p);
      if (t < (gefahrenAb.get(pid) ?? Infinity)) gefahrenAb.set(pid, t);
    }
  }
  for (const pid of gesehen.keys()) gefahren.delete(pid);
  zuletztGesehen = new Set(gesehen.keys());
  ersteAktiv = aktivAb;
  ersteGefahren = gefahrenAb;
  zuletztAusnahmen = ausnahmen;
  const proGebiet = await meterJeGebiet(gesehen.values(), liste, (p) => aktivAb.get(p.id));
  const abzug = ausnahmen.size ? await meterJeGebiet(await stueckeFuerIds([...ausnahmen]), liste) : new Map<string, Summe>();
  const stuecke = [...gesehen.values()];
  const erstesMal = stuecke.map((p) => aktivAb.get(p.id) ?? Date.now());
  // Places without a region: kept and drawn, counted once the region is there.
  const zellen = new Map<string, Draussen>();
  for (const p of stuecke) {
    if (!ausserhalb(p.mid as [number, number], liste)) continue;
    const zelle = `${Math.round(p.mid[0] / ZELLE)},${Math.round(p.mid[1] / ZELLE)}`;
    const e = zellen.get(zelle) ?? { zelle, punkt: [p.mid[0], p.mid[1]] as [number, number], m: 0, seit: Infinity };
    e.m += p.lengthM * p.weight;
    e.seit = Math.min(e.seit, aktivAb.get(p.id) ?? Date.now());
    zellen.set(zelle, e);
  }
  const draussen = [...zellen.values()].filter((e) => e.m >= 200);
  senden({ typ: "ergebnis", nr, stuecke, erstesMal, gefahren: [...gefahren.values()], proGebiet: [...proGebiet], abzug: [...abzug], draussen, uebersprungen });
}

function wegeAus(quelle: ImportQuelle, fixes: Fix[]): Streifzug[] {
  return splitOutings(fixes).map((t) => {
    const sum = summarizeImported(t);
    // Same id for the same outing when data comes again, so nothing is doubled.
    return { id: `${quelle}:${t[0]!.t}`, startedAt: t[0]!.t, endedAt: t.at(-1)!.t, fixes: t, distanceM: sum.distanceM, mode: sum.mode, status: "importiert", quelle };
  });
}

let wartend: Streifzug[] = [];

async function importLesen(nr: number, dateien: File[], _liste: Region[]) {
  try {
    const fixes: Fix[] = [];
    // No spread here: tens of thousands of points would overflow the call stack.
    for (const d of dateien) for (const f of parseGpx(await d.text())) fixes.push(f);
    if (fixes.length === 0) throw new Error("In den Dateien stehen keine Wege mit Zeitangaben.");
    fixes.sort((a, b) => a.t - b.t);
    // Everything is kept, also outside the regions: it counts once the place is prepared.
    const wege = wegeAus("gpx", fixes);
    wartend = wege;
    const km = { fuss: 0, rad: 0, auto: 0 };
    for (const w of wege) km[w.mode === "foot" ? "fuss" : w.mode === "bike" ? "rad" : "auto"] += w.distanceM / 1000;
    senden({
      typ: "vorschau",
      nr,
      fehler: null,
      vorschau: { quelle: "gpx", wege: wege.length, km, dichte: density(wege.map((w) => w.fixes)), von: wege[0]?.startedAt ?? null, bis: wege.at(-1)?.endedAt ?? null, punkteGesamt: fixes.length },
    });
  } catch (e) {
    senden({ typ: "vorschau", nr, vorschau: null, fehler: e instanceof Error ? e.message : String(e) });
  }
}

/** New points from the Overland receiver, appended to the last outing if it just continues. */
async function overlandAbholen(nr: number, url: string, schluessel: string, jwt: string, seit: string | null, _liste: Region[]) {
  try {
    const neu: Fix[] = [];
    let ab = seit;
    // Page through the points (the server returns at most 1000 at a time).
    for (;;) {
      const filter = ab ? `&t=gt.${encodeURIComponent(ab)}` : "";
      const r = await fetch(`${url}/rest/v1/received_points?select=t,lon,lat,acc,motion,speed&order=t.asc&limit=1000${filter}`, {
        headers: { apikey: schluessel, Authorization: `Bearer ${jwt}` },
      });
      if (!r.ok) throw new Error(`Abholen fehlgeschlagen (${r.status})`);
      const seite = (await r.json()) as { t: string; lon: number; lat: number; acc: number | null; motion: string[] | null; speed: number | null }[];
      for (const p of seite)
        neu.push({
          t: Date.parse(p.t),
          lon: p.lon,
          lat: p.lat,
          acc: p.acc ?? 10,
          // iOS motion activity and speed: used to tell "aktiv" from "gefahren" per leg.
          ...(p.motion?.length ? { motion: p.motion } : {}),
          ...(p.speed !== null && p.speed !== undefined ? { speed: p.speed } : {}),
        });
      if (seite.length < 1000) break;
      ab = seite.at(-1)!.t;
    }
    const bis = neu.length ? new Date(neu.reduce((m, f) => Math.max(m, f.t), 0)).toISOString() : seit;
    // All points are kept, also in places without a region yet (counted once it is prepared).
    const imGebiet = neu;
    if (imGebiet.length > 0) {
      // Continue the last outing if the new points follow on within its pause limit.
      const alle = await andereLaden();
      const letzte = [...alle.values()].filter((k) => k.quelle === "overland").sort((a, b) => b.startedAt - a.startedAt)[0];
      let basis: Fix[] = [];
      if (letzte && (letzte.endedAt ?? 0) >= imGebiet[0]!.t - 600_000) basis = (await einenLaden(letzte.id))?.fixes ?? [];
      const jetzt = Date.now();
      const wege = wegeAus("overland", cleanFixes([...basis, ...imGebiet])).map((w) => ({ ...w, empfangenAm: jetzt }));
      await vieleSpeichern(wege);
      andere = null;
    }
    senden({ typ: "abgeholt", nr, punkte: neu.length, bis, fehler: null });
  } catch (e) {
    senden({ typ: "abgeholt", nr, punkte: 0, bis: seit, fehler: e instanceof Error ? e.message : String(e) });
  }
}

self.onmessage = async (e: MessageEvent<Anfrage>) => {
  try {
    await antworten(e.data);
  } catch (fehler) {
    // Never leave the page waiting: say what went wrong.
    senden({ typ: "fehler", nr: e.data.nr, text: fehler instanceof Error ? fehler.message : String(fehler) });
  }
};

async function antworten(a: Anfrage): Promise<void> {
  switch (a.typ) {
    case "berechne":
      return berechne(a.nr, a.eigene, a.zaehlen, a.liste);
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
      return void importLesen(a.nr, a.dateien, a.liste);
    case "importUebernehmen":
      await vieleSpeichern(wartend);
      wartend = [];
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
    case "wegeSeit": {
      // Other outings (Overland, GPX) that came in after a point in time, for the replay. Overland
      // sends with delay, so what counts is when the points arrived, not when they were recorded.
      const wege: KurzWeg[] = [];
      for (const k of (await andereLaden()).values()) {
        if ((k.empfangenAm ?? k.endedAt ?? k.startedAt) <= a.seit) continue;
        const fixes = k.fixes ?? (await einenLaden(k.id))?.fixes ?? [];
        if (fixes.length > 1) wege.push({ id: k.id, startedAt: k.startedAt, endedAt: k.endedAt ?? k.startedAt, distanceM: k.distanceM, coords: kuerzen(fixes) });
      }
      return senden({ typ: "wege", nr: a.nr, wege });
    }
    case "letzteWege": {
      // The newest other outings (Overland, GPX), for "Zuletzt" in the quarter sheet.
      const neueste = [...(await andereLaden()).values()].sort((x, y) => (y.endedAt ?? y.startedAt) - (x.endedAt ?? x.startedAt)).slice(0, a.anzahl);
      const wege: KurzWeg[] = [];
      for (const k of neueste) {
        const fixes = k.fixes ?? (await einenLaden(k.id))?.fixes ?? [];
        if (fixes.length > 1) wege.push({ id: k.id, startedAt: k.startedAt, endedAt: k.endedAt ?? k.startedAt, distanceM: k.distanceM, coords: kuerzen(fixes) });
      }
      return senden({ typ: "wege", nr: a.nr, wege });
    }
    case "wegeListe": {
      const eigene = (await alleLaden()).map((s) => ({ id: s.id, startedAt: s.startedAt, endedAt: s.endedAt ?? s.startedAt, distanceM: s.distanceM, quelle: s.quelle ?? "aufnahme" }));
      const andereWege = [...(await andereLaden()).values()].map((k) => ({ id: k.id, startedAt: k.startedAt, endedAt: k.endedAt ?? k.startedAt, distanceM: k.distanceM, quelle: k.quelle ?? "" }));
      const wege = [...eigene, ...andereWege].filter((w) => w.endedAt >= a.seit).sort((x, y) => y.startedAt - x.startedAt);
      return senden({ typ: "wegeListe", nr: a.nr, wege });
    }
    case "abschnitte": {
      const fixes = (await einenLaden(a.id))?.fixes ?? [];
      const abschnitte = splitLegs(fixes, a.korrekturen).map((l): Abschnitt => {
        let m = 0;
        for (let i = 1; i < l.fixes.length; i++) m += distanceM([l.fixes[i - 1]!.lon, l.fixes[i - 1]!.lat], [l.fixes[i]!.lon, l.fixes[i]!.lat]);
        const kmh = (m / Math.max(1, (l.bis - l.von) / 1000)) * 3.6;
        const art: KorrekturArt = l.korrigiert ?? (l.art === "gefahren" ? "gefahren" : kmh > 11 ? "rad" : "zuFuss");
        return { von: l.von, bis: l.bis, art, korrigiert: !!l.korrigiert, unsicher: l.unsicher, m };
      });
      return senden({ typ: "abschnitte", nr: a.nr, abschnitte });
    }
    case "export":
      return exportieren(a.nr, a.extra);
    case "ortsName":
      return senden({ typ: "ortsName", nr: a.nr, name: await ortsName(a.punkt) });
    case "etikett":
      return senden({ typ: "etikett", nr: a.nr, etikett: await etikettAn(a.punkt, a.radiusM) });
  }
}

/** Everything for "Alles exportieren": every way as GPX (own, Overland, imported) plus the extra files. */
async function exportieren(nr: number, extra: { name: string; text: string }[]) {
  const enc = new TextEncoder();
  const zweistellig = (n: number) => String(n).padStart(2, "0");
  const wege = [...(await alleLaden()), ...(await importeLaden(QUELLEN))].filter((s) => s.fixes.length > 1).sort((a, b) => a.startedAt - b.startedAt);
  const namen = new Set<string>();
  const dateien = wege.map((s) => {
    const d = new Date(s.startedAt);
    const herkunft = s.quelle && s.quelle !== "aufnahme" ? s.quelle : "eigene";
    let name = `wege/${d.getFullYear()}-${zweistellig(d.getMonth() + 1)}-${zweistellig(d.getDate())}_${zweistellig(d.getHours())}${zweistellig(d.getMinutes())}_${herkunft}.gpx`;
    for (let k = 2; namen.has(name); k++) name = name.replace(/(_\d+)?\.gpx$/, `_${k}.gpx`);
    namen.add(name);
    return { name, daten: enc.encode(gpxAus(s.fixes, `Unterwegs ${d.toLocaleString("de-DE")}`)) };
  });
  for (const e of extra) dateien.push({ name: e.name, daten: enc.encode(e.text) });
  const zip = await zipErstellen(dateien, (anteil) => senden({ typ: "exportStand", nr, anteil }));
  (self as unknown as DedicatedWorkerGlobalScope).postMessage({ typ: "exportFertig", nr, zip, wege: wege.length } satisfies Antwort, [zip.buffer]);
}
