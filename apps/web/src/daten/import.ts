import { useEffect, useRef, useState } from "react";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "../konfig";
import type { ImportVorschau, KurzWeg, QuellenInfo } from "./abgleich.worker";
import { ANDERE_GEAENDERT, andereGeaendert, fragen } from "./arbeiter";
import type { Regionen } from "./regionen";
import type { ImportQuelle } from "./speicher";
import { supabase } from "./supabase";

export type { ImportVorschau, KurzWeg, QuellenInfo } from "./abgleich.worker";

/** Reads files in the background and returns a preview (nothing is saved yet). Throws with a German message. */
export async function lesen(dateien: File[], daten: Regionen): Promise<ImportVorschau> {
  const a = await fragen<"vorschau">({ typ: "importLesen", dateien, liste: daten.liste }).antwort;
  if (!a.vorschau) throw new Error(a.fehler ?? "Die Datei konnte nicht gelesen werden.");
  return a.vorschau;
}

export async function uebernehmen(): Promise<void> {
  await fragen<"ok">({ typ: "importUebernehmen" }).antwort;
  andereGeaendert();
}

/** Removes everything from one source (own recordings stay). */
export async function quelleLoeschen(quelle: ImportQuelle): Promise<void> {
  await fragen<"ok">({ typ: "quelleLoeschen", quelle }).antwort;
  if (quelle === "overland") localStorage.removeItem(OVERLAND_SEIT);
  andereGeaendert();
}

/** How many outings each other source holds; reloads when they change. */
export function useQuellenInfo(): QuellenInfo {
  const [info, setInfo] = useState<QuellenInfo>({});
  useEffect(() => {
    let aktiv = true;
    const laden = () => void fragen<"info">({ typ: "info" }).antwort.then((a) => aktiv && setInfo(a.info));
    laden();
    window.addEventListener(ANDERE_GEAENDERT, laden);
    return () => {
      aktiv = false;
      window.removeEventListener(ANDERE_GEAENDERT, laden);
    };
  }, []);
  return info;
}

/* Overland: free iPhone app that records in the background and sends points to our receiver. */

const OVERLAND_AN = "streifzug.overland";
const OVERLAND_SEIT = "streifzug.overland-seit";
const OVERLAND_ZULETZT = "streifzug.overland-zuletzt";
export const OVERLAND_EMPFAENGER = `${SUPABASE_URL}/functions/v1/overland`;

async function sha256(text: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Creates a new secret token for this account (only its hash goes to the server) and returns
 * the setup link that configures Overland with one tap.
 */
export async function overlandVerbinden(userId: string): Promise<string> {
  const roh = crypto.getRandomValues(new Uint8Array(32));
  const token = btoa(String.fromCharCode(...roh)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const { error } = await supabase.from("receive_tokens").insert({ token_hash: await sha256(token), user_id: userId });
  if (error) throw new Error("Verbinden hat nicht geklappt. Bitte mit Internet erneut versuchen.");
  localStorage.setItem(OVERLAND_AN, "1");
  return `overland://setup?url=${encodeURIComponent(OVERLAND_EMPFAENGER)}&token=${encodeURIComponent(token)}`;
}

/** Ends the connection: all tokens of this account stop working. Received outings stay unless deleted. */
export async function overlandTrennen(userId: string): Promise<void> {
  await supabase.from("receive_tokens").delete().eq("user_id", userId);
  localStorage.removeItem(OVERLAND_AN);
}

export const overlandVerbunden = () => localStorage.getItem(OVERLAND_AN) === "1";

/** The flag lives on the device; if it got lost, the server knows whether Overland is set up. */
async function verbindungPruefen(): Promise<boolean> {
  if (overlandVerbunden()) return true;
  const { count, error } = await supabase.from("receive_tokens").select("token_hash", { count: "exact", head: true });
  if (error || !count) return false;
  localStorage.setItem(OVERLAND_AN, "1");
  return true;
}
export const overlandZuletzt = () => Number(localStorage.getItem(OVERLAND_ZULETZT) ?? 0) || null;
/** Time of the newest point received from Overland (null if none yet). */
export const overlandLetzterPunkt = () => {
  const t = Date.parse(localStorage.getItem(OVERLAND_SEIT) ?? "");
  return Number.isNaN(t) ? null : t;
};
/** After this long without a point, the sheet says so (Bauplan 3, C1; Michi: 3 hours, not 24). */
export const STILL_MS = 3 * 3600_000;

export interface OverlandStatus {
  /** null while not known yet. */
  verbunden: boolean | null;
  /** Time of the newest point the server has for this account. */
  letzter: number | null;
}

/** The newest point on the server (not the device): asked on opening, coming back and every 5 minutes. */
export function useOverlandStatus(): OverlandStatus {
  const [status, setStatus] = useState<OverlandStatus>({ verbunden: overlandVerbunden() || null, letzter: overlandLetzterPunkt() });
  useEffect(() => {
    let lebt = true;
    const fragenServer = async () => {
      if (!navigator.onLine) return;
      if (!(await sitzungAbwarten())) return;
      const verbunden = await verbindungPruefen();
      const { data } = await supabase.from("received_points").select("t").order("t", { ascending: false }).limit(1).maybeSingle();
      const t = data?.t ? Date.parse(data.t as string) : null;
      if (lebt) setStatus({ verbunden, letzter: t });
    };
    void fragenServer();
    const takt = window.setInterval(() => void fragenServer(), 5 * 60_000);
    const zurueck = () => document.visibilityState === "visible" && void fragenServer();
    document.addEventListener("visibilitychange", zurueck);
    window.addEventListener(ANDERE_GEAENDERT, fragenServer);
    return () => {
      lebt = false;
      window.clearInterval(takt);
      document.removeEventListener("visibilitychange", zurueck);
      window.removeEventListener(ANDERE_GEAENDERT, fragenServer);
    };
  }, []);
  return status;
}

/** "vor 12 Min.", "13:49", "gestern 23:10", "20. Nov., 18:40". */
const uhr = new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit" });
const tagUhr = new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
export function zeitText(t: number): string {
  const min = Math.round((Date.now() - t) / 60_000);
  if (min < 60) return `vor ${Math.max(1, min)} Min.`;
  const tage = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(t).setHours(0, 0, 0, 0)) / 86400_000);
  return tage === 0 ? uhr.format(t) : tage === 1 ? `gestern ${uhr.format(t)}` : tagUhr.format(t);
}


let holt = false;

/** Waits up to 10 s for the sign-in (right after opening it may not be ready yet). */
async function sitzungAbwarten(): Promise<string | null> {
  for (let i = 0; i < 20; i++) {
    const jwt = (await supabase.auth.getSession()).data.session?.access_token;
    if (jwt) return jwt;
    await new Promise((r) => setTimeout(r, 500));
  }
  return null;
}

/** Fetches new points from the receiver (in the background worker). Returns how many came in. */
export async function overlandAbholen(daten: Regionen): Promise<number> {
  if (holt || !navigator.onLine) return 0;
  holt = true;
  try {
    const jwt = await sitzungAbwarten();
    if (!jwt || !(await verbindungPruefen())) return 0;
    const a = await fragen<"abgeholt">({
      typ: "overlandAbholen",
      url: SUPABASE_URL,
      schluessel: SUPABASE_PUBLISHABLE_KEY,
      jwt,
      seit: localStorage.getItem(OVERLAND_SEIT),
      liste: daten.liste,
    }).antwort;
    if (a.fehler) return 0;
    if (a.bis) localStorage.setItem(OVERLAND_SEIT, a.bis);
    localStorage.setItem(OVERLAND_ZULETZT, String(Date.now()));
    if (a.punkte > 0) andereGeaendert();
    return a.punkte;
  } finally {
    holt = false;
  }
}

/** Fetches Overland points when the app starts, comes back to the front, and every 5 minutes while open. */
export function useOverlandAbholen(daten: Regionen | null, danach?: () => void) {
  const danachRef = useRef(danach);
  danachRef.current = danach;
  useEffect(() => {
    if (!daten) return;
    // After each fetch on opening or coming back, the replay looks for new outings.
    const los = (geoeffnet: boolean) => {
      if (document.visibilityState !== "visible") return;
      void overlandAbholen(daten).finally(() => {
        if (geoeffnet) danachRef.current?.();
      });
    };
    const zurueck = () => los(true);
    los(true);
    const takt = window.setInterval(() => los(false), 5 * 60_000);
    document.addEventListener("visibilitychange", zurueck);
    return () => {
      window.clearInterval(takt);
      document.removeEventListener("visibilitychange", zurueck);
    };
  }, [daten]);
}

/** Other outings that ended after a point in time, shortened for the replay (from the worker). */
export async function wegeSeit(seit: number): Promise<KurzWeg[]> {
  return (await fragen<"wege">({ typ: "wegeSeit", seit }).antwort).wege;
}
