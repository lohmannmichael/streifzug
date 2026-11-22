import type { LngLatBoundsLike, Map as MapLibreMap } from "maplibre-gl";
import type { Regionen } from "../daten/regionen";
import { boxVon, ladeRegion } from "./gebiete";

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

/** "Reduce motion" is on: jump instead of flying. */
export function ruhig() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Moves the map to an area unless it is already visible above the sheet. */
export async function zeigeGebiet(karte: MapLibreMap, daten: Regionen, id: string) {
  const g = daten.gebiete.get(id);
  const regionId = g?.regionId;
  if (!g || !regionId) return;
  const { gebiete, namen } = await ladeRegion(regionId, daten);
  // A place or district (Bauplan 3, D2): show all of it above the sheet.
  if (g.kinder.length > 0) {
    const flaeche = gebiete.features.find((f) => f.properties.id === id);
    const box = flaeche ? boxVon(flaeche.geometry) : g.eltern === null ? daten.liste.find((r) => r.id === regionId)?.bbox : undefined;
    if (box) {
      const h = karte.getContainer().clientHeight;
      zeigeBox(karte, [[box[0], box[1]], [box[2], box[3]]], { top: 70, bottom: h * 0.5, left: 24, right: 24 }, { duration: ruhig() ? 0 : 900 });
      return;
    }
  }
  const punkt = namen.features.find((f) => f.properties.id === id)?.geometry.coordinates as [number, number] | undefined;
  if (!punkt) return;
  const oben = karte.unproject([0, 0]).lat;
  const untenSichtbar = karte.unproject([0, karte.getContainer().clientHeight * 0.55]).lat;
  if (karte.getBounds().contains(punkt) && punkt[1] < oben && punkt[1] > untenSichtbar) return;
  const ziel = { center: punkt, zoom: Math.max(karte.getZoom(), 13), padding: { top: 0, bottom: karte.getContainer().clientHeight * 0.45, left: 0, right: 0 } };
  if (ruhig()) karte.jumpTo(ziel);
  else karte.easeTo({ ...ziel, duration: 600 });
}
