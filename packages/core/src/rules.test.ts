import { describe, expect, it } from "vitest";
import { classifyWay } from "./rules";

const streets = { includePaths: false };
const withPaths = { includePaths: true };

describe("classifyWay", () => {
  it.each([
    "residential",
    "living_street",
    "unclassified",
    "tertiary",
    "secondary",
    "primary",
    "tertiary_link",
    "primary_link",
    "pedestrian",
    "trunk",
  ])("counts %s as street", (highway) => {
    expect(classifyWay({ highway }, streets)).toBe("street");
  });

  it.each(["motorway", "motorway_link", "service", "track", "construction", "proposed", "bus_guideway", "raceway"])(
    "never counts %s",
    (highway) => {
      expect(classifyWay({ highway }, withPaths)).toBeNull();
    },
  );

  it("excludes trunk roads signed as motorroad", () => {
    expect(classifyWay({ highway: "trunk", motorroad: "yes" }, streets)).toBeNull();
  });

  it("excludes private and no-access ways", () => {
    expect(classifyWay({ highway: "residential", access: "private" }, streets)).toBeNull();
    expect(classifyWay({ highway: "residential", access: "no" }, streets)).toBeNull();
  });

  it("keeps no-access ways that allow walking or cycling", () => {
    expect(classifyWay({ highway: "pedestrian", access: "no", foot: "yes" }, streets)).toBe("street");
    expect(classifyWay({ highway: "residential", access: "no", bicycle: "designated" }, streets)).toBe("street");
  });

  it("excludes areas", () => {
    expect(classifyWay({ highway: "pedestrian", area: "yes" }, streets)).toBeNull();
  });

  it.each(["footway", "cycleway", "path", "steps", "bridleway"])("counts %s only with the paths switch", (highway) => {
    expect(classifyWay({ highway }, streets)).toBeNull();
    expect(classifyWay({ highway }, withPaths)).toBe("path");
  });

  it("never counts sidewalks and crossings, even with the paths switch", () => {
    expect(classifyWay({ highway: "footway", footway: "sidewalk" }, withPaths)).toBeNull();
    expect(classifyWay({ highway: "footway", footway: "crossing" }, withPaths)).toBeNull();
    expect(classifyWay({ highway: "cycleway", cycleway: "crossing" }, withPaths)).toBeNull();
    expect(classifyWay({ highway: "path", path: "sidewalk" }, withPaths)).toBeNull();
  });

  it("ignores ways without a highway tag", () => {
    expect(classifyWay({ railway: "tram" }, withPaths)).toBeNull();
  });
});
