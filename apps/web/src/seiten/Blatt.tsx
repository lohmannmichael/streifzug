import { fehlendeMeter, type Naechster } from "@streifzug/core";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Aufzeichnung } from "../daten/aufzeichnung";
import type { Fortschritt } from "../daten/fortschritt";
import type { KurzWeg } from "../daten/import";
import { alsKm, alsStrecke, elternText, gesamtMeter, prozent, prozentText, zaehlendeMeter, type GebietDaten, type Regionen } from "../daten/regionen";
import type { FremderOrt } from "../daten/orte";
import type { Rueckblick } from "../daten/rueckblick";
import { standAus, useLetzteWege, useOffeneStrassen, useStempel, type GesetzterStempel, type OffeneStrasse } from "../daten/veedel";
import { t } from "../texte/de";
import { IconMehr } from "../ui/Icons";
import { Stempel } from "../ui/Stempel";

export type Hoehe = 1 | 2 | 3;

const wochentag = new Intl.DateTimeFormat("de-DE", { weekday: "long" });
const tagMonat = new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "long" });
/** "Montag" within the last week, otherwise "12. November". */
export function seitText(zeit: number): string {
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
  overlandStill: number | null;
  einstellungen: (ziel?: "overland") => void;
  eigeneWege: KurzWeg[];
  abspielen: (w: KurzWeg) => void;
  position: [number, number] | null;
  offen: string | null;
  offenZeigen: (s: OffeneStrasse | null) => void;
  waehlen: (id: string) => void;
  /** Walked places without a region yet ("wird vorbereitet"). */
  fremdeOrte: FremderOrt[];
  /** During the replay the number stays at the share before the new ways. */
  zahlVorher: number | null;
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
 * The sheet over the plan (Bauplan 3.2), three heights: 1 name and percent, 2 the Veedel
 * (numbers, stamp card, last ways, open streets), 3 the collection (Veedel and stamp passport).
 */
export function Blatt(props: BlattProps) {
  const { hoehe, setHoehe, gebiet, daten, aufzeichnung: a } = props;
  abzugJetzt = props.fortschritt?.abzug;
  const gesamt = gebiet ? gesamtM(gebiet) : 0;
  const gesehen = gebiet ? gesehenM(props.fortschritt, gebiet) : 0;
  const p = prozent(gesehen, gesamt);
  const angezeigt = useAngezeigt(p, props.zahlVorher, props.hochzaehlen);
  const stand = useMemo(() => (daten && props.fortschritt ? standAus(daten, props.fortschritt) : null), [daten, props.fortschritt]);
  const stempel = useStempel(stand);

  // Pulling the handle or the head moves one height up or down; tapping the head opens height 2.
  const zug = useRef<number | null>(null);
  const zugEnde = (y: number) => {
    if (zug.current === null) return false;
    const weg = y - zug.current;
    zug.current = null;
    if (weg < -36) setHoehe(Math.min(3, hoehe + 1) as Hoehe);
    else if (weg > 36) setHoehe(Math.max(1, hoehe - 1) as Hoehe);
    else return false;
    return true;
  };
  const gezogen = useRef(false);

  const status = a.aktiv
    ? t.blatt.unterwegs(alsStrecke(props.neuUnterwegsM), props.neueStrassen)
    : props.rueckblick
      ? t.blatt.seit(seitText(props.rueckblick.wege[0]?.startedAt ?? Date.now()), props.rueckblick.wege.length, alsStrecke(props.rueckblick.km * 1000))
      : props.rechnet
        ? t.blatt.rechnetWege(Math.max(1, props.rechnet.gesamt - props.rechnet.fertig))
        : gebiet && daten
          ? elternText(daten, gebiet.id)
          : " ";

  return (
    <section className={`blatt hoehe-${hoehe}`} aria-labelledby="gebiet-name">
      <div
        className="blatt-zug"
        onPointerDown={(e) => {
          zug.current = e.clientY;
          gezogen.current = false;
        }}
        onPointerMove={(e) => {
          // Once it is a real pull, keep the pointer even when it leaves the head.
          if (zug.current !== null && Math.abs(e.clientY - zug.current) > 8 && !e.currentTarget.hasPointerCapture(e.pointerId))
            e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerUp={(e) => (gezogen.current = zugEnde(e.clientY))}
        onPointerCancel={() => (zug.current = null)}
        onClick={(e) => {
          if (gezogen.current || (e.target as HTMLElement).closest("button")) return;
          if (hoehe === 1) setHoehe(2);
        }}
      >
        <button
          type="button"
          className="griff"
          aria-label={hoehe === 1 ? t.blatt.hoeher : t.blatt.tiefer}
          onClick={() => !gezogen.current && setHoehe(hoehe === 1 ? 2 : hoehe === 2 ? 1 : 2)}
        />
        {hoehe === 3 ? (
          <h1 id="gebiet-name" className="sr-only">{t.sammlung.veedel}</h1>
        ) : (
          <div className="blatt-kopf">
            <div className="kopf-links">
              <h1 id="gebiet-name" className="gebiet">{gebiet?.name ?? " "}</h1>
              <p className="ober" aria-live="polite">
                {status}
                {props.rueckblick && !a.aktiv && (
                  <>
                    {" "}
                    <button type="button" className="text-knopf klein" onClick={props.rueckblickBeenden}>{t.blatt.ueberspringen}</button>
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
        <div className="aufnahme-zeile">
          <span className={`gps gps-${a.gps}`}>{t.karte.gps[a.gps]}</span>
          <button type="button" className="text-knopf" onClick={a.beenden}>{t.blatt.beenden}</button>
        </div>
      )}

      {hoehe === 2 && gebiet && daten && (
        <div className="blatt-inhalt">
          <VeedelInhalt {...props} gebiet={gebiet} daten={daten} gesehen={gesehen} gesamt={gesamt} gesetzt={stempel.gesetzt} />
        </div>
      )}
      {hoehe === 3 && daten && <Sammlung {...props} daten={daten} gesetzt={stempel.gesetzt} naechste={stempel.naechste} />}
    </section>
  );
}

function VeedelInhalt(props: BlattProps & { gebiet: GebietDaten; daten: Regionen; gesehen: number; gesamt: number; gesetzt: GesetzterStempel[] }) {
  const { gebiet, daten, aufzeichnung: a } = props;
  const wege = useLetzteWege(props.eigeneWege);
  const istVeedel = gebiet.kinder.length === 0;
  const offen = useOffeneStrassen(daten, istVeedel ? gebiet.id : null, props.position, props.fortschritt, istVeedel && !a.aktiv);
  const erstesMal = props.gesehen < 1 && wege.length === 0;
  const vorherM = props.vorher ? zaehlendeMeter(props.vorher.proGebiet.get(gebiet.id) ?? LEER, false) : null;
  const neuM = vorherM !== null && a.letzter ? props.gesehen - vorherM : 0;

  return (
    <>
      <p className="zahlen-zeile">
        <span className="wert">{t.blatt.kmVon(alsKm(props.gesehen), alsKm(props.gesamt))}</span>
      </p>
      {neuM >= 1 && vorherM !== null && (
        <p className="zeile-text" role="status">
          {t.blatt.belohnung(alsStrecke(neuM), prozentText(prozent(vorherM, props.gesamt)), prozentText(prozent(props.gesehen, props.gesamt)))}
        </p>
      )}
      {props.overlandStill && (
        <p className="zeile-text">
          {t.import.overland.still(seitText(props.overlandStill))}{" "}
          <button type="button" className="text-knopf" onClick={() => props.einstellungen("overland")}>{t.import.overland.pruefen}</button>
        </p>
      )}
      {props.standortFehler && <p className="zeile-text">{t.karte.standortFehler}</p>}
      {props.fremdeOrte
        .filter((o) => Date.now() - o.seit < 7 * 86400_000)
        .slice(0, 2)
        .map((o) => (
          <p key={o.name} className="zeile-text">{t.blatt.vorbereitet(o.name)}</p>
        ))}
      {a.aktiv && <p className="zeile-text leise">{t.karte.hinweisOffen}</p>}

      {erstesMal && (
        <div className="abschnitt">
          <p className="zeile-text">{t.blatt.ersterSatz}</p>
          <button type="button" className="zeile-knopf" onClick={() => props.einstellungen("overland")}>{t.blatt.einrichten}</button>
        </div>
      )}

      {istVeedel && <Stempelkarte gebiet={gebiet} daten={daten} gesehen={props.gesehen} gesamt={props.gesamt} gesetzt={props.gesetzt} />}

      <h2 className="abschnitt-titel">{t.blatt.zuletzt}</h2>
      {wege.length === 0 ? (
        <p className="zeile-text leise">{t.blatt.keineWege}</p>
      ) : (
        <ul className="zeilen">
          {wege.map((w) => (
            <li key={w.id}>
              <button type="button" className="zeile-knopf" onClick={() => props.abspielen(w)}>
                <span>{t.blatt.zuletztZeile(seitText(w.startedAt), alsStrecke(w.distanceM))}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {istVeedel && (
        <>
          <h2 className="abschnitt-titel">{t.blatt.nochOffen}</h2>
          {offen === null ? (
            <p className="zeile-text leise">{t.blatt.nochOffenLaedt}</p>
          ) : offen.length === 0 ? (
            <p className="zeile-text leise">{t.blatt.nochOffenLeer}</p>
          ) : (
            <ul className="zeilen">
              {offen.map((s) => (
                <li key={s.name}>
                  <button
                    type="button"
                    className="zeile-knopf"
                    aria-pressed={props.offen === s.name}
                    onClick={() => props.offenZeigen(props.offen === s.name ? null : s)}
                  >
                    <span>{s.name}</span>
                    <span className="wert">{alsStrecke(s.restM)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {!a.aktiv && (
        <button type="button" className="text-knopf fuss" onClick={a.starten}>{t.blatt.jetztAufzeichnen}</button>
      )}
    </>
  );
}

/** Six fields: entered, 10, 25, 50, 75, 100 %. Stamped ones show the stamp, open ones the missing km. */
function Stempelkarte(props: { gebiet: GebietDaten; daten: Regionen; gesehen: number; gesamt: number; gesetzt: GesetzterStempel[] }) {
  const { gebiet } = props;
  const jeId = new Map(props.gesetzt.filter((s) => s.gebietId === gebiet.id).map((s) => [s.id, s]));
  const stadt = stadtName(props.daten, gebiet.id);
  const felder = [
    { id: `betreten:${gebiet.id}`, titel: t.blatt.betreten, restM: props.gesehen > 0 ? 0 : null },
    ...fehlendeMeter({ id: gebiet.id, aktivM: props.gesehen, gesamtM: props.gesamt }).map((f) => ({ id: `prozent:${gebiet.id}:${f.stufe}`, titel: `${f.stufe} %`, restM: f.restM })),
  ];
  return (
    <>
      <h2 className="abschnitt-titel">{t.blatt.stempelkarte}</h2>
      <ol className="stempelkarte">
        {felder.map((f) => {
          const s = jeId.get(f.id);
          return (
            <li key={f.id} className={s ? "feld voll" : "feld"}>
              <span className="feld-titel">{f.titel}</span>
              {s ? (
                <Stempel stempel={s} gebietName={gebiet.name} stadtName={stadt} datum={s.gestempeltAm} groesse={74} drehung={s.drehung} />
              ) : (
                <span className="feld-rest">{f.restM ? t.blatt.noch(alsKm(f.restM)) : " "}</span>
              )}
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

function Sammlung(props: BlattProps & { daten: Regionen; gesetzt: GesetzterStempel[]; naechste: Naechster[] }) {
  const [teil, setTeil] = useState<"veedel" | "pass">("veedel");
  return (
    <div className="blatt-inhalt sammlung">
      <div className="sammlung-kopf">
        <div className="umschalter" role="tablist">
          <button type="button" role="tab" aria-selected={teil === "veedel"} onClick={() => setTeil("veedel")}>{t.sammlung.veedel}</button>
          <span aria-hidden="true">·</span>
          <button type="button" role="tab" aria-selected={teil === "pass"} onClick={() => setTeil("pass")}>{t.sammlung.stempelpass}</button>
        </div>
        <button type="button" className="icon-knopf" aria-label={t.sammlung.mehr} onClick={() => props.einstellungen()}>
          <IconMehr />
        </button>
      </div>
      {teil === "veedel" ? <VeedelBaum {...props} /> : <Stempelpass daten={props.daten} gesetzt={props.gesetzt} naechste={props.naechste} />}
    </div>
  );
}

/** City → district → Veedel, only what has been entered, most seen first. */
function VeedelBaum(props: BlattProps & { daten: Regionen }) {
  const { daten, fortschritt: f } = props;
  const anteil = (g: GebietDaten) => prozent(gesehenM(f, g), gesamtM(g));
  const betreten = (g: GebietDaten) => gesehenM(f, g) >= 1;
  const kinder = (g: GebietDaten) => g.kinder.map((id) => daten.gebiete.get(id)!).filter(betreten).sort((x, y) => anteil(y) - anteil(x));
  const offen = new Set<string>();
  for (let g = props.gebiet; g; g = g.eltern ? (daten.gebiete.get(g.eltern) ?? null) : null) offen.add(g.id);
  const staedte = daten.liste.map((r) => daten.gebiete.get(r.wurzel)!).filter(betreten).sort((x, y) => gesehenM(f, y) - gesehenM(f, x));
  const vorbereitet = props.fremdeOrte.length > 0 && (
    <>
      <h2 className="abschnitt-titel">{t.sammlung.vorbereitet}</h2>
      <ul className="zeilen">
        {props.fremdeOrte.map((o) => (
          <li key={o.name} className="zeile">
            <span>{o.name}</span>
            <span className="wert">{t.sammlung.gegangen(alsKm(o.m))}</span>
          </li>
        ))}
      </ul>
      <p className="zeile-text leise klein">{t.sammlung.vorbereitetHinweis}</p>
    </>
  );
  if (staedte.length === 0) return vorbereitet || <p className="zeile-text leise">{t.sammlung.nochNichts}</p>;

  const inhalt = (g: GebietDaten) => {
    const p = anteil(g);
    return (
      <>
        <span className="baum-name">{g.name}</span>
        <span className="mini-balken" aria-hidden="true"><i style={{ width: `${p > 0 ? Math.max(p, 2) : 0}%` }} /></span>
        <span className="wert">{prozentText(p)} %</span>
      </>
    );
  };
  const ordner = (g: GebietDaten, tiefe: number) => (
    <details key={g.id} className="baum-ordner" open={offen.has(g.id) || (tiefe === 0 && staedte.length === 1)}>
      <summary className={`baum-zeile tiefe-${tiefe}`}>{inhalt(g)}</summary>
      <ul className="zeilen">
        {kinder(g).map((k) =>
          k.kinder.length ? (
            <li key={k.id}>{ordner(k, tiefe + 1)}</li>
          ) : (
            <li key={k.id}>
              <button
                type="button"
                className={`baum-zeile tiefe-${tiefe + 1}`}
                aria-current={props.gebiet?.id === k.id ? "true" : undefined}
                onClick={() => {
                  props.waehlen(k.id);
                  props.setHoehe(2);
                }}
              >
                {inhalt(k)}
              </button>
            </li>
          ),
        )}
      </ul>
    </details>
  );
  return (
    <>
      <div className="baum">{staedte.map((g) => ordner(g, 0))}</div>
      {vorbereitet}
    </>
  );
}

/** All stamps like on a passport page, set freely and slightly tilted; below, the next two. */
function Stempelpass(props: { daten: Regionen; gesetzt: GesetzterStempel[]; naechste: Naechster[] }) {
  const name = (id: string | null) => (id ? (props.daten.gebiete.get(id)?.name ?? "") : "");
  const neueste = [...props.gesetzt].sort((x, y) => y.gestempeltAm - x.gestempeltAm);
  return (
    <>
      {neueste.length === 0 ? (
        <p className="zeile-text leise">{t.sammlung.keineStempel}</p>
      ) : (
        <div className="passseite">
          {neueste.map((s) => (
            <div key={s.id} className="pass-stempel" style={{ transform: `translate(${(s.x - 0.5) * 18}px, ${((s.y * 7) % 1) * 12 - 6}px)` }}>
              <Stempel stempel={s} gebietName={name(s.gebietId)} stadtName={s.gebietId ? stadtName(props.daten, s.gebietId) : undefined} datum={s.gestempeltAm} groesse={104} drehung={s.drehung} />
            </div>
          ))}
        </div>
      )}
      {props.naechste.length > 0 && (
        <>
          <h2 className="abschnitt-titel">{t.sammlung.alsNaechstes}</h2>
          <ul className="zeilen">
            {props.naechste.map((n) => (
              <li key={n.id} className="zeile">
                <span>{n.art === "prozent" ? t.sammlung.prozentStufe(name(n.gebietId), n.stufe ?? 0) : t.sammlung.kmStufe(n.stufe ?? 0)}</span>
                <span className="wert">{t.blatt.noch(alsKm(n.restM))}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
