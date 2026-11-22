import { einrasten, meterBis, monatsAnfaenge, pointInGeometry, zeitleiste, type Zeitleiste } from "@streifzug/core";
import { useEffect, useMemo, useState } from "react";
import type { Fortschritt } from "../daten/fortschritt";
import { ladeFlaechen } from "../daten/rechnen";
import { gesamtMeter, prozent, prozentText, type GebietDaten, type Regionen } from "../daten/regionen";
import { t } from "../texte/de";

const TAG = 86_400_000;
const datumLang = new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "long", year: "numeric" });
const monatKurz = new Intl.DateTimeFormat("de-DE", { month: "short" });

/** Local midnight of a day, and the day `n` days later (summer time safe). */
const tagAnfang = (t0: number) => new Date(t0).setHours(0, 0, 0, 0);
const plusTage = (t0: number, n: number) => {
  const d = new Date(t0);
  d.setDate(d.getDate() + n);
  return d.getTime();
};

/** First day with yellow and the number of days up to today. */
export function zeitraum(f: Fortschritt | null): { erster: number; tage: number } | null {
  if (!f || f.erstesMal.length === 0) return null;
  let erster = Infinity;
  for (const x of f.erstesMal) if (x < erster) erster = x;
  const von = tagAnfang(erster);
  const tage = Math.max(0, Math.round((tagAnfang(Date.now()) - von) / TAG));
  return { erster: von, tage };
}

/**
 * Zeitreise (Bauplan 3, F3): instead of the sheet, a bar with a slider from the first day to
 * today. The plan shows only what was yellow by the chosen day; the share of the chosen area
 * follows along. Month starts catch the slider, in between it moves freely.
 */
export function ZeitreiseLeiste(props: {
  daten: Regionen;
  gebiet: GebietDaten | null;
  fortschritt: Fortschritt;
  /** End of the chosen day (pieces first walked before it are shown). */
  bis: number;
  setBis: (bis: number) => void;
  schliessen: () => void;
}) {
  const { gebiet, fortschritt: f } = props;
  const raum = useMemo(() => zeitraum(f), [f]);
  const anfaenge = useMemo(() => (raum ? monatsAnfaenge(raum.erster, plusTage(raum.erster, raum.tage)) : []), [raum]);

  // Meters per day in the chosen area, worked out once per area.
  const [leiste, setLeiste] = useState<{ id: string; z: Zeitleiste } | null>(null);
  useEffect(() => {
    const region = gebiet ? props.daten.liste.find((r) => r.id === gebiet.regionId) : undefined;
    if (!gebiet || !region) return;
    let lebt = true;
    void ladeFlaechen(region).then((flaechen) => {
      const fl = flaechen.find((x) => x.id === gebiet.id);
      if (!fl || !lebt) return;
      const eintraege: { t: number; m: number }[] = [];
      f.stuecke.forEach((p, i) => {
        if (p.kind !== "street") return;
        const [x, y] = p.mid;
        if (x < fl.bbox[0] || x > fl.bbox[2] || y < fl.bbox[1] || y > fl.bbox[3] || !pointInGeometry(p.mid, fl.geometry)) return;
        eintraege.push({ t: f.erstesMal[i] ?? 0, m: p.lengthM * p.weight });
      });
      setLeiste({ id: gebiet.id, z: zeitleiste(eintraege) });
    });
    return () => {
      lebt = false;
    };
  }, [gebiet?.id, f]);

  if (!raum) return null;
  const tagNr = Math.min(raum.tage, Math.max(0, Math.round((tagAnfang(props.bis - 1) - raum.erster) / TAG)));
  const gesamt = gebiet ? gesamtMeter(gebiet, f.abzug) : 0;
  const p = leiste && gebiet && leiste.id === gebiet.id ? prozent(meterBis(leiste.z, props.bis - 1), gesamt) : null;
  const tagText = datumLang.format(plusTage(raum.erster, tagNr));
  const wahl = (n: number) => {
    const tag = einrasten(plusTage(raum.erster, n), anfaenge);
    props.setBis(plusTage(tagAnfang(tag), 1));
  };

  return (
    <section className="blatt zeitreise" aria-labelledby="zeitreise-titel">
      <div className="blatt-kopf">
        <div className="kopf-links">
          <h1 id="zeitreise-titel" className="gebiet">{gebiet?.name ?? t.zeitreise.titel}</h1>
          <p className="ober" aria-live="polite">{tagText}</p>
        </div>
        {p !== null && (
          <p className="prozent" aria-label={`${prozentText(p)} Prozent`}>
            <span className="zahl"><span className="wisch">{prozentText(p)}</span><span className="einheit"> %</span></span>
          </p>
        )}
      </div>
      <div className="zeit-schieber-box">
        <input
          type="range"
          className="zeit-schieber"
          min={0}
          max={Math.max(1, raum.tage)}
          step={1}
          value={tagNr}
          disabled={raum.tage === 0}
          aria-label={t.zeitreise.schieber}
          aria-valuetext={tagText}
          onChange={(e) => wahl(Number(e.currentTarget.value))}
        />
        <div className="zeit-monate" aria-hidden="true">
          {anfaenge.map((a) => (
            <span key={a} style={{ left: `${(Math.round((a - raum.erster) / TAG) / Math.max(1, raum.tage)) * 100}%` }}>{monatKurz.format(a)}</span>
          ))}
        </div>
        <div className="zeit-enden">
          <span>{datumLang.format(raum.erster)}</span>
          <span>{t.zeitreise.heute}</span>
        </div>
      </div>
      <button type="button" className="datei-knopf zeit-fertig" onClick={props.schliessen}>{t.zeitreise.fertig}</button>
    </section>
  );
}
