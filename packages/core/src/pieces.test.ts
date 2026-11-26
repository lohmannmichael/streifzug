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

describe("Wirtschafts- und lange Zufahrtswege (Michi, 22.11.2026)", () => {
  it("draws tracks as paths (never counted)", () => {
    const p = piecesFromTile(tile, [{ props: { class: "track" }, lines: [gerade(0, 50)] }]);
    expect(p.map((x) => x.kind)).toEqual(["path", "path"]);
  });

  it("draws service roads only from 100 m on, so driveways stay out", () => {
    const kurz = piecesFromTile(tile, [{ props: { class: "service" }, lines: [gerade(0, 60)] }]);
    expect(kurz).toEqual([]);
    const lang = piecesFromTile(tile, [{ props: { class: "service" }, lines: [gerade(0, 120)] }]);
    expect(lang.length).toBeGreaterThan(0);
    expect(lang.every((x) => x.kind === "path")).toBe(true);
  });

  it("leaves out closed tracks and service roads", () => {
    const p = piecesFromTile(tile, [
      { props: { class: "track", access: "private" }, lines: [gerade(0, 50)] },
      { props: { class: "service", access: "no" }, lines: [gerade(100, 150)] },
    ]);
    expect(p).toEqual([]);
  });

  it("keeps the ids of all other pieces when such ways are added (stored ids stay valid)", () => {
    const vorher = piecesFromTile(tile, [
      { props: { class: "minor" }, lines: [gerade(0, 50)] },
      { props: { class: "path", subclass: "footway" }, lines: [gerade(200, 50)] },
    ]);
    const nachher = piecesFromTile(tile, [
      { props: { class: "track" }, lines: [gerade(100, 50)] },
      { props: { class: "minor" }, lines: [gerade(0, 50)] },
      { props: { class: "service" }, lines: [gerade(300, 150)] },
      { props: { class: "path", subclass: "footway" }, lines: [gerade(200, 50)] },
    ]);
    const ids = (ps: typeof vorher) => ps.filter((x) => x.coords[0]![1] < mitte[1] + 250 * MY && (x.coords[0]![1] < mitte[1] + 50 * MY || x.coords[0]![1] > mitte[1] + 150 * MY)).map((x) => x.id);
    expect(ids(nachher)).toEqual(ids(vorher));
  });
});

describe("piecesFromTile: Überwege (Michi, 26.11.2026)", () => {
  // A street along x at y = 0; a footway from y = -10 to y = 10 across it at x = 40.
  const quer = (x: number, von: number, bis: number): LonLat[] => [
    [mitte[0] + x * MX, mitte[1] + von * MY],
    [mitte[0] + x * MX, mitte[1] + bis * MY],
  ];
  const strasse = { props: { class: "minor" }, lines: [gerade(0, 100)] };

  it("leaves out a short footway crossing a street (a crossing), ids of the others stay", () => {
    const ohne = piecesFromTile(tile, [strasse]);
    const mit = piecesFromTile(tile, [strasse, { props: { class: "path", subclass: "footway" }, lines: [quer(40, -10, 10)] }]);
    expect(mit.map((p) => p.id)).toEqual(ohne.map((p) => p.id));
  });

  it("keeps a short footway that does not cross a street", () => {
    const p = piecesFromTile(tile, [strasse, { props: { class: "path", subclass: "footway" }, lines: [quer(40, 5, 25)] }]);
    expect(p.filter((x) => x.kind === "path")).toHaveLength(1);
  });

  it("keeps a long footway even when it crosses a street", () => {
    const p = piecesFromTile(tile, [strasse, { props: { class: "path", subclass: "footway" }, lines: [quer(40, -60, 60)] }]);
    expect(p.filter((x) => x.kind === "path").length).toBeGreaterThan(1);
  });
});
