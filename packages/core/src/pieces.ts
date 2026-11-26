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
/** A footway at most this long that crosses a street is a crossing (Überweg; wide ones span two carriageways and tracks). */
const UEBERWEG_MAX_M = 50;

/**
 * Turns one street tile into counted pieces. Used by the region build (totals) and on the device
 * (what you have seen), so both always agree.
 */
export function piecesFromTile(tile: Tile, features: readonly TileFeature[], options: { drive?: boolean } = {}): Piece[] {
  const bounds = tileBounds(tile);
  const lines: { kind: Piece["kind"]; group: StreetGroup; coords: LonLat[]; kurz?: boolean }[] = [];
  for (const f of features) {
    const kind = classifyOmt(f.props, { includePaths: true, includeDrive: options.drive ?? false });
    if (!kind) continue;
    const group: StreetGroup = kind === "path" ? null : kind === "drive" || MAJOR.has(String(f.props.class)) ? "major" : "minor";
    for (const line of f.lines) {
      const kurz = kind === "path" && lineLengthM(line) <= UEBERWEG_MAX_M;
      for (const part of clipLine(line, bounds)) if (lineLengthM(part) >= 0.5) lines.push({ kind, group, coords: part, ...(kurz ? { kurz } : {}) });
    }
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
  // Crossings (Michi, 26.11.2026): OpenMapTiles does not mark footway=crossing, so a short footway
  // that crosses a street is taken as one. Its line stays in the list (the ids of all other pieces
  // stay the same), only its pieces are left out: a few meters of zebra crossing say nothing.
  const strassen = lines.filter((l) => l.kind !== "path");
  const ueberweg = new Set(lines.flatMap((l, i) => (l.kurz && strassen.some((s) => kreuzen(l.coords, s.coords)) ? [i] : [])));
  return raw.flatMap((r, i) => (ueberweg.has(r.lineId) ? [] : [{
    id: `${prefix}:${r.lineId}:${r.seg.index}`,
    kind: lines[r.lineId]!.kind,
    weight: weights[i]!,
    lengthM: r.seg.lengthM,
    coords: r.seg.coords,
    mid: pointAlong(r.seg.coords, r.seg.lengthM / 2),
  }]));
}

/** Whether two lines cross (a segment of one properly intersects a segment of the other). */
function kreuzen(a: readonly LonLat[], b: readonly LonLat[]): boolean {
  for (let i = 1; i < a.length; i++)
    for (let j = 1; j < b.length; j++) if (schneiden(a[i - 1]!, a[i]!, b[j - 1]!, b[j]!)) return true;
  return false;
}

function schneiden(p: LonLat, q: LonLat, r: LonLat, s: LonLat): boolean {
  const seite = (a: LonLat, b: LonLat, c: LonLat) => Math.sign((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));
  return seite(p, q, r) * seite(p, q, s) < 0 && seite(r, s, p) * seite(r, s, q) < 0;
}
