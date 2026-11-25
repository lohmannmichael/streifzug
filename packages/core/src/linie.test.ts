import { describe, expect, it } from "vitest";
import { distanceM, type LonLat } from "./geo";
import { glaetten } from "./linie";

// About 7 m per 0.0001 degrees of longitude in Köln, 11 m per 0.0001 of latitude.
const Y0 = 50.94;
const ost = (m: number, nord = 0): LonLat => [6.82 + m / 70_200, Y0 + nord / 111_200];

describe("glaetten (Wege ruhiger zeichnen, Michi 25.11.2026)", () => {
  it("keeps a straight way, its point count and both ends", () => {
    const gerade = Array.from({ length: 20 }, (_, i) => ost(i * 10));
    const g = glaetten(gerade);
    expect(g).toHaveLength(20);
    expect(g[0]).toEqual(gerade[0]);
    expect(g[19]).toEqual(gerade[19]);
    for (let i = 0; i < 20; i++) expect(distanceM(g[i]!, gerade[i]!)).toBeLessThan(0.5);
  });

  it("calms GPS zigzag along a street", () => {
    const zick = Array.from({ length: 40 }, (_, i) => ost(i * 8, i % 2 ? 6 : -6));
    const g = glaetten(zick);
    const abweichung = (p: LonLat) => Math.abs(p[1] - Y0) * 111_200;
    const mitte = g.slice(5, 35);
    expect(Math.max(...mitte.map(abweichung))).toBeLessThan(2);
  });

  it("takes out a single jump away and back", () => {
    const weg = Array.from({ length: 21 }, (_, i) => ost(i * 10));
    weg[10] = ost(100, 60);
    const g = glaetten(weg);
    expect(Math.abs(g[10]![1] - Y0) * 111_200).toBeLessThan(5);
  });

  it("keeps a real corner roughly in place", () => {
    const ecke = [...Array.from({ length: 10 }, (_, i) => ost(i * 10)), ...Array.from({ length: 10 }, (_, i) => ost(90, (i + 1) * 10))];
    const g = glaetten(ecke);
    expect(distanceM(g[9]!, ost(90))).toBeLessThan(6);
  });

  it("short ways stay as they are", () => {
    expect(glaetten([ost(0), ost(10)])).toEqual([ost(0), ost(10)]);
  });
});
