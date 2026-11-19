import type { LonLat } from "./geo";

export type Ring = readonly LonLat[];
export type PolygonGeometry =
  | { type: "Polygon"; coordinates: readonly Ring[] }
  | { type: "MultiPolygon"; coordinates: readonly (readonly Ring[])[] };

/** Even-odd ray casting; rings after the first are holes. Good for city-scale shapes. */
export function pointInPolygon(point: LonLat, rings: readonly Ring[]): boolean {
  let inside = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i]!;
      const [xj, yj] = ring[j]!;
      const crosses = yi > point[1] !== yj > point[1] && point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi;
      if (crosses) inside = !inside;
    }
  }
  return inside;
}

export function pointInGeometry(point: LonLat, geometry: PolygonGeometry): boolean {
  if (geometry.type === "Polygon") return pointInPolygon(point, geometry.coordinates);
  return geometry.coordinates.some((polygon) => pointInPolygon(point, polygon));
}
