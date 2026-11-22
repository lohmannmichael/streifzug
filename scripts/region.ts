// Builds one region for the app: boundaries, names and street totals for every area.
//
// Input:  regionen/<id>.json and .region-cache/<id>-overture.geojson (from scripts/regionen/overture.py)
// Output: apps/web/public/regionen/<id>/gebiete.geojson, namen.geojson, summen.json
//         and the list of all regions apps/web/public/regionen/index.json
// Streets: OpenStreetMap via the OpenFreeMap vector tiles (zoom 14), counted with packages/core.
// Run all steps with: npm run region -- <id>
import { VectorTile } from "@mapbox/vector-tile";
import mapshaper from "mapshaper";
import { PbfReader } from "pbf";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import {
  TILE_ZOOM,
  piecesFromTile,
  pointInGeometry,
  tileBounds,
  tileFor,
  type LonLat,
  type OmtTransportation,
  type PolygonGeometry,
  type TileFeature,
} from "../packages/core/src/index";

interface Gebiet {
  id: string;
  name: string;
  rang: number;
  eltern: string | null;
  geometry: PolygonGeometry;
  bbox: [number, number, number, number];
}

const AUSGABE = "apps/web/public/regionen";

function bboxOf(geometry: PolygonGeometry): [number, number, number, number] {
  const rings = geometry.type === "Polygon" ? geometry.coordinates : geometry.coordinates.flat();
  let [w, s, e, n] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const ring of rings)
    for (const [x, y] of ring) {
      w = Math.min(w, x);
      s = Math.min(s, y);
      e = Math.max(e, x);
      n = Math.max(n, y);
    }
  return [w, s, e, n];
}

const enthaelt = (g: Gebiet, p: LonLat) =>
  p[0] >= g.bbox[0] && p[0] <= g.bbox[2] && p[1] >= g.bbox[1] && p[1] <= g.bbox[3] && pointInGeometry(p, g.geometry);

async function ladeKachel(vorlage: string, x: number, y: number): Promise<Buffer> {
  const url = vorlage.replace("{z}", String(TILE_ZOOM)).replace("{x}", String(x)).replace("{y}", String(y));
  for (let versuch = 1; ; versuch++) {
    const antwort = await fetch(url).catch(() => null);
    if (antwort?.ok) {
      const daten = Buffer.from(await antwort.arrayBuffer());
      return daten[0] === 0x1f && daten[1] === 0x8b ? gunzipSync(daten) : daten;
    }
    if (antwort?.status === 404) return Buffer.alloc(0);
    if (versuch >= 4) throw new Error(`Kachel ${x}/${y}: ${antwort?.status ?? "keine Verbindung"}`);
    await new Promise((r) => setTimeout(r, 1000 * versuch));
  }
}

async function main() {
  const id = process.argv[2];
  if (!id) throw new Error("Region fehlt, z. B.: npm run region -- koeln");
  const konfig = JSON.parse(await readFile(`regionen/${id}.json`, "utf8")) as { id: string; name: string };
  const quelle = `.region-cache/${id}-overture.geojson`;
  const ziel = `${AUSGABE}/${id}`;
  await mkdir(ziel, { recursive: true });

  // Boundaries for the map: simplified on shared borders, plus one label point per area.
  await mapshaper.runCommands(`-i "${quelle}" -simplify interval=6 keep-shapes -o "${ziel}/gebiete.geojson" precision=0.00001 format=geojson`);
  await mapshaper.runCommands(`-i "${quelle}" -points inner -o "${ziel}/namen.geojson" precision=0.00001 format=geojson`);

  // Exact boundaries for counting.
  const roh = JSON.parse(await readFile(quelle, "utf8")) as { features: { properties: Omit<Gebiet, "geometry" | "bbox">; geometry: PolygonGeometry }[] };
  const gebiete: Gebiet[] = roh.features.map((f) => ({ ...f.properties, geometry: f.geometry, bbox: bboxOf(f.geometry) }));
  const wurzel = gebiete.find((g) => g.rang === 0);
  if (!wurzel) throw new Error("Kein Wurzelgebiet in den Overture-Daten");
  const nachRang = new Map<number, Gebiet[]>();
  for (const g of gebiete) (nachRang.get(g.rang) ?? nachRang.set(g.rang, []).get(g.rang)!).push(g);

  const summen = new Map(gebiete.map((g) => [g.id, { strasse_m: 0, weg_m: 0 }]));
  const nw = tileFor([wurzel.bbox[0], wurzel.bbox[3]]);
  const se = tileFor([wurzel.bbox[2], wurzel.bbox[1]]);
  const tilejson = (await (await fetch("https://tiles.openfreemap.org/planet")).json()) as { tiles: string[] };
  const vorlage = tilejson.tiles[0]!;

  let kacheln = 0;
  for (let x = nw.x; x <= se.x; x++)
    for (let y = nw.y; y <= se.y; y++) {
      const grenzen = tileBounds({ z: TILE_ZOOM, x, y });
      // Skip tiles that do not touch the region at all.
      if (grenzen.east < wurzel.bbox[0] || grenzen.west > wurzel.bbox[2] || grenzen.north < wurzel.bbox[1] || grenzen.south > wurzel.bbox[3]) continue;
      const daten = await ladeKachel(vorlage, x, y);
      if (daten.length === 0) continue;
      kacheln++;
      const ebene = new VectorTile(new PbfReader(daten)).layers.transportation;
      const features: TileFeature[] = [];
      for (let i = 0; ebene && i < ebene.length; i++) {
        const feature = ebene.feature(i);
        const geo = feature.toGeoJSON(x, y, TILE_ZOOM).geometry;
        const lines: LonLat[][] =
          geo.type === "LineString" ? [geo.coordinates as unknown as LonLat[]] : geo.type === "MultiLineString" ? (geo.coordinates as unknown as LonLat[][]) : [];
        features.push({ props: feature.properties as OmtTransportation, lines });
      }
      // Same pieces as on the device: counting rules, tile clipping, every street once (packages/core/src/pieces.ts).
      for (const piece of piecesFromTile({ z: TILE_ZOOM, x, y }, features)) {
        const mitte = piece.mid;
        if (!enthaelt(wurzel, mitte)) continue;
        const meter = piece.lengthM * piece.weight;
        const istStrasse = piece.kind === "street";
        // One area per level contains the piece.
        for (const liste of nachRang.values()) {
          const g = liste.find((kandidat) => enthaelt(kandidat, mitte));
          if (!g) continue;
          const summe = summen.get(g.id)!;
          if (istStrasse) summe.strasse_m += meter;
          else summe.weg_m += meter;
        }
      }
    }

  const ergebnis = {
    id,
    name: konfig.name,
    stand: new Date().toISOString().slice(0, 10),
    quellen: { grenzen: "Overture Maps (OpenStreetMap, ODbL)", strassen: `OpenStreetMap über OpenFreeMap (${vorlage.split("/")[4]})` },
    gebiete: Object.fromEntries(
      gebiete.map((g) => {
        const s = summen.get(g.id)!;
        // The root shows the display name from the config (e.g. "New York City" instead of "New York").
        return [g.id, { name: g.rang === 0 ? konfig.name : g.name, rang: g.rang, eltern: g.eltern, strasse_m: Math.round(s.strasse_m), weg_m: Math.round(s.weg_m) }];
      }),
    ),
  };
  await writeFile(`${ziel}/summen.json`, JSON.stringify(ergebnis));

  // Index of all built regions.
  const regionen = [];
  for (const eintrag of (await readdir(AUSGABE, { withFileTypes: true })).filter((e) => e.isDirectory())) {
    const s = JSON.parse(await readFile(`${AUSGABE}/${eintrag.name}/summen.json`, "utf8"));
    const w = Object.entries(s.gebiete as Record<string, { rang: number; strasse_m: number }>).find(([, g]) => g.rang === 0)!;
    const box = eintrag.name === id ? wurzel.bbox : (JSON.parse(await readFile(`${AUSGABE}/index.json`, "utf8").catch(() => "[]")) as { id: string; bbox: number[] }[]).find((r) => r.id === eintrag.name)?.bbox;
    // Country code from regionen/<id>.json (for "Länder" in the Pass), "DE" when missing.
    const land = (JSON.parse(await readFile(`regionen/${eintrag.name}.json`, "utf8").catch(() => "{}")) as { land?: string }).land ?? "DE";
    regionen.push({ id: eintrag.name, name: s.name, wurzel: w[0], bbox: box?.map((v) => Math.round(v * 1e4) / 1e4), stand: s.stand, land });
  }
  regionen.sort((a, b) => a.name.localeCompare(b.name, "de"));
  await writeFile(`${AUSGABE}/index.json`, JSON.stringify(regionen, null, 1));

  const anzahl = [...nachRang.entries()].sort(([a], [b]) => a - b).map(([r, l]) => `Ebene ${r}: ${l.length}`).join(", ");
  const w = summen.get(wurzel.id)!;
  console.log(`${konfig.name}: ${anzahl}; ${kacheln} Kacheln; ${(w.strasse_m / 1000).toFixed(1)} km Straßen, ${(w.weg_m / 1000).toFixed(1)} km Fuß-/Radwege.`);
}

await main();
