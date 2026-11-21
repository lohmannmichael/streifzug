/// <reference lib="webworker" />
import { cleanFixes, density, distanceToLineM, parseGpx, pointInGeometry, splitOutings, summarizeImported, tileFor, TILE_ZOOM, type Fix, type Piece } from "@streifzug/core";
import { abgleichen, ABGLEICH_VERSION, ladeFlaechen, meterJeGebiet, stueckeFuerIds } from "./rechnen";
import { ortsName, stueckeDerKachel, strassenName } from "./strassen";
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
  | { typ: "offen"; nr: number; regionId: string; gebietId: string; bezug: [number, number] | null }
  | { typ: "etikett"; nr: number; punkt: [number, number]; radiusM: number }
  | { typ: "ortsName"; nr: number; punkt: [number, number] };

export type Antwort =
  | { typ: "stand"; nr: number; fertig: number; gesamt: number }
  | { typ: "ergebnis"; nr: number; stuecke: Piece[]; erstesMal: number[]; gefahren: Piece[]; proGebiet: [string, Summe][]; abzug: [string, Summe][]; draussen: Draussen[] }
  | { typ: "stuecke"; nr: number; stuecke: Piece[] }
  | { typ: "vorschau"; nr: number; vorschau: ImportVorschau | null; fehler: string | null }
  | { typ: "info"; nr: number; info: QuellenInfo }
  | { typ: "abgeholt"; nr: number; punkte: number; bis: string | null; fehler: string | null }
  | { typ: "ok"; nr: number }
  | { typ: "wege"; nr: number; wege: KurzWeg[] }
  | { typ: "offen"; nr: number; strassen: OffeneStrasse[] }
  | { typ: "etikett"; nr: number; etikett: Etikett | null }
  | { typ: "ortsName"; nr: number; name: string | null };

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

/** A named street in a Veedel that is not walked completely yet ("Noch offen", Bauplan 3.2). */
export interface OffeneStrasse {
  name: string;
  restM: number;
  /** Distance from the reference point (own position or Veedel middle) to its nearest open piece. */
  abstandM: number;
  linien: [number, number][][];
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
const gueltig = (n: number) => `${ABGLEICH_VERSION}:${n}`;
const QUELLEN: ImportQuelle[] = ["gpx", "overland"];

// Matching results per outing (own and others) and the pieces behind them.
const jeSpur = new Map<string, { n: number; ids: string[]; gefahren: string[] }>();
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
        jeSpur.set(s.id, { n, ids: s.stueckIds, gefahren: s.stueckIdsGefahren ?? [] });
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

/** Named streets of a Veedel with open meters, nearest first (at most 12). */
async function offeneStrassen(regionId: string, gebietId: string, bezug: [number, number] | null): Promise<OffeneStrasse[]> {
  const flaeche = (await ladeFlaechen(regionId)).find((f) => f.id === gebietId);
  if (!flaeche) return [];
  const [w, s, o, n] = flaeche.bbox;
  const a = tileFor([w, n], TILE_ZOOM);
  const b = tileFor([o, s], TILE_ZOOM);
  if ((b.x - a.x + 1) * (b.y - a.y + 1) > 64) return [];
  const jeName = new Map<string, { gesamt: number; offen: number; linien: [number, number][][]; abstand: number }>();
  const mitte: [number, number] = bezug ?? [(w + o) / 2, (s + n) / 2];
  for (let x = a.x; x <= b.x; x++)
    for (let y = a.y; y <= b.y; y++)
      for (const p of await stueckeDerKachel({ z: TILE_ZOOM, x, y })) {
        if (p.kind !== "street" || !pointInGeometry(p.mid, flaeche.geometry)) continue;
        const name = await strassenName(p);
        if (!name) continue;
        const e = jeName.get(name) ?? { gesamt: 0, offen: 0, linien: [], abstand: Infinity };
        const m = p.lengthM * p.weight;
        e.gesamt += m;
        if (!zuletztGesehen.has(p.id)) {
          e.offen += m;
          e.linien.push(p.coords.map((c) => [c[0], c[1]] as [number, number]));
          e.abstand = Math.min(e.abstand, distanceToLineM(mitte, p.coords));
        }
        jeName.set(name, e);
      }
  return [...jeName]
    .filter(([, e]) => e.offen >= 10)
    .map(([name, e]) => ({ name, restM: e.offen, abstandM: e.abstand, linien: e.linien }))
    .sort((x, y) => x.abstandM - y.abstandM)
    .slice(0, 12);
}

async function berechne(nr: number, eigene: SpurDaten[], z: Zaehlen, liste: Region[]) {
  neueste = nr;
  // Own outings: stored results first (cheap).
  const fehlend: string[] = [];
  for (const s of eigene) if (s.ids && jeSpur.get(s.id)?.n !== s.n) jeSpur.set(s.id, { n: s.n, ids: s.ids, gefahren: s.gefahren ?? [] });
  const alle = await andereLaden();
  const zaehlende = [...alle.values()].filter((k) => zaehlt(k, z));
  for (const id of [...eigene.map((s) => s.id), ...zaehlende.map((k) => k.id)]) {
    const e = jeSpur.get(id);
    for (const p of [...(e?.ids ?? []), ...(e?.gefahren ?? [])]) if (!stueckNachId.has(p)) fehlend.push(p);
  }
  for (const p of await stueckeFuerIds(fehlend)) stueckNachId.set(p.id, p);

  // Then everything that still needs matching (new outings, or after a rules change).
  const offen: { id: string; n: number; fixes: Fix[]; locker: boolean; speichern: boolean }[] = [
    ...eigene.filter((s) => jeSpur.get(s.id)?.n !== s.n && s.fixes).map((s) => ({ id: s.id, n: s.n, fixes: s.fixes!, locker: false, speichern: !s.id.startsWith("live:") })),
    ...zaehlende.filter((k) => jeSpur.get(k.id)?.n !== k.n && k.fixes).map((k) => ({ id: k.id, n: k.n, fixes: k.fixes!, locker: true, speichern: true })),
  ];
  let merken: { id: string; ids: string[]; gefahren: string[]; gueltig: string }[] = [];
  for (let i = 0; i < offen.length; i++) {
    const s = offen[i]!;
    // A newer request (e.g. the next live fixes) takes over; what is done so far is kept.
    if (neueste !== nr) break;
    if (offen.length > 3) senden({ typ: "stand", nr, fertig: i, gesamt: offen.length });
    const r = await abgleichen(s.fixes, s.locker);
    for (const p of [...r.aktiv, ...r.gefahren]) stueckNachId.set(p.id, p);
    const ids = r.aktiv.map((p) => p.id);
    const gefahren = r.gefahren.map((p) => p.id);
    jeSpur.set(s.id, { n: s.n, ids, gefahren });
    const kopf = alle.get(s.id);
    if (kopf) kopf.fixes = null;
    if (s.speichern) merken.push({ id: s.id, ids, gefahren, gueltig: gueltig(s.n) });
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
  const proGebiet = await meterJeGebiet(gesehen.values(), liste);
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
  senden({ typ: "ergebnis", nr, stuecke, erstesMal, gefahren: [...gefahren.values()], proGebiet: [...proGebiet], abzug: [...abzug], draussen });
}

function wegeAus(quelle: ImportQuelle, fixes: Fix[]): Streifzug[] {
  return splitOutings(fixes).map((t) => {
    const sum = summarizeImported(t);
    // Same id for the same outing when data comes again, so nothing is doubled.
    return { id: `${quelle}:${t[0]!.t}`, startedAt: t[0]!.t, endedAt: t.at(-1)!.t, fixes: t, distanceM: sum.distanceM, mode: sum.mode, status: "importiert", quelle };
  });
}

let wartend: Streifzug[] = [];

async function importLesen(nr: number, dateien: File[], liste: Region[]) {
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
async function overlandAbholen(nr: number, url: string, schluessel: string, jwt: string, seit: string | null, liste: Region[]) {
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
      // Other outings (Overland, GPX) that ended after a point in time, for the replay.
      const wege: KurzWeg[] = [];
      for (const k of (await andereLaden()).values()) {
        if ((k.endedAt ?? k.startedAt) <= a.seit) continue;
        const fixes = k.fixes ?? (await einenLaden(k.id))?.fixes ?? [];
        if (fixes.length > 1) wege.push({ id: k.id, startedAt: k.startedAt, endedAt: k.endedAt ?? k.startedAt, distanceM: k.distanceM, coords: kuerzen(fixes) });
      }
      return senden({ typ: "wege", nr: a.nr, wege });
    }
    case "letzteWege": {
      // The newest other outings (Overland, GPX), for "Zuletzt" in the Veedel sheet.
      const neueste = [...(await andereLaden()).values()].sort((x, y) => (y.endedAt ?? y.startedAt) - (x.endedAt ?? x.startedAt)).slice(0, a.anzahl);
      const wege: KurzWeg[] = [];
      for (const k of neueste) {
        const fixes = k.fixes ?? (await einenLaden(k.id))?.fixes ?? [];
        if (fixes.length > 1) wege.push({ id: k.id, startedAt: k.startedAt, endedAt: k.endedAt ?? k.startedAt, distanceM: k.distanceM, coords: kuerzen(fixes) });
      }
      return senden({ typ: "wege", nr: a.nr, wege });
    }
    case "ortsName":
      return senden({ typ: "ortsName", nr: a.nr, name: await ortsName(a.punkt) });
    case "etikett":
      return senden({ typ: "etikett", nr: a.nr, etikett: await etikettAn(a.punkt, a.radiusM) });
    case "offen":
      return senden({ typ: "offen", nr: a.nr, strassen: await offeneStrassen(a.regionId, a.gebietId, a.bezug) });
  }
};
