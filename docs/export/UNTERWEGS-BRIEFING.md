# Unterwegs – Briefing für eine unabhängige Zweitmeinung und einen Bauplan

Stand: 21.11.2026 · Verfasst für ein frisches Claude-Gespräch ohne Vorwissen. Alles Nötige steht in diesem Dokument; die Bilder liegen im Ordner `bilder/`, ergänzende Originaldokumente im Ordner `anhang/`.

---

## 0. Auftrag an dich (bitte zuerst lesen)

Du bekommst eine private App, die seit wenigen Tagen in Arbeit ist und funktioniert. Der Besitzer (Michi, Köln-Weiden, kein Entwickler, arbeitet mit Claude Code an der App) möchte **externes Feedback mit frischem Blick** und am Ende **einen Bauplan**, den er wieder in sein Entwicklungs-Gespräch einfügt.

Bitte:
1. **Kritisch prüfen:** Idee, Aufbau der App, Bedienung, Design, Technik, Datenbasis. Was ist gut, was würdest du anders machen, was fehlt, was ist zu viel? Die App darf **komplett anders aufgebaut** werden (siehe Abschnitt 6).
2. **Neue Anforderungen einarbeiten** (Abschnitt 6): Auto-Farbe und Übermalen, Abzeichen-Sammlung, Animationen, ganz Deutschland mit Vierteln, später weltweit, nur „echte“ Straßen zählen, Einstellungen versteckt, schlank und modern, nicht nach KI aussehend.
3. **Datenbasis bewerten** (Abschnitt 7): Ist die heutige Quelle die beste? Welche Alternativen für Deutschland und später die Welt?
4. **Bauplan liefern** im Format aus Abschnitt 9, so konkret, dass ein Entwickler-Claude ihn Schritt für Schritt umsetzen kann.

Wenn dir Informationen fehlen, triff eine begründete Annahme, markiere sie mit **[ANNAHME]** und arbeite weiter. Antworte auf Deutsch, Du-Form, keine Emojis.

---

## 1. Die Idee in drei Sätzen

**Unterwegs** zeichnet auf, wo man zu Fuß und mit dem Rad war, und markiert jede abgelaufene Straße auf der Karte wie mit einem **gelben Textmarker** auf einem Papier-Stadtplan. Die App zeigt, wie viel Prozent der Straßen eines **Viertels** (z. B. Köln-Weiden), eines Bezirks und einer Stadt man schon „entdeckt“ hat. Ziel ist der Spaß, die eigene Umgebung Straße für Straße zu erkunden, mit Belohnungen, Sammeln und schönen Momenten.

## 2. Für wen und wozu

- **Jetzt:** nur für Michi (Familie mit zwei kleinen Kindern, viel zu Fuß und mit dem Rad in Köln, Urlaube in anderen Städten).
- **Später vielleicht:** Produkt im App Store (zuerst Deutschland, Österreich, Schweiz, dann international), Freemium-Abo. Das ist eine Option, kein Muss.
- **Grundsätze (bisher):** automatisch vor manuell; das kleinste Gebiet vorn (Weiden 7 % motiviert, Köln 0,1 % nicht); Gelb ist nur für Entdecktes da; Daten privat, exportier- und löschbar.

## 3. Was die App heute kann (Stand 21.11.2026)

Live als Web-App (PWA, auf dem iPhone-Homescreen) unter `https://streifzug.pages.dev`. Technische Namen heißen noch „streifzug“ (früherer Arbeitstitel).

### 3.1 Bildschirme (Bilder in `bilder/`)

| Bild | Was man sieht |
|---|---|
| `01-karte.png`, `01-karte-dunkel.png` | **Startseite = Karte.** Ruhiger eigener Kartenstil „Stadtplan“ (weiße Straßen auf Nebelgrau, Schrift in Tinte), gelb markierte Straßen, leichter **Nebel** über Unentdecktem. Unten ein **Blatt** mit Viertelname (Weiden), Eltern (Lindenthal, Köln), großem Prozentwert auf Textmarker-Strich, Fortschrittsbalken, km-Angabe, Hinweis „Weißer Fleck“ und Knopf **„Losziehen“**. Oben rechts runde Knöpfe: Profil, Standort. Untere Leiste: Karte · Gebiete · Streifzüge |
| `02-weisser-fleck.png` | **„Weißer Fleck“:** nächste unentdeckte Straße (vom Standort oder der Viertelmitte), „Zeigen“ markiert sie gestrichelt. **Michi versteht diese Funktion nicht** (siehe Anforderungen) |
| `03-gebiete.png` | **Gebiete:** nur freigeschaltete Städte, aufklappbar Stadt → Bezirk → Viertel, je mit Mini-Balken, Prozent und km |
| `04-logbuch.png` | **Streifzüge (Logbuch):** jede eigene Runde mit Mini-Stadtplan (grau, gelb, Spur), „+947 m neu in Weiden · 4,4 auf 7,8 %“, neue Straßennamen, **Meilenstein-Stempel** (1/5/10/25/50/75/100 %), nach Monaten gruppiert |
| `05-profil.png` | **Profil:** oben „Automatisch aufzeichnen“ (Overland verbinden), dann Schalter (Fuß- und Radwege mitzählen, Autofahrten mitzählen, Nebel), GPX-Import, Konto |
| `06-rueckblick.png` | **Rückblick beim Öffnen:** Wurde seit dem letzten Besuch etwas aufgezeichnet, fährt ein Punkt mit Textmarker-Spur die neuen Wege ab; Banner „Seit deinem letzten Besuch: 1 Weg · 2,8 km“ mit „Überspringen“. **Problem:** zoomt heute auf den ganzen Ausschnitt, zu weit weg |
| `07-unterwegs-modus.png` | **Beim Aufzeichnen:** Blatt klappt ein, Zähler oben „+274 m neu · 3 Straßen“, neue Straße wird mit Textmarker-Animation gezogen, „Frechener Weg +25 m“ steigt auf |
| `08-nach-der-runde-stempel.png` | **Nach der Runde:** Zusammenfassung und „+249 m neu entdeckt in Weiden, von 0 auf 0,8 %“; ab 1 % kommt ein Stempel |
| `09-iphone-michi-eingekreiste-strassen.jpg` | **Echtes iPhone-Bild von Michi:** eingekreist sind Straßen/Wege, die er nicht ablaufen kann (Zufahrten, Hof- oder Privatwege). Sie sollen **nicht** in die Prozente zählen |

### 3.2 Wie aufgezeichnet wird

1. **Selbst in der App („Losziehen“):** GPS, solange die App offen ist (Web-Apps dürfen auf dem iPhone im Hintergrund kein GPS nutzen). Bildschirm bleibt an. Wird live abgeglichen.
2. **Automatisch im Hintergrund über die kostenlose iPhone-App „Overland“** (Open Source, Aaron Parecki): Sie zeichnet dauerhaft auf und schickt Punkte (GeoJSON, Pakete à 200, mit iOS-Bewegungsart `motion` wie walking/cycling/automotive) an eine eigene Empfangsstelle (Supabase Edge Function). Unterwegs holt die Punkte beim Öffnen, beim Zurückkehren und alle 5 Minuten ab. Stand: eingerichtet, **es sind aber noch keine Punkte angekommen** (wird gerade geklärt).
3. **Import von GPX-Dateien** (z. B. Apple-Health-Workouts). Ein Google-Zeitachsen-Import gab es kurz, er wurde wieder entfernt (große Dateien ließen die App einfrieren, Michi wollte die Google-Daten nicht mehr).
4. **Geplant (Phase 3):** eigene iPhone-App (Expo/React Native) mit Hintergrund-Ortung, ersetzt Overland. Braucht Apple-Entwicklerkonto.

### 3.3 Wie gezählt wird (heutige Regeln)

- **Straßennetz:** OpenStreetMap-Daten aus den Vektorkacheln von OpenFreeMap (Schema OpenMapTiles, Zoomstufe 14). Straßen werden in Stücke von ca. 25 m geteilt.
- **Zählt immer:** `residential`, `living_street`, `unclassified`, `tertiary`, `secondary`, `primary` (+ `_link`), `trunk` (ohne Kraftfahrstraße), `pedestrian` (Fußgängerzone).
- **Zählt nur mit Schalter:** Fuß- und Radwege (`footway`, `cycleway`, `path`, `steps`, `bridleway`), außer Gehwege direkt an der Straße.
- **Zählt nie:** `motorway`, Kraftfahrstraßen, `service` (Einfahrten, Parkplätze, Zufahrten), `track` (Feldwege), `access=private|no`, Baustellen, Flächen.
- **Zwei Fahrbahnen** einer Straße zählen je zur Hälfte.
- **„Gesehen“:** mindestens 60 % eines Stücks lagen höchstens 20 m seitlich neben der Spur, und die Spur lief in Straßenrichtung (±45°). Lücken über 60 s werden nicht überbrückt (bei Importen dürfen Punkte bis 60 m auseinander liegen).
- **Fortbewegung** je Runde nach Median-Tempo: bis 7,2 km/h zu Fuß, bis 30 km/h Rad, darüber Auto. Autofahrten zählen nur mit Schalter.
- **Prozent** = gesehene Meter / alle zählenden Meter eines Gebiets.
- **Bekannte Schwäche:** Die OpenMapTiles-Kacheln vereinfachen die OSM-Tags (z. B. fehlen `access=private` und `service=*` teilweise, Hofwege sind oft als `residential` erfasst). Deshalb zählen manche Wege mit, die man nicht ablaufen kann (siehe Bild 09). In Weiden liegen rund um die gezählten Straßen viele kurze `service`-Wege (11–290 m), die bereits **nicht** zählen; welche OSM-Objekte genau die eingekreisten Stücke sind, ist noch zu prüfen.

### 3.4 Gebiete

- Gebaut für: **Köln** (86 Stadtteile in 9 Bezirken), Freising, Hameln, Emmerthal, New York City (Boroughs).
- Grenzen aus **Overture Maps (Divisions)**, Straßen-km je Gebiet vorberechnet (Skript `npm run region -- "<Ort>"`), als Dateien in der App.
- Neue Orte werden heute **von Hand per Skript** aufgenommen. Ganz Deutschland gibt es noch nicht.

### 3.5 Design heute („Textmarker auf dem Stadtplan“)

- **Farben:** Tinte (Kugelschreiber-Blau) `#1E2A4A` für Text und Knöpfe, Nebelgrau `#E9ECEF`, Fläche Weiß, **Textmarker-Gelb `#FFE14A`** als einziges Lautes. Dunkelmodus: Nebel `#12161C`, Fläche `#1B2129`, Gelb bleibt.
- **Schrift:** Barlow (an Straßenschilder angelehnt), Zahlen in Barlow Condensed.
- **Bausteine:** Karte mit Blatt unten (herunterziehbar), runde Kartenknöpfe, Stempel im Pass-Stil, Mini-Stadtpläne als SVG, Nebel als Canvas über der Karte.
- **Animationen:** Textmarker-Strich beim Entdecken, Glanz, aufsteigendes „+25 m“, Stempel-Bewegung, Rückblick-Fahrt. Alles ruhig bei „Bewegung reduzieren“.
- **Michis Urteil:** Es soll **cooler, moderner und schlanker** werden und **nicht nach KI aussehen**.

## 4. Technik heute

| Baustein | Heute |
|---|---|
| Monorepo | `packages/core` (TypeScript, Logik mit 135 Tests: Zählregeln, Abgleich, GPX, Meilensteine), `apps/web` (Vite + React + TypeScript + MapLibre GL JS, PWA), `supabase/` |
| Karte | MapLibre, OpenFreeMap (Positron-Daten, eigene Farben), eigene Ebenen für Gelb, Nebel (Canvas), Spur, Rückblick |
| Abgleich | in einem **Web Worker** (Hintergrund-Strang), Ergebnis je Runde in IndexedDB gespeichert, damit nichts hängt |
| Speicher auf dem Gerät | IndexedDB (Runden mit Rohpunkten), localStorage (Einstellungen) |
| Server | Supabase (Postgres, EU/Irland): anonyme Anmeldung, Tabellen mit Zeilenschutz, Storage für Rohspuren, Edge Function `overland` (Empfang), Tabellen `receive_tokens` (nur Prüfsumme des Schlüssels), `received_points` |
| Hosting | Cloudflare Pages, automatisch bei jedem Push |
| Kosten heute | 0 € (Gratis-Tarife); Produkt: Supabase Pro ca. 25 $/Monat, Apple 99 €/Jahr |

**Datenfluss:** GPS (App oder Overland) → Rohpunkte → Runden (Pause > 10 min oder Sprung > 300 m trennt) → Abgleich mit Straßenstücken der Kacheln → gesehene Stücke → Meter je Gebiet (Punkt-im-Polygon, alle Ebenen) → Prozente, Gelb, Logbuch, Stempel.

**Lehren aus den letzten Tagen (wichtig für den Bauplan):**
- Große Datenmengen (Google-Zeitachse mit Tausenden Wegen) ließen die Web-App einfrieren. Lösung: alles Schwere im Worker, Ergebnisse pro Runde speichern, Oberfläche lädt nur eigene Runden.
- `push(...riesigeListe)` und `Math.min(...liste)` sprengen bei Zehntausenden Punkten den Stapelspeicher.
- Web-Apps können auf dem iPhone **nicht** im Hintergrund aufzeichnen. Dauerhaft automatisch geht nur mit nativer App (oder Overland als Brücke).
- Die Entwicklungsumgebung (Claude Code in der Cloud) kann Overpass, Geofabrik und manche Behörden-Server nicht erreichen; Datenaufbereitung sollte über GitHub Actions oder einen eigenen Job laufen.

## 5. Was gut funktioniert und was nicht (Michis Sicht, verdichtet)

- **Gut:** Gelb auf der Karte, Prozent je Viertel, Textmarker-Idee, Stempel, Logbuch, Overland-Idee.
- **Nicht gut:** „Weißer Fleck“ unverständlich; Rückblick zu weit herausgezoomt; nicht ablaufbare Wege zählen mit; zu viele Einstellungen sichtbar; Design noch nicht „cool“ genug; einzelne Fehler beim Import haben die App blockiert.

## 6. Neue Anforderungen von Michi (21.11.2026)

Bitte als verbindlich behandeln; Reihenfolge = keine Priorität.

**Fortbewegung und Farben**
1. **Zu Fuß und Rad zählen** in die Prozente. **Alles, was schneller als Rad ist, gilt als „Auto“**, auch Bahn und Bus. Alles Langsamere als Rad ist „zu Fuß/Rad“.
2. **Auto bekommt eine eigene Farbe** auf der Karte. Wird eine Straße später zu Fuß oder mit dem Rad abgelaufen, wird sie **mit Gelb übermalt** (Gelb hat Vorrang).
3. **Autobahnen und alle Straßen** sollen bei Autofahrten sichtbar sein (in der Auto-Farbe), auch wenn sie nicht in die Fuß/Rad-Prozente zählen.
4. **Textmarker-Farbe und Auto-Farbe** sind in den Einstellungen änderbar (Gelb bleibt Standard).
5. Die Einteilung sollte **innerhalb einer Runde** wechseln können (zu Fuß zum Bahnhof, dann Bahn = Auto, dann zu Fuß). Overland liefert dazu die iOS-Bewegungsart `motion`. **[Vorschlag aus dem Entwicklungs-Gespräch, bitte bewerten]**

**Was zählt**
6. **Nur normale Straßen** zählen. Keine Hofeinfahrten, Zufahrten, Privat- oder Hofwege (siehe Bild 09). Bitte eine Regel und Datenquelle vorschlagen, die das zuverlässig trennt.
7. Immer auf das **kleinste Viertel** herunterbrechen (Köln-Weiden, nicht nur Bezirk Lindenthal).

**Ganz Deutschland, später die Welt**
8. **Ganz Deutschland** abbilden, **mit Vierteln**, ohne großen Aufwand. Muss nicht alles in der App liegen (nachladen erlaubt). Später **weltweit** für Urlaube (neue Stadt betreten, Gebiete und Straßen kommen automatisch).

**Belohnung und Sammeln**
9. **Abzeichen/Awards** sammeln, z. B. „Du hast 25 % von Weiden gesehen“, **Erkunder-Awards** (neue Viertel, neue Straßen pro Woche, Serien …), mit **Bezug zum Viertel**.
10. Eine **Sammlung („Pocket“)**, in der man die Abzeichen ansieht und Prozente je Viertel nachschauen kann.
11. **Coole Animationen** (beim Entdecken, bei Abzeichen, beim Rückblick).

**Rückblick**
12. Wird nachträglich etwas eingespielt (App war zu), soll die App das beim Öffnen **nachfahren**: **nah herangezoomt auf Straßenebene**, die Kamera folgt der Spur, sodass man die Straßen mitverfolgen kann. Nicht aus großer Entfernung. Überspringbar.

**Aufbau und Stil**
13. Die App darf **komplett anders aufgebaut** sein; dein Ermessen.
14. **Schlank (lean).** Einstellungen müssen **nicht** sichtbar sein, gern in einem Untermenü versteckt.
15. **Modern, nach heutigen Standards, nicht nach KI aussehend.**
16. Den **„Weißen Fleck“** versteht Michi nicht: entweder verständlich machen, umbenennen oder streichen.

## 7. Datenbasis: Optionen (Recherche 21.11.2026, bitte prüfen und entscheiden)

### 7.1 Straßennetz

| Option | Vorteile | Nachteile |
|---|---|---|
| **A. OpenFreeMap-Vektorkacheln** (heute) | kostenlos, weltweit, kein Server nötig, schnell | OpenMapTiles-Schema verliert Tags (`access`, `service`, `foot`, Hofwege), keine Garantie auf Verfügbarkeit, z14 leicht vereinfacht |
| **B. Eigene Aufbereitung aus OSM-Rohdaten** (Geofabrik-Auszug Deutschland, ca. 4,5 GB `.osm.pbf`; Planet ca. 35+ GB) | alle Tags → genaue Regeln (privat, Zufahrten, Hofwege), eigene Stücke und Gebiets-Summen, unabhängig | Rechenjob nötig (z. B. GitHub Actions, osmium/DuckDB, monatlich), Speicher (Cloudflare R2), Pflege |
| **C. Overture Maps „Transportation“** | weltweit einheitlich, bereinigt, Parquet-Dateien | basiert auf OSM, Tags teils zusammengefasst; prüfen, ob `access`/`service` ausreichend erhalten bleiben |
| **D. Eigene Kacheln (Protomaps/PMTiles auf R2)** aus OSM | volle Kontrolle über Inhalt und Kartenstil, günstig auszuliefern | Aufbau- und Pflegeaufwand |

**Einschätzung aus dem Entwicklungs-Gespräch:** B (für die Zählung) plus weiter A oder D (für die Darstellung). Die Zählung braucht die vollen OSM-Tags, sonst bleiben Hofwege falsch.

### 7.2 Gebiete (Viertel)

| Quelle | Abdeckung | Hinweise |
|---|---|---|
| **OSM `admin_level` 9/10** | Stadtteile vieler Städte (Köln: Lindenthal = 9 „Ortsteil“) | in Deutschland **uneinheitlich**, Lücken je nach Stadt |
| **Overture Divisions** (heute genutzt) | weltweit, Ebenen bis `neighborhood`/`microhood` | laut Doku „oft lückenhaft“ unterhalb der Kreis-Ebene |
| **BKG VG250** (amtlich) | ganz Deutschland bis **Gemeinde**, Lizenz dl-de/by-2-0, ca. 110 MB | keine Stadtteile |
| **Städtische Open Data** (z. B. Köln) | genaue Stadtteile | je Stadt anders, teils gesperrt für automatische Abrufe |

**Idee für „ganz Deutschland ohne großen Aufwand“:** Gerüst aus VG250 (Bundesland → Kreis → Gemeinde, vollständig und amtlich), darunter Viertel aus OSM 9/10 bzw. Overture, wo vorhanden; sonst bleibt die Gemeinde die kleinste Ebene. Gebiets-Summen per monatlichem Job, Dateien nach Region auf R2, die App lädt nur, wo man ist. **Weltweit:** gleiche Pipeline, Grenzen aus Overture, Städte bei Bedarf bauen (Betreten einer neuen Stadt stößt den Job an). **[bitte bewerten]**

## 8. Offene Fragen, die du entscheiden oder abwägen sollst

1. Web-App weiter ausbauen oder **früh auf native iPhone-App** wechseln (Hintergrund-Ortung, Animationen, Widgets)?
2. **Overland als Brücke** behalten oder direkt Phase 3?
3. Wie die Fortbewegung **pro Abschnitt** zuverlässig erkennen (Tempo, `motion`, Glättung)?
4. Welche **Abzeichen** (Liste, Stufen, Seltenheit), welche Sammlungs-Ansicht?
5. Welche **Navigationsstruktur** (Anzahl Reiter, Startseite, wo die Sammlung)?
6. Welche **Datenpipeline** (Werkzeuge, Häufigkeit, Speicherort, Kosten)?
7. Wie **lean** ist lean: Was fliegt raus (z. B. Nebel, Weißer Fleck, Logbuch-Details)?

## 9. Bitte so liefern: der Bauplan

Gib den Bauplan als **ein Markdown-Dokument** zurück, mit genau diesen Abschnitten, damit er direkt in das Entwicklungs-Gespräch eingefügt werden kann:

1. **Kurzurteil** (5–10 Stichpunkte: was bleibt, was ändert sich, warum)
2. **Produktbild:** Zielgruppe, Kernversprechen, 3–5 Prinzipien
3. **Aufbau der App:** Navigation, alle Bildschirme mit Zweck und Inhalt, Zustände (leer, laden, unterwegs, Rückblick, offline)
4. **Design-System:** Farben (mit Hex, hell/dunkel), Schrift, Abstände, Ecken, Karte-Stil, Ikonografie, 2–3 Beispiel-Bildschirme beschrieben; was „nicht nach KI aussehen“ konkret heißt
5. **Animationen:** jede Animation mit Auslöser, Dauer, Ablauf, Verhalten bei „Bewegung reduzieren“
6. **Regeln:** Was zählt (OSM-Tags), Fortbewegung (Schwellen, pro Abschnitt), Farben und Übermalen, Prozente, Abzeichen (Liste mit Bedingungen)
7. **Datenbasis und Pipeline:** Quellen, Verarbeitung, Speicher, Aktualisierung, Deutschland-Ausbau, weltweit
8. **Technik-Architektur:** Web vs. nativ, Module, Datenmodell (Tabellen/Felder), Hintergrund-Ortung, Speicher, Sync
9. **Umsetzungsphasen:** je Phase Ziel, Aufgaben, **Definition of Done**, grobe Größe (S/M/L), Abhängigkeiten
10. **Risiken und Gegenmaßnahmen**
11. **Offene Entscheidungen für Michi** (mit deiner Empfehlung)

---

## Anhang

- `bilder/` – aktuelle Bildschirme (Abschnitt 3.1)
- `anhang/PLAN.md` – bisheriger Produkt- und Umsetzungsplan (Phasen, Zählregeln, Technik, Design)
- `anhang/entscheidungen.md` – alle Entscheidungen mit Datum (neueste oben)
- `anhang/IDEEN.md` – Ideenliste
- `anhang/UX-KONZEPT.md` – drei frühere UX-Entwürfe (Karte zuerst, Sammelalbum, Logbuch) mit Bewertung
- `anhang/BUSINESSPLAN.md` – Geschäftsseite (Freemium, Stufen, Wettbewerb: Wandrer, CityStrides, Fog of World)

Quellen zur Datenbasis: Overture Divisions Guide (docs.overturemaps.org/guides/divisions), OSM-Wiki DE:Tag:admin_level=9, Geofabrik Europa-Downloads (download.geofabrik.de/europe.html), BKG VG250 Nutzungsbedingungen (sgx.geodatenzentrum.de, dl-de/by-2-0).
