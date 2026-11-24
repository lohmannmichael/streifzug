import { describe, expect, it } from "vitest";
import { ausnahmeAufloesen, ausnahmeEintrag, ausnahmeLesen, kartenStandAusUrl } from "./kartenstand";

describe("kartenStandAusUrl", () => {
  it("reads the version of the map data from the tile address", () => {
    expect(kartenStandAusUrl("https://tiles.openfreemap.org/planet/20261122_124456_pt/{z}/{x}/{y}.pbf")).toBe("20261122_124456_pt");
  });
  it("falls back to the whole address for other servers", () => {
    expect(kartenStandAusUrl("https://example.org/tiles/{z}/{x}/{y}.pbf")).toBe("https://example.org/tiles/{z}/{x}/{y}.pbf");
  });
});

describe("Ausnahmen mit Ort (überstehen Karten-Updates)", () => {
  const eintrag = ausnahmeEintrag("14/8503/5489:417:4", [6.83634, 50.93926]);

  it("keeps id and middle point", () => {
    expect(ausnahmeLesen(eintrag)).toEqual({ id: "14/8503/5489:417:4", mid: [6.83634, 50.93926] });
    expect(ausnahmeLesen("14/8503/5489:12:3")).toEqual({ id: "14/8503/5489:12:3", mid: null });
  });

  it("finds the piece at the same place under a new id after a map update", () => {
    const neu = [
      { id: "14/8503/5489:420:4", mid: [6.836341, 50.939261] as [number, number] },
      { id: "14/8503/5489:417:4", mid: [6.84, 50.94] as [number, number] },
    ];
    expect(ausnahmeAufloesen(eintrag, neu)).toBe("14/8503/5489:420:4");
  });

  it("keeps the stored id when nothing lies there any more, and old entries without place", () => {
    expect(ausnahmeAufloesen(eintrag, [{ id: "x", mid: [6.9, 50.9] }])).toBe("14/8503/5489:417:4");
    expect(ausnahmeAufloesen("14/8503/5489:12:3", [])).toBe("14/8503/5489:12:3");
  });
});
