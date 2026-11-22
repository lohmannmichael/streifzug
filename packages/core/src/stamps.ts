/**
 * Stamps (docs/PLAN.md, section 6.5). Worked out from the stored progress, also afterwards.
 * A stamp once given is never taken away; the caller keeps the given ones and passes them in.
 */

export type StempelArt =
  | "betreten"
  | "ort"
  | "land"
  | "prozent"
  | "veedel-anzahl"
  | "orte-anzahl"
  | "laender-anzahl"
  | "strassen-komplett"
  | "bezirk-rundum"
  | "stadt-rundum"
  | "km-neu";

export interface Stempel {
  /** Stable key, e.g. "prozent:<veedel>:25" or "km-neu:50". */
  id: string;
  art: StempelArt;
  /** Area the stamp belongs to (Veedel, district or city), if any. */
  gebietId: string | null;
  /** Threshold (percent, count or km), if any. */
  stufe: number | null;
  /** Name for stamps without an area: a place without data yet, or a country code ("DE"). */
  name?: string;
  /** When it was first earned (first walk in the place or country); the stamp shows this date. */
  seit?: number;
}

/** A place with at least one walked meter (Bauplan 3, F7), with or without quarter data. */
export interface OrtBetreten {
  /** Stable key: the area id of the whole place, or "name:<Name>" for a place without data. */
  schluessel: string;
  gebietId: string | null;
  name?: string;
  /** Country code ("DE"); missing when not known (places without data). */
  land?: string;
  /** First walk there. */
  seit?: number;
}

export const VEEDEL_PROZENT = [10, 25, 50, 75, 100] as const;
/** Entered Veedel per place; the last step is "alle" (every Veedel of that place, Bauplan 3, D3). */
export const VEEDEL_ANZAHL = [5, 10, 25, 50] as const;
/** Places with at least one walked meter, and countries, over everything. */
export const ORTE_ANZAHL = [5, 10, 25, 50] as const;
export const LAENDER_ANZAHL = [2, 3, 5, 10] as const;
export const STRASSEN_KOMPLETT = [10, 50, 100, 250, 500] as const;
export const KM_NEU = [10, 50, 100, 250, 500] as const;

export interface VeedelStand {
  id: string;
  /** Meters walked or cycled ("aktiv") and meters that count in total. */
  aktivM: number;
  gesamtM: number;
}

/** A district or city: its Veedel (smallest areas), for "rundum" stamps. */
export interface Gruppe {
  id: string;
  art: "bezirk" | "stadt";
  veedel: string[];
}

export interface Stand {
  veedel: VeedelStand[];
  gruppen: Gruppe[];
  strassenKomplett: number;
  aktivKmGesamt: number;
  /** Places with at least one walked meter (also those without data yet), and their countries. */
  orte?: number;
  laender?: number;
  /** The walked places themselves, for one stamp per place and per country (Bauplan 3, F7). */
  orteBetreten?: OrtBetreten[];
}

const prozent = (v: VeedelStand) => (v.gesamtM > 0 ? (v.aktivM / v.gesamtM) * 100 : 0);

/** Every stamp the current state has earned (given or not). */
export function verdienteStempel(s: Stand): Stempel[] {
  const out: Stempel[] = [];
  const betreten = new Set<string>();
  for (const v of s.veedel) {
    if (v.aktivM <= 0) continue;
    betreten.add(v.id);
    out.push({ id: `betreten:${v.id}`, art: "betreten", gebietId: v.id, stufe: null });
    const p = prozent(v);
    for (const stufe of VEEDEL_PROZENT) if (p >= stufe - 1e-9) out.push({ id: `prozent:${v.id}:${stufe}`, art: "prozent", gebietId: v.id, stufe });
  }
  // Per place (city group): 5, 10, 25, 50 entered Veedel, and "alle" instead of "Stadt rundum".
  for (const g of s.gruppen) {
    if (g.art !== "stadt" || g.veedel.length === 0) continue;
    const drin = g.veedel.filter((id) => betreten.has(id)).length;
    for (const stufe of VEEDEL_ANZAHL)
      if (stufe < g.veedel.length && drin >= stufe) out.push({ id: `veedel-anzahl:${g.id}:${stufe}`, art: "veedel-anzahl", gebietId: g.id, stufe });
    if (drin === g.veedel.length) out.push({ id: `veedel-anzahl:${g.id}:alle`, art: "veedel-anzahl", gebietId: g.id, stufe: g.veedel.length });
  }
  // One stamp per walked place and one per country, dated with the first walk there (Bauplan 3, F7).
  const laender = new Map<string, number | undefined>();
  for (const o of s.orteBetreten ?? []) {
    out.push({ id: `ort:${o.schluessel}`, art: "ort", gebietId: o.gebietId, stufe: null, ...(o.name ? { name: o.name } : {}), ...(o.seit !== undefined ? { seit: o.seit } : {}) });
    if (!o.land) continue;
    const bisher = laender.get(o.land);
    laender.set(o.land, bisher === undefined ? o.seit : o.seit === undefined ? bisher : Math.min(bisher, o.seit));
  }
  for (const [land, seit] of laender) out.push({ id: `land:${land}`, art: "land", gebietId: null, stufe: null, name: land, ...(seit !== undefined ? { seit } : {}) });
  for (const stufe of ORTE_ANZAHL) if ((s.orte ?? 0) >= stufe) out.push({ id: `orte-anzahl:${stufe}`, art: "orte-anzahl", gebietId: null, stufe });
  for (const stufe of LAENDER_ANZAHL) if ((s.laender ?? 0) >= stufe) out.push({ id: `laender-anzahl:${stufe}`, art: "laender-anzahl", gebietId: null, stufe });
  for (const stufe of STRASSEN_KOMPLETT) if (s.strassenKomplett >= stufe) out.push({ id: `strassen-komplett:${stufe}`, art: "strassen-komplett", gebietId: null, stufe });
  for (const stufe of KM_NEU) if (s.aktivKmGesamt >= stufe) out.push({ id: `km-neu:${stufe}`, art: "km-neu", gebietId: null, stufe });
  for (const g of s.gruppen)
    if (g.art === "bezirk" && g.veedel.length > 0 && g.veedel.every((id) => betreten.has(id)))
      out.push({ id: `bezirk-rundum:${g.id}`, art: "bezirk-rundum", gebietId: g.id, stufe: null });
  return out;
}

/** Stamps earned but not given yet (to be stamped by hand, Bauplan 5.2). */
export function faelligeStempel(s: Stand, vergeben: ReadonlySet<string>): Stempel[] {
  return verdienteStempel(s).filter((x) => !vergeben.has(x.id));
}

/**
 * What the passport shows (Bauplan 3, D3): per Veedel only the highest percent stamp, and
 * "betreten" only while no percent stamp is reached. All given stamps stay stored.
 */
export function besteStempel<T extends Stempel>(gegeben: readonly T[]): T[] {
  const besterProzent = new Map<string, T>();
  for (const s of gegeben)
    if (s.art === "prozent" && s.gebietId && (s.stufe ?? 0) > (besterProzent.get(s.gebietId)?.stufe ?? -1)) besterProzent.set(s.gebietId, s);
  return gegeben.filter((s) => {
    if (s.art === "prozent") return s.gebietId ? besterProzent.get(s.gebietId) === s : true;
    if (s.art === "betreten") return !s.gebietId || !besterProzent.has(s.gebietId);
    return true;
  });
}

/**
 * Old Veedel counts ("veedel-anzahl:<n>", from before places had their own) belong to the place
 * Köln (Bauplan 3, D3); 86 was "all of Köln". Nothing is dropped; when the new key exists already,
 * the earlier date wins.
 */
export function stempelUmstellen<T extends Stempel & { gestempeltAm: number }>(gegeben: readonly T[], koelnId: string): T[] {
  const jeId = new Map<string, T>();
  for (const s of gegeben) {
    const alt = /^veedel-anzahl:(\d+)$/.exec(s.id);
    const neu: T = alt ? { ...s, id: `veedel-anzahl:${koelnId}:${alt[1] === "86" ? "alle" : alt[1]}`, gebietId: koelnId } : s;
    const da = jeId.get(neu.id);
    if (!da || neu.gestempeltAm < da.gestempeltAm) jeId.set(neu.id, neu);
  }
  return [...jeId.values()];
}
