import { describe, expect, it } from "vitest";
import { distanceM, type LonLat } from "./geo";
import { aufStrassen, glaetten } from "./linie";

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

describe("aufStrassen (Schritt C1: auf erkannte Straßen)", () => {
  // A street along the x axis from 0 to 300 m.
  const strasse = { coords: [ost(0), ost(300)] };
  const neben = (n: number, abstand: number) => Array.from({ length: n }, (_, i) => ost(20 + i * 10, abstand));

  it("moves a way a few meters beside a seen street onto it", () => {
    const g = aufStrassen(neben(20, 8), [strasse]);
    expect(g).toHaveLength(20);
    for (const p of g) expect(Math.abs(p[1] - Y0) * 111_200).toBeLessThan(0.5);
  });

  it("leaves a way far from any seen street as it is (park, square)", () => {
    const weg = neben(20, 40);
    expect(aufStrassen(weg, [strasse])).toEqual(weg);
  });

  it("does not snap onto a street crossing at a right angle", () => {
    const quer = { coords: [ost(100, -100), ost(100, 100)] };
    const weg = neben(20, 8);
    const g = aufStrassen(weg, [quer]);
    expect(Math.abs(g[8]![1] - Y0) * 111_200).toBeGreaterThan(7);
  });

  it("does not snap car parts", () => {
    const weg = neben(20, 8);
    const g = aufStrassen(weg, [strasse], weg.map(() => true));
    expect(g).toEqual(weg);
  });

  it("goes over softly where the street ends", () => {
    // The street stops at 150 m, the way goes on 8 m beside it: no jump of 8 m between two points.
    const kurz = { coords: [ost(0), ost(150)] };
    const g = aufStrassen(neben(28, 8), [kurz]);
    for (let i = 1; i < g.length; i++) expect(Math.abs(g[i]![1] - g[i - 1]![1]) * 111_200).toBeLessThan(4.5);
  });
});

describe("aufStrassen an Kreuzungen (Schritt C2: saubere Ecken)", () => {
  // Street A along x from 0 to 100 m, street B from (100, 0) north.
  const a = { coords: [ost(0), ost(100)] };
  const b = { coords: [ost(100), ost(100, 150)] };
  const abstand = (p: LonLat, q: LonLat) => distanceM(p, q);

  it("turns exactly at the crossing instead of cutting the corner", () => {
    // GPS cuts the corner: along A, then diagonally, then along B.
    const weg = [...[0, 10, 20, 30, 40, 50, 60, 70, 80].map((x) => ost(x, 4)), ost(90, 10), ost(96, 20), ...[30, 40, 50, 60, 70, 80, 90].map((y) => ost(104, y))];
    const g = aufStrassen(weg, [a, b]);
    expect(g).toHaveLength(weg.length);
    expect(Math.min(...g.map((p) => abstand(p, ost(100))))).toBeLessThan(1.5);
    // Nothing left far from both streets.
    for (const p of g) expect(Math.min(Math.abs(p[1] - Y0) * 111_200, Math.abs(p[0] - ost(100)[0]) * 70_200)).toBeLessThan(2);
  });

  it("also when the two snapped points follow each other directly", () => {
    const weg = [...[0, 15, 30, 45, 60, 75, 90].map((x) => ost(x, 3)), ...[12, 27, 42, 57, 72].map((y) => ost(103, y))];
    const g = aufStrassen(weg, [a, b]);
    expect(Math.min(...g.map((p) => abstand(p, ost(100))))).toBeLessThan(1.5);
  });
});
