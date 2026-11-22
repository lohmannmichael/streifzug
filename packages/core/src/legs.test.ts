import { describe, expect, it } from "vitest";
import { seenByLegs, splitLegs } from "./legs";
import type { Piece } from "./pieces";
import type { Fix } from "./track";

const M_LAT = 1 / 111_195;

/** Moving north from `startM` at `kmh` for `sekunden`, one point every `takt` s. */
function strecke(t0: number, startM: number, kmh: number, sekunden: number, takt = 2, motion?: string[]): Fix[] {
  const v = kmh / 3.6;
  const out: Fix[] = [];
  for (let s = 0; s <= sekunden; s += takt) out.push({ t: t0 + s * 1000, lon: 6.83, lat: 50.94 + (startM + v * s) * M_LAT, acc: 8, ...(motion ? { motion } : {}) });
  return out;
}
/** Standing at `startM` for `sekunden`. */
const halt = (t0: number, startM: number, sekunden: number, motion?: string[]) => strecke(t0, startM, 0, sekunden, 2, motion);
const arten = (fixes: Fix[]) => splitLegs(fixes).map((l) => l.art);

describe("splitLegs", () => {
  it("on foot is aktiv", () => {
    expect(arten(strecke(0, 0, 5, 600))).toEqual(["aktiv"]);
  });

  it("by bike is aktiv", () => {
    expect(arten(strecke(0, 0, 18, 600))).toEqual(["aktiv"]);
  });

  it("by car is gefahren", () => {
    expect(arten(strecke(0, 0, 50, 600))).toEqual(["gefahren"]);
  });

  it("foot, train, foot gives three legs split at the halts", () => {
    const a = strecke(0, 0, 5, 300); // 417 m
    const h1 = halt(302_000, 417, 120);
    const b = strecke(424_000, 417, 80, 600); // 13.3 km
    const h2 = halt(1_026_000, 13_750, 60);
    const c = strecke(1_088_000, 13_750, 5, 300);
    const legs = splitLegs([...a, ...h1, ...b, ...h2, ...c]);
    expect(legs.map((l) => l.art)).toEqual(["aktiv", "gefahren", "aktiv"]);
  });

  it("a red light (40 s stop) in a car ride stays gefahren on both sides", () => {
    const a = strecke(0, 0, 50, 120);
    const h = halt(122_000, 1667, 40);
    const b = strecke(164_000, 1667, 50, 120);
    expect(arten([...a, ...h, ...b])).toEqual(["gefahren", "gefahren"]);
  });

  it("a traffic jam at walking pace is gefahren when the phone says automotive", () => {
    expect(arten(strecke(0, 0, 8, 600, 2, ["automotive"]))).toEqual(["gefahren"]);
  });

  it("a road bike at 33 km/h is aktiv with motion cycling", () => {
    expect(arten(strecke(0, 0, 33, 600, 2, ["cycling"]))).toEqual(["aktiv"]);
  });

  it("a road bike at 33 km/h without motion is gefahren and unsicher", () => {
    const [leg] = splitLegs(strecke(0, 0, 33, 600));
    expect(leg).toMatchObject({ art: "gefahren", unsicher: true });
  });

  it("a short burst between two walks takes the neighbours' kind", () => {
    const a = strecke(0, 0, 5, 300);
    const h1 = halt(302_000, 417, 40);
    const b = strecke(344_000, 417, 45, 10); // 125 m in 10 s
    const h2 = halt(356_000, 542, 40);
    const c = strecke(398_000, 542, 5, 300);
    expect(arten([...a, ...h1, ...b, ...h2, ...c])).toEqual(["aktiv", "aktiv", "aktiv"]);
  });

  it("splits at gaps over 60 s and drops very inaccurate points", () => {
    const a = strecke(0, 0, 5, 120);
    const b = strecke(300_000, 200, 5, 120);
    const schlecht = { t: 130_000, lon: 6.83, lat: 50.95, acc: 80 };
    expect(splitLegs([...a, schlecht, ...b])).toHaveLength(2);
  });
});

describe("seenByLegs", () => {
  const at = (m: number): [number, number] => [6.83, 50.94 + m * M_LAT];
  const piece = (id: string, von: number, bis: number, kind: Piece["kind"] = "street"): Piece => ({ id, kind, weight: 1, lengthM: bis - von, coords: [at(von), at(bis)], mid: at((von + bis) / 2) });

  it("credits the walk to aktiv and the train to gefahren, motorways only to gefahren", () => {
    const pieces = [piece("fuss", 50, 75), piece("bahn", 5000, 5025), piece("autobahn", 6000, 6025, "drive")];
    const a = strecke(0, 0, 5, 300);
    const h1 = halt(302_000, 417, 120);
    const b = strecke(424_000, 417, 80, 600);
    const r = seenByLegs(pieces, [...a, ...h1, ...b]);
    expect([...r.aktiv]).toEqual(["fuss"]);
    expect([...r.gefahren].sort()).toEqual(["autobahn", "bahn"]);
  });

  it("keeps the street between two walks when you slowed down in between (Overland every 31 s)", () => {
    // Walking at 1.4 m/s, a point every 31 s; in the middle two slow minutes (waiting at a crossing).
    const pos = [0, 43, 86, 129, 172, 175, 178, 181, 224, 267, 310, 353];
    const fixes: Fix[] = pos.map((m, i) => ({ t: i * 31_000, lon: 6.83, lat: 50.94 + m * M_LAT, acc: 8 }));
    const r = seenByLegs([piece("davor", 100, 170), piece("dazwischen", 181, 224), piece("danach", 230, 340)], fixes, { maxGapM: 60 });
    expect([...r.aktiv].sort()).toEqual(["danach", "davor", "dazwischen"]);
  });
});

describe("Overland motion words", () => {
  it('"driving" at 25 km/h is a (cargo) bike, not a car', () => {
    expect(arten(strecke(0, 0, 25, 300, 6, ["driving"]))).toEqual(["aktiv"]);
  });

  it('"driving" over 30 km/h is a car', () => {
    expect(arten(strecke(0, 0, 45, 300, 6, ["driving"]))).toEqual(["gefahren"]);
  });
});

