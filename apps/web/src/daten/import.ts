import { useEffect, useState } from "react";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "../konfig";
import type { ImportVorschau, QuellenInfo } from "./abgleich.worker";
import { ANDERE_GEAENDERT, andereGeaendert, fragen } from "./arbeiter";
import type { Regionen } from "./regionen";
import type { ImportQuelle } from "./speicher";
import { supabase } from "./supabase";

export type { ImportVorschau, QuellenInfo } from "./abgleich.worker";

/** Reads files in the background and returns a preview (nothing is saved yet). Throws with a German message. */
export async function lesen(quelle: "google" | "gpx", dateien: File[], daten: Regionen): Promise<ImportVorschau> {
  const a = await fragen<"vorschau">({ typ: "importLesen", quelle, dateien, liste: daten.liste }).antwort;
  if (!a.vorschau) throw new Error(a.fehler ?? "Die Datei konnte nicht gelesen werden.");
  return a.vorschau;
}

export async function uebernehmen(quelle: "google" | "gpx"): Promise<void> {
  await fragen<"ok">({ typ: "importUebernehmen", quelle }).antwort;
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
export const overlandZuletzt = () => Number(localStorage.getItem(OVERLAND_ZULETZT) ?? 0) || null;

let holt = false;

/** Fetches new points from the receiver (in the background worker). Returns how many came in. */
export async function overlandAbholen(daten: Regionen): Promise<number> {
  if (holt || !overlandVerbunden() || !navigator.onLine) return 0;
  holt = true;
  try {
    const { data } = await supabase.auth.getSession();
    const jwt = data.session?.access_token;
    if (!jwt) return 0;
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
export function useOverlandAbholen(daten: Regionen | null) {
  useEffect(() => {
    if (!daten) return;
    const los = () => {
      if (document.visibilityState === "visible") void overlandAbholen(daten);
    };
    los();
    const takt = window.setInterval(los, 5 * 60_000);
    document.addEventListener("visibilitychange", los);
    return () => {
      window.clearInterval(takt);
      document.removeEventListener("visibilitychange", los);
    };
  }, [daten]);
}
