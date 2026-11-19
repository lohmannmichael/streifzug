import { AttributionControl, Map as MapLibreMap, setWorkerUrl, type MapLayerMouseEvent } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
// MapLibre looks for its worker next to its own file; after bundling it lives elsewhere.
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import { useEffect, useRef } from "react";
import { t } from "../texte/de";

setWorkerUrl(workerUrl);

const WEIDEN: [number, number] = [6.8285, 50.9395];
const TINTE = "#1e2a4a";
const SCHRIFT = ["Noto Sans Regular"];

export interface Gebiet {
  nr: string;
  name: string;
  bezirk: string;
}

function stilAdresse(dunkel: boolean) {
  return `https://tiles.openfreemap.org/styles/${dunkel ? "dark" : "positron"}`;
}

/** Cologne districts (official boundaries, Stadt Köln) drawn on top of the base map. */
function gebieteZeichnen(karte: MapLibreMap, dunkel: boolean, gewaehlt: string | null) {
  const linie = dunkel ? "#aab3c5" : TINTE;
  const halo = dunkel ? "#12161c" : "#ffffff";
  const quelle = "Stadtteilgrenzen: Stadt Köln";

  karte.addSource("stadtteile", { type: "geojson", data: "/gebiete/koeln-stadtteile.geojson", promoteId: "nr", attribution: quelle });
  karte.addSource("bezirke", { type: "geojson", data: "/gebiete/koeln-bezirke.geojson" });
  karte.addSource("namen", { type: "geojson", data: "/gebiete/koeln-namen.geojson" });

  // Below the base map's street names, so they stay readable.
  const davor = karte.getLayer("highway-name-path") ? "highway-name-path" : undefined;

  karte.addLayer(
    {
      id: "stadtteile-flaeche",
      type: "fill",
      source: "stadtteile",
      paint: {
        "fill-color": linie,
        "fill-opacity": ["case", ["boolean", ["feature-state", "gewaehlt"], false], 0.08, 0],
      },
    },
    davor,
  );
  karte.addLayer(
    {
      id: "stadtteile-linie",
      type: "line",
      source: "stadtteile",
      paint: {
        "line-color": linie,
        "line-width": ["interpolate", ["linear"], ["zoom"], 10, 0.6, 14, 1.2],
        "line-opacity": ["interpolate", ["linear"], ["zoom"], 10, 0.35, 14, 0.25],
      },
    },
    davor,
  );
  karte.addLayer(
    {
      id: "bezirke-linie",
      type: "line",
      source: "bezirke",
      paint: {
        "line-color": linie,
        "line-width": ["interpolate", ["linear"], ["zoom"], 9, 1.4, 14, 2.4],
        "line-opacity": 0.55,
      },
    },
    davor,
  );
  karte.addLayer({
    id: "stadtteil-gewaehlt",
    type: "line",
    source: "stadtteile",
    filter: ["==", ["get", "nr"], gewaehlt ?? ""],
    layout: { "line-join": "round" },
    paint: { "line-color": linie, "line-width": 3 },
  });
  karte.addLayer({
    id: "stadtteile-namen",
    type: "symbol",
    source: "namen",
    minzoom: 9.6,
    maxzoom: 14.5,
    layout: {
      "text-field": ["get", "name"],
      "text-font": SCHRIFT,
      "text-size": ["interpolate", ["linear"], ["zoom"], 9.6, 9, 11, 11, 13, 14],
      "text-max-width": 7,
      "text-padding": 2,
    },
    paint: { "text-color": linie, "text-halo-color": halo, "text-halo-width": 1.5 },
  });

  // The base map labels suburbs too (layer names differ between light and dark styles).
  // Inside our zoom range our district names take over; cities and towns stay.
  for (const layer of karte.getStyle().layers) {
    const istOrtsName = layer.type === "symbol" && "source-layer" in layer && layer["source-layer"] === "place";
    const istGrosserOrt = /city|town|village|state|country|continent|capital/.test(layer.id);
    if (istOrtsName && !istGrosserOrt) karte.setLayerZoomRange(layer.id, 14.5, 24);
  }
}

let mittelpunkte: Promise<Map<string, [number, number]>> | null = null;

function ladeMittelpunkte() {
  mittelpunkte ??= fetch("/gebiete/koeln-namen.geojson")
    .then((r) => r.json() as Promise<{ features: { properties: { nr: string }; geometry: { coordinates: [number, number] } }[] }>)
    .then((d) => new Map(d.features.map((f) => [String(f.properties.nr), f.geometry.coordinates])));
  return mittelpunkte;
}

/** Moves the map to a district unless it is already visible above the sheet. */
async function zeigeGebiet(karte: MapLibreMap, nr: string) {
  const punkt = (await ladeMittelpunkte()).get(nr);
  if (!punkt) return;
  const sichtbar = karte.getBounds();
  const oben = karte.unproject([0, 0]).lat;
  const untenSichtbar = karte.unproject([0, karte.getContainer().clientHeight * 0.55]).lat;
  if (sichtbar.contains(punkt) && punkt[1] < oben && punkt[1] > untenSichtbar) return;
  const ruhig = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ziel = { center: punkt, zoom: Math.max(karte.getZoom(), 13), padding: { top: 0, bottom: karte.getContainer().clientHeight * 0.45, left: 0, right: 0 } };
  if (ruhig) karte.jumpTo(ziel);
  else karte.easeTo({ ...ziel, duration: 600 });
}

export function Karte(props: { gewaehlt: Gebiet | null; onWaehlen: (gebiet: Gebiet) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const karteRef = useRef<MapLibreMap | null>(null);
  const gewaehltRef = useRef(props.gewaehlt?.nr ?? null);
  const waehlenRef = useRef(props.onWaehlen);
  waehlenRef.current = props.onWaehlen;

  useEffect(() => {
    if (!box.current) return;
    const dunkel = window.matchMedia("(prefers-color-scheme: dark)");
    const karte = new MapLibreMap({
      container: box.current,
      style: stilAdresse(dunkel.matches),
      center: WEIDEN,
      zoom: 13.2,
      minZoom: 9,
      attributionControl: false,
      pitchWithRotate: false,
      dragRotate: false,
    });
    karteRef.current = karte;
    karte.touchZoomRotate.disableRotation();
    karte.addControl(new AttributionControl({ compact: true }), "top-left");

    // Runs after every style load (also after switching light/dark).
    const aufbauen = () => {
      gebieteZeichnen(karte, dunkel.matches, gewaehltRef.current);
      if (gewaehltRef.current) karte.setFeatureState({ source: "stadtteile", id: gewaehltRef.current }, { gewaehlt: true });
    };
    karte.on("style.load", aufbauen);

    const antippen = (e: MapLayerMouseEvent) => {
      const p = e.features?.[0]?.properties;
      if (p) waehlenRef.current({ nr: String(p.nr), name: String(p.name), bezirk: String(p.bezirk) });
    };
    karte.on("click", "stadtteile-flaeche", antippen);

    const wechsel = (e: MediaQueryListEvent) => karte.setStyle(stilAdresse(e.matches));
    dunkel.addEventListener("change", wechsel);
    return () => {
      dunkel.removeEventListener("change", wechsel);
      karte.remove();
      karteRef.current = null;
    };
  }, []);

  // Highlight the chosen district and bring it into view if it is off screen.
  useEffect(() => {
    const karte = karteRef.current;
    const neu = props.gewaehlt?.nr ?? null;
    const alt = gewaehltRef.current;
    gewaehltRef.current = neu;
    if (!karte || !karte.getSource("stadtteile")) return;
    if (alt) karte.setFeatureState({ source: "stadtteile", id: alt }, { gewaehlt: false });
    if (neu) karte.setFeatureState({ source: "stadtteile", id: neu }, { gewaehlt: true });
    karte.setFilter("stadtteil-gewaehlt", ["==", ["get", "nr"], neu ?? ""]);
    if (neu) void zeigeGebiet(karte, neu);
  }, [props.gewaehlt?.nr]);

  return <div ref={box} className="karte" role="region" aria-label={t.karte.kartenRegion(props.gewaehlt?.name ?? "Köln")} />;
}
