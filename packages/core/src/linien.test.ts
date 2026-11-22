import { describe, expect, it } from "vitest";
import type { LonLat } from "./geo";
import { eineLinieJeStrasse } from "./linien";
import type { Piece } from "./pieces";

// About 1 m per 0.0000142719° of longitude and 0.0000089932° of latitude at 50.94° N.
const LON_M = 0.0000142719;
const LAT_M = 1 / 111_195;
const at = (ostM: number, nordM = 0): LonLat => [6.83 + ostM * LON_M, 50.94 + nordM * LAT_M];
/** A 25 m piece running east, `nordM` north of the reference line. */
function stueck(id: string, nordM: number, kind: Piece["kind"] = "street", weight = 1, ostM = 0): Piece {
  const a = at(ostM, nordM);
  const b = at(ostM + 25, nordM);
  return { id, kind, weight, lengthM: 25, coords: [a, b], mid: at(ostM + 12.5, nordM) };
}
const ids = (l: readonly Piece[]) => l.map((p) => p.id).sort();

describe("eineLinieJeStrasse", () => {
  it("draws a sidewalk beside a yellow street not as a second line", () => {
    const r = eineLinieJeStrasse([stueck("strasse", 0), stueck("gehweg", 6, "path")], []);
    expect(ids(r.gelb)).toEqual(["strasse"]);
  });

  it("keeps a path that has no yellow street beside it (park, Schleichweg)", () => {
    const r = eineLinieJeStrasse([stueck("strasse", 0), stueck("parkweg", 60, "path")], []);
    expect(ids(r.gelb)).toEqual(["parkweg", "strasse"]);
  });

  it("draws only one of two yellow carriageways", () => {
    const r = eineLinieJeStrasse([stueck("nord", 12, "street", 0.5), stueck("sued", -12, "street", 0.5)], []);
    expect(r.gelb).toHaveLength(1);
  });

  it("keeps the same carriageway along the whole street, whatever the piece ids", () => {
    const gelb = [
      stueck("a-nord", 12, "street", 0.5, 0),
      stueck("z-sued", -12, "street", 0.5, 0),
      stueck("z-nord", 12, "street", 0.5, 25),
      stueck("a-sued", -12, "street", 0.5, 25),
    ];
    expect(ids(eineLinieJeStrasse(gelb, []).gelb)).toEqual(["a-nord", "z-nord"]);
  });

  it("keeps the western carriageway of a north–south street, also when pieces lean either way", () => {
    const nordSued = (id: string, ostM: number, kipp: number, nordM: number): Piece => ({
      id, kind: "street", weight: 0.5, lengthM: 25, coords: [at(ostM, nordM), at(ostM + kipp, nordM + 25)], mid: at(ostM + kipp / 2, nordM + 12.5),
    });
    const gelb = [nordSued("z-west", -12, 0.5, 0), nordSued("a-ost", 12, 0.5, 0), nordSued("a-west", -12, -0.5, 25), nordSued("z-ost", 12, -0.5, 25)];
    expect(ids(eineLinieJeStrasse(gelb, []).gelb)).toEqual(["a-west", "z-west"]);
  });

  it("draws a single carriageway when only one is yellow", () => {
    const r = eineLinieJeStrasse([stueck("nord", 12, "street", 0.5)], []);
    expect(ids(r.gelb)).toEqual(["nord"]);
  });

  it("keeps two separate streets next to each other (house rows between)", () => {
    const r = eineLinieJeStrasse([stueck("a", 0), stueck("b", 45)], []);
    expect(ids(r.gelb)).toEqual(["a", "b"]);
  });

  it("keeps a crossing street and a street that just continues", () => {
    const quer: Piece = { id: "quer", kind: "street", weight: 1, lengthM: 25, coords: [at(12.5, -12), at(12.5, 13)], mid: at(12.5, 0.5) };
    const r = eineLinieJeStrasse([stueck("a", 0), stueck("weiter", 0, "street", 1, 25), quer], []);
    expect(ids(r.gelb)).toEqual(["a", "quer", "weiter"]);
  });

  it("draws no red pen line right beside yellow", () => {
    const r = eineLinieJeStrasse([stueck("gelb", 0)], [stueck("rot-daneben", 8, "drive"), stueck("rot-woanders", 80, "drive")]);
    expect(ids(r.rot)).toEqual(["rot-woanders"]);
  });

  it("only leaves out what is drawn; the input stays as it is", () => {
    const gelb = [stueck("strasse", 0), stueck("gehweg", 6, "path")];
    eineLinieJeStrasse(gelb, []);
    expect(gelb).toHaveLength(2);
  });
});
