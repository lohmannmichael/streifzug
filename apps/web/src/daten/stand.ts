import type { Fortschritt } from "./fortschritt";
import { supabase } from "./supabase";

/**
 * The last calculated state, kept on the device so the plan shows it at once when the app opens
 * (Bauplan 3, E3: a year of ways took almost 5 s before anything was yellow). The background
 * worker then only adds what is new. Kept per account: after signing in as someone else it is
 * not used.
 */
const DB = "streifzug-stand";
const STORE = "stand";
const SCHLUESSEL = "letzter";

interface Gespeichert {
  konto: string;
  stand: Omit<Fortschritt, "proGebiet" | "abzug"> & { proGebiet: [string, unknown][]; abzug: [string, unknown][] };
}

function oeffnen(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function auftrag<T>(modus: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await oeffnen();
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = fn(db.transaction(STORE, modus).objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

/** Account of the stored sign-in (read from the device, no network). */
const kontoJetzt = async () => (await supabase.auth.getSession()).data.session?.user.id ?? null;

export async function standLaden(): Promise<Fortschritt | null> {
  try {
    const konto = await kontoJetzt();
    const g = await auftrag<Gespeichert | undefined>("readonly", (s) => s.get(SCHLUESSEL) as IDBRequest<Gespeichert | undefined>);
    if (!g || !konto || g.konto !== konto) return null;
    return { ...g.stand, proGebiet: new Map(g.stand.proGebiet) as Fortschritt["proGebiet"], abzug: new Map(g.stand.abzug) as Fortschritt["abzug"] };
  } catch {
    return null;
  }
}

let uhr = 0;
let zuletzt = 0;
let offen: Fortschritt | null = null;

async function schreiben() {
  window.clearTimeout(uhr);
  const f = offen;
  offen = null;
  if (!f) return;
  zuletzt = Date.now();
  try {
    const konto = await kontoJetzt();
    if (!konto) return;
    const g: Gespeichert = { konto, stand: { ...f, proGebiet: [...f.proGebiet], abzug: [...f.abzug] } };
    await auftrag("readwrite", (s) => s.put(g, SCHLUESSEL));
  } catch {
    // Without storage the app just calculates on every start, as before.
  }
}

/**
 * Saves the state: at once, but at most every 5 seconds (while recording it changes often);
 * what is still waiting is saved when the app goes to the background.
 */
export function standMerken(f: Fortschritt) {
  offen = f;
  window.clearTimeout(uhr);
  const warten = zuletzt + 5000 - Date.now();
  if (warten <= 0) void schreiben();
  else uhr = window.setTimeout(() => void schreiben(), warten);
}

if (typeof document !== "undefined")
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void schreiben();
  });

/** Forgets the state (signing out). */
export async function standVergessen() {
  window.clearTimeout(uhr);
  offen = null;
  try {
    await auftrag("readwrite", (s) => s.delete(SCHLUESSEL));
  } catch {
    // Nothing stored.
  }
}
