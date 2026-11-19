import { describe, expect, it } from "vitest";
import { clipLine } from "./clip";
import type { LonLat } from "./geo";

const box = { west: 0, south: 0, east: 10, north: 10 };

describe("clipLine", () => {
  it("keeps a line that is fully inside", () => {
    expect(clipLine([[1, 1], [9, 9]], box)).toEqual([[[1, 1], [9, 9]]]);
  });

  it("drops a line that is fully outside", () => {
    expect(clipLine([[11, 1], [20, 5]], box)).toEqual([]);
  });

  it("cuts a line at the border", () => {
    expect(clipLine([[5, 5], [15, 5]], box)).toEqual([[[5, 5], [10, 5]]]);
  });

  it("cuts a line crossing the whole box", () => {
    expect(clipLine([[-5, 5], [15, 5]], box)).toEqual([[[0, 5], [10, 5]]]);
  });

  it("splits a line that leaves and comes back", () => {
    const parts = clipLine([[5, 5], [15, 5], [15, 8], [5, 8]], box);
    expect(parts).toEqual([
      [[5, 5], [10, 5]],
      [[10, 8], [5, 8]],
    ]);
  });

  it("counts a shared border only once between two neighbouring boxes", () => {
    const left = clipLine([[5, 5], [15, 5]], box);
    const right = clipLine([[5, 5], [15, 5]], { west: 10, south: 0, east: 20, north: 10 });
    const width = (parts: LonLat[][]) => parts.reduce((sum, part) => sum + Math.abs(part[part.length - 1]![0] - part[0]![0]), 0);
    expect(width(left) + width(right)).toBe(10);
  });
});
