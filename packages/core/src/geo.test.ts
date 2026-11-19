import { describe, expect, it } from "vitest";
import { distanceM, lineLengthM, sliceLine, type LonLat } from "./geo";

// Two points in Köln-Weiden, roughly 100 m apart along a parallel.
const a: LonLat = [6.83, 50.94];
const b: LonLat = [6.83142719, 50.94];

describe("distanceM", () => {
  it("is zero for the same point", () => {
    expect(distanceM(a, a)).toBe(0);
  });

  it("measures about 100 m between two nearby points", () => {
    expect(distanceM(a, b)).toBeCloseTo(100, 0);
  });

  it("is symmetric", () => {
    expect(distanceM(a, b)).toBeCloseTo(distanceM(b, a), 9);
  });
});

describe("lineLengthM", () => {
  it("sums the parts of a line", () => {
    const mid: LonLat = [(a[0] + b[0]) / 2, 50.94];
    expect(lineLengthM([a, mid, b])).toBeCloseTo(distanceM(a, b), 3);
  });

  it("is zero for a single point", () => {
    expect(lineLengthM([a])).toBe(0);
  });
});

describe("sliceLine", () => {
  it("cuts a piece out of the middle of a line", () => {
    const piece = sliceLine([a, b], 25, 75);
    expect(piece).toHaveLength(2);
    expect(lineLengthM(piece)).toBeCloseTo(50, 1);
    expect(distanceM(piece[0]!, a)).toBeCloseTo(25, 1);
  });

  it("keeps inner vertices of the original line", () => {
    const mid: LonLat = [(a[0] + b[0]) / 2, 50.9401];
    const line = [a, mid, b];
    const total = lineLengthM(line);
    const piece = sliceLine(line, 10, total - 10);
    expect(piece).toHaveLength(3);
    expect(piece[1]).toEqual(mid);
  });

  it("returns the whole line for the full range", () => {
    const piece = sliceLine([a, b], 0, distanceM(a, b));
    expect(piece[0]).toEqual(a);
    expect(distanceM(piece[1]!, b)).toBeLessThan(0.001);
  });
});

describe("pointAlong", () => {
  it("finds the middle of a line", async () => {
    const { pointAlong } = await import("./geo");
    const mid = pointAlong([a, b], distanceM(a, b) / 2);
    expect(distanceM(mid, a)).toBeCloseTo(50, 1);
    expect(distanceM(mid, b)).toBeCloseTo(50, 1);
  });

  it("clamps to the ends", async () => {
    const { pointAlong } = await import("./geo");
    expect(pointAlong([a, b], -5)).toEqual(a);
    expect(distanceM(pointAlong([a, b], 1000), b)).toBeLessThan(0.001);
  });
});
