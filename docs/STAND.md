# Stand (22.11.2026)

Live: https://streifzug.pages.dev · Repo: lohmannmichael/streifzug · Umgebung „Michis Apps“ (Supabase- und Cloudflare-Token)

**Geltender Plan: `docs/PLAN-3.md` (Bauplan Fassung 3, Umbauplan).** Fassung 2 (`docs/PLAN.md`) gilt weiter für Zählregeln, Datenbasis und Design-System. Ältere Notizen: `docs/archiv/STAND-bis-2026-11-22.md`.

## Was läuft
- Plan im Druck-Stil, Textmarker (deckend) für zu Fuß und Rad, rote Kuli-Linie für gefahren, Parkwege schmal gelb (zählen nicht)
- Blatt mit zwei Höhen, Pass oben rechts (Orte, Stempel, Rückblicke, Einstellungen), Stempel mit Tinten-Filter
- Aufzeichnung über Overland, Abholen beim Öffnen und alle 5 Minuten, Rückblick beim Öffnen (F1: jeder Weg einzeln nachgefahren, dünne Tintenlinie, Gelb im selben Takt, Auto rot und schnell)
- Nach einem Flug: weiter Sprung nach mindestens 10 Min. Pause gilt als neuer Anfang, nicht als Ausreißer
- Erkennung: Abschnitte je Halt, Auto nur bei passendem Tempo, eine Fahrt mit einmal über 40 km/h ist Auto, Ecken und kurze Lücken werden geschlossen, Lücken entlang der Straße nachgezeichnet, Gegenfahrbahn zählt mit, Wirtschaftswege und Zufahrten ab 100 m schmal gelb (`ABGLEICH_VERSION` 10)
- Oberflächentests (E1): 25 Abläufe im iPhone-Format, laufen bei jedem Push auf GitHub (`npm run e2e`)
- Karte in Teile mit je einer Aufgabe zerlegt (E2, `karte/`)
- Öffnen zeigt sofort den letzten Stand (E3, Gerätedatenbank `streifzug-stand`); Messung mit einem Jahr Daten: `MESSEN=1 npx playwright test e2e/tempo.spec.ts`
- Orte bei Bedarf (E4): vorab nur die Orte-Liste; ein Ort wird geladen, wenn der Plan hinschaut, dort Wege liegen oder er geöffnet wird; danach bleibt er auf dem Gerät (Zwischenspeicher „orte“, bis etwa 100 Orte)
- Stempel für Orte und Länder (F7): „Köln betreten“, „Einreise DE“, datiert mit dem ersten Weg dort
- Rückblicke mit Kacheln (F2): Diese Woche, Monat, Jahr, vergangene Monate; Abspielen eines Zeitraums mit Datum oben und Zahlen am Ende; „Dein Oktober ist fertig“ im Blatt
- Straße komplett (F4): Name mit Textmarker unterlegt, Etikett „komplett seit“, Viertel bei 100 % fein schraffiert, Stempel „Straßen komplett“ zählt
- Deutschland-Blick (F5): unter Zoom 8,5 feine Linien aller Wege und ein Punkt je Ort, Tipp öffnet den Ort
- Reisen (F6): Orte → Reisen (über 50 km von Zuhause, mindestens eine Nacht), Rückblick je Reise, umbenennbar
- Zeitreise (F3): Rückblicke → Zeitreise, Schieber vom ersten Tag bis heute, Plan und Prozent laufen mit
- Plan: eine Linie je Straße (Gehwege neben Straßen, zweite Fahrbahn, Rot neben Gelb, kurze Stummel und Schlaufen an Kreuzungen werden nicht gezeichnet)
- Orte ohne Region: behalten, „Wird vorbereitet“, Wünsche in `region_wishes`
- Konto: anonym; neues Konto nur, wenn das alte wirklich gelöscht ist; Overland-Verbindung und eigene Wege werden vom Server zurückgeholt

## Etappen (Fassung 3)
| Etappe | Schritte | Stand |
|---|---|---|
| A Sichern | A1 Repo bereinigen · A2 Konto (Mail + Passwort) · A3 Exportieren | erledigt und von Michi geprüft (22.11.) |
| B Blatt | B1 Inhalt kürzen · B2 zwei Höhen, folgt dem Finger · B3 Herunterziehen aus dem Inhalt | erledigt (22.11., Höhe 75 % nach Michis Wunsch) |
| C Vertrauen | C1 Statuszeile Aufzeichnung · C2 Abschnitt umstellen · C3 Fehler und Wartezustände · C4 Zuhause-Zone entfernen | fertig (22.11.) |
| D Aufbau | D1 Pass · D2 Orte · D3 Stempel · D4 Rückblicke · D5 Einstellungen · D6 Quellenhinweis · D7 Wörter · D8 Altes entfernen | fertig (22.11.), Michi prüft eine Woche |
| E Robust | E1 Oberflächentests · E2 Karte aufteilen · E3 Tempo · E4 Orte bei Bedarf laden | erledigt (22.11.) |
| F Neues | F1–F7 | alle erledigt (22.11.), Michi prüft am iPhone |

## Offene Fragen an Michi
- Reisen (F6): Passen die Schwellen (über 50 km von Zuhause, mindestens eine Nacht)? Reisenamen sollen ins Konto?
- Rückblick (F1): nah genug, zu schnell, zu langsam? (an drei echten Tagen prüfen)
- Wirtschaftswege und Zufahrten ab 100 m werden schmal gelb gezeichnet: passt das so?
- Notizen aus der Prüfwoche (Etappe D) fehlen noch; in der Sitzung vom 22.11. stand nur der Platzhalter
- Eine Woche normal nutzen (Abschluss Etappe D) und aufschreiben, wo er sucht oder was hakt
- Overland: „Min Time Between Points“ auf 10 s stellen; Mitteilungen von Overland ggf. aus (Statuszeile in Unterwegs reicht)
- Test, ob Overland nach „Location updates were stopped“ von selbst weiterläuft
- Anmelden mit Apple: später (Michi 22.11.: „Erst Mail, später Apple“), braucht Apple-Entwicklerkonto

## Zu Beginn jeder Sitzung
- `select name, meters, first_seen from region_wishes` prüfen und Orte mit `npm run region` aufnehmen
