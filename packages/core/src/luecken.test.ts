import { describe, expect, it } from "vitest";
import { eckenSchliessen, lueckenSchliessen, stummelEntfernen } from "./luecken";
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


describe("stummelEntfernen (Michi, 25.11.2026: kleine Kreuze und Stummel an Kreuzungen)", () => {
  // A walked street along the north axis (0 to 200 m) and a side street crossing it at 100 m.
  const OST = 1 / 70_000;
  const quer = (id: string, von: number, bis: number): Piece => ({
    id,
    kind: "street",
    weight: 1,
    lengthM: Math.abs(bis - von),
    coords: [[6.83 + von * OST, 50.94 + 100 * M], [6.83 + bis * OST, 50.94 + 100 * M]],
    mid: [6.83 + ((von + bis) / 2) * OST, 50.94 + 100 * M],
  });
  const a = stueck("a", 0, 100);
  const b = stueck("b", 100, 200);
  const stummel = quer("stummel", 0, 20);
  const fix = (nord: number, ost = 0) => ({ lat: 50.94 + nord * M, lon: 6.83 + ost * OST, t: 0 });
  const entlang = [0, 20, 40, 60, 80, 100, 120, 140, 160, 180, 200].map((n) => fix(n));

  it("takes out a short side piece you only passed at the crossing", () => {
    expect([...stummelEntfernen([a, b, stummel], new Set(["a", "b", "stummel"]), entlang)]).toEqual(["stummel"]);
  });

  it("keeps it when you went to its end", () => {
    expect(stummelEntfernen([a, b, stummel], new Set(["a", "b", "stummel"]), [...entlang, fix(100, 18)]).size).toBe(0);
  });

  it("keeps short pieces inside a walked street (both ends joined)", () => {
    const kurz = stueck("kurz", 100, 115);
    const weiter = stueck("weiter", 115, 200);
    expect(stummelEntfernen([a, kurz, weiter], new Set(["a", "kurz", "weiter"]), entlang).size).toBe(0);
  });

  it("keeps longer pieces", () => {
    const lang = quer("lang", 0, 60);
    expect(stummelEntfernen([a, b, lang], new Set(["a", "b", "lang"]), entlang).size).toBe(0);
  });

  it("also takes out a short piece standing alone far from any point", () => {
    const allein = quer("allein", 300, 320);
    expect([...stummelEntfernen([a, b, allein], new Set(["a", "b", "allein"]), entlang)]).toEqual(["allein"]);
  });
});
