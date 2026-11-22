import type { LngLatBoundsLike, Map as MapLibreMap } from "maplibre-gl";

type Rand = { top: number; bottom: number; left: number; right: number };

/**
 * fitBounds that always moves: MapLibre adds the padding remembered from earlier moves (easeTo
 * with padding) to the given one. Then the box may "not fit" and the map silently stays where it
 * is. Only the part that is not there yet is passed.
 */
export function zeigeBox(karte: MapLibreMap, box: LngLatBoundsLike, soll: Rand, optionen: { maxZoom?: number; duration: number }) {
  const da = karte.getPadding();
  const rest = (s: number, ist: number | undefined) => Math.max(0, s - (ist ?? 0));
  karte.fitBounds(box, {
    ...optionen,
    padding: { top: rest(soll.top, da.top), bottom: rest(soll.bottom, da.bottom), left: rest(soll.left, da.left), right: rest(soll.right, da.right) },
  });
}
