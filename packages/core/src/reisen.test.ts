import { describe, expect, it } from "vitest";
import { reisenFinden, reiseName, type ReiseWeg } from "./reisen";

const t = (m: number, d: number, h: number) => new Date(2026, m - 1, d, h).getTime();
const KOELN: [number, number] = [6.95, 50.94];
const MUENCHEN: [number, number] = [11.58, 48.14];
const BONN: [number, number] = [7.1, 50.73];
const AACHEN: [number, number] = [6.08, 50.78];
const weg = (id: string, start: number, punkt: [number, number], m = 3000): ReiseWeg => ({ id, start, ende: start + 3600_000, punkt, m });

describe("reisenFinden (Bauplan 3, F6)", () => {
  it("finds ways far from home over at least one night, ended by the first way back", () => {
    const wege = [weg("a", t(10, 1, 9), KOELN), weg("b", t(10, 2, 10), MUENCHEN), weg("c", t(10, 3, 15), MUENCHEN, 5000), weg("d", t(10, 5, 9), KOELN)];
    const r = reisenFinden(wege, KOELN);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ id: `reise:${t(10, 2, 10)}`, von: t(10, 2, 10), bis: t(10, 3, 15) + 3600_000, wege: ["b", "c"], m: 8000 });
  });

  it("does not count a day trip (no night in between)", () => {
    const wege = [weg("b", t(10, 2, 9), MUENCHEN), weg("c", t(10, 2, 18), MUENCHEN), weg("d", t(10, 3, 9), KOELN)];
    expect(reisenFinden(wege, KOELN)).toEqual([]);
  });

  it("counts from 50 km on (Aachen over a night is a trip)", () => {
    const wege = [weg("b", t(10, 2, 9), AACHEN), weg("c", t(10, 3, 9), AACHEN), weg("d", t(10, 4, 9), KOELN)];
    expect(reisenFinden(wege, KOELN).map((r) => r.wege)).toEqual([["b", "c"]]);
  });

  it("stays home within 50 km (Bonn is no trip)", () => {
    const wege = [weg("b", t(10, 2, 9), BONN), weg("c", t(10, 4, 9), BONN)];
    expect(reisenFinden(wege, KOELN)).toEqual([]);
  });

  it("keeps a trip that is still going on (no way back yet)", () => {
    const wege = [weg("b", t(10, 2, 9), MUENCHEN), weg("c", t(10, 3, 9), MUENCHEN)];
    expect(reisenFinden(wege, KOELN).map((r) => r.wege)).toEqual([["b", "c"]]);
  });

  it("finds two trips with a stay at home in between, newest first", () => {
    const wege = [weg("b", t(9, 2, 9), MUENCHEN), weg("c", t(9, 3, 9), MUENCHEN), weg("x", t(9, 10, 9), KOELN), weg("e", t(10, 2, 9), MUENCHEN), weg("f", t(10, 4, 9), MUENCHEN)];
    expect(reisenFinden(wege, KOELN).map((r) => r.wege)).toEqual([["e", "f"], ["b", "c"]]);
  });
});

describe("reiseName", () => {
  it("is the place for one place, both for two, the country for more in one country", () => {
    expect(reiseName(["Freising"], ["DE"])).toBe("Freising");
    expect(reiseName(["Freising", "München"], ["DE"])).toBe("Freising und München");
    expect(reiseName(["Freising", "München", "Landshut"], ["DE"])).toBe("Deutschland");
    expect(reiseName(["Lissabon", "Porto", "Paris"], ["PT", "FR"])).toBe("Lissabon, Porto und weitere");
  });
});
