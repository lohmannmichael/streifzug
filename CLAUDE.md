# CLAUDE.md: Streifzug

Claude Code liest diese Datei bei jedem Start.

## Was wir bauen

Eine App, die aufzeichnet, wo Michi zu Fuß und mit dem Rad war, Straßen freischaltet und zeigt, wie viel Prozent einer Stadt, eines Bezirks und eines Stadtteils schon gesehen sind. Erst für Michi allein, von Anfang an so gebaut, dass daraus ein Produkt im App Store werden kann.

- Plan und Regeln: `docs/PLAN.md` (Phasen mit Definition of Done, Zählregeln, Technik, Design)
- Geschäftsseite: `docs/BUSINESSPLAN.md`
- Entscheidungen: `docs/entscheidungen.md` (neue Einträge oben, mit Datum)

## Stack

- Monorepo: `packages/core` (TypeScript, Logik mit Tests), `apps/web` (Vite + React + TypeScript + MapLibre GL JS, PWA), ab Phase 3 `apps/mobile` (Expo), `supabase/` (Migrationen, Zugriffsregeln)
- Supabase (Postgres + PostGIS, Auth), Projekt `jbtrjmuztsjnzpokmymq`, Region Irland (EU). Jede Tabelle mit `user_id` und Row Level Security
- Große Dateien (Straßen-Kacheln, Rohdaten): Cloudflare R2
- Web-Hosting: Cloudflare Pages, Projekt `streifzug`, Adresse https://streifzug.pages.dev. Jeder Push nach `main` wird automatisch veröffentlicht (Build `npm run build`, Ausgabe `apps/web/dist`, `NODE_VERSION=22`). Nach jedem Push prüfen, ob die Veröffentlichung durchgelaufen ist (Pages-API, Token liegt in der Umgebung „Michis Apps“)
- Karte: MapLibre + OpenFreeMap; Straßen und Gebiete aus OpenStreetMap (Overpass), Namensnennung „© OpenStreetMap-Mitwirkende“

## Befehle

- `npm install` einmal, dann `npm run dev` (Web-App lokal), `npm test` (Tests), `npm run check` (Typen, Tests, Build wie in der GitHub-Prüfung)

## Regeln

- Code und Kommentare auf Englisch, Oberfläche und Doku auf Deutsch

- Immer nur die aktuelle Phase aus `docs/PLAN.md` bauen, in kleinen, prüfbaren Schritten (Skill `incremental-implementation`)
- Logik in `packages/core` immer mit Tests (Skill `test-driven-development`)
- Jede Änderung kurz und verständlich erklären; Michi ist kein Entwickler und pflegt die App mit Claude
- Keine Geheimnisse ins Repo (Schlüssel, Tokens, Passwörter); `.env*` in `.gitignore`
- Abgleich Weg → Straße läuft auf dem Gerät; Rohdaten komprimiert als Datei, nicht als Tabellenzeilen
- Daten exportierbar und löschbar halten (DSGVO, App Store)
- Oberfläche: Deutsch, Du-Form, keine Emojis, kurze Texte, gendern mit Doppelpunkt (Nutzer:innen). Alle Texte in einer Sprachdatei (später Englisch)
- Design laut `docs/PLAN.md` Abschnitt 6; bei Oberflächen-Arbeit die Skills `frontend-design`, `ui-ux-pro-max`, `web-design-guidelines`, `accessibility-engineering` (Web) bzw. `expo-native-ui` (iPhone) nutzen
- Vor neuen Bibliotheken: offizielle Doku prüfen (Skill `source-driven-development`)
