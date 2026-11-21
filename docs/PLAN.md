# Unterwegs: Bauplan (Fassung 2)

Stand: 21.11.2026 · ersetzt die erste Fassung vollständig.
Grundlage: Briefing mit Anhängen, die Entwürfe auf der Design-Leinwand (Seite „E verfeinert“) und Michis Antworten aus dem Sparring.
Annahmen sind mit **[ANNAHME]** markiert.

**Für den Entwickler-Chat:** Dieses Dokument ist der Auftrag. Die Bilder der drei Ziel-Bildschirme und des Logos liegen bei (Michi hängt sie an). Wo Bild und Text sich widersprechen, gilt der Text. Technische Namen bleiben „streifzug“.

Begriffe:
- **aktiv** = zu Fuß oder mit dem Rad. Wird Textmarker, zählt in die Prozente.
- **gefahren** = alles Schnellere (Auto, Bus, Bahn). Wird Kuli-Linie, zählt nie.
- **Stück** = ca. 25 m Straße. **Blatt** = die weiße Fläche, die von unten über dem Plan liegt.
- **Veedel** = das kleinste Gebiet. In Köln heißt es in der App „Veedel“, sonst das ortsübliche Wort (Abschnitt 7.6).

---

## 0. Was im Sparring entschieden wurde

| Thema | Entscheidung |
|---|---|
| Apple-Entwicklerkonto | **Nein.** Unterwegs bleibt eine Web-App auf dem Homescreen |
| Aufzeichnen im Hintergrund | Overland bleibt die Brücke und wird als Erstes zum Laufen gebracht |
| Wann Michi die App öffnet | abends in Ruhe. Der Rückblick ist deshalb der wichtigste Moment der App |
| Beim Öffnen mit neuen Wegen | Der Rückblick startet sofort, ein Tipp überspringt |
| Rückblick | „Stift von oben“: flacher Plan, eine Marker-Spitze zieht den Weg nach. Höchstens 20 Sekunden |
| Neuer Stempel | **Selbst stempeln:** Michi tippt, der Stempel knallt aufs Papier |
| Ton | nur das „Tock“ beim Stempeln, abschaltbar |
| Mitteilungen | nur bei neuem Stempel (technisch erst in Phase 6 möglich, siehe 8.6) |
| Stempel-Arten | je Veedel (betreten, 10, 25, 50, 75, 100 %) und „Erkunden“. Serien, Reisen und Themen kommen vorerst nicht |
| Wohin als Nächstes | die Liste „Noch offen“ reicht |
| Familie, Teilen | vorerst nicht. Ein Pass, nur für Michi |
| Weit herausgezoomt | Veedel als Flächen, je mehr entdeckt, desto dichter gelb |
| Straße antippen | Etikett mit Name, Stand und „Hier komme ich nicht hin“ |
| Gefahrenes | immer auf dem Plan, unter dem Gelb |
| Logbuch | keine eigene Seite. Die letzten fünf Wege stehen im Veedel-Blatt |
| Sprache | knapp, in Köln „Veedel“ |
| Stiftfarben | feste Auswahl, dazu wählbar „jedes Jahr eine Farbe“ |
| Logo | U-förmige Straße mit Textmarker; Wortmarke Unter**weg**s mit markiertem „weg“ |
| Reihenfolge | zuerst die Aufzeichnung, die läuft |

---

## 1. Kurzurteil

1. **Der Kern bleibt:** jede gegangene Straße wird auf dem Stadtplan markiert, Prozent je Veedel, kleinstes Gebiet vorn.
2. **Ohne Daten ist alles Kulisse.** Bis heute ist kein automatisch aufgezeichneter Punkt angekommen. Phase 1 kümmert sich nur darum.
3. **Die App sieht aus wie ein gedruckter Stadtplan, den jemand benutzt:** weißes Papier, schwarz umrandete Straßen, Textmarker, Kuli, Tintenstempel. Alles drumherum ist still und iPhone-üblich.
4. **Ein Bildschirm, ein Blatt.** Keine Reiterleiste, kein Profil-Knopf, keine sichtbaren Einstellungen.
5. **Zwei Momente tragen die App:** der Rückblick am Abend (der Stift zieht den Tag nach) und das Stempeln von Hand.
6. **Zwei Klassen statt drei:** aktiv und gefahren, eingestuft pro Abschnitt zwischen zwei Halten.
7. **Zählen und Zeichnen aus einer Quelle:** eine eigene Aufbereitung aus OSM-Rohdaten. Damit fallen Hofwege heraus, und ganz Deutschland sowie das Ausland kommen ohne Handarbeit dazu.
8. **Gestrichen:** Nebel, Weißer Fleck, alle Zähl-Schalter, Logbuch-Seite, Meilensteine 1 % und 5 %, die native App.
9. **Bleibt als Web-App:** Mitteilungen und Ton gehen, Vibration und Widgets nicht. Das ist der Preis für „kein Apple-Konto“ und für diese App verschmerzbar.

---

## 2. Produktbild

**Für wen:** Michi. Viel zu Fuß und mit dem Rad in Köln-Weiden und Umgebung, oft mit Kindern, keine Hand frei. Schaut abends in Ruhe.

**Kernversprechen:** Du gehst einfach. Abends zieht Unterwegs deinen Tag auf dem Stadtplan nach und zeigt, wie viel von deinem Veedel du kennst.

**Prinzipien**
1. **Null Handgriffe am Tag.** Aufzeichnen und Einrechnen passieren von selbst.
2. **Der Plan ist die App.** Alles andere liegt als Blatt darüber.
3. **Das kleinste Gebiet vorn.** Immer das Veedel, nie die Stadt als Hauptzahl.
4. **Weiß heißt „geht noch“.** Was nicht begehbar ist oder nicht zählt, ist auf dem Plan fast unsichtbar.
5. **Eine Sache pro Moment.** Erst der Rückblick, dann die Zahl, dann der Stempel. Nie alles gleichzeitig.

---

## 3. Aufbau der App

### 3.1 Die ganze Bedienung in sechs Gesten

| Du willst | Du tust | Es passiert |
|---|---|---|
| sehen, wie weit du bist | App öffnen | Plan am Standort, unten Veedel und Prozent |
| mehr über das Veedel | Blatt hochziehen | Zahlen, Stempelkarte, letzte Wege, „Noch offen“ |
| alle Veedel und Stempel | Blatt ganz hochziehen | Sammlung mit „Veedel“ und „Stempelpass“ |
| ein anderes Veedel | herauszoomen, Fläche antippen | Blatt wechselt auf dieses Veedel |
| wissen, was mit einer Straße ist | Straße antippen | Etikett: Name, „gegangen am …“ oder „noch offen, 340 m“ |
| zurück zu dir | Standort-Knopf | Plan fährt zum Standort |

Mehr Bedienung gibt es nicht. Einstellungen liegen hinter „…“ in der Sammlung.

### 3.2 Bildschirme

```
┌─────────────────────────────┐
│                        (◎)  │  einziger Knopf: Standort
│     gedruckter Plan         │
│     weiß  = offen           │
│     gelb  = aktiv           │
│     rot   = gefahren        │
├──────────── ▬ ──────────────┤  Blatt, Höhe 1
│ Weiden               27,4 % │
│ Lindenthal · Köln           │
└─────────────────────────────┘
```

| Bildschirm | Inhalt |
|---|---|
| **Plan mit Blatt Höhe 1** (Bild „Plan“) | Plan bis unter die Statusleiste. Blatt 128 pt hoch: links Veedel-Name, darunter Bezirk und Stadt; rechts Prozent auf einem Marker-Wisch. Sonst nichts |
| **Blatt Höhe 2, „Veedel“** (Bild „Viertel“) | „7,8 von 28,3 km“ und „14 von 96 Straßen komplett“ · **Stempelkarte** mit sechs Feldern (betreten, 10, 25, 50, 75, 100 %): gestempelte tragen das Datum in Tinte, offene die fehlenden Kilometer · **Zuletzt:** die letzten fünf Wege, je eine Zeile („Samstag · +947 m neu“), Antippen spielt den Weg noch einmal ab · **Noch offen:** Straßen mit Namen, nächste zuerst, mit fehlenden Metern; Antippen zeigt die Straße gestrichelt auf dem Plan |
| **Blatt Höhe 3, „Sammlung“** (Bild „Stempelpass“) | oben zwei Wörter als Umschalter: **Veedel · Stempelpass**, rechts „…“ · **Veedel:** Baum Stadt → Bezirk → Veedel, nur Betretenes, je Zeile Name, feiner Balken, Prozent · **Stempelpass:** alle Stempel wie auf einer Passseite, frei und leicht schief gesetzt; darunter „Als Nächstes“ mit den zwei nächsten erreichbaren Stempeln |
| **Etikett einer Straße** | kleines weißes Schild an der Straße: Name fett; zweite Zeile „gegangen am 21.11.“, „gefahren am 20.11.“, „noch offen · 340 m“ oder „zählt nicht: Zufahrt“; bei zählenden Straßen die Aktion „Hier komme ich nicht hin“ (und „Zählt doch wieder“ zum Zurücknehmen) |
| **Weg-Ansicht** (aus „Zuletzt“) | der Weg auf dem Plan, Abschnitte als Zeilen („zu Fuß 9 Min. · gefahren 31 Min. · zu Fuß 8 Min.“), jeder Abschnitt umstellbar; „Noch einmal abspielen“; „Löschen“ |
| **Einstellungen** (hinter „…“) | Stifte (Markerfarbe, Kuli-Farbe, „Jedes Jahr eine Farbe“) · Aufzeichnung (Overland-Status, letzte Punkte, Einrichten) · Ton · Zuhause-Zone · Daten (GPX-Import, Export, Löschen) · Quellen und Datenstand |

„Losziehen“ bleibt als Textzeile ganz unten in Blatt Höhe 2 („Jetzt mit offener App aufzeichnen“), für den Fall, dass Overland ausfällt.

### 3.3 Zustände

| Zustand | Verhalten |
|---|---|
| **Erstes Öffnen** | Plan am Standort (nach Erlaubnis), Blatt: „Weiden 0 %“. Höhe 2 zeigt einen Satz: „Geh eine Straße entlang. Sie wird gelb.“ und darunter „Automatisch aufzeichnen einrichten“ |
| **Laden** | letzter Stand sofort aus dem Gerätespeicher. Wird gerechnet, steht statt „Lindenthal · Köln“ kurz „rechnet 2 Wege ein …“. Nie ein Ladekreisel über dem Plan |
| **Rückblick** | siehe Abschnitt 5. Blatt bleibt auf Höhe 1 und zeigt „Seit Dienstag · 2 Wege · 3,6 km“ |
| **Unterwegs mit offener App** | Plan folgt auf Straßenebene, neue Stücke werden live gezogen, Blatt zeigt „+274 m · 3 Straßen“ |
| **Offline** | alles Gespeicherte bleibt nutzbar. Fehlen Plan-Daten: „wird eingerechnet, sobald Netz da ist“ |
| **Neuer Ort ohne Daten** | Punkte werden behalten. Blatt: „Lissabon wird vorbereitet“. Später wird nachgerechnet, mit Rückblick |
| **Aufzeichnung steht** | kommen 48 Stunden keine Punkte an, obwohl Overland verbunden ist: eine Zeile in Höhe 2 in normaler Schrift: „Seit Montag keine Punkte von Overland. Prüfen“ |

---

## 4. Design-System

Leitbild: **ein gedruckter Stadtplan, den jemand benutzt hat.** Charakter haben nur Plan, Marker, Kuli und Stempel. Die Bedienung ist so unauffällig wie möglich.

### 4.1 Regeln gegen den „KI-Look“

- Kein Text, der nur Stimmung macht (keine erfundenen Blattnummern, Planquadrate, Seitenzahlen).
- Keine Plakat-Typografie, keine dicken Zierbalken, keine drei-spaltigen Kopfzeilen.
- Keine Kacheln mit Schatten, keine Verläufe, keine Glas-Effekte, keine Medaillen, kein Konfetti.
- Keine gefüllten Pillen-Knöpfe. Aktionen sind Text oder Zeilen in einer Liste.
- Icons nur drei: Standort-Pfeil, „…“, Schließen.
- Unregelmäßigkeit gehört nur dorthin, wo sie echt wäre: Marker, Kuli, Stempel. Die Bedienung ist exakt.

### 4.2 Farben

| Rolle | Hell | Dunkel **[ANNAHME: nicht entworfen, bitte so ableiten]** |
|---|---|---|
| Papier (Plan-Grund, Blatt) | `#FBFBF8` / Blatt `#FFFFFF` | `#17181A` / Blatt `#1F2023` |
| Straße offen | Füllung `#FFFFFF`, Rand `#151515` | Füllung `#2C2D31`, Rand `#8B8C90` |
| Häuser | `#D2D4D0` | `#26272A` |
| Park / Wasser | `#DCE8CE` / `#CBDDE8` | `#1C2419` / `#18222B` |
| Weg, der nicht zählt | Haarlinie `#C9CBC7`, ab Zoom 15 | Haarlinie `#34353A` |
| Veedel-Grenze | `#8C4F8C`, Strich-Punkt, 1,1 px | `#A873A8` |
| Text | `#151515` | `#EDEDEA` |
| Text zweitrangig | `#5A5A56` | `#A2A29D` |
| Haarlinie im Blatt | `#E4E4E0` | `#303136` |
| **Textmarker (Standard)** | `#FFE83A` | `#FFE83A` mit 85 % Deckkraft |
| **Kuli (Standard)** | `#D92B20` | `#FF6257` |
| Stempeltinte | Blau `#24388F`, Rot `#C42B22`, Grün `#256B45`, Schwarz `#1C1C1C` | jeweils um eine Stufe aufgehellt |

**Stifte zur Wahl**
- Marker: Gelb `#FFE83A`, Grün `#B8F060`, Pink `#FF9BCB`, Orange `#FFB95A`, Türkis `#7DE6D9`
- Kuli: Rot `#D92B20`, Blau `#2447C9`, Grün `#1F7A4D`, Schwarz `#1C1C1C`
- **„Jedes Jahr eine Farbe“** (Schalter, Standard aus): Jede Straße behält die Markerfarbe des Jahres, in dem sie zum ersten Mal aktiv gesehen wurde. Reihenfolge der Jahre: Gelb, Grün, Pink, Orange, Türkis, dann von vorn. In den Einstellungen steht die Legende („2026 gelb · 2027 grün“). Der Marker-Wisch hinter der Prozentzahl hat die Farbe des laufenden Jahres.

### 4.3 Schrift

- **Bedienung und Fließtext:** Systemschrift (`-apple-system, system-ui`), 17 pt für Zeilen, 15 pt für Werte rechts, 13 pt für Nebenzeilen.
- **Veedel-Name, Prozent, Straßennamen auf dem Plan, Stempel:** Archivo (Google Fonts, variable Breite). Name 32 pt fett bei 90 % Breite; Prozent 46 pt fett bei 88 % Breite; Plan-Beschriftung 11 pt halbfett bei 86 % Breite.
- Ziffern gleich breit (`tabular-nums`). Keine Großbuchstaben-Zeilen außer auf Stempeln.

### 4.4 Flächen und Abstände

- Seitenrand 20 pt, Raster 4 pt, Listenzeile 46–50 pt, Tippfläche mindestens 44 pt.
- Blatt: oben 26 pt Radius, Griff 36 × 5 pt, weicher Schatten nach oben. Standort-Knopf rund, 44 pt, weiß mit Schatten. Sonst nirgends Schatten oder Rundungen.
- Trennung durch Haarlinien. Keine Kacheln im Blatt.

### 4.5 Plan-Stil

- **Straßen:** weiß mit schwarzem Rand (Hauptstraßen 11,6 px Füllung / 13,6 px Rand, Wohnstraßen 7 / 8,8 px bei Zoom 16, mit dem Zoom skaliert). Runde Enden.
- **Häuser** grau, Bahn als schwarz-weiße Strichlinie, Park blassgrün mit gestrichelten Wegen, Wasser blassblau.
- **Namen** entlang der Straße in Archivo. Der Veedel-Name steht groß, weit gesperrt und blass quer über dem Gebiet, wie auf gedruckten Plänen.
- **Maßstabsbalken** unten links über dem Blatt.
- **Papierkörnung:** ein sehr leichtes Rauschen über dem Plan (höchstens 3 % sichtbar). Bei Leistungsproblemen weglassen.
- **Textmarker:** eigene Ebene über den Straßen, `mix-blend-mode: multiply`, damit Rand und Schrift durchscheinen. Breite = Straßenbreite + 4 px, gerade Enden. Jeder Weg ist ein eigener Strich; wo sich zwei Wege überlagern, wird das Gelb dunkler. Das ist gewollt und zeigt, wo man oft war.
- **Kuli:** 1,8 px, runde Enden, liegt unter dem Marker, leicht neben der Straßenmitte geführt (1 px Versatz), damit er wie von Hand wirkt.
- **Noch offen, angetippt:** die Straße bekommt eine schwarze Strichlinie in der Mitte.
- **Weit herausgezoomt (unter Zoom 12):** Straßen blenden aus, jedes betretene Veedel wird eine Fläche mit gelber Schraffur. Dichte der Schraffur in fünf Stufen (unter 10, 10, 25, 50, 75 %), bei 100 % voll gelb. Der Name und die Prozentzahl stehen in der Fläche.
- Technisch **[ANNAHME]**: Grundkarte bleibt MapLibre mit OpenFreeMap-Daten, neu eingefärbt (Flächen, Häuser, Wasser, Bahn). Straßen kommen ab Phase 4 aus der eigenen Ebene „Netz“; bis dahin werden die Straßen-Ebenen der Grundkarte in diesem Stil gezeichnet.

### 4.6 Stempel

- Vier Formen: **Kreis** (Veedel-Prozent), **Rechteck mit Datumszeile** (Veedel betreten), **Achteck** (Anzahl Veedel), **Kreis mit Umschrift** (Straßen komplett, Bezirk rundum).
- Aufbau Veedel-Stempel: Doppelring, oben im Bogen „KÖLN-WEIDEN“, Mitte „25 %“, unten im Bogen das Datum.
- **Tinte, nicht Vektor:** SVG-Filter mit Rauschen für raue Kanten (`feTurbulence` + `feDisplacementMap`, Versatz ca. 2,4 px) und ungleichmäßigen Farbauftrag (zweites, grobes Rauschen als Maske, Deckkraft zwischen 30 und 100 %). Filterbereich in Benutzerkoordinaten angeben, sonst werden Ränder abgeschnitten.
- Jeder Stempel hat eine feste Drehung (−12° bis +12°) und eine feste Tintenfarbe; beim Selbst-Stempeln bestimmt der Tipp Ort und Drehung, danach bleibt beides gespeichert.
- Tintenfarben nach Art: Veedel-Prozent blau, betreten schwarz, Erkunden rot.

### 4.7 Logo

- **Zeichen:** eine U-förmige Straße im Plan-Stil (weiß mit schwarzem Rand) auf Papierweiß. Der Textmarker ist über den linken Schenkel und den Bogen gezogen und hört im rechten Schenkel auf. Das U steht für Unterwegs, das offene Ende für „geht noch“.
- **Wortmarke:** „Unterwegs“ in Archivo fett, die Buchstaben „weg“ mit Textmarker hinterlegt (leicht schräg, überstehend).
- App-Symbol: das Zeichen ohne Schrift, Marker in `#FFE83A`, kein Verlauf, kein Schatten. Muss bei 60 px noch als U mit Gelb lesbar sein.

### 4.8 Sprache

- Knapp, sachlich, keine Lob-Texte, keine Ausrufezeichen, keine Emojis.
- In Köln „Veedel“, sonst das ortsübliche Wort (Abschnitt 7.6).
- Beispiele: „Weiden 27,4 %“ · „Noch offen, nächste zuerst“ · „Seit Dienstag · 2 Wege · 3,6 km“ · „Hier komme ich nicht hin“ · „Tippen zum Stempeln“.

---

## 5. Animationen

Michi öffnet abends in Ruhe. Die Reihenfolge ist deshalb fest: **Rückblick → Zahl → Stempel.** Immer nur eine Bewegung gleichzeitig.

| Nr. | Animation | Auslöser | Dauer | Ablauf | „Bewegung reduzieren“ |
|---|---|---|---|---|---|
| 1 | **Rückblick „Stift von oben“** | Öffnen, wenn seit dem letzten Besuch Wege dazukamen | höchstens 20 s gesamt | siehe 5.1 | kein Abfahren: Plan zeigt den Weg mit dem meisten Neuen, neue Stücke blenden in 300 ms ein |
| 2 | **Marker-Zug** | neues Stück, im Rückblick und live | 350 ms je Stück, verkettet | Strich wächst in Laufrichtung, die vordersten 6 px sind kurz heller (frische Tinte) und dunkeln in 400 ms nach | Stück blendet ein |
| 3 | **Straßen-Schild** | erste neue Meter einer Straße | 1,2 s | kleines weißes Schild mit dem Namen klappt neben der Straße auf und wieder zu | steht 1,2 s, verschwindet |
| 4 | **Straße komplett** | letzte fehlende Meter einer Straße | 600 ms | der Marker fährt die ganze Straße einmal schnell nach (zweite Lage, wird dabei sichtbar dunkler und hellt wieder auf), Schild „Goethestraße komplett“ | nur Schild |
| 5 | **Übermalen** | aktiv über Gefahrenem | wie Nr. 2 | der Marker deckt den Kuli zu; der Kuli bleibt darunter schwach sichtbar wie auf Papier | wie Nr. 2 |
| 6 | **Zahl** | Ende des Rückblicks oder Ende eines Live-Wegs | 900 ms | Plan zoomt in 1,2 s auf das ganze Veedel; die Prozentzahl im Blatt zählt hoch; der Marker-Wisch dahinter wird einmal neu gezogen | Zahl springt |
| 7 | **Selbst stempeln** | fälliger Stempel, direkt nach Nr. 6 | bis zum Tipp | siehe 5.2 | wie beschrieben, ohne Federn |
| 8 | **Veedel betreten** | erstes Stück in einem neuen Veedel | 1,0 s | die Strich-Punkt-Grenze läuft einmal rundum, der blasse Veedel-Name wird kurz kräftig | Grenze blinkt einmal |
| 9 | **Blatt** | Ziehen | Feder | drei Rastpunkte; der Plan behält den Standort im sichtbaren Teil | unverändert |

### 5.1 Rückblick „Stift von oben“

1. **Schnitt, kein Flug:** Der Plan steht sofort am Anfang des ältesten neuen Wegs, flach, Norden oben, Zoom ca. 16,5 (Straßennamen gut lesbar).
2. **Die Marker-Spitze** erscheint: eine kleine schräge Keilspitze in Markerfarbe mit schwarzem Schaft-Ansatz, etwa 28 px, leicht gedreht in Laufrichtung. Sie setzt auf (kurzes Absenken, 150 ms).
3. **Sie fährt den Weg ab.** Der Plan gleitet so mit, dass die Spitze im mittleren Drittel bleibt. Der Plan dreht sich nie.
4. **Tempo nach Inhalt:** neue Stücke ruhig (etwa zwei Häuserblocks pro Sekunde) mit Marker-Zug (Nr. 2) und Straßen-Schildern (Nr. 3, höchstens eines pro Sekunde). Bekannte Stücke: die Spitze hebt ab und gleitet im Fünffachen darüber. Gefahrene Abschnitte: aus der Spitze wird eine Kuli-Spitze, der Plan zoomt auf 14, die rote Linie läuft im Zehnfachen durch.
5. **Zeitbudget 20 Sekunden:** Vorab wird die Dauer berechnet. Reicht das Budget nicht, wird zuerst das Tempo über Bekanntem erhöht, dann werden Wege ohne Neues ausgelassen, zuletzt nur die drei Wege mit dem meisten Neuen gezeigt. Der Rest steht als Zahl im Blatt.
6. **Zwischen zwei Wegen:** Spitze hebt ab, 300 ms Überblendung, Spitze setzt neu auf.
7. **Bedienung:** Tippen überspringt alles bis Nr. 6. Gedrückt halten spult dreifach vor. Im Blatt steht „Überspringen“.
8. **Ende:** Spitze hebt ab und verschwindet, weiter mit Nr. 6 (Zahl) und gegebenenfalls Nr. 7 (Stempel).

Technik: Kamerabahn und Stiftbahn vorab berechnen (`replay.ts`, mit Tests), je Bild `map.jumpTo`. Die Spitze ist ein HTML-Element über der Karte, nicht Teil der Karte.

### 5.2 Selbst stempeln

1. Das Blatt fährt auf Höhe 3 in den Stempelpass. Die Seite zeigt die bisherigen Stempel.
2. Der neue Stempel schwebt als Schatten-Umriss leicht vergrößert über einer freien Stelle und folgt dem Finger, wenn man ihn zieht. Darunter steht „Tippen zum Stempeln“.
3. **Tipp:** Der Stempel fällt in 120 ms aufs Papier (von 1,25 auf 1,0), die Tinte erscheint in 80 ms von blass zu voll, die Seite ruckt 2 px nach. Ton: ein kurzes, trockenes „Tock“ (Web Audio, eine kleine Klangdatei; abschaltbar). Der Stempel hebt 300 ms später ab und verschwindet nach oben, der Abdruck bleibt.
4. Ort und Drehung des Abdrucks kommen vom Tipp (Drehung: zufällig zwischen −12° und +12°, einmalig) und werden gespeichert. Der Stempel sitzt also dort, wo Michi ihn hingesetzt hat.
5. Mehrere fällige Stempel kommen nacheinander. „Später stempeln“ lässt sie offen; im Stempelpass warten sie dann als Umriss.
6. Gleichzeitig wird das Feld auf der Stempelkarte des Veedels gefüllt (ohne eigene Animation).

---

## 6. Regeln

### 6.1 Was zählt (OSM-Tags, in dieser Reihenfolge)

**Stufe 1, zählt nie:**
- `highway` = `motorway`, `motorway_link`, `service`, `track`, `footway`, `cycleway`, `path`, `steps`, `bridleway`, `corridor`, `construction`, `proposed`, `platform`, `bus_guideway`, `raceway`
- `motorroad=yes`
- `access` = `private`, `no`, `customers`, `delivery`, `permit`, `agricultural`, `forestry`, `military`, außer `foot` oder `bicycle` = `yes`/`designated`/`permissive`
- `foot=no` und zugleich `bicycle=no`; `area=yes`; `indoor=yes`
- `trunk`/`trunk_link`, außer mit Gehweg (`sidewalk` ≠ `no`) oder `foot`/`bicycle` = `yes`/`designated`

**Stufe 2, zählt sicher:**
- `primary`, `secondary`, `tertiary` (mit `_link`)
- `residential`, `living_street`, `unclassified`, `pedestrian` **mit `name`**

**Stufe 3, Hofweg-Regel:** dieselben vier Klassen **ohne `name`** zählen nur, wenn der namenlose Abschnitt an beiden Enden an eine zählende Straße anschließt. Namenlose Stiche zählen nicht. (Je Land abschaltbar, siehe 7.6.)

**Für Fahrten sichtbar, ohne zu zählen:** `motorway`, `trunk` (mit `_link`), `motorroad=yes`.

**Fuß- und Radwege zählen nicht.** Fußgängerzonen (`pedestrian`) zählen.

**Zwei Fahrbahnen:** parallele Einbahn-Stücke gleichen Namens (bis 35 m Abstand bei Hauptstraßen, 22 m bei Wohnstraßen) sind Partner. Jedes zählt halb, und wer eine Seite sieht, hat beide gesehen.

**Eigene Ausnahmen:** „Hier komme ich nicht hin“ nimmt eine Straße (alle Stücke gleichen Namens zwischen zwei Kreuzungen) aus Michis Nenner. Rücknehmbar.

### 6.2 Fortbewegung pro Abschnitt

Grundgedanke: **Die Fortbewegung wechselt nur, wenn man steht.**

1. **Säubern:** Punkte mit Ungenauigkeit über 25 m weg (in gefahrenen Abschnitten bis 50 m), Sprünge über 50 m/s weg, Tempo über 10 s glätten.
2. **Trennen** bei jedem Halt (unter 1 m/s für mindestens 30 s), bei Lücken über 60 s und bei einem `motion`-Wechsel zwischen {walking, running, cycling} und {automotive}, der mindestens 20 s anhält.
3. **Einstufen:** mit `motion` (Overland liefert es): Anteil `automotive` ≥ 50 % → gefahren; Anteil walking/running/cycling ≥ 60 % → aktiv. Sonst nach Tempo: 90-%-Wert über 30 km/h → gefahren, sonst aktiv. Zwischen 30 und 38 km/h ohne `motion`: gefahren, als „unsicher“ markiert.
4. **Glätten:** Abschnitte unter 60 s oder 150 m zwischen zwei gleichen Nachbarn übernehmen deren Einstufung.
5. **Im Zweifel gefahren.** Ein falscher Kuli-Strich wird später übermalt, ein falscher Marker verfälscht die Prozente.
6. Korrektur von Hand in der Weg-Ansicht; bleibt bei Neuberechnungen erhalten.

### 6.3 Abgleich und Zustände

- Stück gesehen: mindestens 60 % der Länge höchstens 20 m seitlich neben der Spur (gefahren: 30 m), Richtung ±45°, Lücken über 60 s nicht überbrückt.
- Zustand je Stück: `0` offen · `1` gefahren · `2` aktiv. Es gilt der höchste je erreichte Wert („Gelb hat Vorrang“).
- Je Stück wird das Datum des ersten aktiven Sehens gespeichert (für Etikett und Jahresfarbe).

### 6.4 Prozente

- Prozent = Meter im Zustand `2` / zählende Meter des Gebiets (ohne eigene Ausnahmen).
- Eine Nachkommastelle bis 99,9 %; „100 %“ nur bei vollständig.
- **Straße komplett:** alle Stücke gleichen Namens in derselben Gemeinde zu mindestens 95 % im Zustand `2`.

### 6.5 Stempel

Alle Stempel werden aus den gespeicherten Daten berechnet, auch rückwirkend. Ein vergebener Stempel wird nie aberkannt.

| Art | Stempel | Bedingung | Stufen |
|---|---|---|---|
| **Veedel** | Betreten | erstes aktives Stück im Veedel | – |
| | Veedel-Prozent | Prozent erreicht | 10, 25, 50, 75, 100 |
| **Erkunden** | Veedel gesammelt | Anzahl betretener Veedel | 5, 10, 25, 50, 86 |
| | Straßen komplett | Anzahl kompletter Straßen | 10, 50, 100, 250, 500 |
| | Bezirk rundum | alle Veedel eines Bezirks betreten (Name des Bezirks auf dem Stempel) | je Bezirk |
| | Stadt rundum | alle Veedel einer Stadt betreten | je Stadt |
| | Kilometer Neues | aktiv entdeckte Kilometer gesamt | 10, 50, 100, 250, 500 |

„Als Nächstes“ im Stempelpass zeigt die zwei Stempel mit dem kleinsten fehlenden Rest in Metern.

---

## 7. Datenbasis und Pipeline

### 7.1 Entscheidung

| Frage | Entscheidung |
|---|---|
| Straßennetz zum Zählen **und** Zeichnen | eigene Aufbereitung aus OSM-Rohdaten (Geofabrik) zu einer Kachel-Datei „Netz“ (PMTiles) auf Cloudflare R2 |
| Grundkarte (Flächen, Häuser, Wasser, Bahn) | vorerst OpenFreeMap, neu eingefärbt |
| Gebiete | OSM-Verwaltungsgrenzen aus derselben Rohdatei; amtliche Daten nur als Gegenprobe |
| Overture Maps | nicht als Hauptquelle (zweite Übersetzung derselben OSM-Daten); als Ersatz für Grenzen denkbar, wo OSM nichts hat |

### 7.2 Verarbeitung

Ein Befehl `npm run pipeline -- <region>` (Region = Geofabrik-Pfad, z. B. `europe/germany/nordrhein-westfalen`), lauffähig auf Michis Mac und in GitHub Actions.

| Schritt | Werkzeug | Ergebnis |
|---|---|---|
| Laden | `curl` | `.osm.pbf` der Region |
| Filtern | `osmium tags-filter` | nur `highway`, `boundary=administrative`, `place` |
| Exportieren | `osmium export` | zeilenweises GeoJSON |
| Regeln, Stücke, Gebiete | Node-Skript mit `packages/core` | Netzgraph, Hofweg-Prüfung, Partner-Fahrbahnen, Stücke à 25 m mit ID `w<Weg-ID>:<Nr>`, kleinstes Gebiet je Stück, Summen und Straßenlisten je Gebiet |
| Kacheln | `tippecanoe` | `netz.pmtiles` |
| Prüfen und Hochladen | Skript, `rclone`/`wrangler` | Abweichung der Summen je Gemeinde zum Vorlauf höchstens 3 %, sonst Abbruch |

**Ebene `netz`** (volle Auflösung auf Zoom 14): `id`, `z` (1 zählt · 2 nur für Fahrten · 0 zählt nicht), `g` (kleinstes Gebiet), `n` (Name), `m` (Meter, bei Partnern halbiert), `p` (Partner-ID), `k` (Klasse fürs Zeichnen: haupt/wohn), `w` (bei `z=0` der Grund: zufahrt, privat, weg, stich).
**Ebene `gebiete`:** Flächen mit `id`, `name`, `ebene`, `eltern`, `wort` (ortsübliches Wort), `ungefaehr`.
**`gebiete/<Gemeinde-ID>.json`:** Baum, zählende Meter, Straßenliste je Veedel.
**`stand.json`:** Datenstand und Version; ändert sie sich, rechnet der Worker im Hintergrund neu.

Aktualisierung monatlich. Speicher: R2 (bis 10 GB kostenlos, kein Entgelt für Abrufe). Hinweis: Michi hat zwei Cloudflare-Konten; R2 muss im Konto mit dem Pages-Projekt aktiv sein.

### 7.3 Wie Veedel gefunden werden

Je Gemeinde, in dieser Reihenfolge:
1. die feinste OSM-Ebene unterhalb der Gemeinde (`admin_level` 10, sonst 9, sonst 11), wenn ihre Flächen zusammen mindestens 90 % der Gemeinde abdecken. Eine zweite brauchbare Ebene wird Zwischenebene (Köln: 9 Bezirke, 86 Veedel).
2. sonst, bei mehr als 150 km zählender Straßen: **Ersatz-Veedel** aus den Ortsteil-Punkten (`place` = `suburb`, `quarter`, `neighbourhood`, `village`, `hamlet`). Jeder Punkt bekommt die Fläche, die ihm am nächsten liegt, geschnitten auf die Gemeinde. Auf dem Plan mit gepunkteter Grenze und im Blatt mit dem Zusatz „ungefähre Grenze“.
3. sonst ist die Gemeinde selbst das kleinste Gebiet.

Gebiete unter 3 km zählender Straßen werden dem Nachbarn mit der längsten gemeinsamen Grenze zugeschlagen **[ANNAHME: Schwelle nach dem ersten Lauf prüfen]**.

### 7.4 Ausbau Deutschland

**Stand der Recherche (21.11.2026):**
- Die Rohdaten für ganz Deutschland sind eine Datei von 4,5 GB bei Geofabrik, täglich aktuell. Bundesländer gibt es einzeln.
- Bis zur Gemeinde sind die OSM-Grenzen in Deutschland vollständig **[ANNAHME: aus Erfahrung, Gegenprobe mit der amtlichen Gemeindeliste im ersten Lauf]**. Darunter (Stadtbezirk, Stadtteil) ist OSM laut eigenem Wiki uneinheitlich.
- Eine bundesweit einheitliche, freie amtliche Quelle für Ortsteile gibt es nicht. Die Länder bieten Einzeldatensätze mit unterschiedlichen Lizenzen und Bezeichnungen an (teils offen, teils nicht). Deshalb sind sie keine Grundlage, höchstens später eine Verbesserung für einzelne Städte.

**Was das für die App heißt:**
- **Andere Großstädte** (Düsseldorf, Bonn, Berlin, Hamburg, München): Stadtteile sind meist in OSM vorhanden und kommen über Regel 1. Wo sie fehlen, greift Regel 2.
- **Kleinstädte und Dörfer:** Die Gemeinde ist das kleinste Gebiet, oder bei Flächengemeinden mit mehreren Dörfern bekommt jedes Dorf über Regel 2 sein Umland. Eine Gemeinde mit 40 km Straßen ist als „Veedel“ gut machbar.
- **Zwischen den Orten:** Jeder Punkt in Deutschland liegt in einer Gemeinde (oder einem gemeindefreien Gebiet, das dann direkt dem Kreis zugeordnet wird). Land- und Kreisstraßen zählen (Stufe 2), namenlose Verbindungsstraßen zählen als Verbindung (Stufe 3), Feld- und Waldwege nicht. Eine Radtour über Land färbt also die Straßen dazwischen gelb und zählt in die jeweilige Gemeinde.
- **Ebenen im Baum:** Veedel → Bezirk (wo vorhanden) → Stadt oder Gemeinde → Kreis → Bundesland. Kreis und Bundesland zeigen keine Prozentzahl als Hauptwert (immer nahe null), sondern „12 von 396 Gemeinden betreten“.

**Reihenfolge:** NRW zuerst (enthält Köln, Prüfwerte Weiden und Köln), dann ganz Deutschland in einem Lauf oder je Bundesland **[ANNAHME: ob der Standard-Rechner von GitHub für ganz Deutschland reicht, ist nicht geprüft; sonst je Bundesland oder auf dem Mac]**.

### 7.5 Ausbau Ausland

Gleiche Pipeline, gleiche Regeln. Unterschiede je Land liegen nur in zwei Stellschrauben: welche OSM-Ebenen als Veedel taugen, und ob die Hofweg-Regel gilt.

| Land | Rohdaten bei Geofabrik | Kleinstes Gebiet aus OSM | Einschätzung |
|---|---|---|---|
| **Portugal** | 403 MB | Freguesia (`admin_level` 8), unter dem Município (7) | sehr gut: Freguesias decken das ganze Land ab. Lissabon hat 24 davon |
| **Spanien** | 1,4 GB | Municipio (8); in Großstädten Distrito (9) und Barrio (10) | gut in Madrid, Barcelona, Valencia, Sevilla; in kleinen Orten ist das Municipio das kleinste Gebiet |
| **Frankreich** | 4,7 GB, Regionen einzeln | Commune (8); in Paris, Lyon, Marseille Arrondissements (9), teils Quartiers (10) | gut: Communes sind klein und flächendeckend |
| **USA** | je Bundesstaat einzeln | City (8); Neighborhoods (10) nur lückenhaft und uneinheitlich | Städte gut, Viertel schwach. Meist greift Regel 2 (Ersatz-Veedel aus den Viertel-Punkten). Für einzelne Städte später offizielle Viertel-Grenzen der Stadt |

Die Ebenen für Spanien, Frankreich und die Viertel in den USA stammen aus dem OSM-Wiki nach Erinnerung und sind beim ersten Lauf je Land zu prüfen **[ANNAHME]**. Bestätigt sind Portugal (Distrito 6, Município 7, Freguesia 8) und USA (State 4, County 6, City 8).

**Ablauf im Urlaub:**
1. Overland zeichnet wie zu Hause auf und schickt die Punkte, sobald Netz da ist.
2. Die App merkt, dass für den Ort keine Daten vorliegen, und meldet die Region an (Edge Function `region-anfordern`).
3. Ein GitHub-Lauf baut die kleinste passende Geofabrik-Region (z. B. `europe/portugal`, `north-america/us/new-york`). Dauer je nach Größe etwa 10 bis 40 Minuten **[ANNAHME]**.
4. Danach wird nachgerechnet: Gelb, Prozente, Stempel, Rückblick. Es geht nichts verloren, weil die Rohpunkte gespeichert sind.
5. Wer es vorher fertig haben will: in den Einstellungen unter „Daten“ ein Feld „Reiseziel vorbereiten“ (Ort eintippen, Lauf startet).

Schutz: ein Lauf je Region und Monat, nur für Michis Konto.

### 7.6 Wörter und Regeln je Land

| Land | Wort für das kleinste Gebiet | Hofweg-Regel (Stufe 3) |
|---|---|---|
| Deutschland | „Veedel“ in Köln, sonst „Viertel“ (bzw. „Ort“, wenn die Gemeinde selbst das kleinste Gebiet ist) | an |
| Österreich, Schweiz | „Viertel“ / „Ort“ | an |
| Spanien | „Barrio“ | an **[ANNAHME]** |
| Portugal | „Freguesia“ | an **[ANNAHME]** |
| Frankreich | „Quartier“ | an **[ANNAHME]** |
| USA | „Neighborhood“ | an **[ANNAHME]** |
| Länder, in denen viele echte Straßen in OSM keinen Namen haben | – | aus |

### 7.7 Lizenz

OSM-Daten: ODbL. In den Einstellungen unter „Quellen“: „© OpenStreetMap-Mitwirkende“ und der Datenstand.

---

## 8. Technik-Architektur

### 8.1 Rahmen

- **Web-App (PWA) auf dem Homescreen**, wie heute: Vite, React, TypeScript, MapLibre GL JS, Cloudflare Pages, Supabase.
- Keine native Hülle, kein Apple-Konto. Was dadurch nicht geht: eigene Hintergrund-Ortung, Vibration, Widgets, Live-Aktivität. Was geht: Ton (nach einem Tipp), Mitteilungen (Web-Push ab iOS 16.4 für Homescreen-Apps), Offline.

### 8.2 Module

```
streifzug/
  packages/core/   Regeln, Abschnitte (neu: legs.ts), Abgleich, Stempel (neu: stamps.ts),
                   Rückblick-Bahn (neu: replay.ts), GPX. Alles mit Tests
  apps/web/        Oberfläche, Worker, PWA
  pipeline/        neu: Datenaufbereitung (Abschnitt 7.2)
  supabase/        Tabellen, Edge Functions (overland; neu: owntracks, region-anfordern)
  .github/workflows/  Prüfungen; neu: pipeline.yml
```

### 8.3 Aufzeichnung

| Zufluss | Rolle |
|---|---|
| **Overland** (iPhone-App) → Edge Function `overland` | Hauptweg. Liefert Punkte mit `motion` |
| **OwnTracks** (iPhone-App, HTTP-Modus) → Edge Function `owntracks` | Ersatz, falls Overland nicht stabil läuft. Liefert Ort, Zeit, Genauigkeit, Tempo; `motion` **[ANNAHME: nicht vorhanden, dann nur Tempo-Regel]** |
| **„Jetzt mit offener App aufzeichnen“** | Notlösung und Live-Ansicht |
| **GPX-Import** | Nachtragen (Apple-Health-Workouts) |

Alle vier münden in dasselbe Punktformat und dieselbe Verarbeitung.

**Fehlersuche Overland (Phase 1, in dieser Reihenfolge):**
1. Kommt überhaupt eine Anfrage an? Protokoll der Edge Function ansehen.
2. Test-Sendung per `curl` mit einem Overland-Beispielpaket an genau die Adresse aus der App.
3. Antwort muss exakt `{"result":"ok"}` sein, sonst behält Overland die Punkte und sendet nicht weiter.
4. In Overland prüfen: Adresse samt Schlüssel vollständig, Aufzeichnung eingeschaltet, Standort „Immer“, „Bewegung und Fitness“ erlaubt, Stromsparmodus aus, einmal „Send Now“.
5. Kommen Punkte an, aber keine Wege: liegen sie in einer gebauten Region, werden sie abgeholt (`received_points` → Gerät)?
6. Bleibt es nach einer Sitzung unklar: OwnTracks anbinden.

**Selbstkontrolle:** Die App zeigt in den Einstellungen „Letzter Punkt: heute 17:42“ und meldet sich im Blatt, wenn 48 Stunden nichts kam.

### 8.4 Datenfluss

```
Overland / OwnTracks / offene App / GPX
   → Rohpunkte (Gerät)
   → Worker: säubern → Wege (Pause > 10 min oder Sprung > 300 m)
            → Abschnitte mit Einstufung (6.2)
            → Abgleich gegen das Netz (6.3) → Stück-Zustände
            → Summen je Gebiet → fällige Stempel
   → Oberfläche: Rückblick → Zahl → Stempeln
   → bei Netz: Rohspur und Zusammenfassung nach Supabase (Sicherung)
```

### 8.5 Datenmodell

**Auf dem Gerät (IndexedDB, Schlüssel bleiben „streifzug“)**

| Speicher | Felder |
|---|---|
| `wege` | `id`, `quelle` (overland, owntracks, app, gpx), `start`, `ende`, `meter`, `punkte`, `abschnitte` [{`von`, `bis`, `art`, `unsicher`, `vonHand`}], `stueckIds` {aktiv, gefahren}, `neuMeter`, `abgleichVersion`, `datenStand`, `gesichert` |
| `stuecke` | `id`, `zustand` (1/2), `zuerstWeg`, `zuerstAm`, `g`, `m`, `n` |
| `gebietStand` | `gebietId`, `aktivM`, `gefahrenM`, `gesamtM`, `strassenKomplett`, `datenStand` |
| `stempel` | `id`, `art`, `gebietId`, `stufe`, `faelligAm`, `wegId`, `gestempeltAm`, `x`, `y`, `drehung`, `tinte` |
| `ausnahmen` | `strasseId`, `stueckIds`, `am` |
| `einstellungen` | `markerFarbe`, `kuliFarbe`, `jahresFarben`, `ton`, `zuhause`, `rueckblickBis` |

`stuecke` und `gebietStand` sind Zwischenspeicher und jederzeit aus `wege` neu berechenbar. `stempel` nicht: einmal vergeben, bleibt.

**Supabase (ergänzt, alles mit `user_id` und Zeilenschutz)**

| Tabelle | Änderung |
|---|---|
| `tracks` | neu `segments jsonb`, `source text`; `mode` entfällt |
| `user_stamps` (neu) | Spiegel von `stempel` |
| `user_exceptions` (neu) | Spiegel von `ausnahmen` |
| `user_settings` | neu `marker_color`, `pen_color`, `year_colors`, `sound` |
| `region_requests` (neu) | `region`, `status`, `requested_at`, `built_at` |
| `received_points`, `receive_tokens` | bleiben |
| `areas`, `user_tile_coverage`, `user_area_progress` | werden nicht mehr gebraucht; leer lassen, nicht löschen |

### 8.6 Mitteilungen

Michi möchte nur bei einem neuen Stempel benachrichtigt werden. Stempel werden aber auf dem Gerät berechnet, und das geschieht erst beim Öffnen. Eine Mitteilung „neuer Stempel“ setzt deshalb voraus, dass der Server selbst rechnet. Das ist machbar (die Logik ist TypeScript und läuft auch in einer Edge Function, das Netz liegt auf R2), aber ein eigener Brocken. Deshalb:

- **Bis Phase 6: keine Mitteilungen.**
- **Phase 6:** Eine Edge Function rechnet neu eingetroffene Punkte gegen das Netz, vergleicht mit dem gespeicherten Stand und schickt bei fälligem Stempel einen Web-Push („Neuer Stempel wartet: Weiden 25 %“). Gestempelt wird weiter von Hand in der App.

### 8.7 Regeln für den Bau

- Alles über 50 ms Rechenzeit in den Worker. Die Oberfläche lädt nie Rohpunkte.
- Keine Spread-Aufrufe auf großen Listen (`push(...x)`, `Math.min(...x)`).
- Lasttest für jeden Rechenpfad (1.500 Wege, CPU vierfach gedrosselt, längste Blockade unter 0,5 s).
- `?notfall` bleibt.
- Jede Phase endet mit einem Test auf Michis iPhone, nicht nur im Browser am Rechner.

---

## 9. Umsetzungsphasen

Eine Phase zur Zeit.

### Phase 1: Aufzeichnung, die läuft (Größe M)
**Ziel:** Wege kommen ohne Handgriff an und werden richtig eingestuft.
- Overland-Fehlersuche nach 8.3; wenn nötig OwnTracks anbinden
- `legs.ts` nach 6.2 mit Tests (zu Fuß, Rad, Auto, Fuß–Bahn–Fuß, Ampelhalt, Stau, Rennrad mit und ohne `motion`)
- Stück-Zustände 0/1/2; gefahrene Abschnitte als rote Linie unter dem Gelb, auch auf Autobahnen
- Alle Zähl-Schalter, Nebel und Weißer Fleck entfernen
- Anzeige „Letzter Punkt“ und der 48-Stunden-Hinweis
- **Definition of Done:** Sieben Tage lang kommen Michis Wege an, ohne dass er die App tagsüber öffnet; kein Tag fehlt gegenüber Apple Health. Ein Weg Fuß–Bahn–Fuß zeigt zwei gelbe und einen roten Abschnitt, die Prozente ändern sich durch die Bahn nicht. Tests grün, Lasttest bestanden.
- **Abhängigkeiten:** keine

### Phase 2: Neues Aussehen (Größe M)
**Ziel:** Die App sieht aus wie auf den drei Bildern und bedient sich mit den sechs Gesten.
- Plan-Stil nach 4.5 (vorerst auf den Straßen der Grundkarte), Marker mit Multiplizieren, Kuli, Maßstab
- Blatt mit drei Höhen; Reiterleiste, Profil-Knopf und Logbuch-Seite entfernen
- Veedel-Blatt (Zahlen, Stempelkarte, Zuletzt, Noch offen), Sammlung (Veedel, Stempelpass), Einstellungen hinter „…“
- Straßen-Etikett mit „Hier komme ich nicht hin“
- Herausgezoomt: Veedel als schraffierte Flächen
- `stamps.ts` nach 6.5 mit Tests, Stempel-Formen mit Tinten-Filter (noch ohne Animation: fällige Stempel liegen einfach im Pass)
- Stiftfarben und „Jedes Jahr eine Farbe“
- Logo, App-Symbol, Startbild
- **Definition of Done:** Nebeneinander gehalten entsprechen die drei Bildschirme den Bildern (Abweichungen begründet). Jede der sechs Gesten aus 3.1 funktioniert auf dem iPhone. Nichts aus der Verbotsliste 4.1 ist zu sehen.
- **Abhängigkeiten:** Phase 1 (Zustände)

### Phase 3: Die zwei Momente (Größe M)
**Ziel:** Abends öffnen macht Freude.
- `replay.ts` (Kamerabahn, Stiftbahn, Zeitbudget) mit Tests; Rückblick „Stift von oben“ nach 5.1
- Marker-Zug, Straßen-Schild, Straße komplett, Veedel betreten, Zahl
- Selbst stempeln nach 5.2 mit Ton
- „Bewegung reduzieren“ für alles
- **Definition of Done:** Nach einem echten Tag startet beim Öffnen der Rückblick von selbst, dauert höchstens 20 Sekunden, neue Straßen sind einzeln erkennbar und benannt. Tippen überspringt in unter 300 ms. Ein fälliger Stempel lässt sich setzen, bleibt an seiner Stelle und klingt. Auf dem iPhone ruckelt nichts sichtbar.
- **Abhängigkeiten:** Phase 2

### Phase 4: Richtig zählen, ganz Deutschland (Größe L)
**Ziel:** Hofwege zählen nicht mehr, überall in Deutschland gibt es Veedel.
- R2 im richtigen Konto; `pipeline/` nach 7.2 für NRW, dann Deutschland
- Regeln 6.1 mit vollen Tags; die drei Stellen aus Bild 09 als feste Testfälle
- App liest `netz.pmtiles` und `gebiete/*.json`; alte Regionen-Dateien und `omt.ts` entfallen
- Plan zeichnet Straßen aus dem eigenen Netz: weiß nur, was zählt; Rest als Haarlinie
- Ersatz-Veedel (7.3 Regel 2), Wörter je Ort (7.6)
- Neuberechnung bei neuem Datenstand; Vorladen der Heimat-Gemeinden
- **Definition of Done:** Die Stellen aus Bild 09 zählen nicht und sind nur Haarlinien. Testpunkte in Düsseldorf, Hameln, einem Dorf ohne Ortsteile und auf einer Landstraße zwischen zwei Orten zeigen jeweils das richtige kleinste Gebiet. Weiden startet vollständig ohne Netz.
- **Abhängigkeiten:** keine harte zu Phase 2 und 3; wird danach eingebaut

### Phase 5: Ausland (Größe M)
**Ziel:** Urlaub funktioniert von selbst.
- Edge Function `region-anfordern`, GitHub-Lauf bei Bedarf, Zustand „wird vorbereitet“, „Reiseziel vorbereiten“
- Länder-Tabelle (Ebenen, Wort, Hofweg-Regel) für Portugal, Spanien, Frankreich, USA, Österreich, Schweiz
- **Definition of Done:** Ein GPX aus Lissabon und eines aus New York führen ohne Handgriff binnen einer Stunde zu Gelb, Prozent und einem „Betreten“-Stempel mit dem richtigen Wort.
- **Abhängigkeiten:** Phase 4

### Phase 6: Mitteilungen (Größe M)
- Server-seitiges Einrechnen und Web-Push nach 8.6
- **Definition of Done:** Ein Weg, der einen Stempel auslöst, führt ohne Öffnen der App binnen 30 Minuten zu genau einer Mitteilung.
- **Abhängigkeiten:** Phase 4

---

## 10. Risiken und Gegenmaßnahmen

| Risiko | Gegenmaßnahme |
|---|---|
| Overland bleibt unzuverlässig (seit 2024 nicht aktualisiert) | OwnTracks als zweite Brücke; „Letzter Punkt“ und 48-Stunden-Hinweis machen Ausfälle sichtbar; GPX-Import zum Nachtragen |
| Ohne native App bleibt die Aufzeichnung von Fremd-Apps abhängig | bewusst in Kauf genommen. Die Empfangsstelle ist so gebaut, dass später eine eigene App dieselbe Schnittstelle nutzen könnte |
| Tinten-Filter und Multiplizieren sind auf dem iPhone langsam | Stempel einmal als Bild rendern und zwischenspeichern; Körnung abschaltbar; Marker ohne Filter |
| Rückblick ruckelt | Bahn vorab berechnen, nur `jumpTo`; Stift als HTML-Element; auf dem iPhone testen, nicht am Rechner |
| Hofweg-Regel streicht echte Straßen | gilt nur für namenlose Stiche; Etikett zeigt den Grund; Summenvergleich im ersten Lauf; je Land abschaltbar |
| 100 % ist wegen OSM-Fehlern unerreichbar | „Hier komme ich nicht hin“; Straße komplett ab 95 % |
| Veedel fehlen oder sind unsinnig | 90-%-Regel, Mindestgröße, Ersatz-Veedel mit Kennzeichnung |
| Im Ausland stimmen die Ebenen nicht | Länder-Tabelle, erster Lauf je Land wird von Hand angesehen, bevor er freigegeben wird |
| Pipeline passt nicht auf den GitHub-Rechner | läuft auch auf dem Mac; je Bundesland teilen |
| Neuer Datenstand ändert Stück-IDs | Rohspuren sind die Wahrheit; Stempel werden nie aberkannt |
| Falsche Einstufung (Stau als aktiv, Rennrad als gefahren) | `motion` von Overland, „im Zweifel gefahren“, Korrektur je Abschnitt |
| Wieder Einfrieren bei vielen Daten | Regeln aus 8.7, Lasttest je Phase |
| Standortdaten | Gerät zuerst, Server nur Sicherung mit Zeilenschutz, Zuhause-Zone, Export und Löschen |
| Zu viel auf einmal | Phasen strikt nacheinander; alles aus Abschnitt 12 bleibt Vorrat |

---

## 11. Offene Entscheidungen für Michi

| Nr. | Frage | Empfehlung |
|---|---|---|
| 1 | Dunkelmodus jetzt mitbauen? | Erst nach Phase 3. Ein gedruckter Plan ist hell; die dunkle Fassung braucht einen eigenen Entwurf |
| 2 | „Losziehen“ ganz streichen? | Als unauffällige Zeile behalten, bis Overland vier Wochen stabil lief |
| 3 | Zuhause-Zone: aufzeichnen und zählen, aber nie hochladen? | Ja |
| 4 | Ersatz-Veedel mit „ungefährer Grenze“ in Städten ohne Stadtteil-Grenzen? | Ja; vorher an zwei Beispielen ansehen |
| 5 | Benannte Fuß- und Parkwege später als eigene Sammlung? | Vorrat, nicht jetzt |
| 6 | Stempeltinte nach Art (blau, schwarz, rot) oder frei wählbar beim Stempeln? | Nach Art; hält den Pass lesbar |
| 7 | Mitteilungen erst in Phase 6 in Ordnung? | Ja. Wer abends ohnehin öffnet, vermisst sie kaum |
| 8 | Soll der Rückblick auch laufen, wenn nur Gefahrenes dazukam? | Nein: dann nur eine Zeile im Blatt („Heute nur gefahren · 14 km“) |

---

## 12. Ideen-Vorrat (nicht eingeplant)

Ideen aus dem Sparring, nach Nähe zur App sortiert. Nichts davon wird ohne Michis Wort gebaut.

| Idee | Was es wäre |
|---|---|
| **Straßenverzeichnis** | wie hinten im Stadtplan: alle Straßen des Veedels von A bis Z, gegangene mit Marker hinterlegt. Könnte „Noch offen“ zur vollen Ansicht erweitern |
| **Zeitregler** | ein Schieber am Plan: „So sah dein Plan im März aus.“ Passt zu den Jahresfarben |
| **Heute vor einem Jahr** | beim Öffnen gelegentlich eine Zeile mit dem Weg von damals, zum Abspielen |
| **Erstbegehung** | im Etikett einer Straße neben dem Datum auch, wie oft man dort war |
| **Reise-Stempel** | Ortsstempel je neuer Stadt und Land (im Sparring zurückgestellt) |
| **Wochenserien** | Stempel für Wochen in Folge mit Neuem (zurückgestellt) |
| **Themen-Sammlungen** | alle Rheinbrücken zu Fuß, alle Dichterstraßen, die längste Straße des Veedels |
| **Runden-Vorschlag** | „25 Minuten ab hier mit 900 m Neuem“ als Linie auf dem Plan |
| **Familien-Pass** | gemeinsamer Pass oder mehrere Pässe nebeneinander; braucht echte Konten |
| **Plan als Poster** | das Veedel mit allem Gelben als druckbares Bild |
| **Jahresrückblick** | das Jahr als Film, in dem der Plan nach und nach gelb wird |
| **Kinder-Stempel** | eigene, einfache Stempel für Spielplätze oder Lieblingsorte, von Hand gesetzt |

---

## 13. Übergabe an den Entwickler-Chat

**Was Michi mitschickt**
1. dieses Dokument (vollständig einfügen oder als Datei anhängen)
2. vier Bilder von der Design-Leinwand: „Plan“, „Viertel“, „Stempelpass“ (Seite „E verfeinert“) und „Logo“. Der Link zur Leinwand ist privat; ein anderer Chat kann ihn nicht öffnen, deshalb als Bilder exportieren

**Erste Nachricht an den Entwickler-Chat (Vorschlag)**

> Hier ist der neue Bauplan für Unterwegs (Fassung 2) mit vier Bildern. Er ersetzt PLAN.md, was Aufbau, Design, Regeln und Phasen angeht. Bitte:
> 1. Lies den Bauplan ganz und sag mir in höchstens zehn Punkten, wo er dem heutigen Code widerspricht oder wo dir etwas fehlt.
> 2. Trage die Entscheidungen aus Abschnitt 0 in `docs/entscheidungen.md` ein und ersetze `docs/PLAN.md` durch den Bauplan.
> 3. Beginne dann mit Phase 1 und nur mit Phase 1. Fang mit der Overland-Fehlersuche aus Abschnitt 8.3 an und sag mir, was ich am iPhone prüfen soll.
> Arbeite Phase für Phase, jede endet mit einem Test auf meinem iPhone.
