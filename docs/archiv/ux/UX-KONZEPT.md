# Streifzug: UX- und UI-Konzept

Stand: 19.11.2026 · Drei Entwürfe mit Bewertung, Empfehlung und den Grundlagen, damit die App intuitiv und flüssig läuft.
Bilder: `a-karte-zuerst.png`, `b-sammelalbum.png`, `c-logbuch.png` (iPhone-Ansicht, echte Karte von Weiden, gelbe Straßen sind Beispieldaten).

---

## 1. Wofür Menschen die App öffnen

Die App läuft meistens **im Hintergrund**. Geöffnet wird sie in wenigen, kurzen Momenten. Jeder Bildschirm muss einen davon in unter 3 Sekunden bedienen:

| Moment | Frage im Kopf | Was die App sofort zeigen muss |
|---|---|---|
| Nach einem Spaziergang | „Was habe ich geschafft?“ | neue Straßen, neuer Prozentwert, Meilenstein |
| Vor dem Losgehen | „Wohin heute?“ | weiße Flecken in der Nähe |
| Zwischendurch | „Wie weit bin ich?“ | Prozent im eigenen Stadtteil, nächstes Ziel |
| Etwas Besonderes | „Das will ich zeigen.“ | fertiges Teilen-Bild |
| Erster Start | „Was ist das, was muss ich tun?“ | in 3 Schritten zur Karte mit erster Erlaubnis |

**Leitsätze**
1. **Automatisch vor manuell:** Nichts muss man starten, wenn es auch von selbst geht
2. **Stadtteil vor Stadt:** Köln mit 0,4 % frustriert, Weiden mit 36 % motiviert. Gezeigt wird immer das kleinste sinnvolle Gebiet
3. **Immer ein nächstes Ziel:** „Noch 1,4 km bis 40 %“ statt nur einer Zahl
4. **Gelb ist Belohnung:** Gelb gibt es nur für Entdecktes, nie als Deko
5. **Sofort da:** Die App öffnet aus dem Gerätespeicher, ohne Ladekreisel

---

## 2. Drei Entwürfe

### A „Karte zuerst“ (wie Apple Karten)
Ein Bildschirm: Die Karte mit gelben Straßen ist alles. Oben Suche und Profil, unten ein Blatt mit Stadtteil, Prozent, nächstem Ziel und „Losziehen“. Ein Hinweis zeigt den nächsten weißen Fleck.

- **Gut:**
  - Sofort verständlich, jede:r kennt Karten-Apps
  - Das Gelb auf der Karte ist das Produkt: man sieht den Fortschritt, statt ihn zu lesen
  - Am stärksten beim „Wohin heute?“
  - Passt 1:1 zur späteren iPhone-App (natives Blatt mit drei Höhen)
- **Schlecht:**
  - Belohnung nach dem Spaziergang ist schwächer, man muss selbst suchen, was neu ist
  - Stadtteile vergleichen geht nur über die Suche
  - Karte kostet mehr Akku und Daten als eine Liste
  - Kann wie „noch eine Karten-App“ wirken

### B „Sammelalbum“ (wie Fitness-Ringe)
Start ist eine Übersicht: „+12 neue Straßen heute“, darunter die Stadtteile als Sammelkarten mit Prozent, Stempel und Abzeichen. Die Karte ist ein eigener Reiter.

- **Gut:**
  - Stärkster Belohnungsmoment, man sieht in einer Sekunde, was neu ist
  - Sammeltrieb: Stadtteile wie Karten im Album, Abzeichen und Stempel
  - Ideal für eine App, die meist im Hintergrund läuft
  - Jede Karte ist ein fertiges Teilen-Motiv
- **Schlecht:**
  - Das Entdecken auf der Karte rückt in den zweiten Reiter
  - Risiko „Fitness-Tracker-Gefühl“ und zu viel Spielerei
  - Mehr Gestaltungsaufwand (Kartenbilder, Abzeichen)
  - Am Anfang mit 0 % wirkt das Album leer

### C „Logbuch“ (wie ein Reisetagebuch)
Start ist eine Zeitleiste: Jeder Streifzug ist ein Eintrag mit Kartenausschnitt, km, neuen Straßen und dem Sprung „34 % auf 36 %“. Meilensteine erscheinen als eigene Einträge mit „Teilen“.

- **Gut:**
  - Erzählt Geschichten: Erinnerungen an Runden und Reisen, stark im Urlaub
  - Einträge entstehen automatisch, passt perfekt zum Hintergrund-Aufzeichnen
  - Natürliche Teilen-Einheit („meine Runde heute“)
  - Gute Grundlage für Monats- und Jahresrückblicke
- **Schlecht:**
  - Gesamtfortschritt geht in der Liste unter
  - „Wohin heute?“ wird kaum beantwortet
  - Liste wird lang, braucht Gruppierung
  - Ähnelt Strava, verwässert den eigenen Charakter

### Bewertung (1 = schwach, 5 = stark)

| Kriterium | A Karte | B Album | C Logbuch |
|---|---|---|---|
| Intuitiv beim ersten Öffnen | 5 | 4 | 4 |
| Belohnung und Wiederkommen | 3 | 5 | 4 |
| Entdecken und Planen | 5 | 2 | 2 |
| Teilen und Marketing | 3 | 5 | 4 |
| Passt zu „läuft im Hintergrund“ | 3 | 5 | 5 |
| Eigener Charakter | 4 | 4 | 2 |
| Aufwand (5 = gering) | 4 | 3 | 3 |
| Passt zur späteren iPhone-App | 5 | 4 | 4 |
| **Summe** | **32** | **32** | **28** |

---

## 3. Empfehlung: A als Zuhause, B und C als Reiter

Kein Entwurf gewinnt allein. A und B liegen gleichauf und ergänzen sich. Deshalb:

- **Reiter „Karte“ (Start, Entwurf A):** Karte mit gelben Straßen, Blatt mit Stadtteil, Prozent, nächstem Ziel, „Losziehen“, Hinweis auf den nächsten weißen Fleck
- **Reiter „Gebiete“ (Entwurf B):** Sammelalbum der Stadtteile mit Prozent, Stempeln und Abzeichen
- **Reiter „Streifzüge“ (Entwurf C, schlank):** Logbuch der Runden, Meilensteine mit „Teilen“
- **Profil und Einstellungen:** über den runden Knopf oben rechts auf der Karte, nicht als eigener Reiter
- **Belohnungsmoment aus B auf der Karte:** Nach einem Streifzug zeigt das Blatt beim nächsten Öffnen einmal „Seit gestern +12 Straßen, Weiden 34 % auf 36 %“, dann wieder den Normalzustand

```
┌───────────────────────────┐
│ [Suche ............] (ich)│
│                           │
│   Karte mit gelben        │
│   Straßen                 │
│ (Weißer Fleck in 300 m)   │
├───────────────────────────┤
│ Weiden            36 %    │
│ ███████░░░░ noch 1,4 km   │
│ [      Losziehen       ]  │
├───────────────────────────┤
│ Karte · Gebiete · Streifz.│
└───────────────────────────┘
```

---

## 4. So läuft es intuitiv und flüssig

### Erster Start (höchstens 3 Schritte, überspringbar)
1. **Ein Satz und ein Bild:** „Jede Straße, die du gehst, wird gelb.“
2. **Standort mit Vorab-Erklärung:** erst unsere Erklärung, dann die Systemfrage
   - Web-App: „Während der Nutzung“
   - iPhone-App: zuerst „Beim Verwenden“. Nach dem ersten Streifzug fragen wir mit Begründung nach „Immer“ (so verlangt es iOS, und so wird es häufiger erlaubt)
3. **Heimat-Stadtteil automatisch erkennen**, dann sofort die Karte

- **Kein Konto zum Start:** Supabase legt eine anonyme Sitzung an. Das Konto (Mail-Link oder Apple) kommt erst, wenn man Fortschritt sichern oder teilen will. Jede Hürde vor dem ersten Erfolg kostet Nutzer:innen

### Karte
- **Semantischer Zoom:**
  - Rausgezoomt: Stadtteile als Flächen, je gelber, desto mehr entdeckt
  - Reingezoomt: einzelne Straßen
  - Antippen einer Fläche: Das Blatt zeigt diesen Stadtteil
- **Kontext folgt dir:** Das Blatt zeigt den Stadtteil, in dem du gerade bist. Ein anderer lässt sich per Antippen oder Suche wählen
- **Weißer Fleck:** nächste unentdeckte Straße im Umkreis von 500 m; Antippen zeigt sie auf der Karte
- **Ruhige Kamera:** keine Flüge bei „Bewegung reduzieren“, Karte ohne Drehen

### Unterwegs
- **Live:** Die eigene Spur wird in Echtzeit gelb, dazu ein Zähler „+3 Straßen“
- **Web-App:** Bildschirm bleibt an
- **iPhone-App:** Live-Aktivität auf dem Sperrbildschirm und kurzes Vibrieren bei jeder neuen Straße
- **Ehrliche Zustände** statt Fehlermeldungen:
  - „GPS-Signal schwach, wir warten auf ein besseres“
  - „Offline, wird nachgereicht“

### Wiederkommen, ohne zu nerven
- **Mitteilungen nur bei Meilensteinen** (25/50/75/100 % eines Stadtteils, neue Stadt), dazu optional ein Wochenrückblick am Sonntag
- **iPhone-Widget:** „Weiden 36 %, +12 diese Woche“. Man sieht den Fortschritt, ohne die App zu öffnen

### Technik für Tempo
- **Lokal zuerst:** Die Oberfläche liest nur aus dem Gerätespeicher (Web: IndexedDB, iPhone: SQLite), der Abgleich mit dem Server läuft im Hintergrund
- **Straßen-Kacheln** werden einmal geladen und gespeichert
- **Gelbe Straßen sind eine eigene Kartenebene,** die nur den sichtbaren Ausschnitt zeichnet
- **Rausgezoomt** zeigt die Karte Flächen statt tausender Linien
- **Gemeinsame Gestaltungswerte** (Farben, Schrift, Abstände) für Web und iPhone an einer Stelle

### Barrierefreiheit
- Gelb nie als einzige Information: Prozent und Text stehen immer dabei
- Für Screenreader: Die Karte hat einen Namen und eine Textzusammenfassung („Weiden, 36 %, 14 Straßen komplett“), dazu die Liste „fehlt noch“ als Text
- Systemschriftgröße, Kontraste nach WCAG AA, „Bewegung reduzieren“ wird respektiert

### Messen und Testen
- **Messpunkte:** Erster Start → Erlaubnis erteilt → erster Streifzug → nach 7 Tagen wieder da. Gemessen werden nur Ereignisse, keine Standortdaten
- **Test mit 5 Freund:innen,** drei Aufgaben, dabei beobachten statt erklären:
  1. Die App einrichten
  2. Eine Runde gehen
  3. Sagen, wie viel Prozent vom eigenen Stadtteil entdeckt sind

---

## 5. Was als Nächstes in den Bau einfließt

1. Reiter umbenennen: Karte · Gebiete · Streifzüge; „Ich“ als Knopf oben rechts
2. Blatt auf der Karte: Prozent, Fortschrittsbalken, nächstes Ziel, Kennzahlen, „Losziehen“
3. Anonyme Sitzung beim ersten Start (Teil von Phase 0)
4. Erster Start mit drei Schritten (Teil von Phase 1c, zusammen mit dem Aufzeichnen)
5. Semantischer Zoom, weißer Fleck und Belohnungsmoment (Phase 1d)
