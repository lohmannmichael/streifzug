import { describe, expect, it } from "vitest";
import { einrasten, meterBis, monatsAnfaenge, zeitleiste } from "./zeitreise";

const tag = (j: number, m: number, d: number, h = 12) => new Date(j, m - 1, d, h).getTime();

describe("zeitleiste / meterBis", () => {
  const z = zeitleiste([
    { t: tag(2026, 11, 20), m: 100 },
    { t: tag(2026, 11, 3), m: 50 },
    { t: tag(2026, 11, 10), m: 25 },
  ]);

  it("sums the meters first walked up to a moment", () => {
    expect(meterBis(z, tag(2026, 11, 1))).toBe(0);
    expect(meterBis(z, tag(2026, 11, 3))).toBe(50);
    expect(meterBis(z, tag(2026, 11, 15))).toBe(75);
    expect(meterBis(z, tag(2026, 12, 1))).toBe(175);
  });

  it("is empty without pieces", () => {
    expect(meterBis(zeitleiste([]), tag(2026, 11, 1))).toBe(0);
  });

  it("stays fast with many pieces", () => {
    const viele = Array.from({ length: 100_000 }, (_, i) => ({ t: i, m: 1 }));
    const g = zeitleiste(viele);
    expect(meterBis(g, 49_999)).toBe(50_000);
  });
});

describe("monatsAnfaenge", () => {
  it("lists the first day of every month inside the range", () => {
    const m = monatsAnfaenge(tag(2026, 9, 14), tag(2026, 11, 22));
    expect(m.map((t) => new Date(t).toDateString())).toEqual([new Date(2026, 9, 1).toDateString(), new Date(2026, 10, 1).toDateString()]);
  });

  it("is empty within one month", () => {
    expect(monatsAnfaenge(tag(2026, 11, 19), tag(2026, 11, 22))).toEqual([]);
  });
});

describe("einrasten", () => {
  const anfaenge = monatsAnfaenge(tag(2026, 9, 14), tag(2026, 11, 22));

  it("snaps to the start of a month within two days", () => {
    expect(new Date(einrasten(tag(2026, 10, 2), anfaenge)).toDateString()).toBe(new Date(2026, 9, 1).toDateString());
    expect(new Date(einrasten(tag(2026, 10, 30), anfaenge)).toDateString()).toBe(new Date(2026, 10, 1).toDateString());
  });

  it("leaves days between month starts free", () => {
    expect(einrasten(tag(2026, 10, 15), anfaenge)).toBe(tag(2026, 10, 15));
  });
});
