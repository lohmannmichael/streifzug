# Streifzug: Produkt- und Umsetzungsplan

Arbeitstitel: **Streifzug**. Name wird vor dem App-Store-Start geprüft (Marke, App Store, Domain).
Stand: 19.11.2026 · Eigentümer: Michi

---

## 1. Worum es geht (Kurzfassung)

Eine App, die im Hintergrund aufzeichnet, wo du zu Fuß und mit dem Rad unterwegs warst, und daraus Straßen „freischaltet“. Du siehst, wie viel Prozent einer Stadt, eines Bezirks oder eines Stadtteils (Veedel) du schon gesehen hast. Das funktioniert zu Hause und im Ausland.

- **Zuerst für Michi allein:** Web-App zum Ausprobieren, danach iPhone-App
- **Von Anfang an so gebaut, dass es später ein Produkt werden kann:** mehrere Nutzer:innen, App Store, Teilen, Freund:innen
- **Kern:** Prozent-Jagd auf Straßen. Orte, Abzeichen und Wettbewerbe kommen später

### Entscheidungen von Michi (19.11.2026)

| Thema | Entscheidung |
|---|---|
| Hintergrund-Aufzeichnung | Ja, Ziel. Start als Web-App zum Ausprobieren (Aufzeichnung bei offener App) |
| Eigene App vs. Lohmis | Eigene App, nicht in Lohmis |
| Nutzer:innen | Erst nur Michi, später Freund:innen, eventuell verkaufen |
| Was zählt | Fuß und Rad voll; Auto optional (eigener Wert); Bus und Bahn nicht |
| Straßen | Alle öffentlichen Straßen; keine Autobahn, keine Privatwege, keine Feldwege; Schalter für Fuß- und Radwege |
| Messgröße | Straßen-km in Prozent (Hauptwert) und Nebel-Karte (Optik) |
| Import alter Wege | Später (Phase 2) |
| Rohdaten | Dauerhaft behalten (nicht nach 30 Tagen löschen); löschen und exportieren kann man selbst |
| Teilen | Ja, schon früh (Bild „Weiden zu 35 % erkundet“) |
| Mac | Vorhanden (wichtig für die iPhone-App) |
| Design | Freie Hand für Claude (siehe Abschnitt 6) |

---

## 2. Was zählt als „gesehen“ (Regeln)

### Straßen (aus OpenStreetMap, OSM)

- **Zählen immer:** residential, living_street, unclassified, tertiary, secondary, primary (und ihre `_link`), pedestrian, trunk ohne `motorroad=yes`
- **Mit Schalter „Fuß- und Radwege“ (Standard: aus):** footway, cycleway, path, steps, bridleway. Ausnahme: Gehwege neben Straßen (`footway=sidewalk`, `crossing`) zählen nie, sonst zählte jede Straße doppelt
- **Zählen nie:** motorway(_link), trunk mit `motorroad=yes`, service (Einfahrten, Parkplätze), track (Feldwege), `access=private|no`, construction, proposed, Flächen (`area=yes`)

### Abgleich Weg → Straße

- Jede Straße wird in **Stücke von ca. 25 m** geteilt, jedes mit fester ID (`OSM-Weg-ID:Nummer`)
- Ein Stück gilt als gesehen, wenn dein Weg **mindestens 60 % seiner Länge im Abstand von höchstens 20 m** begleitet. So zählt ein Überqueren an der Kreuzung nicht als ganze Seitenstraße
- GPS-Punkte mit Ungenauigkeit über 25 m werden verworfen, Lücken unter 60 s werden verbunden
- **Fortbewegung (automatisch, korrigierbar):** bis 7 km/h zu Fuß · 7–30 km/h Rad · über 30 km/h Auto (zählt nur, wenn eingeschaltet, mit eigenem Wert) · Bus und Bahn werden nicht erkannt; im Zweifel trennst du die Fahrt selbst ab

### Werte je Gebiet

- **Straßen-%** = gesehene Länge ÷ gesamte zählende Länge
- **km gesehen / km gesamt**
- **Straßen komplett** = Straßen mit Namen, die zu mindestens 90 % gesehen sind
- **Gebiete** aus OSM-Verwaltungsgrenzen: Land (2) → Bundesland (4) → Kreis/Stadt (6/8) → Stadtbezirk (9) → Stadtteil (10). Köln: 9 Bezirke, 86 Stadtteile. Im Ausland nimmt die App die Ebenen, die es dort gibt

---

## 3. Phasen mit Definition of Done

> Regel: immer nur eine Phase gleichzeitig. Jede Phase endet mit einem Test draußen.

### Phase 0: Fundament (1 Sitzung)
- Repo `streifzug`, Ordner wie in Abschnitt 4, Prüfungen bei jedem Push (Lint, Tests, Build)
- Supabase-Projekt (EU, Frankfurt), Anmeldung per Mail-Link, Zugriffsregeln je Nutzer:in (Row Level Security)
- Web-App auf Cloudflare Pages
- **DoD:** leere App ist online und auf dem iPhone-Homescreen; Anmeldung klappt; automatisch veröffentlicht

### Phase 1: Prozent-Jagd in Köln (Web-App, MVP, 4–6 Sitzungen)

| Schritt | Inhalt | DoD |
|---|---|---|
| 1a Straßendaten | Laden über Overpass, Filter nach Abschnitt 2, 25-m-Stücke, Gebiete, km-Summen je Gebiet | Köln, Lindenthal und Weiden haben plausible km-Summen (Gegenprobe mit 3 bekannten Straßen) |
| 1b Karte | MapLibre-Karte, Straßen grau, Grenzen der Stadtteile, eigener Standort | Karte flüssig auf dem iPhone, Weiden vollständig sichtbar |
| 1c Aufzeichnen | Knopf „Losziehen“: Standort laufend, Bildschirm bleibt an, Fortbewegung erkannt, offline gepuffert, später hochgeladen | 30-Minuten-Runde ohne Lücken aufgezeichnet, auch kurz offline |
| 1d Abgleich und Prozent | Abgleich auf dem Handy, Stücke speichern, Fortschritt je Gebiet, Liste „Gebiete“, Detailseite, Nebel-Karte | Nach einer Runde stimmen Prozent und km (Stichprobe 3 Straßen) |
| 1e Neue Städte | Betrittst du ein unbekanntes Gebiet, lädt die App es automatisch | Test mit einer zweiten Stadt (z. B. Freising) |
| 1f Teilen | Bild je Gebiet (Kartenausschnitt, %, km), Privatzone ums Zuhause wird ausgeblendet | Bild über das iPhone-Teilen-Menü verschickt, Haus nicht erkennbar |

**Abschluss Phase 1:** 2 Wochen draußen genutzt. Notiert werden Spaßfaktor, GPS-Qualität und Akku.

### Phase 2: Import der Vergangenheit (2–3 Sitzungen)
- GPX (Komoot, Garmin, Strava-Export), Apple-Health-Export (Workout-Routen), Google-Maps-Zeitachse (JSON)
- Später direkte Strava-Verbindung (nur mit Zustimmung, API-Regeln prüfen)
- **DoD:** Vorhandene Wege importiert; Prozentwerte steigen nachvollziehbar; keine Doppelzählung

### Phase 3: iPhone-App mit Hintergrund-Aufzeichnung (4–6 Sitzungen + 2 Wochen Test)
- Expo (React Native), Anmeldung, Karte und Abgleich aus `packages/core` wiederverwendet
- Hintergrund-Ortung: erst ein **einwöchiger Akku-Test**, dann Entscheidung zwischen `expo-location` (kostenlos) und Transistorsoft Background Geolocation (bewegungsgesteuert, sehr akkuschonend; für Android kostenpflichtig)
- Startet automatisch, wenn du gehst oder Rad fährst; pausiert im Stillstand
- Verteilung über TestFlight (Apple-Entwicklerkonto nötig)
- **DoD:** 14 Tage ohne App-Öffnen aufgezeichnet; Akku-Mehrverbrauch unter 5 % pro Tag; keine verlorenen Wege

### Phase 4: Produkt-Funktionen (laufend, nach Lust)
- Abzeichen (25/50/75/100 % je Stadtteil), Serien, Rückblick je Monat und Reise
- „Nächste Runde“: Vorschlag mit den meisten neuen Straßen ab Standort
- Freund:innen: Fortschritt vergleichen, Stadtteil-Duelle, gemeinsame Karte
- Offline-Städte für Reisen (vorher herunterladen)
- Später vielleicht: Orte freischalten (Spielplätze, Cafés, Sehenswürdigkeiten)

### Phase 5: Start im App Store (siehe BUSINESSPLAN.md)
- Name und Marke, Datenschutzerklärung, Impressum, Kontolöschung in der App, Anmeldung mit Apple
- Store-Auftritt (Screenshots, Texte, Stichworte), Begründung der Hintergrund-Ortung für Apples Prüfung
- Abo über RevenueCat, Android über Expo

---

## 4. Technik (skalierbar von Tag 1)

### Aufbau (ein Repo, mehrere Teile)
```
streifzug/
  packages/core/     TypeScript: OSM → Stücke, Abgleich, Prozent, Regeln (mit Tests)
  apps/web/          Web-App: Vite + React + TypeScript + MapLibre GL JS (PWA)
  apps/mobile/       ab Phase 3: Expo (React Native) + MapLibre Native
  supabase/          Datenbank-Migrationen, Zugriffsregeln, Edge Functions
  docs/              Plan, Businessplan, Entscheidungen
```

### Bausteine

| Baustein | Wahl | Warum |
|---|---|---|
| Logik | `packages/core` in TypeScript | Web und iPhone nutzen denselben Code; mit Tests abgesichert |
| Web-App | React + Vite + MapLibre GL JS | gleiche Denkweise wie später in Expo; große Community |
| Karte | OpenFreeMap (kostenlos, ohne Schlüssel) | später bei Bedarf eigene Kacheln (Protomaps) oder MapTiler |
| Straßen und Gebiete | OSM über Overpass, je Gebiet einmal verarbeitet und gespeichert | später eigene Verarbeitung aus Geofabrik-Extrakten, sobald viele Städte nötig sind |
| Datenbank, Anmeldung | Supabase (Postgres + PostGIS, Auth, Storage), Region Frankfurt | Geodaten-Abfragen, Zugriffsregeln je Nutzer:in, später Anmeldung mit Apple; skaliert bis zu einem echten Produkt |
| Hosting Web | Cloudflare Pages | kennst du schon von Lohmis |
| iPhone | Expo + EAS (Build, TestFlight, Updates) | eine Codebasis für iOS und später Android |
| Fehler und Messung | später Sentry und einfache Produkt-Kennzahlen | erst ab der Testphase mit Freund:innen |

### Datenmodell (vereinfacht)
- `areas` (id, osm_id, name, admin_level, parent_id, geom, total_m)
- `segments` (id `way:n`, area_ids, geom, length_m, kind, name)
- `user_segments` (user_id, segment_id, first_seen_at, mode): **nur die IDs der gesehenen Stücke**, klein und schnell
- `user_area_progress` (user_id, area_id, seen_m, segments_seen, updated_at): vorberechnet für schnelle Listen
- `tracks` (id, user_id, started_at, ended_at, mode, distance_m, file_path): **Rohdaten komprimiert als Datei** im Speicher, nicht als Millionen Tabellenzeilen
- `privacy_zones` (user_id, center, radius_m)

### Prinzipien, damit es skaliert
1. **Mehrere Nutzer:innen ab Tag 1:** jede Tabelle mit `user_id` und Zugriffsregel, auch wenn erst nur du drin bist
2. **Abgleich auf dem Handy:** Server-Kosten bleiben fast null; die Rohdaten müssen dafür nicht zum Server (Datenschutz als Verkaufsargument)
3. **Feste Stück-IDs:** Fortschritt bleibt erhalten, auch wenn Straßendaten aktualisiert werden (Abgleich bei OSM-Änderungen)
4. **Gebietspakete als Dateien:** Je Stadt eine komprimierte Datei, später über ein CDN verteilt, weltweit günstig
5. **Texte von Anfang an in einer Sprachdatei** (Deutsch zuerst, Englisch für den App Store später)
6. **Export und Löschen** der eigenen Daten jederzeit (DSGVO, App-Store-Pflicht)

---

## 5. Risiken und Gegenmittel

| Risiko | Gegenmittel |
|---|---|
| Web-App zeichnet nur bei offener App auf | Bewusst: Phase 1 testet nur den Spaß. Hintergrund kommt in Phase 3 |
| GPS ungenau in engen Straßen | 20-m-Abstand, 60-%-Regel, Ungenaues verwerfen; Werte in Phase 1 an echten Runden einstellen |
| Akku | Phase 3 mit Akku-Test und bewegungsgesteuerter Ortung |
| Overpass-Grenzen (öffentlicher Dienst) | Gebiete nur einmal laden und speichern; später eigene Verarbeitung |
| OSM-Lizenz (ODbL) | Namensnennung „© OpenStreetMap-Mitwirkende“; abgeleitete Straßendaten bleiben unter ODbL (Rechtliches vor dem Start prüfen) |
| Apple lehnt Hintergrund-Ortung ab | Klarer Nutzen im Text, nur bei Bewegung aktiv, Ortungs-Hinweis sichtbar, keine Werbe-SDKs |
| Supabase-Gratisprojekt pausiert nach 7 Tagen ohne Nutzung | Für dich egal (du nutzt es); für ein Produkt Pro-Tarif (ca. 25 $/Monat) |

---

## 6. Design (Vorschlag)

**Idee: „Die Stadt aus dem Nebel holen.“** Die Karte ist der Star, alles andere hält sich zurück.

- **Startbildschirm = Karte**, darüber ein unteres Blatt wie in Apple Karten: aktueller Stadtteil, großer Prozentwert, Knopf „Losziehen“
- **Untere Leiste mit drei Reitern:** Karte · Gebiete · Ich
- **Nebel:** Unentdecktes liegt unter einem warmen, papierartigen Schleier. Entdeckte Straßen leuchten in **Signalorange** (#FF5A1F); entdeckte Stadtteile werden klarer
- **Farben hell:** Papier #F5F2EA, Nebel #E6E1D6, Text #1C1B19, Akzent #FF5A1F, Erfolg #2F9E6E
- **Farben dunkel:** Nachtblau #0F1720, Nebel #1C2632, entdeckte Straßen leuchten orange (wirkt nachts wie Laternen)
- **Schrift:** Systemschrift des iPhones (SF Pro), Zahlen gleich breit; Prozentwerte groß und selbstbewusst
- **Gebiete-Liste:** je Zeile Name, Fortschrittsring, km; aufklappbar Stadt → Bezirk → Stadtteil
- **Gebiet-Detail:** Prozent, km gesehen/gesamt, Straßen komplett, „fehlt noch“ (Top 10 nächste Straßen), Teilen
- **Belohnung:** kurzer, edler Effekt, wenn ein Stück freigeschaltet wird, und bei 25/50/75/100 %; abschaltbar, ruhig bei „Bewegung reduzieren“
- **Sprache:** Deutsch, Du-Form, keine Emojis, kurze Texte; Gendern mit Doppelpunkt

---

## 7. Was Michi braucht

| Wann | Was | Kosten |
|---|---|---|
| Jetzt | Leeres privates GitHub-Repo `streifzug` anlegen (das darf ich hier nicht selbst) | 0 € |
| Jetzt | Supabase-Konto (supabase.com), Projekt „streifzug“, Region Frankfurt; Zugangsschlüssel nur über die sichere Eingabe, nie im Chat | 0 € |
| Jetzt | Cloudflare-Pages-Projekt mit dem neuen Repo verbinden (wie bei Lohmis) | 0 € |
| Phase 3 | Apple-Entwicklerkonto, Expo-Konto, TestFlight auf dem iPhone, Xcode auf dem Mac | 99 $/Jahr |
| Phase 5 | Domain, Gewerbe-Anmeldung, Datenschutz/Impressum, Supabase Pro | siehe Businessplan |

---

## 8. Skills im Projekt

39 geprüfte Skills liegen in `.claude/skills/` (Übersicht und Quellen: `.claude/skills/README.md`). Schwerpunkte: Planung und Umsetzung in kleinen Schritten, UI/UX und Design, React und React Native, Expo/EAS bis zum App Store, Supabase/Postgres, Sicherheit, Barrierefreiheit, Start und Launch.
