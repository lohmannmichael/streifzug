# Idee: Sehenswürdigkeiten als Checkliste (Stand 20.11.2026, Konzept, noch nicht gebaut)

Ziel: Im Urlaub (und zu Hause) sehen, welche großen Sehenswürdigkeiten einer Stadt man schon gesehen hat. Automatisch abgehakt, wenn man daran vorbeikommt, manuell abhakbar, als Liste je Stadt („7 von 20 in Lissabon“).

## Daten (weltweit, gleiche Quellen wie bisher)
- **Overture Maps „places“** (Kategorien wie landmark_and_historical_building, tourist_attraction, monument, museum, castle, church; mit Zuverlässigkeitswert) und/oder **OpenStreetMap** (tourism=attraction, historic=monument/castle/memorial, OpenFreeMap-Ebene „poi“ mit Rang)
- **„Groß“ bestimmen:** Wikidata-Verknüpfung, Anzahl Wikipedia-Sprachversionen (Sitelinks) als Bekanntheit; je Stadt Top 10 / Top 25 / alle
- Fläche, wo vorhanden (Burg, Park, Platz), sonst Punkt
- Aufbereitung im Regionen-Skript: `npm run region -- "<Ort>"` schreibt zusätzlich `sehenswuerdigkeiten.json` (Name auf Deutsch, Kategorie, Punkt/Fläche, Rang, Wikipedia-Link)

## Abhaken
- **Automatisch:** Spur kommt bis 75 m an den Punkt heran (bei großen Objekten: Fläche betreten oder Rand auf 30 m). Abgleich auf dem Gerät, wie bei den Straßen (`packages/core`, mit Tests)
- **Manuell:** „Gesehen“ antippen (z. B. vom Bus aus), optional Foto als Erinnerung
- Abgehakt bleibt abgehakt; Datum und Runde werden gemerkt

## Oberfläche
- Karte: Stempel-Symbole, offen = Umriss, gesehen = gelber Stempel
- Gebiete-Liste je Stadt: zweiter Wert „Sehenswürdigkeiten 7/20“, aufklappbare Checkliste, sortiert nach Bekanntheit
- Unterwegs: „Kölner Dom ist 300 m entfernt“ (Web: beim Öffnen; iPhone-App: Mitteilung)
- Vor der Reise: Stadt hinzufügen, Liste vorab offline laden, Merkliste („will ich sehen“)
- Rückblick/Teilen: „Lissabon: 14 von 20 Sehenswürdigkeiten, 12 % der Straßen“

## Einordnung
- Starker Grund für das Pro-Abo (Reisen) und für Kooperationen mit Tourismus-Ämtern (Challenges)
- Vorschlag Reihenfolge: nach Phase 1 als kleines MVP (Top 20 je Region, automatisch bei 75 m, Liste + Karte), Mitteilungen erst mit der iPhone-App
- Lizenzen: Overture places teils ODbL (aus OSM), teils CDLA-Permissive; Namensnennung prüfen (docs/lizenzen.md ergänzen)
