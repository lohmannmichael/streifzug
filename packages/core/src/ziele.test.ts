import { describe, expect, it } from "vitest";
import type { LonLat } from "./geo";
import type { Piece } from "./pieces";
import { distanceToLineM, milestoneReached, nameNear, nearestUnseen, newPerOuting } from "./ziele";

// About 100 m per 0.00142719° of longitude at 50.94° N (see geo.test.ts).
const LON_100M = 0.00142719;
const LAT_100M = 100 / 111_195;
const at = (east: number, north = 0): LonLat => [6.83 + (east / 100) * LON_100M, 50.94 + (north / 100) * LAT_100M];

function piece(id: string, from: LonLat, to: LonLat, kind: Piece["kind"] = "street"): Piece {
  return { id, kind, weight: 1, lengthM: 25, coords: [from, to], mid: [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2] };
}

describe("milestoneReached", () => {
  it("returns the milestone that was passed", () => {
    expect(milestoneReached(4.2, 5.1)).toBe(5);
  });

  it("returns the highest of several passed milestones", () => {
    expect(milestoneReached(0, 12)).toBe(10);
  });

  it("counts reaching a milestone exactly", () => {
    expect(milestoneReached(0.5, 1)).toBe(1);
  });

  it("returns null without a new milestone", () => {
    expect(milestoneReached(5, 9.9)).toBeNull();
    expect(milestoneReached(0, 0.9)).toBeNull();
  });
});

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

describe("nearestUnseen", () => {
  const pieces = [piece("a", at(0), at(25)), piece("b", at(200), at(225)), piece("c", at(60), at(85), "path")];

  it("skips seen pieces", () => {
    expect(nearestUnseen(pieces, new Set(["a"]), at(0))?.piece.id).toBe("b");
  });

  it("skips paths unless they count", () => {
    expect(nearestUnseen(pieces, new Set(["a"]), at(0))?.piece.id).toBe("b");
    expect(nearestUnseen(pieces, new Set(["a"]), at(0), { paths: true })?.piece.id).toBe("c");
  });

  it("reports the distance", () => {
    expect(nearestUnseen(pieces, new Set(["a"]), at(0))?.distanceM).toBeCloseTo(200, 0);
  });

  it("returns null when everything near is seen", () => {
    expect(nearestUnseen(pieces, new Set(["a", "b"]), at(0), { maxM: 150 })).toBeNull();
  });
});

describe("newPerOuting", () => {
  it("credits each piece to the first outing that saw it", () => {
    const r = newPerOuting([
      { id: "1", seen: ["a", "b"] },
      { id: "2", seen: ["b", "c"] },
      { id: "3", seen: ["a"] },
    ]);
    expect([...r.get("1")!]).toEqual(["a", "b"]);
    expect([...r.get("2")!]).toEqual(["c"]);
    expect(r.get("3")!.size).toBe(0);
  });
});
