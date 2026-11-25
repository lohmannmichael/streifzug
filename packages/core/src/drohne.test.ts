import { describe, expect, it } from "vitest";
import { DROHNE_DECKEL_MS, DROHNE_TEMPO, planeDrohne, segmentArten } from "./drohne";
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

describe("planeDrohne (Tempo nach Bildschirm, Michi 25.11.2026)", () => {
  const weg = (arten: ReplayWeg["arten"], x0 = 6.82): ReplayWeg => ({ coords: linie(arten.length + 1, x0), arten });
  const dauer = (plan: ReturnType<typeof planeDrohne>, art: string) => plan.abschnitte.filter((a) => a.art === art).reduce((s, a) => s + a.dauer, 0);

  it("goes at fixed speeds per kind and keeps a short day short", () => {
    const plan = planeDrohne([weg(["neu", "neu", "bekannt", "bekannt", "gefahren", "gefahren"])]);
    // About 98 m of each kind.
    expect(dauer(plan, "neu")).toBeCloseTo((98.2 / DROHNE_TEMPO.neu) * 1000, -2);
    expect(dauer(plan, "neu") / dauer(plan, "bekannt")).toBeCloseTo(DROHNE_TEMPO.bekannt / DROHNE_TEMPO.neu, 0);
    expect(plan.dauer).toBeLessThan(2000);
  });

  it("1 km of new streets takes about 12 seconds", () => {
    const plan = planeDrohne([weg(Array(20).fill("neu"))]);
    expect(plan.dauer / 1000).toBeCloseTo(12.3, 0);
  });

  it("too long: known stretches go faster first, the new ones keep their pace", () => {
    // 2 km new (25 s) and 6 km known (10 s): 35 s, known three times as fast at most.
    const plan = planeDrohne([weg([...Array(40).fill("neu"), ...Array(120).fill("bekannt")])]);
    expect(plan.dauer).toBeCloseTo(30_000, -2);
    expect(dauer(plan, "neu")).toBeCloseTo((40 * 49.1 / DROHNE_TEMPO.neu) * 1000, -3);
  });

  it("much too long: known stretches and ways without anything new are left out", () => {
    const plan = planeDrohne([weg(Array(400).fill("bekannt")), weg(Array(40).fill("neu"), 6.9)], { flugMs: 900 });
    expect(plan.wege).toEqual([1]);
    expect(dauer(plan, "bekannt")).toBe(0);
  });

  it("a day with very much new: everything within 30 seconds", () => {
    const plan = planeDrohne([weg(Array(160).fill("neu"))]);
    expect(plan.dauer).toBeCloseTo(DROHNE_DECKEL_MS, -2);
  });

  it("leaves a pause between two ways for the flight", () => {
    const plan = planeDrohne([weg(["neu", "neu"]), weg(["neu", "neu"], 6.9)], { flugMs: 800 });
    const erster = plan.abschnitte.filter((a) => a.weg === 0).at(-1)!;
    const zweiter = plan.abschnitte.find((a) => a.weg === 1)!;
    expect(zweiter.start - (erster.start + erster.dauer)).toBeCloseTo(800, 0);
  });
});
