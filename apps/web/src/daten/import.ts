import { density, parseGoogleTimeline, parseGpx, splitOutings, summarizeImported, type Fix } from "@streifzug/core";
import type { Regionen } from "./regionen";
import { alleLaden, loeschen, melden, speichern, type Quelle, type Streifzug } from "./speicher";

/** What a file holds, shown before anything is saved. */
export interface ImportVorschau {
  quelle: Exclude<Quelle, "aufnahme">;
  wege: Streifzug[];
  km: { fuss: number; rad: number; auto: number };
  /** Share of point pairs dense enough to be matched to streets (0–1). */
  dichte: number;
  von: number | null;
  bis: number | null;
  /** Points found in the file at all (also outside the built regions). */
  punkteGesamt: number;
}

/** Only points in or near a built region count; the rest of the world is left out (less data, faster). */
function inRegionen(fixes: Fix[], daten: Regionen): Fix[] {
  const rand = 0.01;
  return fixes.filter((f) => daten.liste.some((r) => f.lon >= r.bbox[0] - rand && f.lon <= r.bbox[2] + rand && f.lat >= r.bbox[1] - rand && f.lat <= r.bbox[3] + rand));
}

function vorschau(quelle: ImportVorschau["quelle"], fixes: Fix[], daten: Regionen): ImportVorschau {
  const teile = splitOutings(inRegionen(fixes, daten));
  const km = { fuss: 0, rad: 0, auto: 0 };
  const wege = teile.map((t): Streifzug => {
    const sum = summarizeImported(t);
    km[sum.mode === "foot" ? "fuss" : sum.mode === "bike" ? "rad" : "auto"] += sum.distanceM / 1000;
    // Same id for the same outing when a file is imported again, so nothing is doubled.
    return { id: `${quelle}:${t[0]!.t}`, startedAt: t[0]!.t, endedAt: t.at(-1)!.t, fixes: t, distanceM: sum.distanceM, mode: sum.mode, status: "importiert", quelle };
  });
  return { quelle, wege, km, dichte: density(teile), von: teile[0]?.[0]?.t ?? null, bis: teile.at(-1)?.at(-1)?.t ?? null, punkteGesamt: fixes.length };
}

/** Reads a Google Maps Timeline export (iPhone, Android or old Takeout). Throws with a German message if it is not one. */
export async function googleLesen(datei: File, daten: Regionen): Promise<ImportVorschau> {
  let json: unknown;
  try {
    json = JSON.parse(await datei.text());
  } catch {
    throw new Error("Die Datei ist keine JSON-Datei. Bitte die Datei aus „Zeitachsendaten exportieren“ wählen.");
  }
  const fixes = parseGoogleTimeline(json);
  if (fixes.length === 0) throw new Error("In der Datei stehen keine Wege. Ist das der Export der Google-Zeitachse?");
  return vorschau("google", fixes, daten);
}

/** Reads one or more GPX files (e.g. Apple Health workout routes). */
export async function gpxLesen(dateien: File[], daten: Regionen): Promise<ImportVorschau> {
  const fixes: Fix[] = [];
  for (const d of dateien) fixes.push(...parseGpx(await d.text()));
  if (fixes.length === 0) throw new Error("In den Dateien stehen keine Wege mit Zeitangaben.");
  fixes.sort((a, b) => a.t - b.t);
  return vorschau("gpx", fixes, daten);
}

export async function uebernehmen(v: ImportVorschau): Promise<void> {
  for (const s of v.wege) await speichern(s);
  melden();
}

/** Removes everything imported from one source (own recordings stay). */
export async function importeLoeschen(quelle: ImportVorschau["quelle"]): Promise<void> {
  for (const s of await alleLaden()) if (s.quelle === quelle) await loeschen(s.id);
  melden();
}
