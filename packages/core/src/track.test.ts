import { describe, expect, it } from "vitest";
import { acceptFix, decodeTrack, encodeTrack, summarize, type Fix } from "./track";

// Walk east from Köln-Weiden: about 1.4 m/s (5 km/h). 1 m ≈ 1/70_068 degrees longitude here.
const M = 1 / 70_068;
const walk = (n: number, speed = 1.4, start = 1_700_000_000_000): Fix[] =>
  Array.from({ length: n }, (_, i) => ({ t: start + i * 1000, lon: 6.83 + i * speed * M, lat: 50.94, acc: 5 }));

describe("acceptFix", () => {
  it("accepts the first good fix", () => {
    expect(acceptFix(null, { t: 1, lon: 6.83, lat: 50.94, acc: 8 })).toBe(true);
  });

  it("rejects inaccurate fixes (over 25 m)", () => {
    expect(acceptFix(null, { t: 1, lon: 6.83, lat: 50.94, acc: 40 })).toBe(false);
  });

  it("rejects fixes that are not newer", () => {
    const a = walk(1)[0]!;
    expect(acceptFix(a, { ...a })).toBe(false);
  });

  it("rejects impossible jumps (faster than 50 m/s)", () => {
    const a = walk(1)[0]!;
    expect(acceptFix(a, { ...a, t: a.t + 1000, lon: a.lon + 500 * M })).toBe(false);
  });

  it("accepts a normal step", () => {
    const [a, b] = walk(2);
    expect(acceptFix(a!, b!)).toBe(true);
  });
});

describe("summarize", () => {
  it("measures distance and duration of a walk and calls it foot", () => {
    const s = summarize(walk(101));
    expect(s.distanceM).toBeCloseTo(140, 0);
    expect(s.durationS).toBe(100);
    expect(s.mode).toBe("foot");
  });

  it("recognises cycling and driving by typical speed", () => {
    expect(summarize(walk(60, 5)).mode).toBe("bike");
    expect(summarize(walk(60, 14)).mode).toBe("car");
  });

  it("does not bridge long gaps (signal lost for more than a minute)", () => {
    const a = walk(11);
    const b = walk(11, 1.4, a[10]!.t + 300_000).map((f) => ({ ...f, lon: f.lon + 2000 * M }));
    const s = summarize([...a, ...b]);
    expect(s.distanceM).toBeCloseTo(28, 0);
  });

  it("handles empty and single-fix tracks", () => {
    expect(summarize([])).toEqual({ distanceM: 0, durationS: 0, mode: "foot" });
    expect(summarize(walk(1)).distanceM).toBe(0);
  });
});

describe("encodeTrack / decodeTrack", () => {
  it("round-trips a track with about 0.1 m and 0.1 s precision", () => {
    const fixes = walk(50);
    const back = decodeTrack(encodeTrack(fixes));
    expect(back).toHaveLength(50);
    back.forEach((f, i) => {
      expect(Math.abs(f.lon - fixes[i]!.lon)).toBeLessThan(2e-6);
      expect(Math.abs(f.lat - fixes[i]!.lat)).toBeLessThan(2e-6);
      expect(Math.abs(f.t - fixes[i]!.t)).toBeLessThanOrEqual(100);
      expect(f.acc).toBe(5);
    });
  });

  it("is much smaller than plain JSON", () => {
    const fixes = walk(600);
    expect(JSON.stringify(encodeTrack(fixes)).length).toBeLessThan(JSON.stringify(fixes).length / 3);
  });
});
