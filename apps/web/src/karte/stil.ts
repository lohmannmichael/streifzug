import type { ExpressionSpecification, LayerSpecification, StyleSpecification } from "maplibre-gl";

/** Base map data: OpenFreeMap "Positron" (layers and data), redrawn as a printed city plan. */
export const STIL_ADRESSE = "https://tiles.openfreemap.org/styles/positron";

/**
 * Plan style (docs/PLAN.md, section 4.5): a printed city plan someone has used. Paper white,
 * streets white with a black outline, grey houses, pale green parks, pale blue water,
 * railways as a black-and-white dashed line. Only streets that count are drawn as white
 * streets; driveways, tracks and paths are hairlines from zoom 15.
 */
export const FARBEN = {
  hell: {
    papier: "#fbfbf8",
    strasse: "#ffffff",
    rand: "#151515",
    haus: "#d2d4d0",
    park: "#dce8ce",
    wasser: "#cbdde8",
    nebenweg: "#c9cbc7",
    grenze: "#8c4f8c",
    schrift: "#151515",
    schriftLeise: "#5a5a56",
    hof: "#fbfbf8",
  },
  // [ANNAHME im Bauplan: dunkel nicht entworfen, so abgeleitet]
  dunkel: {
    papier: "#17181a",
    strasse: "#2c2d31",
    rand: "#8b8c90",
    haus: "#26272a",
    park: "#1c2419",
    wasser: "#18222b",
    nebenweg: "#34353a",
    grenze: "#a873a8",
    schrift: "#ededea",
    schriftLeise: "#a2a29d",
    hof: "#17181a",
  },
};

export type Farben = typeof FARBEN.hell;

const QUELLE = "openmaptiles";
const LINIE: ExpressionSpecification = ["match", ["geometry-type"], ["LineString", "MultiLineString"], true, false];
const HAUPT = ["motorway", "trunk", "primary", "secondary", "tertiary"];

/** Width of a street (fill) by zoom; the outline adds 2 px (1 px each side), major streets more. */
function breite(haupt: boolean, rand: boolean): ExpressionSpecification {
  // At zoom 16: major 11.6 / 13.6 px, residential 7 / 8.8 px (Bauplan 4.5), scaled with the zoom.
  const w16 = haupt ? (rand ? 13.6 : 11.6) : rand ? 8.8 : 7;
  return ["interpolate", ["exponential", 2], ["zoom"], 12, Math.max(rand ? 1.6 : 0.8, w16 / 6), 14, w16 / 2.2, 16, w16, 18, w16 * 2.4];
}

/** Street width expression for a feature (major or residential), for layers drawn on top (highlighter). */
export function strassenBreite(extra: number): ExpressionSpecification {
  return ["interpolate", ["exponential", 2], ["zoom"], 12, 1.8 + extra / 2, 14, 3.2 + extra * 0.7, 16, 7 + extra, 18, 16.8 + extra * 1.5];
}

/** Own street layers: hairlines for what never counts, then all outlines, then all fills (clean junctions). */
function strassenEbenen(f: Farben): LayerSpecification[] {
  const klasse = ["get", "class"] as ExpressionSpecification;
  const wohn: ExpressionSpecification = ["all", LINIE, ["==", klasse, "minor"]];
  const haupt: ExpressionSpecification = ["all", LINIE, ["match", klasse, HAUPT, true, false]];
  // Zoom-dependent widths must be top-level expressions, so residential and major streets get own layers.
  const ebene = (id: string, filter: ExpressionSpecification, farbe: string, istHaupt: boolean, rand: boolean): LayerSpecification =>
    ({
      id,
      type: "line",
      source: QUELLE,
      "source-layer": "transportation",
      minzoom: 11,
      filter,
      layout: { "line-cap": "round", "line-join": "round" },
      // Zoomed far out the streets fade and the hatched Veedel take over (Bauplan 4.5).
      paint: { "line-color": farbe, "line-width": breite(istHaupt, rand), "line-opacity": ["interpolate", ["linear"], ["zoom"], 11.4, 0, 12.4, 1] },
    }) as LayerSpecification;
  return [
    {
      id: "plan-nebenweg",
      type: "line",
      source: QUELLE,
      "source-layer": "transportation",
      // From zoom 14, so a walked path in a park is visible under its yellow line.
      minzoom: 14,
      filter: ["all", LINIE, ["match", klasse, ["service", "track", "path"], true, false]],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": f.nebenweg, "line-width": 0.8 },
    } as LayerSpecification,
    ebene("plan-rand-wohn", wohn, f.rand, false, true),
    ebene("plan-rand-haupt", haupt, f.rand, true, true),
    ebene("plan-strasse-wohn", wohn, f.strasse, false, false),
    ebene("plan-strasse-haupt", haupt, f.strasse, true, false),
  ] as LayerSpecification[];
}

const WEG_STRASSEN = /^(highway_(path|minor|major|motorway)|tunnel_motorway|road_)/;
// Road shields add noise (and log warnings for missing data); the plan stays calm without them.
const WEG = /shield|landcover_(ice|glacier)|aeroway/;

function farbe(l: LayerSpecification, f: Farben): Record<string, unknown> | null {
  const id = l.id;
  if (id === "background") return { "background-color": f.papier };
  if (id === "park" || id === "landcover_wood") return { "fill-color": f.park };
  if (id === "landuse_residential") return { "fill-color": f.papier };
  if (id === "water") return { "fill-color": f.wasser };
  if (id === "waterway") return { "line-color": f.wasser };
  if (id === "building") return { "fill-color": f.haus, "fill-outline-color": f.haus };
  if (/^railway.*dashline$/.test(id)) return { "line-color": f.papier };
  if (/^railway/.test(id)) return { "line-color": f.rand };
  if (/^boundary/.test(id)) return { "line-color": f.nebenweg };
  if (l.type === "symbol") {
    const leise = /^(waterway|water_name|airport|label_other|label_state)/.test(id);
    return { "text-color": leise ? f.schriftLeise : f.schrift, "text-halo-color": f.hof, "text-halo-width": 1.4 };
  }
  return null;
}

export function stadtplan(stil: StyleSpecification, dunkel: boolean): StyleSpecification {
  const f = dunkel ? FARBEN.dunkel : FARBEN.hell;
  const layers: LayerSpecification[] = [];
  let strassenDrin = false;
  for (const l of stil.layers) {
    if (WEG.test(l.id)) continue;
    if (WEG_STRASSEN.test(l.id)) {
      // All of the base map's road layers are replaced by our own, at the place of the first one.
      if (!strassenDrin) layers.push(...strassenEbenen(f));
      strassenDrin = true;
      continue;
    }
    const neu = farbe(l, f);
    if (!neu) {
      layers.push(l);
      continue;
    }
    const paint: Record<string, unknown> = { ...(("paint" in l ? l.paint : {}) as Record<string, unknown>) };
    for (const [k, v] of Object.entries(neu)) if (k.startsWith(`${l.type}-`) || (l.type === "symbol" && k.startsWith("text-"))) paint[k] = v;
    if (/^railway/.test(l.id) && l.type === "line") paint["line-width"] = /dashline$/.test(l.id) ? 1.2 : 2.6;
    // Place and water names in German where the map has them ("Köln", not "Cologne").
    if (l.type === "symbol" && "source-layer" in l && /^(place|water_name|waterway|mountain_peak|poi)$/.test(String(l["source-layer"])))
      (l.layout as Record<string, unknown>)["text-field"] = ["coalesce", ["get", "name:de"], ["get", "name"]];
    if (l.id === "highway-name-major" || l.id === "highway-name-minor") (l.layout as Record<string, unknown>)["text-font"] = ["Noto Sans Bold"];
    layers.push({ ...l, paint } as LayerSpecification);
  }
  if (!strassenDrin) layers.push(...strassenEbenen(f));
  return { ...stil, layers };
}
