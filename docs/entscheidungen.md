# Entscheidungen

## 19.11.2026: Schritt 1a Straßendaten
- Quelle: OpenStreetMap über die OpenFreeMap-Vektorkacheln (OpenMapTiles-Schema, Zoom 14) statt Overpass oder Geofabrik (beide sperren Rechenzentren). Vorteil: dieselbe Quelle funktioniert weltweit und später auch direkt auf dem Gerät
- Zählregeln aus `packages/core/src/rules.ts` gelten unverändert; `omt.ts` übersetzt die Kachel-Felder. Einschränkung: Gehwege neben Straßen sind in den Kacheln nicht gekennzeichnet und zählen bei eingeschaltetem Schalter „Fuß- und Radwege“ mit
- Kachelränder werden abgeschnitten (`clip.ts`), damit nichts doppelt zählt
- Getrennte Fahrbahnen von Hauptstraßen (zwei parallele Linien) zählen je zur Hälfte (`parallel.ts`); das Einbahn-Feld der Kacheln ist dafür unbrauchbar
- Ergebnis Stand 19.11.2026: Köln 2.255 km Straßen (Stadt Köln nennt ca. 2.600–2.800 km inkl. Wirtschafts- und Zufahrtswege), Weiden 28,0 km. Gegenprobe Weiden: Ostlandstraße ca. 1,0 km, Goethestraße ca. 0,6 km, Moltkestraße ca. 0,45 km, Aachener Straße vorher doppelt (4,6 km), jetzt einfach gezählt
- Ausgabe: `apps/web/public/strassen/14/<x>/<y>.json` (358 Kacheln, 7,4 MB, werden bei Bedarf geladen und auf dem Gerät gehalten) und `apps/web/public/gebiete/koeln-summen.json`; neu erzeugen mit `npm run strassen:koeln`

## 19.11.2026: Köln-Viertel auf der Karte
- Offizielle Grenzen der 86 Stadtteile und 9 Stadtbezirke (Stadt Köln, Offene Daten, CC BY; Kopie aus github.com/KoelnAPI/data, Stand 2013, seit 2007 unverändert eingeteilt). Aufbereitet mit `scripts/gebiete-koeln.mjs` (mapshaper, gemeinsame Grenzen bleiben deckungsgleich), liegen in `apps/web/public/gebiete/`
- Karte zeigt Grenzen und Namen beim Herauszoomen, Antippen wählt einen Stadtteil fürs Blatt. Namensnennung „Stadtteilgrenzen: Stadt Köln“
- Für andere Städte später OSM-Grenzen (admin_level 9/10) über die eigene Verarbeitung; die Kölner Server und Overpass sperren Rechenzentren, darum hier die GitHub-Kopie

## 19.11.2026: UX und Anmeldung
- UX laut `docs/ux/UX-KONZEPT.md`: Reiter Karte · Gebiete · Streifzüge, Profil als Knopf oben rechts auf der Karte
- Start ohne Konto: anonyme Supabase-Sitzung beim ersten Öffnen; Konto (Mail-Link, Apple) wird später verknüpft
- Vor dem öffentlichen Start: Schutz gegen massenhaft angelegte anonyme Konten (CAPTCHA, z. B. Cloudflare Turnstile) und Aufräumen verwaister anonymer Konten
- Datenbank-Schema `supabase/migrations/20261119180000_init.sql`: areas, user_settings, tracks, user_tile_coverage, user_area_progress, privacy_zones; Zeilenschutz je Nutzer:in, Sicherheits-Check von Supabase ohne Befund

## 19.11.2026: Phase 0 begonnen
- Cloudflare-Pages-Projekt `streifzug` per API angelegt und mit GitHub verbunden: https://streifzug.pages.dev
- Supabase: Site-URL und erlaubte Weiterleitungen auf streifzug.pages.dev und localhost gesetzt
- Design „Textmarker auf dem Stadtplan“ statt Papier-Creme mit Orange (siehe PLAN Abschnitt 6)
- Supabase-Projekt liegt in Irland (eu-west-1) statt Frankfurt: EU und DSGVO-konform, Unterschied in der Antwortzeit spielt durch „offline zuerst“ keine Rolle
- Code und Kommentare auf Englisch (für spätere Entwickler:innen), Oberfläche auf Deutsch
- Overpass sperrt Server aus Rechenzentren (auch die Claude-Umgebung). Die App lädt Straßendaten direkt vom Gerät; zum Testen hier brauchen wir Beispieldaten
- MapLibre 6: Worker-Datei wird über `setWorkerUrl` eingebunden, sonst lädt die Karte im Build nicht

## 19.11.2026: Skalierungs-Check vor dem Anlegen
- Fortschritt hängt nicht an OSM-Straßen-IDs: Wahrheit = Rohdaten (R2) + Abdeckung im H3-Raster; Prozente sind Zwischenspeicher und neu berechenbar
- Speicherung je Nutzer:in und Kachel als kompakter Block statt einer Zeile je Straßenstück
- Straßendaten als Kacheln (Zoom 14) statt Stadtpakete; große Dateien auf Cloudflare R2 (keine Traffic-Gebühren)
- Offline zuerst, IDs vom Gerät, Uploads dürfen doppelt ankommen, Abdeckung wird vereinigt (konfliktfrei)
- Anmeldung ohne Passwörter, neutrale Bundle-ID, alles einer Person unter ihrer ID (vollständig löschbar)

## 19.11.2026: Start
- Eigene App „Streifzug“ (Arbeitstitel), nicht Teil von Lohmis
- Erst Web-App zum Ausprobieren, dann iPhone-App (Expo) mit Hintergrund-Aufzeichnung
- Zählregeln, Messgröße, Rohdaten dauerhaft, Teilen früh: siehe `PLAN.md` Abschnitt 1
- Stack: TypeScript-Monorepo, React + MapLibre, Supabase (Frankfurt), Cloudflare Pages
- Geld ist eine Option mit Entscheidungs-Toren, siehe `BUSINESSPLAN.md`
