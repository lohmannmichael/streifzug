/**
 * Which places are needed right now (Bauplan 3, E4): the app loads the boundaries of a place only
 * when the plan looks at it, when ways lie there or when it is opened. Places are given by their
 * bounding box ([west, south, east, north]) from regionen/index.json.
 */

export interface OrtBox {
  id: string;
  bbox: readonly [number, number, number, number];
}

/** Zoomed out further than this, the plan loads no places by itself (a whole country would be too many). */
export const ZOOM_ORTE_LADEN = 8;

/** Places whose box overlaps the visible part of the plan, in list order. */
export function orteImBlick(orte: readonly OrtBox[], sicht: readonly [number, number, number, number], zoom: number): string[] {
  if (zoom < ZOOM_ORTE_LADEN) return [];
  const [w, s, e, n] = sicht;
  return orte.filter((o) => o.bbox[0] <= e && o.bbox[2] >= w && o.bbox[1] <= n && o.bbox[3] >= s).map((o) => o.id);
}

/** Places whose box contains at least one of the points, in list order. */
export function orteMitPunkten(orte: readonly OrtBox[], punkte: Iterable<readonly [number, number]>): string[] {
  const offen = new Set(orte);
  const gefunden = new Set<OrtBox>();
  for (const [x, y] of punkte) {
    for (const o of offen)
      if (x >= o.bbox[0] && x <= o.bbox[2] && y >= o.bbox[1] && y <= o.bbox[3]) {
        gefunden.add(o);
        offen.delete(o);
      }
    if (offen.size === 0) break;
  }
  return orte.filter((o) => gefunden.has(o)).map((o) => o.id);
}
