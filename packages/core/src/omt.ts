import { classifyWay, type OsmTags, type RuleOptions, type WayKind } from "./rules";

/** Properties of a feature in the OpenMapTiles "transportation" layer. */
export interface OmtTransportation {
  class?: string;
  subclass?: string;
  access?: string;
  foot?: string;
  bicycle?: string;
  expressway?: number;
  indoor?: number;
}

const PATH_SUBCLASSES = new Set(["pedestrian", "footway", "cycleway", "path", "steps", "bridleway"]);

/**
 * Translates OpenMapTiles attributes back into OSM-style tags and applies our counting rules.
 * Limitation: OpenMapTiles does not mark sidewalks (footway=sidewalk), so with the paths switch on,
 * mapped sidewalks count as paths.
 */
export function omtToTags(p: OmtTransportation): OsmTags | null {
  if (p.indoor === 1) return null;
  const cls = p.class;
  if (!cls) return null;

  let highway: string;
  if (cls === "minor") highway = "residential";
  else if (cls === "path") {
    if (!p.subclass || !PATH_SUBCLASSES.has(p.subclass)) return null;
    highway = p.subclass;
  } else highway = cls;

  return {
    highway,
    motorroad: cls === "trunk" && p.expressway === 1 ? "yes" : undefined,
    access: p.access,
    foot: p.foot,
    bicycle: p.bicycle,
  };
}

export function classifyOmt(p: OmtTransportation, options: RuleOptions): WayKind | null {
  const tags = omtToTags(p);
  return tags ? classifyWay(tags, options) : null;
}
