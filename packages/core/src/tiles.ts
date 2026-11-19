import type { LonLat } from "./geo";

/** Street data is cut into map tiles of this zoom level (about 1.5 × 1.5 km in Germany). */
export const TILE_ZOOM = 14;

export interface Tile {
  z: number;
  x: number;
  y: number;
}

export interface Bounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

/** The standard web-map tile that contains a point. */
export function tileFor(point: LonLat, z = TILE_ZOOM): Tile {
  const n = 2 ** z;
  const lat = point[1] * (Math.PI / 180);
  const x = Math.floor(((point[0] + 180) / 360) * n);
  const y = Math.floor(((1 - Math.log(Math.tan(lat) + 1 / Math.cos(lat)) / Math.PI) / 2) * n);
  return { z, x: clamp(x, 0, n - 1), y: clamp(y, 0, n - 1) };
}

export function tileId(tile: Tile): string {
  return `${tile.z}/${tile.x}/${tile.y}`;
}

export function tileBounds(tile: Tile): Bounds {
  const n = 2 ** tile.z;
  const lon = (x: number) => (x / n) * 360 - 180;
  const lat = (y: number) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))) * 180) / Math.PI;
  return { west: lon(tile.x), east: lon(tile.x + 1), north: lat(tile.y), south: lat(tile.y + 1) };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
