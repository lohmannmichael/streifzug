# Unterwegs: Bauplan Fassung 3 (Umbauplan)

Stand 22.11.2026. Grundlage: der Code-Stand `unterwegs-stand-2026-11-22.zip`, die Live-App (nur leer angesehen, ohne echte Wege) und das Gespräch mit Michi vom 22.11.

**Wie dieses Dokument zu lesen ist**

- Fassung 2 (`docs/PLAN.md`) gilt weiter für Zählregeln, Datenbasis, Pipeline und Design-System. Wo Fassung 3 etwas anderes sagt, gilt Fassung 3.
- Fassung 3 ersetzt in Fassung 2: Abschnitt 3 (Aufbau), die Reihenfolge der Phasen in Abschnitt 9 und die Stempel-Stufen für „Anzahl Veedel“ in 6.5.
- Annahmen sind mit **[ANNAHME]** markiert. Was ich im Code gesehen habe, steht mit Dateiname da. Was ich nur vermute, steht als Vermutung da.
- Die App ist bis auf Weiteres nur für Michi. Monetarisierung, öffentlicher Start und native Apple-App stehen im Backlog (Abschnitt 8), nicht im Plan.

---

## 1. Kurzurteil

Das Fundament ist gut: Der Plan sieht dem Zielbild ähnlich, die Zählregeln sind ein eigener, getesteter Baustein. Die App ist aber noch nicht verlässlich und nicht ruhig genug in der Bedienung.

Die fünf Schwächen, nach Gewicht:

1. **Vertrauen fehlt.** Das Konto hing am Gerät und ging am 21.11. verloren. Bleibt Overland stehen, merkt man es nicht. Falsch erkannte Abschnitte (Rad/Auto) lassen sich nicht korrigieren.
2. **Das Blatt ist hakelig.** Ziehen geht nur am Kopf (`.blatt-zug`), der Inhalt (`.blatt-inhalt`) scrollt nur und zieht das Blatt nie zu. Das Blatt folgt dem Finger nicht, es springt erst beim Loslassen ab 36 Pixeln (`Blatt.tsx`, Zeilen um 109).
3. **Zu viel auf einmal.** Im Blatt stehen Dinge, die Michi nicht braucht. Menü und Reiter führen doppelt zu denselben Seiten.
4. **Die Oberfläche ist ungetestet.** `packages/core` hat Tests, `apps/web` keinen einzigen. `Karte.tsx` hat über 700 Zeilen und mischt Zeichnen, Tippen, Rückblick und Animation.
5. **Reste.** Im Repo liegen Skills, Texte und Notizen zu einer nativen iPhone-App, zu alten Reitern und zu verworfenen Funktionen. Das lenkt den Entwicklungs-Chat in falsche Richtungen.

Leitlinie für den Umbau: **erst verlässlich, dann ruhig, dann neu.** Bis Etappe D abgeschlossen ist, wird nichts Neues gebaut.

---

## 2. Entscheidungen vom 22.11.2026

| Thema | Entscheidung |
|---|---|
| Konto | Anmeldung per Mail mit Code. Einmal anmelden, angemeldet bleiben. Kein Passkey, kein „Mit Apple anmelden“. Englische Mail ist vorerst in Ordnung. |
| Apple-Entwicklerkonto | Weiterhin nein. Die App bleibt eine Web-App auf dem Homescreen. |
| Aufzeichnung | Bleibt Overland. Die App zeigt, ob Punkte ankommen. |
| Zuhause-Zone | Kommt weg. |
| Blatt für ein Viertel | Nur Name, Prozent, Kilometer, Stempelkarte. „Zuletzt“, „Noch offen“ und „Mit offener App aufzeichnen“ entfallen. |
| Menü | Ein Knopf „Pass“. Der Pass hat vier Bereiche, jeder mit eigener Seite: Orte, Stempel, Rückblicke, Einstellungen. |
| Pass-Kopf | Drei Zahlen: Kilometer in Gelb, Orte, Länder. Keine Viertel-Zahl. |
| Wörter | „Veedel“ nur bei Köln. Überall sonst „Viertel“. Eigene Wörter anderer Orte später. |
| Orte | Jeder Ort ist von überall erreichbar (Freising von Köln aus). Reisen fassen Orte und Zeitraum zusammen. |
| Stempelpass | Je Viertel nur der beste Stempel, dazu Sonderstempel. |
| Rückblick beim Öffnen | Näher heran, je Weg einzeln, Strich fährt den Weg nach. Alle Wege des Tages. Dünne Linie für den ganzen Weg, neues Gelb dick. Autofahrten schnell. |
| Monatsrückblick | „Dein November“ als schneller Zeitraffer mit schmalem Strich, in der App. Speichern als Video nicht jetzt. **[ANNAHME]**, Michis Satz dazu war nicht eindeutig. |
| Ja, aber später | Zeitreise, Straße komplett, Deutschland-Blick, Abschnitt umstellen (früh), Runde vorschlagen (spät). |
| Raus | Spielplatz-Checkliste. „Nächstes Ziel“ bleibt verworfen. |
| Backlog | Poster, Import überarbeiten, native App, Monetarisierung. |

---

## 3. Zielbild: Aufbau der App

Bilder dazu: `Plan.png`, `Viertel.png`, `Stempelpass.png`, `Pass-kurz.png`, `Orte.png`.

### 3.1 Plan (Startbildschirm)

- Vollflächiger Plan, darunter das Blatt.
- Zwei runde Knöpfe oben rechts: **Pass** und **Standort**. Sonst nichts auf dem Plan.
- Der Quellenhinweis („© OpenStreetMap“) steht als kleine graue Zeile am unteren Planrand direkt über dem Blatt. Der „i“-Knopf oben links entfällt. Die lange Fassung steht unter Einstellungen → Über. Ganz weglassen geht nicht, OpenStreetMap verlangt die Nennung am Plan.
- Tipp auf ein Viertel wählt es fürs Blatt. Tipp auf eine Straße zeigt das Etikett (wie gebaut).

### 3.2 Blatt

Zwei Höhen statt drei:

| Höhe | Inhalt |
|---|---|
| klein | Name, Unterzeile (Bezirk · Stadt), Prozent |
| halb | dazu: Kilometer („3,2 von 28,3 km“), Stempelkarte, bei Bedarf eine Statuszeile (siehe 3.7) |

Die volle Höhe gibt es nicht mehr. Alles, was bisher dort lag, wandert in den Pass.

Verhalten:

- Das Blatt folgt dem Finger und rastet beim Loslassen auf der näheren Höhe ein. Eine schnelle Wischbewegung reicht, auch wenn sie kurz ist.
- Die ganze Kopfzeile ist Griff.
- Auf halber Höhe passt der Inhalt ohne Scrollen. Wenn doch gescrollt wird und der Inhalt am Anfang steht, zieht eine Wischbewegung nach unten das Blatt zu.
- Ein Tipp auf den Plan klappt das Blatt auf klein.

Stempelkarte: sechs Felder (betreten, 10, 25, 50, 75, 100 %). Erreichte Felder zeigen den Stempel in Tinte, offene sind leer. Keine „noch x km“-Texte in den Feldern.

### 3.3 Pass

Eine Seite über dem Plan, mit Schließen-Knopf. Oben die drei Zahlen, darunter vier große Zeilen mit je einem kleinen Bild und einem Satz:

| Zeile | Satz darunter (Beispiel) | öffnet |
|---|---|---|
| Orte | „Köln · Freising · Algarve“ | 3.4 |
| Stempel | „9 Stempel · zuletzt Weiden 25 %“ | 3.5 |
| Rückblicke | „Diese Woche · November · 2026“ | 3.6 |
| Einstellungen | „Aufzeichnung läuft · letzter Punkt vor 12 Min.“ | 3.7 |

### 3.4 Orte

Drei Gruppen, jede Zeile mit Mini-Plan:

- **Zuhause:** der Ort mit den meisten Wegen (Köln), mit Prozent.
- **Weitere Orte:** alle anderen Orte mit Daten, mit Prozent und „zuletzt Okt. 2026“.
- **Reisen:** siehe F6. Bis dahin gibt es diese Gruppe nicht.
- **Wird vorbereitet:** Orte ohne Daten, mit gegangenen Kilometern.

Tipp auf einen Ort: Der Pass schließt, der Plan fährt zum Ort, das Blatt zeigt den Ort als Ganzes. Von dort lassen sich Viertel antippen. Im Blatt eines Ortes gibt es eine Zeile „Viertel“ zum Aufklappen (Bezirke, darunter Viertel mit Prozent).

### 3.5 Stempel

- Eine Seite je Ort, wie eine Passseite. Je Viertel nur der höchste erreichte Stempel.
- Sonderstempel auf einer eigenen Seite am Anfang.
- Kein „Als Nächstes“.

### 3.6 Rückblicke

- Oben drei Kacheln zum Abspielen: Diese Woche, aktueller Monat, aktuelles Jahr.
- Darunter die Tage, neueste zuerst: „Samstag, 21. Nov. · 3 Wege · 1,4 km neu“. Tipp spielt den Tag ab.
- Später: Zeitreise (F3).
- „Letzte Wege“ als eigener Menüpunkt entfällt, das ist diese Liste.

### 3.7 Einstellungen

Vier Zeilen, jede mit eigener Unterseite:

| Zeile | Inhalt |
|---|---|
| Stifte | Textmarker-Farbe, Kuli-Farbe, „Jedes Jahr eine Farbe“ (wie gebaut) |
| Aufzeichnung | Status, letzter Punkt, Anleitung für Overland, Verbindung trennen |
| Konto | Mail-Adresse, Abmelden, Exportieren |
| Über | Kartendaten, Lizenzen, Version, Zustand |

Statuszeile im Blatt: Kam seit 24 Stunden kein Punkt, steht im halben Blatt eine Zeile „Seit gestern 18:40 keine Punkte von Overland“ mit Tipp zur Unterseite Aufzeichnung. Sonst steht dort nichts.

### 3.8 Wörter

- Die unterste Ebene heißt im Programm überall „Viertel“.
- Ein Ort kann in seiner Datei (`regionen/<id>.json`) ein eigenes Wort tragen. Vorerst nur Köln: „Veedel“.
- Texte, die mehrere Orte zusammenfassen, sagen „Viertel“ oder zählen Orte und Länder.

---

## 4. Arbeitsregeln für den Umbau

1. **Ein Schritt, ein Commit, eine Live-Version.** Nach jedem Schritt läuft die App auf streifzug.pages.dev.
2. **Nichts Neues vor Etappe F.** Fällt unterwegs eine Idee auf, kommt sie in `docs/IDEEN.md`.
3. **Erst lesen, dann ändern.** Vor jedem Schritt die genannten Dateien lesen und in einem Satz sagen, was geändert wird.
4. **Fertig heißt geprüft.** Jeder Schritt hat „Fertig, wenn“. Dazu gehört immer: `npm run typecheck`, `npm test`, `npm run build` grün, und die Oberflächentests ab E1.
5. **Michi prüft am iPhone**, was unter „Michi prüft“ steht. Erst danach beginnt der nächste Schritt.
6. **Entscheidungen** kommen mit Datum in `docs/entscheidungen.md`, der Stand in `docs/STAND.md`.
7. **Daten sind heilig.** Kein Schritt löscht Rohdaten, Konten oder Dateien im Bucket `spuren`. Migrationen, die Spalten oder Tabellen entfernen, erst nach Michis Ja.
8. **Bei Supabase-Auth, MapLibre und Workbox gegen die aktuelle Dokumentation arbeiten**, nicht aus dem Gedächtnis.

---

## 5. Die Schritte

### Etappe A: Sichern

#### A1 Repo und Notizen bereinigen

Ziel: Der Entwicklungs-Chat findet keine Hinweise mehr auf eine native App oder alte Aufbauten.

1. Aus `.claude/skills/` entfernen: `expo-*`, `eas-*`, `react-native-*`. Lizenzdateien in `_lizenzen/` entsprechend ausdünnen.
2. `docs/STAND.md` neu schreiben: nur noch der aktuelle Stand und die Etappen aus diesem Dokument. Die alten Notizen nach `docs/archiv/` verschieben.
3. In `docs/STAND.md` und `CLAUDE.md` die Sätze zu „iPhone-App“, „Phase 3 vorziehen“ und „Mit Apple anmelden“ streichen.
4. Dieses Dokument als `docs/PLAN-3.md` ablegen und in `CLAUDE.md` als geltenden Plan nennen.
5. Die fünf Bilder nach `docs/design/` legen.

Fertig, wenn: Eine Suche nach „Expo“, „EAS“, „iPhone-App“ und „Apple anmelden“ im Repo außerhalb von `docs/archiv/` nichts mehr findet.

#### A2 Konto per Mail-Code

Ziel: Michis bestehendes anonymes Konto bekommt eine Mail-Adresse. Auf einem neuen Gerät ist nach der Anmeldung alles wieder da.

Vorab klären (Dokumentation lesen, dann Michi kurz berichten):

- Kann die Bestätigungs-Mail im kostenlosen Tarif den **Code** enthalten? Ein Link reicht nicht: Er öffnet sich in Safari, und Safari teilt seinen Speicher nicht mit der App auf dem Homescreen. Die Anmeldung würde im falschen Fenster landen.
- Falls der Code im kostenlosen Tarif nicht geht: eigenen Mail-Versand anbinden (SMTP-Dienst mit Freikontingent). Das ist dann eine Entscheidung für Michi, weil ein weiterer Dienst dazukommt.
- Wie stark ist der eingebaute Mail-Versand gedrosselt?

Bauen:

1. Unterseite Einstellungen → Konto: Feld für die Mail-Adresse, Knopf „Code schicken“, danach Feld für den sechsstelligen Code.
2. **Verknüpfen statt neu anlegen:** Ist eine anonyme Sitzung da, wird die Adresse an dieses Konto gehängt (Supabase: anonymes Konto um eine Mail-Identität erweitern). Die Nutzer-ID bleibt gleich. **[ANNAHME]** zur genauen Aufruffolge, bitte gegen die Dokumentation prüfen.
3. **Anmelden auf neuem Gerät:** Auf dem Startbildschirm ohne Daten eine Zeile „Schon ein Konto? Anmelden“. Anmeldung darf kein neues Konto anlegen, wenn die Adresse unbekannt ist, sondern sagt das.
4. Hat das neue Gerät schon ein frisches anonymes Konto mit Wegen und meldet sich dann mit einer bekannten Adresse an: nachfragen, ob die Wege von diesem Gerät ins Konto übernommen werden sollen. Nie stillschweigend verwerfen.
5. Nach der Anmeldung: Overland-Verbindung, eigene Wege und Einstellungen vom Server holen (der Weg dafür existiert seit dem 21.11.).
6. Sitzung bleibt bestehen (Auffrischen der Sitzung eingeschaltet lassen). `navigator.storage.persist()` bleibt.
7. Abmelden mit Rückfrage. Abmelden löscht keine Daten auf dem Server.
8. Text „Du nutzt Unterwegs ohne Konto …“ in `texte/de.ts` anpassen.

Fertig, wenn:
- Test mit zwei Browser-Profilen: Profil 1 anonym mit Testweg, Mail verknüpfen, Nutzer-ID unverändert. Profil 2 meldet sich mit derselben Adresse an und sieht denselben Weg.
- Falscher Code, abgelaufener Code und unbekannte Adresse zeigen je einen verständlichen deutschen Satz.
- Testkonten danach gezielt löschen (Regel aus `CLAUDE.md`).

Michi prüft: am iPhone Adresse eintragen, Code eingeben. Danach in Safari (nicht in der App) streifzug.pages.dev öffnen, anmelden, dieselben gelben Straßen sehen.

#### A3 Exportieren

Ziel: Michi kann jederzeit alles mitnehmen.

1. Einstellungen → Konto → „Alles exportieren“.
2. Erzeugt eine Zip-Datei: alle Wege als GPX (eine Datei je Weg), dazu eine JSON-Datei mit Einstellungen, Ausnahmen („Hier komme ich nicht hin“) und vergebenen Stempeln mit Datum.
3. Läuft im Hintergrund-Worker, zeigt Fortschritt, öffnet am Ende den Teilen-Dialog von iOS (Sichern in „Dateien“).

Fertig, wenn: Die exportierten GPX-Dateien sich über den bestehenden GPX-Import in ein leeres Testkonto einlesen lassen und dieselben Kilometer ergeben.

---

### Etappe B: Blatt

#### B1 Inhalt kürzen

1. In `seiten/Blatt.tsx` aus dem halben Blatt entfernen: „Zuletzt“, „Noch offen, nächste zuerst“, „Jetzt mit offener App aufzeichnen“, die Zeile „Deine Städte und Veedel“, „Automatisch aufzeichnen einrichten“ (wandert in Einstellungen → Aufzeichnung; solange Overland nicht verbunden ist, zeigt stattdessen die Statuszeile aus C1 darauf).
2. Stempelkarte: Texte „noch x km“ aus den Feldern nehmen. Erreichte Felder zeigen den Stempel (`ui/Stempel.tsx`, klein), offene Felder nur die Stufe in Grau.
3. Die Berechnung von „Noch offen“ nicht mehr starten, wenn sie nur dafür lief. Den Code noch nicht löschen (kommt in D8).
4. Der erste Satz „Geh eine Straße entlang. Sie wird gelb.“ bleibt, solange 0 %.

Fertig, wenn: Das halbe Blatt bei 390 × 844 ohne Scrollen passt, mit und ohne Stempel.

#### B2 Zwei Höhen, Blatt folgt dem Finger

1. Höhe 3 entfernen. Typ `Hoehe` auf 1 | 2. Alles, was bei Höhe 3 gezeigt wurde (`Sammlung`), ist vorübergehend über das bestehende Menü erreichbar, bis D1 fertig ist.
2. Ziehen neu: Während der Finger auf dem Blatt liegt, wird die Höhe direkt gesetzt (per `transform` oder Höhe in Pixeln, ohne Übergang). Beim Loslassen rastet das Blatt auf der näheren Höhe ein, mit kurzem Übergang (etwa 200 ms).
3. Schnelle Wischbewegung: Liegt die Geschwindigkeit beim Loslassen über etwa 0,5 Pixel je Millisekunde, gewinnt die Richtung, egal wie weit gezogen wurde.
4. Griff ist der ganze Kopf (Name und Prozent), nicht nur der Strich.
5. „Bewegung reduzieren“: ohne Übergang einrasten.
6. Der Knopf am Griff bleibt für Tastatur und VoiceOver.

Fertig, wenn: Auf einem Touch-Gerät lässt sich das Blatt mit einer kurzen, schnellen Bewegung in beide Richtungen umschalten, und es klebt beim langsamen Ziehen am Finger.

#### B3 Herunterziehen aus dem Inhalt

1. Liegt der Finger im Inhalt und steht der Inhalt am Anfang (`scrollTop` 0), wird eine Bewegung nach unten als Ziehen am Blatt behandelt.
2. Ist der Inhalt gescrollt, scrollt er normal.
3. Tipp auf den Plan setzt das Blatt auf klein. Ausnahme: Der Tipp trifft ein Viertel oder eine Straße, dann wie bisher.

Fertig, wenn: Kein Fall mehr übrig ist, in dem man im Blatt nach unten wischt und nichts passiert.

Michi prüft (B1 bis B3 zusammen): zehnmal auf- und zuziehen, auch einhändig mit dem Daumen, auch direkt nach dem Öffnen der App.

---

### Etappe C: Vertrauen

#### C1 Statuszeile der Aufzeichnung

1. Der Server kennt den letzten empfangenen Punkt (Tabelle `received_points`). Die App holt den Zeitpunkt beim Öffnen und alle fünf Minuten mit.
2. Zustände:
   - Overland nicht verbunden: Zeile „Automatisch aufzeichnen einrichten“.
   - Letzter Punkt jünger als 24 Stunden: keine Zeile im Blatt. In Einstellungen: „läuft · letzter Punkt vor 12 Min.“
   - Älter als 24 Stunden: Zeile im Blatt „Seit gestern 18:40 keine Punkte von Overland“ mit Tipp zur Unterseite.
3. Unterseite Aufzeichnung bekommt eine Prüfliste für diesen Fall:
   - In Overland „Pause Updates Automatically“ ausschalten.
   - „Significant Location“ auf „Enabled“.
   - iPhone: Standort für Overland auf „Immer“, „Genauer Standort“ an.
   - Hintergrundaktualisierung für Overland an.
   - Stromsparmodus aus.
   - Overland im App-Umschalter nicht schließen.
4. Die Anleitung zum Einrichten bleibt, klappt aber ein, sobald verbunden.

Die ersten beiden Punkte der Prüfliste stützen sich auf die Beschreibung der Overland-Einstellungen. Die übrigen sind übliche iOS-Ursachen und für Overland nicht belegt.

Fertig, wenn: Mit einem Testkonto, dessen letzter Punkt künstlich 30 Stunden alt ist, die Zeile erscheint und nach einem neuen Punkt verschwindet.

#### C2 Abschnitt umstellen

1. In Rückblicke → Tag antippen → Weg-Ansicht: Der Weg ist in seine Abschnitte geteilt (`packages/core/src/legs.ts`), jeder mit Art (zu Fuß, Rad, gefahren), Länge, Dauer.
2. Tipp auf einen Abschnitt: „war zu Fuß / war Rad / war gefahren“.
3. Die Korrektur wird als eigene kleine Liste gespeichert (Weg-ID, Abschnitt, neue Art), auf dem Gerät und im Konto. Die Rohdaten bleiben unverändert.
4. Beim Einrechnen hat die Korrektur Vorrang vor der Erkennung. Tests in `legs.test.ts` ergänzen.
5. Nach einer Korrektur wird nur der betroffene Weg neu eingerechnet, Stempel werden nie zurückgenommen (Regel aus Fassung 2).

Fertig, wenn: Ein als „gefahren“ erkannter Testabschnitt nach der Korrektur gelb ist, die Prozente steigen und die Korrektur einen Neustart und eine Neuanmeldung übersteht.

Michi prüft: an einem echten falsch erkannten Abschnitt.

#### C3 Fehler und Wartezustände

1. Text „Bitte Screenshot an Claude“ ersetzen durch einen Satz, was passiert ist, und einen Knopf „Nochmal versuchen“. Die technische Meldung steht klein darunter und unter Einstellungen → Über → Zustand.
2. Öffnen der App, Reihenfolge festlegen:
   - Plan und letzter bekannter Stand erscheinen sofort.
   - Neue Punkte werden abgeholt und eingerechnet. Im Blatt steht solange eine ruhige Zeile „3 neue Wege werden eingerechnet …“.
   - Erst wenn das Einrechnen fertig ist, startet der Rückblick. Dauert es länger als 8 Sekunden, bleibt der Plan bedienbar, und der Rückblick wird als Knopf „Rückblick ansehen“ im Blatt angeboten statt von selbst zu starten.
3. Lädt der Kartendienst nicht: graue Fläche mit Satz „Der Plan lädt gerade nicht. Deine Wege sind sicher.“ und Knopf „Nochmal“.
4. Ohne Netz: App startet aus dem Speicher, Statuszeile „Offline. Neue Wege kommen, sobald Netz da ist.“

Fertig, wenn: Alle vier Zustände in den Oberflächentests (E1) nachgestellt sind. Bis E1 steht: von Hand mit gedrosseltem und abgeschaltetem Netz prüfen.

#### C4 Zuhause-Zone entfernen

1. Oberfläche: `seiten/Zuhause.tsx` und den Eintrag in den Einstellungen entfernen, Texte `zuhause` aus `texte/de.ts`.
2. Server: Die Edge Function `overland` verwirft keine Punkte mehr.
3. Vor dem Entfernen prüfen, ob für Michis Konto eine Zone gesetzt ist. Wenn ja: Michi sagen, dass die verworfenen Punkte nicht wiederkommen, und die Zone erst dann löschen.
4. Tabelle und Spalten bleiben vorerst stehen (Regel 7). Entfernen in D8 nach Michis Ja.

Fertig, wenn: Ein Testpunkt innerhalb der früheren Zone ankommt und gespeichert wird.

---

### Etappe D: Aufbau

#### D1 Pass mit vier Bereichen

1. Neuer Knopf „Pass“ oben rechts, ersetzt „…“. Zeichen: ein kleines Heft. **[ANNAHME]**, ein Zeichen ist nicht entworfen.
2. Seite `seiten/Pass.tsx` nach Bild `Pass-kurz.png`: Titel, Schließen, drei Zahlen, vier Zeilen.
3. Zahlen: Kilometer in Gelb (alle aktiven Meter, auch in Orten ohne Daten), Orte (mit mindestens einem aktiven Meter), Länder.
4. Das Menü mit den vier Einträgen und die Reiter „Städte · Stempelpass“ entfallen.
5. Navigation: Pass → Unterseite → zurück zum Pass. Wischen vom linken Rand geht zurück. Schließen führt immer zum Plan.

Fertig, wenn: Jede Unterseite mit höchstens zwei Tipps vom Plan aus erreichbar ist und es keinen zweiten Weg dorthin gibt.

#### D2 Orte

1. Seite `seiten/Orte.tsx` nach Bild `Orte.png`, ohne die Gruppe „Reisen“.
2. „Zuhause“ ist der Ort mit den meisten aktiven Metern.
3. Mini-Plan je Ort: SVG ohne Kartenkacheln (so wie früher im Logbuch gelöst, siehe `docs/entscheidungen.md` vom 20.11.).
4. Tipp auf einen Ort: Pass schließt, Plan fährt zum Ort (`fitBounds` auf die Ortsgrenze), Blatt zeigt den Ort.
5. Blatt für einen Ort (neu): Name, Prozent, Kilometer, darunter Zeile „Veedel“ bzw. „Viertel“ zum Aufklappen mit Bezirken und Vierteln. Tipp auf ein Viertel wählt es.
6. „Wird vorbereitet“ wie gebaut, als eigene Gruppe am Ende.

Fertig, wenn: Mit Testwegen in Köln und Freising beide Orte erscheinen und sich von Köln aus Freising öffnen lässt, ohne den Plan von Hand zu verschieben.

#### D3 Stempelpass: nur die besten

1. `packages/core/src/stamps.ts`: neue Funktion „beste Stempel“, die je Viertel nur den höchsten Prozent-Stempel liefert und „betreten“ nur dann, wenn noch kein Prozent-Stempel erreicht ist. Die vergebenen Stempel bleiben vollständig gespeichert, es ändert sich nur die Anzeige.
2. Stufen für „Anzahl“ neu:
   - `ORTE_ANZAHL` 5, 10, 25, 50 (Orte mit aktivem Meter, über alles).
   - `LAENDER_ANZAHL` 2, 3, 5, 10.
   - Die Kölner Reihe 5, 10, 25, 50, 86 bleibt als Stempel des Ortes Köln („5 VEEDEL“). Die letzte Stufe ist nicht mehr fest 86, sondern „alle Viertel dieses Ortes“.
   - Bereits vergebene Stempel mit altem Schlüssel `veedel-anzahl:<n>` werden dem Ort Köln zugeordnet, nicht gelöscht.
3. Seite `seiten/Stempel.tsx`: erste Seite Sonderstempel, dann eine Seite je Ort. Stempel leicht gedreht und versetzt wie im Bild `Stempelpass.png`.
4. „Als Nächstes“ entfällt.
5. Tests in `stamps.test.ts` für die neue Auswahl und die Umstellung der Schlüssel.

Fertig, wenn: Ein Viertel mit 25 % genau einen Stempel zeigt und nach Erreichen von 50 % genau einen anderen.

#### D4 Rückblicke als Liste

1. Seite `seiten/Rueckblicke.tsx`: Liste der Tage mit Wegen, neueste zuerst, je Zeile Datum, Zahl der Wege, neue Strecke.
2. Tipp auf einen Tag: Pass schließt, der bestehende Rückblick spielt nur diesen Tag.
3. Langer Tipp oder Pfeil rechts: Weg-Ansicht aus C2.
4. Die drei Kacheln oben kommen erst mit F2. Bis dahin beginnt die Seite mit der Liste.
5. Der Menüpunkt „Letzte Wege“ und seine Ansicht entfallen.

Fertig, wenn: Jeder Tag der letzten 30 Tage abspielbar ist und nach dem Abspielen der normale Stand wieder stimmt.

#### D5 Einstellungen

1. Startseite mit vier Zeilen, je eine Unterseite (3.7).
2. „Importieren“ zieht unter Konto, als unauffällige Zeile „Alte Wege importieren (GPX)“. Überarbeitung des Imports ist Backlog.
3. „Zustand (für Claude)“ zieht unter Über und heißt „Zustand“.

#### D6 Quellenhinweis

1. Den „i“-Knopf oben links entfernen.
2. Kleine graue Zeile „© OpenStreetMap“ am unteren Planrand, direkt über dem Blatt, tippbar (führt zu Über). Sie wandert mit dem Blatt mit.
3. Mindestgröße der Tippfläche 44 Punkte Höhe, auch wenn die Schrift klein ist.

Fertig, wenn: Der Hinweis in beiden Blatt-Höhen sichtbar ist und nichts überdeckt.

#### D7 Wörter

1. `regionen/koeln.json` bekommt `"wortViertel": { "eins": "Veedel", "viele": "Veedel" }`. Fehlt das Feld, gilt „Viertel“.
2. `scripts/region.ts` reicht das Feld in `regionen/index.json` durch.
3. `texte/de.ts`: alle festen „Veedel“ ersetzen. Texte innerhalb eines Ortes nehmen das Wort des Ortes als Parameter, alle anderen sagen „Viertel“.
4. Stempel-Aufschrift nimmt das Wort des Ortes in Großbuchstaben.

Fertig, wenn: Die Suche nach „Veedel“ in `apps/web/src` nur noch Treffer in Tests findet und Freising „Viertel“ zeigt.

#### D8 Altes entfernen

Erst nach Michis Ja zu jeder Zeile:

| Entfernen | Wo |
|---|---|
| Texte der alten Reiter „Gebiete“, „Streifzüge“ | `texte/de.ts` |
| „Noch offen“ samt Berechnung, „Weißer Fleck“ | `Blatt.tsx`, `packages/core/src/ziele.ts` (nur wenn sonst ungenutzt) |
| „Losziehen“ mit offener App, Unterwegs-Modus | `daten/aufzeichnung.ts`, `daten/unterwegs.ts`, Texte |
| Nebel über Unentdecktem, falls noch vorhanden | `karte/` |
| Zuhause-Zone: Tabelle, Spalten | neue Migration |
| Text „Im Hintergrund zeichnet erst die iPhone-App auf“ | `texte/de.ts` |

Hinweis zu „Losziehen“: Ohne diesen Weg zeichnet die App nur noch über Overland auf. Fällt Overland aus, gibt es keinen Ersatz. **Empfehlung:** die Funktion im Code lassen, aber nur unter Einstellungen → Aufzeichnung als „Jetzt mit offener App aufzeichnen“ anbieten.

Fertig, wenn: Der Build keine ungenutzten Exporte mehr meldet (Prüfung mit einem Werkzeug wie `knip`, einmalig).

Michi prüft (Etappe D zusammen): eine Woche normal benutzen und aufschreiben, wo er sucht.

---

### Etappe E: Robust

#### E1 Oberflächentests

1. Playwright einrichten (`apps/web/e2e/`), Gerät iPhone-Größe mit Touch, Standort und Netz steuerbar.
2. Ein fester Testdatensatz: drei Wege in Weiden, einer in Freising, eine Autofahrt. Der Server wird im Test ersetzt, kein echtes Konto.
3. Abläufe, mindestens:
   - Erster Start leer: Satz erscheint, kein Fehler.
   - Start mit Daten: Gelb auf dem Plan, Prozent im Blatt stimmt mit der erwarteten Zahl.
   - Karte lädt verzögert: Gelb ist danach trotzdem da (Fehler vom 20.11.).
   - Blatt auf, zu, schnell wischen, aus dem Inhalt herunterziehen.
   - Pass → Orte → Freising → Plan zeigt Freising.
   - Rückblick läuft, Tipp überspringt, Endstand stimmt.
   - Netz aus, Kartendienst aus, Einrechnen schlägt fehl (C3).
4. In `.github/workflows/check.yml` aufnehmen.

Fertig, wenn: Die Tests in der Prüfung auf GitHub laufen und ein absichtlich eingebauter Fehler (Gelb nicht zeichnen) sie rot macht.

#### E2 Karte aufteilen

`karte/Karte.tsx` (über 700 Zeilen) in Teile mit je einer Aufgabe, ohne Verhalten zu ändern:

- Karte aufbauen und Stil laden
- Ebenen für Gelb, Rot, Grenzen zeichnen und aktualisieren
- Tippen (Viertel, Straße, Etikett)
- Kamera (zum Standort, zum Gebiet)
- Zeichen-Moment und Rückblick

Fertig, wenn: Keine Datei unter `karte/` mehr als etwa 250 Zeilen hat und die Tests aus E1 unverändert grün sind.

#### E3 Tempo mit einem Jahr Daten

1. Zuerst beantworten und in `docs/entscheidungen.md` festhalten: Rechnet die App beim Öffnen alles neu oder nur neue Wege? Was passiert bei einer neuen `ABGLEICH_VERSION`?
2. Künstlichen Datensatz erzeugen: 365 Tage, je drei Wege, etwa 400.000 Punkte, Köln und Umgebung.
3. Messen auf einem gedrosselten Gerät (Chrome, vierfach verlangsamte CPU): Zeit bis Plan sichtbar, bis Gelb sichtbar, bis Einrechnen fertig, Speicherverbrauch.
4. Ziele: Plan mit letztem Stand unter 2 Sekunden. Einrechnen eines normalen Tages unter 3 Sekunden. Vollständiges Neurechnen darf lange dauern, läuft aber im Hintergrund mit Fortschritt und blockiert nichts. **[ANNAHME]** zu den Zahlen, bei Bedarf anpassen.
5. Wenn die Ziele verfehlt werden: Ergebnis je Weg zwischenspeichern (gesehene Stücke mit erstem Datum), beim Öffnen nur neue Wege rechnen.

Fertig, wenn: Die Messwerte in `docs/entscheidungen.md` stehen und die Ziele erreicht sind.

#### E4 Orte nur bei Bedarf laden

1. In `vite.config.ts` aus `globPatterns` entfernen: `regionen/**/*.json` und `geojson`. Vorab geladen wird nur noch `regionen/index.json`.
2. Die Dateien eines Ortes werden geladen, wenn der Plan in seine Grenzen kommt, wenn dort Wege liegen oder wenn der Ort im Pass geöffnet wird. Danach bleiben sie auf dem Gerät (Zwischenspeicher mit Obergrenze).
3. `regionen/index.json` bekommt je Ort Land und Mittelpunkt, damit Pass und Orte-Liste ohne die großen Dateien auskommen.

Fertig, wenn: Ein frischer Start nur Köln lädt und Freising erst beim Öffnen. Voraussetzung für mehr als etwa 50 Orte.

---

### Etappe F: Neues

Reihenfolge nach Michis Gewicht. Jeder Schritt einzeln, mit Michis Blick dazwischen.

#### F1 Rückblick: näher heran, nachfahren

Ändert `karte/rueckblick.ts` und `packages/core/src/replay.ts`. Ersetzt die Regel „alle Wege auf einmal im Bild“.

1. **Je Weg einzeln**, in zeitlicher Reihenfolge. Alle Wege seit dem letzten Besuch, nicht nur die mit Neuem.
2. **Bildausschnitt je Weg:**
   - Passt der ganze Weg bei Zoom 15,5 oder näher aufs Bild (über dem Blatt), steht die Karte still.
   - Sonst fährt die Karte mit: Zoom 16, die Strichspitze liegt bei etwa 40 % der Strecke vom hinteren Bildrand, sodass voraus mehr zu sehen ist. Die Bewegung ist geglättet, keine Rucke an Ecken. Norden bleibt oben.
3. **Strich:**
   - Dünne Linie in Tinte (etwa 2 Pixel) für den ganzen Weg, sie wächst mit der Spitze.
   - Wo Neues dazukommt, legt sich das Gelb dick darüber, im selben Takt.
   - Schon gelbe Straßen bleiben gelb, die dünne Linie läuft sichtbar darüber.
   - Autofahrten: rote Kuli-Linie, achtfach so schnell, Karte weiter herausgezoomt (ganzer Abschnitt im Bild), kein Mitfahren.
4. **Tempo:** gleichmäßig auf dem Bildschirm, nicht nach echter Zeit. Gesamtdauer höchstens 20 Sekunden: Sind es viele Wege, läuft jeder schneller. Mindestens 2 Sekunden je Weg mit Neuem, 1 Sekunde je Weg ohne.
5. **Zwischen zwei Wegen** ein harter Schnitt, kein Flug.
6. **Ende:** herauszoomen auf das Viertel mit dem meisten Neuen, dann zählt die Zahl hoch (wie gebaut).
7. **Bedienung:** Tipp überspringt alles. Gedrückt halten spult dreifach.
8. „Bewegung reduzieren“: kein Mitfahren, kein Wachsen. Der Endstand je Weg erscheint für eine Sekunde.

Fertig, wenn: Mit dem Testdatensatz (drei Wege, eine Autofahrt) die Reihenfolge stimmt, der Endstand dem normalen Stand gleicht und die Dauer unter 20 Sekunden bleibt.

Michi prüft: an drei echten Tagen. Frage an ihn: nah genug, zu schnell, zu langsam?

#### F2 „Dein November“ und die Kacheln

1. Rückblicke bekommt oben drei Kacheln: Diese Woche, laufender Monat, laufendes Jahr. Vergangene Monate stehen als Zeilen zwischen den Tagen („Oktober 2026 · 9,1 km neu“).
2. Ablauf: weiter herausgezoomt (alle Wege des Zeitraums im Bild, je Ort ein eigener Abschnitt), alle Wege in zeitlicher Reihenfolge, schmaler gelber Strich, etwa 10 Sekunden. Oben läuft das Datum mit.
3. Am Ende steht alles Neue des Zeitraums gelb, darunter drei Zahlen: neue Kilometer, komplette Straßen, neue Stempel.
4. Beim ersten Öffnen im neuen Monat erscheint im Blatt eine Zeile „Dein November ist fertig“ mit Tipp zum Abspielen. Kein automatischer Start.
5. Kein Speichern als Video.

#### F3 Zeitreise

1. Rückblicke → „Zeitreise“: der Plan mit einem Schieber am unteren Rand, von erstem Tag bis heute, in Monatsschritten mit freiem Ziehen dazwischen.
2. Beim Ziehen zeigt der Plan nur, was bis zu diesem Tag gelb war. Grundlage: das erste Datum je Straßenstück, das schon gespeichert wird.
3. Prozent des gewählten Viertels läuft mit.

#### F4 Straße komplett

1. Ist eine benannte Straße innerhalb eines Ortes vollständig gelb, wird ihr Name auf dem Plan mit dem Textmarker unterlegt.
2. Ist ein Viertel bei 100 %, wird seine Fläche fein schraffiert.
3. Im Etikett einer Straße: „komplett seit 21. Nov. 2026“.
4. Grundlage ist die Zählung „Straßen komplett“, die es für den Stempel schon gibt.

#### F5 Deutschland-Blick

1. Unter Zoom 9: keine Viertel-Flächen mehr. Stattdessen alle Wege als feine Linien (Gelb aktiv, Rot gefahren), vereinfacht, und je Ort mit Daten ein Punkt mit Namen.
2. Tipp auf einen Punkt öffnet den Ort.
3. Die vereinfachten Linien werden beim Einrechnen einmal erzeugt und gespeichert, nicht bei jedem Zeichnen.

#### F6 Reisen

1. Regel: Eine Reise beginnt, wenn Wege mehr als 100 km von Zuhause entfernt liegen und zwischen dem ersten und letzten mindestens eine Nacht liegt. Sie endet mit dem ersten Weg zurück im Umkreis. **[ANNAHME]**, die Schwellen legt Michi fest.
2. Name: die Gegend aus den Daten (größtes gemeinsames Gebiet der besuchten Orte), umbenennbar.
3. Orte-Seite bekommt die Gruppe „Reisen“ nach Bild `Orte.png`: Name, Zeitraum, Orte, Kilometer.
4. Tipp: Plan zeigt alle Orte der Reise, das Blatt bietet „Rückblick dieser Reise“.
5. Reisen aus der Zeit vor dem 19.11.2026 gibt es nur über importierte Wege.

#### F7 Stempel für Orte und Länder

1. Jeder Ort mit aktivem Meter bekommt einen Stempel „betreten“ (rechteckig, mit Datum), auch ohne Viertel-Daten.
2. Jedes Land bekommt einen Stempel wie im Reisepass (Länderkürzel, Datum der ersten Einreise).
3. Dazu die Stufen aus D3.

---

## 6. Mehr Orte, ganz Deutschland, Ausland

So wie heute gebaut: Ein Befehl (`npm run region -- "<Ort>"`) nimmt einen Ort in einer Claude-Sitzung auf, mit Prüfung. Jeder Ort kostet etwas Guthaben. Ganz Deutschland sind rund 10.800 Gemeinden.

| Stufe | Was | Voraussetzung | Kosten |
|---|---|---|---|
| 1, läuft | Nach Bedarf: Orte von der Wunschliste (`region_wishes`) zu Beginn jeder Sitzung aufnehmen | keine | wenig je Ort |
| 2 | Umkreis auf einen Schlag: alle Gemeinden einer Gegend in einem Durchlauf, Prüfung nur als Stichprobe | E4 | einmal mittel |
| 3 | Ganz Deutschland automatisch: die eigene Verarbeitung aus Fassung 2 (Abschnitt 7), läuft ohne Claude | E3, E4 | einmal spürbar, danach keine |

Ob die kostenlosen Rechner für Stufe 3 reichen, ist eine **[ANNAHME]**.

Viertel in anderen Orten, in dieser Reihenfolge:

1. Grenzen aus OpenStreetMap, wenn sie mindestens 90 % des Ortes abdecken.
2. Offizielle Daten der Stadt, wo frei verfügbar. Handarbeit, nur für Orte, in denen Michi oft ist.
3. Ersatz-Viertel aus den Ortsnamen auf der Karte, als „ungefähr“ gekennzeichnet.
4. Sonst nur der Ort als Ganzes.

Bekannte Qualität heute: Köln vollständig (86), Freising teilweise, Emmerthal 2 von etwa 19, New York nur Boroughs.

Ausland: Ort und Prozent gehen fast überall, echte Viertel nur bei guten Daten. Stempel für Ort und Land (F7) gehen immer.

---

## 7. Die App jemand anderem geben

Technisch möglich, sobald A2 fertig ist. Vorher nötig:

1. **Einladungs-Code** bei der ersten Anmeldung, damit sich niemand Fremdes anmelden kann.
2. **„Erste Schritte“** mit Bildern für Overland (die App ist englisch).
3. **Wunschliste** deckt fremde Wohnorte ab, mit Verzögerung bis zur nächsten Sitzung.
4. **Ein klarer Satz** vor der Anmeldung, was gespeichert wird und wo.
5. Fehlertexte ohne „Claude“ (C3).

Die Standortdaten der anderen liegen in Michis Supabase-Konto. Für wenige Freund:innen, die das wissen, vertretbar. Für einen öffentlichen Start nicht ohne Impressum, Datenschutzerklärung und Verträge.

Nicht nötig: Vergleichen, gemeinsame Karten, Ranglisten.

---

## 8. Backlog

Nicht eingeplant, mit Michis Einschätzung, wo es eine gibt:

| Idee | Stand |
|---|---|
| Poster „Mein Weiden“ als druckbares Bild | gefällt, später |
| Runde vorschlagen (30 Minuten, möglichst viel Offenes) | interessant, später |
| Import überarbeiten (Apple-Health-Zip direkt) | später ansehen |
| Umweg-Tipp auf oft gegangenen Wegen | Vorschlag, offen |
| Straßen-Steckbrief (erstes, letztes Mal, wie oft) | Vorschlag, offen |
| Trampelpfade (oft Gegangenes dunkler) | Vorschlag, offen |
| Heute vor einem Jahr | Vorschlag, offen |
| Rekorde im Pass | Vorschlag, offen |
| „Fast fertig“-Liste | Vorschlag, offen |
| Monatsrückblick als Video speichern | nicht jetzt |
| Eigene Wörter je Ort (Stadtteil, Ortsteil, Borough) | später |
| Mitteilung bei neuem Stempel | braucht Einrechnen auf dem Server, Fassung 2 Phase 6 |
| Spielplatz-Checkliste | raus |

**Native Apple-App** (nur zur Einordnung, nicht geplant). Es bräuchte: Apple-Entwicklerkonto (99 US-Dollar im Jahr), eine native Hülle um die Web-App, eine eigene Hintergrund-Aufzeichnung statt Overland (der größte Teil), Begründung für „Standort immer“, Datenschutzerklärung und Store-Angaben, Konto in der App löschbar, Store-Auftritt. Für fremde Nutzer:innen zusätzlich eigene Karten-Server, Schutz gegen Massen-Konten, Impressum und Verträge.

**Monetarisierung:** nach hinten geschoben. `docs/BUSINESSPLAN.md` bleibt als Notiz liegen.

---

## 9. Risiken

| Risiko | Folge | Gegenmittel |
|---|---|---|
| Mail-Code im kostenlosen Tarif nicht möglich | A2 braucht einen weiteren Dienst | vorab klären, Michi entscheidet |
| Overland wird nicht mehr gepflegt oder bricht mit einem iOS-Update | keine Aufzeichnung | Statuszeile (C1), „offene App“ als Notweg (D8), OwnTracks als Plan B aus Fassung 2 |
| iOS räumt den Speicher der Web-App | Stand auf dem Gerät weg | Konto (A2), alles vom Server wiederherstellbar, Export (A3) |
| Umbau des Blatts bricht Bedienung mit VoiceOver | unzugänglich | Knopf am Griff bleibt, Test in E1 |
| Umstellung der Stempel-Schlüssel verliert Stempel | Ärger | alte Schlüssel umhängen, Test in D3, vorher Export |
| Tempo bricht mit wachsenden Daten ein | App wirkt träge | E3 vor allem Neuen aus Etappe F |
| Kostenloser Kartendienst fällt aus | leerer Plan | Hinweis (C3), später eigene Kacheln aus Fassung 2 |
| Zu viel Neues zu früh | wieder Unruhe | Regel 2 |

---

## 10. Offene Entscheidungen für Michi

1. Monatsrückblick: nur in der App (so geplant) oder doch als Video speichern?
2. „Losziehen mit offener App“ als Notweg behalten (Empfehlung) oder ganz entfernen?
3. Zeichen für den Pass-Knopf: Heft, Stempel oder das Wort „Pass“?
4. Reisen: ab welcher Entfernung und wie vielen Nächten?
5. Falls der Mail-Code einen zusätzlichen Dienst braucht: einverstanden?
6. Welche Gegend für Stufe 2 (Umkreis auf einen Schlag)?
7. D8: Zeile für Zeile, was wirklich gelöscht werden darf.
8. Aus dem Backlog „offen“: Umweg-Tipp, Steckbrief, Trampelpfade, Heute vor einem Jahr, Rekorde, Fast fertig. Rein oder raus?

---

## 11. Übergabe an den Entwicklungs-Chat

Anhängen:

- dieses Dokument
- `Plan.png`, `Viertel.png`, `Stempelpass.png`, `Pass-kurz.png`, `Orte.png`
- `Logo-Blatt.png`

Erste Nachricht zum Einfügen:

> Im Anhang ist der Bauplan Fassung 3 für Unterwegs, dazu fünf Zielbilder und das Logo. Fassung 3 ist ein Umbauplan: Fassung 2 gilt weiter, außer wo Fassung 3 etwas anderes sagt.
>
> Bitte so vorgehen:
> 1. Lies Fassung 3 ganz, dann `docs/STAND.md` und `docs/entscheidungen.md`.
> 2. Sag mir in höchstens zehn Sätzen, wo der Plan dem Code widerspricht oder wo du etwas anders machen würdest. Noch nichts ändern.
> 3. Danach beginnst du mit Schritt A1 und gehst die Schritte in der Reihenfolge des Plans durch. Ein Schritt, ein Commit, eine Live-Version. Nach jedem Schritt sagst du mir, was ich am iPhone prüfen soll, und wartest auf mein Ok.
> 4. Bis Etappe D fertig ist, baust du nichts Neues. Ideen kommen in `docs/IDEEN.md`.
> 5. Kein Apple-Entwicklerkonto, keine native App. Nichts löschen, was Daten enthält, ohne mich zu fragen.
> 6. Antworte auf Deutsch, in Du-Form, ohne Emojis. Markiere Annahmen.
