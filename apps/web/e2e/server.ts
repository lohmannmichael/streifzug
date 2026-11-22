/**
 * Replaces every server the app talks to, so the browser tests never touch a real account or
 * depend on the network (Bauplan 3, E1):
 * - Supabase (sign-in, tables, storage): a small in-memory stand-in with the fixed test ways as
 *   Overland points.
 * - OpenFreeMap (map style, tiles, fonts): recorded answers from `e2e/daten/openfreemap/`.
 *   `AUFNEHMEN=1 npm run e2e` fetches and stores what is missing.
 */
import type { BrowserContext, Page, Route } from "@playwright/test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HIER = dirname(fileURLToPath(import.meta.url));
const AUFNAHMEN = join(HIER, "daten", "openfreemap");
const AUFNEHMEN = process.env.AUFNEHMEN === "1";

interface TestPunkt {
  vorMin: number;
  lon: number;
  lat: number;
  acc: number;
  motion: string[];
  speed: number;
}
export const TESTWEGE = JSON.parse(readFileSync(join(HIER, "daten", "wege.json"), "utf8")) as { name: string; punkte: TestPunkt[] }[];

export interface ServerOptionen {
  /** Which test ways the account holds (default: all). */
  wege?: string[];
  /** Map style arrives this much later (ms). */
  stilVerzoegerung?: number;
  /** Map service unreachable (style, tiles, fonts). */
  karteAus?: boolean;
  /** Street tiles for matching fail (the map itself still draws). */
  strassenAus?: boolean;
}

export interface Server {
  optionen: ServerOptionen;
  /** Ids of fake accounts handed out (there are no real ones; kept for symmetry with the rule in CLAUDE.md). */
  benutzer: string;
}

const base64url = (s: string) => Buffer.from(s).toString("base64url");

function sitzung(id: string) {
  const exp = Math.floor(Date.now() / 1000) + 24 * 3600;
  const token = `${base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }))}.${base64url(JSON.stringify({ sub: id, role: "authenticated", aud: "authenticated", exp, is_anonymous: true }))}.test`;
  const user = { id, aud: "authenticated", role: "authenticated", is_anonymous: true, email: "", app_metadata: {}, user_metadata: {}, identities: [], created_at: new Date().toISOString() };
  return { access_token: token, token_type: "bearer", expires_in: 24 * 3600, expires_at: exp, refresh_token: "test-refresh", user };
}

function inhaltsTyp(datei: string): string {
  const e = extname(datei);
  return e === ".pbf" ? "application/x-protobuf" : e === ".png" ? "image/png" : "application/json";
}

/** File for a request to tiles.openfreemap.org; paths without an extension are JSON. */
function aufnahmeDatei(url: URL): string {
  const pfad = decodeURIComponent(url.pathname);
  return join(AUFNAHMEN, extname(pfad) ? pfad : `${pfad}.json`);
}

async function openfreemap(route: Route, s: Server) {
  const url = new URL(route.request().url());
  if (s.optionen.karteAus) return route.abort("connectionrefused");
  const istStil = url.pathname.startsWith("/styles/");
  if (istStil && s.optionen.stilVerzoegerung) await new Promise((r) => setTimeout(r, s.optionen.stilVerzoegerung));
  // Matching uses zoom-14 tiles; the map shows overzoomed zoom-14 tiles too, so "Straßen aus" hits
  // both. The base map (paper, labels) stays from the style.
  if (s.optionen.strassenAus && /\/14\/\d+\/\d+\.pbf$/.test(url.pathname)) return route.abort("connectionrefused");
  // Far-out tiles (zoom under 12, several hundred kB each) are not kept: the plan stays paper-white
  // there, the own layers (yellow, hatching, borders) are drawn all the same.
  const zoom = /\/(\d+)\/\d+\/\d+\.pbf$/.exec(url.pathname)?.[1];
  if (zoom && Number(zoom) < 12) return route.fulfill({ status: 204, headers: { "access-control-allow-origin": "*" } });
  const datei = aufnahmeDatei(url);
  if (existsSync(datei)) return route.fulfill({ status: 200, contentType: inhaltsTyp(datei), body: readFileSync(datei), headers: { "access-control-allow-origin": "*" } });
  if (AUFNEHMEN) {
    const antwort = await route.fetch();
    if (antwort.ok()) {
      mkdirSync(dirname(datei), { recursive: true });
      writeFileSync(datei, await antwort.body());
    }
    return route.fulfill({ response: antwort });
  }
  // Not recorded (a tile far away): an empty answer, as for the sea.
  return route.fulfill({ status: 204, headers: { "access-control-allow-origin": "*" } });
}

function punkteAlsZeilen(s: Server, jetzt: number) {
  const namen = s.optionen.wege ?? TESTWEGE.map((w) => w.name);
  return TESTWEGE.filter((w) => namen.includes(w.name))
    .flatMap((w) => w.punkte)
    .map((p) => ({ t: new Date(jetzt - p.vorMin * 60_000).toISOString(), lon: p.lon, lat: p.lat, acc: p.acc, motion: p.motion, speed: p.speed }))
    .sort((a, b) => a.t.localeCompare(b.t));
}

async function supabase(route: Route, s: Server, jetzt: number) {
  const req = route.request();
  const url = new URL(req.url());
  const pfad = url.pathname;
  const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
    route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body), headers: { "access-control-allow-origin": "*", "access-control-expose-headers": "content-range", ...headers } });
  if (req.method() === "OPTIONS")
    return route.fulfill({ status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*", "access-control-expose-headers": "content-range" } });

  if (pfad.startsWith("/auth/v1/")) {
    if (pfad.endsWith("/user")) return json(sitzung(s.benutzer).user);
    if (pfad.endsWith("/logout")) return route.fulfill({ status: 204 });
    return json(sitzung(s.benutzer));
  }
  if (pfad.startsWith("/storage/v1/")) return json(req.method() === "GET" ? [] : { Key: pfad, Id: "test" });
  if (pfad.startsWith("/rest/v1/")) {
    const tabelle = pfad.slice("/rest/v1/".length);
    const einzeln = (req.headers().accept ?? "").includes("vnd.pgrst.object");
    const zeilen = (liste: unknown[]) => (einzeln ? (liste[0] ? json(liste[0]) : json(null, 406)) : json(liste));
    if (tabelle === "receive_tokens") {
      // Overland is connected (one token); with `count=exact` the count comes in Content-Range.
      if (req.method() === "HEAD" || req.method() === "GET") return route.fulfill({ status: 200, contentType: "application/json", body: req.method() === "HEAD" ? "" : "[]", headers: { "content-range": "0-0/1", "access-control-allow-origin": "*", "access-control-expose-headers": "content-range" } });
      return json([], 201);
    }
    if (tabelle === "received_points" && req.method() === "GET") {
      let liste = punkteAlsZeilen(s, jetzt);
      const ab = url.searchParams.get("t");
      if (ab?.startsWith("gt.")) liste = liste.filter((p) => p.t > ab.slice(3));
      if (url.searchParams.get("order") === "t.desc") liste = liste.reverse();
      const grenze = Number(url.searchParams.get("limit") ?? 1000);
      return zeilen(liste.slice(0, grenze));
    }
    if (req.method() === "GET") return zeilen([]);
    return json([], 201);
  }
  return json({ message: "Im Test nicht nachgebaut" }, 404);
}

/** Installs the stand-ins on a page (also covers its workers). Returns the server for changes during a test. */
export async function serverErsetzen(ziel: Page | BrowserContext, optionen: ServerOptionen = {}): Promise<Server> {
  const s: Server = { optionen, benutzer: "00000000-0000-4000-8000-00000000e2e1" };
  const jetzt = Date.now();
  await ziel.route("https://tiles.openfreemap.org/**", (r) => openfreemap(r, s));
  await ziel.route("https://*.supabase.co/**", (r) => supabase(r, s, jetzt));
  return s;
}
