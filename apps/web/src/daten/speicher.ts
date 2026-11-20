import type { Fix, Mode } from "@streifzug/core";

export type Quelle = "aufnahme" | "google" | "gpx";

/** A recorded outing as kept on the device. */
export interface Streifzug {
  id: string;
  startedAt: number;
  endedAt: number | null;
  fixes: Fix[];
  distanceM: number;
  mode: Mode;
  /** aktiv: recording; lokal: only on this device; gesichert: uploaded; importiert: from another app, stays on the device. */
  status: "aktiv" | "lokal" | "gesichert" | "importiert";
  /** Where it comes from; missing means recorded in Streifzug. */
  quelle?: Quelle;
}

const DB = "streifzug";
const STORE = "streifzuege";

let db: Promise<IDBDatabase> | null = null;

function oeffnen(): Promise<IDBDatabase> {
  db ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return db;
}

async function auftrag<T>(modus: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const store = (await oeffnen()).transaction(STORE, modus).objectStore(STORE);
  return new Promise((resolve, reject) => {
    const req = fn(store);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const speichern = (s: Streifzug) => auftrag("readwrite", (st) => st.put(s)).then(() => undefined);
export const alleLaden = () => auftrag<Streifzug[]>("readonly", (st) => st.getAll());
export const loeschen = (id: string) => auftrag("readwrite", (st) => st.delete(id)).then(() => undefined);

/** Lets other parts of the app (list, map) know that something changed. */
export const AENDERUNG = "streifzug-aenderung";
export const melden = () => window.dispatchEvent(new Event(AENDERUNG));
