import { describe, expect, it } from "vitest";
import type { LonLat } from "./geo";
import { parallelWeights } from "./parallel";

// About 1 m in degrees near Cologne.
const MX = 1 / 70_068;
const MY = 1 / 111_195;
const line = (y: number, x0: number, x1: number): LonLat[] => [[6.8 + x0 * MX, 50.94 + y * MY], [6.8 + x1 * MX, 50.94 + y * MY]];

describe("parallelWeights: every street counts once, also with two carriageways", () => {
  it("halves two carriageways of a major road running side by side", () => {
    const w = parallelWeights([
      { lineId: 1, group: "major", coords: line(0, 0, 25) },
      { lineId: 2, group: "major", coords: line(30, 25, 0) },
    ]);
    expect(w).toEqual([0.5, 0.5]);
  });

  it("halves a residential street with two carriageways (e.g. an avenue with a green strip)", () => {
    const w = parallelWeights([
      { lineId: 1, group: "minor", coords: line(0, 0, 25) },
      { lineId: 2, group: "minor", coords: line(15, 25, 0) },
    ]);
    expect(w).toEqual([0.5, 0.5]);
  });

  it("keeps two separate residential streets apart (houses in between)", () => {
    const w = parallelWeights([
      { lineId: 1, group: "minor", coords: line(0, 0, 25) },
      { lineId: 2, group: "minor", coords: line(30, 0, 25) },
    ]);
    expect(w).toEqual([1, 1]);
  });

  it("does not pair a residential street with a major road", () => {
    const w = parallelWeights([
      { lineId: 1, group: "major", coords: line(0, 0, 25) },
      { lineId: 2, group: "minor", coords: line(12, 0, 25) },
    ]);
    expect(w).toEqual([1, 1]);
  });

  it("never halves paths", () => {
    const w = parallelWeights([
      { lineId: 1, group: null, coords: line(0, 0, 25) },
      { lineId: 2, group: null, coords: line(5, 0, 25) },
    ]);
    expect(w).toEqual([1, 1]);
  });

  it("keeps full weight for a single road", () => {
    expect(parallelWeights([{ lineId: 1, group: "major", coords: line(0, 0, 25) }])).toEqual([1]);
  });

  it("ignores pieces of the same line", () => {
    const w = parallelWeights([
      { lineId: 1, group: "minor", coords: line(0, 0, 25) },
      { lineId: 1, group: "minor", coords: line(0, 25, 50) },
    ]);
    expect(w).toEqual([1, 1]);
  });

  it("does not halve major roads that are far apart", () => {
    const w = parallelWeights([
      { lineId: 1, group: "major", coords: line(0, 0, 25) },
      { lineId: 2, group: "major", coords: line(80, 0, 25) },
    ]);
    expect(w).toEqual([1, 1]);
  });

  it("does not halve a street that simply continues in a separate piece (split at a junction)", () => {
    const w = parallelWeights([
      { lineId: 1, group: "major", coords: line(0, 0, 25) },
      { lineId: 2, group: "major", coords: line(0, 25, 50) },
      { lineId: 3, group: "minor", coords: line(40, 0, 25) },
      { lineId: 4, group: "minor", coords: line(40, 26, 51) },
    ]);
    expect(w).toEqual([1, 1, 1, 1]);
  });

  it("does not halve a crossing road", () => {
    const quer: LonLat[] = [[6.8 + 12 * MX, 50.94 - 12 * MY], [6.8 + 12 * MX, 50.94 + 12 * MY]];
    const w = parallelWeights([
      { lineId: 1, group: "minor", coords: line(0, 0, 25) },
      { lineId: 2, group: "minor", coords: quer },
    ]);
    expect(w).toEqual([1, 1]);
  });
});
