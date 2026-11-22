import { describe, expect, it } from "vitest";
import { eckenSchliessen, lueckenSchliessen } from "./luecken";
import type { Piece } from "./pieces";

const M = 1 / 111_195;
const stueck = (id: string, von: number, bis: number, kind: Piece["kind"] = "street"): Piece => ({
  id,
  kind,
  weight: 1,
  lengthM: bis - von,
  coords: [[6.83, 50.94 + von * M], [6.83, 50.94 + bis * M]],
  mid: [6.83, 50.94 + ((von + bis) / 2) * M],
});

describe("lueckenSchliessen", () => {
  const a = stueck("a", 0, 80);
  const kurz = stueck("kurz", 80, 110);
  const b = stueck("b", 110, 200);

  it("fills a short piece between two walked ones", () => {
    expect([...lueckenSchliessen([a, kurz, b], new Set(["a", "b"]))]).toEqual(["kurz"]);
  });

  it("leaves a gap open when only one side was walked", () => {
    expect(lueckenSchliessen([a, kurz, b], new Set(["a"])).size).toBe(0);
  });

  it("leaves long pieces open", () => {
    const lang = stueck("lang", 80, 180);
    const c = stueck("c", 180, 260);
    expect(lueckenSchliessen([a, lang, c], new Set(["a", "c"])).size).toBe(0);
  });

  it("closes a gap of two short pieces", () => {
    const k1 = stueck("k1", 80, 100);
    const k2 = stueck("k2", 100, 120);
    const c = stueck("c", 120, 200);
    expect([...lueckenSchliessen([a, k1, k2, c], new Set(["a", "c"]))].sort()).toEqual(["k1", "k2"]);
  });

  it("never fills motorways", () => {
    expect(lueckenSchliessen([a, stueck("ab", 80, 110, "drive"), b], new Set(["a", "b"])).size).toBe(0);
  });
});

describe("eckenSchliessen", () => {
  const a = stueck("a", 0, 80);
  const ecke = stueck("ecke", 80, 105);
  const fix = (m: number, acc = 5) => ({ lon: 6.83, lat: 50.94 + m * M, acc });

  it("counts a corner piece next to yellow with a point near its middle", () => {
    expect([...eckenSchliessen([a, ecke], new Set(["a"]), [fix(93)])]).toEqual(["ecke"]);
  });

  it("not without a point near the middle (just crossing at the junction)", () => {
    expect(eckenSchliessen([a, ecke], new Set(["a"]), [fix(80)]).size).toBe(0);
  });

  it("not when the piece does not join anything yellow", () => {
    expect(eckenSchliessen([a, ecke], new Set(), [fix(93)]).size).toBe(0);
  });

  it("not with an inaccurate point", () => {
    expect(eckenSchliessen([a, ecke], new Set(["a"]), [fix(93, 30)]).size).toBe(0);
  });
});

