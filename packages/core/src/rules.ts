/**
 * Which OpenStreetMap ways count towards progress (see docs/PLAN.md, section 2).
 *
 * "street": always counts. "path": counts only with the paths switch on.
 * null: never counts.
 */
export type WayKind = "street" | "path";

export interface RuleOptions {
  /** Count footways, cycleways, paths, steps and bridleways. */
  includePaths: boolean;
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
    if (highway.startsWith("trunk") && tags.motorroad === "yes") return null;
    return "street";
  }

  if (PATHS.has(highway)) {
    if (isAlongsideStreet(tags)) return null;
    return options.includePaths ? "path" : null;
  }

  return null;
}

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
