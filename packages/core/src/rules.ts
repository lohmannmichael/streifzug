/**
 * Which OpenStreetMap ways count towards progress (see docs/PLAN.md, section 2).
 *
 * "street": counts. "path": counts only with the paths option (not used any more).
 * "drive": motorways and expressways, only drawn for car rides. null: never counts.
 */
export type WayKind = "street" | "path" | "drive";

export interface RuleOptions {
  /** Count footways, cycleways, paths, steps and bridleways. */
  includePaths: boolean;
  /** Also return motorways and expressways as "drive": shown for car rides, never counted. */
  includeDrive?: boolean;
}

export type OsmTags = Readonly<Record<string, string | undefined>>;

const STREETS = new Set([
  "residential",
  "living_street",
  "unclassified",
  "tertiary",
  "tertiary_link",
  "secondary",
  "secondary_link",
  "primary",
  "primary_link",
  "trunk",
  "trunk_link",
  "pedestrian",
]);

const PATHS = new Set(["footway", "cycleway", "path", "steps", "bridleway"]);

const ALLOWED = new Set(["yes", "designated", "permissive"]);

export function classifyWay(tags: OsmTags, options: RuleOptions): WayKind | null {
  const highway = tags.highway;
  if (!highway) return null;
  if (tags.area === "yes") return null;
  if (isClosed(tags)) return null;

  if (STREETS.has(highway)) {
    if (highway.startsWith("trunk") && tags.motorroad === "yes") return options.includeDrive ? "drive" : null;
    return "street";
  }

  if (highway === "motorway" || highway === "motorway_link") return options.includeDrive ? "drive" : null;

  if (PATHS.has(highway)) {
    if (isAlongsideStreet(tags)) return null;
    return options.includePaths ? "path" : null;
  }

  return null;
}

/**
 * Ways that never count but are drawn like paths once walked (Michi, 22.11.2026): tracks
 * (Wirtschaftswege in parks, woods, fields) always, service roads only from `NEBENWEG_ZUFAHRT_MIN_M`
 * on, so driveways and parking aisles stay out. Returns the minimum length, or null.
 */
export function nebenwegMindestlaenge(tags: OsmTags): number | null {
  if (tags.area === "yes" || isClosed(tags)) return null;
  if (tags.highway === "track") return 0;
  if (tags.highway === "service") return NEBENWEG_ZUFAHRT_MIN_M;
  return null;
}

export const NEBENWEG_ZUFAHRT_MIN_M = 100;

function isClosed(tags: OsmTags): boolean {
  if (tags.access !== "private" && tags.access !== "no") return false;
  const openOnFoot = tags.foot !== undefined && ALLOWED.has(tags.foot);
  const openByBike = tags.bicycle !== undefined && ALLOWED.has(tags.bicycle);
  return !(openOnFoot || openByBike);
}

/** Sidewalks and crossings belong to a street that is already counted. */
function isAlongsideStreet(tags: OsmTags): boolean {
  return (
    tags.footway === "sidewalk" ||
    tags.footway === "crossing" ||
    tags.cycleway === "crossing" ||
    tags.path === "sidewalk"
  );
}
