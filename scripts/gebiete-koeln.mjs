// Builds the Cologne district files for the web app from the city's official boundaries.
//
// Source: Stadt Köln, Offene Daten "Stadtteile" (CC BY, mirrored in github.com/KoelnAPI/data,
// data/geo-base/stadtteile/stadtteile.geojson). Usage:
//   node scripts/gebiete-koeln.mjs <path/to/stadtteile.geojson>
// Writes apps/web/public/gebiete/koeln-stadtteile.geojson, koeln-bezirke.geojson, koeln-namen.geojson.
import mapshaper from "mapshaper";
import { mkdir } from "node:fs/promises";

const quelle = process.argv[2];
if (!quelle) {
  console.error("Pfad zu stadtteile.geojson fehlt.");
  process.exit(1);
}

const ziel = "apps/web/public/gebiete";
await mkdir(ziel, { recursive: true });

const BEZIRKE = {
  1: "Innenstadt",
  2: "Rodenkirchen",
  3: "Lindenthal",
  4: "Ehrenfeld",
  5: "Nippes",
  6: "Chorweiler",
  7: "Porz",
  8: "Kalk",
  9: "Mülheim",
};

const vorbereiten = [
  `-i "${quelle}" name=stadtteile`,
  `-each 'name=STT_NAME, nr=STT_NR, bezirk_nr=Number(STT_NR.slice(0,1)), bezirk=${JSON.stringify(BEZIRKE)}[bezirk_nr]'`,
  `-filter-fields name,nr,bezirk_nr,bezirk`,
  // Simplify on shared arcs so neighbouring districts keep a common border.
  `-simplify interval=6 keep-shapes`,
].join(" ");

await mapshaper.runCommands(
  `${vorbereiten} -o "${ziel}/koeln-stadtteile.geojson" precision=0.00001 format=geojson`,
);
await mapshaper.runCommands(
  `${vorbereiten} -dissolve bezirk_nr copy-fields=bezirk -rename-fields name=bezirk -o "${ziel}/koeln-bezirke.geojson" precision=0.00001 format=geojson`,
);
await mapshaper.runCommands(
  `${vorbereiten} -points inner -o "${ziel}/koeln-namen.geojson" precision=0.00001 format=geojson`,
);
console.log("Fertig:", ziel);
