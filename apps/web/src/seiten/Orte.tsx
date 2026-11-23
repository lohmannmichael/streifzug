import type { Piece } from "@streifzug/core";
import { useMemo } from "react";
import type { Fortschritt } from "../daten/fortschritt";
import type { FremderOrt } from "../daten/orte";
import { alsKm, gesamtMeter, viertelWort, prozent, prozentText, zaehlendeMeter, type GebietDaten, type Region, type Regionen } from "../daten/regionen";
import { t } from "../texte/de";
import { useReisen, type ReiseZeile } from "../daten/reisen";
import { useWuensche } from "../daten/wuensche";
import { OrtHinzufuegen } from "./OrtHinzufuegen";
import { orteMitWegen, PassUnterseite, tagText } from "./Pass";

const datumKurz = new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "short", year: "numeric" });
const tagMonat = new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "short" });

/** "12.–15. Okt. 2026" style, from first to last day. */
function zeitraumText(von: number, bis: number): string {
  if (new Date(von).toDateString() === new Date(bis).toDateString()) return datumKurz.format(von);
  return `${tagMonat.format(von)} – ${datumKurz.format(bis)}`;
}

const LEER = { strasse_m: 0, weg_m: 0 };

/**
 * Places (Bauplan 3, D2, picture Orte.png without "Reisen"): Zuhause is the place with the most
 * walked meters, then the other places, then places that are being prepared. A tap shows the
 * whole place on the plan, wherever you are.
 */
export function OrteSeite(props: {
  daten: Regionen;
  fortschritt: Fortschritt | null;
  fremdeOrte: FremderOrt[];
  zurueck: () => void;
  oeffnen: (wurzel: string) => void;
  reiseOeffnen: (r: ReiseZeile) => void;
}) {
  const { daten, fortschritt: f } = props;
  const reisen = useReisen(daten, f, props.fremdeOrte);
  // Places put on the list by hand and not yet prepared (walked ones are already in `fremde`).
  const { wuensche, neuLaden } = useWuensche();
  const vorgemerkt = wuensche.filter((w) => !props.fremdeOrte.some((o) => o.name === w.name) && !daten.liste.some((r) => r.name === w.name));
  const { regionen, fremde } = useMemo(() => orteMitWegen(daten, f, props.fremdeOrte), [daten, f, props.fremdeOrte]);
  const [zuhause, ...weitere] = regionen;
  const zeile = (r: Region) => <OrtZeile key={r.id} region={r} daten={daten} fortschritt={f} oeffnen={() => props.oeffnen(r.wurzel)} />;
  return (
    <PassUnterseite titel={t.orte.titel} zurueck={props.zurueck}>
      {!zuhause && fremde.length === 0 && vorgemerkt.length === 0 && <p className="zeile-text leise">{t.orte.nochNichts}</p>}
      {zuhause && (
        <>
          <h2>{t.orte.zuhause}</h2>
          <ul className="orte-zeilen">{zeile(zuhause.r)}</ul>
        </>
      )}
      {weitere.length > 0 && (
        <>
          <h2>{t.orte.weitere}</h2>
          <ul className="orte-zeilen">{weitere.map((x) => zeile(x.r))}</ul>
        </>
      )}
      {reisen.length > 0 && (
        <>
          <h2>{t.orte.reisen}</h2>
          <ul className="orte-zeilen">
            {reisen.map((r) => (
              <li key={r.id}>
                <button type="button" className="ort-zeile" onClick={() => props.reiseOeffnen(r)}>
                  <span className="ort-text">
                    <b>{r.name}</b>
                    <span>{t.orte.reiseZeile(zeitraumText(r.von, r.bis), r.orte.length, alsKm(r.m))}</span>
                  </span>
                  <span className="pfeil" aria-hidden="true">›</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      {fremde.length + vorgemerkt.length > 0 && (
        <>
          <h2>{t.orte.vorbereitet}</h2>
          <ul className="orte-zeilen">
            {fremde.map((o) => (
              <li key={o.name} className="ort-vorbereitet">
                <b>{o.name}</b>
                <span>{t.orte.vorbereitetText(alsKm(o.m))}</span>
              </li>
            ))}
            {vorgemerkt.map((w) => (
              <li key={`w:${w.name}`} className="ort-vorbereitet">
                <b>{w.name}</b>
                <span>{t.orte.gewuenschtText}</span>
              </li>
            ))}
          </ul>
          <p className="zeile-text leise klein">{t.orte.vorbereitetHinweis}</p>
        </>
      )}
      <OrtHinzufuegen daten={daten} oeffnen={props.oeffnen} gewuenscht={neuLaden} />
    </PassUnterseite>
  );
}

function OrtZeile(props: { region: Region; daten: Regionen; fortschritt: Fortschritt | null; oeffnen: () => void }) {
  const { region: r, daten, fortschritt: f } = props;
  // Missing for a moment while the place is still loading (Bauplan 3, E4).
  const wurzel = daten.gebiete.get(r.wurzel);
  const gesehen = zaehlendeMeter(f?.proGebiet.get(r.wurzel) ?? LEER, false);
  const anteil = wurzel ? prozent(gesehen, gesamtMeter(wurzel, f?.abzug)) : null;
  // The yellow (and red) of this place, for the mini plan and "zuletzt".
  const imOrt = useMemo(() => {
    const [w, s, e, n] = r.bbox;
    const drin = (p: Piece) => p.mid[0] >= w && p.mid[0] <= e && p.mid[1] >= s && p.mid[1] <= n;
    const gelb: Piece[] = [];
    let zuletzt = 0;
    (f?.stuecke ?? []).forEach((p, i) => {
      if ((p.kind === "street" || p.kind === "path") && drin(p)) {
        gelb.push(p);
        zuletzt = Math.max(zuletzt, f?.erstesMal[i] ?? 0);
      }
    });
    return { gelb, rot: (f?.gefahren ?? []).filter(drin), zuletzt };
  }, [r.bbox, f]);
  const viertel = wurzel ? betretene(daten, f, wurzel) : 0;
  return (
    <li>
      <button type="button" className="ort-zeile" onClick={props.oeffnen}>
        <MiniPlan gelb={imOrt.gelb} rot={imOrt.rot} />
        <span className="ort-text">
          <b>{r.name}</b>
          <span>{t.orte.unterzeile(viertel, viertelWort(daten, r.wurzel).viele, imOrt.zuletzt ? tagText(imOrt.zuletzt) : null)}</span>
        </span>
        <span className="ort-prozent">{anteil === null ? "" : `${prozentText(anteil)} %`}</span>
        <span className="pfeil" aria-hidden="true">›</span>
      </button>
    </li>
  );
}

/** Number of entered smallest areas below an area. */
export function betretene(daten: Regionen, f: Fortschritt | null, g: GebietDaten): number {
  if (g.kinder.length === 0) return zaehlendeMeter(f?.proGebiet.get(g.id) ?? LEER, false) >= 1 ? 1 : 0;
  return g.kinder.reduce((n, id) => {
    const k = daten.gebiete.get(id);
    return n + (k ? betretene(daten, f, k) : 0);
  }, 0);
}

/**
 * Mini plan without map tiles (like the old logbook): the yellow of a place, fitted into the box.
 * Very many pieces are thinned out so the drawing stays light.
 */
function MiniPlan(props: { gelb: Piece[]; rot: Piece[]; groesse?: number }) {
  const g = props.groesse ?? 64;
  const pfade = useMemo(() => {
    const alle = [...props.gelb, ...props.rot];
    if (alle.length === 0) return null;
    let [w, s, e, n] = [Infinity, Infinity, -Infinity, -Infinity];
    for (const p of props.gelb.length ? props.gelb : alle)
      for (const [x, y] of p.coords) {
        w = Math.min(w, x);
        e = Math.max(e, x);
        s = Math.min(s, y);
        n = Math.max(n, y);
      }
    const kx = Math.cos((((s + n) / 2) * Math.PI) / 180);
    const breite = Math.max((e - w) * kx, n - s, 0.002);
    const rand = 6;
    const massstab = (g - 2 * rand) / breite;
    const mx = (w + e) / 2;
    const my = (s + n) / 2;
    const punkt = ([x, y]: readonly [number, number]) => `${(g / 2 + (x - mx) * kx * massstab).toFixed(1)},${(g / 2 - (y - my) * massstab).toFixed(1)}`;
    const linie = (liste: Piece[]) => {
      const schritt = Math.max(1, Math.ceil(liste.length / 1500));
      return liste.filter((_, i) => i % schritt === 0).map((p) => `M${p.coords.map(punkt).join("L")}`).join("");
    };
    return { gelb: linie(props.gelb), rot: linie(props.rot) };
  }, [props.gelb, props.rot, g]);
  return (
    <svg className="mini-plan" viewBox={`0 0 ${g} ${g}`} width={g} height={g} aria-hidden="true">
      <rect width={g} height={g} fill="var(--nebel)" />
      <path d={`M0 ${g * 0.3}H${g}M0 ${g * 0.72}H${g}M${g * 0.28} 0V${g}M${g * 0.74} 0V${g}`} stroke="var(--linie)" strokeWidth="1.5" />
      {pfade?.rot && <path d={pfade.rot} fill="none" stroke="var(--kuli)" strokeWidth="1" strokeLinecap="round" />}
      {pfade?.gelb && <path d={pfade.gelb} fill="none" stroke="var(--marker)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
  );
}
