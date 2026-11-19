# Lizenzen der Karten- und Gebietsdaten (Stand 20.11.2026, keine Rechtsberatung)

| Baustein | Lizenz | Kommerziell erlaubt? | Pflichten |
|---|---|---|---|
| OpenStreetMap-Daten (Straßen) | ODbL 1.0 | Ja | Namensnennung „© OpenStreetMap-Mitwirkende“ sichtbar. Share-Alike: veröffentlichte, aus OSM abgeleitete *Datenbanken* (z. B. unsere Straßenstücke, km-Summen, Grenzen) müssen ebenfalls unter ODbL angeboten werden. Karten, Bilder, Prozentwerte („Produced Works“) dürfen unter beliebiger Lizenz stehen |
| Overture Maps „divisions“ (Grenzen) | ODbL 1.0 (aus OSM) | Ja | wie OSM, zusätzlich „Overture Maps“ nennen |
| OpenFreeMap (Kartenkacheln, Server) | kostenloser Dienst, Nutzung auch kommerziell | Ja | Namensnennung „OpenFreeMap © OpenMapTiles Data from OpenStreetMap“. Kein Vertrag, keine Verfügbarkeitsgarantie |
| OpenMapTiles-Schema, Positron/Dark-Stil | BSD / CC-BY | Ja | Namensnennung „© OpenMapTiles“ |
| MapLibre GL JS | BSD-3 | Ja | Lizenztext mitliefern (steckt im Build) |

Die Namensnennungen stehen bereits in der Karte (i-Knopf) und im Profil.

Vor dem kommerziellen Start:
1. Eigene Kartenkacheln hosten (Protomaps/OpenMapTiles-Datei auf Cloudflare R2) oder bezahlten Anbieter nehmen (z. B. MapTiler), weil OpenFreeMap keine Garantie gibt
2. Seite „Datenquellen und Lizenzen“ in der App; unsere aufbereiteten OSM-Daten (Grenzen, Straßenstücke, Summen) zum Download unter ODbL anbieten (geringer Aufwand, liegen ohnehin als Dateien vor)
3. Nutzer:innen-Daten (eigene Wege) nicht mit OSM-Daten zu einer veröffentlichten Datenbank vermischen; Fortschritt ist ein „Produced Work“
4. Einmal kurz anwaltlich prüfen lassen (ODbL-Share-Alike, App-Store-Texte)
