// Spot check: length of named streets inside one Cologne district, from the same vector tiles.
// Run: NODE_USE_ENV_PROXY=1 npx tsx scripts/strassenlaenge.ts 307 "Ostlandstraße" "Goethestraße"
import { VectorTile } from "@mapbox/vector-tile";
import { PbfReader } from "pbf";
import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { TILE_ZOOM, clipLine, pointAlong, pointInGeometry, splitWay, tileBounds, tileFor, type LonLat, type PolygonGeometry } from "../packages/core/src/index";

const [nr, ...namen] = process.argv.slice(2);
const roh = JSON.parse(await readFile("apps/web/public/gebiete/koeln-stadtteile.geojson", "utf8"));
const feature = roh.features.find((f: { properties: { nr: string } }) => f.properties.nr === nr);
if (!feature) throw new Error(`Stadtteil ${nr} nicht gefunden`);
const geometry = feature.geometry as PolygonGeometry;
const ringe = geometry.type === "Polygon" ? geometry.coordinates : geometry.coordinates.flat();
const punkte = ringe.flat();
const nw = tileFor([Math.min(...punkte.map((p) => p[0])), Math.max(...punkte.map((p) => p[1]))]);
const se = tileFor([Math.max(...punkte.map((p) => p[0])), Math.min(...punkte.map((p) => p[1]))]);
const vorlage = ((await (await fetch("https://tiles.openfreemap.org/planet")).json()) as { tiles: string[] }).tiles[0]!;

const laengen = new Map<string, number>(namen.map((n) => [n, 0]));
for (let x = nw.x; x <= se.x; x++)
  for (let y = nw.y; y <= se.y; y++) {
    let daten = Buffer.from(await (await fetch(vorlage.replace("{z}", "14").replace("{x}", String(x)).replace("{y}", String(y)))).arrayBuffer());
    if (daten[0] === 0x1f) daten = gunzipSync(daten);
    const ebene = new VectorTile(new PbfReader(daten)).layers.transportation_name;
    for (let i = 0; ebene && i < ebene.length; i++) {
      const f = ebene.feature(i);
      const name = String(f.properties["name:de"] ?? f.properties.name ?? "");
      if (!laengen.has(name)) continue;
      const geo = f.toGeoJSON(x, y, TILE_ZOOM).geometry;
      const teile = geo.type === "LineString" ? [geo.coordinates as unknown as LonLat[]] : geo.type === "MultiLineString" ? (geo.coordinates as unknown as LonLat[][]) : [];
      for (const teil of teile)
        for (const stueck of clipLine(teil, tileBounds({ z: TILE_ZOOM, x, y })))
          for (const seg of splitWay(0, stueck))
            if (pointInGeometry(pointAlong(seg.coords, seg.lengthM / 2), geometry)) laengen.set(name, laengen.get(name)! + seg.lengthM);
    }
  }
for (const [name, m] of laengen) console.log(`${name}: ${Math.round(m)} m im Stadtteil`);
