import { describe, expect, it } from "vitest";
import type { LonLat } from "./geo";
import { freigabeZeiten, planeRueckblick, REPLAY_BUDGET_MS, REPLAY_WECHSEL_MS, standBei, type ReplayArt, type ReplayWeg } from "./replay";

// A straight way east from Weiden: n points about 50 m apart.
function weg(n: number, art: ReplayArt | ReplayArt[], start: LonLat = [6.82, 50.94]): ReplayWeg {
  const coords: LonLat[] = [];
  for (let i = 0; i < n; i++) coords.push([start[0] + i * 0.0007, start[1]]);
  const arten = Array.from({ length: n - 1 }, (_, i) => (Array.isArray(art) ? art[i % art.length]! : art));
  return { coords, arten };
}

describe("planeRueckblick", () => {
  it("draws new streets slowly and glides over known ones five times faster", () => {
    const plan = planeRueckblick([weg(11, ["neu", "neu", "neu", "neu", "neu", "bekannt", "bekannt", "bekannt", "bekannt", "bekannt"])]);
    expect(plan.abschnitte.map((a) => a.art)).toEqual(["neu", "bekannt"]);
    const [neu, bekannt] = plan.abschnitte;
    expect(neu!.dauer / bekannt!.dauer).toBeCloseTo(5, 0);
    expect(neu!.start).toBe(REPLAY_WECHSEL_MS);
  });

  it("stays within 20 seconds by dropping ways without anything new", () => {
    const wege = [weg(200, "bekannt"), weg(40, "neu"), weg(200, "bekannt")];
    const plan = planeRueckblick(wege);
    expect(plan.dauer).toBeLessThanOrEqual(REPLAY_BUDGET_MS + 1);
    expect(plan.wege).toContain(1);
  });

  it("keeps only the three ways with the most new meters when needed", () => {
    const wege = [10, 60, 20, 50, 40].map((n) => weg(n * 3, "neu"));
    const plan = planeRueckblick(wege);
    expect(plan.wege).toEqual([1, 3, 4]);
    expect(plan.dauer).toBeLessThanOrEqual(REPLAY_BUDGET_MS + 1);
  });

  it("leaves out empty ways", () => {
    expect(planeRueckblick([{ coords: [[6.8, 50.9]], arten: [] }]).wege).toEqual([]);
  });
});

describe("standBei", () => {
  it("moves the pen along the way, lifted over known parts and at the end", () => {
    const w = [weg(11, ["neu", "neu", "neu", "neu", "neu", "bekannt", "bekannt", "bekannt", "bekannt", "bekannt"])];
    const plan = planeRueckblick(w);
    const anfang = standBei(plan, w, 0);
    expect(anfang.abgehoben).toBe(true);
    const mitteNeu = standBei(plan, w, plan.abschnitte[0]!.start + plan.abschnitte[0]!.dauer / 2);
    expect(mitteNeu.abgehoben).toBe(false);
    expect(mitteNeu.m).toBeGreaterThan(100);
    expect(mitteNeu.richtung).toBeCloseTo(90, 0);
    expect(standBei(plan, w, plan.abschnitte[1]!.start + 10).abgehoben).toBe(true);
    expect(standBei(plan, w, plan.dauer + 1).fertig).toBe(true);
  });
});

describe("freigabeZeiten", () => {
  it("releases a piece when the pen passes it, unreachable ones never", () => {
    const w = [weg(11, "neu")];
    const plan = planeRueckblick(w);
    const zeiten = freigabeZeiten(plan, w, [
      { id: "nah", coords: [[6.8235, 50.9401], [6.8245, 50.9401]] },
      { id: "fern", coords: [[6.9, 50.99], [6.91, 50.99]] },
    ]);
    expect(zeiten.get("nah")).toBeGreaterThan(plan.abschnitte[0]!.start);
    expect(zeiten.get("nah")).toBeLessThan(plan.dauer);
    expect(zeiten.get("fern")).toBe(Infinity);
  });
});
