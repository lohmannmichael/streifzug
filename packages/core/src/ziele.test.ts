import { describe, expect, it } from "vitest";
import type { LonLat } from "./geo";
import { distanceToLineM, nameNear } from "./ziele";

// About 100 m per 0.00142719° of longitude at 50.94° N (see geo.test.ts).
const LON_100M = 0.00142719;
const LAT_100M = 100 / 111_195;
const at = (east: number, north = 0): LonLat => [6.83 + (east / 100) * LON_100M, 50.94 + (north / 100) * LAT_100M];

describe("distanceToLineM", () => {
  it("measures to the closest point inside a segment", () => {
    expect(distanceToLineM(at(50, 20), [at(0), at(100)])).toBeCloseTo(20, 0);
  });

  it("measures to the end when the point lies beyond it", () => {
    expect(distanceToLineM(at(130), [at(0), at(100)])).toBeCloseTo(30, 0);
  });
});

describe("nameNear", () => {
  const lines = [
    { name: "Aachener Straße", coords: [at(0), at(200)] },
    { name: "Bahnstraße", coords: [at(0, 40), at(200, 40)] },
  ];

  it("finds the nearest named line", () => {
    expect(nameNear(at(100, 5), lines)).toBe("Aachener Straße");
    expect(nameNear(at(100, 36), lines)).toBe("Bahnstraße");
  });

  it("returns null when nothing is close enough", () => {
    expect(nameNear(at(100, 20), lines)).toBeNull();
  });
});

