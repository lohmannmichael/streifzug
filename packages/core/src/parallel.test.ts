import { describe, expect, it } from "vitest";
import type { LonLat } from "./geo";
import { parallelWeights } from "./parallel";

// About 1 m in degrees near Cologne.
const MX = 1 / 70_068;
const MY = 1 / 111_195;
const line = (y: number, x0: number, x1: number): LonLat[] => [[6.8 + x0 * MX, 50.94 + y * MY], [6.8 + x1 * MX, 50.94 + y * MY]];

describe("parallelWeights", () => {
  it("halves two carriageways of a major road running side by side", () => {
    const w = parallelWeights([
      { lineId: 1, major: true, coords: line(0, 0, 25) },
      { lineId: 2, major: true, coords: line(20, 25, 0) },
    ]);
    expect(w).toEqual([0.5, 0.5]);
  });

  it("keeps full weight for a single road", () => {
    expect(parallelWeights([{ lineId: 1, major: true, coords: line(0, 0, 25) }])).toEqual([1]);
  });

  it("ignores pieces of the same line", () => {
    const w = parallelWeights([
      { lineId: 1, major: true, coords: line(0, 0, 25) },
      { lineId: 1, major: true, coords: line(0, 25, 50) },
    ]);
    expect(w).toEqual([1, 1]);
  });

  it("does not halve residential streets", () => {
    const w = parallelWeights([
      { lineId: 1, major: false, coords: line(0, 0, 25) },
      { lineId: 2, major: false, coords: line(20, 0, 25) },
    ]);
    expect(w).toEqual([1, 1]);
  });

  it("does not halve roads that are far apart", () => {
    const w = parallelWeights([
      { lineId: 1, major: true, coords: line(0, 0, 25) },
      { lineId: 2, major: true, coords: line(80, 0, 25) },
    ]);
    expect(w).toEqual([1, 1]);
  });

  it("does not halve a crossing road", () => {
    const quer: LonLat[] = [[6.8 + 12 * MX, 50.94 - 12 * MY], [6.8 + 12 * MX, 50.94 + 12 * MY]];
    const w = parallelWeights([
      { lineId: 1, major: true, coords: line(0, 0, 25) },
      { lineId: 2, major: true, coords: quer },
    ]);
    expect(w).toEqual([1, 1]);
  });
});
