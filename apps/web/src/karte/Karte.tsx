import { AttributionControl, Map as MapLibreMap, setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
// MapLibre looks for its worker next to its own file; after bundling it lives elsewhere.
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import { useEffect, useRef } from "react";
import { t } from "../texte/de";

setWorkerUrl(workerUrl);

const WEIDEN: [number, number] = [6.8285, 50.9395];

function stilAdresse(dunkel: boolean) {
  return `https://tiles.openfreemap.org/styles/${dunkel ? "dark" : "positron"}`;
}

export function Karte() {
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!box.current) return;
    const dunkel = window.matchMedia("(prefers-color-scheme: dark)");
    const karte = new MapLibreMap({
      container: box.current,
      style: stilAdresse(dunkel.matches),
      center: WEIDEN,
      zoom: 14.5,
      attributionControl: false,
      pitchWithRotate: false,
      dragRotate: false,
    });
    karte.touchZoomRotate.disableRotation();
    karte.addControl(new AttributionControl({ compact: true }), "top-left");
    const wechsel = (e: MediaQueryListEvent) => karte.setStyle(stilAdresse(e.matches));
    dunkel.addEventListener("change", wechsel);
    return () => {
      dunkel.removeEventListener("change", wechsel);
      karte.remove();
    };
  }, []);

  return <div ref={box} className="karte" role="region" aria-label={t.karte.kartenRegion} />;
}
