# Entscheidungen

## 22.11.2026: C2 Abschnitt umstellen
- Menü → „Wege“: die Wege der letzten 30 Tage nach Tagen (wird in D4 zur Rückblicke-Liste). Tipp auf einen Weg zeigt seine Abschnitte (Uhrzeit, Strecke, Dauer, „unsicher erkannt“) mit „zu Fuß · Rad · gefahren“; „wie erkannt“ nimmt die Korrektur zurück
- Kern: `splitLegs`, `seenByLegs`, `aktiveFolgen` nehmen Korrekturen (`{von, bis, art}` je Weg); ein Abschnitt, dessen Mitte im korrigierten Zeitraum liegt, bekommt die Art, die Korrektur gewinnt immer (Tests in `legs.test.ts`). Rohdaten bleiben unverändert
- Speicher: `localStorage streifzug.korrekturen` und Spalte `user_state.korrekturen` (Migration `20261122150000`), beim Start zusammengeführt
- Neu eingerechnet wird nur der korrigierte Weg: Der Schlüssel eines gespeicherten Ergebnisses enthält einen Fingerabdruck seiner Korrekturen (`gueltigFuer(n, hash)`); Wege ohne Korrektur behalten ihre Ergebnisse. Stempel werden nie zurückgenommen
- Geprüft: Testfahrt mit 44 km/h und „driving“ (gefahren, 0 %) auf „Rad“ gestellt → sofort 0,8 %, nach Neustart 0,8 %, Korrektur im Konto, zweites Gerät nach Anmeldung 0,8 %. Testkonten und Dateien gelöscht

## 22.11.2026: Lücken über die Straßen nachzeichnen (vorgezogen, Wunsch Michi)
- `packages/core/src/nachzeichnen.ts` (mit Tests): Zwischen zwei aufeinanderfolgenden Punkten eines Fuß-/Radwegs (15–150 m Luftlinie) sucht die App den kürzesten Weg über das Straßennetz (Dijkstra auf den Stücken). Er wird nur eingetragen, wenn er höchstens 1,3 × Luftlinie + 20 m lang ist und kein zweiter Weg, der den ersten meidet, weniger als 25 % länger ist. Ein Stück wird gelb, wenn die nachgezeichneten Wege 60 % davon abdecken. Nie über eine Autofahrt hinweg
- Messung mit Michis Weg vom 22.11. (ausgedünnt): 10 s → 99 % (vorher 97 %), kein falsches Gelb; 15 s → 98 % (vorher 94 %), 29 m zusätzlich; 30 s → 96 %, aber rund 300 m Gelb, das es im genauen Ergebnis nicht gibt (die Linien zwischen weit entfernten Punkten schneiden Blöcke ab)
- Empfehlung an Michi: Overland „Min Time Between Points“ 10 s. `ABGLEICH_VERSION` 8

## 22.11.2026: Seltener Punkte von Overland – Messung
- Michis Weg vom 22.11. (9:20–11:35 Uhr, ca. 6 s Takt) künstlich ausgedünnt, gleiche Regeln: 10 s → 97 % der gelben Straßen, 15 s → 94 %, 30 s → 92 %. Die App füllt Lücken also schon weitgehend selbst (Verbindungslinie zwischen den Punkten, Ecken- und Lückenregel). Ein echtes Nachzeichnen über das Straßennetz (Ideenliste) würde den Rest holen

## 22.11.2026: C1 Statuszeile der Aufzeichnung
- Die App fragt beim Öffnen, beim Zurückkommen und alle 5 Minuten den Server nach dem neuesten Punkt (`received_points`, nicht mehr den Gerätespeicher)
- Overland nicht verbunden: Zeile „Automatisch aufzeichnen einrichten“. Letzter Punkt älter als **3 Stunden** (Michi, statt 24 im Plan): Zeile „Seit 13:49 keine Punkte von Overland · Prüfen ›“, führt zu Einstellungen → Overland. Sonst keine Zeile
- Einstellungen → Overland: „Läuft · letzter Punkt vor 12 Min.“ bzw. „Seit … sind keine Punkte angekommen“, darunter die Prüfliste (klappt bei Stillstand von selbst auf): Overland öffnen bzw. Meldung antippen; Both, Pause No, Min Time 5 s; Ort Immer, Genauer Standort, Hintergrundaktualisierung; Stromsparmodus aus; nicht wegwischen
- Nachts zählt nicht (Michi): Für die 3 Stunden zählt nur die Zeit von 7 bis 22 Uhr (`wachZeitSeit`). Letzter Punkt um 22 Uhr → morgens um 8 keine Zeile, erst ab 10 Uhr
- Geprüft: Testkonto mit 30 h altem Punkt zeigt die Zeile, nach einem neuen Punkt verschwindet sie. Testkonto gelöscht

## 22.11.2026: Etappe B (Blatt) umgesetzt
- B1: Halbes Blatt nur noch Kilometer, Stempelkarte und bei Bedarf eine Statuszeile („Automatisch aufzeichnen einrichten“, solange Overland nicht verbunden ist; Overland still; neuer Ort). „Zuletzt“, „Noch offen“, „Jetzt mit offener App aufzeichnen“ und die Zeile „Deine Städte und Veedel“ sind raus; „Noch offen“ wird nicht mehr berechnet (Code bleibt bis D8). Stempelkarte als Reihe aus sechs Kreisen (Bild `Viertel.png`): erreicht = Stempel, offen = leerer Kreis, kein „noch x km“. Menüpunkt „Letzte Wege“ entfällt bis D4 (Rückblicke)
- B2: Zwei Höhen. Das Blatt ist aufgezogen 75 % hoch (Michi: „etwas höher, aber nicht ganz“; vorher 64 %) und wird für „klein“ nach unten geschoben; beim Ziehen folgt es dem Finger, beim Loslassen rastet es auf der näheren Höhe ein (200 ms). Ein Wisch über 0,5 px/ms entscheidet nach Richtung (bei kurzen Bewegungen unter 0,3 s zählt die Geschwindigkeit der ganzen Bewegung). Der ganze Kopf ist Griff, Tippen auf den Kopf wechselt die Höhe, der Griff-Knopf bleibt für VoiceOver
- B3: Im Inhalt zieht eine Bewegung nach unten das Blatt, wenn der Inhalt oben steht. Ein Tipp auf das schon gewählte Veedel setzt das Blatt auf klein
- Nachbesserung (Michi: „oben am Rand geht es nicht gut“): Griff unsichtbar 28 pt hoch über die ganze Breite, und ein 18 pt breiter Streifen über der Blattkante gehört schon zum Blatt
- Städte und Stempelpass liegen bis D1 als eigene Seite hinter dem Menü
- Geprüft mit Touch-Gesten im iPhone-Format (CDP): schnell hoch, schnell runter (60 px in 50 ms), langsames Ziehen folgt dem Finger, Herunterziehen aus dem Inhalt, halbes Blatt passt ohne Scrollen (390 × 844)

## 22.11.2026: A3 Alles exportieren
- Einstellungen → Deine Daten → „Export vorbereiten“: der Hintergrund-Worker packt alle Wege (eigene, Overland, GPX) als GPX-Dateien (`wege/JJJJ-MM-TT_HHMM_<Herkunft>.gpx`), dazu `unterwegs.json` (Einstellungen, Ausnahmen, Stempel mit Datum) und `LIESMICH.txt` in eine Zip-Datei. Danach öffnet „Sichern oder teilen“ den Teilen-Dialog (iOS verlangt dafür einen eigenen Tipp), ohne ihn wird die Datei geladen
- Ohne Bibliothek: GPX-Schreiber und Zip-Packer in `packages/core/src/export.ts` (mit Tests), Komprimierung über `CompressionStream`. GPX enthält Genauigkeit, Bewegungsart und Tempo als Erweiterung; der GPX-Import liest sie wieder, damit dieselben Abschnitte (Rad/Auto) erkannt werden
- Geprüft mit Michis echten Overland-Punkten (simuliert): 6 Wege exportiert, in ein leeres Testkonto importiert, vorher und nachher 320 gelbe Stücke. Testkonten gelöscht

## 22.11.2026: A2 Konto mit Mail und Passwort (statt Mail-Code)
- Michi: einfacher Login ohne zusätzlichen Dienst. Ablauf: Mail-Adresse eintragen → eine Bestätigungs-Mail mit Link (öffnet Safari, das ist in Ordnung, der Link bestätigt nur) → zurück in der App ein Passwort festlegen. Das anonyme Konto bekommt die Adresse, Nutzer-ID und alle Daten bleiben. Auf neuen Geräten: Mail + Passwort, keine Mail nötig; das iPhone füllt das Passwort per Face ID aus. Mail-Bestätigung in Supabase bleibt eingeschaltet (keine Sicherheits-Einstellung geändert)
- Anmelden auf einem Gerät mit eigenen Wegen: Frage „übernehmen?“ (ja: werden ins Konto hochgeladen; nein: nur vom Gerät entfernt). Overland-Wege des vorigen Kontos werden vom Gerät entfernt und kommen vom Konto neu
- Abmelden mit Rückfrage, nur wenn kein Weg mehr ungesichert ist; im Konto bleibt alles
- Neu: Tabelle `user_state` (Stempel, Ausnahmen, Stiftfarben je Konto, RLS), beim Start zusammengeführt (nichts geht verloren), Änderungen gehen nach 2 s hoch (Migration `20261122120000_user_state.sql`)
- Hochladen eigener Wege läuft jetzt auch 4 s nach dem Start (vorher erst nach einer Minute, wenn die Anmeldung beim ersten Versuch noch nicht fertig war)
- Geprüft mit zwei Browser-Profilen (der Mail-Versand im Test simuliert): ID unverändert, zweites Profil sieht Weg, Ausnahmen und Prozent; falsches Passwort zeigt deutschen Satz. Testkonten und Testdatei gezielt gelöscht

## 22.11.2026: Antworten zu Fassung 3
- Rückblick (F1): nur Gelb, keine Tintenlinie, kein Stift. Je Weg einzeln und näher heran bleibt
- Nie dunkler bei oft Gegangenem; „Trampelpfade“ im Backlog ist damit verworfen
- Konto (A2): einfacher Login ohne Mail-Dienst gewünscht → Mail-Adresse + Passwort, ohne Bestätigungs-Mail (noch nicht umgesetzt)
- Zielbilder liegen in `docs/design/` (Plan, Viertel, Stempelpass, Pass-kurz, Orte, Logo-Blatt). Hinweis: „Viertel.png“ und „Stempelpass.png“ zeigen noch „Zuletzt“, „Noch offen“, „Als Nächstes“ und die Reiter, die laut Fassung 3 entfallen; es gilt der Text

## 22.11.2026: Bauplan Fassung 3 (Umbauplan) gilt
- `docs/PLAN-3.md`: erst verlässlich, dann ruhig, dann neu (Etappen A–F). Fassung 2 gilt weiter, wo Fassung 3 nichts anderes sagt. Kein Apple-Entwicklerkonto, keine native App, Overland bleibt
- A1: Skills für native Apps (expo-*, eas-*, react-native-*) und ihre Lizenzdateien entfernt, alter Stand nach `docs/archiv/`, `CLAUDE.md` auf Fassung 3 umgestellt
- Abweichungen vom Plan, mit Michi zu klären: Mail-Code braucht eigenen Mail-Versand (A2); Stempel und Ausnahmen müssen mit ins Konto (A2); Zuhause-Zone läuft über eine Datenbank-Regel, nicht die Edge Function (C4, keine Zone gesetzt); Overland-Einstellung heißt „Continuous Tracking Mode: Both“ (C1); „Trampelpfade dunkler“ widerspricht Michis Entscheidung vom 22.11.

## 22.11.2026: Textmarker deckend, ohne Verdunkelung (Abweichung vom Bauplan 4.5)
- Michi: durchgezogene Linie, keine Punkte, und oft gegangene Straßen werden **nicht** dunkler. Das Gelb ist deckend (Deckkraft 1), Straßen und Wege gleich. Der Bauplan wollte Überlagerung dunkler – gilt nicht mehr

## 22.11.2026: Autofahrt = einmal schneller als 40 km/h
- Eine Fahrt sind Abschnitte mit höchstens 5 Minuten Halt dazwischen. War man darin einmal über 40 km/h (98-%-Wert), werden auch ihre langsamen Abschnitte gefahren (rot), wenn das iPhone dort „Auto“ meldet oder ohne Angabe Radtempo hatte. Gehen nach dem Parken (iPhone meldet „walking“) bleibt gelb. Lastenrad (um 25 km/h, nie über 40) bleibt gelb. Tests dazu. `ABGLEICH_VERSION` 7

## 22.11.2026: Lastenrad – „Auto“ vom iPhone nur glauben, wenn das Tempo passt
- Michi fährt ein Lastenrad (um 25 km/h); das iPhone meldet dabei oft „driving“. Regel jetzt: Meldet das iPhone Auto, gilt der Abschnitt nur dann als gefahren, wenn er meist über 30 km/h (90 %) oder zeitweise über 40 km/h (98 %) liegt, oder sehr langsam ist (unter 12 km/h, Stau). Dazwischen ist es Rad (gelb, als „unsicher“ markiert). Ohne iOS-Angabe wie bisher: über 30 km/h gefahren
- Michis Fahrt am 22.11. 11:03–11:09 Uhr ist damit wieder gelb. `ABGLEICH_VERSION` 6

## 22.11.2026: Overland meldet Autofahrten als „driving“
- iOS nennt es „automotive“, Overland schickt aber „driving“. Das wurde nicht erkannt; Autofahrten in Wohnstraßen (25–30 km/h) galten nach dem Tempo als Rad und wurden gelb. Jetzt zählt „driving“ wie „automotive“ als gefahren (Test dazu). Bei Michis Daten bis 22.11.: 7,9 → 5,1 km gelb, der Rest wird rot
- `ABGLEICH_VERSION` 5

## 22.11.2026: Wege werden gezeichnet (zählen nicht), Ecken und Lücken werden geschlossen
- Fuß- und Radwege, Parkwege (Stadtwald, Tierpark) werden beim Gehen erkannt und schmaler gelb gezeichnet. Sie zählen nie zu Prozent, Stempeln oder km (nur Straßen)
- Ecken (`eckenSchliessen`): kurzes Straßenstück (bis 40 m) neben Gelb, mit einem genauen Punkt (bis 15 m Ungenauigkeit) höchstens 10 m neben seiner Mitte, wird gelb. Grund: bei Punkten im Abstand von 25 m schneidet die Linie die Kreuzung ab. Mit Michis Weg vom 22.11.: 6 von 11 weißen Eckstücken gefunden, kein falsches
- Lücken (`lueckenSchliessen`): zusammenhängende ungegangene Stücke von höchstens 40 m, die an zwei Stellen an Gelb grenzen, werden gelb. Nie Autobahnen
- `ABGLEICH_VERSION` 4

## 21.11.2026: Konto ging verloren, wiederhergestellt und abgesichert
- Am 21.11. um 17:26 Uhr hat Michis iPhone die gespeicherten Daten der App verloren; die App legte ein neues anonymes Konto an (`50e0c8bc…`). Overland schickte weiter an das alte Konto (`a268989b…`), die App war leer
- Wiederhergestellt auf dem Server: `received_points`, `receive_tokens`, `user_settings`, `tracks` auf das neue Konto umgehängt; die 7 Dateien in `spuren` kopiert (Originale im alten Ordner bleiben als Sicherung, das alte Konto wurde nicht gelöscht)
- Abgesichert in der App: ein neues Konto nur, wenn der Server sagt, dass das alte nicht mehr existiert (`kontoWeg`), nicht bei anderen Fehlern; Overland gilt als verbunden, wenn der Server einen Schlüssel kennt (auch wenn das Gerät es vergessen hat); eigene Wege, die nur auf dem Server liegen, werden zurückgeholt (`zurueckholen`); `navigator.storage.persist()` bittet das iPhone, die Daten zu behalten
- Offen: ein richtiges Konto (Mail/Apple), damit so ein Verlust gar nicht mehr passieren kann

## 21.11.2026: Rückblick nach Empfangszeit, Abholen wartet auf die Anmeldung
- Overland schickt mit Verspätung. Der Rückblick nimmt jetzt Wege, deren Punkte seit dem letzten Besuch **angekommen** sind (`empfangenAm` je Weg), nicht die seitdem **aufgezeichnet** wurden. Neu sind Straßen, die auf einem dieser Wege zuerst gegangen wurden
- Beim Öffnen wartet das Abholen bis zu 10 s auf die Anmeldung, statt still auszufallen (dann kam erst nach 5 Minuten etwas)
- Menü: „Letzte Wege“ (öffnet das Blatt bei „Zuletzt“)

## 21.11.2026: Menü oben rechts (Abweichung vom Bauplan, Wunsch Michi)
- Runder „…“-Knopf über dem Standort-Knopf, klappt ein Menü auf: „Deine Städte und Veedel“, „Stempelpass“, „Einstellungen“. Zusätzlich die Zeile „Deine Städte und Veedel“ im Veedel-Blatt. „Automatisch aufzeichnen“ steht bewusst nicht im Menü (läuft ohnehin), Overland bleibt in den Einstellungen

## 21.11.2026: Rückblick ohne Stift, Lücken bei Overland geschlossen
- Michi: beim Öffnen kein Stift, nur das Gelb. Der Plan zeigt alle neuen Wege auf einmal, die neuen Straßen werden in Gehreihenfolge gelb (3–7 s), danach Zoom aufs Veedel und Hochzählen. Antippen überspringt
- Overland schickt nur etwa alle 31 s einen Punkt. Das Tempo wurde aus ±5 s berechnet, ein einzelner Punkt galt dann als Stillstand. Jetzt reicht das Fenster immer bis zu den Nachbarpunkten; Halt erst unter 0,4 m/s (langsam gehen mit Kindern zählt); aufeinanderfolgende aktive Abschnitte werden mit den Punkten der Pause dazwischen gemeinsam abgeglichen. Mit Michis Weg vom 21.11. (Lövenich): 1,30 → 1,50 km erkannte Straßen. `ABGLEICH_VERSION` 3 (alles wird einmal neu gerechnet)

## 21.11.2026: Rückblick „Stift von oben“ beim Öffnen (Bauplan 5.1, vorgezogen aus Phase 3)
- `packages/core/src/replay.ts` (mit Tests): Abschnitte je Weg als neu / bekannt / gefahren, Tempo 120 / 600 / 1200 m/s, Budget 20 s (erst schneller über Bekanntem, dann Wege ohne Neues weglassen, dann die drei Wege mit dem meisten Neuen, zuletzt alles schneller); `freigabeZeiten`: wann jedes neue Stück gelb wird
- Ablauf: Schnitt an den Anfang des ältesten neuen Wegs (Zoom 16,5), Markerspitze als HTML-Element, neue Straßen werden gelb, wenn die Spitze vorbeikommt; über Bekanntem hebt sie ab, Gefahrenes als Kuli bei Zoom 14. Antippen überspringt, Halten spult dreifach vor, „Überspringen“ im Blatt. Danach Zoom auf das ganze Veedel (1,2 s) und die Prozentzahl zählt vom alten Stand hoch, der Marker-Wisch wird neu gezogen
- „Neu“ = erstmals gegangen nach dem letzten Besuch (der Worker liefert dafür je Stück die erste Zeit). Antippen unter „Zuletzt“ spielt einen Weg genauso ab
- Noch nicht: Straßen-Schilder während des Rückblicks (Nr. 3), Selbst-Stempeln danach (Nr. 7)

## 21.11.2026: Orte ohne Region werden behalten (Option C)
- Overland- und GPX-Punkte werden nicht mehr außerhalb der Regionen verworfen. Der Abgleich hängt nicht von den Regionen ab: Wege dort sind sofort gelb (bzw. rot), Prozente und Stempel kommen automatisch, sobald die Region aufgenommen ist (kein Neurechnen nötig)
- Orte mit mindestens 200 m aktiv außerhalb aller Regionen (Raster ca. 5 km) bekommen einen Namen aus der Grundkarte (Ebene „place“, Stadt vor Ort vor Dorf) und stehen in der Sammlung unter „Wird vorbereitet“; neue (letzte 7 Tage) auch als Zeile im Blatt
- Jeder Ort wird als Wunsch in `region_wishes` gemeldet (Migration `20261121160000_region_wishes.sql`, RLS nur eigene Zeilen). Claude liest die Wünsche über die Verwaltungs-API und nimmt die Orte mit `npm run region` auf

## 21.11.2026: Phase 2 „Neues Aussehen“ umgesetzt
- Ein Bildschirm: Plan mit einem Knopf (Standort) und Blatt in drei Höhen. Ziehen am Kopf oder Griff wechselt die Höhe, Antippen des Kopfs öffnet Höhe 2. Einstellungen hinter „…“ in der Sammlung (Stifte, Overland, Zuhause-Zone, GPX)
- Statuszeile im Blatt statt Bannern: „rechnet N Wege ein …“, „Seit Dienstag · 2 Wege · 3,6 km“ (mit „Überspringen“), unterwegs „+274 m · 3 Straßen“
- „Zuletzt“ zeigt Datum und Strecke je Weg (noch nicht „+947 m neu“), Antippen spielt den Weg ab. „Noch offen“: benannte Straßen im Veedel mit offenen Metern, nächste zuerst (vom Standort, sonst Veedel-Mitte), Antippen zeigt sie gestrichelt
- Stempel werden aus dem Fortschritt berechnet (`stamps.ts`) und mit fester Lage und Drehung auf dem Gerät gemerkt, nie wieder entfernt. Tinte per SVG-Filter
- Etikett erst ab Zoom 14 (sonst wählt ein Tipp das Veedel). „Hier komme ich nicht hin“ gilt je Straßenstück, nimmt es aus Zähler und Gesamtlänge und aus dem Gelb; „Zählt doch wieder“ nimmt es zurück
- Herausgezoomt (unter Zoom 12,5) Schraffur in der aktuellen Markerfarbe, Prozent unter dem Veedel-Namen. Mit „Jedes Jahr eine Farbe“ trägt jedes Stück die Farbe des Jahres, in dem es zuerst aktiv gesehen wurde (2026 gelb, 2027 grün …, frühere Jahre rückwärts)
- Ortsnamen der Grundkarte auf Deutsch (`name:de`)

## 21.11.2026: Phase 1 „Aufzeichnung, die läuft“ umgesetzt (Teil 1)
- `packages/core/src/legs.ts` (mit Tests): Säubern (über 50 m Ungenauigkeit, Sprünge über 50 m/s), Tempo über ±5 s geglättet, Trennen bei Halt (unter 1 m/s für 30 s), Lücke über 60 s und dauerhaftem `motion`-Wechsel (20 s); Einstufen mit `motion` (automotive ≥ 50 % gefahren, aktiv ≥ 60 %), sonst 90-%-Tempo (über 38 km/h gefahren, 30–38 km/h gefahren „unsicher“); kurze Abschnitte zwischen zwei gleichen Nachbarn übernehmen deren Art. `seenByLegs`: aktiv nur Straßen mit Punkten bis 25 m, gefahren Straßen und Autobahnen mit 30 m seitlich
- Autobahnen und Kraftfahrstraßen sind als Art „drive“ in den Stücken (nur auf dem Gerät, nicht in den Gebiets-Summen) und werden gefahren rot gezeichnet
- `ABGLEICH_VERSION` 2: je Weg `stueckIds` (aktiv) und `stueckIdsGefahren`; alles wird einmal neu gerechnet. Zustand je Stück: aktiv schlägt gefahren
- Karte: Kuli-Linie `#D92B20` unter dem Gelb. Entfernt: Nebel, Weißer Fleck, Schalter „Fuß- und Radwege“ und „Autofahrten“ (beides zählt nie mehr)
- Overland: Abholen mit `motion` und `speed`; Einstellungen zeigen „Letzter Punkt“; im Blatt eine Zeile, wenn 48 Stunden nichts kam
- Zuhause-Zone: Tabelle `privacy_zones`, Datenbank-Regel verwirft Punkte in der Zone beim Empfang und löscht beim Anlegen schon gespeicherte (Migration `20261121140000_zuhause_zone.sql`); Einstellung in der App mit Umkreis 100/200/300 m
- Getestet: 11 neue Tests (zu Fuß, Rad, Auto, Fuß–Bahn–Fuß, Ampel, Stau, Rennrad mit/ohne motion, Glättung, Lücken, Abgleich je Art); Browser: Fuß–Bahn–Fuß auf echten Straßen ergibt aktiv/gefahren/aktiv, 84 gelbe und 39 rote Stücke; Zuhause-Zone mit Testkonto (gelöscht)

## 21.11.2026: Bauplan Fassung 2 (aus der Zweitmeinung mit Claude Fable) gilt
- `docs/PLAN.md` ist jetzt der Bauplan Fassung 2; der alte Plan liegt in `docs/archiv/PLAN-fassung-1.md`. Logo und App-Symbol in `docs/design/`
- Entscheidungen aus dem Sparring (Bauplan Abschnitt 0): kein Apple-Entwicklerkonto, Unterwegs bleibt Web-App auf dem Homescreen; Overland bleibt die Brücke; Michi öffnet abends, der **Rückblick** („Stift von oben“, höchstens 20 s, ein Tipp überspringt) ist der wichtigste Moment; neue Stempel **selbst stempeln** (Tipp, „Tock“, abschaltbar); Mitteilungen nur bei neuem Stempel, erst Phase 6; Stempel je Veedel (betreten, 10, 25, 50, 75, 100 %) und „Erkunden“; „Noch offen“-Liste statt Weißer Fleck; kein Familien-Pass, kein Teilen; herausgezoomt Veedel als gelb schraffierte Flächen; Straße antippen → Etikett mit „Hier komme ich nicht hin“; Gefahrenes immer sichtbar, rot unter dem Gelb; keine Logbuch-Seite, letzte fünf Wege im Veedel-Blatt; knappe Sprache, in Köln „Veedel“; Stiftfarben als feste Auswahl plus „Jedes Jahr eine Farbe“; Logo: U-förmige Straße mit Textmarker, Wortmarke Unter**weg**s; zuerst die Aufzeichnung
- Gestrichen: Nebel, Weißer Fleck, Zähl-Schalter, Logbuch-Seite, Meilensteine 1 % und 5 %, native App
- Zwei Klassen: **aktiv** (zu Fuß, Rad; Textmarker, zählt) und **gefahren** (Auto, Bus, Bahn; Kuli-Linie, zählt nie), eingestuft pro Abschnitt zwischen zwei Halten, mit iOS-Bewegungsart von Overland
- Datenbasis ab Phase 4: eigene Aufbereitung aus OSM-Rohdaten (Geofabrik) zu `netz.pmtiles` auf R2, Gebiete aus OSM-Verwaltungsgrenzen, Hofweg-Regel für namenlose Stiche
- Stand bei Übernahme: Overland liefert seit 21.11.2026, 11 Uhr (727 Punkte bis 13:25). Die Empfangsstelle speichert seit 21.11. auch `motion` und `speed` (Migration `20261121130000_received_points_motion.sql`) und antwortet exakt `{"result":"ok"}`

## 21.11.2026: Neuer Name „Unterwegs“
- Michi hat sich für „Unterwegs“ entschieden. Sichtbar umbenannt: App-Titel, Homescreen-Name (PWA-Manifest, `apple-mobile-web-app-title`), Texte, Doku-Überschriften
- Technische Namen bleiben „streifzug“ (Repo, Cloudflare-Projekt/Adresse, Supabase, IndexedDB, localStorage), sonst gingen Daten auf dem Gerät verloren. Der Reiter „Streifzüge“ (= die Runden) bleibt als Begriff
- Hinweis aus der Prüfung (21.11.2026): „Unterwegs“ allein ist als Marke kaum schützbar (beschreibend), im App Store gibt es u. a. ASFINAG „UNTERWEGS“ (AT, Verkehr) und „Mein HALLE Unterwegs“. Vor einem App-Store-Start mit unterscheidendem Zusatz oder Untertitel arbeiten

## 21.11.2026: Rückblick beim Öffnen
- Michi: Beim Öffnen soll die App einmal nachfahren, was dazugekommen ist. Umsetzung: Nach dem Abholen der Overland-Punkte (beim Öffnen und beim Zurückkehren, nicht beim 5-Minuten-Takt) sucht die App Wege, die seit dem letzten Besuch endeten (`localStorage` `streifzug.rueckblick-bis`; beim allerersten Mal die letzten 12 Stunden). Eigene Runden, die live verfolgt wurden, zählen als gesehen
- Karte: Ausschnitt auf alle neuen Wege, dann läuft ein Tinten-Punkt mit Textmarker-Spur und Glanz die Wege der Reihe nach ab (3–8 s je nach Länge), blendet aus. Banner „Seit deinem letzten Besuch: 2 Wege · 3,6 km“ mit „Überspringen“; Antippen der Karte überspringt auch. Bei „Bewegung reduzieren“ nur Ausschnitt und Spur ohne Fahrt
- Worker liefert die Wege dafür gekürzt (höchstens ~400 Punkte je Weg)

## 21.11.2026: Google-Import ausgebaut, Overland oben im Profil
- Auf Michis Wunsch ist der Google-Import ganz entfernt (Leser in `packages/core`, Worker, Oberfläche, Schalter). Bleibt: einmaliges Löschen alter Google-Einträge beim Start (`main.tsx`) und `?notfall`
- Overland war zu versteckt (unten im Profil unter „Importieren“). Jetzt ganz oben im Profil unter „Automatisch aufzeichnen“; im Reiter Streifzüge zwei Knöpfe: „Automatisch aufzeichnen (ohne Losziehen)“ und „Alte Wege importieren (Apple Health, GPX)“

## 21.11.2026: Start nicht mehr blockieren
- Michi konnte in der App nichts drücken. Wahrscheinliche Ursache: Die App wartete beim Start auf das Löschen der Google-Importe (bei großer Zeitachse auf dem iPhone langsam; beim Schließen bricht es ab und beginnt neu). Jetzt startet die App sofort, gelöscht wird im Hintergrund; der Worker lädt Google-Importe gar nicht mehr. Test: 2.000 Google-Wege à 500 Punkte, CPU 4-fach gedrosselt, bedienbar nach 0,5 s

## 21.11.2026: Automatisch im Hintergrund über Overland; Importe nur noch im Worker
- Michi will nicht für jede Runde „Losziehen“ drücken. Bis zur eigenen iPhone-App (Phase 3) übernimmt die kostenlose App **Overland** (quelloffen, App Store) die Hintergrund-Aufzeichnung und schickt Punkte an unsere Empfangsstelle
- Supabase: Tabellen `receive_tokens` (nur SHA-256 des Schlüssels) und `received_points` (Punkte je Nutzer:in, doppelte Zeit wird ignoriert), Zeilenschutz: lesen und löschen nur eigene, einfügen nur über die Edge Function `overland` (`supabase/functions/overland`, `verify_jwt=false`, Schlüssel per Bearer oder `?token=`; Antwort `{"result":"ok"}`). Deploy über die Verwaltungs-API (`POST /v1/projects/<ref>/functions/deploy?slug=overland`)
- App: Profil → „Automatisch aufzeichnen (Overland)“: Schlüssel erzeugen (nur Prüfsumme geht zum Server), Einrichtungs-Link `overland://setup?url=…&token=…`, Abholen beim Start, beim Zurückkehren und alle 5 Minuten, Schalter „Einrechnen“, Trennen, Löschen. Der Server behält alle Punkte (Sicherung, später weitere Geräte); auf dem Gerät werden nur Punkte in gebauten Regionen zu Wegen
- Grundsatz neu: Die Oberfläche lädt nur eigene Runden (IndexedDB-Schlüssel unter „g“). Importe (`gpx:`, `google:`) und Overland (`overland:`) liest, verarbeitet und speichert nur der Worker (`daten/abgleich.worker.ts`): Datei einlesen, Vorschau, Übernehmen, Löschen, Abholen, Abgleich mit Fortschrittsanzeige, Ergebnis je Weg speichern, Übersicht je Quelle, Logbuch-Blöcke je Zeitraum
- Fehler gefunden: `push(...liste)` und `Math.min(...liste)` sprengen bei zehntausenden Punkten den Stapelspeicher; überall durch Schleifen ersetzt
- Getestet: Ende-zu-Ende mit Testkonten (Punkte senden wie Overland, abholen, Gelb, zwei Pakete werden ein Weg, falscher Schlüssel abgelehnt, ohne Anmeldung nichts lesbar); Testkonten danach gezielt gelöscht. Lasttest GPX mit 1.669 Wegen bei 4-fach gedrosselter CPU: längste Blockade 0,6 s

## 21.11.2026: Google-Importe entfernt, Google-Import pausiert
- Die App hing bei Michi weiterhin nach dem Google-Import. Auf Michis Wunsch werden alle Google-Importe beim nächsten Start einmal gelöscht (`main.tsx`, vor dem ersten Laden, per Schlüsselbereich „google:…“, ohne die Daten zu laden). Merker `streifzug.google-importe-entfernt-1`
- Notausgang: `https://streifzug.pages.dev/?notfall` löscht alle Importe (Google und GPX); eigene Runden bleiben
- Der Google-Import ist ausgeblendet, bis Einlesen, Speichern und Abgleich vollständig im Hintergrund-Worker laufen und die Oberfläche importierte Wege nie lädt (Plan: eigene Runden und Importe getrennt laden, Worker liest Importe selbst aus IndexedDB). GPX bleibt

## 20.11.2026: App fror nach großem Import ein (Fix)
- Michi: „Grad geht gar nichts mehr“ nach dem Import. Nachgestellt mit 1.668 importierten Wegen bei 4-fach gedrosselter CPU (etwa iPhone): bis 9,5 s am Stück blockiert, 127 s Blockade insgesamt, bei jedem Start erneut
- Ursachen: Abgleich aller Wege bei jedem Start auf dem Oberflächen-Strang; Nebel zeichnete bei jedem Bild der Kartenbewegung alle Linien neu; Logbuch rechnete jeden Import einzeln
- Lösung: Abgleich und Summen je Gebiet im Hintergrund-Worker (`daten/abgleich.worker.ts`, reine Logik in `daten/rechnen.ts`), Hinweis „Wege werden eingerechnet … %“; Ergebnis je Weg auf dem Gerät gespeichert (`stueckIds`, gültig für `ABGLEICH_VERSION` und Punktzahl), beim nächsten Start kein Abgleich mehr. Nebel wird beim Verschieben nur mitbewegt (CSS-Transform, Rand 35 %, Auflösung max. 1,5) und am Ende neu gezeichnet. Logbuch holt Importe zwischen zwei eigenen Runden gebündelt vom Worker
- Ergebnis im selben Test: längste Blockade 0,45 s, insgesamt 2,4 s; nach Neustart 0,38 s. Ändern sich die Abgleich-Regeln, `ABGLEICH_VERSION` hochzählen

## 20.11.2026: Import Google-Zeitachse und GPX (Phase 2 vorgezogen)
- Kein Abruf per Google-Anmeldung: Google speichert die Zeitachse seit 2024/25 nur noch auf dem Handy, es gibt keine öffentliche Schnittstelle (die Data Portability API braucht eine aufwendige App-Prüfung, Zeitachse dort nicht bestätigt). Stattdessen Import der Exportdatei
- Leser in `packages/core/src/import.ts` mit Tests: iPhone-Export (`location-history.json`, `geo:`-Punkte mit Minuten-Versatz), Android-Export (`semanticSegments`/`timelinePath`, `rawSignals`), alte Takeout `Records.json` und alte Monatsdateien (`simplifiedRawPath`); GPX (Apple-Health-Workouts, Strava, Komoot). Besuche und Aktivitäten nur mit Start/Ende haben keinen Weg und werden übersprungen
- Ehrlich statt geraten: Punkte über 25 m Ungenauigkeit und Sprünge über 50 m/s fallen weg; Wege werden bei 10 min Pause oder 300 m Sprung geteilt. Beim Abgleich dürfen importierte Punkte zeitlich weiter auseinander liegen, wenn sie höchstens 60 m entfernt sind (`maxGapM`), sonst wird nichts verbunden. Vorschau zeigt Punktdichte (gut/mittel/grob)
- Nur Punkte in und um gebaute Regionen werden übernommen. Gespeichert auf dem Gerät (IndexedDB, Status „importiert“, Kennung je Weg, erneuter Import verdoppelt nichts), nicht hochgeladen. Schalter je Quelle im Profil („Einrechnen“), Löschen je Quelle
- Fortschritt rechnet jetzt je Weg nur gegen dessen eigene Kacheln und merkt sich das Ergebnis je Weg (`gesehenVon`), damit Hunderte importierte Wege die App nicht bremsen
- Logbuch zeigt importierte Wege als Sammelzeile, sie zählen aber für „neu entdeckt“ der eigenen Runden mit

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
