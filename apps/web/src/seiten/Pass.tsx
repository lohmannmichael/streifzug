import { besteStempel } from "@streifzug/core";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { WegKopf } from "../daten/abgleich.worker";
import { ANDERE_GEAENDERT, fragen } from "../daten/arbeiter";
import type { Fortschritt } from "../daten/fortschritt";
import { overlandSteht, zeitText, type OverlandStatus } from "../daten/import";
import type { FremderOrt } from "../daten/orte";
import { alsStrecke, viertelWort, zaehlendeMeter, type Regionen } from "../daten/regionen";
import { useGesetzteStempel, type GesetzterStempel } from "../daten/veedel";
import { t } from "../texte/de";
import { IconSchliessen, IconZurueck } from "../ui/Icons";
import { Stempel } from "../ui/Stempel";

/**
 * The Pass (Bauplan 3, D1): one place for everything that is not the plan. Three numbers and four
 * rows; each row opens one page, and every page leads back here. Closing always goes to the plan.
 */
export type PassTeil = "start" | "orte" | "stempel" | "rueckblicke" | "einstellungen";

const LEER = { strasse_m: 0, weg_m: 0 };

/** Places with at least one walked meter: regions (most first), then places without data. */
export function orteMitWegen(daten: Regionen, f: Fortschritt | null, fremde: FremderOrt[]) {
  const regionen = daten.liste
    .map((r) => ({ r, m: zaehlendeMeter(f?.proGebiet.get(r.wurzel) ?? LEER, false) }))
    .filter((x) => x.m >= 1)
    .sort((a, b) => b.m - a.m);
  return { regionen, fremde };
}

/** Short words for a stamp ("Weiden 25 %"). */
export function stempelKurz(s: GesetzterStempel, name: string, wort: string): string {
  if (s.art === "prozent") return `${name} ${s.stufe} %`;
  if (s.art === "betreten") return `${name} ${t.pass.betreten}`;
  if (s.art === "veedel-anzahl") return s.id.endsWith(":alle") ? t.pass.alleViertel(name, wort) : `${name} ${t.pass.viertelAnzahl(s.stufe ?? 0, wort)}`;
  if (s.art === "orte-anzahl") return t.pass.orteAnzahl(s.stufe ?? 0);
  if (s.art === "laender-anzahl") return t.pass.laenderAnzahl(s.stufe ?? 0);
  if (s.art === "km-neu") return t.pass.kmNeu(s.stufe ?? 0);
  if (s.art === "strassen-komplett") return t.pass.strassenKomplett(s.stufe ?? 0);
  return `${name} ${t.pass.rundum}`;
}

export function PassSeite(props: {
  daten: Regionen;
  fortschritt: Fortschritt | null;
  fremdeOrte: FremderOrt[];
  overland: OverlandStatus;
  marker: string;
  kuli: string;
  oeffnen: (teil: Exclude<PassTeil, "start">) => void;
  schliessen: () => void;
}) {
  const { daten, fortschritt: f } = props;
  const gesetzt = useGesetzteStempel();
  const wege = useWegeListe();
  const orte = useMemo(() => orteMitWegen(daten, f, props.fremdeOrte), [daten, f, props.fremdeOrte]);
  // All yellow meters, also in places without data (Bauplan 3, D1).
  const gelbM = useMemo(() => (f?.stuecke ?? []).reduce((m, p) => m + (p.kind === "street" ? p.lengthM * p.weight : p.kind === "path" ? p.lengthM : 0), 0), [f]);
  const anzahlOrte = orte.regionen.length + orte.fremde.length;
  const laender = new Set(orte.regionen.map((x) => x.r.land ?? "DE")).size;
  const ortNamen = [...orte.regionen.map((x) => x.r.name), ...orte.fremde.map((o) => o.name)].slice(0, 3);
  const letzter = [...gesetzt].sort((a, b) => b.gestempeltAm - a.gestempeltAm)[0];
  const letzterName = letzter?.gebietId ? (daten.gebiete.get(letzter.gebietId)?.name ?? "") : "";
  const letzterWeg = wege?.[0];
  const o = props.overland;
  const aufzeichnung = aufzeichnungText(o);
  const wischen = useRandWischen(props.schliessen);

  return (
    <div className="app">
      <section className="seite seite-voll pass" aria-labelledby="pass-titel" {...wischen}>
        <div className="pass-kopf">
          <h1 id="pass-titel">{t.pass.titel}</h1>
          <button type="button" className="rund-knopf flach" aria-label={t.pass.schliessen} onClick={props.schliessen}>
            <IconSchliessen />
          </button>
        </div>
        <dl className="pass-zahlen">
          <div>
            <dt>{t.pass.inGelb}</dt>
            <dd><span className="wisch">{alsStrecke(gelbM)}</span></dd>
          </div>
          <div>
            <dt>{t.pass.orte(anzahlOrte)}</dt>
            <dd>{anzahlOrte}</dd>
          </div>
          <div>
            <dt>{t.pass.laender(laender)}</dt>
            <dd>{laender}</dd>
          </div>
        </dl>
        <ul className="pass-zeilen">
          <PassZeile bild={<BildOrte />} titel={t.pass.orteTitel} onClick={() => props.oeffnen("orte")}>
            {ortNamen.length > 0 && <span>{ortNamen.join(" · ")}</span>}
            <span>{t.pass.orteText}</span>
          </PassZeile>
          <PassZeile
            bild={letzter ? <Stempel stempel={letzter} gebietName={letzterName} datum={letzter.gestempeltAm} groesse={64} drehung={letzter.drehung} viertelWort={viertelWort(daten, letzter.gebietId).viele} /> : <BildStempelLeer />}
            titel={t.pass.stempelTitel}
            onClick={() => props.oeffnen("stempel")}
          >
            <span>{letzter ? t.pass.stempelText(besteStempel(gesetzt).length, stempelKurz(letzter, letzterName, viertelWort(daten, letzter.gebietId).viele)) : t.pass.keineStempel}</span>
          </PassZeile>
          <PassZeile bild={<BildRueckblick />} titel={t.pass.rueckblickeTitel} onClick={() => props.oeffnen("rueckblicke")}>
            <span>{letzterWeg ? t.pass.rueckblickeText(tagText(letzterWeg.startedAt), wege!.filter((w) => tagText(w.startedAt) === tagText(letzterWeg.startedAt)).length) : t.pass.keineWege}</span>
          </PassZeile>
          <PassZeile bild={<BildStifte marker={props.marker} kuli={props.kuli} />} titel={t.pass.einstellungenTitel} onClick={() => props.oeffnen("einstellungen")}>
            <span>{aufzeichnung}</span>
          </PassZeile>
        </ul>
      </section>
    </div>
  );
}

function PassZeile(props: { bild: ReactNode; titel: string; onClick: () => void; children: ReactNode }) {
  return (
    <li>
      <button type="button" className="pass-zeile" onClick={props.onClick}>
        <span className="pass-bild" aria-hidden="true">{props.bild}</span>
        <span className="pass-text">
          <b>{props.titel}</b>
          {props.children}
        </span>
        <span className="pfeil" aria-hidden="true">›</span>
      </button>
    </li>
  );
}

/** "Aufzeichnung läuft · letzter Punkt vor 12 Min." and the like (Pass, Einstellungen). */
export function aufzeichnungText(o: OverlandStatus): string {
  if (o.verbunden === false) return t.pass.einrichten;
  if (overlandSteht(o)) return t.pass.pruefen(o.letzter ? zeitText(o.letzter) : null);
  return o.letzter ? t.pass.laeuft(zeitText(o.letzter)) : t.pass.laeuftKurz;
}

/** Ways of the last 30 days, newest first (from the worker); null while loading. */
export function useWegeListe(): WegKopf[] | null {
  const [wege, setWege] = useState<WegKopf[] | null>(null);
  useEffect(() => {
    let lebt = true;
    const laden = () => void fragen<"wegeListe">({ typ: "wegeListe", seit: Date.now() - 30 * 86400_000 }).antwort.then((a) => lebt && setWege(a.wege));
    laden();
    window.addEventListener(ANDERE_GEAENDERT, laden);
    return () => {
      lebt = false;
      window.removeEventListener(ANDERE_GEAENDERT, laden);
    };
  }, []);
  return wege;
}

const tagKurz = new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "short" });
/** "heute", "gestern" or "20. Nov." */
export function tagText(t0: number): string {
  const tag = (x: number) => new Date(x).toDateString();
  if (tag(t0) === tag(Date.now())) return t.pass.heute;
  if (tag(t0) === tag(Date.now() - 86400_000)) return t.pass.gestern;
  return tagKurz.format(t0);
}

/**
 * Swipe from the left edge goes back (like iOS). Only starts within 24 px of the edge and needs a
 * clear move to the right.
 */
export function useRandWischen(zurueck: () => void) {
  const start = useRef<{ x: number; y: number } | null>(null);
  return {
    onTouchStart: (e: React.TouchEvent) => {
      const p = e.touches[0];
      start.current = p && p.clientX < 24 ? { x: p.clientX, y: p.clientY } : null;
    },
    onTouchEnd: (e: React.TouchEvent) => {
      const s = start.current;
      const p = e.changedTouches[0];
      start.current = null;
      if (s && p && p.clientX - s.x > 80 && Math.abs(p.clientY - s.y) < 60) zurueck();
    },
  };
}

/** "‹ Pass" at the top of every page reached from the Pass. */
export function ZurueckZumPass(props: { onClick: () => void }) {
  return (
    <button type="button" className="zurueck" onClick={props.onClick}>
      <IconZurueck />
      <span>{t.pass.titelKurz}</span>
    </button>
  );
}

/** A page opened from the Pass: "‹ Pass", title, content; swipe from the left edge goes back. */
export function PassUnterseite(props: { titel: string; zurueck: () => void; children: ReactNode; klasse?: string }) {
  const wischen = useRandWischen(props.zurueck);
  return (
    <div className="app">
      <section className={`seite seite-voll ${props.klasse ?? ""}`} aria-labelledby="unterseite-titel" {...wischen}>
        <ZurueckZumPass onClick={props.zurueck} />
        <h1 id="unterseite-titel">{props.titel}</h1>
        {props.children}
      </section>
    </div>
  );
}

// Small pictures for the four rows (drawn, no map tiles).
const GITTER = "M0 22h80M0 58h80M22 0v80M60 0v80";

function BildOrte() {
  return (
    <svg viewBox="0 0 80 80" width="64" height="64">
      <rect width="80" height="80" fill="var(--nebel)" />
      <path d={GITTER} stroke="var(--linie)" strokeWidth="2" />
      <path d="M22 22h38v36H22z" fill="none" stroke="var(--marker)" strokeWidth="6" strokeLinejoin="round" />
      <path d="M2 70 L40 64 L78 72" fill="none" stroke="#8e4b9a" strokeWidth="1.5" strokeDasharray="6 3 1.5 3" />
    </svg>
  );
}

function BildRueckblick() {
  return (
    <svg viewBox="0 0 80 80" width="64" height="64">
      <rect width="80" height="80" fill="var(--nebel)" />
      <path d={GITTER} stroke="var(--linie)" strokeWidth="2" />
      <path d="M14 70V22h24v36h28v20" fill="none" stroke="var(--marker)" strokeWidth="6" strokeLinejoin="round" />
      <circle cx="58" cy="58" r="13" fill="var(--tinte)" />
      <path d="M54 51l11 7-11 7z" fill="var(--nebel)" />
    </svg>
  );
}

function BildStempelLeer() {
  return (
    <svg viewBox="0 0 80 80" width="64" height="64">
      <circle cx="40" cy="40" r="28" fill="none" stroke="var(--linie)" strokeWidth="3" strokeDasharray="5 4" />
    </svg>
  );
}

function BildStifte(props: { marker: string; kuli: string }) {
  return (
    <svg viewBox="0 0 80 80" width="64" height="64">
      <path d="M16 34l48-2-1 14-47 1z" fill={props.marker} />
      <path d="M18 58l44-2" stroke={props.kuli} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
