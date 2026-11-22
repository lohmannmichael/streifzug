import { describe, expect, it } from "vitest";
import type { LonLat } from "./geo";
import { kompletteStrassen, linienVerbinden, randNachbarn, type StueckInfo } from "./komplett";
import { tileBounds, tileFor } from "./tiles";

const s = (id: string, kind: "street" | "path" = "street") => ({ id, kind, lengthM: 25, weight: 1 });
const info = (eintraege: [string, string | null, string | null][]) => new Map<string, StueckInfo>(eintraege.map(([id, name, ort]) => [id, { name, ort }]));

describe("kompletteStrassen (Bauplan 3, F4)", () => {
  const stuecke = [s("a1"), s("a2"), s("a3"), s("b1"), s("b2"), s("c1"), s("w1", "path")];
  const namen = info([
    ["a1", "Am Rapohl", "koeln"],
    ["a2", "Am Rapohl", "koeln"],
    ["a3", "Am Rapohl", "koeln"],
    ["b1", "Gartenweg", "koeln"],
    ["b2", "Gartenweg", "koeln"],
    ["c1", null, "koeln"],
    ["w1", "Parkweg", "koeln"],
  ]);
  const zeit = new Map([["a1", 10], ["a2", 30], ["a3", 20], ["b1", 5], ["c1", 1], ["w1", 1]]);

  it("finds a named street whose pieces in the place are all seen, dated with the last piece", () => {
    const k = kompletteStrassen(stuecke, namen, new Set(["a1", "a2", "a3", "b1", "c1", "w1"]), new Set(), zeit);
    expect(k).toEqual([{ name: "Am Rapohl", ort: "koeln", seit: 30, ids: ["a1", "a2", "a3"] }]);
  });

  it("leaves out pieces marked 'Hier komme ich nicht hin'", () => {
    const k = kompletteStrassen(stuecke, namen, new Set(["a1", "a2", "a3", "b1"]), new Set(["b2"]), zeit);
    expect(k.map((x) => x.name)).toEqual(["Am Rapohl", "Gartenweg"]);
  });

  it("counts a street per place: the same name in two places are two streets", () => {
    const zwei = info([
      ["a1", "Hauptstraße", "koeln"],
      ["a2", "Hauptstraße", "freising"],
    ]);
    const k = kompletteStrassen([s("a1"), s("a2")], zwei, new Set(["a1"]), new Set(), zeit);
    expect(k).toEqual([{ name: "Hauptstraße", ort: "koeln", seit: 10, ids: ["a1"] }]);
  });

  it("ignores unnamed streets, paths and pieces outside every place", () => {
    const k = kompletteStrassen([s("c1"), s("w1", "path"), s("x")], info([["x", "Irgendwo", null]]), new Set(["c1", "w1", "x"]), new Set(), zeit);
    expect(k).toEqual([]);
  });

  it("can leave out streets that are not known in full (more tiles needed)", () => {
    const k = kompletteStrassen(stuecke, namen, new Set(["a1", "a2", "a3"]), new Set(), zeit, new Set(["koeln|Am Rapohl"]));
    expect(k).toEqual([]);
  });
});

describe("randNachbarn", () => {
  const tile = tileFor([6.83, 50.94]);
  const b = tileBounds(tile);
  const mitteY = (b.north + b.south) / 2;

  it("finds the neighbour tile where a piece ends at the edge", () => {
    const coords: LonLat[] = [[b.east - 0.001, mitteY], [b.east, mitteY]];
    expect(randNachbarn(coords, tile)).toEqual([{ z: tile.z, x: tile.x + 1, y: tile.y }]);
  });

  it("finds nothing for a piece inside the tile", () => {
    const coords: LonLat[] = [[b.west + 0.002, mitteY], [b.west + 0.003, mitteY]];
    expect(randNachbarn(coords, tile)).toEqual([]);
  });

  it("finds the tile above at the north edge", () => {
    const coords: LonLat[] = [[b.west + 0.002, b.north], [b.west + 0.002, b.north - 0.001]];
    expect(randNachbarn(coords, tile)).toEqual([{ z: tile.z, x: tile.x, y: tile.y - 1 }]);
  });
});

describe("linienVerbinden", () => {
  it("joins pieces that meet end to end into one line, in any direction", () => {
    const a: LonLat[] = [[0, 0], [0.001, 0]];
    const b: LonLat[] = [[0.002, 0], [0.001, 0]];
    const c: LonLat[] = [[0.002, 0], [0.003, 0]];
    const l = linienVerbinden([b, c, a]);
    expect(l).toHaveLength(1);
    expect(l[0]!.length).toBe(4);
    expect([l[0]![0], l[0]!.at(-1)]).toEqual(expect.arrayContaining([[0, 0], [0.003, 0]]));
  });

  it("keeps lines apart that do not touch", () => {
    expect(linienVerbinden([[[0, 0], [0.001, 0]], [[0.01, 0], [0.011, 0]]])).toHaveLength(2);
  });
});
