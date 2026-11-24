import { describe, expect, it } from "vitest";
import { drohnenZiel, planeDrohne, segmentArten, DROHNE_TEMPO } from "./drohne";
import type { LonLat } from "./geo";
import type { ReplayWeg } from "./replay";

// A straight way east: n points about 50 m apart.
const linie = (n: number, x0 = 6.82): LonLat[] => Array.from({ length: n }, (_, i) => [x0 + i * 0.0007, 50.94]);

describe("segmentArten (Bauplan 3, F1 Variante Drohne)", () => {
  it("marks segments along new pieces as new, the others as known, car parts as driven", () => {
    const coords = linie(7);
    const neu = [{ coords: [coords[1]!, coords[3]!] }];
    const gefahren = [false, false, false, false, false, true, true];
    expect(segmentArten(coords, neu, gefahren)).toEqual(["bekannt", "neu", "neu", "bekannt", "bekannt", "gefahren"]);
  });
});

describe("planeDrohne", () => {
  const weg = (arten: ReplayWeg["arten"]): ReplayWeg => ({ coords: linie(arten.length + 1), arten });

  it("draws new streets slowly, glides over known ones and races through car rides", () => {
    const plan = planeDrohne([weg(["neu", "neu", "bekannt", "bekannt", "gefahren", "gefahren"])], 1e9);
    const d = (art: string) => plan.abschnitte.filter((a) => a.art === art).reduce((s, a) => s + a.dauer, 0);
    expect(d("neu") / d("bekannt")).toBeCloseTo(DROHNE_TEMPO.bekannt / DROHNE_TEMPO.neu, 0);
    expect(d("gefahren")).toBeLessThan(d("bekannt"));
  });

  it("fits a long day into the time given and stretches a very short one to it", () => {
    const lang = planeDrohne([weg(Array(300).fill("neu"))], 15_000);
    expect(lang.dauer).toBeCloseTo(15_000, -1);
    const kurz = planeDrohne([weg(["neu", "neu"])], 5_000);
    expect(kurz.dauer).toBeCloseTo(5_000, -1);
  });

  it("leaves a pause between two ways for the flight", () => {
    const plan = planeDrohne([weg(["neu", "neu"]), weg(["neu", "neu"])], 1e9, 800);
    const erster = plan.abschnitte.filter((a) => a.weg === 0).at(-1)!;
    const zweiter = plan.abschnitte.find((a) => a.weg === 1)!;
    expect(zweiter.start - (erster.start + erster.dauer)).toBeCloseTo(800, 0);
  });
});

describe("drohnenZiel", () => {
  it("is 5 s plus 3 s per new kilometre, at most 15 s", () => {
    expect(drohnenZiel(0)).toBe(5000);
    expect(drohnenZiel(1000)).toBe(8000);
    expect(drohnenZiel(10_000)).toBe(15_000);
  });
});
