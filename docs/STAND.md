# Stand für die nächste Sitzung (20.11.2026)

Live: https://streifzug.pages.dev · Repo: lohmannmichael/streifzug · Umgebung: „Michis Apps“ (Supabase- und Cloudflare-Token hinterlegt)

## Fertig
- Phase 0: Gerüst, Supabase (anonyme Anmeldung, Tabellen mit RLS, Storage `spuren`), Cloudflare Pages mit Auto-Deploy
- 1a: Straßen aus OpenFreeMap-Kacheln, Zählregeln, jede Straße einmal (zwei Fahrbahnen halb)
- Regionen per Name: `npm run region -- "<Ort>"` (Overture-Grenzen). Drin: Köln (86 Stadtteile), Freising, Hameln, Emmerthal, New York City (Boroughs)
- 1b/1c: Standort, Losziehen/Beenden, Speichern auf dem Gerät, Hochladen
- 1d: Abgleich Spur → Straßen, gelb auf der Karte, Prozent in Blatt und Gebiete-Liste

## Offen in Phase 1
- Test draußen durch Michi (Weiden), Feedback einarbeiten
- Nebel-Karte / Gebiete nach Prozent einfärben (semantischer Zoom)
- Teilen-Bild mit Privatzone
- Belohnungsmoment nach einer Runde, „weißer Fleck in der Nähe“
- Ideenliste: docs/IDEEN.md (u. a. Sehenswürdigkeiten-Checkliste, Konzept in docs/idee-sehenswuerdigkeiten.md)
- Danach Phase 2 (Import GPX/Apple Health), Phase 3 (iPhone-App mit Hintergrund-Aufzeichnung)

## Wichtig zu wissen
- Overpass, Geofabrik, Kölner Open Data sperren die Claude-Umgebung → Straßen über OpenFreeMap-Kacheln, Grenzen über Overture
- Michi hat zwei Cloudflare-Konten; App und Token im Konto 48237c…; R2 nicht genutzt (Rohdaten in Supabase Storage)
- Commit-Autor: `Michi <356598429+lohmannmichael@users.noreply.github.com>` (keine private Mail)
- Testkonten nur gezielt löschen (siehe CLAUDE.md)
- Lizenzen: docs/lizenzen.md
