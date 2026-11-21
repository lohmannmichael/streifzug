import { milestoneReached, seenPieceIds, tileFor, TILE_ZOOM, type Fix, type Piece } from "@streifzug/core";
import { useEffect, useState } from "react";
import { kachelnFuer, meterJeGebiet, stueckeImZeitraum, type Zaehlen } from "./fortschritt";
import { prozent, zaehlendeMeter, type Regionen, type Summe } from "./regionen";
import type { Streifzug } from "./speicher";
import { stueckeDerKachel, strassenName } from "./strassen";

/** What one outing brought, for the logbook. */
export interface LogEintrag {
  /** Street pieces around the outing (grey on the mini map). */
  umgebung: Piece[];
  /** Pieces this outing covered, and those it covered for the first time. */
  gesehen: Set<string>;
  neu: Set<string>;
  /** Newly discovered meters that count. */
  neuM: number;
  /** Area (smallest level) with the most new meters, with its share before and after. */
  gebietId: string | null;
  vorherP: number;
  nachherP: number;
  /** Milestones reached on this outing (area id and percent). */
  meilensteine: { gebietId: string; prozent: number }[];
  /** Names of the new streets, longest first. */
  strassen: string[];
}

const ZAEHLT_NICHT: LogEintrag = { umgebung: [], gesehen: new Set(), neu: new Set(), neuM: 0, gebietId: null, vorherP: 0, nachherP: 0, meilensteine: [], strassen: [] };

/** All tiles covering the outing plus some room around it, so the mini map shows the streets nearby too. */
function kachelnMitRand(fixes: Fix[]): { x: number; y: number }[] {
  if (fixes.length === 0) return [];
  const rand = 0.006; // about 400–600 m
  let [west, sued, ost, nord] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const f of fixes) {
    west = Math.min(west, f.lon);
    ost = Math.max(ost, f.lon);
    sued = Math.min(sued, f.lat);
    nord = Math.max(nord, f.lat);
  }
  const a = tileFor([west - rand, nord + rand / 1.6], TILE_ZOOM);
  const b = tileFor([ost + rand, sued - rand / 1.6], TILE_ZOOM);
  const kacheln: { x: number; y: number }[] = [];
  for (let x = a.x; x <= b.x; x++) for (let y = a.y; y <= b.y; y++) kacheln.push({ x, y });
  // Very long outings: only the tiles along the track (same as for the progress).
  return kacheln.length <= 25 ? kacheln : kachelnFuer([fixes]);
}

function addieren(ziel: Map<string, Summe>, dazu: Map<string, Summe>) {
  for (const [id, s] of dazu) {
    const alt = ziel.get(id) ?? { strasse_m: 0, weg_m: 0 };
    ziel.set(id, { strasse_m: alt.strasse_m + s.strasse_m, weg_m: alt.weg_m + s.weg_m });
  }
}

/**
 * Goes through all outings from the oldest: what each one covered, what was new,
 * which area it moved forward and which milestones it reached. Runs on the device.
 */
export async function berechneLogbuch(liste: Streifzug[], daten: Regionen, wege: boolean, zaehlen: Zaehlen): Promise<Map<string, LogEintrag>> {
  const chronologisch = [...liste].sort((a, b) => a.startedAt - b.startedAt);
  const zaehlt = (s: Streifzug) => s.mode !== "car" || zaehlen.auto;
  const zaehltArt = (p: Piece) => p.kind === "street" || wege;
  const bekannt = new Set<string>();
  const bisher = new Map<string, Summe>();
  const ergebnis = new Map<string, LogEintrag>();
  const anteil = (m: Map<string, Summe>, id: string) => prozent(zaehlendeMeter(m.get(id) ?? { strasse_m: 0, weg_m: 0 }, wege), zaehlendeMeter(daten.gebiete.get(id)!, wege));

  // Imports and Overland are not shown one by one; what they covered between two own outings is
  // added as one block (from the background worker), so it counts for what is "new" afterwards.
  let seit = 0;
  const andereEinrechnen = async (bis: number) => {
    const neu = (await stueckeImZeitraum(seit, bis, zaehlen)).filter((p) => zaehltArt(p) && !bekannt.has(p.id));
    seit = bis;
    for (const p of neu) bekannt.add(p.id);
    if (neu.length) addieren(bisher, await meterJeGebiet(neu, daten));
  };

  for (const s of chronologisch) {
    await andereEinrechnen(s.startedAt);
    const umgebung = (await Promise.all(kachelnMitRand(s.fixes).map((k) => stueckeDerKachel({ z: TILE_ZOOM, ...k })))).flat();
    const nachId = new Map(umgebung.map((p) => [p.id, p]));
    // Only what counts (streets; paths with the switch) is "seen" and yellow in the logbook.
    const gesehen = new Set([...seenPieceIds(umgebung, s.fixes)].filter((id) => zaehltArt(nachId.get(id)!)));
    if (!zaehlt(s)) {
      ergebnis.set(s.id, { ...ZAEHLT_NICHT, umgebung, gesehen });
      continue;
    }
    const neu = new Set([...gesehen].filter((id) => !bekannt.has(id)));
    for (const id of neu) bekannt.add(id);
    const neueStuecke = [...neu].map((id) => nachId.get(id)!);
    const dazu = await meterJeGebiet(neueStuecke, daten);
    const vorher = new Map(bisher);
    addieren(bisher, dazu);

    let gebietId: string | null = null;
    let meiste = 0;
    const meilensteine: LogEintrag["meilensteine"] = [];
    for (const [id, summe] of dazu) {
      const g = daten.gebiete.get(id);
      if (!g || g.kinder.length > 0) continue;
      const m = zaehlendeMeter(summe, wege);
      if (m > meiste) {
        meiste = m;
        gebietId = id;
      }
      const stufe = milestoneReached(anteil(vorher, id), anteil(bisher, id));
      if (stufe) meilensteine.push({ gebietId: id, prozent: stufe });
    }

    // Street names: longest new streets first, each name once.
    const jeName = new Map<string, number>();
    for (const p of neueStuecke) {
      const name = await strassenName(p);
      if (name) jeName.set(name, (jeName.get(name) ?? 0) + p.lengthM * p.weight);
    }
    ergebnis.set(s.id, {
      umgebung,
      gesehen,
      neu,
      neuM: neueStuecke.reduce((m, p) => m + p.lengthM * p.weight, 0),
      gebietId,
      vorherP: gebietId ? anteil(vorher, gebietId) : 0,
      nachherP: gebietId ? anteil(bisher, gebietId) : 0,
      meilensteine,
      strassen: [...jeName].sort((a, b) => b[1] - a[1]).map(([n]) => n),
    });
  }
  return ergebnis;
}

/** The logbook for all outings on this device; recalculated when outings or switches change. */
export function useLogbuch(liste: Streifzug[], daten: Regionen | null, wege: boolean, zaehlen: Zaehlen, bereit: boolean): Map<string, LogEintrag> | null {
  const [logbuch, setLogbuch] = useState<Map<string, LogEintrag> | null>(null);
  const schluessel = liste.map((s) => `${s.id}:${s.fixes.length}`).join(",");
  useEffect(() => {
    // Waits until the background matching is done (imports are taken from its results).
    if (!daten || !bereit) return;
    let aktiv = true;
    void berechneLogbuch(liste, daten, wege, zaehlen).then((l) => aktiv && setLogbuch(l));
    return () => {
      aktiv = false;
    };
    // Recalculate only when the set of outings or the switches change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schluessel, daten, wege, JSON.stringify(zaehlen), bereit]);
  return logbuch;
}
