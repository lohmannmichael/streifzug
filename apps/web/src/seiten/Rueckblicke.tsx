import { jahr, monat, monateZurueck, woche, type KorrekturArt, type Zeitraum } from "@streifzug/core";
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
const monatName = new Intl.DateTimeFormat("de-DE", { month: "long" });
const monatJahr = new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric" });

/** A period to play back (Bauplan 3, F2), with its title ("Dein November"). */
export interface ZeitraumWahl extends Zeitraum {
  titel: string;
}

/** New yellow meters per piece, as in the day rows: streets weighted, paths in full. */
export function neuInZeitraum(f: Fortschritt | null, z: Zeitraum): number {
  let m = 0;
  f?.stuecke.forEach((p, i) => {
    const t0 = f.erstesMal[i] ?? 0;
    if (t0 < z.von || t0 >= z.bis) return;
    if (p.kind === "street") m += p.lengthM * p.weight;
    else if (p.kind === "path") m += p.lengthM;
  });
  return m;
}

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
export function RueckblickeSeite(props: {
  fortschritt: Fortschritt | null;
  zurueck: () => void;
  abspielen: (tag: Tag) => void;
  zeitreise: () => void;
  zeitraum: (z: ZeitraumWahl) => void;
}) {
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

  // Three tiles (this week, this month, this year) and the past months as rows (Bauplan 3, F2).
  const kacheln = useMemo(() => {
    const jetzt = Date.now();
    const w = woche(jetzt);
    const m = monat(jetzt);
    const j = jahr(jetzt);
    return [
      { ...w, name: t.zeitraum.woche, titel: t.zeitraum.deineWoche, m: neuInZeitraum(props.fortschritt, w) },
      { ...m, name: monatName.format(jetzt), titel: t.zeitraum.dein(monatName.format(jetzt)), m: neuInZeitraum(props.fortschritt, m) },
      { ...j, name: String(new Date(jetzt).getFullYear()), titel: t.zeitraum.dein(String(new Date(jetzt).getFullYear())), m: neuInZeitraum(props.fortschritt, j) },
    ];
  }, [props.fortschritt]);
  const monate = useMemo(() => {
    const f = props.fortschritt;
    if (!f || f.erstesMal.length === 0) return [];
    let erster = Infinity;
    for (const x of f.erstesMal) if (x < erster) erster = x;
    return monateZurueck(erster, Date.now()).map((z) => ({ ...z, m: neuInZeitraum(f, z) })).filter((z) => z.m >= 1);
  }, [props.fortschritt]);
  // Days newest first; a past month's row stands before its days, older months follow at the end.
  const zeilen = useMemo(() => {
    const out: ({ art: "tag"; tag: Tag } | { art: "monat"; z: Zeitraum & { m: number } })[] = [];
    const offen = [...monate];
    for (const tag of tage) {
      while (offen.length && offen[0]!.bis > tag.von) out.push({ art: "monat", z: offen.shift()! });
      out.push({ art: "tag", tag });
    }
    for (const z of offen) out.push({ art: "monat", z });
    return out;
  }, [tage, monate]);

  if (offenerTag) return <TagSeite tag={offenerTag} zurueck={() => setOffenerTag(null)} />;
  return (
    <PassUnterseite titel={t.rueckblicke.titel} zurueck={props.zurueck}>
      {wege === null && <p className="zeile-text leise">{t.blatt.nochOffenLaedt}</p>}
      {wege?.length === 0 && <p className="zeile-text leise">{t.blatt.keineWege}</p>}
      {(props.fortschritt?.stuecke.length ?? 0) > 0 && (
        <div className="zeitraum-kacheln">
          {kacheln.map((k) => (
            <button key={k.name} type="button" className="zeitraum-kachel" onClick={() => props.zeitraum({ von: k.von, bis: k.bis, titel: k.titel })} aria-label={t.zeitraum.kachelLabel(k.name, alsStrecke(k.m))}>
              <span>{k.name}</span>
              <b>{alsStrecke(k.m)}</b>
              <span className="leise">{t.zeitraum.neu}</span>
            </button>
          ))}
        </div>
      )}
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
        {zeilen.map((z) =>
          z.art === "tag" ? (
            <TagZeile
              key={z.tag.von}
              tag={z.tag}
              neuM={neuJeTag.get(tagSchluessel(z.tag.von)) ?? 0}
              abspielen={() => props.abspielen(z.tag)}
              oeffnen={() => setOffenerTag(z.tag)}
            />
          ) : (
            <li key={`m${z.z.von}`} className="monat-zeile">
              <button type="button" className="ort-zeile" onClick={() => props.zeitraum({ von: z.z.von, bis: z.z.bis, titel: t.zeitraum.dein(monatName.format(z.z.von)) })}>
                <span className="ort-text">
                  <b>{t.zeitraum.monatZeile(monatJahr.format(z.z.von), alsStrecke(z.z.m))}</b>
                </span>
                <span className="pfeil" aria-hidden="true">›</span>
              </button>
            </li>
          ),
        )}
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
          <span>{t.rueckblicke.zeile(tag.wege.length, alsStrecke(tag.wege.reduce((m, w) => m + w.distanceM, 0)), props.neuM >= 1 ? alsStrecke(props.neuM) : null)}</span>
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
