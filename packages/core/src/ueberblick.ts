/**
 * Overview far out (Bauplan 3, F5): all ways as fine lines below zoom 9. Worked out once per
 * calculation from the seen pieces: each piece's ends are snapped to a grid of about 100 m and
 * every segment is kept once. Far out, a pixel is more than 150 m, so nothing is lost to the eye.
 */
import type { LonLat } from "./geo";

/**
 * Below this zoom the overview replaces the quarter areas. Bauplan: 9; 8.5 so that Köln as a whole
 * (zoom 8.8 above the half sheet on an iPhone) still shows its quarters.
 */
export const UEBERBLICK_ZOOM = 8.5;

/** Grid in degrees (about 70–110 m in Germany). */
export const UEBERBLICK_RASTER = 0.001;

const runden = (v: number) => Math.round(v / UEBERBLICK_RASTER) * UEBERBLICK_RASTER;

export function ueberblickLinien(stuecke: Iterable<{ coords: readonly LonLat[] }>): LonLat[][] {
  const gesehen = new Set<string>();
  const out: LonLat[][] = [];
  for (const p of stuecke) {
    const a = p.coords[0];
    const b = p.coords[p.coords.length - 1];
    if (!a || !b) continue;
    const ra: LonLat = [runden(a[0]), runden(a[1])];
    const rb: LonLat = [runden(b[0]), runden(b[1])];
    if (ra[0] === rb[0] && ra[1] === rb[1]) continue;
    const ka = `${ra[0].toFixed(3)},${ra[1].toFixed(3)}`;
    const kb = `${rb[0].toFixed(3)},${rb[1].toFixed(3)}`;
    const k = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
    if (gesehen.has(k)) continue;
    gesehen.add(k);
    out.push([ra, rb]);
  }
  return out;
}
