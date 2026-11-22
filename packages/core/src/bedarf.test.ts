import { describe, expect, it } from "vitest";
import { orteImBlick, orteMitPunkten, ZOOM_ORTE_LADEN } from "./bedarf";

const koeln = { id: "koeln", bbox: [6.77, 50.83, 7.16, 51.09] as [number, number, number, number] };
const freising = { id: "freising", bbox: [11.64, 48.33, 11.79, 48.45] as [number, number, number, number] };
const nyc = { id: "new-york", bbox: [-74.26, 40.48, -73.7, 40.92] as [number, number, number, number] };
const alle = [koeln, freising, nyc];

describe("orteImBlick", () => {
  it("finds places whose box overlaps the view", () => {
    expect(orteImBlick(alle, [6.9, 50.9, 7.0, 51.0], 14)).toEqual(["koeln"]);
  });

  it("counts a view that only touches the edge of a place", () => {
    expect(orteImBlick(alle, [7.1, 51.0, 7.3, 51.2], 12)).toEqual(["koeln"]);
  });

  it("finds nothing far away from every place", () => {
    expect(orteImBlick(alle, [2.3, 48.8, 2.4, 48.9], 14)).toEqual([]);
  });

  it("loads nothing when zoomed out further than a region", () => {
    expect(orteImBlick(alle, [-20, 30, 30, 60], ZOOM_ORTE_LADEN - 0.5)).toEqual([]);
  });

  it("finds several places in one wide view", () => {
    expect(orteImBlick(alle, [6, 48, 12, 52], ZOOM_ORTE_LADEN)).toEqual(["koeln", "freising"]);
  });
});

describe("orteMitPunkten", () => {
  it("finds the places that contain at least one point", () => {
    expect(orteMitPunkten(alle, [[6.95, 50.94], [11.7, 48.4], [11.71, 48.41]])).toEqual(["koeln", "freising"]);
  });

  it("ignores points outside every place", () => {
    expect(orteMitPunkten(alle, [[2.35, 48.85]])).toEqual([]);
  });

  it("works for very many points without a stack overflow", () => {
    const viele: [number, number][] = Array.from({ length: 300_000 }, (_, i) => [6.8 + (i % 100) / 1000, 50.9]);
    expect(orteMitPunkten(alle, viele)).toEqual(["koeln"]);
  });
});
