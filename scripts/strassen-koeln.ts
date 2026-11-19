// Builds street tiles and street totals per district for Cologne (Phase 1a).
//
// Street data: OpenStreetMap via the OpenFreeMap vector tiles (OpenMapTiles schema, zoom 14).
// Districts: apps/web/public/gebiete/koeln-stadtteile.geojson (Stadt Köln).
// Run: NODE_USE_ENV_PROXY=1 npx tsx scripts/strassen-koeln.ts
// Writes apps/web/public/strassen/14/<x>/<y>.json and apps/web/public/gebiete/koeln-summen.json.
import { VectorTile } from "@mapbox/vector-tile";
import { PbfReader as Protobuf } from "pbf";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import {
  TILE_ZOOM,
  classifyOmt,
  clipLine,
  lineLengthM,
  parallelWeights,
  pointAlong,
  pointInGeometry,
  splitWay,
  tileBounds,
  tileFor,
  type LonLat,
  type OmtTransportation,
  type PolygonGeometry,
} from "../packages/core/src/index";

interface Stadtteil {
  nr: string;
  name: string;
  bezirk: string;
  geometry: PolygonGeometry;
  bbox: [number, number, number, number];
}

const AUSGABE = "apps/web/public";
const KIND = { street: 0, path: 1 } as const;
const GROSS = new Set(["trunk", "primary", "secondary", "tertiary"]);

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

function findeStadtteil(p: LonLat, stadtteile: Stadtteil[]): Stadtteil | undefined {
  return stadtteile.find((st) => p[0] >= st.bbox[0] && p[0] <= st.bbox[2] && p[1] >= st.bbox[1] && p[1] <= st.bbox[3] && pointInGeometry(p, st.geometry));
}

const runden = (v: number) => Math.round(v * 1e5) / 1e5;

async function main() {
  const roh = JSON.parse(await readFile(`${AUSGABE}/gebiete/koeln-stadtteile.geojson`, "utf8"));
  const stadtteile: Stadtteil[] = roh.features.map((f: { properties: Record<string, unknown>; geometry: PolygonGeometry }) => ({
    nr: String(f.properties.nr),
    name: String(f.properties.name),
    bezirk: String(f.properties.bezirk),
    geometry: f.geometry,
    bbox: bboxOf(f.geometry),
  }));

  const stadtBox = stadtteile.reduce<[number, number, number, number]>(
    (b, st) => [Math.min(b[0], st.bbox[0]), Math.min(b[1], st.bbox[1]), Math.max(b[2], st.bbox[2]), Math.max(b[3], st.bbox[3])],
    [Infinity, Infinity, -Infinity, -Infinity],
  );
  const nw = tileFor([stadtBox[0], stadtBox[3]]);
  const se = tileFor([stadtBox[2], stadtBox[1]]);

  const tilejson = (await (await fetch("https://tiles.openfreemap.org/planet")).json()) as { tiles: string[] };
  const vorlage = tilejson.tiles[0]!;

  const summen = new Map<string, { strasse_m: number; weg_m: number }>();
  for (const st of stadtteile) summen.set(st.nr, { strasse_m: 0, weg_m: 0 });

  let kacheln = 0;
  let bytes = 0;
  for (let x = nw.x; x <= se.x; x++) {
    for (let y = nw.y; y <= se.y; y++) {
      const url = vorlage.replace("{z}", String(TILE_ZOOM)).replace("{x}", String(x)).replace("{y}", String(y));
      const antwort = await fetch(url);
      if (!antwort.ok) throw new Error(`Kachel ${x}/${y}: HTTP ${antwort.status}`);
      let daten = Buffer.from(await antwort.arrayBuffer());
      if (daten[0] === 0x1f && daten[1] === 0x8b) daten = gunzipSync(daten);
      const ebene = new VectorTile(new Protobuf(daten)).layers.transportation;
      const grenzen = tileBounds({ z: TILE_ZOOM, x, y });
      const linien: { art: "street" | "path"; major: boolean; coords: LonLat[] }[] = [];

      for (let i = 0; ebene && i < ebene.length; i++) {
        const feature = ebene.feature(i);
        const props = feature.properties as OmtTransportation;
        const art = classifyOmt(props, { includePaths: true });
        if (!art) continue;
        const geo = feature.toGeoJSON(x, y, TILE_ZOOM).geometry;
        const teile: LonLat[][] =
          geo.type === "LineString" ? [geo.coordinates as unknown as LonLat[]] : geo.type === "MultiLineString" ? (geo.coordinates as unknown as LonLat[][]) : [];
        for (const teil of teile)
          for (const stueck of clipLine(teil, grenzen))
            if (lineLengthM(stueck) >= 0.5) linien.push({ art, major: GROSS.has(String(props.class)), coords: stueck });
      }

      // 25 m pieces; dual carriageways count half per side.
      const stuecke = linien.flatMap((linie, lineId) => splitWay(lineId, linie.coords).map((seg) => ({ lineId, seg, major: linie.major })));
      const gewichte = parallelWeights(stuecke.map((s) => ({ lineId: s.lineId, major: s.major, coords: s.seg.coords })));
      const gewichtJeLinie = linien.map(() => [] as number[]);
      stuecke.forEach((s, i) => {
        const w = gewichte[i]!;
        gewichtJeLinie[s.lineId]!.push(w);
        // Totals: each piece goes to the district containing its middle.
        const st = findeStadtteil(pointAlong(s.seg.coords, s.seg.lengthM / 2), stadtteile);
        if (!st) return;
        const summe = summen.get(st.nr)!;
        if (linien[s.lineId]!.art === "street") summe.strasse_m += s.seg.lengthM * w;
        else summe.weg_m += s.seg.lengthM * w;
      });

      if (linien.length === 0) continue;
      // Line format: [kind (0 street, 1 path), flat coordinates, optional weight per 25 m piece].
      const datei = {
        v: 1,
        z: TILE_ZOOM,
        x,
        y,
        l: linien.map((linie, i) => {
          const eintrag: unknown[] = [KIND[linie.art], linie.coords.flatMap(([lon, lat]) => [runden(lon), runden(lat)])];
          if (gewichtJeLinie[i]!.some((w) => w !== 1)) eintrag.push(gewichtJeLinie[i]);
          return eintrag;
        }),
      };
      const json = JSON.stringify(datei);
      await mkdir(`${AUSGABE}/strassen/${TILE_ZOOM}/${x}`, { recursive: true });
      await writeFile(`${AUSGABE}/strassen/${TILE_ZOOM}/${x}/${y}.json`, json);
      kacheln++;
      bytes += json.length;
    }
  }

  const bezirke: Record<string, { strasse_m: number; weg_m: number }> = {};
  const stadt = { strasse_m: 0, weg_m: 0 };
  const proStadtteil: Record<string, { name: string; bezirk: string; strasse_m: number; weg_m: number }> = {};
  for (const st of stadtteile) {
    const s = summen.get(st.nr)!;
    proStadtteil[st.nr] = { name: st.name, bezirk: st.bezirk, strasse_m: Math.round(s.strasse_m), weg_m: Math.round(s.weg_m) };
    const b = (bezirke[st.bezirk] ??= { strasse_m: 0, weg_m: 0 });
    b.strasse_m += Math.round(s.strasse_m);
    b.weg_m += Math.round(s.weg_m);
    stadt.strasse_m += Math.round(s.strasse_m);
    stadt.weg_m += Math.round(s.weg_m);
  }
  const ergebnis = {
    stand: new Date().toISOString().slice(0, 10),
    quelle: `OpenStreetMap über OpenFreeMap (${vorlage.split("/")[4]})`,
    stadt,
    bezirke,
    stadtteile: proStadtteil,
  };
  await writeFile(`${AUSGABE}/gebiete/koeln-summen.json`, JSON.stringify(ergebnis, null, 1));
  console.log(`${kacheln} Kacheln, ${(bytes / 1e6).toFixed(1)} MB. Köln: ${(stadt.strasse_m / 1000).toFixed(0)} km Straßen, ${(stadt.weg_m / 1000).toFixed(0)} km Fuß-/Radwege.`);
}

await main();
