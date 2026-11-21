import { VectorTile } from "@mapbox/vector-tile";
import { nameNear, piecesFromTile, tileFor, TILE_ZOOM, type LonLat, type NamedLine, type OmtTransportation, type Piece, type Tile, type TileFeature } from "@streifzug/core";
import { PbfReader } from "pbf";

let vorlage: Promise<string> | null = null;
interface Kachel {
  stuecke: Piece[];
  /** Named street lines (OpenMapTiles layer "transportation_name"), for street names. */
  namen: NamedLine[];
}

const kacheln = new Map<string, Promise<Kachel>>();

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

function linienVon(geo: { type: string; coordinates?: unknown }): LonLat[][] {
  return geo.type === "LineString" ? [geo.coordinates as LonLat[]] : geo.type === "MultiLineString" ? (geo.coordinates as LonLat[][]) : [];
}

/** One zoom-14 tile, loaded and decoded once: counted pieces and named lines. */
function ladeKachel(tile: Tile): Promise<Kachel> {
  const key = `${tile.x}/${tile.y}`;
  let p = kacheln.get(key);
  if (!p) {
    p = (async () => {
      const url = (await tileUrl()).replace("{z}", String(TILE_ZOOM)).replace("{x}", String(tile.x)).replace("{y}", String(tile.y));
      const antwort = await fetch(url);
      if (!antwort.ok) return { stuecke: [], namen: [] };
      const vt = new VectorTile(new PbfReader(await bytes(antwort)));
      const ebene = vt.layers.transportation;
      const features: TileFeature[] = [];
      for (let i = 0; ebene && i < ebene.length; i++) {
        const f = ebene.feature(i);
        features.push({ props: f.properties as OmtTransportation, lines: linienVon(f.toGeoJSON(tile.x, tile.y, TILE_ZOOM).geometry) });
      }
      const namen: NamedLine[] = [];
      const namenEbene = vt.layers.transportation_name;
      for (let i = 0; namenEbene && i < namenEbene.length; i++) {
        const f = namenEbene.feature(i);
        const props = f.properties as Record<string, unknown>;
        const name = String(props["name:de"] ?? props.name_de ?? props.name ?? "").trim();
        if (!name) continue;
        for (const coords of linienVon(f.toGeoJSON(tile.x, tile.y, TILE_ZOOM).geometry)) namen.push({ name, coords });
      }
      return { stuecke: piecesFromTile(tile, features, { drive: true }), namen };
    })().catch(() => {
      kacheln.delete(key);
      return { stuecke: [], namen: [] };
    });
    kacheln.set(key, p);
  }
  return p;
}

/** Counted street pieces of one zoom-14 tile, from the same map data and rules as the region totals. */
export async function stueckeDerKachel(tile: Tile): Promise<Piece[]> {
  return (await ladeKachel(tile)).stuecke;
}

/** Street name of a piece ("Aachener Straße"), or null for unnamed ways. */
export async function strassenName(piece: Piece): Promise<string | null> {
  const [z, x, y] = piece.id.split(":")[0]!.split("/").map(Number);
  if (z === undefined || x === undefined || y === undefined) return null;
  return nameNear(piece.mid, (await ladeKachel({ z, x, y })).namen);
}

/** Pieces of the tile around a point and its eight neighbours (about 4 km square). */
export async function stueckeUm(punkt: LonLat): Promise<Piece[]> {
  const mitte = tileFor(punkt, TILE_ZOOM);
  const teile = await Promise.all(
    [-1, 0, 1].flatMap((dx) => [-1, 0, 1].map((dy) => stueckeDerKachel({ z: TILE_ZOOM, x: mitte.x + dx, y: mitte.y + dy }))),
  );
  return teile.flat();
}

/**
 * Name of the town or city at a point (OpenMapTiles layer "place", zoom-10 tile), in German
 * where the map has it. For places that have no region yet ("Lissabon wird vorbereitet").
 */
export async function ortsName(punkt: LonLat): Promise<string | null> {
  const z = 10;
  const tile = tileFor(punkt, z);
  try {
    const url = (await tileUrl()).replace("{z}", String(z)).replace("{x}", String(tile.x)).replace("{y}", String(tile.y));
    const antwort = await fetch(url);
    if (!antwort.ok) return null;
    const ebene = new VectorTile(new PbfReader(await bytes(antwort))).layers.place;
    const rang: Record<string, number> = { city: 0, town: 1, village: 2 };
    let best: { name: string; wert: number } | null = null;
    for (let i = 0; ebene && i < ebene.length; i++) {
      const f = ebene.feature(i);
      const props = f.properties as Record<string, unknown>;
      const r = rang[String(props.class)];
      if (r === undefined) continue;
      const geo = f.toGeoJSON(tile.x, tile.y, z).geometry as unknown as { type: string; coordinates: LonLat };
      if (geo.type !== "Point") continue;
      const dx = (geo.coordinates[0] - punkt[0]) * Math.cos((punkt[1] * Math.PI) / 180);
      const dy = geo.coordinates[1] - punkt[1];
      // Nearest place, larger places count as a little nearer (a village next to a city loses).
      const wert = Math.hypot(dx, dy) * (1 + r * 0.6);
      const name = String(props["name:de"] ?? props.name_de ?? props.name ?? "").trim();
      if (name && (!best || wert < best.wert)) best = { name, wert };
    }
    return best?.name ?? null;
  } catch {
    return null;
  }
}
