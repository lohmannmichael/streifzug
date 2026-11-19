import { VectorTile } from "@mapbox/vector-tile";
import { piecesFromTile, TILE_ZOOM, type LonLat, type OmtTransportation, type Piece, type Tile, type TileFeature } from "@streifzug/core";
import { PbfReader } from "pbf";

let vorlage: Promise<string> | null = null;
const kacheln = new Map<string, Promise<Piece[]>>();

function tileUrl(): Promise<string> {
  vorlage ??= fetch("https://tiles.openfreemap.org/planet")
    .then((r) => r.json() as Promise<{ tiles: string[] }>)
    .then((j) => j.tiles[0]!);
  return vorlage;
}

async function bytes(antwort: Response): Promise<Uint8Array> {
  const roh = new Uint8Array(await antwort.arrayBuffer());
  // Some servers send gzip without saying so; unpack it ourselves then.
  if (roh[0] === 0x1f && roh[1] === 0x8b) {
    const strom = new Blob([roh]).stream().pipeThrough(new DecompressionStream("gzip"));
    return new Uint8Array(await new Response(strom).arrayBuffer());
  }
  return roh;
}

/** Counted street pieces of one zoom-14 tile, from the same map data and rules as the region totals. */
export function stueckeDerKachel(tile: Tile): Promise<Piece[]> {
  const key = `${tile.x}/${tile.y}`;
  let p = kacheln.get(key);
  if (!p) {
    p = (async () => {
      const url = (await tileUrl()).replace("{z}", String(TILE_ZOOM)).replace("{x}", String(tile.x)).replace("{y}", String(tile.y));
      const antwort = await fetch(url);
      if (!antwort.ok) return [];
      const ebene = new VectorTile(new PbfReader(await bytes(antwort))).layers.transportation;
      const features: TileFeature[] = [];
      for (let i = 0; ebene && i < ebene.length; i++) {
        const f = ebene.feature(i);
        const geo = f.toGeoJSON(tile.x, tile.y, TILE_ZOOM).geometry;
        const lines: LonLat[][] =
          geo.type === "LineString" ? [geo.coordinates as unknown as LonLat[]] : geo.type === "MultiLineString" ? (geo.coordinates as unknown as LonLat[][]) : [];
        features.push({ props: f.properties as OmtTransportation, lines });
      }
      return piecesFromTile(tile, features);
    })().catch(() => {
      kacheln.delete(key);
      return [];
    });
    kacheln.set(key, p);
  }
  return p;
}
