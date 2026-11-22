import { describe, expect, it } from "vitest";
import type { LonLat } from "./geo";
import { ueberblickLinien, UEBERBLICK_RASTER } from "./ueberblick";

const stueck = (a: LonLat, b: LonLat) => ({ coords: [a, b] });

describe("ueberblickLinien (Bauplan 3, F5)", () => {
  it("snaps pieces to a coarse grid and drops what falls on one point", () => {
    const r = UEBERBLICK_RASTER;
    const l = ueberblickLinien([stueck([6.8, 50.9], [6.8 + r, 50.9]), stueck([6.8, 50.9], [6.8 + r * 0.2, 50.9])]);
    expect(l).toEqual([[[6.8, 50.9], [6.8 + r, 50.9]]]);
  });

  it("keeps a segment once, whichever direction it was walked", () => {
    const r = UEBERBLICK_RASTER;
    const l = ueberblickLinien([stueck([6.8, 50.9], [6.8 + r, 50.9]), stueck([6.8 + r, 50.9], [6.8, 50.9])]);
    expect(l).toHaveLength(1);
  });

  it("makes far fewer lines from many short pieces along one street", () => {
    const stuecke = Array.from({ length: 400 }, (_, i) => stueck([6.8 + i * 0.0003, 50.9], [6.8 + (i + 1) * 0.0003, 50.9]));
    const l = ueberblickLinien(stuecke);
    expect(l.length).toBeLessThan(140);
    expect(l.length).toBeGreaterThan(80);
  });
});
