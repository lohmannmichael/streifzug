import {
  AttributionControl,
  Map as MapLibreMap,
  Marker,
  setWorkerUrl,
  type FilterSpecification,
  type MapLayerMouseEvent,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
// MapLibre looks for its worker next to its own file; after bundling it lives elsewhere.
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import { distanceM, type Fix, type LonLat, type Piece } from "@streifzug/core";
import { useEffect, useRef } from "react";
import { alsStrecke, type Regionen } from "../daten/regionen";
import { strassenName } from "../daten/strassen";
import { t } from "../texte/de";
import { nebelAnlegen, type Nebel } from "./nebel";
import { stadtplan, STIL_ADRESSE } from "./stil";

setWorkerUrl(workerUrl);

const START: [number, number] = [6.8285, 50.9395];
const TINTE = "#1e2a4a";
const MARKER = "#ffe14a";
// Same width for seen streets and the drawing moment.
const MARKER_BREITE = ["interpolate", ["linear"], ["zoom"], 11, 3, 13, 5, 16, 9] as const;
// Duration of the highlighter stroke over a newly seen street, and of the glow afterwards.
const ZEICHNEN_MS = 700;
const GLANZ_MS = 1400;
const SCHRIFT = ["Noto Sans Regular"];


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
  // Area layers stay below street names and always below the yellow streets (layer names differ between styles).
  const davor = karte.getLayer("highway-name-path") ? "highway-name-path" : karte.getLayer("entdeckt") ? "entdeckt" : undefined;

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
        // Zoomed out, areas glow in highlighter yellow by how much is discovered; zoomed in, single streets take over.
        paint: {
          // Areas with progress glow yellow (also when chosen); a chosen area without progress gets a light ink tint.
          "fill-color": ["case", [">", ["coalesce", ["feature-state", "prozent"], 0], 0], "#ffe14a", linie],
          // On the dark plan the yellow glow is toned down, otherwise it turns muddy.
          "fill-opacity": [
            "interpolate", ["linear"], ["zoom"],
            11, ["*", dunkel ? 0.55 : 1, ["case", [">", ["coalesce", ["feature-state", "prozent"], 0], 0], ["min", 0.65, ["+", 0.15, ["*", 0.005, ["coalesce", ["feature-state", "prozent"], 0]]]], ["boolean", ["feature-state", "gewaehlt"], false], 0.08, 0]],
            15, ["case", ["boolean", ["feature-state", "gewaehlt"], false], 0.06, 0],
          ],
        },
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
          "line-width": ["interpolate", ["linear"], ["zoom"], 9, ["case", ["get", "blatt"], 0.5, 1.1], 14, ["case", ["get", "blatt"], 1, 1.8]],
          "line-opacity": ["case", ["get", "blatt"], 0.22, 0.35],
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
  const ziel = { center: punkt, zoom: Math.max(karte.getZoom(), 13), padding: { top: 0, bottom: karte.getContainer().clientHeight * 0.45, left: 0, right: 0 } };
  if (ruhig()) karte.jumpTo(ziel);
  else karte.easeTo({ ...ziel, duration: 600 });
}

export interface KartenProps {
  daten: Regionen | null;
  gewaehlt: string | null;
  gewaehltName: string;
  onWaehlen: (id: string, springen?: boolean) => void;
  /** Whether a newly chosen area should be brought into view (not when it was chosen by locating). */
  springen: boolean;
  /** The current outing (drawn live) and whether the map follows the position. */
  spur: Fix[];
  /** Street pieces already seen (all outings), drawn in highlighter yellow. */
  entdeckt: Piece[];
  /** Discovered share (0–100) per area id, for coloring areas when zoomed out. */
  prozente: Map<string, number>;
  folgen: boolean;
  /** While recording: newly seen streets are drawn with a highlighter stroke, "+25 m" pops up. */
  zeichnen: boolean;
  /** Whether paths count (for the "+25 m" number). */
  wegeZaehlen: boolean;
  /** Fog over undiscovered map parts. */
  nebel: boolean;
  /** Own position from the location button; the counter moves the map there each time. */
  position: [number, number] | null;
  zentrieren: number;
  /** "Weißer Fleck" to show: drawn as an ink outline, the map moves there each time `nr` changes. */
  markiert: { linien: readonly (readonly LonLat[])[]; nr: number } | null;
}

const LEER = { type: "FeatureCollection" as const, features: [] };

/** Own track and position, on top of everything. */
function eigenesZeichnen(karte: MapLibreMap) {
  if (karte.getSource("spur")) return;
  karte.addSource("entdeckt", { type: "geojson", data: LEER });
  karte.addLayer({ id: "entdeckt", type: "line", source: "entdeckt", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": MARKER, "line-width": MARKER_BREITE as never, "line-opacity": 0.9 } });
  // Drawing moment: a soft glow and the highlighter stroke running along the new street (line-progress needs lineMetrics).
  karte.addSource("neu", { type: "geojson", data: LEER, lineMetrics: true });
  karte.addLayer({ id: "neu-glanz", type: "line", source: "neu", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": MARKER, "line-width": ["interpolate", ["linear"], ["zoom"], 11, 10, 16, 26], "line-blur": 8, "line-opacity": 0 } });
  karte.addLayer({ id: "neu", type: "line", source: "neu", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-width": MARKER_BREITE as never, "line-opacity": 0.9, "line-gradient": strich(0) } });
  // The white spot to explore: a white casing with an ink dashed line, like a pen mark on the plan.
  karte.addSource("fleck", { type: "geojson", data: LEER });
  karte.addLayer({ id: "fleck-rand", type: "line", source: "fleck", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#ffffff", "line-width": ["interpolate", ["linear"], ["zoom"], 12, 7, 17, 16] } });
  karte.addLayer({ id: "fleck", type: "line", source: "fleck", paint: { "line-color": TINTE, "line-width": ["interpolate", ["linear"], ["zoom"], 12, 3, 17, 7], "line-dasharray": [1.2, 0.8] } });
  karte.addSource("spur", { type: "geojson", data: LEER });
  karte.addSource("ich", { type: "geojson", data: LEER });
  // The live track is a thin ink line; what it unlocks turns yellow underneath.
  karte.addLayer({ id: "spur-kern", type: "line", source: "spur", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": TINTE, "line-width": 2, "line-dasharray": [2, 1.5] } });
  karte.addLayer({ id: "ich-hof", type: "circle", source: "ich", paint: { "circle-radius": 14, "circle-color": "#2b6ef2", "circle-opacity": 0.18 } });
  karte.addLayer({ id: "ich", type: "circle", source: "ich", paint: { "circle-radius": 7, "circle-color": "#2b6ef2", "circle-stroke-color": "#ffffff", "circle-stroke-width": 3 } });
}

/** Highlighter stroke up to share p (0–1) of each line. */
function strich(p: number) {
  return ["step", ["line-progress"], MARKER, Math.min(1, Math.max(0.001, p)), "rgba(255, 225, 74, 0)"] as never;
}

function linienSammlung(stuecke: readonly Piece[]) {
  return { type: "FeatureCollection", features: stuecke.map((p) => ({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: p.coords } })) };
}

function ruhig() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function setzeDaten(karte: MapLibreMap, quelle: string, data: unknown) {
  const q = karte.getSource(quelle) as { setData?: (d: unknown) => void } | undefined;
  q?.setData?.(data);
}

export function Karte(props: KartenProps) {
  const box = useRef<HTMLDivElement>(null);
  const karteRef = useRef<MapLibreMap | null>(null);
  const nebelRef = useRef<Nebel | null>(null);
  const gewaehltRef = useRef(props.gewaehlt);
  const datenRef = useRef(props.daten);
  datenRef.current = props.daten;
  const waehlenRef = useRef(props.onWaehlen);
  waehlenRef.current = props.onWaehlen;
  // Latest seen streets and shares, so they can be drawn again whenever the map style (re)loads.
  const entdecktRef = useRef(props.entdeckt);
  entdecktRef.current = props.entdeckt;
  const markiertRef = useRef(props.markiert);
  markiertRef.current = props.markiert;
  const prozenteRef = useRef(props.prozente);
  prozenteRef.current = props.prozente;
  const dunkelRef = useRef(false);
  // Drawing moment: ids already shown, and the running animation.
  const bekannt = useRef<Set<string> | null>(null);
  const animation = useRef<{ bild: number; ende: () => void } | null>(null);

  useEffect(() => {
    if (!box.current) return;
    const dunkel = window.matchMedia("(prefers-color-scheme: dark)");
    dunkelRef.current = dunkel.matches;
    const karte = new MapLibreMap({
      container: box.current,
      style: STIL_ADRESSE,
      // Our own "Stadtplan" colors, light or dark (also used for every later setStyle).
      transformStyle: (_vorher, neu) => stadtplan(neu, dunkelRef.current),
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
    // Credits start folded to the (i) button; tapping it shows them (allowed by the OSM attribution guidelines).
    karte.once("load", () => box.current?.querySelector(".maplibregl-ctrl-attrib")?.classList.remove("maplibregl-compact-show"));
    const nebel = nebelAnlegen(karte);
    nebel.dunkel(dunkel.matches);
    nebelRef.current = nebel;

    // Runs after every style load (also after switching light/dark). Seen streets and area shares
    // may have arrived before the style; draw them now so nothing gets lost.
    karte.on("style.load", () => {
      animation.current?.ende();
      eigenesZeichnen(karte);
      setzeDaten(karte, "entdeckt", linienSammlung(entdecktRef.current));
      fleckSetzen(karte, markiertRef.current?.linien ?? null);
      if (datenRef.current)
        void gebieteZeichnen(karte, dunkelRef.current, datenRef.current, gewaehltRef.current).then(() => prozenteSetzen(karte, datenRef.current, prozenteRef.current));
    });
    karte.on("click", (e: MapLayerMouseEvent) => {
      const ebenen = (datenRef.current?.liste ?? []).map((r) => `flaeche-${r.id}`).filter((l) => karte.getLayer(l));
      const treffer = ebenen.length ? karte.queryRenderedFeatures(e.point, { layers: ebenen }) : [];
      const id = treffer[0]?.properties?.id;
      if (id) waehlenRef.current(String(id));
    });

    const wechsel = (e: MediaQueryListEvent) => {
      dunkelRef.current = e.matches;
      nebel.dunkel(e.matches);
      // Same base style, recolored: reload fully so our own layers are added again.
      karte.setStyle(STIL_ADRESSE, { diff: false });
    };
    dunkel.addEventListener("change", wechsel);
    return () => {
      dunkel.removeEventListener("change", wechsel);
      animation.current?.ende();
      nebel.entfernen();
      nebelRef.current = null;
      karte.remove();
      karteRef.current = null;
    };
  }, []);

  // Draw regions once their data has arrived.
  useEffect(() => {
    const karte = karteRef.current;
    if (karte && props.daten && karte.isStyleLoaded())
      void gebieteZeichnen(karte, dunkelRef.current, props.daten, gewaehltRef.current).then(() => prozenteSetzen(karte, datenRef.current, prozenteRef.current));
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
    if (neu && alt !== neu && props.springen) void zeigeGebiet(karte, daten, neu);
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
    // While out and about, stay close enough to see single streets turn yellow.
    const ziel = { center: hier!, zoom: Math.max(karte.getZoom(), 16), padding: { top: 0, bottom: karte.getContainer().clientHeight * 0.45, left: 0, right: 0 } };
    if (ruhig()) karte.jumpTo(ziel);
    else karte.easeTo({ ...ziel, duration: 500 });
    karte.once("moveend", () => {
      const ebenen = (datenRef.current?.liste ?? []).map((r) => `flaeche-${r.id}`).filter((l) => karte.getLayer(l));
      if (!ebenen.length) return;
      const id = karte.queryRenderedFeatures(karte.project(hier!), { layers: ebenen })[0]?.properties?.id;
      // Following you: choose the area you are in without moving the map away.
      if (id && String(id) !== gewaehltRef.current) waehlenRef.current(String(id), false);
    });
  }, [props.spur, props.folgen, props.position]);

  // Fog: clear around seen streets, the live track and the own position.
  useEffect(() => {
    const nebel = nebelRef.current;
    if (!nebel) return;
    nebel.an(props.nebel);
    const letzter = props.spur.at(-1);
    const punkt: LonLat | null = letzter ? [letzter.lon, letzter.lat] : props.position;
    nebel.setzen([...props.entdeckt.map((p) => p.coords), props.spur.map((f) => [f.lon, f.lat] as LonLat)], punkt);
  }, [props.nebel, props.entdeckt, props.spur, props.position]);

  // Seen streets in yellow. While recording, new ones get the drawing moment.
  useEffect(() => {
    const karte = karteRef.current;
    const ids = new Set(props.entdeckt.map((p) => p.id));
    const vorher = bekannt.current;
    bekannt.current = ids;
    if (!karte || !karte.getSource("entdeckt")) return;
    animation.current?.ende();
    const neu = props.zeichnen && vorher ? props.entdeckt.filter((p) => !vorher.has(p.id)) : [];
    if (neu.length === 0) {
      setzeDaten(karte, "entdeckt", linienSammlung(props.entdeckt));
      return;
    }
    const meter = neu.reduce((m, p) => m + (p.kind === "street" || props.wegeZaehlen ? p.lengthM * p.weight : 0), 0);
    const letzter = props.spur.at(-1);
    zeichenMoment(karte, props.entdeckt, neu, meter, letzter ? [letzter.lon, letzter.lat] : null, animation);
  }, [props.entdeckt]);

  // Area coloring by discovered share.
  useEffect(() => {
    const karte = karteRef.current;
    if (karte) prozenteSetzen(karte, props.daten, props.prozente);
  }, [props.prozente, props.daten]);

  // White spot: draw it and bring it into view above the sheet.
  useEffect(() => {
    const karte = karteRef.current;
    if (!karte) return;
    fleckSetzen(karte, props.markiert?.linien ?? null);
    if (!props.markiert) return;
    const c = props.markiert.linien.flat();
    const lons = c.map((p) => p[0]);
    const lats = c.map((p) => p[1]);
    const hoehe = karte.getContainer().clientHeight;
    karte.fitBounds(
      [[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]],
      { padding: { top: 80, bottom: hoehe * 0.45 + 40, left: 60, right: 60 }, maxZoom: 17, duration: ruhig() ? 0 : 700 },
    );
  }, [props.markiert?.nr]);

  // Location button: move to the own position.
  useEffect(() => {
    const karte = karteRef.current;
    if (!karte || !props.position || props.zentrieren === 0) return;
    const ziel = { center: props.position, zoom: Math.max(karte.getZoom(), 15), padding: { top: 0, bottom: karte.getContainer().clientHeight * 0.45, left: 0, right: 0 } };
    if (ruhig()) karte.jumpTo(ziel);
    else karte.easeTo({ ...ziel, duration: 600 });
  }, [props.zentrieren]);

  return <div ref={box} className="karte" role="region" aria-label={t.karte.kartenRegion(props.gewaehltName)} />;
}

function fleckSetzen(karte: MapLibreMap, linien: readonly (readonly LonLat[])[] | null) {
  setzeDaten(karte, "fleck", linien ? { type: "Feature", properties: {}, geometry: { type: "MultiLineString", coordinates: linien } } : LEER);
}

function prozenteSetzen(karte: MapLibreMap, daten: Regionen | null, prozente: Map<string, number>) {
  if (!daten) return;
  for (const [id, prozent] of prozente) {
    const regionId = daten.gebiete.get(id)?.regionId;
    if (regionId && karte.getSource(`gebiete-${regionId}`)) karte.setFeatureState({ source: `gebiete-${regionId}`, id }, { prozent });
  }
}

/**
 * New streets are not simply switched on: a highlighter stroke runs along them, a short glow follows,
 * and "+25 m" rises next to the own position. Calm (no stroke, no rising) with "reduce motion".
 */
function zeichenMoment(
  karte: MapLibreMap,
  alle: readonly Piece[],
  neu: readonly Piece[],
  meter: number,
  hier: LonLat | null,
  animation: { current: { bild: number; ende: () => void } | null },
) {
  const neuIds = new Set(neu.map((p) => p.id));
  setzeDaten(karte, "entdeckt", linienSammlung(alle.filter((p) => !neuIds.has(p.id))));
  setzeDaten(karte, "neu", linienSammlung(neu));
  navigator.vibrate?.(12);

  // "+25 m" next to where you are (or the new street), as a map marker so it moves with the map.
  let marke: Marker | null = null;
  if (meter >= 1) {
    // MapLibre positions the marker element via transform; the badge (tilted, animated) sits inside.
    const el = document.createElement("div");
    const plakette = document.createElement("span");
    plakette.className = "plus-meter";
    plakette.textContent = `+${alsStrecke(meter)}`;
    el.append(plakette);
    el.setAttribute("role", "status");
    el.setAttribute("aria-label", t.karte.neuEntdeckt(alsStrecke(meter)));
    const ort = hier ?? neu.at(-1)!.mid;
    marke = new Marker({ element: el, anchor: "bottom", offset: [0, -18] }).setLngLat(ort as [number, number]).addTo(karte);
    // The street name follows a moment later (the tile is already loaded, so this is quick).
    const naechstes = hier ? [...neu].sort((a, b) => distanceM(a.mid, hier) - distanceM(b.mid, hier))[0]! : neu.at(-1)!;
    void strassenName(naechstes).then((name) => {
      if (!name || !plakette.isConnected) return;
      const zeile = document.createElement("small");
      zeile.className = "plus-name";
      zeile.textContent = name;
      plakette.prepend(zeile);
      el.setAttribute("aria-label", t.karte.neuEntdecktIn(alsStrecke(meter), name));
    });
    el.addEventListener("animationend", () => marke?.remove());
    window.setTimeout(() => marke?.remove(), 2500);
  }

  let fertig = false;
  const ende = () => {
    if (fertig) return;
    fertig = true;
    cancelAnimationFrame(animation.current?.bild ?? 0);
    animation.current = null;
    if (!karte.getSource("entdeckt")) return;
    setzeDaten(karte, "entdeckt", linienSammlung(alle));
    setzeDaten(karte, "neu", LEER);
    karte.setPaintProperty("neu", "line-gradient", strich(0));
    karte.setPaintProperty("neu-glanz", "line-opacity", 0);
  };
  if (ruhig()) {
    karte.setPaintProperty("neu", "line-gradient", strich(1));
    animation.current = { bild: 0, ende };
    window.setTimeout(ende, 600);
    return;
  }
  const start = performance.now();
  const bild = (jetzt: number) => {
    if (fertig) return;
    // The frame time can lie slightly before the start time.
    const z = Math.max(0, jetzt - start);
    const p = Math.min(1, z / ZEICHNEN_MS);
    karte.setPaintProperty("neu", "line-gradient", strich(1 - (1 - p) ** 3));
    // Glow rises with the stroke and fades afterwards.
    const g = Math.max(0, z < ZEICHNEN_MS ? 0.5 * p : 0.5 * (1 - (z - ZEICHNEN_MS) / (GLANZ_MS - ZEICHNEN_MS)));
    karte.setPaintProperty("neu-glanz", "line-opacity", g);
    if (z >= GLANZ_MS) ende();
    else if (animation.current) animation.current.bild = requestAnimationFrame(bild);
  };
  animation.current = { bild: requestAnimationFrame(bild), ende };
}
