---
name: region-hinzufuegen
description: Neue Region in Streifzug aufnehmen (Stadt, Dorf, Landkreis, Bundesland, Land, auch im Ausland) mit Gebietsgrenzen, Straßen-km je Gebiet und Prüfung. Verwenden, wenn Michi „füge Freising hinzu“, „nimm Bayern auf“, „neue Stadt“, „Urlaubsort“ o. Ä. sagt oder eine Region neu berechnet werden soll.
---

# Region hinzufügen

Eine Region = ein Wurzelgebiet (z. B. Köln) plus seine Untergebiete bis zu einer Tiefe (z. B. Bezirke, Stadtteile).
Daten weltweit aus denselben zwei Quellen, kein Sonderweg pro Land:

- **Grenzen:** Overture Maps „divisions“ (aus OpenStreetMap, Lizenz ODbL). Jedes Gebiet kennt sein Elterngebiet.
- **Straßen:** OpenStreetMap über die OpenFreeMap-Vektorkacheln (Zoom 14), gezählt mit `packages/core` (Zählregeln, jede Straße einmal).

## 1. Hinzufügen: ein Befehl mit dem Namen

```bash
npm run region -- "Hameln"
npm run region -- "New York" --land US
```

Der Befehl sucht den Ort in Overture (ca. 15 s), wählt den wahrscheinlichsten Treffer (Stadt/Gemeinde vor Kreis, Bundesland, Land; dann größte Einwohnerzahl), schreibt `regionen/<id>.json` und baut die Region. Bei Schreibvarianten nimmt er den ähnlichsten Namen und sagt das („Emmertal“ → „Emmerthal“). Die Trefferliste wird ausgegeben: prüfen, ob der richtige Ort gewählt wurde.

Optionen: `--land DE|US|…` (bei Namen, die es mehrfach gibt), `--ebene locality|localadmin|county|region|country` (z. B. Bundesland statt Stadt), `--tiefe 0|1|2` (Standard `auto` = bis zu zwei Ebenen, soweit es dort Gebiete gibt).

Bestehende Region neu berechnen: `npm run region -- <id>` (z. B. `koeln`).

Voraussetzungen (einmal pro Umgebung): `pip install pyarrow shapely`; erlaubte Hosts `overturemaps-us-west-2.s3.amazonaws.com`, `overturemaps-us-west-2.s3.us-west-2.amazonaws.com`, `tiles.openfreemap.org`.

Ergebnis: `apps/web/public/regionen/<id>/{gebiete.geojson,namen.geojson,summen.json}` und `apps/web/public/regionen/index.json`. Die App zeigt alle Regionen aus dem Index automatisch an, ohne Code-Änderung.

## 2. Konfiguration (wird erzeugt, bei Bedarf von Hand anpassen)

```json
{
  "id": "new-york",
  "name": "New York City",
  "wurzel": { "ebene": "locality", "name": "New York", "punkt": [-74.00602, 40.71273] },
  "tiefe": 1,
  "hinweis": "Warum die Tiefe reduziert wurde o. Ä."
}
```

`name` ist der Anzeigename, `wurzel.name` der Overture-Name zum Finden. Overture-Ebenen: `country` > `region` (Bundesland, US-Bundesstaat) > `county` (Kreis, kreisfreie Stadt) > `localadmin` > `locality` (Gemeinde, Stadt) > `borough` > `macrohood`/`neighborhood` (Stadtteil, Viertel).

## 3. Typische Fälle

| Was | Ergebnis mit `auto` | Hinweis |
|---|---|---|
| Deutsche Großstadt (Köln) | Stadt > Bezirke > Stadtteile | Köln: genau 86 Stadtteile wie offiziell |
| Mittelstadt (Hameln) | Stadt > Ortsteile > Viertel | |
| Gemeinde (Emmerthal) | Gemeinde > Ortsteile | Oft fehlen in OSM Ortsteil-Grenzen (Emmerthal: 2 von ca. 19). Gemeinde zählt trotzdem komplett |
| US-Großstadt (New York) | Stadt > Boroughs > gemischte Gebiete | Zweite Ebene prüfen; bei Mischmasch (Community Boards, Historic Districts) `--tiefe 1` |
| Bundesland, Land | `--ebene region` bzw. `country`, `--tiefe 1` | Achtung Größe, siehe 5 |

## 4. Prüfen (Pflicht, Ergebnis Michi zeigen)

1. **Richtiger Ort?** Trefferliste der Suche ansehen (Land, Einwohnerzahl).
2. **Anzahl und Art der Gebiete** gegen eine offizielle Zahl halten (z. B. Wikipedia „Liste der Stadtteile von …“). Namen der zweiten Ebene ansehen: sind es echte Stadtteile/Viertel oder Gremien, Denkmalbereiche, Plätze? Sonst Tiefe reduzieren und `hinweis` setzen.
3. **Straßen-km plausibel?** Faustregeln: Großstadt ca. 2–3 km Straße je 1.000 Einwohner:innen, Kleinstadt und Dorf mehr. Offizielle Straßenlänge der Gemeinde vergleichen, falls auffindbar (enthält oft Wirtschaftswege, liegt daher höher).
4. **Stichprobe** mit 3 bekannten Straßen: `NODE_USE_ENV_PROXY=1 npx tsx scripts/strassenlaenge.ts <id> "<Gebiet>" "<Straße 1>" "<Straße 2>"` (Rohlänge, zweibahnige Straßen erscheinen hier doppelt).
5. **Abdeckung:** Summe der Untergebiete vs. Wurzel. Wo OpenStreetMap keine Stadtteile kennt, bleibt Fläche ohne Untergebiet (z. B. Freising: Stadtteile decken ca. 114 von 282 km ab). Michi darauf hinweisen.
6. **Im Browser ansehen:** `npm run build`, Vorschau, Reiter „Gebiete“ und Karte (Grenzen, Namen, Antippen), hell und dunkel.

## 5. Größe und Grenzen

- Rechenzeit: Köln (360 Kacheln) ca. 1 Minute, New York (728 Kacheln) ca. 2 Minuten. Bundesland NRW: ca. 15.000 Kacheln, ca. 45 Minuten und mehr.
- Dateigröße: Grenzen einer Großstadt ca. 0,3 MB. Cloudflare Pages: max. 25 MB je Datei, 20.000 Dateien.
- Für Bundesländer und Länder auf Ebene Gemeinde/Stadtteil: nicht hiermit, sondern mit der eigenen Verarbeitung (Phase „Ausbau“: Job in GitHub Actions, Ablage auf R2, Laden nach Sichtbereich). Vorher mit Michi absprechen.

## 6. Abschließen

- `docs/entscheidungen.md`: Eintrag mit Region, Anzahl Gebiete, km, Auffälligkeiten.
- `npm run check`, committen, pushen, Veröffentlichung prüfen (Pages-API), Live-Seite kurz ansehen.
- Testkonten aus Browser-Tests in Supabase löschen (anonyme Nutzer:innen der letzten Minuten).
