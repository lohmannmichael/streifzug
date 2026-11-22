import { describe, expect, it } from "vitest";
import type { LonLat } from "./geo";
import { gefahrenJePunkt, NACHFAHREN_BUDGET_MS, NACHFAHREN_TEMPO, passtBeiZoom, planeNachfahren } from "./nachfahren";
import type { ReplayArt, ReplayWeg } from "./replay";
import type { Fix } from "./track";

// A straight way east: n points about 50 m apart.
function weg(n: number, art: ReplayArt | ReplayArt[] = "neu", start: LonLat = [6.82, 50.94]): ReplayWeg {
  const coords: LonLat[] = [];
  for (let i = 0; i < n; i++) coords.push([start[0] + i * 0.0007, start[1]]);
  return { coords, arten: Array.from({ length: n - 1 }, (_, i) => (Array.isArray(art) ? art[i % art.length]! : art)) };
}
const summe = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

describe("planeNachfahren", () => {
  it("plays every way on its own, in order, with a hard cut (no pause between)", () => {
    const plan = planeNachfahren([weg(10), weg(10, "neu", [6.9, 50.9])], [true, false]);
    expect(plan.wege).toEqual([0, 1]);
    const [a, b] = [plan.abschnitte.filter((x) => x.weg === 0), plan.abschnitte.filter((x) => x.weg === 1)];
    expect(a[0]!.start).toBe(0);
    expect(b[0]!.start).toBeCloseTo(a.at(-1)!.start + a.at(-1)!.dauer, 5);
  });

  it("keeps an even pace on screen: twice the way, twice the time", () => {
    const plan = planeNachfahren([weg(21), weg(41, "neu", [6.9, 50.9])], [true, true], 1e9);
    const d = (i: number) => summe(plan.abschnitte.filter((x) => x.weg === i).map((x) => x.dauer));
    expect(d(1) / d(0)).toBeCloseTo(2, 1);
    expect(d(0)).toBeCloseTo(((20 * 49.2) / NACHFAHREN_TEMPO.neu) * 1000, -2);
  });

  it("draws car rides eight times as fast", () => {
    const plan = planeNachfahren([weg(21, [...Array(10).fill("neu"), ...Array(10).fill("gefahren")] as ReplayArt[])], [true], 1e9);
    const [zuFuss, auto] = plan.abschnitte;
    expect(zuFuss!.art).toBe("neu");
    expect(auto!.art).toBe("gefahren");
    expect(zuFuss!.dauer / auto!.dauer).toBeCloseTo(8, 0);
  });

  it("gives at least 2 s to a way with new streets and 1 s to one without", () => {
    const plan = planeNachfahren([weg(3), weg(3, "neu", [6.9, 50.9])], [true, false]);
    const d = (i: number) => summe(plan.abschnitte.filter((x) => x.weg === i).map((x) => x.dauer));
    expect(d(0)).toBeCloseTo(2000, 0);
    expect(d(1)).toBeCloseTo(1000, 0);
  });

  it("stays within 20 seconds: many long ways run faster", () => {
    const wege = Array.from({ length: 6 }, (_, i) => weg(120, "neu", [6.8 + i * 0.1, 50.9]));
    const plan = planeNachfahren(wege, wege.map(() => true));
    expect(plan.dauer).toBeLessThanOrEqual(NACHFAHREN_BUDGET_MS + 1);
    expect(plan.dauer).toBeGreaterThan(NACHFAHREN_BUDGET_MS - 50);
  });

  it("shares the 20 seconds when even the minimums would be longer", () => {
    const wege = Array.from({ length: 15 }, (_, i) => weg(3, "neu", [6.8 + i * 0.01, 50.9]));
    const plan = planeNachfahren(wege, wege.map(() => true));
    expect(plan.dauer).toBeLessThanOrEqual(NACHFAHREN_BUDGET_MS + 1);
    expect(plan.wege).toHaveLength(15);
  });

  it("leaves out ways that are too short to draw", () => {
    const plan = planeNachfahren([{ coords: [[6.8, 50.9]], arten: [] }, weg(5)], [false, true]);
    expect(plan.wege).toEqual([1]);
  });
});

describe("passtBeiZoom", () => {
  // About 1 km wide at 50.9° N.
  const box: [number, number, number, number] = [6.86, 50.93, 6.874, 50.935];
  it("knows when a way fits on screen at a zoom", () => {
    expect(passtBeiZoom(box, 390, 400, 15.5)).toBe(false);
    expect(passtBeiZoom(box, 390, 400, 14)).toBe(true);
    expect(passtBeiZoom([6.86, 50.93, 6.862, 50.931], 390, 400, 15.5)).toBe(true);
  });
});

describe("gefahrenJePunkt", () => {
  it("marks the points of a car ride, not those walked", () => {
    const fixes: Fix[] = [];
    let lon = 6.82;
    let t = 0;
    // 3 minutes walking (1.4 m/s), a minute's halt, then 3 minutes by car (14 m/s), a point every 5 s.
    for (let i = 0; i < 36; i++, t += 5000) fixes.push({ t, lon: (lon += (1.4 * 5) / 70_000), lat: 50.94, acc: 5 });
    for (let i = 0; i < 12; i++, t += 5000) fixes.push({ t, lon, lat: 50.94, acc: 5 });
    for (let i = 0; i < 36; i++, t += 5000) fixes.push({ t, lon: (lon += (14 * 5) / 70_000), lat: 50.94, acc: 5 });
    const g = gefahrenJePunkt(fixes);
    expect(g).toHaveLength(fixes.length);
    expect(g.slice(0, 30).some(Boolean)).toBe(false);
    expect(g.slice(60).every(Boolean)).toBe(true);
  });
});
