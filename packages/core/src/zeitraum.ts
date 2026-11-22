/** Periods for the Rückblicke tiles (Bauplan 3, F2), in local time. */

export interface Zeitraum {
  von: number;
  /** Start of the next period (exclusive). */
  bis: number;
}

/** This week, Monday to Sunday. */
export function woche(jetzt: number): Zeitraum {
  const d = new Date(jetzt);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  const von = d.getTime();
  d.setDate(d.getDate() + 7);
  return { von, bis: d.getTime() };
}

export function monat(jetzt: number): Zeitraum {
  const d = new Date(jetzt);
  return { von: new Date(d.getFullYear(), d.getMonth(), 1).getTime(), bis: new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime() };
}

export function jahr(jetzt: number): Zeitraum {
  const y = new Date(jetzt).getFullYear();
  return { von: new Date(y, 0, 1).getTime(), bis: new Date(y + 1, 0, 1).getTime() };
}

export function vormonat(jetzt: number): Zeitraum {
  const d = new Date(jetzt);
  return monat(new Date(d.getFullYear(), d.getMonth() - 1, 15).getTime());
}

/** Past months (not the running one) back to the month of `erster`, newest first. */
export function monateZurueck(erster: number, jetzt: number): Zeitraum[] {
  const out: Zeitraum[] = [];
  let m = vormonat(jetzt);
  while (m.bis > erster) {
    out.push(m);
    m = vormonat(m.von);
  }
  return out;
}
