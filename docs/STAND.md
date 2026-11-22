# Stand (22.11.2026)

Live: https://streifzug.pages.dev · Repo: lohmannmichael/streifzug · Umgebung „Michis Apps“ (Supabase- und Cloudflare-Token)

**Geltender Plan: `docs/PLAN-3.md` (Bauplan Fassung 3, Umbauplan).** Fassung 2 (`docs/PLAN.md`) gilt weiter für Zählregeln, Datenbasis und Design-System. Ältere Notizen: `docs/archiv/STAND-bis-2026-11-22.md`.

## Was läuft
- Plan im Druck-Stil, Textmarker (deckend) für zu Fuß und Rad, rote Kuli-Linie für gefahren, Parkwege schmal gelb (zählen nicht)
- Blatt mit drei Höhen, Menü „…“ (Städte und Veedel, Letzte Wege, Stempelpass, Einstellungen), Stempel mit Tinten-Filter
- Aufzeichnung über Overland, Abholen beim Öffnen und alle 5 Minuten, Rückblick beim Öffnen (nur Gelb)
- Erkennung: Abschnitte je Halt, Auto nur bei passendem Tempo, eine Fahrt mit einmal über 40 km/h ist Auto, Ecken und kurze Lücken werden geschlossen (`ABGLEICH_VERSION` 7)
- Orte ohne Region: behalten, „Wird vorbereitet“, Wünsche in `region_wishes`
- Konto: anonym; neues Konto nur, wenn das alte wirklich gelöscht ist; Overland-Verbindung und eigene Wege werden vom Server zurückgeholt

## Etappen (Fassung 3)
| Etappe | Schritte | Stand |
|---|---|---|
| A Sichern | A1 Repo bereinigen · A2 Konto (Mail + Passwort) · A3 Exportieren | erledigt und von Michi geprüft (22.11.) |
| B Blatt | B1 Inhalt kürzen · B2 zwei Höhen, folgt dem Finger · B3 Herunterziehen aus dem Inhalt | erledigt (22.11., Höhe 75 % nach Michis Wunsch) |
| C Vertrauen | C1 Statuszeile Aufzeichnung · C2 Abschnitt umstellen · C3 Fehler und Wartezustände · C4 Zuhause-Zone entfernen | fertig (22.11.) |
| D Aufbau | D1 Pass · D2 Orte · D3 Stempel · D4 Rückblicke · D5 Einstellungen · D6 Quellenhinweis · D7 Wörter · D8 Altes entfernen | D1–D7 gebaut (22.11.), D8 offen |
| E Robust | E1 Oberflächentests · E2 Karte aufteilen · E3 Tempo · E4 Orte bei Bedarf laden | offen |
| F Neues | F1–F7 | offen |

## Offene Fragen an Michi

## Zu Beginn jeder Sitzung
- `select name, meters, first_seen from region_wishes` prüfen und Orte mit `npm run region` aufnehmen
