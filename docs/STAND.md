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
| A Sichern | A1 Repo bereinigen · A2 Konto per Mail-Code · A3 Exportieren | A1 erledigt (22.11.), A2 wartet auf Entscheidung Mail-Versand |
| B Blatt | B1 Inhalt kürzen · B2 zwei Höhen, folgt dem Finger · B3 Herunterziehen aus dem Inhalt | offen |
| C Vertrauen | C1 Statuszeile Aufzeichnung · C2 Abschnitt umstellen · C3 Fehler und Wartezustände · C4 Zuhause-Zone entfernen | offen |
| D Aufbau | D1 Pass · D2 Orte · D3 Stempel · D4 Rückblicke · D5 Einstellungen · D6 Quellenhinweis · D7 Wörter · D8 Altes entfernen | offen |
| E Robust | E1 Oberflächentests · E2 Karte aufteilen · E3 Tempo · E4 Orte bei Bedarf laden | offen |
| F Neues | F1–F7 | offen |

## Offene Fragen an Michi
- Zielbilder (`Plan.png`, `Viertel.png`, `Stempelpass.png`, `Pass-kurz.png`, `Orte.png`, `Logo-Blatt.png`) fehlen noch → `docs/design/`
- A2: Supabase verschickt im kostenlosen Tarif nur Links, keine Codes; Mail-Texte ändern geht nur mit eigenem Mail-Versand (SMTP). Einverstanden mit einem SMTP-Dienst?
- F1: Rückblick mit dünner Tintenlinie, obwohl am 22.11. „nur das Gelb“ gewünscht war?

## Zu Beginn jeder Sitzung
- `select name, meters, first_seen from region_wishes` prüfen und Orte mit `npm run region` aufnehmen
