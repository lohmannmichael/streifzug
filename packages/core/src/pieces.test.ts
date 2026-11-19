import { describe, expect, it } from "vitest";
import type { LonLat } from "./geo";
import { piecesFromTile } from "./pieces";
import { tileBounds, tileFor } from "./tiles";

const MX = 1 / 70_068;
const MY = 1 / 111_195;
const tile = tileFor([6.83, 50.94]);
const b = tileBounds(tile);
const mitte: LonLat = [(b.west + b.east) / 2, (b.south + b.north) / 2];
const gerade = (dy: number, laenge: number): LonLat[] => [
  [mitte[0], mitte[1] + dy * MY],
  [mitte[0] + laenge * MX, mitte[1] + dy * MY],
];

describe("piecesFromTile", () => {
  it("cuts a residential street into about 25 m pieces with stable ids", () => {
    const p = piecesFromTile(tile, [{ props: { class: "minor" }, lines: [gerade(0, 100)] }]);
    expect(p).toHaveLength(4);
    expect(p[0]!.id).toBe(`${tile.z}/${tile.x}/${tile.y}:0:0`);
    expect(p.every((x) => x.kind === "street" && x.weight === 1)).toBe(true);
    expect(p.reduce((s, x) => s + x.lengthM, 0)).toBeCloseTo(100, 0);
  });

  it("keeps paths as paths and drops what never counts", () => {
    const p = piecesFromTile(tile, [
      { props: { class: "path", subclass: "footway" }, lines: [gerade(0, 50)] },
      { props: { class: "motorway" }, lines: [gerade(100, 50)] },
      { props: { class: "service" }, lines: [gerade(200, 50)] },
    ]);
    expect(p.map((x) => x.kind)).toEqual(["path", "path"]);
  });

  it("halves two carriageways of a major road", () => {
    const p = piecesFromTile(tile, [
      { props: { class: "primary" }, lines: [gerade(0, 50)] },
      { props: { class: "primary" }, lines: [gerade(25, 50).reverse()] },
    ]);
    expect(p.map((x) => x.weight)).toEqual([0.5, 0.5, 0.5, 0.5]);
  });

  it("cuts lines at the tile border", () => {
    const raus: LonLat[] = [[b.east - 30 * MX, mitte[1]], [b.east + 30 * MX, mitte[1]]];
    const p = piecesFromTile(tile, [{ props: { class: "minor" }, lines: [raus] }]);
    expect(p.reduce((s, x) => s + x.lengthM, 0)).toBeCloseTo(30, 0);
  });
});
