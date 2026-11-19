import {
  AttributionControl,
  Map as MapLibreMap,
  setWorkerUrl,
  type FilterSpecification,
  type MapLayerMouseEvent,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
// MapLibre looks for its worker next to its own file; after bundling it lives elsewhere.
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import type { Fix, Piece } from "@streifzug/core";
import { useEffect, useRef } from "react";
import type { Regionen } from "../daten/regionen";
import { t } from "../texte/de";

setWorkerUrl(workerUrl);

const START: [number, number] = [6.8285, 50.9395];
const TINTE = "#1e2a4a";
const SCHRIFT = ["Noto Sans Regular"];

function stilAdresse(dunkel: boolean) {
  return `https://tiles.openfreemap.org/styles/${dunkel ? "dark" : "positron"}`;
}

type FeatureSammlung = { type: "FeatureCollection"; features: { properties: Record<string, unknown>; geometry: { coordinates: unknown } }[] };

const geladen = new Map<string, Promise<{ gebiete: FeatureSammlung; namen: FeatureSammlung }>>();

/** Boundaries and label points of one region, with a flag for the smallest areas ("blatt"). */
function ladeRegion(id: string, daten: Regionen) {
  let p = geladen.get(id);
  if (!p) {
    p = Promise.all([
      fetch(`/regionen/${id}/gebiete.geojson`).then((r) => r.json() as Promise<FeatureSammlung>),
      fetch(`/regionen/${id}/namen.geojson`).then((r) => r.json() as Promise<FeatureSammlung>),
    ]).then(([gebiete, namen]) => {
      for (const sammlung of [gebiete, namen])
        for (const f of sammlung.features) f.properties.blatt = (daten.gebiete.get(String(f.properties.id))?.kinder.length ?? 0) === 0;
      return { gebiete, namen };
    });
    geladen.set(id, p);
  }
  return p;
}

/** Draws all regions: thin lines for the smallest areas, thicker ones for the levels above. */
async function gebieteZeichnen(karte: MapLibreMap, dunkel: boolean, daten: Regionen, gewaehlt: string | null) {
  const linie = dunkel ? "#aab3c5" : TINTE;
  const halo = dunkel ? "#12161c" : "#ffffff";
  const davor = karte.getLayer("highway-name-path") ? "highway-name-path" : undefined;

  for (const region of daten.liste) {
    const { gebiete, namen } = await ladeRegion(region.id, daten);
    if (!karte.getStyle() || karte.getSource(`gebiete-${region.id}`)) continue;
    karte.addSource(`gebiete-${region.id}`, { type: "geojson", data: gebiete as never, promoteId: "id", attribution: "Grenzen: Overture Maps" });
    karte.addSource(`namen-${region.id}`, { type: "geojson", data: namen as never });

    karte.addLayer(
      {
        id: `flaeche-${region.id}`,
        type: "fill",
        source: `gebiete-${region.id}`,
        filter: ["==", ["get", "blatt"], true],
        paint: { "fill-color": linie, "fill-opacity": ["case", ["boolean", ["feature-state", "gewaehlt"], false], 0.08, 0] },
      },
      davor,
    );
    karte.addLayer(
      {
        id: `linie-${region.id}`,
        type: "line",
        source: `gebiete-${region.id}`,
        paint: {
          "line-color": linie,
          "line-width": ["interpolate", ["linear"], ["zoom"], 9, ["case", ["get", "blatt"], 0.5, 1.4], 14, ["case", ["get", "blatt"], 1.2, 2.4]],
          "line-opacity": ["case", ["get", "blatt"], 0.3, 0.55],
        },
      },
      davor,
    );
    karte.addLayer({
      id: `gewaehlt-${region.id}`,
      type: "line",
      source: `gebiete-${region.id}`,
      filter: ["==", ["get", "id"], gewaehlt ?? ""],
      layout: { "line-join": "round" },
      paint: { "line-color": linie, "line-width": 3 },
    });
    karte.addLayer({
      id: `namen-${region.id}`,
      type: "symbol",
      source: `namen-${region.id}`,
      filter: ["==", ["get", "blatt"], true] as FilterSpecification,
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
    if (gewaehlt && daten.gebiete.get(gewaehlt)?.regionId === region.id)
      karte.setFeatureState({ source: `gebiete-${region.id}`, id: gewaehlt }, { gewaehlt: true });
  }

  // The base map labels suburbs too (layer names differ between light and dark styles).
  // Inside our zoom range our area names take over; cities and towns stay.
  for (const layer of karte.getStyle().layers) {
    const istOrtsName = layer.type === "symbol" && "source-layer" in layer && layer["source-layer"] === "place";
    const istGrosserOrt = /city|town|village|state|country|continent|capital/.test(layer.id);
    if (istOrtsName && !istGrosserOrt) karte.setLayerZoomRange(layer.id, 14.5, 24);
  }
}

/** Moves the map to an area unless it is already visible above the sheet. */
async function zeigeGebiet(karte: MapLibreMap, daten: Regionen, id: string) {
  const regionId = daten.gebiete.get(id)?.regionId;
  if (!regionId) return;
  const { namen } = await ladeRegion(regionId, daten);
  const punkt = namen.features.find((f) => f.properties.id === id)?.geometry.coordinates as [number, number] | undefined;
  if (!punkt) return;
  const oben = karte.unproject([0, 0]).lat;
  const untenSichtbar = karte.unproject([0, karte.getContainer().clientHeight * 0.55]).lat;
  if (karte.getBounds().contains(punkt) && punkt[1] < oben && punkt[1] > untenSichtbar) return;
  const ruhig = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ziel = { center: punkt, zoom: Math.max(karte.getZoom(), 13), padding: { top: 0, bottom: karte.getContainer().clientHeight * 0.45, left: 0, right: 0 } };
  if (ruhig) karte.jumpTo(ziel);
  else karte.easeTo({ ...ziel, duration: 600 });
}

export interface KartenProps {
  daten: Regionen | null;
  gewaehlt: string | null;
  gewaehltName: string;
  onWaehlen: (id: string) => void;
  /** The current outing (drawn live) and whether the map follows the position. */
  spur: Fix[];
  /** Street pieces already seen (all outings), drawn in highlighter yellow. */
  entdeckt: Piece[];
  folgen: boolean;
  /** Own position from the location button; the counter moves the map there each time. */
  position: [number, number] | null;
  zentrieren: number;
}

const LEER = { type: "FeatureCollection" as const, features: [] };

/** Own track and position, on top of everything. */
function eigenesZeichnen(karte: MapLibreMap) {
  if (karte.getSource("spur")) return;
  karte.addSource("entdeckt", { type: "geojson", data: LEER });
  karte.addLayer({ id: "entdeckt", type: "line", source: "entdeckt", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#ffe14a", "line-width": ["interpolate", ["linear"], ["zoom"], 11, 2.5, 16, 9], "line-opacity": 0.9 } });
  karte.addSource("spur", { type: "geojson", data: LEER });
  karte.addSource("ich", { type: "geojson", data: LEER });
  // The live track is a thin ink line; what it unlocks turns yellow underneath.
  karte.addLayer({ id: "spur-kern", type: "line", source: "spur", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": TINTE, "line-width": 2, "line-dasharray": [2, 1.5] } });
  karte.addLayer({ id: "ich-hof", type: "circle", source: "ich", paint: { "circle-radius": 14, "circle-color": "#2b6ef2", "circle-opacity": 0.18 } });
  karte.addLayer({ id: "ich", type: "circle", source: "ich", paint: { "circle-radius": 7, "circle-color": "#2b6ef2", "circle-stroke-color": "#ffffff", "circle-stroke-width": 3 } });
}

function setzeDaten(karte: MapLibreMap, quelle: string, data: unknown) {
  const q = karte.getSource(quelle) as { setData?: (d: unknown) => void } | undefined;
  q?.setData?.(data);
}

export function Karte(props: KartenProps) {
  const box = useRef<HTMLDivElement>(null);
  const karteRef = useRef<MapLibreMap | null>(null);
  const gewaehltRef = useRef(props.gewaehlt);
  const datenRef = useRef(props.daten);
  datenRef.current = props.daten;
  const waehlenRef = useRef(props.onWaehlen);
  waehlenRef.current = props.onWaehlen;
  const dunkelRef = useRef(false);

  useEffect(() => {
    if (!box.current) return;
    const dunkel = window.matchMedia("(prefers-color-scheme: dark)");
    dunkelRef.current = dunkel.matches;
    const karte = new MapLibreMap({
      container: box.current,
      style: stilAdresse(dunkel.matches),
      center: START,
      zoom: 13.2,
      minZoom: 4,
      attributionControl: false,
      pitchWithRotate: false,
      dragRotate: false,
    });
    karteRef.current = karte;
    karte.touchZoomRotate.disableRotation();
    karte.addControl(new AttributionControl({ compact: true }), "top-left");

    // Runs after every style load (also after switching light/dark).
    karte.on("style.load", () => {
      eigenesZeichnen(karte);
      if (datenRef.current) void gebieteZeichnen(karte, dunkelRef.current, datenRef.current, gewaehltRef.current);
    });
    karte.on("click", (e: MapLayerMouseEvent) => {
      const ebenen = (datenRef.current?.liste ?? []).map((r) => `flaeche-${r.id}`).filter((l) => karte.getLayer(l));
      const treffer = ebenen.length ? karte.queryRenderedFeatures(e.point, { layers: ebenen }) : [];
      const id = treffer[0]?.properties?.id;
      if (id) waehlenRef.current(String(id));
    });

    const wechsel = (e: MediaQueryListEvent) => {
      dunkelRef.current = e.matches;
      karte.setStyle(stilAdresse(e.matches));
    };
    dunkel.addEventListener("change", wechsel);
    return () => {
      dunkel.removeEventListener("change", wechsel);
      karte.remove();
      karteRef.current = null;
    };
  }, []);

  // Draw regions once their data has arrived.
  useEffect(() => {
    const karte = karteRef.current;
    if (karte && props.daten && karte.isStyleLoaded()) void gebieteZeichnen(karte, dunkelRef.current, props.daten, gewaehltRef.current);
  }, [props.daten]);

  // Highlight the chosen area and bring it into view if it is off screen.
  useEffect(() => {
    const karte = karteRef.current;
    const daten = props.daten;
    const alt = gewaehltRef.current;
    const neu = props.gewaehlt;
    gewaehltRef.current = neu;
    if (!karte || !daten) return;
    for (const [id, wert] of [[alt, false], [neu, true]] as const) {
      const regionId = id ? daten.gebiete.get(id)?.regionId : undefined;
      if (id && regionId && karte.getSource(`gebiete-${regionId}`)) karte.setFeatureState({ source: `gebiete-${regionId}`, id }, { gewaehlt: wert });
    }
    for (const r of daten.liste) if (karte.getLayer(`gewaehlt-${r.id}`)) karte.setFilter(`gewaehlt-${r.id}`, ["==", ["get", "id"], neu ?? ""]);
    if (neu && alt !== neu) void zeigeGebiet(karte, daten, neu);
  }, [props.gewaehlt, props.daten]);

  // Live track, own position, following, and choosing the area you are in.
  useEffect(() => {
    const karte = karteRef.current;
    if (!karte || !karte.getSource("spur")) return;
    const coords = props.spur.map((f) => [f.lon, f.lat]);
    setzeDaten(karte, "spur", { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coords.length > 1 ? coords : [] } });
    const letzter = props.spur.at(-1);
    const hier: [number, number] | null = letzter ? [letzter.lon, letzter.lat] : props.position;
    setzeDaten(karte, "ich", hier ? { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: hier } } : LEER);
    if (!props.folgen || !letzter) return;
    const ruhig = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // While out and about, stay close enough to see single streets turn yellow.
    const ziel = { center: hier!, zoom: Math.max(karte.getZoom(), 16), padding: { top: 0, bottom: karte.getContainer().clientHeight * 0.45, left: 0, right: 0 } };
    if (ruhig) karte.jumpTo(ziel);
    else karte.easeTo({ ...ziel, duration: 500 });
    karte.once("moveend", () => {
      const ebenen = (datenRef.current?.liste ?? []).map((r) => `flaeche-${r.id}`).filter((l) => karte.getLayer(l));
      if (!ebenen.length) return;
      const id = karte.queryRenderedFeatures(karte.project(hier!), { layers: ebenen })[0]?.properties?.id;
      if (id && String(id) !== gewaehltRef.current) waehlenRef.current(String(id));
    });
  }, [props.spur, props.folgen, props.position]);

  // Seen streets in yellow.
  useEffect(() => {
    const karte = karteRef.current;
    if (!karte || !karte.getSource("entdeckt")) return;
    setzeDaten(karte, "entdeckt", {
      type: "FeatureCollection",
      features: props.entdeckt.map((p) => ({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: p.coords } })),
    });
  }, [props.entdeckt]);

  // Location button: move to the own position.
  useEffect(() => {
    const karte = karteRef.current;
    if (!karte || !props.position || props.zentrieren === 0) return;
    const ruhig = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ziel = { center: props.position, zoom: Math.max(karte.getZoom(), 15), padding: { top: 0, bottom: karte.getContainer().clientHeight * 0.45, left: 0, right: 0 } };
    if (ruhig) karte.jumpTo(ziel);
    else karte.easeTo({ ...ziel, duration: 600 });
  }, [props.zentrieren]);

  return <div ref={box} className="karte" role="region" aria-label={t.karte.kartenRegion(props.gewaehltName)} />;
}
