/**
 * Zeitreise (Bauplan 3, F3): the plan as it was on an earlier day. Based on the first time each
 * piece was walked, which is stored already.
 */

export interface Zeitleiste {
  /** Times, sorted, and the meters walked up to and including each one. */
  t: Float64Array;
  summe: Float64Array;
}

/** Sorted times with running totals, so the meters on any day are found quickly while dragging. */
export function zeitleiste(eintraege: readonly { t: number; m: number }[]): Zeitleiste {
  const sortiert = [...eintraege].sort((a, b) => a.t - b.t);
  const t = new Float64Array(sortiert.length);
  const summe = new Float64Array(sortiert.length);
  let s = 0;
  sortiert.forEach((e, i) => {
    s += e.m;
    t[i] = e.t;
    summe[i] = s;
  });
  return { t, summe };
}

/** Meters first walked up to (and including) a moment. */
export function meterBis(z: Zeitleiste, bis: number): number {
  let lo = 0;
  let hi = z.t.length;
  while (lo < hi) {
    const mitte = (lo + hi) >> 1;
    if (z.t[mitte]! <= bis) lo = mitte + 1;
    else hi = mitte;
  }
  return lo === 0 ? 0 : z.summe[lo - 1]!;
}

/** The first day (local midnight) of every month after `von` up to `bis`. */
export function monatsAnfaenge(von: number, bis: number): number[] {
  const out: number[] = [];
  const d = new Date(von);
  let m = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
  while (m <= bis) {
    out.push(m);
    const n = new Date(m);
    m = new Date(n.getFullYear(), n.getMonth() + 1, 1).getTime();
  }
  return out;
}

/** Within two days of a month start, the slider snaps to it; in between it moves freely. */
export function einrasten(t: number, anfaenge: readonly number[], fangM = 2 * 86_400_000): number {
  let best: number | null = null;
  for (const a of anfaenge) if (Math.abs(a - t) <= fangM && (best === null || Math.abs(a - t) < Math.abs(best - t))) best = a;
  return best ?? t;
}
