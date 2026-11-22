import { tileFor, TILE_ZOOM } from "@streifzug/core";
import { stueckeDerKachel, strassenName } from "./daten/strassen";
const t = tileFor([6.835, 50.933], TILE_ZOOM);
for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
  for (const p of await stueckeDerKachel({ z: TILE_ZOOM, x: t.x + dx, y: t.y + dy })) {
    if (p.kind !== "street") continue;
    const n = await strassenName(p);
    if (n === "Erkelenzhofweg") console.log(p.id, Math.round(p.lengthM), p.mid.map((v) => v.toFixed(5)).join(","));
  }
}
