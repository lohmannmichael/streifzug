/**
 * Polaroid on opening (Michi, 25.11.2026): what came in since the last visit, as pictures one
 * after another. Several days: one picture per day, oldest first. One day: one picture per way.
 * Everything first walked within a picture's time counts as new in it.
 */
export interface PolaroidWeg {
  startedAt: number;
  endedAt: number;
  distanceM: number;
  /** Share of the way (0..1) that was a car, bus or train ride. */
  gefahrenAnteil: number;
}

export interface Station {
  /** Indices of the ways in this picture (in the order walked). */
  wege: number[];
  /** Start of the picture's local day (for the date). */
  tag: number;
  /** New is what was first walked from `seit` until `bis` (the next picture's start). */
  seit: number;
  bis: number;
  /** One picture per day (several days) or per way (one day). */
  art: "tag" | "weg";
  distanceM: number;
}

const lokalerTag = (t: number) => new Date(t).setHours(0, 0, 0, 0);

export function polaroidStationen(wege: readonly PolaroidWeg[], tagBeginn: (t: number) => number = lokalerTag): Station[] {
  const order = wege.map((_, i) => i).sort((a, b) => wege[a]!.startedAt - wege[b]!.startedAt);
  const tage = new Map<number, number[]>();
  for (const i of order) {
    const tag = tagBeginn(wege[i]!.startedAt);
    tage.set(tag, [...(tage.get(tag) ?? []), i]);
  }
  const gruppen: { tag: number; wege: number[] }[] =
    tage.size > 1 ? [...tage].map(([tag, w]) => ({ tag, wege: w })) : order.map((i) => ({ tag: tagBeginn(wege[i]!.startedAt), wege: [i] }));
  const art = tage.size > 1 ? "tag" : "weg";
  return gruppen.map((g, k) => ({
    wege: g.wege,
    tag: g.tag,
    seit: wege[g.wege[0]!]!.startedAt,
    bis: k + 1 < gruppen.length ? wege[gruppen[k + 1]!.wege[0]!]!.startedAt : Infinity,
    art,
    distanceM: g.wege.reduce((s, i) => s + wege[i]!.distanceM, 0),
  }));
}

/** How a way was mostly made: by car (more than half driven), by bike (over 9 km/h) or on foot. */
export function wegArt(w: PolaroidWeg): "auto" | "rad" | "fuss" {
  if (w.gefahrenAnteil > 0.5) return "auto";
  const s = (w.endedAt - w.startedAt) / 1000;
  return s > 0 && (w.distanceM * (1 - w.gefahrenAnteil)) / s > 2.5 ? "rad" : "fuss";
}
