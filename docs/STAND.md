# Stand für die nächste Sitzung (20.11.2026)

Live: https://streifzug.pages.dev · Repo: lohmannmichael/streifzug · Umgebung: „Michis Apps“ (Supabase- und Cloudflare-Token hinterlegt)

## Fertig
- Phase 0: Gerüst, Supabase (anonyme Anmeldung, Tabellen mit RLS, Storage `spuren`), Cloudflare Pages mit Auto-Deploy
- 1a: Straßen aus OpenFreeMap-Kacheln, Zählregeln, jede Straße einmal (zwei Fahrbahnen halb)
- Regionen per Name: `npm run region -- "<Ort>"` (Overture-Grenzen). Drin: Köln (86 Stadtteile), Freising, Hameln, Emmerthal, New York City (Boroughs)
- 1b/1c: Standort, Losziehen/Beenden, Speichern auf dem Gerät, Hochladen
- 1d: Abgleich Spur → Straßen, gelb auf der Karte, Prozent in Blatt und Gebiete-Liste

## Offen in Phase 1
- Design-Paket 1 erledigt 20.11.2026 (Kartenquellen eingeklappt, Prozent mit Kommastelle unter 10 %, feinere Grenzlinien, Blatt herunterziehbar)
- Design-Paket 2 erledigt 20.11.2026: Gebiete-Liste mit Mini-Balken und Sortierung (Nähe, Am meisten entdeckt, A–Z), Nebel über Unentdecktem (Schalter im Profil), Zeichen-Moment beim Aufzeichnen (Textmarker-Strich, „+N m“). Dazu Fix: gelbe Straßen gingen verloren, wenn die Karte langsamer lud als der Fortschritt (Michis Kita-Fahrt). Live auf main seit 20.11.2026
- Design-Paket 3 erledigt 20.11.2026: Logbuch im Reiter Streifzüge (Mini-Stadtplan je Runde, neu entdeckte Meter, Prozent-Sprung, neue Straßennamen, nach Monaten), Weißer Fleck im Blatt mit „Zeigen“, Meilenstein-Stempel (1/5/10/25/50/75/100 %) im Blatt und im Logbuch, Straßenname im Zeichen-Moment. Nächstes: Design-Paket 4 (Unterwegs-Modus, eigener Kartenstil „Stadtplan“), dann Test draußen
- Test draußen durch Michi (Weiden), Feedback einarbeiten
- Nebel-Karte: Gebiete leuchten herausgezoomt gelb nach Prozent, reingezoomt Nebel über Unentdecktem (beides erledigt 20.11.2026)
- Teilen-Bild mit Privatzone
- Belohnungsmoment nach einer Runde und „weißer Fleck in der Nähe“ (beides erledigt 20.11.2026)
- Ideenliste: docs/IDEEN.md (u. a. Sehenswürdigkeiten-Checkliste, Konzept in docs/idee-sehenswuerdigkeiten.md)
- Danach Phase 2 (Import GPX/Apple Health), Phase 3 (iPhone-App mit Hintergrund-Aufzeichnung)

## Wichtig zu wissen
- Overpass, Geofabrik, Kölner Open Data sperren die Claude-Umgebung → Straßen über OpenFreeMap-Kacheln, Grenzen über Overture
- Michi hat zwei Cloudflare-Konten; App und Token im Konto 48237c…; R2 nicht genutzt (Rohdaten in Supabase Storage)
- Commit-Autor: `Michi <356598429+lohmannmichael@users.noreply.github.com>` (keine private Mail)
- Testkonten nur gezielt löschen (siehe CLAUDE.md)
- Lizenzen: docs/lizenzen.md
