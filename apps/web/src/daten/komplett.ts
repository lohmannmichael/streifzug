import { kompletteStrassen, pointInGeometry, randNachbarn, strassenSchluessel, type KompletteStrasse, type Piece, type StueckInfo, type Tile } from "@streifzug/core";
import { ladeFlaechen } from "./rechnen";
import type { Region } from "./regionen";
import { stueckeDerKachel, strassenName } from "./strassen";

/**
 * Complete streets (Bauplan 3, F4), worked out in the background worker after each calculation.
 * Name and place of each piece are kept once found. A street that may go on into tiles not yet
 * loaded gets those tiles first (at most `MAX_NACHLADEN` per calculation); a street still not
 * known in full is not counted.
 */
const MAX_NACHLADEN = 60;
const infoCache = new Map<string, StueckInfo>();

const kachelVon = (id: string): Tile => {
  const [z, x, y] = id.split(":")[0]!.split("/").map(Number) as [number, number, number];
  return { z, x, y };
};
const kachelKey = (t: Tile) => `${t.z}/${t.x}/${t.y}`;

async function ortVon(p: Piece, liste: readonly Region[]): Promise<string | null> {
  const [x, y] = p.mid;
  for (const r of liste) {
    if (x < r.bbox[0] || x > r.bbox[2] || y < r.bbox[1] || y > r.bbox[3]) continue;
    const wurzel = (await ladeFlaechen(r)).find((f) => f.id === r.wurzel);
    if (wurzel && pointInGeometry(p.mid, wurzel.geometry)) return r.id;
  }
  return null;
}

async function infoVon(p: Piece, liste: readonly Region[]): Promise<StueckInfo> {
  let i = infoCache.get(p.id);
  if (!i) {
    i = { name: await strassenName(p), ort: await ortVon(p, liste) };
    infoCache.set(p.id, i);
  }
  return i;
}

export async function kompletteBerechnen(gesehen: ReadonlyMap<string, Piece>, ausnahmen: ReadonlySet<string>, erstesMal: ReadonlyMap<string, number>, liste: readonly Region[]): Promise<KompletteStrasse[]> {
  const kacheln = new Map<string, Tile>();
  for (const p of gesehen.values()) if (p.kind === "street") kacheln.set(kachelKey(kachelVon(p.id)), kachelVon(p.id));
  const info = new Map<string, StueckInfo>();
  const stuecke = new Map<string, Piece>();
  const geladen = new Set<string>();
  const unbekannt = new Set<string>();
  let nachgeladen = 0;
  for (let runde = 0; runde < 8; runde++) {
    for (const [k, t] of kacheln) {
      if (geladen.has(k)) continue;
      geladen.add(k);
      for (const p of await stueckeDerKachel(t)) if (p.kind === "street") stuecke.set(p.id, p);
    }
    for (const p of stuecke.values()) if (!info.has(p.id)) info.set(p.id, await infoVon(p, liste));
    // Streets with every loaded piece seen: do they go on into a tile not loaded yet?
    const offen = new Set<string>();
    for (const p of stuecke.values()) {
      const i = info.get(p.id)!;
      if (i.name && i.ort && !gesehen.has(p.id) && !ausnahmen.has(p.id)) offen.add(strassenSchluessel(i.ort, i.name));
    }
    const noetig = new Map<string, { tile: Tile; strasse: string }>();
    for (const p of stuecke.values()) {
      const i = info.get(p.id)!;
      if (!i.name || !i.ort) continue;
      const s = strassenSchluessel(i.ort, i.name);
      if (offen.has(s)) continue;
      for (const n of randNachbarn(p.coords, kachelVon(p.id))) if (!kacheln.has(kachelKey(n))) noetig.set(kachelKey(n), { tile: n, strasse: s });
    }
    if (noetig.size === 0) break;
    for (const [k, n] of noetig) {
      if (nachgeladen >= MAX_NACHLADEN) {
        unbekannt.add(n.strasse);
        continue;
      }
      kacheln.set(k, n.tile);
      nachgeladen++;
    }
    if (runde === 7) for (const n of noetig.values()) if (!geladen.has(kachelKey(n.tile))) unbekannt.add(n.strasse);
  }
  return kompletteStrassen([...stuecke.values()], info, new Set(gesehen.keys()), ausnahmen, erstesMal, unbekannt);
}
