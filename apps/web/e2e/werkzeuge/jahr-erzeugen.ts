/**
 * Artificial data set for the speed measurement (Bauplan 3, E3): 365 days with three ways each
 * (mostly on foot, every fifth by bike) on real streets around Weiden and Lindenthal, about
 * 400,000 points. Written to `e2e/daten/jahr.json` (not in the repo, about 40 MB):
 * `npx tsx apps/web/e2e/werkzeuge/jahr-erzeugen.ts`
 */
import { writeFileSync } from "node:fs";
import { tileBounds, type LonLat } from "@streifzug/core";
import { kanten, KLEIN, punkte, spaziergang, type Punkt } from "./wege-erzeugen";

function zufall(saat: number) {
  let s = saat;
  return () => {
    s = (s * 1664525 + 1013904223) % 2 ** 32;
    return s / 2 ** 32;
  };
}

async function main() {
  const r = zufall(42);
  const netze: Awaited<ReturnType<typeof kanten>>[] = [];
  // 5 × 3 zoom-14 tiles from Lövenich to Lindenthal.
  for (let x = 8501; x <= 8505; x++)
    for (let y = 5488; y <= 5490; y++) {
      const g = tileBounds({ z: 14, x, y });
      netze.push(await kanten([(g.west + g.east) / 2, (g.south + g.north) / 2] as LonLat));
    }
  const alle: Punkt[] = [];
  let wege = 0;
  for (let tag = 365; tag >= 1; tag--)
    for (let k = 0; k < 3; k++) {
      const netz = netze[Math.floor(r() * netze.length)]!;
      const rad = r() < 0.2;
      const laenge = rad ? 4000 + r() * 4000 : 2000 + r() * 3200;
      const linie = spaziergang(netz, netz.bei(0.2 + r() * 0.6, 0.2 + r() * 0.6), laenge, KLEIN, tag * 10 + k);
      if (linie.length < 2) continue;
      const startVorMin = tag * 1440 - (8 + k * 4) * 60;
      alle.push(...punkte(linie, startVorMin, rad ? 5 : 1.4, rad ? "cycling" : "walking", tag * 100 + k));
      wege++;
    }
  console.log(wege, "Wege,", alle.length, "Punkte");
  writeFileSync(new URL("../daten/jahr.json", import.meta.url), JSON.stringify(alle));
}

void main();
