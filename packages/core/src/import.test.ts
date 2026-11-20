import { describe, expect, it } from "vitest";
import { density, parseGoogleTimeline, parseGpx, parseLatLngText, splitOutings, summarizeImported } from "./import";
import type { Fix } from "./track";

describe("parseLatLngText", () => {
  it("reads the iPhone geo: form", () => {
    expect(parseLatLngText("geo:50.940000,6.830000")).toEqual([6.83, 50.94]);
  });

  it("reads the Android degree form", () => {
    expect(parseLatLngText("50.9406794°, 6.8319856°")).toEqual([6.8319856, 50.9406794]);
  });

  it("rejects nonsense", () => {
    expect(parseLatLngText("hello")).toBeNull();
    expect(parseLatLngText("geo:95,6")).toBeNull();
  });
});

describe("parseGoogleTimeline", () => {
  it("reads the iPhone export and spreads points within the same minute", () => {
    const json = [
      { startTime: "2026-05-01T10:00:00.000+02:00", endTime: "2026-05-01T12:00:00.000+02:00", visit: { topCandidate: { placeLocation: "geo:50.9,6.8" } } },
      {
        startTime: "2026-05-01T10:00:00.000+02:00",
        endTime: "2026-05-01T12:00:00.000+02:00",
        timelinePath: [
          { point: "geo:50.9400,6.8300", durationMinutesOffsetFromStartTime: "1" },
          { point: "geo:50.9401,6.8300", durationMinutesOffsetFromStartTime: "1" },
          { point: "geo:50.9402,6.8300", durationMinutesOffsetFromStartTime: "2" },
        ],
      },
    ];
    const fixes = parseGoogleTimeline(json);
    expect(fixes).toHaveLength(3);
    expect(fixes[0]!.t).toBe(Date.parse("2026-05-01T08:01:00Z"));
    expect(fixes[1]!.t).toBe(Date.parse("2026-05-01T08:01:30Z"));
    expect(fixes[2]!.lat).toBeCloseTo(50.9402, 6);
  });

  it("reads the Android export: path points and raw signals, skipping inaccurate ones", () => {
    const json = {
      semanticSegments: [{ startTime: "2026-05-01T10:00:00+02:00", timelinePath: [{ point: "50.94°, 6.83°", time: "2026-05-01T10:00:00+02:00" }] }],
      rawSignals: [
        { position: { LatLng: "50.9401°, 6.8301°", accuracyMeters: 8, timestamp: "2026-05-01T10:00:20+02:00" } },
        { position: { LatLng: "50.9402°, 6.8302°", accuracyMeters: 400, timestamp: "2026-05-01T10:00:40+02:00" } },
        { wifiScan: {} },
      ],
    };
    const fixes = parseGoogleTimeline(json);
    expect(fixes.map((f) => f.acc)).toEqual([15, 8]);
  });

  it("reads the old Takeout Records.json", () => {
    const json = { locations: [{ latitudeE7: 509400000, longitudeE7: 68300000, accuracy: 10, timestamp: "2020-01-01T10:00:00Z" }, { latitudeE7: 509401000, longitudeE7: 68300000, accuracy: 10, timestampMs: "1577872810000" }] };
    const fixes = parseGoogleTimeline(json);
    expect(fixes).toHaveLength(2);
    expect(fixes[1]!.t).toBe(1577872810000);
  });

  it("reads the old monthly semantic files", () => {
    const json = { timelineObjects: [{ activitySegment: { simplifiedRawPath: { points: [{ latE7: 509400000, lngE7: 68300000, accuracyMeters: 5, timestamp: "2020-01-01T10:00:00Z" }] } } }, { placeVisit: {} }] };
    expect(parseGoogleTimeline(json)).toHaveLength(1);
  });

  it("drops jumps faster than 50 m/s", () => {
    const json = { locations: [
      { latitudeE7: 509400000, longitudeE7: 68300000, accuracy: 5, timestamp: "2020-01-01T10:00:00Z" },
      { latitudeE7: 519400000, longitudeE7: 68300000, accuracy: 5, timestamp: "2020-01-01T10:00:10Z" },
      { latitudeE7: 509401000, longitudeE7: 68300000, accuracy: 5, timestamp: "2020-01-01T10:00:20Z" },
    ] };
    expect(parseGoogleTimeline(json)).toHaveLength(2);
  });

  it("returns nothing for unrelated JSON", () => {
    expect(parseGoogleTimeline({ hello: "world" })).toEqual([]);
  });
});

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
