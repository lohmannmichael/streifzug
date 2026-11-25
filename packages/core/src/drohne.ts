/**
 * Replay "Drohne" (Michi, 24.11.2026, second variant next to the calm one in nachfahren.ts): new
 * streets slowly and close, known stretches fast and further out, car rides in time lapse far out.
 * The plan has the same shape as the others (ReplayPlan), so standBei and freigabeZeiten work.
 */
import { distanceM, type LonLat } from "./geo";
import type { ReplayAbschnitt, ReplayArt, ReplayPlan, ReplayWeg } from "./replay";
import { distanceToLineM } from "./ziele";

/**
 * Meters per second (Michi, 25.11.2026, second time: "viel zu hektisch, eher ruhig drüber
 * schweben"): one height for everything (zoom 15, see karte/drohne.ts), there new streets go about
 * 60 px/s (1 km in 11 s) and known stretches about 95 px/s. Car rides are not drawn along: the
 * camera flies over them (Infinity = no time in the plan).
 */
export const DROHNE_TEMPO: Record<ReplayArt, number> = { neu: 90, bekannt: 140, gefahren: Infinity };
/** At most this long (without the flights); then known stretches go faster or are left out, new ones last. */
export const DROHNE_DECKEL_MS = 40_000;
/** Known stretches may go at most this much faster before they are left out. */
const SCHNELLER_HOECHSTENS = 2;

/** Kind of each segment: driven (car leg), new (along a newly walked piece, within 20 m) or known. */
export function segmentArten(coords: readonly LonLat[], neu: readonly { coords: readonly LonLat[] }[], gefahren?: readonly boolean[]): ReplayArt[] {
  // Boxes of the new pieces, for a quick test first.
  const boxen = neu.map((p) => {
    let [w, s, o, n] = [Infinity, Infinity, -Infinity, -Infinity];
    for (const [x, y] of p.coords) [w, s, o, n] = [Math.min(w, x), Math.min(s, y), Math.max(o, x), Math.max(n, y)];
    return { p, w: w - 0.0004, s: s - 0.0003, o: o + 0.0004, n: n + 0.0003 };
  });
  const out: ReplayArt[] = [];
  for (let i = 0; i < coords.length - 1; i++) {
    if (gefahren?.[i] && gefahren?.[i + 1]) {
      out.push("gefahren");
      continue;
    }
    const a = coords[i]!;
    const b = coords[i + 1]!;
    const mitte: LonLat = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const istNeu = boxen.some((x) => mitte[0] >= x.w && mitte[0] <= x.o && mitte[1] >= x.s && mitte[1] <= x.n && distanceToLineM(mitte, x.p.coords as LonLat[]) <= 20);
    out.push(istNeu ? "neu" : "bekannt");
  }
  return out;
}

/**
 * All ways one after another with `flugMs` between two ways (the camera flies there), at the
 * speeds of DROHNE_TEMPO; a short day stays short, car rides take no time. Longer than `deckelMs`:
 * known stretches go faster (up to twice), else they are left out (ways without anything new drop
 * out); if new streets alone are still too long, they go faster too.
 */
export function planeDrohne(wege: readonly ReplayWeg[], optionen: { flugMs?: number; deckelMs?: number; tempoFaktor?: number } = {}): ReplayPlan {
  const flugMs = optionen.flugMs ?? 0;
  const deckel = optionen.deckelMs ?? DROHNE_DECKEL_MS;
  // Polaroid (Michi, 25.11.2026: "könnte schon noch schneller sein"): everything this much faster.
  const faktor = optionen.tempoFaktor ?? 1;
  const meter = wege.map((w) => {
    const m = [0];
    for (let i = 1; i < w.coords.length; i++) m.push(m[i - 1]! + distanceM(w.coords[i - 1]!, w.coords[i]!));
    return m;
  });
  const laeufe = wege.map((w, wi) => {
    const out: { von: number; bis: number; art: ReplayArt; dauer: number }[] = [];
    for (let i = 0; i < w.coords.length - 1; i++) {
      const art = w.arten[i] ?? "bekannt";
      const letzter = out.at(-1);
      if (letzter && letzter.art === art) letzter.bis = meter[wi]![i + 1]!;
      else out.push({ von: meter[wi]![i]!, bis: meter[wi]![i + 1]!, art, dauer: 0 });
    }
    const da = out.filter((l) => l.bis > l.von);
    for (const l of da) l.dauer = ((l.bis - l.von) / (DROHNE_TEMPO[l.art] * faktor)) * 1000;
    return da;
  });
  let auswahl = wege.map((_, i) => i).filter((i) => laeufe[i]!.length > 0);
  const summe = (art: (a: ReplayArt) => boolean) => auswahl.reduce((s, i) => s + laeufe[i]!.reduce((t, l) => t + (art(l.art) ? l.dauer : 0), 0), 0);
  const fluege = () => Math.max(0, auswahl.length - 1) * flugMs;
  const neuZeit = () => summe((a) => a === "neu");
  const restZeit = () => summe((a) => a !== "neu");
  const zuViel = neuZeit() + restZeit() + fluege() - deckel;
  if (zuViel > 0) {
    const rest = restZeit();
    const faktor = rest > 0 ? (rest - zuViel) / rest : 0;
    if (faktor >= 1 / SCHNELLER_HOECHSTENS) {
      for (const i of auswahl) for (const l of laeufe[i]!) if (l.art !== "neu") l.dauer *= faktor;
    } else {
      // Left out: known stretches and car rides; ways with nothing new drop out altogether.
      for (const i of auswahl) for (const l of laeufe[i]!) if (l.art !== "neu") l.dauer = 0;
      auswahl = auswahl.filter((i) => laeufe[i]!.some((l) => l.art === "neu"));
      const neu = neuZeit();
      const platz = deckel - fluege();
      if (neu > platz && neu > 0) for (const i of auswahl) for (const l of laeufe[i]!) l.dauer *= Math.max(0.05, platz) / neu;
    }
  }
  const abschnitte: ReplayAbschnitt[] = [];
  let t = 0;
  auswahl.forEach((wi, k) => {
    if (k > 0) t += flugMs;
    for (const l of laeufe[wi]!) {
      abschnitte.push({ weg: wi, von: l.von, bis: l.bis, art: l.art, start: t, dauer: l.dauer });
      t += l.dauer;
    }
  });
  return { abschnitte, wege: auswahl, dauer: t, meter };
}
