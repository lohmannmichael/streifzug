import { describe, expect, it } from "vitest";
import type { LonLat } from "./geo";
import { eineLinieJeStrasse, fahrbahnenErgaenzen } from "./linien";
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

describe("fahrbahnenErgaenzen", () => {
  it("counts the other carriageway when one was walked (Aachener Straße with tram in between)", () => {
    const alle = [stueck("nord", 15, "street", 0.5), stueck("sued", -15, "street", 0.5)];
    expect([...fahrbahnenErgaenzen(alle, new Set(["nord"]))]).toEqual(["sued"]);
  });

  it("does not add a separate street next to it, nor a single street", () => {
    const alle = [stueck("nord", 15, "street", 0.5), stueck("nachbar", 60, "street", 1), stueck("parallel", -15, "street", 1)];
    expect([...fahrbahnenErgaenzen(alle, new Set(["nord"]))]).toEqual([]);
  });

  it("only beside what was walked, not further along the street", () => {
    const alle = [stueck("nord", 15, "street", 0.5), stueck("sued-weiter", -15, "street", 0.5, 60)];
    expect([...fahrbahnenErgaenzen(alle, new Set(["nord"]))]).toEqual([]);
  });
});

/** A piece from (ostM, nordM) to (ostM2, nordM2). */
function linie(id: string, von: [number, number], bis: [number, number], kind: Piece["kind"] = "street", weight = 1): Piece {
  const a = at(von[0], von[1]);
  const b = at(bis[0], bis[1]);
  const lengthM = Math.hypot(bis[0] - von[0], bis[1] - von[1]);
  return { id, kind, weight, lengthM, coords: [a, b], mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] };
}
/** A straight yellow street east, 100 m in four pieces. */
const hauptstrasse = () => [0, 25, 50, 75].map((x) => linie(`h${x}`, [x, 0], [x + 25, 0]));

describe("eineLinieJeStrasse: Stummel", () => {
  it("does not draw a short path stub hanging off the line (end of a crossing, sidewalk bit)", () => {
    const r = eineLinieJeStrasse([...hauptstrasse(), linie("stummel", [50, 0], [50, 20], "path")], []);
    expect(ids(r.gelb)).not.toContain("stummel");
    expect(r.gelb).toHaveLength(4);
  });

  it("does not draw a short street stub either (turning link at a junction)", () => {
    const r = eineLinieJeStrasse([...hauptstrasse(), linie("abbieger", [25, 0], [40, -15])], []);
    expect(ids(r.gelb)).not.toContain("abbieger");
  });

  it("removes a stub made of two short pieces as a whole", () => {
    const r = eineLinieJeStrasse([...hauptstrasse(), linie("s1", [50, 0], [50, 10], "path"), linie("s2", [50, 10], [60, 15], "path")], []);
    expect(ids(r.gelb)).toEqual(["h0", "h25", "h50", "h75"]);
  });

  it("keeps a side street that was really walked into (longer than 30 m)", () => {
    const r = eineLinieJeStrasse([...hauptstrasse(), linie("q1", [50, 0], [50, 25]), linie("q2", [50, 25], [50, 50])], []);
    expect(ids(r.gelb)).toContain("q1");
    expect(ids(r.gelb)).toContain("q2");
  });

  it("keeps the ends of the main line and a short piece on its own (park path)", () => {
    const r = eineLinieJeStrasse([...hauptstrasse(), linie("park", [0, 300], [20, 300], "path")], []);
    expect(r.gelb).toHaveLength(5);
  });

  it("keeps a short piece between two lines (both ends attached)", () => {
    const zweite = [0, 25, 50, 75].map((x) => linie(`n${x}`, [x, 60], [x + 25, 60]));
    const r = eineLinieJeStrasse([...hauptstrasse(), ...zweite, linie("verbindung", [50, 0], [50, 60], "path")], []);
    expect(ids(r.gelb)).toContain("verbindung");
  });

  it("treats ends less than 2 m apart as one point (pieces cut at a tile edge)", () => {
    const r = eineLinieJeStrasse([...hauptstrasse(), linie("weiter", [100.8, 0.3], [120, 0]), linie("stummel", [50, 0], [50, 20], "path")], []);
    expect(ids(r.gelb)).toContain("weiter");
    expect(ids(r.gelb)).not.toContain("stummel");
  });

  it("does not draw a short loop that leaves the line and comes back (turning loop, U-turn link)", () => {
    const schlaufe = [linie("l1", [50, 0], [52, -10]), linie("l2", [52, -10], [58, -10]), linie("l3", [58, -10], [60, 0])];
    const r = eineLinieJeStrasse([...hauptstrasse(), linie("h50a", [50, 0], [60, 0]), ...schlaufe].filter((p) => p.id !== "h50").concat([linie("h60", [60, 0], [75, 0])]), []);
    expect(ids(r.gelb).filter((i) => i.startsWith("l"))).toEqual([]);
  });

  it("keeps a short straight link between two separate streets", () => {
    const zweite = [0, 25, 50, 75].map((x) => linie(`n${x}`, [x, 25], [x + 25, 25]));
    const r = eineLinieJeStrasse([...hauptstrasse(), ...zweite, linie("gasse", [50, 0], [50, 25], "path")], []);
    expect(ids(r.gelb)).toContain("gasse");
  });

  it("does not draw the V of a junction running down to the hidden other carriageway", () => {
    // Ends 25 m apart on the line, tip 14 m south: 2 × 18.9 m.
    const v = [linie("v1", [62.5, 0], [50, -14]), linie("v2", [50, -14], [37.5, 0])];
    const linieMitPunkten = [linie("a", [0, 0], [37.5, 0]), linie("b", [37.5, 0], [62.5, 0]), linie("c", [62.5, 0], [100, 0])];
    const r = eineLinieJeStrasse([...linieMitPunkten, ...v], []);
    expect(ids(r.gelb)).toEqual(["a", "b", "c"]);
  });

  it("keeps a real side loop that is long (a walked U-shaped street)", () => {
    const u = [linie("u1", [25, 0], [25, 40]), linie("u2", [25, 40], [50, 40]), linie("u3", [50, 40], [50, 0])];
    const r = eineLinieJeStrasse([...hauptstrasse(), ...u], []);
    expect(ids(r.gelb).filter((i) => i.startsWith("u"))).toEqual(["u1", "u2", "u3"]);
  });

  it("does not draw a turning link that starts in the middle of a piece and ends at the hidden other carriageway", () => {
    const haken = [linie("k1", [37, 0], [40, -10]), linie("k2", [40, -10], [35, -17]), linie("k3", [35, -17], [30, -17])];
    const r = eineLinieJeStrasse([...hauptstrasse(), ...haken], []);
    expect(ids(r.gelb)).toEqual(["h0", "h25", "h50", "h75"]);
  });

  it("hides a sidewalk piece beside the street even with a small jog in it", () => {
    // Start to end runs at about 28°, the longest part along the street.
    const knick: Piece = { id: "gehweg", kind: "path", weight: 1, lengthM: 20, coords: [at(30, 9), at(40, 9), at(40, 2), at(43, 2)], mid: at(40, 5.5) };
    const r = eineLinieJeStrasse([...hauptstrasse(), knick], []);
    expect(ids(r.gelb)).not.toContain("gehweg");
  });
});
