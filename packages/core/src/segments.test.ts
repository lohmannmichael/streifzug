import { describe, expect, it } from "vitest";
import { lineLengthM, type LonLat } from "./geo";
import { splitWay } from "./segments";

const start: LonLat = [6.83, 50.94];
// Roughly 1 m of longitude at this latitude, in degrees.
const M = 1 / 70_068;
const lineOf = (meters: number): LonLat[] => [start, [start[0] + meters * M, start[1]]];

describe("splitWay", () => {
  it("splits a 100 m way into four pieces of about 25 m", () => {
    const pieces = splitWay(4711, lineOf(100));
    expect(pieces).toHaveLength(4);
    for (const piece of pieces) expect(piece.lengthM).toBeCloseTo(25, 0);
  });

  it("gives every piece a stable id from way id and position", () => {
    const pieces = splitWay(4711, lineOf(100));
    expect(pieces.map((p) => p.id)).toEqual(["4711:0", "4711:1", "4711:2", "4711:3"]);
    expect(splitWay(4711, lineOf(100)).map((p) => p.id)).toEqual(pieces.map((p) => p.id));
  });

  it("keeps a short way as one piece", () => {
    const pieces = splitWay(1, lineOf(8));
    expect(pieces).toHaveLength(1);
    expect(pieces[0]!.lengthM).toBeCloseTo(8, 0);
  });

  it("rounds to the nearest number of pieces", () => {
    expect(splitWay(1, lineOf(36))).toHaveLength(1);
    expect(splitWay(1, lineOf(38))).toHaveLength(2);
  });

  it("loses no length when splitting", () => {
    const line: LonLat[] = [start, [start[0] + 60 * M, start[1]], [start[0] + 60 * M, start[1] + 0.0005]];
    const pieces = splitWay(2, line);
    const sum = pieces.reduce((s, p) => s + p.lengthM, 0);
    expect(sum).toBeCloseTo(lineLengthM(line), 3);
  });

  it("returns nothing for a way without length", () => {
    expect(splitWay(3, [start, start])).toEqual([]);
  });
});
