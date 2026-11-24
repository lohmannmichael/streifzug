import { describe, expect, it } from "vitest";
import type { LonLat } from "./geo";
import { mProGradLon, nachzeichnen } from "./nachzeichnen";
import type { Piece } from "./pieces";
import type { Fix } from "./track";

// A small street grid in meters (x east, y north) around Weiden.
const LAT = 50.94;
const LON = 6.83;
const pt = (x: number, y: number): LonLat => [LON + x / mProGradLon(LAT), LAT + y / 111_195];
const strasse = (id: string, von: [number, number], bis: [number, number]): Piece => {
  const a = pt(...von);
  const b = pt(...bis);
  const lengthM = Math.hypot(bis[0] - von[0], bis[1] - von[1]);
  return { id, kind: "street", weight: 1, lengthM, coords: [a, b], mid: pt((von[0] + bis[0]) / 2, (von[1] + bis[1]) / 2) };
};
const fix = (x: number, y: number, s: number): Fix => {
  const [lon, lat] = pt(x, y);
  return { t: s * 1000, lon, lat, acc: 5 };
};

describe("nachzeichnen", () => {
  it("traces round a corner when that is the only way", () => {
    // An L: east along y=0 to the corner (100,0), then north. Points 30 m before and after the corner.
    const stuecke = [strasse("w1", [0, 0], [70, 0]), strasse("w2", [70, 0], [100, 0]), strasse("n1", [100, 0], [100, 30]), strasse("n2", [100, 30], [100, 100])];
    const dazu = nachzeichnen(stuecke, [[fix(70, 0, 0), fix(100, 30, 10)]], new Set());
    expect([...dazu].sort()).toEqual(["n1", "w2"]);
  });

  it("leaves the gap white when two ways are equally long (round the block either side)", () => {
    // A square block: from the south-west corner to the north-east corner, via east or via north.
    const stuecke = [strasse("s", [0, 0], [60, 0]), strasse("o", [60, 0], [60, 60]), strasse("w", [0, 0], [0, 60]), strasse("nn", [0, 60], [60, 60])];
    expect(nachzeichnen(stuecke, [[fix(0, 0, 0), fix(60, 60, 30)]], new Set()).size).toBe(0);
  });

  it("does not trace big gaps, or a long detour", () => {
    const lang = [strasse("a", [0, 0], [400, 0])];
    expect(nachzeichnen(lang, [[fix(0, 0, 0), fix(400, 0, 60)]], new Set()).size).toBe(0);
    // Straight line 50 m, but the streets go 150 m round: no.
    const umweg = [strasse("u1", [0, 0], [0, 50]), strasse("u2", [0, 50], [50, 50]), strasse("u3", [50, 50], [50, 0])];
    expect(nachzeichnen(umweg, [[fix(0, 0, 0), fix(50, 0, 20)]], new Set()).size).toBe(0);
  });

  it("never connects points of different runs (a drive in between)", () => {
    const stuecke = [strasse("w1", [0, 0], [70, 0]), strasse("w2", [70, 0], [100, 0]), strasse("n1", [100, 0], [100, 30])];
    expect(nachzeichnen(stuecke, [[fix(70, 0, 0)], [fix(100, 30, 10)]], new Set()).size).toBe(0);
  });
});

describe("nachzeichnen mit allen nahen Knoten (Fahrten, Michi 24.11.2026)", () => {
  // Two carriageways 15 m apart, not joined: the west one goes on south to the parking place.
  const stuecke = [strasse("sued", [0, -100], [0, 0]), strasse("west", [0, 0], [0, 200]), strasse("ost", [15, 0], [15, 200])];
  const gap = [[fix(0, -100, 0), fix(13, 195, 60)]];

  it("normally takes only the nearest node, which lies on the other carriageway", () => {
    expect(nachzeichnen(stuecke, gap, new Set(), { maxM: 400 }).size).toBe(0);
  });

  it("with alleNahen tries every node nearby and takes the shortest way", () => {
    expect([...nachzeichnen(stuecke, gap, new Set(), { maxM: 400, alleNahen: true })].sort()).toEqual(["sued", "west"]);
  });
});
