import { describe, expect, it } from "vitest";
import { besteStempel, faelligeStempel, stempelUmstellen, verdienteStempel, type Stand, type Stempel } from "./stamps";

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

describe("Anzahl-Stempel (Bauplan 3, D3)", () => {
  const sieben = Array.from({ length: 7 }, (_, i) => ({ id: `v${i}`, aktivM: 10, gesamtM: 1000 }));
  const ort = (veedel: string[]) => ({ id: "koeln", art: "stadt" as const, veedel });

  it("counts entered Veedel per place: 5, 10, 25, 50 and finally all of them", () => {
    const s = stand({ veedel: sieben, gruppen: [ort([...sieben.map((v) => v.id), "x1", "x2", "x3"])] });
    expect(ids(s)).toContain("veedel-anzahl:koeln:5");
    expect(ids(s)).not.toContain("veedel-anzahl:koeln:10");
    expect(ids(s)).not.toContain("veedel-anzahl:koeln:alle");
  });

  it("gives 'alle' when every Veedel of the place is entered, also below 50", () => {
    const s = stand({ veedel: sieben, gruppen: [ort(sieben.map((v) => v.id))] });
    const a = verdienteStempel(s).find((x) => x.id === "veedel-anzahl:koeln:alle");
    expect(a).toMatchObject({ art: "veedel-anzahl", gebietId: "koeln", stufe: 7 });
    // a step as large as the place itself is "alle", not a number of its own
    expect(ids(s)).not.toContain("stadt-rundum:koeln");
  });

  it("counts places and countries over everything", () => {
    expect(ids(stand({ orte: 5, laender: 3 }))).toEqual(expect.arrayContaining(["orte-anzahl:5", "laender-anzahl:2", "laender-anzahl:3"]));
    expect(ids(stand({ orte: 4, laender: 1 })).filter((x) => x.startsWith("orte-") || x.startsWith("laender-"))).toEqual([]);
  });
});

describe("besteStempel", () => {
  const g = (id: string, art: Stempel["art"], gebietId: string | null, stufe: number | null): Stempel => ({ id, art, gebietId, stufe });

  it("shows per Veedel only the highest percent stamp", () => {
    const b = besteStempel([g("betreten:w", "betreten", "w", null), g("prozent:w:10", "prozent", "w", 10), g("prozent:w:25", "prozent", "w", 25)]);
    expect(b.map((x) => x.id)).toEqual(["prozent:w:25"]);
  });

  it("shows 'betreten' only while no percent stamp is reached", () => {
    expect(besteStempel([g("betreten:w", "betreten", "w", null)]).map((x) => x.id)).toEqual(["betreten:w"]);
  });

  it("after 50 % exactly one other stamp than at 25 %", () => {
    const bis25 = [g("betreten:w", "betreten", "w", null), g("prozent:w:10", "prozent", "w", 10), g("prozent:w:25", "prozent", "w", 25)];
    const bei25 = besteStempel(bis25);
    const bei50 = besteStempel([...bis25, g("prozent:w:50", "prozent", "w", 50)]);
    expect(bei25).toHaveLength(1);
    expect(bei50).toHaveLength(1);
    expect(bei50[0]!.id).not.toBe(bei25[0]!.id);
  });

  it("keeps all other stamps", () => {
    const andere = [g("km-neu:10", "km-neu", null, 10), g("veedel-anzahl:koeln:5", "veedel-anzahl", "koeln", 5)];
    expect(besteStempel(andere)).toEqual(andere);
  });
});

describe("stempelUmstellen", () => {
  it("gives old 'veedel-anzahl:<n>' stamps to the place Köln, nothing is lost", () => {
    const alt = [
      { id: "veedel-anzahl:5", art: "veedel-anzahl" as const, gebietId: null, stufe: 5, gestempeltAm: 1 },
      { id: "veedel-anzahl:86", art: "veedel-anzahl" as const, gebietId: null, stufe: 86, gestempeltAm: 2 },
      { id: "betreten:w", art: "betreten" as const, gebietId: "w", stufe: null, gestempeltAm: 3 },
    ];
    const neu = stempelUmstellen(alt, "koeln");
    expect(neu).toHaveLength(3);
    expect(neu[0]).toMatchObject({ id: "veedel-anzahl:koeln:5", gebietId: "koeln", stufe: 5, gestempeltAm: 1 });
    expect(neu[1]).toMatchObject({ id: "veedel-anzahl:koeln:alle", gebietId: "koeln", stufe: 86 });
    expect(neu[2]).toBe(alt[2]);
  });

  it("keeps the earlier one when the new key exists already", () => {
    const neu = stempelUmstellen(
      [
        { id: "veedel-anzahl:koeln:5", art: "veedel-anzahl" as const, gebietId: "koeln", stufe: 5, gestempeltAm: 9 },
        { id: "veedel-anzahl:5", art: "veedel-anzahl" as const, gebietId: null, stufe: 5, gestempeltAm: 4 },
      ],
      "koeln",
    );
    expect(neu).toHaveLength(1);
    expect(neu[0]!.gestempeltAm).toBe(4);
  });
});
