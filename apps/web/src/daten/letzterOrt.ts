/**
 * The last known own position (Michi, 23.11.2026): the app opens where you last were, not at the
 * area chosen last. Comes from the newest Overland point and from the location button; kept on the
 * device only.
 */
const SCHLUESSEL = "streifzug.letzterOrt";

export interface LetzterOrt {
  punkt: [number, number];
  t: number;
}

export function letzterOrtLesen(): LetzterOrt | null {
  try {
    const o = JSON.parse(localStorage.getItem(SCHLUESSEL) ?? "null") as LetzterOrt | null;
    return o && Array.isArray(o.punkt) && Number.isFinite(o.punkt[0]) && Number.isFinite(o.punkt[1]) ? o : null;
  } catch {
    return null;
  }
}

/** Keeps a position if it is newer than the stored one. Returns whether it was kept. */
export function letzterOrtMerken(punkt: [number, number], t: number): boolean {
  const alt = letzterOrtLesen();
  if (alt && alt.t >= t) return false;
  localStorage.setItem(SCHLUESSEL, JSON.stringify({ punkt, t }));
  return true;
}
