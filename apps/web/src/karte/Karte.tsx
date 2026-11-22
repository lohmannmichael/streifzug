import {
  Map as MapLibreMap,
  Marker,
  ScaleControl,
  setWorkerUrl,
  type FilterSpecification,
  type MapLayerMouseEvent,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
// MapLibre looks for its worker next to its own file; after bundling it lives elsewhere.
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import { distanceM, type Fix, type LonLat, type Piece } from "@streifzug/core";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { zeigeBox } from "./kamera";
import { ausnahmeSetzen } from "../daten/ausnahmen";
import { etikettAn, type Etikett } from "../daten/veedel";
import { rueckblickAbspielen } from "./rueckblick";
import { ERSTES_JAHR, jahresFarbe, MARKER_FARBEN } from "../einstellungen";
import { alsStrecke, prozentText, type Regionen } from "../daten/regionen";
import { strassenName } from "../daten/strassen";
import { t } from "../texte/de";
import { FARBEN, stadtplan, STIL_ADRESSE, strassenBreite } from "./stil";

setWorkerUrl(workerUrl);

const START: [number, number] = [6.8285, 50.9395];
const TINTE = "#1e2a4a";
// Pens (Bauplan 4.2), set from the settings; the defaults are yellow highlighter and red pen.
let MARKER = "#ffe83a";
let KULI = "#d92b20";
// Same width for seen streets and the drawing moment.
// Highlighter: street width + 4 px (Bauplan 4.5).
const MARKER_BREITE = strassenBreite(4);
// Duration of the highlighter stroke over a newly seen street, and of the glow afterwards.
const ZEICHNEN_MS = 700;
const GLANZ_MS = 1400;


type FeatureSammlung = { type: "FeatureCollection"; features: { properties: Record<string, unknown>; geometry: { coordinates: unknown } }[] };

const geladen = new Map<string, Promise<{ gebiete: FeatureSammlung; namen: FeatureSammlung }>>();
const fertigGeladen = new Map<string, { gebiete: FeatureSammlung; namen: FeatureSammlung }>();

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
      fertigGeladen.set(id, { gebiete, namen });
      return { gebiete, namen };
    });
    geladen.set(id, p);
  }
  return p;
}

/** Draws all regions: thin lines for the smallest areas, thicker ones for the levels above. */
async function gebieteZeichnen(karte: MapLibreMap, dunkel: boolean, daten: Regionen, gewaehlt: string | null) {
  const f = dunkel ? FARBEN.dunkel : FARBEN.hell;
  const linie = f.grenze;
  const halo = f.hof;
  // Area fills lie under the streets; borders above the streets but under the highlighter.
  const unterStrassen = karte.getLayer("plan-nebenweg") ? "plan-nebenweg" : undefined;
  const davor = karte.getLayer("gefahren") ? "gefahren" : undefined;

  for (const region of daten.liste) {
    const { gebiete, namen } = await ladeRegion(region.id, daten);
    if (!karte.getStyle() || karte.getSource(`gebiete-${region.id}`)) continue;
    karte.addSource(`gebiete-${region.id}`, { type: "geojson", data: gebiete as never, promoteId: "id", attribution: "Grenzen: Overture Maps" });
    karte.addSource(`namen-${region.id}`, { type: "geojson", data: namen as never });

    // Areas for tapping (invisible), with a light ink tint on the chosen one when zoomed out.
    karte.addLayer(
      {
        id: `flaeche-${region.id}`,
        type: "fill",
        source: `gebiete-${region.id}`,
        filter: ["==", ["get", "blatt"], true],
        paint: {
          "fill-color": linie,
          "fill-opacity": ["interpolate", ["linear"], ["zoom"], 11, ["case", ["boolean", ["feature-state", "gewaehlt"], false], 0.08, 0], 12.5, 0],
        },
      },
      unterStrassen,
    );
    // Zoomed out, every entered quarter is hatched in highlighter colour, denser with more seen (Bauplan 4.5).
    karte.addLayer(
      {
        id: `schraffur-${region.id}`,
        type: "fill",
        source: `gebiete-${region.id}`,
        filter: ["all", ["==", ["get", "blatt"], true], [">=", ["coalesce", ["get", "stufe"], -1], 0]],
        paint: {
          "fill-pattern": ["concat", "schraffur-", ["to-string", ["get", "stufe"]]],
          "fill-opacity": ["interpolate", ["linear"], ["zoom"], 11.5, dunkel ? 0.8 : 1, 12.6, 0],
        },
      },
      unterStrassen,
    );
    karte.addLayer(
      {
        id: `linie-${region.id}`,
        type: "line",
        source: `gebiete-${region.id}`,
        // quarter border: dash-dot, 1.1 px (Bauplan 4.2); districts a little stronger.
        paint: {
          "line-color": linie,
          "line-width": ["case", ["get", "blatt"], 1.1, 1.6],
          "line-opacity": ["case", ["get", "blatt"], 0.85, 0.6],
          "line-dasharray": [6, 3, 1.5, 3],
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
      paint: { "line-color": linie, "line-width": 2.4 },
    }, davor);
    karte.addLayer({
      id: `namen-${region.id}`,
      type: "symbol",
      source: `namen-${region.id}`,
      filter: ["==", ["get", "blatt"], true] as FilterSpecification,
      minzoom: 9.6,
      maxzoom: 16.5,
      // The quarter name stands large, widely spaced and pale across the area, as on printed plans.
      layout: {
        // Zoomed out, entered areas show their share under the name.
        "text-field": [
          "step", ["zoom"],
          ["case", ["has", "pt"], ["format", ["upcase", ["get", "name"]], {}, "\n", {}, ["get", "pt"], { "font-scale": 1.15 }], ["upcase", ["get", "name"]]],
          12.5, ["upcase", ["get", "name"]],
        ],
        "text-font": ["Noto Sans Bold"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 9.6, 10, 12, 14, 14, 22, 16, 30],
        "text-letter-spacing": 0.35,
        "text-max-width": 12,
        "text-padding": 2,
      },
      paint: { "text-color": f.schrift, "text-opacity": ["interpolate", ["linear"], ["zoom"], 9.6, ["case", ["has", "pt"], 1, 0.7], 12.4, ["case", ["has", "pt"], 1, 0.6], 13, 0.28], "text-halo-color": halo, "text-halo-width": 1.4 },
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

/** Bounding box of a (multi)polygon. */
function boxVon(geo: { coordinates: unknown }): [number, number, number, number] | undefined {
  let [w, s, e, n] = [Infinity, Infinity, -Infinity, -Infinity];
  const gehen = (x: unknown): void => {
    if (Array.isArray(x) && typeof x[0] === "number") {
      w = Math.min(w, x[0] as number);
      e = Math.max(e, x[0] as number);
      s = Math.min(s, x[1] as number);
      n = Math.max(n, x[1] as number);
    } else if (Array.isArray(x)) for (const y of x) gehen(y);
  };
  gehen(geo.coordinates);
  return Number.isFinite(w) ? [w, s, e, n] : undefined;
}

interface KartenProps {
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
  /** Pieces only driven (car, bus, train): a pen line under the yellow. Never counted. */
  gefahren: Piece[];
  /** Discovered share (0–100) per area id, for coloring areas when zoomed out. */
  prozente: Map<string, number>;
  folgen: boolean;
  /** While recording: newly seen streets are drawn with a highlighter stroke, "+25 m" pops up. */
  zeichnen: boolean;
  /** Whether paths count (for the "+25 m" number). */
  wegeZaehlen: boolean;
  /** Own position from the location button; the counter moves the map there each time. */
  position: [number, number] | null;
  zentrieren: number;
  /** Replay on opening: the map runs along these outings once (in order); `nr` starts it. */
  rueckblick: { wege: LonLat[][]; seit: number; bis?: number; nr: number } | null;
  onRueckblickEnde: () => void;
  /** When each seen piece was first walked (year colours, replay). */
  erstesMal: Map<string, number>;
  stifte: { marker: string; kuli: string; jahresFarben: boolean };
}

export interface Stifte {
  marker: string;
  kuli: string;
  jahresFarben: boolean;
}

/** Highlighter colour of a seen piece: one colour, or the colour of the year it was first walked. */
function markerFarbe(st: Stifte): unknown {
  if (!st.jahresFarben) return st.marker;
  const n = MARKER_FARBEN.length;
  return ["at", ["%", ["+", ["-", ["coalesce", ["get", "jahr"], ERSTES_JAHR], ERSTES_JAHR], n * 100], n], ["literal", MARKER_FARBEN.map((f) => f.farbe)]];
}

/** Hatching for areas when zoomed out: five densities (under 10, 10, 25, 50, 75 %), full at 100 %. */
const SCHRAFFUR_ABSTAND = [14, 10, 7, 5, 3.4];
function schraffurBilder(karte: MapLibreMap, farbe: string) {
  const g = 32;
  for (let stufe = 0; stufe <= 5; stufe++) {
    const c = document.createElement("canvas");
    c.width = c.height = g;
    const x = c.getContext("2d")!;
    x.fillStyle = farbe;
    if (stufe === 5) x.fillRect(0, 0, g, g);
    else {
      x.strokeStyle = farbe;
      x.lineWidth = 2;
      const a = (g / Math.round(g / SCHRAFFUR_ABSTAND[stufe]!));
      // Diagonal lines that continue seamlessly across tile edges.
      for (let o = -g; o <= g * 2; o += a) {
        x.beginPath();
        x.moveTo(o, g);
        x.lineTo(o + g, 0);
        x.stroke();
      }
    }
    const bild = x.getImageData(0, 0, g, g);
    const name = `schraffur-${stufe}`;
    if (karte.hasImage(name)) karte.updateImage(name, bild);
    else karte.addImage(name, bild, { pixelRatio: 2 });
  }
}

const stufeVon = (p: number) => (p >= 100 ? 5 : p >= 75 ? 4 : p >= 50 ? 3 : p >= 25 ? 2 : p >= 10 ? 1 : 0);

const LEER = { type: "FeatureCollection" as const, features: [] };

/** Own track and position, on top of everything. */
function eigenesZeichnen(karte: MapLibreMap) {
  if (karte.getSource("spur")) return;
  // Pen line and highlighter lie under the street names, so names stay readable (Bauplan 4.5).
  const vorSchrift = karte.getStyle().layers.find((l) => l.type === "symbol")?.id;
  // Driven streets: a thin pen line (Kuli), under the highlighter, so walking later paints over it.
  karte.addSource("gefahren", { type: "geojson", data: LEER });
  karte.addLayer({ id: "gefahren", type: "line", source: "gefahren", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": KULI, "line-width": ["interpolate", ["linear"], ["zoom"], 11, 1.2, 16, 1.8, 18, 2.4], "line-offset": 1, "line-opacity": 0.95 } }, vorSchrift);
  karte.addSource("entdeckt", { type: "geojson", data: LEER });
  karte.addLayer({ id: "entdeckt", type: "line", source: "entdeckt", filter: ["!=", ["get", "weg"], true], layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": MARKER, "line-width": MARKER_BREITE, "line-opacity": ["interpolate", ["linear"], ["zoom"], 11.4, 0, 12.4, 1] } }, vorSchrift);
  // Paths (parks, Tierpark): a thinner highlighter stroke; they are shown but never counted.
  karte.addLayer({ id: "entdeckt-weg", type: "line", source: "entdeckt", filter: ["==", ["get", "weg"], true], minzoom: 13, layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": MARKER, "line-width": ["interpolate", ["linear"], ["zoom"], 13, 2, 16, 4, 18, 7], "line-opacity": 1 } }, vorSchrift);
  // Drawing moment: a soft glow and the highlighter stroke running along the new street (line-progress needs lineMetrics).
  karte.addSource("neu", { type: "geojson", data: LEER, lineMetrics: true });
  karte.addLayer({ id: "neu-glanz", type: "line", source: "neu", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": MARKER, "line-width": ["interpolate", ["linear"], ["zoom"], 11, 10, 16, 26], "line-blur": 8, "line-opacity": 0 } });
  karte.addLayer({ id: "neu", type: "line", source: "neu", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-width": MARKER_BREITE, "line-opacity": 0.9, "line-gradient": strich(0) } });
  // Replay on opening: a highlighter trail with a glow and an ink dot at its head.
  karte.addSource("rb", { type: "geojson", data: LEER });
  karte.addSource("rb-kopf", { type: "geojson", data: LEER });
  karte.addLayer({ id: "rb-glanz", type: "line", source: "rb", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": MARKER, "line-width": ["interpolate", ["linear"], ["zoom"], 11, 9, 16, 24], "line-blur": 7, "line-opacity": 0.45 } });
  karte.addLayer({ id: "rb", type: "line", source: "rb", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": MARKER, "line-width": MARKER_BREITE, "line-opacity": 1 } });
  karte.addLayer({ id: "rb-kopf", type: "circle", source: "rb-kopf", paint: { "circle-radius": 7, "circle-color": TINTE, "circle-stroke-color": "#ffffff", "circle-stroke-width": 3 } });
  // A tapped open street: black dashes along its middle (Bauplan 4.5).
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

let erstesMalJetzt = new Map<string, number>();
function linienSammlung(stuecke: readonly Piece[]) {
  return {
    type: "FeatureCollection",
    features: stuecke.map((p) => {
      const t = erstesMalJetzt.get(p.id);
      return { type: "Feature", properties: { jahr: t ? new Date(t).getFullYear() : null, weg: p.kind === "path" }, geometry: { type: "LineString", coordinates: p.coords } };
    }),
  };
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
  const gewaehltRef = useRef(props.gewaehlt);
  const datenRef = useRef(props.daten);
  datenRef.current = props.daten;
  const waehlenRef = useRef(props.onWaehlen);
  waehlenRef.current = props.onWaehlen;
  // Latest seen streets and shares, so they can be drawn again whenever the map style (re)loads.
  const entdecktRef = useRef(props.entdeckt);
  entdecktRef.current = props.entdeckt;
  const gefahrenRef = useRef(props.gefahren);
  gefahrenRef.current = props.gefahren;
  const prozenteRef = useRef(props.prozente);
  prozenteRef.current = props.prozente;
  const stifteRef = useRef(props.stifte);
  stifteRef.current = props.stifte;
  erstesMalJetzt = props.erstesMal;
  const erstesMalRef = useRef(props.erstesMal);
  erstesMalRef.current = props.erstesMal;
  // Label of a tapped street: a small white sign at the street, moved with the map.
  const [etikett, setEtikett] = useState<EtikettZustand | null>(null);
  const schild = useRef<{ marker: Marker; el: HTMLDivElement } | null>(null);
  const dunkelRef = useRef(false);
  // Map service unreachable (Bauplan 3, C3): grey area with a sentence and "Nochmal".
  const [kaputt, setKaputt] = useState(false);
  const pruefUhr = useRef(0);
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
    // The style must arrive within 12 s; a failed style request shows the grey area at once.
    const pruefen = () => {
      window.clearTimeout(pruefUhr.current);
      pruefUhr.current = window.setTimeout(() => !karte.isStyleLoaded() && setKaputt(true), 12_000);
    };
    pruefen();
    (karte as unknown as { nochmal: () => void }).nochmal = () => {
      setKaputt(false);
      pruefen();
      karte.setStyle(STIL_ADRESSE, { diff: false });
    };
    karte.on("error", () => {
      if (!karte.isStyleLoaded()) setKaputt(true);
    });
    karte.on("style.load", () => {
      window.clearTimeout(pruefUhr.current);
      setKaputt(false);
    });
    karte.touchZoomRotate.disableRotation();
    karte.addControl(new ScaleControl({ unit: "metric", maxWidth: 90 }), "bottom-left");

    // Runs after every style load (also after switching light/dark). Seen streets and area shares
    // may have arrived before the style; draw them now so nothing gets lost.
    karte.on("style.load", () => {
      animation.current?.ende();
      eigenesZeichnen(karte);
      stifteSetzen(karte, stifteRef.current);
      setzeDaten(karte, "entdeckt", linienSammlung(entdecktRef.current));
      setzeDaten(karte, "gefahren", linienSammlung(gefahrenRef.current));
      if (datenRef.current)
        void gebieteZeichnen(karte, dunkelRef.current, datenRef.current, gewaehltRef.current).then(() => prozenteSetzen(karte, datenRef.current, prozenteRef.current));
    });
    karte.on("click", async (e: MapLayerMouseEvent) => {
      // Close up, a tap on a street shows its label; otherwise (and zoomed out) it chooses the area.
      if (karte.getZoom() >= 14) {
        const punkt: [number, number] = [e.lngLat.lng, e.lngLat.lat];
        const meterProPixel = (40075016 * Math.cos((punkt[1] * Math.PI) / 180)) / (512 * 2 ** karte.getZoom());
        const radiusM = Math.max(6, 16 * meterProPixel);
        const strasse = await etikettAn(punkt, radiusM);
        if (strasse) return setEtikett({ punkt, strasse, art: null });
        const pad = 10;
        const box: [[number, number], [number, number]] = [[e.point.x - pad, e.point.y - pad], [e.point.x + pad, e.point.y + pad]];
        const neben = karte.getLayer("plan-nebenweg") ? karte.queryRenderedFeatures(box, { layers: ["plan-nebenweg"] })[0] : undefined;
        if (neben) return setEtikett({ punkt, strasse: null, art: String(neben.properties?.class ?? ""), name: (neben.properties?.name as string | undefined) ?? null });
      }
      setEtikett(null);
      const ebenen = (datenRef.current?.liste ?? []).map((r) => `flaeche-${r.id}`).filter((l) => karte.getLayer(l));
      const treffer = ebenen.length ? karte.queryRenderedFeatures(e.point, { layers: ebenen }) : [];
      const id = treffer[0]?.properties?.id;
      if (id) waehlenRef.current(String(id));
    });
    karte.on("dragstart", () => setEtikett(null));
    karte.on("zoomstart", () => setEtikett(null));

    const wechsel = (e: MediaQueryListEvent) => {
      dunkelRef.current = e.matches;
      // Same base style, recolored: reload fully so our own layers are added again.
      karte.setStyle(STIL_ADRESSE, { diff: false });
    };
    dunkel.addEventListener("change", wechsel);
    return () => {
      dunkel.removeEventListener("change", wechsel);
      window.clearTimeout(pruefUhr.current);
      animation.current?.ende();
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

  // Driven streets as a pen line.
  useEffect(() => {
    const karte = karteRef.current;
    if (karte?.getSource("gefahren")) setzeDaten(karte, "gefahren", linienSammlung(props.gefahren));
  }, [props.gefahren]);

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

  // Replay on opening: fit all new outings into view, then run along them once.
  const rbEnde = useRef(props.onRueckblickEnde);
  rbEnde.current = props.onRueckblickEnde;
  useEffect(() => {
    const karte = karteRef.current;
    const rb = props.rueckblick;
    if (!karte || !rb || rb.wege.length === 0) return;
    // Visible part of the sheet (it is moved down when small).
    const rahmen = document.querySelector(".blatt")?.getBoundingClientRect();
    const blatt = rahmen ? Math.max(0, karte.getContainer().getBoundingClientRect().bottom - rahmen.top) : 160;
    return rueckblickAbspielen(
      karte,
      { wege: rb.wege, seit: rb.seit, bis: rb.bis },
      {
        entdeckt: entdecktRef.current,
        erstesMal: erstesMalRef.current,
        zeichnen: (stuecke) => setzeDaten(karte, "entdeckt", linienSammlung(stuecke)),
        aktuell: () => entdecktRef.current,
        untenFrei: Math.min(blatt, karte.getContainer().clientHeight * 0.4),
        // A past day ends where its ways are, not at the chosen quarter.
        veedel: rb.bis === undefined ? veedelRahmen(gewaehltRef.current, datenRef.current) : null,
      },
      () => rbEnde.current(),
    );
  }, [props.rueckblick?.nr]);

  // Location button: move to the own position.
  useEffect(() => {
    const karte = karteRef.current;
    if (!karte || !props.position || props.zentrieren === 0) return;
    const ziel = { center: props.position, zoom: Math.max(karte.getZoom(), 15), padding: { top: 0, bottom: karte.getContainer().clientHeight * 0.45, left: 0, right: 0 } };
    if (ruhig()) karte.jumpTo(ziel);
    else karte.easeTo({ ...ziel, duration: 600 });
  }, [props.zentrieren]);

  // Pens: colours and year colours.
  useEffect(() => {
    const karte = karteRef.current;
    if (karte) stifteSetzen(karte, props.stifte);
  }, [props.stifte.marker, props.stifte.kuli, props.stifte.jahresFarben]);

  // The street label as a map marker (so it stays at the street).
  useEffect(() => {
    const karte = karteRef.current;
    if (!karte) return;
    if (!etikett) {
      schild.current?.marker.remove();
      return;
    }
    if (!schild.current) {
      const el = document.createElement("div");
      schild.current = { el, marker: new Marker({ element: el, anchor: "bottom", offset: [0, -10] }) };
    }
    schild.current.marker.setLngLat(etikett.punkt).addTo(karte);
  }, [etikett]);


  return (
    <>
      <div ref={box} className="karte" role="region" aria-label={t.karte.kartenRegion(props.gewaehltName)} />
      {kaputt && (
        <div className="karte-fehler" role="alert">
          <p>{t.karte.laedtNicht}</p>
          <button type="button" className="text-knopf" onClick={() => (karteRef.current as unknown as { nochmal?: () => void } | null)?.nochmal?.()}>
            {t.karte.nochmal}
          </button>
        </div>
      )}
      {etikett && schild.current && createPortal(<Schild z={etikett} schliessen={() => setEtikett(null)} />, schild.current.el)}
    </>
  );
}

type EtikettZustand = { punkt: [number, number]; strasse: Etikett | null; art: string | null; name?: string | null };

const tagMonatKurz = new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" });

/** Small white sign: name in bold; state in the second line; "Hier komme ich nicht hin" for counting streets. */
function Schild({ z, schliessen }: { z: EtikettZustand; schliessen: () => void }) {
  const s = z.strasse;
  const tx = t.etikett;
  const name = s?.name ?? z.name ?? tx.ohneName;
  const zeile = !s
    ? tx.zaehltNicht(tx.arten[z.art as keyof typeof tx.arten] ?? tx.arten.path)
    : s.ausnahme
      ? tx.ausgenommen
      : s.zustand === "aktiv"
        ? tx.gegangen(s.zeit ? tagMonatKurz.format(s.zeit) : "")
        : s.zustand === "gefahren"
          ? tx.gefahren(s.zeit ? tagMonatKurz.format(s.zeit) : "")
          : tx.offen(alsStrecke(s.restM));
  return (
    <div className="schild" role="dialog" aria-label={name} onClick={(e) => e.stopPropagation()}>
      <b>{name}</b>
      <span>{zeile}</span>
      {s && (
        <button
          type="button"
          className="text-knopf"
          onClick={() => {
            ausnahmeSetzen(s.id, !s.ausnahme);
            schliessen();
          }}
        >
          {s.ausnahme ? tx.zaehltDoch : tx.nichtHin}
        </button>
      )}
    </div>
  );
}

/** Bounds of an area from its loaded boundary. */
function veedelRahmen(id: string | null, daten: Regionen | null): [[number, number], [number, number]] | null {
  const regionId = id ? daten?.gebiete.get(id)?.regionId : undefined;
  const f = regionId ? fertigGeladen.get(regionId)?.gebiete.features.find((x) => String(x.properties.id) === id) : undefined;
  if (!f) return null;
  let [w, s, o, n] = [Infinity, Infinity, -Infinity, -Infinity];
  const gehen = (c: unknown): void => {
    if (Array.isArray(c) && typeof c[0] === "number") {
      const [x, y] = c as [number, number];
      [w, s, o, n] = [Math.min(w, x), Math.min(s, y), Math.max(o, x), Math.max(n, y)];
    } else if (Array.isArray(c)) for (const d of c) gehen(d);
  };
  gehen(f.geometry.coordinates);
  return Number.isFinite(w) ? [[w, s], [o, n]] : null;
}

/** Shares per area into the area data: hatch density ("stufe") and the percentage under the name. */
function prozenteSetzen(karte: MapLibreMap, daten: Regionen | null, prozente: Map<string, number>) {
  if (!daten) return;
  for (const r of daten.liste) {
    const d = fertigGeladen.get(r.id);
    if (!d || !karte.getSource(`gebiete-${r.id}`)) continue;
    for (const sammlung of [d.gebiete, d.namen])
      for (const f of sammlung.features) {
        const p = prozente.get(String(f.properties.id)) ?? 0;
        if (p > 0) {
          f.properties.stufe = stufeVon(p);
          f.properties.pt = `${prozentText(p)} %`;
        } else {
          delete f.properties.stufe;
          delete f.properties.pt;
        }
      }
    setzeDaten(karte, `gebiete-${r.id}`, d.gebiete);
    setzeDaten(karte, `namen-${r.id}`, d.namen);
  }
}

/** Applies the pen colours to all highlighter and pen layers. */
function stifteSetzen(karte: MapLibreMap, st: Stifte) {
  MARKER = st.jahresFarben ? jahresFarbe(new Date().getFullYear()).farbe : st.marker;
  KULI = st.kuli;
  if (!karte.getLayer("entdeckt")) return;
  karte.setPaintProperty("entdeckt", "line-color", markerFarbe(st) as never);
  karte.setPaintProperty("entdeckt-weg", "line-color", markerFarbe(st) as never);
  karte.setPaintProperty("gefahren", "line-color", KULI);
  for (const l of ["rb", "rb-glanz", "neu-glanz"]) karte.setPaintProperty(l, "line-color", MARKER);
  schraffurBilder(karte, MARKER);
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
    }).catch(() => undefined);
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
