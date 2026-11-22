import type { KorrekturArt } from "@streifzug/core";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Abschnitt, WegKopf } from "../daten/abgleich.worker";
import { fragen } from "../daten/arbeiter";
import type { Fortschritt } from "../daten/fortschritt";
import { korrekturEntfernen, korrekturSetzen, useKorrekturen } from "../daten/korrekturen";
import { alsStrecke } from "../daten/regionen";
import { t } from "../texte/de";
import { IconZurueck } from "../ui/Icons";
import { PassUnterseite, useRandWischen, useWegeListe } from "./Pass";

const tagName = new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "numeric", month: "long" });
const uhr = new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit" });
const ARTEN: KorrekturArt[] = ["zuFuss", "rad", "gefahren"];

const tagSchluessel = (t0: number) => new Date(t0).toDateString();

export interface Tag {
  von: number;
  bis: number;
  wege: WegKopf[];
}

/** Days with ways, newest first (local days, midnight to midnight). */
function tageAus(wege: WegKopf[]): Tag[] {
  const jeTag = new Map<string, Tag>();
  for (const w of wege) {
    const k = tagSchluessel(w.startedAt);
    let tag = jeTag.get(k);
    if (!tag) {
      const von = new Date(w.startedAt).setHours(0, 0, 0, 0);
      tag = { von, bis: new Date(von).setDate(new Date(von).getDate() + 1), wege: [] };
      jeTag.set(k, tag);
    }
    tag.wege.push(w);
  }
  return [...jeTag.values()].sort((a, b) => b.von - a.von);
}

/**
 * Rückblicke (Bauplan 3, D4): the days of the last 30 days with their ways, newest first, each with
 * the distance that turned yellow that day. A tap plays that day on the plan; the arrow (or a long
 * tap) opens the day with its ways and legs ("zu Fuß · Rad · gefahren", C2).
 */
export function RueckblickeSeite(props: { fortschritt: Fortschritt | null; zurueck: () => void; abspielen: (tag: Tag) => void; zeitreise: () => void }) {
  const wege = useWegeListe();
  const [offenerTag, setOffenerTag] = useState<Tag | null>(null);
  const tage = useMemo(() => tageAus(wege ?? []), [wege]);
  // New yellow per day: pieces whose first walk started that day.
  const neuJeTag = useMemo(() => {
    const m = new Map<string, number>();
    const f = props.fortschritt;
    f?.stuecke.forEach((p, i) => {
      if (p.kind !== "street" && p.kind !== "path") return;
      const k = tagSchluessel(f.erstesMal[i] ?? 0);
      m.set(k, (m.get(k) ?? 0) + (p.kind === "street" ? p.lengthM * p.weight : p.lengthM));
    });
    return m;
  }, [props.fortschritt]);

  if (offenerTag) return <TagSeite tag={offenerTag} zurueck={() => setOffenerTag(null)} />;
  return (
    <PassUnterseite titel={t.rueckblicke.titel} zurueck={props.zurueck}>
      {wege === null && <p className="zeile-text leise">{t.blatt.nochOffenLaedt}</p>}
      {wege?.length === 0 && <p className="zeile-text leise">{t.blatt.keineWege}</p>}
      {(props.fortschritt?.stuecke.length ?? 0) > 0 && (
        <ul className="orte-zeilen">
          <li>
            <button type="button" className="ort-zeile" onClick={props.zeitreise}>
              <span className="ort-text">
                <b>{t.zeitreise.titel}</b>
                <span>{t.zeitreise.zeile}</span>
              </span>
              <span className="pfeil" aria-hidden="true">›</span>
            </button>
          </li>
        </ul>
      )}
      <ul className="orte-zeilen">
        {tage.map((tag) => (
          <TagZeile
            key={tag.von}
            tag={tag}
            neuM={neuJeTag.get(tagSchluessel(tag.von)) ?? 0}
            abspielen={() => props.abspielen(tag)}
            oeffnen={() => setOffenerTag(tag)}
          />
        ))}
      </ul>
    </PassUnterseite>
  );
}

function TagZeile(props: { tag: Tag; neuM: number; abspielen: () => void; oeffnen: () => void }) {
  const lang = useRef(0);
  const warLang = useRef(false);
  const { tag } = props;
  return (
    <li className="tag-zeile">
      <button
        type="button"
        className="tag-abspielen"
        onPointerDown={() => {
          warLang.current = false;
          lang.current = window.setTimeout(() => {
            warLang.current = true;
            props.oeffnen();
          }, 550);
        }}
        onPointerUp={() => window.clearTimeout(lang.current)}
        onPointerLeave={() => window.clearTimeout(lang.current)}
        onContextMenu={(e) => e.preventDefault()}
        onClick={() => !warLang.current && props.abspielen()}
      >
        <span className="abspiel-zeichen" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="22" height="22"><circle cx="12" cy="12" r="11" fill="var(--tinte)" /><path d="M10 7.5l6 4.5-6 4.5z" fill="var(--flaeche)" /></svg>
        </span>
        <span className="ort-text">
          <b>{tagName.format(tag.von)}</b>
          <span>{t.rueckblicke.zeile(tag.wege.length, props.neuM >= 1 ? alsStrecke(props.neuM) : null)}</span>
        </span>
      </button>
      <button type="button" className="tag-pfeil" aria-label={t.rueckblicke.wegeZeigen(tagName.format(tag.von))} onClick={props.oeffnen}>
        ›
      </button>
    </li>
  );
}

/** One day: its ways, each opens its legs to correct. */
function TagSeite(props: { tag: Tag; zurueck: () => void }) {
  const [offen, setOffen] = useState<string | null>(null);
  const wischen = useRandWischen(props.zurueck);
  return (
    <div className="app">
      <section className="seite seite-voll" aria-labelledby="unterseite-titel" {...wischen}>
        <button type="button" className="zurueck" onClick={props.zurueck}>
          <IconZurueck />
          <span>{t.rueckblicke.titel}</span>
        </button>
        <h1 id="unterseite-titel">{tagName.format(props.tag.von)}</h1>
        <p className="leise seiten-unterzeile">{t.wege.unterzeile}</p>
        <ul className="zeilen gruppe">
          {[...props.tag.wege].sort((a, b) => a.startedAt - b.startedAt).map((w) => (
            <li key={w.id}>
              <button type="button" className="zeile-knopf weg-zeile" aria-expanded={offen === w.id} onClick={() => setOffen(offen === w.id ? null : w.id)}>
                <span>{t.wege.zeile(uhr.format(w.startedAt), uhr.format(w.endedAt), alsStrecke(w.distanceM))}</span>
                <span className="wert">{offen === w.id ? "‹" : "›"}</span>
              </button>
              {offen === w.id && <Abschnitte weg={w.id} />}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/** The legs of one way, each with "zu Fuß · Rad · gefahren". */
function Abschnitte({ weg }: { weg: string }) {
  const korrekturen = useKorrekturen();
  const eigene = korrekturen[weg] ?? [];
  const [liste, setListe] = useState<Abschnitt[] | null>(null);
  const schluessel = JSON.stringify(eigene);
  useEffect(() => {
    let lebt = true;
    void fragen<"abschnitte">({ typ: "abschnitte", id: weg, korrekturen: eigene }).antwort.then((a) => lebt && setListe(a.abschnitte));
    return () => {
      lebt = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weg, schluessel]);

  if (!liste) return <p className="zeile-text leise">{t.blatt.nochOffenLaedt}</p>;
  if (liste.length === 0) return <p className="zeile-text leise">{t.wege.keineAbschnitte}</p>;
  return (
    <ol className="abschnitte">
      {liste.map((a) => (
        <li key={a.von} className="abschnitt-zeile">
          <span className="abschnitt-text">
            {t.wege.abschnitt(uhr.format(a.von), uhr.format(a.bis), alsStrecke(a.m), Math.max(1, Math.round((a.bis - a.von) / 60_000)))}
            {a.korrigiert && (
              <>
                {" · "}
                <button type="button" className="text-knopf klein" onClick={() => korrekturEntfernen(weg, a.von)}>{t.wege.zuruecksetzen}</button>
              </>
            )}
            {!a.korrigiert && a.unsicher && <span className="leise"> · {t.wege.unsicher}</span>}
          </span>
          <span className="umschalt-gruppe" role="radiogroup" aria-label={t.wege.artLabel}>
            {ARTEN.map((art) => (
              <button
                key={art}
                type="button"
                role="radio"
                aria-checked={a.art === art}
                className={a.art === art ? (art === "gefahren" ? "art an gefahren" : "art an") : "art"}
                onClick={() => a.art !== art && korrekturSetzen(weg, { von: a.von, bis: a.bis, art })}
              >
                {t.wege.arten[art]}
              </button>
            ))}
          </span>
        </li>
      ))}
    </ol>
  );
}
