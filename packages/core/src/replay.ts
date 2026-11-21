/**
 * Replay "Stift von oben" (docs/PLAN.md, section 5.1): the pen runs along the new ways.
 * Everything is planned up front (durations, which ways), so each frame only looks up a time.
 */
import { distanceM, type LonLat } from "./geo";
import { distanceToLineM } from "./ziele";

/** What a part of a way is: new streets (drawn slowly), known ones (glide fast), driven (pen line, very fast). */
export type ReplayArt = "neu" | "bekannt" | "gefahren";

export interface ReplayWeg {
  coords: LonLat[];
  /** One entry per segment (coords.length - 1). */
  arten: ReplayArt[];
}

export interface ReplayAbschnitt {
  weg: number;
  /** Meters along the way. */
  von: number;
  bis: number;
  art: ReplayArt;
  /** Start and duration in ms from the start of the replay. */
  start: number;
  dauer: number;
}

export interface ReplayPlan {
  abschnitte: ReplayAbschnitt[];
  /** Ways shown, in order. */
  wege: number[];
  dauer: number;
  /** Cumulative meters per coordinate, per way. */
  meter: number[][];
}

/** Meters per second (two blocks a second for new streets; known 5×, driven 10×). */
export const REPLAY_TEMPO: Record<ReplayArt, number> = { neu: 120, bekannt: 600, gefahren: 1200 };
export const REPLAY_BUDGET_MS = 20_000;
/** Pen lifts, short cross-fade, pen sets down again (between two ways and at the start). */
export const REPLAY_WECHSEL_MS = 450;
const BEKANNT_MAX = 3000;

interface Lauf {
  von: number;
  bis: number;
  art: ReplayArt;
}

function laeufe(w: ReplayWeg, meter: number[]): Lauf[] {
  const out: Lauf[] = [];
  for (let i = 0; i < w.coords.length - 1; i++) {
    const art = w.arten[i] ?? "bekannt";
    const letzter = out.at(-1);
    if (letzter && letzter.art === art) letzter.bis = meter[i + 1]!;
    else out.push({ von: meter[i]!, bis: meter[i + 1]!, art });
  }
  return out.filter((l) => l.bis > l.von);
}

function kumuliert(coords: LonLat[]): number[] {
  const m = [0];
  for (let i = 1; i < coords.length; i++) m.push(m[i - 1]! + distanceM(coords[i - 1]!, coords[i]!));
  return m;
}

/** Plans the replay within the time budget (Bauplan 5.1, point 5). */
export function planeRueckblick(wege: readonly ReplayWeg[], budget = REPLAY_BUDGET_MS): ReplayPlan {
  const meter = wege.map((w) => kumuliert(w.coords));
  const jeWeg = wege.map((w, i) => laeufe(w, meter[i]!));
  const neuM = jeWeg.map((ls) => ls.reduce((s, l) => s + (l.art === "neu" ? l.bis - l.von : 0), 0));
  const dauerVon = (auswahl: number[], tempo: Record<ReplayArt, number>) =>
    auswahl.reduce((s, i) => s + REPLAY_WECHSEL_MS + jeWeg[i]!.reduce((t, l) => t + ((l.bis - l.von) / tempo[l.art]) * 1000, 0), 0);

  let auswahl = wege.map((_, i) => i).filter((i) => jeWeg[i]!.length > 0);
  const tempo = { ...REPLAY_TEMPO };
  // 1. Glide faster over known streets.
  if (dauerVon(auswahl, tempo) > budget) {
    tempo.bekannt = BEKANNT_MAX;
    tempo.gefahren = Math.max(tempo.gefahren, BEKANNT_MAX * 2);
  }
  // 2. Leave out ways without anything new.
  if (dauerVon(auswahl, tempo) > budget && auswahl.some((i) => neuM[i]! > 0)) auswahl = auswahl.filter((i) => neuM[i]! > 0);
  // 3. Only the three ways with the most new meters (in their order).
  if (dauerVon(auswahl, tempo) > budget && auswahl.length > 3) {
    const beste = new Set([...auswahl].sort((a, b) => neuM[b]! - neuM[a]!).slice(0, 3));
    auswahl = auswahl.filter((i) => beste.has(i));
  }
  // 4. Still too long: everything a little faster.
  const roh = dauerVon(auswahl, tempo);
  const faktor = roh > budget ? (roh - auswahl.length * REPLAY_WECHSEL_MS) / Math.max(1, budget - auswahl.length * REPLAY_WECHSEL_MS) : 1;
  if (faktor > 1) for (const k of Object.keys(tempo) as ReplayArt[]) tempo[k] *= faktor;

  const abschnitte: ReplayAbschnitt[] = [];
  let t = 0;
  for (const i of auswahl) {
    t += REPLAY_WECHSEL_MS;
    for (const l of jeWeg[i]!) {
      const dauer = ((l.bis - l.von) / tempo[l.art]) * 1000;
      abschnitte.push({ weg: i, von: l.von, bis: l.bis, art: l.art, start: t, dauer });
      t += dauer;
    }
  }
  return { abschnitte, wege: auswahl, dauer: t, meter };
}

export interface ReplayStand {
  /** Index of the way (in the input), -1 before the first. */
  weg: number;
  /** Meters along that way. */
  m: number;
  punkt: LonLat;
  /** Direction of travel in degrees (0 = north, clockwise). */
  richtung: number;
  art: ReplayArt;
  /** Pen lifted (between ways). */
  abgehoben: boolean;
  fertig: boolean;
}

/** Point at a distance along a line, with the direction there. */
export function punktBei(coords: readonly LonLat[], meter: readonly number[], m: number): { punkt: LonLat; richtung: number } {
  let i = 0;
  while (i < meter.length - 2 && meter[i + 1]! < m) i++;
  const a = coords[i]!;
  const b = coords[Math.min(i + 1, coords.length - 1)]!;
  const len = meter[i + 1]! - meter[i]! || 1;
  const f = Math.min(1, Math.max(0, (m - meter[i]!) / len));
  const punkt: LonLat = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
  const dx = (b[0] - a[0]) * Math.cos((a[1] * Math.PI) / 180);
  const dy = b[1] - a[1];
  return { punkt, richtung: ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360 };
}

/** Where the pen is at time t (ms). */
export function standBei(plan: ReplayPlan, wege: readonly ReplayWeg[], t: number): ReplayStand {
  const ab = plan.abschnitte;
  if (ab.length === 0) return { weg: -1, m: 0, punkt: [0, 0], richtung: 0, art: "bekannt", abgehoben: true, fertig: true };
  let k = ab.findIndex((a) => t < a.start + a.dauer);
  const fertig = k === -1 || t >= plan.dauer;
  if (k === -1) k = ab.length - 1;
  const a = ab[k]!;
  const vorStart = t < a.start;
  const f = fertig ? 1 : vorStart ? 0 : (t - a.start) / (a.dauer || 1);
  const m = a.von + (a.bis - a.von) * f;
  const { punkt, richtung } = punktBei(wege[a.weg]!.coords, plan.meter[a.weg]!, m);
  return { weg: a.weg, m, punkt, richtung, art: a.art, abgehoben: vorStart || fertig || a.art === "bekannt", fertig };
}

/**
 * When each new street piece turns yellow: the first place on a shown way within `radiusM`
 * of the piece. Pieces no way reaches get Infinity (shown at the end).
 */
export function freigabeZeiten(plan: ReplayPlan, wege: readonly ReplayWeg[], stuecke: readonly { id: string; coords: LonLat[] }[], radiusM = 30): Map<string, number> {
  const out = new Map<string, number>();
  for (const s of stuecke) {
    let best = Infinity;
    for (const a of plan.abschnitte) {
      if (a.start >= best) break;
      const w = wege[a.weg]!;
      const m = plan.meter[a.weg]!;
      for (let i = 0; i < w.coords.length; i++) {
        if (m[i]! < a.von - 1 || m[i]! > a.bis + 1) continue;
        if (distanceToLineM(w.coords[i]!, s.coords) <= radiusM) {
          best = Math.min(best, a.start + ((m[i]! - a.von) / Math.max(1, a.bis - a.von)) * a.dauer);
          break;
        }
      }
    }
    out.set(s.id, best);
  }
  return out;
}
