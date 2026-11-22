# Ideenliste (Backlog)

Gesammelte Ideen, noch nicht eingeplant. Neue Ideen oben ergänzen, mit Datum. Beim Einplanen in `docs/PLAN-3.md` übernehmen und hier als „eingeplant“ markieren.

| Datum | Idee | Details | Vorschlag Zeitpunkt |
|---|---|---|---|
| 20.11.2026 | Google-Zeitachse einrechnen, mit Schalter | Michi: Google-Daten mit einrechnen, an/aus schaltbar | erledigt 20.11.2026, am 21.11.2026 wieder entfernt (App hing; stattdessen Overland) |
| 20.11.2026 | Design: Nächstes Ziel im Blatt | „Noch 300 m bis 1 %“ unter dem Balken, Schwellen 1/5/10/25/50/75/100 % (Leitsatz „immer ein nächstes Ziel“) | verworfen 20.11.2026 (Michi: brauchen wir nicht) |
| 20.11.2026 | Design: Meilenstein-Stempel | bei 1/5/10/25 % ein Stempel im Blatt („Weiden 10 %“), gleichzeitig Teilen-Motiv | erledigt 20.11.2026 (Design-Paket 3) |
| 20.11.2026 | Design: Straßenname beim Zeichen-Moment | „Neu: Aachener Straße“ statt nur „+25 m“ (Namen aus der Kachel-Ebene transportation_name) | erledigt 20.11.2026 (Design-Paket 3) |
| 20.11.2026 | Design: Unterwegs-Modus | beim Losziehen Blatt automatisch klein, Karte groß, Zähler „+3 Straßen“ oben | erledigt 20.11.2026 (Design-Paket 4) |
| 20.11.2026 | Design: Eigener Kartenstil „Stadtplan“ | ruhige Grundkarte in Tinte und Nebelgrau statt Positron, Gelb wirkt noch stärker; auch für Teilen-Bild | erledigt 20.11.2026 (Design-Paket 4) |
| 20.11.2026 | Design: Gebiete-Liste lebendiger | gelbe Mini-Balken je Viertel, Sortierung „In deiner Nähe“ / „Am meisten entdeckt“ | erledigt 20.11.2026 (Design-Paket 2) |
| 20.11.2026 | Design: Nebel über Unentdecktem | leichter grauer Schleier, Erkundetes bleibt klar („die Stadt aus dem Nebel holen“) | erledigt 20.11.2026 (Design-Paket 2) |
| 20.11.2026 | Design: Zeichen-Moment | neu entdeckte Straße wird mit Textmarker-Animation gelb, „+25 m“ erscheint kurz | erledigt 20.11.2026 (Design-Paket 2) |
| 20.11.2026 | Design: Streifzüge als Logbuch | je Runde kleiner Kartenausschnitt mit Spur (UX-Entwurf C) | erledigt 20.11.2026 (Design-Paket 3) |
| 20.11.2026 | Weißer Fleck in der Nähe | statt Leertext im Blatt: „Unentdeckte Straße 300 m entfernt: …“ | erledigt 20.11.2026 (Design-Paket 3) |
| 20.11.2026 | Erster Start mit 3 Bildschirmen | Idee, Standort-Erlaubnis mit Erklärung, Heimat-Viertel | später, vor dem Freund:innen-Test (Michi 20.11.: erst für ihn selbst nutzbar machen) |
| 20.11.2026 | App-Icon, Startbildschirm, Teilen-Bild im gleichen Look | | später, vor dem Freund:innen-Test |
| 20.11.2026 | Sehenswürdigkeiten als Checkliste (Urlaub) | automatisch abhaken bei 75 m, manuell abhaken, Top 10/25 je Stadt nach Bekanntheit; `docs/idee-sehenswuerdigkeiten.md` | MVP direkt nach Phase 1 |
| 19.11.2026 | Echte Viertel für US-Städte | offizielle Neighborhood Tabulation Areas statt OSM-Mischmasch (NYC) | mit Start USA |
| 19.11.2026 | Automatisch neue Städte anlegen | beim Betreten einer unbekannten Stadt Region im Hintergrund bauen (Job, R2) | Phase „Ausbau“ |
| 19.11.2026 | Stadt gegen Stadt (Köln vs. Düsseldorf) | gemeinsamer Fortschrittsbalken je Stadt, Presseanlass | Phase 4 |
| 19.11.2026 | Veedel-Meister:in | Krone für höchsten Prozentwert je Stadtteil | Phase 4 |
| 19.11.2026 | Jahresrückblick und Zeitraffer-Video | „Dein Streifzug-Jahr“, Nebel lichtet sich in 10 s | Phase 4 |
| 19.11.2026 | Erkunden zu zweit / Familie | gemeinsame Karte, Einladung mit Pro-Monat | Phase 4 |
| 19.11.2026 | Anstecker je Stadtteil, Poster „Mein Köln“ | Merch auf Bestellung, Urkunde bei 100 % | nach Start |
| 19.11.2026 | Team-Challenges für Firmen (BGM) | B2B-Knopf „Bring Streifzug in dein Unternehmen“ | nach Start, wenn Firmen fragen |
| 19.11.2026 | Marketing-Agents | Stadtteil-Seiten für Google, Store-Texte in 10 Sprachen, Content- und Kennzahlen-Agent | Phase 5b |
| 19.11.2026 | Hunde-Zielgruppe | Hundeschulen, „neue Gassi-Runden“ | Marketing |

Mehr zu Marketing und Business: `docs/BUSINESSPLAN.md`.

## 22.11.2026: Lücken über die Straßen nachzeichnen (Michi)
- Wunsch: Overland seltener Punkte schicken lassen (z. B. 10 s) und die App zeichnet den Weg dazwischen selbst über die Straßen nach („Map Matching“)
- Einschätzung: geht, wenn nur eindeutige Wege bis ca. 150 m gefüllt werden (kürzester Weg über das Straßennetz, höchstens 1,5-mal so lang wie die Luftlinie, keine zweite fast gleich lange Möglichkeit). Bei großen Lücken (Rad, 30 s, 200 m) würde geraten → falsches Gelb
- Hinweis: „Min Time Between Points“ spart kaum Akku (das GPS läuft weiter); Akku spart „Desired Accuracy 10m“
- Stand: vorgemerkt, nicht vor Etappe D (Regel aus Fassung 3), außer Michi zieht es vor
