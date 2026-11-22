import { UEBERBLICK_ZOOM } from "@streifzug/core";
import type { FilterSpecification, Map as MapLibreMap } from "maplibre-gl";
import { ortDatei, prozentText, type Regionen } from "../daten/regionen";
import { setzeDaten } from "./ebenen";
import { FARBEN } from "./stil";

/** Area boundaries and names of all regions, and the hatching by discovered share. */

type FeatureSammlung = { type: "FeatureCollection"; features: { properties: Record<string, unknown>; geometry: { coordinates: unknown } }[] };

const geladen = new Map<string, Promise<{ gebiete: FeatureSammlung; namen: FeatureSammlung }>>();
const fertigGeladen = new Map<string, { gebiete: FeatureSammlung; namen: FeatureSammlung }>();

/** Boundaries and label points of one region, with a flag for the smallest areas ("blatt"). */
export function ladeRegion(id: string, daten: Regionen) {
  let p = geladen.get(id);
  const region = daten.liste.find((r) => r.id === id);
  if (!p && region) {
    const holen = (datei: string) =>
      fetch(ortDatei(region, datei)).then((r) => {
        if (!r.ok) throw new Error(`${id} ${r.status}`);
        return r.json() as Promise<FeatureSammlung>;
      });
    p = Promise.all([holen("gebiete.geojson"), holen("namen.geojson")]).then(([gebiete, namen]) => {
      for (const sammlung of [gebiete, namen])
        for (const f of sammlung.features) f.properties.blatt = (daten.gebiete.get(String(f.properties.id))?.kinder.length ?? 0) === 0;
      fertigGeladen.set(id, { gebiete, namen });
      return { gebiete, namen };
    });
    // Failed (no network): asked again next time.
    p.catch(() => geladen.delete(id));
    geladen.set(id, p);
  }
  return p ?? Promise.reject(new Error(`unbekannter Ort ${id}`));
}

/** Draws all loaded places: thin lines for the smallest areas, thicker ones for the levels above. */
export async function gebieteZeichnen(karte: MapLibreMap, dunkel: boolean, daten: Regionen, gewaehlt: string | null) {
  const f = dunkel ? FARBEN.dunkel : FARBEN.hell;
  const linie = f.grenze;
  const halo = f.hof;
  // Area fills lie under the streets; borders above the streets but under the highlighter.
  const unterStrassen = karte.getLayer("plan-nebenweg") ? "plan-nebenweg" : undefined;
  const davor = karte.getLayer("gefahren") ? "gefahren" : undefined;

  for (const region of daten.liste) {
    if (!daten.geladen.has(region.id) || karte.getSource(`gebiete-${region.id}`)) continue;
    const geholt = await ladeRegion(region.id, daten).catch(() => null);
    if (!geholt) continue;
    const { gebiete, namen } = geholt;
    if (!karte.getStyle() || karte.getSource(`gebiete-${region.id}`)) continue;
    karte.addSource(`gebiete-${region.id}`, { type: "geojson", data: gebiete as never, promoteId: "id", attribution: "Grenzen: Overture Maps" });
    karte.addSource(`namen-${region.id}`, { type: "geojson", data: namen as never });

    // Areas for tapping (invisible), with a light ink tint on the chosen one when zoomed out.
    karte.addLayer(
      {
        id: `flaeche-${region.id}`,
        // Far out the overview takes over (Bauplan 3, F5).
        minzoom: UEBERBLICK_ZOOM,
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
        // Far out the overview takes over (Bauplan 3, F5).
        minzoom: UEBERBLICK_ZOOM,
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
    // A quarter at 100 %: finely hatched, also close up (Bauplan 3, F4).
    karte.addLayer(
      {
        id: `komplett-${region.id}`,
        type: "fill",
        source: `gebiete-${region.id}`,
        filter: ["all", ["==", ["get", "blatt"], true], ["==", ["coalesce", ["get", "stufe"], -1], 5]],
        minzoom: 12,
        paint: { "fill-pattern": "schraffur-fein", "fill-opacity": 0.45 },
      },
      unterStrassen,
    );
    karte.addLayer(
      {
        id: `linie-${region.id}`,
        // Far out the overview takes over (Bauplan 3, F5).
        minzoom: UEBERBLICK_ZOOM,
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
        // Far out the overview takes over (Bauplan 3, F5).
        minzoom: UEBERBLICK_ZOOM,
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

/** Bounding box of a (multi)polygon. */
export function boxVon(geo: { coordinates: unknown }): [number, number, number, number] | undefined {
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

const stufeVon = (p: number) => (p >= 100 ? 5 : p >= 75 ? 4 : p >= 50 ? 3 : p >= 25 ? 2 : p >= 10 ? 1 : 0);

/** Bounds of an area from its loaded boundary. */
export function veedelRahmen(id: string | null, daten: Regionen | null): [[number, number], [number, number]] | null {
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
export function prozenteSetzen(karte: MapLibreMap, daten: Regionen | null, prozente: Map<string, number>) {
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
