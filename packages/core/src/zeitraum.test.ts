import { describe, expect, it } from "vitest";
import { planeNachfahren } from "./nachfahren";
import type { ReplayWeg } from "./replay";
import { jahr, monat, monateZurueck, vormonat, woche } from "./zeitraum";

const t = (j: number, m: number, d: number, h = 12) => new Date(j, m - 1, d, h).getTime();
const tag = (x: number) => new Date(x).toDateString();

describe("Zeiträume (Bauplan 3, F2)", () => {
  // Sunday, 22 November 2026.
  const jetzt = t(2026, 11, 22, 21);

  it("week starts on Monday", () => {
    expect(tag(woche(jetzt).von)).toBe(new Date(2026, 10, 16).toDateString());
    expect(woche(jetzt).bis).toBe(new Date(2026, 10, 23).getTime());
  });

  it("month and year run from their first day", () => {
    expect(monat(jetzt)).toEqual({ von: new Date(2026, 10, 1).getTime(), bis: new Date(2026, 11, 1).getTime() });
    expect(jahr(jetzt)).toEqual({ von: new Date(2026, 0, 1).getTime(), bis: new Date(2027, 0, 1).getTime() });
  });

  it("knows the month before, also across a new year", () => {
    expect(vormonat(t(2027, 1, 3))).toEqual({ von: new Date(2026, 11, 1).getTime(), bis: new Date(2027, 0, 1).getTime() });
  });

  it("lists the past months back to a first day, newest first", () => {
    const m = monateZurueck(t(2026, 9, 20), jetzt);
    expect(m.map((x) => tag(x.von))).toEqual([new Date(2026, 9, 1).toDateString(), new Date(2026, 8, 1).toDateString()]);
  });
});

describe("planeNachfahren ohne Mindestzeiten (Zeitraum)", () => {
  it("shares the time by length when every way may be short", () => {
    const weg = (n: number, x: number): ReplayWeg => ({ coords: Array.from({ length: n }, (_, i) => [x + i * 0.0007, 50.9] as [number, number]), arten: Array(n - 1).fill("neu") });
    const plan = planeNachfahren([weg(11, 6.8), weg(31, 6.9)], [true, true], 10_000, { mitNeuem: 0, ohneNeues: 0 });
    const d = (i: number) => plan.abschnitte.filter((a) => a.weg === i).reduce((s, a) => s + a.dauer, 0);
    expect(plan.dauer).toBeCloseTo(10_000, -1);
    expect(d(1) / d(0)).toBeCloseTo(3, 1);
  });
});
