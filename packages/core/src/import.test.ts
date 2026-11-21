import { describe, expect, it } from "vitest";
import { density, parseGpx, splitOutings, summarizeImported } from "./import";
import type { Fix } from "./track";

describe("parseGpx", () => {
  it("reads track points with time", () => {
    const gpx = `<?xml version="1.0"?><gpx><trk><trkseg>
      <trkpt lat="50.94" lon="6.83"><ele>50</ele><time>2026-05-01T08:00:00Z</time></trkpt>
      <trkpt lon="6.8301" lat="50.9401"><time>2026-05-01T08:00:05Z</time><extensions><hAcc>4</hAcc></extensions></trkpt>
      <trkpt lat="50.95" lon="6.84"></trkpt>
    </trkseg></trk></gpx>`;
    const fixes = parseGpx(gpx);
    expect(fixes).toHaveLength(2);
    expect(fixes[1]).toMatchObject({ lon: 6.8301, lat: 50.9401, acc: 4 });
  });
});

const fix = (t: number, nordM: number): Fix => ({ t: t * 1000, lon: 6.83, lat: 50.94 + nordM / 111_195, acc: 5 });

describe("splitOutings", () => {
  it("splits at pauses over 10 minutes and drops tiny parts", () => {
    const fixes = [fix(0, 0), fix(30, 40), fix(60, 80), fix(2000, 80), fix(2030, 82), fix(2060, 84)];
    const teile = splitOutings(fixes);
    expect(teile).toHaveLength(1);
    expect(teile[0]).toHaveLength(3);
  });
});

describe("splitOutings at jumps", () => {
  it("never connects points more than 300 m apart", () => {
    const teile = splitOutings([fix(0, 0), fix(30, 40), fix(60, 80), fix(90, 900), fix(120, 940), fix(150, 980)]);
    expect(teile.map((t) => t.length)).toEqual([3, 3]);
  });
});

describe("summarizeImported", () => {
  it("measures sparse outings and tells walking from cycling", () => {
    const zuFuss = summarizeImported([fix(0, 0), fix(120, 150), fix(240, 300)]);
    expect(zuFuss.distanceM).toBeCloseTo(300, 0);
    expect(zuFuss.mode).toBe("foot");
    expect(summarizeImported([fix(0, 0), fix(60, 300), fix(120, 600)]).mode).toBe("bike");
  });
});

describe("density", () => {
  it("counts pairs close in time or space", () => {
    expect(density([[fix(0, 0), fix(30, 40), fix(300, 50), fix(600, 400)]])).toBeCloseTo(2 / 3, 5);
  });
});
