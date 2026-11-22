/**
 * Builds the fixed test data set for the browser tests (Bauplan 3, E1): three ways in Weiden
 * (two on foot, one by bike), one car ride and one walk in Freising, along real streets of the
 * OpenFreeMap tiles. Run once with `npx tsx apps/web/e2e/werkzeuge/wege-erzeugen.ts`; the result
 * (`e2e/daten/wege.json`) is committed, so the tests never depend on this script.
 *
 * Times are minutes before "now"; the fake server turns them into real times when a test starts.
 * Freising lies 20 hours back: the app drops points that would need more than plane speed from
 * the last point in Köln, so the trip between must take a realistic time.
 */
import { VectorTile } from "@mapbox/vector-tile";
import { tileBounds, tileFor, type LonLat } from "@streifzug/core";
import { writeFileSync } from "node:fs";
import { PbfReader } from "pbf";

interface Kante {
  von: string;
  nach: string;
  a: LonLat;
  b: LonLat;
  klasse: string;
}

const schluessel = (p: LonLat) => `${p[0].toFixed(5)},${p[1].toFixed(5)}`;

function meter(a: LonLat, b: LonLat): number {
  const k = Math.cos((a[1] * Math.PI) / 180);
  return Math.hypot((b[0] - a[0]) * k, b[1] - a[1]) * 111_320;
}

/** Small deterministic random numbers, so the data set is the same on every run. */
function zufall(saat: number) {
  let s = saat;
  return () => {
    s = (s * 1664525 + 1013904223) % 2 ** 32;
    return s / 2 ** 32;
  };
}

export async function kanten(punkt: LonLat): Promise<{ kanten: Kante[]; bei: (fx: number, fy: number) => LonLat; innen: (p: LonLat) => boolean }> {
  const tile = tileFor(punkt, 14);
  const vorlage = ((await (await fetch("https://tiles.openfreemap.org/planet")).json()) as { tiles: string[] }).tiles[0]!;
  const url = vorlage.replace("{z}", "14").replace("{x}", String(tile.x)).replace("{y}", String(tile.y));
  const vt = new VectorTile(new PbfReader(new Uint8Array(await (await fetch(url)).arrayBuffer())));
  const ebene = vt.layers.transportation!;
  const out: Kante[] = [];
  for (let i = 0; i < ebene.length; i++) {
    const f = ebene.feature(i);
    const geo = f.toGeoJSON(tile.x, tile.y, 14).geometry as { type: string; coordinates: unknown };
    const linien = geo.type === "LineString" ? [geo.coordinates as LonLat[]] : geo.type === "MultiLineString" ? (geo.coordinates as LonLat[][]) : [];
    const klasse = String(f.properties.class);
    if (f.properties.brunnel === "tunnel" || f.properties.brunnel === "bridge") continue;
    for (const l of linien)
      for (let j = 1; j < l.length; j++) out.push({ von: schluessel(l[j - 1]!), nach: schluessel(l[j]!), a: l[j - 1]!, b: l[j]!, klasse });
  }
  // Stay well inside the tile, so a single tile holds the whole way.
  const g = tileBounds(tile);
  const rand = 0.15;
  const dx = (g.east - g.west) * rand;
  const dy = (g.north - g.south) * rand;
  return { kanten: out, bei: (fx: number, fy: number): LonLat => [g.west + (g.east - g.west) * fx, g.north - (g.north - g.south) * fy], innen: (p) => p[0] > g.west + dx && p[0] < g.east - dx && p[1] > g.south + dy && p[1] < g.north - dy };
}

/** A walk along the street network from the node nearest `start`, about `laenge` metres long. */
export function spaziergang(netz: { kanten: Kante[]; innen: (p: LonLat) => boolean }, start: LonLat, laenge: number, klassen: string[], saat: number): LonLat[] {
  const r = zufall(saat);
  const nachbarn = new Map<string, { nach: string; b: LonLat; id: number }[]>();
  netz.kanten.forEach((k, id) => {
    if (!klassen.includes(k.klasse)) return;
    (nachbarn.get(k.von) ?? nachbarn.set(k.von, []).get(k.von)!).push({ nach: k.nach, b: k.b, id });
    (nachbarn.get(k.nach) ?? nachbarn.set(k.nach, []).get(k.nach)!).push({ nach: k.von, b: k.a, id });
  });
  // Start in the largest connected part of the network (not on a lonely driveway).
  const teil = new Map<string, number>();
  const groesse: number[] = [];
  for (const k of nachbarn.keys()) {
    if (teil.has(k)) continue;
    const nr = groesse.length;
    let n = 0;
    const offen = [k];
    teil.set(k, nr);
    while (offen.length) {
      const x = offen.pop()!;
      n++;
      for (const y of nachbarn.get(x) ?? []) if (!teil.has(y.nach)) (teil.set(y.nach, nr), offen.push(y.nach));
    }
    groesse.push(n);
  }
  const groesster = groesse.indexOf(Math.max(...groesse));
  let jetzt = "";
  let best = Infinity;
  for (const k of nachbarn.keys()) {
    if (teil.get(k) !== groesster) continue;
    const [lon, lat] = k.split(",").map(Number) as [number, number];
    const d = meter([lon, lat], start);
    if (d < best && netz.innen([lon, lat])) [best, jetzt] = [d, k];
  }
  const punktVon = (k: string) => k.split(",").map(Number) as unknown as LonLat;
  const weg: LonLat[] = [punktVon(jetzt)];
  const benutzt = new Set<number>();
  let summe = 0;
  const gehe = (n: { nach: string; b: LonLat; id: number }) => {
    benutzt.add(n.id);
    summe += meter(weg.at(-1)!, n.b);
    weg.push(n.b);
    jetzt = n.nach;
  };
  while (summe < laenge) {
    const frei = (nachbarn.get(jetzt) ?? []).filter((n) => !benutzt.has(n.id) && netz.innen(n.b));
    if (frei.length > 0) {
      gehe(frei[Math.floor(r() * frei.length)]!);
      continue;
    }
    // Nothing new here: walk back along known streets to the nearest crossing with a new street.
    const vorher = new Map<string, { von: string; kante: { nach: string; b: LonLat; id: number } } | null>([[jetzt, null]]);
    const schlange = [jetzt];
    let ziel: string | null = null;
    while (schlange.length && !ziel) {
      const x = schlange.shift()!;
      for (const n of nachbarn.get(x) ?? []) {
        if (!netz.innen(n.b) || vorher.has(n.nach)) continue;
        vorher.set(n.nach, { von: x, kante: n });
        if ((nachbarn.get(n.nach) ?? []).some((m) => !benutzt.has(m.id) && netz.innen(m.b))) {
          ziel = n.nach;
          break;
        }
        schlange.push(n.nach);
      }
    }
    if (!ziel) break;
    const pfad: { nach: string; b: LonLat; id: number }[] = [];
    for (let x = ziel; vorher.get(x); x = vorher.get(x)!.von) pfad.unshift(vorher.get(x)!.kante);
    for (const n of pfad) gehe(n);
  }
  return weg;
}

export interface Punkt {
  /** Minutes before now. */
  vorMin: number;
  lon: number;
  lat: number;
  acc: number;
  motion: string[];
  speed: number;
}

/** GPS fixes every 5 s along a line at the given speed, with a little noise (±3 m). */
export function punkte(linie: LonLat[], startVorMin: number, tempo: number, motion: string, saat: number): Punkt[] {
  const r = zufall(saat);
  const out: Punkt[] = [];
  const schritt = tempo * 5;
  let rest = 0;
  let n = 0;
  const neu = (p: LonLat) => {
    const k = Math.cos((p[1] * Math.PI) / 180);
    const lon = p[0] + ((r() - 0.5) * 6) / (111_320 * k);
    const lat = p[1] + ((r() - 0.5) * 6) / 111_320;
    out.push({ vorMin: Number((startVorMin - (n * 5) / 60).toFixed(4)), lon: Number(lon.toFixed(7)), lat: Number(lat.toFixed(7)), acc: 5, motion: [motion], speed: Number((tempo * (0.9 + r() * 0.2)).toFixed(2)) });
    n++;
  };
  neu(linie[0]!);
  for (let i = 1; i < linie.length; i++) {
    const a = linie[i - 1]!;
    const b = linie[i]!;
    const d = meter(a, b);
    let s = schritt - rest;
    while (s <= d) {
      neu([a[0] + ((b[0] - a[0]) * s) / d, a[1] + ((b[1] - a[1]) * s) / d]);
      s += schritt;
    }
    rest = d - (s - schritt);
  }
  neu(linie.at(-1)!);
  return out;
}

export const KLEIN = ["minor", "service", "tertiary", "secondary"];
const GROSS = ["primary", "secondary", "trunk"];

async function main() {
  const weiden: LonLat = [6.8285, 50.9395];
  const freising: LonLat = [11.7486, 48.4029];
  const netzWeiden = await kanten(weiden);
  const netzFreising = await kanten(freising);
  const wege = [
    { name: "Weiden zu Fuß", punkte: punkte(spaziergang(netzWeiden, netzWeiden.bei(0.5, 0.5), 1500, KLEIN, 1), 600, 1.4, "walking", 11) },
    { name: "Weiden Rad", punkte: punkte(spaziergang(netzWeiden, netzWeiden.bei(0.3, 0.6), 3000, KLEIN, 2), 420, 5, "cycling", 12) },
    { name: "Weiden zu Fuß 2", punkte: punkte(spaziergang(netzWeiden, netzWeiden.bei(0.7, 0.3), 1000, KLEIN, 3), 300, 1.4, "walking", 13) },
    { name: "Weiden Autofahrt", punkte: punkte(spaziergang(netzWeiden, netzWeiden.bei(0.5, 0.5), 2500, GROSS, 4), 180, 14, "automotive", 14) },
    { name: "Freising zu Fuß", punkte: punkte(spaziergang(netzFreising, netzFreising.bei(0.5, 0.5), 1200, KLEIN, 5), 1200, 1.4, "walking", 15) },
  ];
  for (const w of wege) console.log(w.name, w.punkte.length, "Punkte", Math.round(w.punkte[0]!.vorMin - w.punkte.at(-1)!.vorMin), "Min.");
  writeFileSync(new URL("../daten/wege.json", import.meta.url), JSON.stringify(wege, null, 0) + "\n");
}

// Only when run directly (the year data set reuses the helpers above).
if (process.argv[1]?.endsWith("wege-erzeugen.ts")) void main();
