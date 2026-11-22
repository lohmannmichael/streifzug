# Stand für die nächste Sitzung (22.11.2026)

**Bauplan Fassung 2 (`docs/PLAN.md`) gilt.** Phase 1 (Aufzeichnung) und Phase 2 (Neues Aussehen) sind gebaut und live (https://streifzug.pages.dev). Aus Phase 3 vorgezogen: Rückblick beim Öffnen (nur Gelb, ohne Stift, auf Michis Wunsch).

**Seit 21./22.11. dazugekommen (Details in `docs/entscheidungen.md`):**
- Menü oben rechts („…“): Deine Städte und Veedel, Letzte Wege, Stempelpass, Einstellungen; Übersicht Städte → Bezirke → Veedel zum Aufklappen
- Orte ohne Region werden behalten („Wird vorbereitet“), Wünsche in Supabase `region_wishes` → zu Beginn einer Sitzung prüfen und mit `npm run region` aufnehmen
- Erkennung: Tempo aus Nachbarpunkten (Overland ca. alle 6–31 s), Halt erst unter 0,4 m/s, aktive Abschnitte samt Pausen gemeinsam abgleichen; Ecken und kurze Lücken werden geschlossen (`luecken.ts`); Park-/Fußwege werden schmal gelb gezeichnet, zählen nie
- Auto vs. Rad: iPhone-„driving“ zählt nur, wenn das Tempo passt; eine Fahrt (Halte bis 5 Min.) mit einmal über 40 km/h ist ganz Auto; Lastenrad um 25 km/h bleibt Rad. `ABGLEICH_VERSION` 7
- Konto: Am 21.11. verlor Michis iPhone die App-Daten, neues anonymes Konto `50e0c8bc…`; alles vom alten Konto `a268989b…` umgehängt (alte Dateien in `spuren` als Sicherung). App legt neue Konten nur noch an, wenn das alte wirklich gelöscht ist; holt Overland-Verbindung und eigene Wege vom Server zurück; `navigator.storage.persist()`
- Einstellungen unten: „Zustand (für Claude)“ (Version, Wege, Stücke, Rechnen)

**Offen / nächste Schritte:**
1. Anmeldung per Mail (Code), damit das Konto nie mehr am Gerät hängt. Supabase Free erlaubt keine eigenen Mail-Texte (Mails kommen englisch); Alternative: eigener Mail-Versand (SMTP) oder Supabase-Plan. Danach „Mit Apple anmelden“, sobald ein Apple-Entwicklerkonto da ist
2. Overland: Michi stellt „Continuous Tracking Mode“ auf „Both“; Meldung „Location updates were stopped“ beobachten
3. Abschnitt von Hand umstellen („war Rad“ / „war Auto“), Weg-Ansicht (Bauplan 3.2)
4. Phase 3 Rest: Selbst-Stempeln mit Ton, Straßen-Schilder im Rückblick
5. Phase 4: Regionen nur bei Bedarf laden (Service Worker speichert bisher alle vorab), ganz Deutschland
6. Bilder „Plan“, „Viertel“, „Stempelpass“ für den Design-Abgleich fehlen noch

Ältere Notizen (bis 20.11.2026):

Live: https://streifzug.pages.dev · Repo: lohmannmichael/streifzug · Umgebung: „Michis Apps“ (Supabase- und Cloudflare-Token hinterlegt)

## Fertig
- Phase 0: Gerüst, Supabase (anonyme Anmeldung, Tabellen mit RLS, Storage `spuren`), Cloudflare Pages mit Auto-Deploy
- 1a: Straßen aus OpenFreeMap-Kacheln, Zählregeln, jede Straße einmal (zwei Fahrbahnen halb)
- Regionen per Name: `npm run region -- "<Ort>"` (Overture-Grenzen). Drin: Köln (86 Stadtteile), Freising, Hameln, Emmerthal, New York City (Boroughs)
- 1b/1c: Standort, Losziehen/Beenden, Speichern auf dem Gerät, Hochladen
- 1d: Abgleich Spur → Straßen, gelb auf der Karte, Prozent in Blatt und Gebiete-Liste

## Offen in Phase 1
- Design-Paket 1 erledigt 20.11.2026 (Kartenquellen eingeklappt, Prozent mit Kommastelle unter 10 %, feinere Grenzlinien, Blatt herunterziehbar)
- Design-Paket 2 erledigt 20.11.2026: Gebiete-Liste mit Mini-Balken und Sortierung (Nähe, Am meisten entdeckt, A–Z), Nebel über Unentdecktem (Schalter im Profil), Zeichen-Moment beim Aufzeichnen (Textmarker-Strich, „+N m“). Dazu Fix: gelbe Straßen gingen verloren, wenn die Karte langsamer lud als der Fortschritt (Michis Kita-Fahrt). Live auf main seit 20.11.2026
- Design-Paket 3 erledigt 20.11.2026: Logbuch im Reiter Streifzüge (Mini-Stadtplan je Runde, neu entdeckte Meter, Prozent-Sprung, neue Straßennamen, nach Monaten), Weißer Fleck im Blatt mit „Zeigen“, Meilenstein-Stempel (1/5/10/25/50/75/100 %) im Blatt und im Logbuch, Straßenname im Zeichen-Moment. 
- Design-Paket 4 erledigt 20.11.2026: Unterwegs-Modus (Blatt klappt beim Losziehen ein, Zähler „+240 m neu · 3 Straßen“ oben), eigener Kartenstil „Stadtplan“ (Positron-Daten, eigene Farben hell und dunkel, ohne Straßenschilder)
- 20.11.2026 nach Michis Wunsch: Verorten zeigt im Blatt das Viertel, in dem man steht (auch automatisch beim Öffnen, wenn der Standort schon erlaubt ist). Gebiete zeigen nur Freigeschaltetes, Städte und Bezirke zum Aufklappen (Sortierung „In deiner Nähe“ entfällt dafür)
- Import erledigt 20.11.2026 (Phase 2 vorgezogen): Profil → Importieren: Google-Zeitachse (Exportdatei) und GPX (Apple Health, Strava …), Vorschau, Schalter „Einrechnen“ je Quelle, Löschen. 21.11.: Google-Importe gelöscht und Google-Import pausiert (App hing); offen: Import komplett in den Hintergrund-Worker, dann Google wieder freischalten
- 21.11.2026: Automatisch im Hintergrund über Overland (Profil → „Automatisch aufzeichnen“), Empfang in Supabase (Edge Function `overland`). Importe und Overland laufen komplett im Hintergrund-Worker. Offen: Michi richtet Overland ein, eine Woche Akku-Test; danach Overland-Wege einzeln im Logbuch zeigen

## Reihenfolge ab 20.11.2026 (Michi: erst für ihn selbst richtig nutzbar, Freund:innen-Test später)
1. Michi nutzt die App draußen, Feedback einarbeiten
2. Phase 3 vorziehen: iPhone-App mit Hintergrund-Aufzeichnung (ohne „Losziehen“, App muss nicht offen sein)
3. Phase 2: Import (GPX erledigt; Google-Import am 21.11.2026 auf Wunsch entfernt; offen: Apple-Health-Zip direkt ohne Entpacken)
4. Sehenswürdigkeiten-Checkliste (Urlaub)
5. Später, vor dem Freund:innen-Test: erster Start mit 3 Bildschirmen, App-Icon und Startbildschirm, Teilen-Bild mit Privatzone
- Test draußen durch Michi (Weiden), Feedback einarbeiten
- Nebel-Karte: Gebiete leuchten herausgezoomt gelb nach Prozent, reingezoomt Nebel über Unentdecktem (beides erledigt 20.11.2026)
- Teilen-Bild mit Privatzone
- Belohnungsmoment nach einer Runde und „weißer Fleck in der Nähe“ (beides erledigt 20.11.2026)
- Ideenliste: docs/IDEEN.md (u. a. Sehenswürdigkeiten-Checkliste, Konzept in docs/idee-sehenswuerdigkeiten.md)
- Danach Phase 2 (Import GPX/Apple Health), Phase 3 (iPhone-App mit Hintergrund-Aufzeichnung)

## Wichtig zu wissen
- Overpass, Geofabrik, Kölner Open Data sperren die Claude-Umgebung → Straßen über OpenFreeMap-Kacheln, Grenzen über Overture
- Michi hat zwei Cloudflare-Konten; App und Token im Konto 48237c…; R2 nicht genutzt (Rohdaten in Supabase Storage)
- Commit-Autor: `Michi <356598429+lohmannmichael@users.noreply.github.com>` (keine private Mail)
- Testkonten nur gezielt löschen (siehe CLAUDE.md)
- Lizenzen: docs/lizenzen.md
