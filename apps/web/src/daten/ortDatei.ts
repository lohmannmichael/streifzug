/**
 * File address of a place's data. The date of the data is part of it, so a rebuilt place gets a new
 * address and the copy kept on the device is never stale (Bauplan 3, E4). Without React, so the
 * background worker can use it too.
 */
export function ortDatei(r: { id: string; stand: string }, datei: string): string {
  return `/regionen/${r.id}/${datei}?v=${r.stand}`;
}
