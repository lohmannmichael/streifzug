/**
 * Rückblick "näher heran, nachfahren" (Bauplan 3, F1): each way on its own, in order, at an even
 * pace on screen; car rides eight times as fast. The plan has the same shape as the old replay
 * (ReplayPlan), so the pen position (standBei) and the yellow release (freigabeZeiten) are reused.
 */
import { distanceM } from "./geo";
import { splitLegs, type Korrektur } from "./legs";
import type { ReplayAbschnitt, ReplayArt, ReplayPlan, ReplayWeg } from "./replay";
import type { Fix } from "./track";

/** Meters per second: about 200 screen pixels a second at zoom 16; car rides eight times as fast. */
export const NACHFAHREN_TEMPO: Record<ReplayArt, number> = { neu: 150, bekannt: 150, gefahren: 1200 };
export const NACHFAHREN_BUDGET_MS = 20_000;
/** At least this long per way: with new streets, without. */
export const MIN_MIT_NEUEM_MS = 2000;
export const MIN_OHNE_NEUES_MS = 1000;

/**
 * Plans all ways one after another (hard cut, no pause). Each way gets its natural time at an
 * even pace, at least 2 s (with new streets) or 1 s; together at most `budget`: if needed, every
 * way runs faster. If even the minimums do not fit, they are shared out.
 */
export function planeNachfahren(wege: readonly ReplayWeg[], mitNeuem: readonly boolean[], budget = NACHFAHREN_BUDGET_MS): ReplayPlan {
  const meter = wege.map((w) => {
    const m = [0];
    for (let i = 1; i < w.coords.length; i++) m.push(m[i - 1]! + distanceM(w.coords[i - 1]!, w.coords[i]!));
    return m;
  });
  // Runs of the same kind per way, with their natural duration.
  const laeufe = wege.map((w, wi) => {
    const out: { von: number; bis: number; art: ReplayArt; natur: number }[] = [];
    for (let i = 0; i < w.coords.length - 1; i++) {
      const art: ReplayArt = w.arten[i] === "gefahren" ? "gefahren" : "neu";
      const von = meter[wi]![i]!;
      const bis = meter[wi]![i + 1]!;
      const letzter = out.at(-1);
      if (letzter && letzter.art === art) letzter.bis = bis;
      else out.push({ von, bis, art, natur: 0 });
    }
    for (const l of out) l.natur = ((l.bis - l.von) / NACHFAHREN_TEMPO[l.art]) * 1000;
    return out.filter((l) => l.bis > l.von);
  });
  const auswahl = wege.map((_, i) => i).filter((i) => laeufe[i]!.length > 0);
  const natur = auswahl.map((i) => laeufe[i]!.reduce((s, l) => s + l.natur, 0));
  const mindest = auswahl.map((i) => (mitNeuem[i] ? MIN_MIT_NEUEM_MS : MIN_OHNE_NEUES_MS));

  let dauer: number[];
  const summeMindest = mindest.reduce((a, b) => a + b, 0);
  if (summeMindest >= budget) dauer = mindest.map((m) => (m * budget) / summeMindest);
  else {
    const mit = (f: number) => natur.map((n, k) => Math.max(mindest[k]!, n / f));
    const summe = (f: number) => mit(f).reduce((a, b) => a + b, 0);
    let f = 1;
    if (summe(1) > budget) {
      let [lo, hi] = [1, 1e7];
      for (let k = 0; k < 60; k++) {
        const m = (lo + hi) / 2;
        if (summe(m) > budget) lo = m;
        else hi = m;
      }
      f = hi;
    }
    dauer = mit(f);
  }

  const abschnitte: ReplayAbschnitt[] = [];
  let t = 0;
  auswahl.forEach((wi, k) => {
    const faktor = dauer[k]! / Math.max(1e-9, natur[k]!);
    for (const l of laeufe[wi]!) {
      const d = l.natur * faktor;
      abschnitte.push({ weg: wi, von: l.von, bis: l.bis, art: l.art, start: t, dauer: d });
      t += d;
    }
  });
  return { abschnitte, wege: auswahl, dauer: t, meter };
}

/** Whether a box ([west, south, east, north]) fits into `breite` × `hoehe` screen pixels at `zoom`. */
export function passtBeiZoom(box: readonly [number, number, number, number], breite: number, hoehe: number, zoom: number): boolean {
  const welt = 512 * 2 ** zoom;
  const x = (lon: number) => (lon + 180) / 360;
  const y = (lat: number) => {
    const s = Math.sin((lat * Math.PI) / 180);
    return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI);
  };
  return (x(box[2]) - x(box[0])) * welt <= breite && (y(box[1]) - y(box[3])) * welt <= hoehe;
}

/** For each fix whether it belongs to a car, bus or train leg (with Michi's corrections). */
export function gefahrenJePunkt(fixes: readonly Fix[], korrekturen: readonly Korrektur[] = []): boolean[] {
  const gefahren = new Set<number>();
  for (const l of splitLegs(fixes, korrekturen)) if (l.art === "gefahren") for (const f of l.fixes) gefahren.add(f.t);
  return fixes.map((f) => gefahren.has(f.t));
}
