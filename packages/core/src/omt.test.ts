import { describe, expect, it } from "vitest";
import { classifyOmt } from "./omt";

const streets = { includePaths: false };
const withPaths = { includePaths: true };

describe("classifyOmt (OpenMapTiles transportation features)", () => {
  it.each(["primary", "secondary", "tertiary", "minor"])("counts class %s as street", (cls) => {
    expect(classifyOmt({ class: cls }, streets)).toBe("street");
  });

  it("counts trunk roads, but not when they are expressways (motorroad)", () => {
    expect(classifyOmt({ class: "trunk" }, streets)).toBe("street");
    expect(classifyOmt({ class: "trunk", expressway: 1 }, streets)).toBeNull();
  });

  it.each(["motorway", "service", "track", "raceway", "busway", "ferry", "rail", "transit", "minor_construction"])(
    "never counts class %s",
    (cls) => {
      expect(classifyOmt({ class: cls }, withPaths)).toBeNull();
    },
  );

  it("counts pedestrian zones as streets", () => {
    expect(classifyOmt({ class: "path", subclass: "pedestrian" }, streets)).toBe("street");
  });

  it.each(["footway", "cycleway", "path", "steps", "bridleway"])("counts path subclass %s only with the switch", (sub) => {
    expect(classifyOmt({ class: "path", subclass: sub }, streets)).toBeNull();
    expect(classifyOmt({ class: "path", subclass: sub }, withPaths)).toBe("path");
  });

  it("ignores platforms and indoor corridors", () => {
    expect(classifyOmt({ class: "path", subclass: "platform" }, withPaths)).toBeNull();
    expect(classifyOmt({ class: "path", subclass: "corridor" }, withPaths)).toBeNull();
    expect(classifyOmt({ class: "path", subclass: "footway", indoor: 1 }, withPaths)).toBeNull();
  });

  it("respects closed access unless walking or cycling is allowed", () => {
    expect(classifyOmt({ class: "minor", access: "no" }, streets)).toBeNull();
    expect(classifyOmt({ class: "minor", access: "no", foot: "yes" }, streets)).toBe("street");
  });
});
