import { Map as MapLibreMap, ScaleControl, setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
// MapLibre looks for its worker next to its own file; after bundling it lives elsewhere.
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import { stadtplan, STIL_ADRESSE } from "./stil";

setWorkerUrl(workerUrl);

const START: [number, number] = [6.8285, 50.9395];

/**
 * Builds the map with the plan style (light or dark, `dunkel()` asked on every style load) and
 * watches the style: `kaputt(true)` if it fails or does not arrive within 12 s (Bauplan 3, C3),
 * `kaputt(false)` once it is there. Only the style counts: a single missing tile later (dead
 * spot) leaves the plan as it is. MapLibre's isStyleLoaded() is also false while tiles load, so
 * `stilDa()` tells whether the style is there. Returns the map and a function to stop the watch.
 */
export function karteBauen(container: HTMLElement, dunkel: () => boolean, kaputt: (ja: boolean) => void) {
  const karte = new MapLibreMap({
    container,
    style: STIL_ADRESSE,
    // Our own "Stadtplan" colors, light or dark (also used for every later setStyle).
    transformStyle: (_vorher, neu) => stadtplan(neu, dunkel()),
    center: START,
    zoom: 13.2,
    minZoom: 4,
    attributionControl: false,
    pitchWithRotate: false,
    dragRotate: false,
  });
  let da = false;
  const uhr = window.setTimeout(() => !da && kaputt(true), 12_000);
  karte.on("error", () => {
    if (!da) kaputt(true);
  });
  karte.on("style.load", () => {
    da = true;
    window.clearTimeout(uhr);
    kaputt(false);
  });
  karte.touchZoomRotate.disableRotation();
  karte.addControl(new ScaleControl({ unit: "metric", maxWidth: 90 }), "bottom-left");
  return { karte, stilDa: () => da, aufhoeren: () => window.clearTimeout(uhr) };
}

/** Light/dark switch: same base style, recolored; reloaded fully so our own layers are added again. */
export const stilNeu = (karte: MapLibreMap) => karte.setStyle(STIL_ADRESSE, { diff: false });
