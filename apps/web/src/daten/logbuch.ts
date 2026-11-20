import { milestoneReached, newPerOuting, seenPieceIds, tileFor, TILE_ZOOM, type Fix, type Piece } from "@streifzug/core";
import { useEffect, useState } from "react";
import { gesehenVon, kachelnFuer, meterJeGebiet } from "./fortschritt";
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
  const lons = fixes.map((f) => f.lon);
  const lats = fixes.map((f) => f.lat);
  const a = tileFor([Math.min(...lons) - rand, Math.max(...lats) + rand / 1.6], TILE_ZOOM);
  const b = tileFor([Math.max(...lons) + rand, Math.min(...lats) - rand / 1.6], TILE_ZOOM);
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
export async function berechneLogbuch(liste: Streifzug[], daten: Regionen, wege: boolean, auto: boolean): Promise<Map<string, LogEintrag>> {
  const chronologisch = [...liste].sort((a, b) => a.startedAt - b.startedAt);
  const zaehlt = (s: Streifzug) => s.mode !== "car" || auto;
  const roh = new Map<string, { umgebung: Piece[]; gesehen: Set<string>; nachId: Map<string, Piece> }>();
  for (const s of chronologisch) {
    const importiert = s.quelle !== undefined && s.quelle !== "aufnahme";
    if (importiert) {
      // Imported outings are not shown one by one, but count for what is "new" afterwards.
      const nachId = await gesehenVon({ id: s.id, fixes: s.fixes, locker: true });
      roh.set(s.id, { umgebung: [], gesehen: new Set([...nachId.values()].filter((p) => p.kind === "street" || wege).map((p) => p.id)), nachId });
      continue;
    }
    const umgebung = (await Promise.all(kachelnMitRand(s.fixes).map((k) => stueckeDerKachel({ z: TILE_ZOOM, ...k })))).flat();
    const nachId = new Map(umgebung.map((p) => [p.id, p]));
    // Only what counts (streets; paths with the switch) is "seen" and yellow in the logbook.
    const gesehen = new Set([...seenPieceIds(umgebung, s.fixes)].filter((id) => nachId.get(id)!.kind === "street" || wege));
    roh.set(s.id, { umgebung, gesehen, nachId });
  }
  const neuJe = newPerOuting(chronologisch.filter(zaehlt).map((s) => ({ id: s.id, seen: roh.get(s.id)!.gesehen })));

  const bisher = new Map<string, Summe>();
  const ergebnis = new Map<string, LogEintrag>();
  for (const s of chronologisch) {
    const r = roh.get(s.id)!;
    const neu = neuJe.get(s.id);
    if (!neu) {
      ergebnis.set(s.id, { ...ZAEHLT_NICHT, umgebung: r.umgebung, gesehen: r.gesehen });
      continue;
    }
    const neueStuecke = [...neu].map((id) => r.nachId.get(id)!).filter((p) => p.kind === "street" || wege);
    const dazu = await meterJeGebiet(neueStuecke, daten);
    const vorher = new Map(bisher);
    addieren(bisher, dazu);

    const anteil = (m: Map<string, Summe>, id: string) => prozent(zaehlendeMeter(m.get(id) ?? { strasse_m: 0, weg_m: 0 }, wege), zaehlendeMeter(daten.gebiete.get(id)!, wege));
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

    // Street names: longest new streets first, each name once (not needed for imports).
    const jeName = new Map<string, number>();
    for (const p of s.quelle && s.quelle !== "aufnahme" ? [] : neueStuecke) {
      const name = await strassenName(p);
      if (name) jeName.set(name, (jeName.get(name) ?? 0) + p.lengthM * p.weight);
    }
    ergebnis.set(s.id, {
      umgebung: r.umgebung,
      gesehen: r.gesehen,
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
export function useLogbuch(liste: Streifzug[], daten: Regionen | null, wege: boolean, auto: boolean): Map<string, LogEintrag> | null {
  const [logbuch, setLogbuch] = useState<Map<string, LogEintrag> | null>(null);
  const schluessel = liste.map((s) => `${s.id}:${s.fixes.length}`).join(",");
  useEffect(() => {
    if (!daten) return;
    let aktiv = true;
    void berechneLogbuch(liste, daten, wege, auto).then((l) => aktiv && setLogbuch(l));
    return () => {
      aktiv = false;
    };
    // Recalculate only when the set of outings or the switches change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schluessel, daten, wege, auto]);
  return logbuch;
}
