import type { StyleSpecification } from "maplibre-gl";

/** Base map: OpenFreeMap "Positron" (layers and data), recolored into our own "Stadtplan" look. */
export const STIL_ADRESSE = "https://tiles.openfreemap.org/styles/positron";

/**
 * "Stadtplan": a calm city plan in ink and fog grey with white streets, so the highlighter
 * yellow is the only loud thing. Light and dark share the same layers, only colors differ.
 */
const FARBEN = {
  hell: {
    grund: "#eceef1",
    wohnen: "#e6e9ed",
    gruen: "#dfe5e0",
    wasser: "#c9d3de",
    gebaeude: "#e0e3e8",
    gebaeudeRand: "#d3d8df",
    weg: "#f6f7f9",
    strasse: "#ffffff",
    strasseRand: "#cfd4db",
    autobahn: "#f7f8fa",
    autobahnRand: "#c2c8d1",
    bahn: "#c6ccd5",
    bahnStrich: "#eceef1",
    grenze: "#b3bac6",
    schrift: "#1e2a4a",
    schriftLeise: "#5b6475",
    hof: "#f4f5f7",
  },
  dunkel: {
    grund: "#151a21",
    wohnen: "#181e26",
    gruen: "#16201c",
    wasser: "#0c1724",
    gebaeude: "#1d232c",
    gebaeudeRand: "#262e3a",
    weg: "#262d38",
    strasse: "#333c4a",
    strasseRand: "#3b4555",
    autobahn: "#3a4454",
    autobahnRand: "#465163",
    bahn: "#2c3440",
    bahnStrich: "#12161c",
    grenze: "#3a4352",
    schrift: "#d7dce6",
    schriftLeise: "#8a94a8",
    hof: "#12161c",
  },
};

type Farben = typeof FARBEN.hell;

/** Paint colors per layer id (first match wins). */
const REGELN: [RegExp, (f: Farben) => Record<string, string>][] = [
  [/^background$/, (f) => ({ "background-color": f.grund })],
  [/^(park|landcover_wood)$/, (f) => ({ "fill-color": f.gruen })],
  [/^landcover_(ice|glacier)/, (f) => ({ "fill-color": f.grund })],
  [/^landuse_residential$/, (f) => ({ "fill-color": f.wohnen })],
  [/^water$/, (f) => ({ "fill-color": f.wasser })],
  [/^waterway$/, (f) => ({ "line-color": f.wasser })],
  [/^building$/, (f) => ({ "fill-color": f.gebaeude, "fill-outline-color": f.gebaeudeRand })],
  [/^road_(area_)?pier$/, (f) => ({ "fill-color": f.grund, "line-color": f.grund })],
  [/^aeroway-(area|runway)$/, (f) => ({ "fill-color": f.weg, "line-color": f.weg })],
  [/^aeroway-/, (f) => ({ "line-color": f.strasseRand })],
  [/^highway_path$/, (f) => ({ "line-color": f.weg })],
  [/^highway_minor$/, (f) => ({ "line-color": f.strasse })],
  [/^highway_major_casing$/, (f) => ({ "line-color": f.strasseRand })],
  [/^highway_major_(inner|subtle)$/, (f) => ({ "line-color": f.strasse })],
  [/motorway.*casing$/, (f) => ({ "line-color": f.autobahnRand })],
  [/motorway/, (f) => ({ "line-color": f.autobahn })],
  [/^railway.*dashline$/, (f) => ({ "line-color": f.bahnStrich })],
  [/^railway/, (f) => ({ "line-color": f.bahn })],
  [/^boundary/, (f) => ({ "line-color": f.grenze })],
  [/^(waterway_line_label|water_name)/, (f) => ({ "text-color": f.schriftLeise, "text-halo-color": f.hof })],
  [/^highway-name/, (f) => ({ "text-color": f.schriftLeise, "text-halo-color": f.hof })],
  [/^(airport|label_other|label_state)$/, (f) => ({ "text-color": f.schriftLeise, "text-halo-color": f.hof })],
  [/^label_/, (f) => ({ "text-color": f.schrift, "text-halo-color": f.hof })],
];

// Road shields add noise (and log warnings for missing data); the plan stays calm without them.
const WEG = /shield/;

export function stadtplan(stil: StyleSpecification, dunkel: boolean): StyleSpecification {
  const f = dunkel ? FARBEN.dunkel : FARBEN.hell;
  const layers = stil.layers
    .filter((l) => !WEG.test(l.id))
    .map((l) => {
      const regel = REGELN.find(([muster]) => muster.test(l.id));
      if (!regel) return l;
      const paint: Record<string, unknown> = { ...(("paint" in l ? l.paint : {}) as Record<string, unknown>) };
      // Only set color properties the layer type actually has.
      for (const [k, v] of Object.entries(regel[1](f))) if (k.startsWith(`${l.type}-`) || (l.type === "symbol" && k.startsWith("text-"))) paint[k] = v;
      return { ...l, paint } as typeof l;
    });
  return { ...stil, layers };
}
