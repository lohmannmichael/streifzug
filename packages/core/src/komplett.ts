/**
 * "Straße komplett" (Bauplan 3, F4): a named street counts as complete in a place when every one of
 * its street pieces there has been walked (pieces marked "Hier komme ich nicht hin" left out).
 */
import type { LonLat } from "./geo";
import { tileBounds, type Tile } from "./tiles";

export interface StueckInfo {
  /** Street name, null for unnamed ways. */
  name: string | null;
  /** Place (region id) the piece lies in, null outside every place. */
  ort: string | null;
}

export interface KompletteStrasse {
  name: string;
  ort: string;
  /** When the last missing piece was walked. */
  seit: number;
  ids: string[];
}

/** Key of a street in a place. */
export const strassenSchluessel = (ort: string, name: string) => `${ort}|${name}`;

/**
 * Complete streets. `unbekannt`: streets (by key) that may go on in tiles not loaded; they are
 * never complete.
 */
export function kompletteStrassen(
  stuecke: readonly { id: string; kind: string }[],
  info: ReadonlyMap<string, StueckInfo>,
  gesehen: ReadonlySet<string>,
  ausnahmen: ReadonlySet<string>,
  erstesMal: ReadonlyMap<string, number>,
  unbekannt: ReadonlySet<string> = new Set(),
): KompletteStrasse[] {
  const gruppen = new Map<string, { name: string; ort: string; ids: string[]; offen: boolean }>();
  for (const p of stuecke) {
    if (p.kind !== "street" || ausnahmen.has(p.id)) continue;
    const i = info.get(p.id);
    if (!i?.name || !i.ort) continue;
    const k = strassenSchluessel(i.ort, i.name);
    const g = gruppen.get(k) ?? gruppen.set(k, { name: i.name, ort: i.ort, ids: [], offen: false }).get(k)!;
    g.ids.push(p.id);
    if (!gesehen.has(p.id)) g.offen = true;
  }
  const out: KompletteStrasse[] = [];
  for (const [k, g] of gruppen) {
    if (g.offen || unbekannt.has(k) || g.ids.length === 0) continue;
    let seit = 0;
    for (const id of g.ids) seit = Math.max(seit, erstesMal.get(id) ?? 0);
    out.push({ name: g.name, ort: g.ort, seit, ids: g.ids });
  }
  return out;
}

/** Neighbour tiles a piece runs into: its ends lie on the tile's edge (within about a meter). */
export function randNachbarn(coords: readonly LonLat[], tile: Tile): Tile[] {
  const b = tileBounds(tile);
  const eps = 0.00002;
  const out = new Map<string, Tile>();
  for (const [x, y] of [coords[0]!, coords[coords.length - 1]!]) {
    const dx = x >= b.east - eps ? 1 : x <= b.west + eps ? -1 : 0;
    const dy = y >= b.north - eps ? -1 : y <= b.south + eps ? 1 : 0;
    if (dx || dy) out.set(`${dx},${dy}`, { z: tile.z, x: tile.x + dx, y: tile.y + dy });
  }
  return [...out.values()];
}

/** Joins pieces that meet end to end (within about a meter) into longer lines, e.g. for a name along the street. */
export function linienVerbinden(teile: readonly (readonly LonLat[])[]): LonLat[][] {
  const gleich = (a: LonLat, b: LonLat) => Math.abs(a[0] - b[0]) < 0.00001 && Math.abs(a[1] - b[1]) < 0.00001;
  const offen = teile.filter((t) => t.length > 1).map((t) => [...t]);
  const out: LonLat[][] = [];
  while (offen.length) {
    let linie = offen.pop()!;
    for (let weiter = true; weiter; ) {
      weiter = false;
      for (let i = 0; i < offen.length; i++) {
        const t = offen[i]!;
        const [kopf, ende] = [linie[0]!, linie.at(-1)!];
        let neu: LonLat[] | null = null;
        if (gleich(ende, t[0]!)) neu = [...linie, ...t.slice(1)];
        else if (gleich(ende, t.at(-1)!)) neu = [...linie, ...[...t].reverse().slice(1)];
        else if (gleich(kopf, t.at(-1)!)) neu = [...t, ...linie.slice(1)];
        else if (gleich(kopf, t[0]!)) neu = [...[...t].reverse(), ...linie.slice(1)];
        if (neu) {
          linie = neu;
          offen.splice(i, 1);
          weiter = true;
          break;
        }
      }
    }
    out.push(linie);
  }
  return out;
}
