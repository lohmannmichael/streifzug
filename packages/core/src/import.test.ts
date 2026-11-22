import { describe, expect, it } from "vitest";
import { cleanFixes, density, parseGpx, splitOutings, summarizeImported } from "./import";
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

describe("cleanFixes", () => {
  // Köln in the morning, then a flight: Lissabon is about 1850 km away.
  const koeln = (t: number, i: number): Fix => ({ t: t * 1000, lon: 6.83 + i * 0.0001, lat: 50.94, acc: 5 });
  const lissabon = (t: number, i: number): Fix => ({ t: t * 1000, lon: -9.14 + i * 0.0001, lat: 38.71, acc: 5 });

  it("drops a single point that would need more than plane speed (GPS outlier)", () => {
    const fixes = [koeln(0, 0), koeln(5, 1), { ...koeln(10, 2), lat: 51.5 }, koeln(15, 3)];
    expect(cleanFixes(fixes).map((f) => f.t / 1000)).toEqual([0, 5, 15]);
  });

  it("keeps the ways at the destination after a flight (3 hours later, same batch)", () => {
    const morgen = [0, 5, 10].map((t, i) => koeln(t, i));
    const ankunft = 3 * 3600;
    const dort = [0, 5, 10, 15].map((t, i) => lissabon(ankunft + t, i));
    expect(cleanFixes([...morgen, ...dort])).toHaveLength(7);
  });

  it("still drops a lone outlier after a pause when the next point does not confirm it", () => {
    const pause = 3600;
    const fixes = [koeln(0, 0), koeln(5, 1), { ...koeln(pause, 2), lat: 38.71 }, koeln(pause + 5, 3), koeln(pause + 10, 4)];
    expect(cleanFixes(fixes).map((f) => f.t / 1000)).toEqual([0, 5, pause + 5, pause + 10]);
  });
});
