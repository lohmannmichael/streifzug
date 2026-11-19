# Streifzug: Businessplan (Skizze)

Stand: 19.11.2026 · Grundsatz: **Erst für Michi, Geld ist eine Option, kein Muss.**
Alle Zahlen sind Annahmen zum Weiterrechnen und nach jeder Phase zu prüfen.

---

## 1. Einordnung in einem Satz

Ein Hobby-Projekt mit eingebauter Ausstiegsoption: Wenn es dir und deinen Testpersonen Spaß macht, wird daraus ein kleines Abo-Produkt im App Store. Wenn nicht, bleibt es eine gute App für dich, ohne versenkte Kosten.

---

## 2. Stufen mit Entscheidungs-Toren

| Stufe | Zeitraum (Abende/Wochenenden) | Ziel | Tor zur nächsten Stufe |
|---|---|---|---|
| A: Für mich | Monat 0–3 (Phase 0–3) | Macht es Spaß? Funktioniert es technisch? | Du nutzt es nach 8 Wochen noch mindestens 3× pro Woche, ohne dich zu zwingen |
| B: Freund:innen-Test | Monat 3–5 (TestFlight, 10–30 Leute) | Wollen andere das auch? | Nach 4 Wochen sind mindestens 30 % noch aktiv; mindestens 20 % sagen „würde dafür zahlen“ |
| C: Start DACH | ab ca. Monat 5–7 | Erste Einnahmen, Nachweis Bezahlbereitschaft | Nach 3 Monaten mindestens 1.000 Nutzer:innen und mindestens 2 % zahlen |
| D: Ausbau | ab Jahr 2 | Englisch, Android, Partner:innen | Einnahmen decken Kosten plus Zeitwert, sonst zurück zu Hobby |

**Wenn ein Tor nicht erreicht wird:** Stufe nicht erzwingen. Entweder nachschärfen (eine Runde) oder als private App weiterführen.

---

## 3. Erlösmodell: Freemium-Abo

### Kostenlos (soll begeistern und geteilt werden)
- Heimatstadt komplett mit allen Bezirken und Stadtteilen
- Automatische Hintergrund-Aufzeichnung (Kern, nie hinter Bezahlschranke)
- Nebel-Karte, Prozent-Jagd, Teilen-Bild mit Branding

### Pro (für die, die richtig dranbleiben)
- Unbegrenzt Städte und Reisen (Urlaub, Länder-Sammlung)
- Import der Vergangenheit (Health, GPX, Zeitachse)
- Rückblicke (Monat, Jahr, Reise), erweiterte Statistiken
- Offline-Städte, „Nächste Runde“-Vorschläge, Freund:innen-Duelle
- Teilen-Bilder ohne Branding, eigene Designs

### Preis-Hypothese (mit Beta testen)
- 3,99 €/Monat oder **24,99 €/Jahr** (Jahresabo als Standard bewerben)
- Später eventuell Lifetime für 59,99 € (gut für frühe Fans, schlecht für Planbarkeit, begrenzt anbieten)

### Rechenbeispiel pro Abo (Variablen)
- Bruttopreis P = 24,99 €/Jahr
- abzüglich MwSt (19 %): 24,99 ÷ 1,19 = **21,00 €**
- abzüglich Apple-Provision 15 % (Small Business Program unter 1 Mio. $ Umsatz): 21,00 × 0,85 = **17,85 € netto pro Jahresabo**
- Monatsabo: 3,99 ÷ 1,19 × 0,85 = **2,85 € netto pro Monat**
- Variable Kosten pro aktiver Person (Speicher, Rechenzeit): unter 0,01 €/Monat, weil der Abgleich auf dem Handy läuft

---

## 4. Kosten

| Posten | Stufe A–B | Ab Stufe C |
|---|---|---|
| Apple-Entwicklerkonto | 99 $/Jahr (ab Phase 3) | 99 $/Jahr |
| Supabase | 0 € (Gratis) | ca. 25 $/Monat (Pro) |
| Cloudflare (Pages, R2-Speicher ohne Traffic-Gebühren), Karten | 0 € | 0–10 €/Monat (bei 100.000 Nutzer:innen ca. 50–150 €/Monat) |
| RevenueCat (Abo-Abwicklung) | – | 0 € bis 2.500 $ Monatsumsatz, danach 1 % |
| Domain und Mail | – | ca. 2 €/Monat |
| Gewerbe-Anmeldung | – | einmalig ca. 20–60 € |
| Rechtstexte (Datenschutz, AGB) | – | 0–200 € (Generator oder Prüfung) |
| Markenanmeldung DPMA (optional, vor Marketing) | – | ab 290 € einmalig |
| **Laufend gesamt** | **ca. 8 €/Monat** | **ca. 35 €/Monat (ca. 420 €/Jahr)** |

**Break-even laufende Kosten:** 420 € ÷ 17,85 € ≈ **24 Jahresabos.**

---

## 5. Szenarien (12 Monate nach Start)

| Szenario | Aktive Nutzer:innen | Zahlende (Conversion) | Netto-Umsatz/Jahr | Einordnung |
|---|---|---|---|---|
| Hobby | 500 | 3 % = 15 | ca. 270 € | deckt gut die Hälfte der Kosten |
| Solide | 5.000 | 4 % = 200 | ca. 3.570 € | schöner Nebenverdienst |
| Gut | 30.000 | 5 % = 1.500 | ca. 26.800 € | ernsthaftes Nebenprodukt, Infrastruktur dann ca. 100–300 €/Monat |

Rechnung: Zahlende × 17,85 € (gerechnet, als wären alle im Jahresabo).
**Realistische Erwartung:** Ohne Werbebudget entscheidet die Teilen-Funktion (Bilder, Stadtteil-Duelle), ob du eher bei „Hobby“ oder bei „Solide“ landest. Ein Vollzeit-Einkommen ist nur mit starker Mund-zu-Mund-Werbung oder B2B (Abschnitt 7) drin.

---

## 6. Wachstum ohne Budget

- **Eingebautes Teilen:** jedes geteilte Bild = Werbung (dezentes Branding, „Und wie viel kennst du von deinem Veedel?“)
- **Lokale Geschichte:** „Kölner erkundet alle 86 Veedel“ (Lokalpresse, Instagram/TikTok-Serie)
- **Communities:** Laufgruppen, Strava-Clubs, Reddit (r/running, r/cologne), Wander- und Rad-Foren
- **App-Store-Stichworte:** Stadt erkunden, Straßen sammeln, Nebel-Karte, Laufen neue Wege, Spaziergang Challenge
- **Freund:innen-Einladungen:** Duell nur zu zweit möglich → natürliche Einladung

---

## 7. B2B-Option (später, dein Heimspiel)

Erst prüfen, wenn Stufe C läuft:
- **Betriebliches Gesundheitsmanagement:** Team-Challenges („Unser Team erkundet Köln“), Preis pro Mitarbeiter:in und Monat
- **Stadt- und Tourismusmarketing:** gesponserte Veedel-Challenges, Entdecker-Routen
- **Vereine und Laufgruppen:** Gruppen-Karten, gemeinsame Ziele

Wenn → Dann: Wenn mehr als 3 Firmen von sich aus fragen, dann einen Pilotkunden mit festem Preis aufsetzen, vorher nicht.

---

## 8. Positionierung gegenüber anderen Apps

| Andere | Unser Unterschied |
|---|---|
| Wandrer (vor allem Website, über Strava) | eigene Aufzeichnung im Hintergrund, kein Strava nötig |
| CityStrides (Lauf-Fokus) | auch Spaziergang und Rad, Stadtteile im Mittelpunkt, Familie und Alltag |
| Fog of World (Nebel-Karte) | echte Straßen-Prozente je Stadtteil statt nur Fläche |

**Versprechen:** „Entdecke deine Stadt Straße für Straße, automatisch, schön und privat.“

---

## 9. Rechtliches und Formales (vor Stufe C)

- **Nebengewerbe** anmelden (Gewerbeamt); im Arbeitsvertrag prüfen, ob eine **Nebentätigkeit angezeigt** werden muss
- **Steuern:** Im App Store verkauft Apple an die Kund:innen und führt die Umsatzsteuer ab. Den Gewinn versteuerst du selbst. Einmal kurz mit Steuerberater:in klären (Kleinunternehmerregelung ja/nein)
- **Datenschutz (DSGVO):** Standortdaten sind sensibel. Nötig sind Datenschutzerklärung, Vertrag zur Auftragsverarbeitung mit Supabase, Daten in der EU, Export und Löschen in der App, keine Werbe- oder Tracking-SDKs
- **Impressum** und Kontakt
- **OSM:** Namensnennung „© OpenStreetMap-Mitwirkende“; Lizenzpflichten (ODbL) der Straßendaten beachten
- **Apple:** Begründung für die Hintergrund-Ortung, Anmeldung mit Apple, Kontolöschung in der App

---

## 10. Nächste Schritte (Business-Seite)

1. Jetzt nichts ausgeben außer Zeit. Stufe A bauen und selbst nutzen
2. Während Stufe A: 10–30 mögliche Testpersonen notieren (Freund:innen, Laufgruppe, Kolleg:innen)
3. Vor Stufe B: Name prüfen (App Store, DPMA-Register, Domain)
4. In Stufe B: Preis-Hypothese mit drei Fragen testen (würdest du zahlen, wie viel, wofür genau)
