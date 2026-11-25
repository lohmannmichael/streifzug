import { describe, expect, it } from "vitest";
import { polaroidStationen, wegArt, type PolaroidWeg } from "./polaroid";

const H = 3600_000;
const TAG = 24 * H;
// Days start at multiples of TAG in these tests.
const tagBeginn = (t: number) => Math.floor(t / TAG) * TAG;
const weg = (startedAt: number, distanceM = 1000, minuten = 15, gefahrenAnteil = 0): PolaroidWeg => ({ startedAt, endedAt: startedAt + minuten * 60_000, distanceM, gefahrenAnteil });

describe("polaroidStationen (Polaroid beim Öffnen, Michi 25.11.2026)", () => {
  it("one day: one picture per way, in the order walked, each new until the next starts", () => {
    const st = polaroidStationen([weg(10 * TAG + 17 * H), weg(10 * TAG + 8 * H, 3200)], tagBeginn);
    expect(st.map((s) => s.wege)).toEqual([[1], [0]]);
    expect(st.every((s) => s.art === "weg" && s.tag === 10 * TAG)).toBe(true);
    expect(st[0]!.seit).toBe(10 * TAG + 8 * H);
    expect(st[0]!.bis).toBe(10 * TAG + 17 * H);
    expect(st[1]!.bis).toBe(Infinity);
    expect(st[0]!.distanceM).toBe(3200);
  });

  it("several days: one picture per day, oldest first, with the day's ways", () => {
    const st = polaroidStationen([weg(12 * TAG + 9 * H), weg(10 * TAG + 8 * H), weg(10 * TAG + 18 * H)], tagBeginn);
    expect(st.map((s) => [s.tag, s.wege])).toEqual([[10 * TAG, [1, 2]], [12 * TAG, [0]]]);
    expect(st[0]!.art).toBe("tag");
    expect(st[0]!.bis).toBe(12 * TAG + 9 * H);
    expect(st[0]!.distanceM).toBe(2000);
  });

  it("nothing came in: no pictures", () => {
    expect(polaroidStationen([], tagBeginn)).toEqual([]);
  });
});

describe("wegArt", () => {
  it("on foot, by bike, by car", () => {
    expect(wegArt(weg(0, 1000, 15))).toBe("fuss");
    expect(wegArt(weg(0, 3200, 12))).toBe("rad");
    expect(wegArt(weg(0, 13_400, 20, 0.9))).toBe("auto");
  });
});
