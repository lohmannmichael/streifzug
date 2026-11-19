import { lineLengthM, sliceLine, type LonLat } from "./geo";

/** Target length of a street piece in meters. */
export const SEGMENT_TARGET_M = 25;

export interface Segment {
  /** Stable id: "<OSM way id>:<position>". */
  id: string;
  wayId: number;
  index: number;
  coords: LonLat[];
  lengthM: number;
}

/**
 * Splits an OSM way into pieces of roughly equal length close to 25 m.
 * The same geometry always gives the same pieces and ids.
 */
export function splitWay(wayId: number, coords: readonly LonLat[], targetM = SEGMENT_TARGET_M): Segment[] {
  const total = lineLengthM(coords);
  if (total === 0) return [];

  const count = Math.max(1, Math.round(total / targetM));
  const pieceM = total / count;
  const segments: Segment[] = [];
  for (let index = 0; index < count; index++) {
    const piece = sliceLine(coords, index * pieceM, (index + 1) * pieceM);
    segments.push({ id: `${wayId}:${index}`, wayId, index, coords: piece, lengthM: lineLengthM(piece) });
  }
  return segments;
}
