import { describe, expect, it } from "vitest";
import type { LonLat } from "./geo";
import { pointInPolygon, pointInGeometry } from "./polygon";

// A 1 × 1 square with a 0.5 × 0.5 hole in the middle.
const outer: LonLat[] = [[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]];
const hole: LonLat[] = [[0.25, 0.25], [0.75, 0.25], [0.75, 0.75], [0.25, 0.75], [0.25, 0.25]];

describe("pointInPolygon", () => {
  it("finds a point inside", () => {
    expect(pointInPolygon([0.1, 0.1], [outer])).toBe(true);
  });

  it("rejects a point outside", () => {
    expect(pointInPolygon([1.5, 0.5], [outer])).toBe(false);
  });

  it("rejects a point inside a hole", () => {
    expect(pointInPolygon([0.5, 0.5], [outer, hole])).toBe(false);
    expect(pointInPolygon([0.1, 0.5], [outer, hole])).toBe(true);
  });
});

describe("pointInGeometry", () => {
  it("handles Polygon and MultiPolygon", () => {
    const far: LonLat[] = [[5, 5], [6, 5], [6, 6], [5, 6], [5, 5]];
    expect(pointInGeometry([0.1, 0.1], { type: "Polygon", coordinates: [outer] })).toBe(true);
    expect(pointInGeometry([5.5, 5.5], { type: "MultiPolygon", coordinates: [[outer], [far]] })).toBe(true);
    expect(pointInGeometry([3, 3], { type: "MultiPolygon", coordinates: [[outer], [far]] })).toBe(false);
  });
});
