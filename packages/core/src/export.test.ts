import { inflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { crc32, gpxAus, zipErstellen } from "./export";
import { parseGpx } from "./import";
import type { Fix } from "./track";

const weg: Fix[] = Array.from({ length: 50 }, (_, i) => ({
  t: Date.UTC(2026, 10, 21, 10, 0, i * 6),
  lon: 6.83 + i * 0.0001,
  lat: 50.94,
  acc: 4 + (i % 5),
  ...(i % 2 ? { motion: ["cycling"] } : {}),
  speed: 6,
}));

describe("gpxAus", () => {
  it("reads back to the same points, accuracy, motion and speed", () => {
    const zurueck = parseGpx(gpxAus(weg, "Weg <1> & Co"));
    expect(zurueck).toHaveLength(weg.length);
    expect(zurueck[7]).toEqual({ ...weg[7], lat: Number(weg[7]!.lat.toFixed(7)), lon: Number(weg[7]!.lon.toFixed(7)) });
    expect(zurueck[8]!.motion).toBeUndefined();
  });

  it("escapes the name", () => {
    expect(gpxAus([], "a < b & c")).toContain("<name>a &lt; b &amp; c</name>");
  });
});

describe("zipErstellen", () => {
  it("crc32 matches the known value", () => {
    expect(crc32(new TextEncoder().encode("hello"))).toBe(0x3610a686);
  });

  it("writes entries that unpack to the same content", async () => {
    const text = gpxAus(weg, "Test");
    const zip = await zipErstellen([
      { name: "wege/2026-11-21.gpx", daten: new TextEncoder().encode(text) },
      { name: "unterwegs.json", daten: new TextEncoder().encode('{"a":1}') },
    ]);
    const v = new DataView(zip.buffer);
    expect(v.getUint32(0, true)).toBe(0x04034b50);
    // End record: two entries.
    expect(v.getUint16(zip.length - 22 + 8, true)).toBe(2);
    // First entry: read it back.
    const methode = v.getUint16(8, true);
    const groesse = v.getUint32(18, true);
    const nameLaenge = v.getUint16(26, true);
    const inhalt = zip.subarray(30 + nameLaenge, 30 + nameLaenge + groesse);
    const daten = methode === 8 ? new Uint8Array(inflateRawSync(inhalt)) : inhalt;
    expect(new TextDecoder().decode(daten)).toBe(text);
    expect(crc32(daten)).toBe(v.getUint32(14, true));
  });
});
