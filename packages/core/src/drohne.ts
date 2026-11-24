/**
 * Replay "Drohne" (Michi, 24.11.2026, second variant next to the calm one in nachfahren.ts): new
 * streets slowly and close, known stretches fast and further out, car rides in time lapse far out.
 * The plan has the same shape as the others (ReplayPlan), so standBei and freigabeZeiten work.
 */
import { distanceM, type LonLat } from "./geo";
import type { ReplayAbschnitt, ReplayArt, ReplayPlan, ReplayWeg } from "./replay";
import { distanceToLineM } from "./ziele";

/** Meters per second before fitting into the time: new slowly, known six times, car 25 times as fast. */
export const DROHNE_TEMPO: Record<ReplayArt, number> = { neu: 90, bekannt: 540, gefahren: 2250 };

/** Total time: 5 s plus 3 s per new kilometre, at most 15 s. */
export function drohnenZiel(neuM: number): number {
  return Math.min(15_000, 5000 + (neuM / 1000) * 3000);
}

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
 * All ways one after another with `flugMs` between two ways (the camera flies there). Speeds
 * after DROHNE_TEMPO, all scaled together so the whole replay takes `zielMs`.
 */
export function planeDrohne(wege: readonly ReplayWeg[], zielMs: number, flugMs = 0): ReplayPlan {
  const meter = wege.map((w) => {
    const m = [0];
    for (let i = 1; i < w.coords.length; i++) m.push(m[i - 1]! + distanceM(w.coords[i - 1]!, w.coords[i]!));
    return m;
  });
  const laeufe = wege.map((w, wi) => {
    const out: { von: number; bis: number; art: ReplayArt }[] = [];
    for (let i = 0; i < w.coords.length - 1; i++) {
      const art = w.arten[i] ?? "bekannt";
      const letzter = out.at(-1);
      if (letzter && letzter.art === art) letzter.bis = meter[wi]![i + 1]!;
      else out.push({ von: meter[wi]![i]!, bis: meter[wi]![i + 1]!, art });
    }
    return out.filter((l) => l.bis > l.von);
  });
  const auswahl = wege.map((_, i) => i).filter((i) => laeufe[i]!.length > 0);
  const natur = (l: { von: number; bis: number; art: ReplayArt }) => ((l.bis - l.von) / DROHNE_TEMPO[l.art]) * 1000;
  const fluege = Math.max(0, auswahl.length - 1) * flugMs;
  const summe = auswahl.reduce((s, i) => s + laeufe[i]!.reduce((t, l) => t + natur(l), 0), 0);
  const faktor = summe > 0 ? Math.max(0.05, zielMs - fluege) / summe : 1;
  const abschnitte: ReplayAbschnitt[] = [];
  let t = 0;
  auswahl.forEach((wi, k) => {
    if (k > 0) t += flugMs;
    for (const l of laeufe[wi]!) {
      const dauer = natur(l) * faktor;
      abschnitte.push({ weg: wi, von: l.von, bis: l.bis, art: l.art, start: t, dauer });
      t += dauer;
    }
  });
  return { abschnitte, wege: auswahl, dauer: t, meter };
}
