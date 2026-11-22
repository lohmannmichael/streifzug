import { VEEDEL_PROZENT } from "@streifzug/core";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Aufzeichnung } from "../daten/aufzeichnung";
import type { Fortschritt } from "../daten/fortschritt";
import { alsKm, alsStrecke, elternText, viertelWort, gesamtMeter, prozent, prozentText, zaehlendeMeter, type GebietDaten, type Regionen } from "../daten/regionen";
import type { FremderOrt } from "../daten/orte";
import { overlandSteht, zeitText, type OverlandStatus } from "../daten/import";
import type { Rueckblick } from "../daten/rueckblick";
import { standAus, useStempel, type GesetzterStempel } from "../daten/veedel";
import { t } from "../texte/de";
import { betretene } from "./Orte";
import { Stempel } from "../ui/Stempel";

export type Hoehe = 1 | 2;

const wochentag = new Intl.DateTimeFormat("de-DE", { weekday: "long" });
const tagMonat = new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "long" });
/** "Montag" within the last week, otherwise "12. November". */
function seitText(zeit: number): string {
  const tage = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(zeit).setHours(0, 0, 0, 0)) / 86400_000);
  return tage === 0 ? "heute" : tage === 1 ? "gestern" : tage < 6 ? wochentag.format(zeit) : tagMonat.format(zeit);
}

const LEER = { strasse_m: 0, weg_m: 0 };
const gesehenM = (f: Fortschritt | null, g: GebietDaten) => zaehlendeMeter(f?.proGebiet.get(g.id) ?? LEER, false);
let abzugJetzt: Fortschritt["abzug"] | undefined;
const gesamtM = (g: GebietDaten) => gesamtMeter(g, abzugJetzt);

export interface BlattProps {
  hoehe: Hoehe;
  setHoehe: (h: Hoehe) => void;
  gebiet: GebietDaten | null;
  daten: Regionen | null;
  fortschritt: Fortschritt | null;
  /** Progress before the last outing with the open app (for the line after it). */
  vorher: Fortschritt | null;
  rechnet: { fertig: number; gesamt: number } | null;
  aufzeichnung: Aufzeichnung;
  standortFehler: boolean;
  neuUnterwegsM: number;
  neueStrassen: number;
  rueckblick: Rueckblick | null;
  rueckblickBeenden: () => void;
  /** Is Overland set up, and when did the newest point arrive (from the server)? */
  overland: OverlandStatus;
  einstellungen: (ziel?: "overland") => void;
  position: [number, number] | null;
  waehlen: (id: string) => void;
  /** Walked places without a region yet ("wird vorbereitet"). */
  fremdeOrte: FremderOrt[];
  /** During the replay the number stays at the share before the new ways. */
  zahlVorher: number | null;
  /** The calculation failed: shown instead of the district line, so it can be reported. */
  rechenFehler: string | null;
  /** Opens Einstellungen → Über (map credits). */
  quelle: () => void;
  nochmalRechnen: () => void;
  online: boolean;
  /** The replay waits for a tap (calculating took longer than 8 s). */
  rueckblickAngebot: boolean;
  rueckblickStarten: () => void;
  /** After the replay: count up from `von` (Bauplan 5, Nr. 6). */
  hochzaehlen: { von: number; nr: number } | null;
}

/** The shown share: counts up in 900 ms when `hochzaehlen` changes; jumps with "reduce motion". */
function useAngezeigt(p: number, vorher: number | null, hoch: { von: number; nr: number } | null): { wert: number; zieht: boolean } {
  const [lauf, setLauf] = useState<{ wert: number; zieht: boolean } | null>(null);
  useEffect(() => {
    if (!hoch || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const start = performance.now();
    let bild = 0;
    const schritt = (jetzt: number) => {
      const f = Math.min(1, (jetzt - start) / 900);
      const weich = 1 - (1 - f) ** 3;
      setLauf({ wert: hoch.von + (p - hoch.von) * weich, zieht: true });
      if (f < 1) bild = requestAnimationFrame(schritt);
      else setLauf(null);
    };
    bild = requestAnimationFrame(schritt);
    return () => cancelAnimationFrame(bild);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoch?.nr]);
  if (lauf) return lauf;
  return { wert: vorher ?? p, zieht: false };
}

/**
 * The sheet over the plan (Bauplan 3.2), three heights: 1 name and percent, 2 the quarter
 * (numbers, stamp card, last ways, open streets), 3 the collection (quarter and stamp passport).
 */
export function Blatt(props: BlattProps) {
  const { hoehe, setHoehe, gebiet, daten, aufzeichnung: a } = props;
  abzugJetzt = props.fortschritt?.abzug;
  const gesamt = gebiet ? gesamtM(gebiet) : 0;
  const gesehen = gebiet ? gesehenM(props.fortschritt, gebiet) : 0;
  const p = prozent(gesehen, gesamt);
  const angezeigt = useAngezeigt(p, props.zahlVorher, props.hochzaehlen);
  const stand = useMemo(
    () => (daten && props.fortschritt ? standAus(daten, props.fortschritt, props.fremdeOrte) : null),
    [daten, props.fortschritt, props.fremdeOrte.length],
  );
  const stempel = useStempel(stand);

  // Two heights (Bauplan 3, B2): the sheet follows the finger and snaps to the nearer height;
  // a quick flick decides by its direction. Small = only the head is visible (moved down).
  const blattRef = useRef<HTMLElement>(null);
  const kopfRef = useRef<HTMLDivElement>(null);
  const aufnahmeRef = useRef<HTMLDivElement>(null);
  const inhaltRef = useRef<HTMLDivElement>(null);
  const [masse, setMasse] = useState({ halb: 0, klein: 0 });
  useLayoutEffect(() => {
    const messen = () => {
      const b = blattRef.current;
      const k = kopfRef.current;
      if (!b || !k) return;
      const unten = parseFloat(getComputedStyle(b).paddingBottom) || 0;
      setMasse({ halb: b.offsetHeight, klein: k.offsetHeight + (aufnahmeRef.current?.offsetHeight ?? 0) + unten });
    };
    messen();
    const ro = new ResizeObserver(messen);
    if (blattRef.current) ro.observe(blattRef.current);
    if (kopfRef.current) ro.observe(kopfRef.current);
    return () => ro.disconnect();
  }, [a.aktiv]);
  const tief = Math.max(0, masse.halb - masse.klein);
  const [zug, setZug] = useState<number | null>(null);
  const start = useRef<{ y: number; t: number; basis: number; letzteY: number; letzteT: number; v: number } | null>(null);
  // Times come from the touch itself (event.timeStamp), not from when the page got round to it:
  // while the map draws, events arrive late and a quick flick looked slow (found by the browser tests).
  const beginnen = (y: number, jetzt: number) => {
    start.current = { y, t: jetzt, basis: hoehe === 1 ? tief : 0, letzteY: y, letzteT: jetzt, v: 0 };
  };
  const bewegen = (y: number, jetzt: number) => {
    const s0 = start.current;
    if (!s0) return;
    if (jetzt - s0.letzteT > 8) {
      s0.v = (y - s0.letzteY) / (jetzt - s0.letzteT);
      s0.letzteY = y;
      s0.letzteT = jetzt;
    }
    if (Math.abs(y - s0.y) > 4) setZug(Math.min(tief, Math.max(0, s0.basis + y - s0.y)));
  };
  /** Ends a pull; true if it was one (not a tap). */
  const enden = (y: number, jetzt: number) => {
    const s0 = start.current;
    start.current = null;
    setZug(null);
    if (!s0) return false;
    const weg = y - s0.y;
    // Speed: of the last part of the move, or of the whole move when it was short (a flick).
    const dauer = Math.max(1, jetzt - s0.t);
    const v = dauer < 300 && Math.abs(weg / dauer) > Math.abs(s0.v) ? weg / dauer : s0.v;
    if (Math.abs(weg) <= 4 && Math.abs(v) < 0.5) return false;
    setHoehe(Math.abs(v) > 0.5 ? (v > 0 ? 1 : 2) : s0.basis + weg > tief / 2 ? 1 : 2);
    return true;
  };
  const gezogen = useRef(false);

  // B3: in the content, a pull down at its top moves the sheet; otherwise the content scrolls.
  useEffect(() => {
    const el = inhaltRef.current;
    if (!el) return;
    let y0: number | null = null;
    let zieht = false;
    const anfang = (e: TouchEvent) => {
      y0 = el.scrollTop <= 0 ? e.touches[0]!.clientY : null;
      zieht = false;
    };
    const weiter = (e: TouchEvent) => {
      if (y0 === null) return;
      const y = e.touches[0]!.clientY;
      if (!zieht) {
        if (y - y0 > 6 && el.scrollTop <= 0) {
          zieht = true;
          beginnen(y0, e.timeStamp);
        } else if (y0 - y > 6) {
          y0 = null;
          return;
        } else return;
      }
      e.preventDefault();
      bewegen(y, e.timeStamp);
    };
    const schluss = (e: TouchEvent) => {
      if (zieht) enden(e.changedTouches[0]!.clientY, e.timeStamp);
      y0 = null;
      zieht = false;
    };
    el.addEventListener("touchstart", anfang, { passive: true });
    el.addEventListener("touchmove", weiter, { passive: false });
    el.addEventListener("touchend", schluss);
    el.addEventListener("touchcancel", schluss);
    return () => {
      el.removeEventListener("touchstart", anfang);
      el.removeEventListener("touchmove", weiter);
      el.removeEventListener("touchend", schluss);
      el.removeEventListener("touchcancel", schluss);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoehe, tief]);

  const status = a.aktiv
    ? t.blatt.unterwegs(alsStrecke(props.neuUnterwegsM), props.neueStrassen)
    : props.rechenFehler
      ? props.online
        ? t.blatt.rechenFehler
        : t.blatt.offline
      : props.rechnet
        ? t.blatt.rechnetWege(Math.max(1, props.rechnet.gesamt - props.rechnet.fertig))
        : props.rueckblick
          ? t.blatt.seit(seitText(props.rueckblick.wege[0]?.startedAt ?? Date.now()), props.rueckblick.wege.length, alsStrecke(props.rueckblick.km * 1000))
          : !props.online
            ? t.blatt.offline
            : gebiet && daten
          ? elternText(daten, gebiet.id)
          : " ";

  return (
    <section
      ref={blattRef}
      className={zug !== null ? "blatt zieht" : "blatt"}
      aria-labelledby="gebiet-name"
      style={{ transform: `translateY(${zug ?? (hoehe === 1 ? tief : 0)}px)` }}
    >
      {/* Map credits (Bauplan 3, D6): a small grey line just above the sheet, moving with it. */}
      <button type="button" className="quelle-zeile" onClick={props.quelle}>
        {t.karte.quelleKurz}
      </button>
      <div
        ref={kopfRef}
        className="blatt-zug"
        onPointerDown={(e) => {
          gezogen.current = false;
          if ((e.target as HTMLElement).closest("button:not(.griff)")) return;
          beginnen(e.clientY, e.timeStamp);
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => bewegen(e.clientY, e.timeStamp)}
        onPointerUp={(e) => (gezogen.current = enden(e.clientY, e.timeStamp))}
        onPointerCancel={() => {
          start.current = null;
          setZug(null);
        }}
        onClick={(e) => {
          if (gezogen.current || (e.target as HTMLElement).closest("button")) return;
          setHoehe(hoehe === 1 ? 2 : 1);
        }}
      >
        {/* The handle stays a button for the keyboard and VoiceOver. */}
        <button
          type="button"
          className="griff"
          aria-label={hoehe === 1 ? t.blatt.hoeher : t.blatt.tiefer}
          aria-expanded={hoehe === 2}
          onClick={(e) => {
            e.stopPropagation();
            if (!gezogen.current) setHoehe(hoehe === 1 ? 2 : 1);
          }}
        />
        {(
          <div className="blatt-kopf">
            <div className="kopf-links">
              <h1 id="gebiet-name" className="gebiet">{gebiet?.name ?? " "}</h1>
              <p className="ober" aria-live="polite">
                {status}
                {props.rueckblick && !a.aktiv && !props.rechenFehler && !props.rechnet && (
                  <>
                    {props.rueckblickAngebot && (
                      <>
                        {" "}
                        <button type="button" className="text-knopf klein" onClick={props.rueckblickStarten}>{t.blatt.rueckblickAnsehen}</button>
                      </>
                    )}{" "}
                    <button type="button" className="text-knopf klein" onClick={props.rueckblickBeenden}>{t.blatt.ueberspringen}</button>
                  </>
                )}
                {!a.aktiv && props.rechenFehler && props.online && (
                  <>
                    {" "}
                    <button type="button" className="text-knopf klein" onClick={props.nochmalRechnen}>{t.blatt.nochmalVersuchen}</button>
                  </>
                )}
              </p>
            </div>
            <p className="prozent" aria-label={`${prozentText(p)} Prozent`}>
              <span className="zahl"><span className={angezeigt.zieht ? "wisch zieht" : "wisch"} key={props.hochzaehlen?.nr ?? 0}>{prozentText(angezeigt.wert)}</span><span className="einheit"> %</span></span>
            </p>
          </div>
        )}
      </div>

      {a.aktiv && (
        <div ref={aufnahmeRef} className="aufnahme-zeile">
          <span className={`gps gps-${a.gps}`}>{t.karte.gps[a.gps]}</span>
          <button type="button" className="text-knopf" onClick={a.beenden}>{t.blatt.beenden}</button>
        </div>
      )}

      {gebiet && daten && (
        <div ref={inhaltRef} className="blatt-inhalt" aria-hidden={hoehe === 1}>
          <ViertelInhalt
            {...props}
            gebiet={gebiet}
            daten={daten}
            gesehen={gesehen}
            gesamt={gesamt}
            gesetzt={stempel.gesetzt}
          />
        </div>
      )}
    </section>
  );
}

function ViertelInhalt(props: BlattProps & { gebiet: GebietDaten; daten: Regionen; gesehen: number; gesamt: number; gesetzt: GesetzterStempel[] }) {
  const { gebiet, daten, aufzeichnung: a } = props;
  const istViertel = gebiet.kinder.length === 0;
  const vorherM = props.vorher ? zaehlendeMeter(props.vorher.proGebiet.get(gebiet.id) ?? LEER, false) : null;
  const neuM = vorherM !== null && a.letzter ? props.gesehen - vorherM : 0;

  // Half height (Bauplan 3, 3.2): km, stamp card, and a status line only when something needs attention.
  return (
    <>
      <p className="zahlen-zeile">
        <span className="wert">{t.blatt.kmVon(alsKm(props.gesehen), alsKm(props.gesamt))}</span>
      </p>
      {props.gesehen < 1 && <p className="zeile-text">{t.blatt.ersterSatz}</p>}
      {neuM >= 1 && vorherM !== null && (
        <p className="zeile-text" role="status">
          {t.blatt.belohnung(alsStrecke(neuM), prozentText(prozent(vorherM, props.gesamt)), prozentText(prozent(props.gesehen, props.gesamt)))}
        </p>
      )}
      {/* Status line (Bauplan 3, C1): only when the recording needs attention. */}
      {props.rechenFehler && <p className="zeile-text leise technik">{props.rechenFehler}</p>}
      {props.online && props.overland.verbunden === false && (
        <button type="button" className="zeile-knopf status-zeile" onClick={() => props.einstellungen("overland")}>
          <span>{t.blatt.einrichten}</span>
          <span className="wert">›</span>
        </button>
      )}
      {props.online && overlandSteht(props.overland) && (
        <button type="button" className="zeile-knopf status-zeile" onClick={() => props.einstellungen("overland")}>
          <span>{props.overland.letzter ? t.import.overland.still(zeitText(props.overland.letzter)) : t.import.overland.nochKeinPunkt}</span>
          <span className="wert">{t.import.overland.pruefen} ›</span>
        </button>
      )}
      {props.standortFehler && <p className="zeile-text">{t.karte.standortFehler}</p>}
      {props.fremdeOrte
        .filter((o) => Date.now() - o.seit < 7 * 86400_000)
        .slice(0, 1)
        .map((o) => (
          <p key={o.name} className="zeile-text">{t.blatt.vorbereitet(o.name)}</p>
        ))}
      {a.aktiv && <p className="zeile-text leise">{t.karte.hinweisOffen}</p>}

      {istViertel ? (
        <Stempelkarte gebiet={gebiet} daten={daten} gesehen={props.gesehen} gesamt={props.gesamt} gesetzt={props.gesetzt} />
      ) : (
        <ViertelListe gebiet={gebiet} daten={daten} fortschritt={props.fortschritt} viertelWaehlen={props.waehlen} />
      )}
    </>
  );
}

/**
 * A place or district in the sheet (Bauplan 3, D2): the entered quarter to unfold, grouped by
 * district, most seen first. A tap on a quarter chooses it.
 */
function ViertelListe(props: { gebiet: GebietDaten; daten: Regionen; fortschritt: Fortschritt | null; viertelWaehlen: (id: string) => void }) {
  const { daten, fortschritt: f } = props;
  const anteil = (g: GebietDaten) => prozent(gesehenM(f, g), gesamtM(g));
  const betreten = (g: GebietDaten) => gesehenM(f, g) >= 1;
  const kinder = (g: GebietDaten) => g.kinder.map((id) => daten.gebiete.get(id)!).filter(betreten).sort((x, y) => anteil(y) - anteil(x));
  const anzahl = betretene(daten, f, props.gebiet);
  const zeile = (v: GebietDaten) => (
    <li key={v.id}>
      <button type="button" className="zeile-knopf viertel-zeile" onClick={() => props.viertelWaehlen(v.id)}>
        <span>{v.name}</span>
        <span className="wert">{prozentText(anteil(v))} %</span>
      </button>
    </li>
  );
  const wort = viertelWort(daten, props.gebiet.id);
  if (anzahl === 0) return <p className="zeile-text leise">{t.orte.keineViertel(wort.eins)}</p>;
  return (
    <details className="viertel-liste">
      <summary className="zeile-knopf">
        <span>{t.orte.viertelZeile(anzahl, anzahl === 1 ? wort.eins : wort.viele)}</span>
        <span className="wert" aria-hidden="true">›</span>
      </summary>
      {kinder(props.gebiet).map((k) =>
        k.kinder.length ? (
          <div key={k.id}>
            <h3 className="bezirk">{k.name} <span className="leise">{prozentText(anteil(k))} %</span></h3>
            <ul className="zeilen">{kinder(k).map(zeile)}</ul>
          </div>
        ) : (
          <ul key={k.id} className="zeilen">{zeile(k)}</ul>
        ),
      )}
    </details>
  );
}

/** Six fields: entered, 10, 25, 50, 75, 100 %. Reached ones show the stamp, open ones only the step in grey. */
function Stempelkarte(props: { gebiet: GebietDaten; daten: Regionen; gesehen: number; gesamt: number; gesetzt: GesetzterStempel[] }) {
  const { gebiet } = props;
  const jeId = new Map(props.gesetzt.filter((s) => s.gebietId === gebiet.id).map((s) => [s.id, s]));
  const stadt = stadtName(props.daten, gebiet.id);
  const felder = [
    { id: `betreten:${gebiet.id}`, titel: t.blatt.betreten },
    ...VEEDEL_PROZENT.map((stufe) => ({ id: `prozent:${gebiet.id}:${stufe}`, titel: `${stufe} %` })),
  ];
  return (
    <>
      <h2 className="sr-only">{t.blatt.stempelkarte}</h2>
      <ol className="stempelkarte">
        {felder.map((f) => {
          const s = jeId.get(f.id);
          return (
            <li key={f.id} className={s ? "feld voll" : "feld"}>
              <span className="feld-kreis">
                {s && <Stempel stempel={s} gebietName={gebiet.name} stadtName={stadt} datum={s.gestempeltAm} groesse={56} drehung={s.drehung} viertelWort={viertelWort(props.daten, gebiet.id).viele} />}
              </span>
              <span className="feld-titel">{f.titel}</span>
            </li>
          );
        })}
      </ol>
    </>
  );
}

function stadtName(daten: Regionen, id: string): string | undefined {
  let g = daten.gebiete.get(id);
  while (g?.eltern) g = daten.gebiete.get(g.eltern);
  return g?.name;
}



