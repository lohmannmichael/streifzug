import type { Map as MapLibreMap } from "maplibre-gl";
import type { Piece } from "@streifzug/core";
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
}


export const LEER = { type: "FeatureCollection" as const, features: [] };

/** Own track and position, on top of everything. */
export function eigenesZeichnen(karte: MapLibreMap) {
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
  // Replay (Bauplan 3, F1): a thin ink line grows with the pen tip, a pen line for car rides;
  // it runs visibly over the yellow. An ink dot marks the tip.
  karte.addSource("rb", { type: "geojson", data: LEER });
  karte.addSource("rb-kopf", { type: "geojson", data: LEER });
  karte.addLayer({ id: "rb", type: "line", source: "rb", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": rbFarbe(), "line-width": ["interpolate", ["linear"], ["zoom"], 10, ["case", ["==", ["get", "zeitraum"], true], 2, ["==", ["get", "gefahren"], true], 2.4, 2], 15, ["case", ["==", ["get", "zeitraum"], true], 4, ["==", ["get", "gefahren"], true], 2.4, 2]], "line-opacity": 0.9 } });
  karte.addLayer({ id: "rb-kopf", type: "circle", source: "rb-kopf", paint: { "circle-radius": 5, "circle-color": TINTE, "circle-stroke-color": "#ffffff", "circle-stroke-width": 2 } });
  // A tapped open street: black dashes along its middle (Bauplan 4.5).
  karte.addSource("spur", { type: "geojson", data: LEER });
  karte.addSource("ich", { type: "geojson", data: LEER });
  // The live track is a thin ink line; what it unlocks turns yellow underneath.
  karte.addLayer({ id: "spur-kern", type: "line", source: "spur", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": TINTE, "line-width": 2, "line-dasharray": [2, 1.5] } });
  karte.addLayer({ id: "ich-hof", type: "circle", source: "ich", paint: { "circle-radius": 14, "circle-color": "#2b6ef2", "circle-opacity": 0.18 } });
  karte.addLayer({ id: "ich", type: "circle", source: "ich", paint: { "circle-radius": 7, "circle-color": "#2b6ef2", "circle-stroke-color": "#ffffff", "circle-stroke-width": 3 } });
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
  karte.setPaintProperty("rb", "line-color", rbFarbe());
  schraffurBilder(karte, MARKER);
}
