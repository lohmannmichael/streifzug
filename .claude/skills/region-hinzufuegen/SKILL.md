---
name: region-hinzufuegen
description: Neue Region in Streifzug aufnehmen (Stadt, Dorf, Landkreis, Bundesland, Land, auch im Ausland) mit Gebietsgrenzen, Straßen-km je Gebiet und Prüfung. Verwenden, wenn Michi „füge Freising hinzu“, „nimm Bayern auf“, „neue Stadt“, „Urlaubsort“ o. Ä. sagt oder eine Region neu berechnet werden soll.
---

# Region hinzufügen

Eine Region = ein Wurzelgebiet (z. B. Köln) plus seine Untergebiete bis zu einer Tiefe (z. B. Bezirke, Stadtteile).
Daten weltweit aus denselben zwei Quellen, kein Sonderweg pro Land:

- **Grenzen:** Overture Maps „divisions“ (aus OpenStreetMap, Lizenz ODbL). Jedes Gebiet kennt sein Elterngebiet.
- **Straßen:** OpenStreetMap über die OpenFreeMap-Vektorkacheln (Zoom 14), gezählt mit `packages/core` (Zählregeln, jede Straße einmal).

## 1. Wurzelgebiet und Tiefe festlegen

Overture-Ebenen (`ebene`): `country` > `region` (Bundesland) > `county` (Landkreis, kreisfreie Stadt) > `localadmin` > `locality` (Gemeinde, Ort, Stadtbezirk) > `macrohood`/`neighborhood` (Stadtteil, Viertel).

| Was | ebene der Wurzel | tiefe | Ergebnis |
|---|---|---|---|
| Großstadt (kreisfrei, z. B. Köln) | `county` | 2 | Stadt > Bezirke > Stadtteile |
| Stadt im Landkreis (z. B. Freising) | `locality` | 1 | Stadt > Stadtteile |
| Dorf | `locality` | 0 oder 1 | nur das Dorf (oder Ortsteile, falls vorhanden) |
| Landkreis | `county` | 1 | Kreis > Gemeinden |
| Bundesland | `region` | 1 | Land > Kreise (Achtung Größe, siehe 5) |
| Land | `country` | 1 | Land > Bundesländer (nur mit eigener Verarbeitung, siehe 5) |

Den Punkt (`punkt`, [Länge, Breite]) nimmst du aus einer Karte, z. B. Rathaus oder Marktplatz. Er muss im Gebiet liegen.

## 2. Konfiguration anlegen

`regionen/<id>.json` (id: klein, ohne Umlaute, z. B. `muenchen`):

```json
{
  "id": "freising",
  "name": "Freising",
  "wurzel": { "ebene": "locality", "name": "Freising", "punkt": [11.7489, 48.4029] },
  "tiefe": 1
}
```

Optional: `"sprache": "de"` (Namen, Standard Deutsch, sonst Ortssprache), `"overture": "2026-11-18.0"` (Datenstand).
`name` in `wurzel` muss dem Overture-Namen entsprechen (Ortssprache oder Deutsch).

## 3. Bauen

Voraussetzungen (einmal pro Umgebung): `pip install pyarrow shapely`; erlaubte Hosts `overturemaps-us-west-2.s3.amazonaws.com`, `overturemaps-us-west-2.s3.us-west-2.amazonaws.com`, `tiles.openfreemap.org`.

```bash
npm run region -- <id>
```

Schreibt `apps/web/public/regionen/<id>/{gebiete.geojson,namen.geojson,summen.json}` und aktualisiert `apps/web/public/regionen/index.json`. Die App zeigt alle Regionen aus dem Index automatisch an (Karte, Gebiete-Liste), ohne Code-Änderung.

## 4. Prüfen (Pflicht, Ergebnis Michi zeigen)

1. **Anzahl Gebiete** aus der Ausgabe gegen eine offizielle Zahl halten (z. B. Wikipedia „Liste der Stadtteile von …“). Abweichungen nennen (z. B. Köln: 86 offiziell, 87 bei Overture wegen eines Grenzorts).
2. **Straßen-km plausibel?** Faustregeln: Großstadt ca. 2–3 km Straße je 1.000 Einwohner:innen, Kleinstadt und Dorf mehr. Offizielle Straßenlänge der Gemeinde vergleichen, falls auffindbar (enthält oft Wirtschaftswege, liegt daher höher).
3. **Stichprobe** mit 3 bekannten Straßen: `NODE_USE_ENV_PROXY=1 npx tsx scripts/strassenlaenge.ts <id> "<Gebiet>" "<Straße 1>" "<Straße 2>"` (Rohlänge, zweibahnige Straßen erscheinen hier doppelt).
4. **Abdeckung:** Summe der Untergebiete vs. Wurzel. Wo OpenStreetMap keine Stadtteile kennt, bleibt Fläche ohne Untergebiet (z. B. Freising: Stadtteile decken ca. 114 von 282 km ab). Michi darauf hinweisen.
5. **Im Browser ansehen:** `npm run build`, Vorschau, Reiter „Gebiete“ und Karte (Grenzen, Namen, Antippen), hell und dunkel.

## 5. Größe und Grenzen

- Rechenzeit ca. 1 Minute je 100 Kacheln (1 Kachel ≈ 1,5 × 1,5 km in Mitteleuropa). Stadt: Sekunden bis Minuten. Bundesland NRW: ca. 15.000 Kacheln, über 2 Stunden.
- Dateigröße: Grenzen einer Großstadt ca. 0,3 MB. Cloudflare Pages: max. 25 MB je Datei, 20.000 Dateien.
- Für Bundesländer und Länder auf Ebene Gemeinde/Stadtteil: nicht hiermit, sondern mit der eigenen Verarbeitung (Phase „Ausbau“: Job in GitHub Actions, Ablage auf R2, Laden nach Sichtbereich). Vorher mit Michi absprechen.

## 6. Abschließen

- `docs/entscheidungen.md`: Eintrag mit Region, Anzahl Gebiete, km, Auffälligkeiten.
- `npm run check`, committen, pushen, Veröffentlichung prüfen (Pages-API), Live-Seite kurz ansehen.
- Testkonten aus Browser-Tests in Supabase löschen (anonyme Nutzer:innen der letzten Minuten).
