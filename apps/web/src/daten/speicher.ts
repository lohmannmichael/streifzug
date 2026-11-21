import type { Fix, Mode } from "@streifzug/core";

export type Quelle = "aufnahme" | ImportQuelle;
/** Outings that come from elsewhere: imported files or Overland (automatic background recording). */
export type ImportQuelle = "google" | "gpx" | "overland";

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
  /** Stored matching result: ids of the street pieces this outing covered, valid for `stueckIdsGueltig`. */
  stueckIds?: string[];
  stueckIdsGueltig?: string;
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

/**
 * Own outings have UUIDs (0-9, a-f); imported ones "google:…", "gpx:…", "overland:…". So the page
 * loads only its own outings (key range below "g"); the others (possibly thousands) are handled
 * by the background worker only, so the page never freezes.
 */
const EIGENE = () => IDBKeyRange.upperBound("g", true);
export const importBereich = (quelle: ImportQuelle) => IDBKeyRange.bound(`${quelle}:`, `${quelle}:\uffff`);

export const speichern = (s: Streifzug) => auftrag("readwrite", (st) => st.put(s)).then(() => undefined);
/** Own outings only (recorded in Streifzug). */
export const alleLaden = () => auftrag<Streifzug[]>("readonly", (st) => st.getAll(EIGENE()));
export const loeschen = (id: string) => auftrag("readwrite", (st) => st.delete(id)).then(() => undefined);
export const einenLaden = (id: string) => auftrag<Streifzug | undefined>("readonly", (st) => st.get(id) as IDBRequest<Streifzug | undefined>);

/** All outings of the given sources (used by the background worker). */
export async function importeLaden(quellen: ImportQuelle[]): Promise<Streifzug[]> {
  const teile = await Promise.all(quellen.map((q) => auftrag<Streifzug[]>("readonly", (st) => st.getAll(importBereich(q)))));
  return teile.flat();
}

/** Deletes all outings of a source without loading them (fast, also with huge imports). */
export const importeEntfernen = (quelle: ImportQuelle) => auftrag("readwrite", (st) => st.delete(importBereich(quelle))).then(() => undefined);

/** Saves many outings in one transaction. */
export async function vieleSpeichern(liste: Streifzug[]): Promise<void> {
  if (liste.length === 0) return;
  const tx = (await oeffnen()).transaction(STORE, "readwrite");
  const st = tx.objectStore(STORE);
  for (const s of liste) st.put(s);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Lets other parts of the app (list, map) know that something changed. */
export const AENDERUNG = "streifzug-aenderung";
export const melden = () => window.dispatchEvent(new Event(AENDERUNG));

/** Keeps matching results with their outings, in one transaction (does not notify: nothing visible changes). */
export async function ergebnisseMerken(liste: { id: string; ids: string[]; gueltig: string }[]): Promise<void> {
  if (liste.length === 0) return;
  const tx = (await oeffnen()).transaction(STORE, "readwrite");
  const st = tx.objectStore(STORE);
  for (const e of liste) {
    const req = st.get(e.id) as IDBRequest<Streifzug | undefined>;
    req.onsuccess = () => {
      if (req.result) st.put({ ...req.result, stueckIds: e.ids, stueckIdsGueltig: e.gueltig });
    };
  }
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
