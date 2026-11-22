import type { Map as MapLibreMap } from "maplibre-gl";
import { lineLengthM, linienVerbinden, pointAlong, UEBERBLICK_ZOOM, type LonLat, type Piece } from "@streifzug/core";
import { ERSTES_JAHR, jahresFarbe, MARKER_FARBEN } from "../einstellungen";
import { strassenBreite } from "./stil";

/** Own map layers: highlighter yellow, red pen, replay trail, live track, own position. */

const TINTE = "#1e2a4a";
// Pens (Bauplan 4.2), set from the settings; the defaults are yellow highlighter and red pen.
let MARKER = "#ffe83a";
let KULI = "#d92b20";
// Same width for seen streets and the drawing moment.
// Highlighter: street width + 4 px (Bauplan 4.5).
const MARKER_BREITE = strassenBreite(4);

interface Stifte {
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
  // A quarter at 100 %: fine hatching, also close up (Bauplan 3, F4).
  const c = document.createElement("canvas");
  c.width = c.height = g;
  const x = c.getContext("2d")!;
  x.strokeStyle = farbe;
  x.lineWidth = 1.2;
  for (let o = -g; o <= g * 2; o += 8) {
    x.beginPath();
    x.moveTo(o, g);
    x.lineTo(o + g, 0);
    x.stroke();
  }
  const fein = x.getImageData(0, 0, g, g);
  if (karte.hasImage("schraffur-fein")) karte.updateImage("schraffur-fein", fein);
  else karte.addImage("schraffur-fein", fein, { pixelRatio: 2 });
}

/**
 * Complete streets (Bauplan 3, F4): their name on the plan, underlaid with the highlighter. The
 * base map's label of the same street is hidden so the name does not stand twice.
 */
const namenFilter = new Map<string, unknown>();
export function kompletteNamen(karte: MapLibreMap, strassen: readonly { name: string; coords: LonLat[][] }[]) {
  if (!karte.getSource("komplett")) return;
  // Long streets: the name along the line; short ones (the name would not fit): in their middle.
  const lang: unknown[] = [];
  const kurz: unknown[] = [];
  for (const s of strassen) {
    const linien = linienVerbinden(s.coords);
    const laenge = linien.reduce((m, l) => m + lineLengthM(l), 0);
    if (laenge >= 250) for (const l of linien) lang.push({ type: "Feature", properties: { name: s.name }, geometry: { type: "LineString", coordinates: l } });
    else {
      const l = [...linien].sort((a, b) => lineLengthM(b) - lineLengthM(a))[0];
      if (l) kurz.push({ type: "Feature", properties: { name: s.name }, geometry: { type: "Point", coordinates: pointAlong(l, lineLengthM(l) / 2) } });
    }
  }
  setzeDaten(karte, "komplett", { type: "FeatureCollection", features: lang } as never);
  setzeDaten(karte, "komplett-punkt", { type: "FeatureCollection", features: kurz } as never);
  const namen = strassen.map((s) => s.name);
  for (const l of karte.getStyle().layers) {
    if (l.type !== "symbol" || !("source-layer" in l) || l["source-layer"] !== "transportation_name") continue;
    if (!namenFilter.has(l.id)) namenFilter.set(l.id, l.filter ?? null);
    const alt = namenFilter.get(l.id);
    const ohne = ["!", ["in", ["coalesce", ["get", "name:de"], ["get", "name_de"], ["get", "name"]], ["literal", namen]]];
    karte.setFilter(l.id, (namen.length === 0 ? alt : alt ? ["all", alt, ohne] : ohne) as never);
  }
}

/** After a new style the base map's filters are its own again. */
export function namenFilterVergessen() {
  namenFilter.clear();
}


export const LEER = { type: "FeatureCollection" as const, features: [] };

/** Own track and position, on top of everything. */
export function eigenesZeichnen(karte: MapLibreMap) {
  if (karte.getSource("spur")) return;
  // Pen line and highlighter lie under the street names, so names stay readable (Bauplan 4.5).
  const vorSchrift = karte.getStyle().layers.find((l) => l.type === "symbol")?.id;
  // Driven streets: a thin pen line (Kuli), under the highlighter, so walking later paints over it.
  // Far out (below zoom 8.5, Bauplan 3, F5): all ways as fine lines, and a point per place.
  karte.addSource("ueberblick", { type: "geojson", data: LEER });
  karte.addLayer({ id: "ueberblick", type: "line", source: "ueberblick", maxzoom: UEBERBLICK_ZOOM, layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": ueberblickFarbe(), "line-width": ["interpolate", ["linear"], ["zoom"], 4, 1, 9, 1.6] } }, vorSchrift);
  karte.addSource("orte-punkte", { type: "geojson", data: LEER });
  karte.addLayer({ id: "orte-punkt", type: "circle", source: "orte-punkte", maxzoom: UEBERBLICK_ZOOM, paint: { "circle-radius": 6, "circle-color": TINTE, "circle-stroke-color": "#ffffff", "circle-stroke-width": 2 } });
  karte.addLayer({
    id: "orte-name",
    type: "symbol",
    source: "orte-punkte",
    maxzoom: UEBERBLICK_ZOOM,
    layout: { "text-field": ["get", "name"], "text-font": ["Noto Sans Bold"], "text-size": 13, "text-offset": [0, 1.1], "text-anchor": "top" },
    paint: { "text-color": TINTE, "text-halo-color": "#ffffff", "text-halo-width": 1.6 },
  });
  karte.addSource("gefahren", { type: "geojson", data: LEER });
  karte.addLayer({ id: "gefahren", type: "line", source: "gefahren", minzoom: UEBERBLICK_ZOOM, layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": KULI, "line-width": ["interpolate", ["linear"], ["zoom"], 11, 1.2, 16, 1.8, 18, 2.4], "line-offset": 1, "line-opacity": 0.95 } }, vorSchrift);
  karte.addSource("entdeckt", { type: "geojson", data: LEER });
  karte.addLayer({ id: "entdeckt", type: "line", source: "entdeckt", filter: ["!=", ["get", "weg"], true], layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": MARKER, "line-width": MARKER_BREITE, "line-opacity": ["interpolate", ["linear"], ["zoom"], 11.4, 0, 12.4, 1] } }, vorSchrift);
  // Paths (parks, Tierpark): a thinner highlighter stroke; they are shown but never counted.
  karte.addLayer({ id: "entdeckt-weg", type: "line", source: "entdeckt", filter: ["==", ["get", "weg"], true], minzoom: 13, layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": MARKER, "line-width": ["interpolate", ["linear"], ["zoom"], 13, 2, 16, 4, 18, 7], "line-opacity": 1 } }, vorSchrift);
  // Drawing moment: a soft glow and the highlighter stroke running along the new street (line-progress needs lineMetrics).
  karte.addSource("neu", { type: "geojson", data: LEER, lineMetrics: true });
  karte.addLayer({ id: "neu-glanz", type: "line", source: "neu", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": MARKER, "line-width": ["interpolate", ["linear"], ["zoom"], 11, 10, 16, 26], "line-blur": 8, "line-opacity": 0 } });
  karte.addLayer({ id: "neu", type: "line", source: "neu", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-width": MARKER_BREITE, "line-opacity": 0.9, "line-gradient": strich(0) } });
  // Replay (Bauplan 3, F1): a thin ink line grows with the pen tip, a pen line for car rides;
  // it runs visibly over the yellow. An ink dot marks the tip.
  karte.addSource("rb", { type: "geojson", data: LEER });
  karte.addSource("rb-kopf", { type: "geojson", data: LEER });
  karte.addLayer({ id: "rb", type: "line", source: "rb", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": rbFarbe(), "line-width": ["interpolate", ["linear"], ["zoom"], 10, ["case", ["==", ["get", "zeitraum"], true], 2, ["==", ["get", "gefahren"], true], 2.4, 2], 15, ["case", ["==", ["get", "zeitraum"], true], 4, ["==", ["get", "gefahren"], true], 2.4, 2]], "line-opacity": 0.9 } });
  karte.addLayer({ id: "rb-kopf", type: "circle", source: "rb-kopf", paint: { "circle-radius": 5, "circle-color": TINTE, "circle-stroke-color": "#ffffff", "circle-stroke-width": 2 } });
  // Complete streets: the name along the street on a highlighter stroke (Bauplan 3, F4).
  karte.addSource("komplett", { type: "geojson", data: LEER });
  karte.addLayer({
    id: "komplett-name",
    type: "symbol",
    source: "komplett",
    minzoom: 14,
    layout: { "symbol-placement": "line", "text-field": ["get", "name"], "text-font": ["Noto Sans Bold"], "text-size": ["interpolate", ["linear"], ["zoom"], 14, 11, 18, 15], "text-max-angle": 30, "symbol-spacing": 400 },
    paint: { "text-color": TINTE, "text-halo-color": MARKER, "text-halo-width": 3 },
  });
  karte.addSource("komplett-punkt", { type: "geojson", data: LEER });
  karte.addLayer({
    id: "komplett-punkt",
    type: "symbol",
    source: "komplett-punkt",
    minzoom: 14,
    layout: { "text-field": ["get", "name"], "text-font": ["Noto Sans Bold"], "text-size": ["interpolate", ["linear"], ["zoom"], 14, 11, 18, 15] },
    paint: { "text-color": TINTE, "text-halo-color": MARKER, "text-halo-width": 3 },
  });
  // A tapped open street: black dashes along its middle (Bauplan 4.5).
  karte.addSource("spur", { type: "geojson", data: LEER });
  karte.addSource("ich", { type: "geojson", data: LEER });
  // The live track is a thin ink line; what it unlocks turns yellow underneath.
  karte.addLayer({ id: "spur-kern", type: "line", source: "spur", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": TINTE, "line-width": 2, "line-dasharray": [2, 1.5] } });
  karte.addLayer({ id: "ich-hof", type: "circle", source: "ich", paint: { "circle-radius": 14, "circle-color": "#2b6ef2", "circle-opacity": 0.18 } });
  karte.addLayer({ id: "ich", type: "circle", source: "ich", paint: { "circle-radius": 7, "circle-color": "#2b6ef2", "circle-stroke-color": "#ffffff", "circle-stroke-width": 3 } });
}

/** Overview lines: highlighter for walked, pen for driven. */
function ueberblickFarbe() {
  return ["case", ["==", ["get", "rot"], true], KULI, MARKER] as never;
}

/** Overview far out: fine lines of all ways and a point per place with ways (Bauplan 3, F5). */
export function ueberblickSetzen(karte: MapLibreMap, linien: { gelb: LonLat[][]; rot: LonLat[][] } | undefined, orte: readonly { id: string; name: string; punkt: LonLat }[]) {
  if (!karte.getSource("ueberblick")) return;
  setzeDaten(karte, "ueberblick", {
    type: "FeatureCollection",
    features: [
      ...(linien?.rot.length ? [{ type: "Feature", properties: { rot: true }, geometry: { type: "MultiLineString", coordinates: linien.rot } }] : []),
      ...(linien?.gelb.length ? [{ type: "Feature", properties: { rot: false }, geometry: { type: "MultiLineString", coordinates: linien.gelb } }] : []),
    ],
  });
  setzeDaten(karte, "orte-punkte", {
    type: "FeatureCollection",
    features: orte.map((o) => ({ type: "Feature", properties: { id: o.id, name: o.name }, geometry: { type: "Point", coordinates: o.punkt } })),
  });
}

/** Replay line: ink, red pen for car rides. */
function rbFarbe() {
  return ["case", ["==", ["get", "zeitraum"], true], MARKER, ["==", ["get", "gefahren"], true], KULI, TINTE] as never;
}

/** Highlighter stroke up to share p (0–1) of each line. */
export function strich(p: number) {
  return ["step", ["line-progress"], MARKER, Math.min(1, Math.max(0.001, p)), "rgba(255, 225, 74, 0)"] as never;
}

// When each seen piece was first walked (year colours); set by the map on every render.
let erstesMalJetzt = new Map<string, number>();
export const erstesMalSetzen = (m: Map<string, number>) => (erstesMalJetzt = m);
export function linienSammlung(stuecke: readonly Piece[]) {
  return {
    type: "FeatureCollection",
    features: stuecke.map((p) => {
      const t = erstesMalJetzt.get(p.id);
      return { type: "Feature", properties: { jahr: t ? new Date(t).getFullYear() : null, weg: p.kind === "path" }, geometry: { type: "LineString", coordinates: p.coords } };
    }),
  };
}

export function setzeDaten(karte: MapLibreMap, quelle: string, data: unknown) {
  const q = karte.getSource(quelle) as { setData?: (d: unknown) => void } | undefined;
  q?.setData?.(data);
}

/** Applies the pen colours to all highlighter and pen layers. */
export function stifteSetzen(karte: MapLibreMap, st: Stifte) {
  MARKER = st.jahresFarben ? jahresFarbe(new Date().getFullYear()).farbe : st.marker;
  KULI = st.kuli;
  if (!karte.getLayer("entdeckt")) return;
  karte.setPaintProperty("entdeckt", "line-color", markerFarbe(st) as never);
  karte.setPaintProperty("entdeckt-weg", "line-color", markerFarbe(st) as never);
  karte.setPaintProperty("gefahren", "line-color", KULI);
  karte.setPaintProperty("neu-glanz", "line-color", MARKER);
  karte.setPaintProperty("ueberblick", "line-color", ueberblickFarbe());
  for (const l of ["komplett-name", "komplett-punkt"]) if (karte.getLayer(l)) karte.setPaintProperty(l, "text-halo-color", MARKER);
  karte.setPaintProperty("rb", "line-color", rbFarbe());
  schraffurBilder(karte, MARKER);
}
