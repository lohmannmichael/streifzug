import { describe, expect, it } from "vitest";
import { TILE_ZOOM, tileBounds, tileFor, tileId } from "./tiles";

describe("tiles", () => {
  it("uses zoom 14 for street tiles", () => {
    expect(TILE_ZOOM).toBe(14);
  });

  it("finds the tile of a point in Köln-Weiden", () => {
    // Cross-checked with an independent calculation (asinh form of the slippy-map formula).
    expect(tileFor([6.83, 50.94])).toEqual({ z: 14, x: 8502, y: 5489 });
  });

  it("builds a readable tile id", () => {
    expect(tileId({ z: 14, x: 8502, y: 5489 })).toBe("14/8502/5489");
  });

  it("returns bounds that contain the point", () => {
    const point: [number, number] = [6.83, 50.94];
    const b = tileBounds(tileFor(point));
    expect(b.west).toBeLessThanOrEqual(point[0]);
    expect(b.east).toBeGreaterThan(point[0]);
    expect(b.south).toBeLessThanOrEqual(point[1]);
    expect(b.north).toBeGreaterThan(point[1]);
  });

  it("makes tiles about 1.5 km wide at this latitude", () => {
    const b = tileBounds(tileFor([6.83, 50.94]));
    const widthM = (b.east - b.west) * 70_068;
    expect(widthM).toBeGreaterThan(1_400);
    expect(widthM).toBeLessThan(1_700);
  });
});
