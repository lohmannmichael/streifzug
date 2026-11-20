# Entscheidungen

## 20.11.2026: Gelb nur für das, was zählt
- Michi: „Nicht jede Hofeinfahrt soll zählen, nur Straßen.“ Befund (Kachel Weiden): Einfahrten, Parkplatzgassen und Zufahrten (`highway=service`) zählten schon nie. Gelb gezeichnet wurden aber alle gegangenen Fuß- und Feldwege (`footway`, `path`; in Weiden rund 140 kurze Stücke unter 60 m, oft in Höfe), obwohl sie ohne den Schalter „Fuß- und Radwege mitzählen“ nicht in die Prozente eingehen
- Jetzt gilt überall: gelb wird nur, was zählt (Straßen; Wege nur mit Schalter). Gilt für Karte, Nebel, Zeichen-Moment, Zähler unterwegs und Logbuch

## 20.11.2026: Verorten und Gebiete-Seite nach Michis Wunsch
- Standort-Knopf: Karte zum Standort, Blatt zeigt das Viertel an dieser Stelle (`gebietAn` in `daten/fortschritt.ts`, Punkt-im-Polygon auf der kleinsten Ebene). Die Karte springt dabei nicht zur Viertel-Mitte. Ist der Standort schon erlaubt (Permissions-API), passiert das beim Öffnen von selbst, ohne Nachfrage
- Gebiete: nur Städte, Bezirke und Viertel mit Entdecktem, als aufklappbare Listen (`details`/`summary`, nativ und barrierearm), je Ebene meiste Prozent zuerst; das gewählte Viertel und seine Eltern sind aufgeklappt. Die Sortierungen aus Design-Paket 2 entfallen, weil nur noch Freigeschaltetes erscheint

## 20.11.2026: Design-Paket 4 und neue Reihenfolge
- Michi will die App erst selbst richtig nutzen; Freund:innen-Test (erster Start, Icon, Teilen-Bild) kommt später. Phase 3 (Hintergrund-Aufzeichnung) wird vor Phase 2 (Import) gezogen, weil eine App, die man jedes Mal starten muss, im Alltag kaum genutzt wird
- Kartenstil „Stadtplan“ (`apps/web/src/karte/stil.ts`): Grundlage ist OpenFreeMap Positron für hell und dunkel (gleiche Ebenen, nur andere Farben, per `transformStyle` beim Laden umgefärbt). Weiße Straßen auf Nebelgrau, Schrift in Tinte, keine Straßenschilder. Vorteil: Ebenen-Reihenfolge und Namen sind in beiden Modi gleich (vorher lag im dunklen Stil das Viertel-Leuchten über den gelben Straßen). Im Dunkeln Nebel und Viertel-Leuchten schwächer
- Unterwegs-Modus: Blatt klappt beim Losziehen ein und nach „Beenden“ wieder auf (Belohnung, Stempel). Zähler oben zählt neu entdeckte Meter dieser Runde (alle Gebiete) und verschiedene Straßennamen

## 20.11.2026: Design-Paket 3 (Logbuch, Weißer Fleck, Stempel, Straßennamen)
- Logik in `packages/core/src/ziele.ts` mit Tests: `milestoneReached` (Stufen 1, 5, 10, 25, 50, 75, 100 %), `nearestUnseen` (nächste ungesehene Straße bis 1,5 km, Wege nur mit Schalter), `nameNear` (Straßenname bis 15 m), `newPerOuting` (jedes Stück zählt für die erste Runde, die es gesehen hat)
- Straßennamen aus der Kachel-Ebene `transportation_name` (OpenMapTiles; die Ebene `transportation` hat keine Namen). Kachel wird einmal geladen und für Stücke und Namen genutzt
- Logbuch (`daten/logbuch.ts`) rechnet alle Runden von der ältesten an durch, mit derselben Gebietszuordnung wie die Prozente (`meterJeGebiet`). Mini-Stadtplan als SVG ohne Kartenkacheln (graue Straßen, Gelb, Spur in Tinte): leicht, viele Karten gleichzeitig möglich, passt zum Textmarker-Look
- Weißer Fleck: vom Standort (wenn bekannt), sonst von der Mitte des gewählten Gebiets; „Zeigen“ markiert den ganzen ungesehenen Straßenzug gestrichelt in Tinte. Erscheint im Blatt statt des Leertexts, nicht direkt nach einer Runde (dann steht dort die Belohnung)
- Stempel: im Blatt nach einer Runde (mit Stempel-Bewegung, ruhig bei „Bewegung reduzieren“) und im Logbuch oben rechts auf dem Mini-Plan
- „Nächstes Ziel im Blatt“ verworfen (Michi)

## 20.11.2026: Design-Paket 2 und Fix „gelbe Straßen fehlen“
- Fehler (gemeldet von Michi nach der Kita-Fahrt): Prozent stimmte, Straßen waren nicht gelb. Ursache: War der Fortschritt fertig, bevor der Kartenstil geladen war, gingen die gelben Straßen (und die Flächenfarben) verloren. Jetzt merkt sich die Karte den letzten Stand und zeichnet ihn bei jedem Laden des Stils neu (auch beim Wechsel hell/dunkel). Nachgestellt mit absichtlich verzögertem Kartenstil, danach behoben
- Flächen der Gebiete liegen immer unter den gelben Straßen (im dunklen Stil lagen sie darüber)
- Nebel: eigene Zeichenfläche (Canvas) über der Karte, Korridore rund um gesehene Straßen, Spur und Standort werden ausgeschnitten (ca. 28 m je Seite, weicher Rand). Blendet unter Zoom 12–13 aus, dort leuchten die Flächen. Schalter im Profil (Standard an, nur auf dem Gerät). Grund für Canvas: MapLibre kann Flächen nicht „ausradieren“, Pufferpolygone wären teuer
- Zeichen-Moment nur beim Aufzeichnen: neue Stücke laufen als Textmarker-Strich entlang (line-gradient, 0,7 s), kurzer Glanz, „+N m“ steigt über dem Standort auf (zählt wie die Prozente, Wege nur mit Schalter). Bei „Bewegung reduzieren“ ohne Bewegung
- Gebiete-Liste: Sortierung In deiner Nähe (Standort, sonst gewähltes Gebiet; Abstand zum Namenspunkt), Am meisten entdeckt, A–Z (wie bisher, mit Stadt-Prozent). Je Zeile Mini-Balken, Prozent auf Textmarker, sobald etwas entdeckt ist. Wahl bleibt gemerkt

## 19.11.2026: Schritt 1d Abgleich Spur → Straßen, gelb und Prozent
- Gemeinsame Funktion `piecesFromTile` (packages/core/src/pieces.ts) für Gesamt-km (Regionen-Skript) und Gesehenes (Gerät): beide zählen garantiert gleich. Köln nach Umbau unverändert 2.273,9 km
- Abgleich `seenPieceIds` (match.ts): Stück gilt als gesehen, wenn ≥ 60 % seiner Länge höchstens 20 m seitlich neben der Spur liegen und die Spur in Straßenrichtung verläuft (±45°). Die 20 m wirken nur seitlich, nicht über das Ende der Spur hinaus (sonst zählt „8 m hineingehen und umdrehen“ als ganze Straße). Lücken über 60 s werden nicht überbrückt. Querende Seitenstraßen zählen nicht
- Auf dem Gerät: Kacheln rund um alle Spuren von OpenFreeMap laden, abgleichen, gesehene Meter je Gebiet (alle Ebenen) summieren; Prozent = gesehen / gesamt. Autofahrten zählen nur mit Schalter. Live während des Aufzeichnens (alle 10 neuen Punkte)
- Karte: Gesehenes als gelber Textmarker-Strich, Spur als gestrichelte Tintenlinie; beim Aufzeichnen Zoom auf Straßenebene
- Fortschritt wird aus den Rohdaten auf dem Gerät berechnet (alle Runden); Speicherung als Abdeckung in der Datenbank (für mehrere Geräte, Ranglisten) folgt später
- Getestet mit simuliertem Spaziergang auf echter Straße (Wupperstraße, Lövenich): 148 m gelaufen, 0,2 km entdeckt, Gebiet automatisch gewechselt

## 19.11.2026: Schritt 1b/1c Standort und Aufzeichnen (Web-App)
- „Losziehen“: GPS mit hoher Genauigkeit, solange die App offen ist; Bildschirm bleibt an (Wake Lock). Hintergrund-Aufzeichnung erst mit der iPhone-App (Phase 3), die App sagt das beim Aufzeichnen
- GPS-Punkte mit Ungenauigkeit über 25 m, ohne Zeitfortschritt oder mit Sprüngen über 50 m/s werden aussortiert; Lücken über 60 s werden nicht überbrückt; Fortbewegung nach Median-Tempo (bis 7,2 km/h zu Fuß, bis 30 km/h Rad, darüber Auto) – `packages/core/src/track.ts`
- Gespeichert alle 10 s auf dem Gerät (IndexedDB); bricht die App ab, wird die Runde beim nächsten Öffnen am letzten Punkt beendet. Nach „Beenden“ und bei Netz: Rohdatei komprimiert nach Supabase Storage, Zusammenfassung in `tracks`
- Karte folgt der Position, zeigt die Spur gelb und wählt automatisch das Gebiet, in dem man gerade ist
- Getestet mit simuliertem Spaziergang (Playwright): 35 m, zu Fuß, gesichert, Datei 96 Byte. Echter Test draußen steht aus

## 19.11.2026: Orte per Name hinzufügen; Hameln, Emmerthal, New York City
- `npm run region -- "<Name>"` sucht den Ort in Overture (Stadt/Gemeinde bevorzugt, dann Einwohnerzahl, ähnliche Schreibweisen), schreibt die Konfiguration und baut; Tiefe automatisch (bis 2 Ebenen)
- Gleiche Ebene darf sich nicht überlappen: liegt ein Gebiet in einem anderen (in beide Richtungen geprüft), bleibt das größere. Köln dadurch exakt 86 Stadtteile (vorher 87 mit Grenzort Horbell)
- Hameln: Kernstadt + 10 Ortsteile, 12 Viertel darunter, 332,7 km Straßen
- Emmerthal (Eingabe „Emmertal“ automatisch korrigiert): 163,7 km, nur 2 Ortsteile mit Grenzen in OSM (Grohnde, Latferde)
- New York City: 5 Boroughs, 9.614,7 km Straßen (Stadt nennt ca. 6.000–6.300 Meilen ≈ 9.700–10.100 km). Viertel-Ebene bewusst weggelassen (OSM/Overture dort Mischmasch aus Community Boards und Historic Districts); später offizielle Neighborhood Tabulation Areas

## 19.11.2026: Rohdaten vorerst in Supabase Storage statt R2
- R2 ließ sich im richtigen Cloudflare-Konto nicht einfach einschalten (Michi hat zwei Konten; R2 wurde im leeren Zweitkonto aktiviert, das Einschalten geht nur im Dashboard). Statt dieser Hürde: privater Bucket `spuren` in Supabase Storage (EU, Irland), Ordner je Nutzer:in `spuren/<user_id>/<track_id>.json.gz`
- Zugriff nur auf den eigenen Ordner (Policies in `supabase/migrations/20261119210000_storage_spuren.sql`), mit zwei Testkonten geprüft. Vorteil: die App lädt direkt hoch, kein eigener Server-Code nötig
- Kosten: 1 GB frei, Pro-Tarif 100 GB. Bei vielen Nutzer:innen später Umzug nach R2 (keine Traffic-Gebühren); Dateien und Ordnerstruktur bleiben gleich
- Supabase-Sicherheits-Check meldet „anonyme Anmeldung“ als Hinweis; das ist gewollt (Start ohne Konto)
- Offen bei Cloudflare: im Zweitkonto liegt ein leerer Bucket `streifzug-daten`, kann gelöscht werden

## 19.11.2026: Regionen per Befehl, weltweit gleiche Quellen
- Wunsch Michi: neue Städte, Dörfer, Bundesländer, Länder ohne großen Aufwand. Lösung: eine Konfigurationsdatei je Region (`regionen/<id>.json`) und ein Befehl `npm run region -- <id>`; Anleitung als Skill `region-hinzufuegen`
- Gebietsgrenzen jetzt aus Overture Maps „divisions“ (aus OpenStreetMap, ODbL), über den Eltern-Stammbaum (`parent_division_id`), weil die Ebenen-Namen je Ort schwanken (Kölner Stadtteile mal „macrohood“, mal „neighborhood“). Überlappende Gebiete gleicher Tiefe werden ausgesiebt
- Köln mit Overture: 9 Bezirke, 87 Gebiete (86 Stadtteile + Grenzort Horbell), 2.273,9 km; Weiden unverändert 28,3 km. Die Kölner Sonderdaten (Stadt Köln, CC BY) sind ersetzt
- Zweite Region: Freising (Wurzel locality, Tiefe 1): 9 Stadtteile, 281,8 km Straßen; Stadtteile decken nur ca. 114 km ab, weil OSM dort nicht die ganze Stadt in Viertel teilt
- Straßen-Kacheln liegen nicht mehr im Repo; die App wird sie in 1c/1d direkt von OpenFreeMap laden und mit `packages/core` auf dem Gerät auswerten. Im Repo nur Grenzen und km-Summen (klein)
- Grenzen der Methode: Bundesländer/Länder bis auf Stadtteil-Ebene brauchen die eigene Verarbeitung (Job, R2, Laden nach Sichtbereich)

## 19.11.2026: Schritt 1a Straßendaten
- Quelle: OpenStreetMap über die OpenFreeMap-Vektorkacheln (OpenMapTiles-Schema, Zoom 14) statt Overpass oder Geofabrik (beide sperren Rechenzentren). Vorteil: dieselbe Quelle funktioniert weltweit und später auch direkt auf dem Gerät
- Zählregeln aus `packages/core/src/rules.ts` gelten unverändert; `omt.ts` übersetzt die Kachel-Felder. Einschränkung: Gehwege neben Straßen sind in den Kacheln nicht gekennzeichnet und zählen bei eingeschaltetem Schalter „Fuß- und Radwege“ mit
- Kachelränder werden abgeschnitten (`clip.ts`), damit nichts doppelt zählt
- Jede Straße zählt genau einmal, auch mit zwei Fahrbahnen (Wunsch Michi): parallele Linien derselben Straßenart zählen je zur Hälfte (`parallel.ts`). Hauptstraßen bis 35 m Abstand (Mittelstreifen, Bahn), Wohnstraßen bis 22 m (damit zwei getrennte Straßen mit Häusern dazwischen nie verschmelzen). Ein Partner zählt nur, wenn er seitlich daneben liegt; das nächste Teilstück derselben Straße ist keine zweite Fahrbahn (Fehler gefunden und mit Test abgesichert). Das Einbahn-Feld der Kacheln ist dafür unbrauchbar
- Ergebnis Stand 19.11.2026 (nach Korrektur): Köln 2.274 km Straßen, Weiden 28,3 km. Vorher: Köln 2.255 km (Stadt Köln nennt ca. 2.600–2.800 km inkl. Wirtschafts- und Zufahrtswege), Weiden 28,0 km. Gegenprobe Weiden: Ostlandstraße ca. 1,0 km, Goethestraße ca. 0,6 km, Moltkestraße ca. 0,45 km, Aachener Straße vorher doppelt (4,6 km), jetzt einfach gezählt
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
