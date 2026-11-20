import { describe, expect, it } from "vitest";
import type { LonLat } from "./geo";
import { seenPieceIds } from "./match";
import type { Piece } from "./pieces";
import type { Fix } from "./track";

const MX = 1 / 70_068;
const MY = 1 / 111_195;
const O: LonLat = [6.83, 50.94];
const at = (x: number, y: number): LonLat => [O[0] + x * MX, O[1] + y * MY];

function piece(id: string, from: [number, number], to: [number, number]): Piece {
  const coords = [at(...from), at(...to)];
  return { id, kind: "street", weight: 1, lengthM: Math.hypot(to[0] - from[0], to[1] - from[1]), coords, mid: at((from[0] + to[0]) / 2, (from[1] + to[1]) / 2) };
}

/** Walk in a straight line from a to b, one fix per second at 1.4 m/s. */
function walk(a: [number, number], b: [number, number], t0 = 0): Fix[] {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const n = Math.max(1, Math.round(len / 1.4));
  return Array.from({ length: n + 1 }, (_, i) => {
    const [lon, lat] = at(a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n);
    return { t: t0 + i * 1000, lon, lat, acc: 5 };
  });
}

describe("seenPieceIds", () => {
  it("marks a street you walked along", () => {
    expect(seenPieceIds([piece("a", [0, 0], [25, 0])], walk([-10, 3], [40, 3]))).toEqual(new Set(["a"]));
  });

  it("allows the GPS to be up to 20 m off (other side of a wide street)", () => {
    expect(seenPieceIds([piece("a", [0, 0], [25, 0])], walk([-10, 18], [40, 18])).has("a")).toBe(true);
  });

  it("ignores a parallel street further away", () => {
    expect(seenPieceIds([piece("a", [0, 0], [25, 0])], walk([-10, 40], [40, 40])).size).toBe(0);
  });

  it("needs at least 60 % of the piece", () => {
    expect(seenPieceIds([piece("a", [0, 0], [25, 0])], walk([-10, 0], [8, 0])).size).toBe(0);
    expect(seenPieceIds([piece("a", [0, 0], [25, 0])], walk([-10, 0], [16, 0])).size).toBe(1);
  });

  it("does not unlock a side street you only crossed", () => {
    const quer = piece("quer", [12, -12], [12, 13]);
    expect(seenPieceIds([quer], walk([-30, 0], [60, 0])).size).toBe(0);
  });

  it("does not draw a line across a long GPS gap", () => {
    const a = walk([-10, 0], [-5, 0]);
    const b = walk([30, 0], [35, 0], a.at(-1)!.t + 300_000);
    expect(seenPieceIds([piece("a", [0, 0], [25, 0])], [...a, ...b]).size).toBe(0);
  });

  it("handles empty input", () => {
    expect(seenPieceIds([], walk([0, 0], [10, 0])).size).toBe(0);
    expect(seenPieceIds([piece("a", [0, 0], [25, 0])], []).size).toBe(0);
  });

  describe("sparse imported histories (maxGapM)", () => {
    // Two points 2 minutes apart, 40 m apart, along the street.
    const sparse: Fix[] = [
      { t: 0, lon: at(-5, 2)[0], lat: at(-5, 2)[1], acc: 10 },
      { t: 120_000, lon: at(35, 2)[0], lat: at(35, 2)[1], acc: 10 },
    ];

    it("does not connect points over a minute apart by default", () => {
      expect(seenPieceIds([piece("a", [0, 0], [25, 0])], sparse).size).toBe(0);
    });

    it("connects them when they are close enough in space", () => {
      expect(seenPieceIds([piece("a", [0, 0], [25, 0])], sparse, { maxGapM: 60 }).has("a")).toBe(true);
    });

    it("still does not bridge longer distances", () => {
      const weit: Fix[] = [sparse[0]!, { t: 120_000, lon: at(95, 2)[0], lat: at(95, 2)[1], acc: 10 }];
      expect(seenPieceIds([piece("a", [0, 0], [25, 0])], weit, { maxGapM: 60 }).size).toBe(0);
    });
  });
});
