import { lineLengthM, pointAlong, type LonLat } from "./geo";
import { clipLine } from "./clip";
import { classifyOmt, nebenwegOmt, type OmtTransportation } from "./omt";
import { parallelWeights, type StreetGroup } from "./parallel";
import { splitWay } from "./segments";
import { tileBounds, type Tile } from "./tiles";

/** One feature of the OpenMapTiles "transportation" layer, already in longitude/latitude. */
export interface TileFeature {
  props: OmtTransportation;
  lines: LonLat[][];
}

/** A piece of about 25 m of something that counts, with its weight (0.5 for each of two carriageways). */
export interface Piece {
  /** "<z>/<x>/<y>:<line>:<piece>", stable for the same tile data. */
  id: string;
  kind: "street" | "path" | "drive";
  weight: number;
  lengthM: number;
  coords: LonLat[];
  mid: LonLat;
}

const MAJOR = new Set(["trunk", "primary", "secondary", "tertiary"]);

/**
 * Turns one street tile into counted pieces. Used by the region build (totals) and on the device
 * (what you have seen), so both always agree.
 */
export function piecesFromTile(tile: Tile, features: readonly TileFeature[], options: { drive?: boolean } = {}): Piece[] {
  const bounds = tileBounds(tile);
  const lines: { kind: Piece["kind"]; group: StreetGroup; coords: LonLat[] }[] = [];
  for (const f of features) {
    const kind = classifyOmt(f.props, { includePaths: true, includeDrive: options.drive ?? false });
    if (!kind) continue;
    const group: StreetGroup = kind === "path" ? null : kind === "drive" || MAJOR.has(String(f.props.class)) ? "major" : "minor";
    for (const line of f.lines)
      for (const part of clipLine(line, bounds)) if (lineLengthM(part) >= 0.5) lines.push({ kind, group, coords: part });
  }
  // Tracks and long service roads: drawn as paths, never counted (Michi, 22.11.2026). Added after
  // all other lines, so the ids of the other pieces (stored results, exceptions) stay the same.
  for (const f of features) {
    if (classifyOmt(f.props, { includePaths: true, includeDrive: options.drive ?? false })) continue;
    const mindest = nebenwegOmt(f.props);
    if (mindest === null) continue;
    for (const line of f.lines) {
      if (lineLengthM(line) < mindest) continue;
      for (const part of clipLine(line, bounds)) if (lineLengthM(part) >= 0.5) lines.push({ kind: "path", group: null, coords: part });
    }
  }
  const raw = lines.flatMap((line, lineId) => splitWay(lineId, line.coords).map((seg) => ({ lineId, seg })));
  const weights = parallelWeights(raw.map((r) => ({ lineId: r.lineId, group: lines[r.lineId]!.group, coords: r.seg.coords })));
  const prefix = `${tile.z}/${tile.x}/${tile.y}`;
  return raw.map((r, i) => ({
    id: `${prefix}:${r.lineId}:${r.seg.index}`,
    kind: lines[r.lineId]!.kind,
    weight: weights[i]!,
    lengthM: r.seg.lengthM,
    coords: r.seg.coords,
    mid: pointAlong(r.seg.coords, r.seg.lengthM / 2),
  }));
}
