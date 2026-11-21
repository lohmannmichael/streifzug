import { describe, expect, it } from "vitest";
import { faelligeStempel, fehlendeMeter, naechsteStempel, verdienteStempel, type Stand } from "./stamps";

const stand = (over: Partial<Stand> = {}): Stand => ({
  veedel: [
    { id: "weiden", aktivM: 7_800, gesamtM: 28_300 },
    { id: "loevenich", aktivM: 0, gesamtM: 28_600 },
    { id: "junkersdorf", aktivM: 500, gesamtM: 46_000 },
  ],
  gruppen: [{ id: "lindenthal", art: "bezirk", veedel: ["weiden", "loevenich", "junkersdorf"] }],
  strassenKomplett: 3,
  aktivKmGesamt: 12,
  ...over,
});
const ids = (s: Stand) => verdienteStempel(s).map((x) => x.id);

describe("verdienteStempel", () => {
  it("gives 'betreten' for every Veedel with active meters", () => {
    expect(ids(stand())).toEqual(expect.arrayContaining(["betreten:weiden", "betreten:junkersdorf"]));
    expect(ids(stand())).not.toContain("betreten:loevenich");
  });

  it("gives percent steps up to the reached one (27.6 % → 10 and 25)", () => {
    const p = ids(stand()).filter((x) => x.startsWith("prozent:weiden"));
    expect(p).toEqual(["prozent:weiden:10", "prozent:weiden:25"]);
  });

  it("counts 100 % only when complete", () => {
    expect(ids(stand({ veedel: [{ id: "a", aktivM: 999, gesamtM: 1000 }] }))).not.toContain("prozent:a:100");
    expect(ids(stand({ veedel: [{ id: "a", aktivM: 1000, gesamtM: 1000 }] }))).toContain("prozent:a:100");
  });

  it("gives km steps and Veedel counts", () => {
    expect(ids(stand())).toContain("km-neu:10");
    expect(ids(stand())).not.toContain("km-neu:50");
    expect(ids(stand())).not.toContain("veedel-anzahl:5");
  });

  it("gives 'Bezirk rundum' only when all its Veedel are entered", () => {
    expect(ids(stand())).not.toContain("bezirk-rundum:lindenthal");
    const alle = stand({ veedel: stand().veedel.map((v) => ({ ...v, aktivM: v.aktivM || 10 })) });
    expect(ids(alle)).toContain("bezirk-rundum:lindenthal");
  });
});

describe("faelligeStempel", () => {
  it("leaves out stamps already given", () => {
    const f = faelligeStempel(stand(), new Set(["betreten:weiden", "prozent:weiden:10"])).map((x) => x.id);
    expect(f).toContain("prozent:weiden:25");
    expect(f).not.toContain("prozent:weiden:10");
  });
});

describe("naechsteStempel", () => {
  it("lists the two stamps with the least missing meters", () => {
    const n = naechsteStempel(stand());
    expect(n.map((x) => x.id)).toEqual(["prozent:junkersdorf:10", "prozent:weiden:50"]);
    expect(n[0]!.restM).toBeCloseTo(4_100, 0);
  });
});

describe("fehlendeMeter", () => {
  it("gives the missing meters per step, 0 when reached", () => {
    expect(fehlendeMeter({ id: "w", aktivM: 7_800, gesamtM: 28_300 })).toEqual([
      { stufe: 10, restM: 0 },
      { stufe: 25, restM: 0 },
      { stufe: 50, restM: 6_350 },
      { stufe: 75, restM: 13_425 },
      { stufe: 100, restM: 20_500 },
    ]);
  });
});
