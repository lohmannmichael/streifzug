import { useMemo } from "react";
import type { Fortschritt } from "../daten/fortschritt";
import { alsStrecke } from "../daten/regionen";
import { useGesetzteStempel } from "../daten/veedel";
import { t } from "../texte/de";
import { neuInZeitraum } from "./Rueckblicke";

const datumKurz = new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "long" });

/** The date of the way being drawn, on top of the plan (Bauplan 3, F2). */
export function ZeitraumDatum(props: { t: number }) {
  return <p className="zeitraum-datum" aria-live="polite">{datumKurz.format(props.t)}</p>;
}

/**
 * Bottom card of a period playback: the title while it runs; at the end the numbers (new
 * kilometres, complete streets, new stamps) and "Fertig".
 */
export function ZeitraumKarte(props: { titel: string; von: number; bis: number; fortschritt: Fortschritt | null; fertig: boolean; schliessen: () => void }) {
  const gesetzt = useGesetzteStempel();
  const km = useMemo(() => neuInZeitraum(props.fortschritt, props), [props.fortschritt, props.von, props.bis]);
  const komplett = (props.fortschritt?.komplett ?? []).filter((k) => k.seit >= props.von && k.seit < props.bis).length;
  const stempel = gesetzt.filter((s) => s.gestempeltAm >= props.von && s.gestempeltAm < props.bis).length;
  return (
    <section className="blatt zeitraum-ende" aria-labelledby="zeitraum-titel">
      <div className="blatt-kopf">
        <div className="kopf-links">
          <h1 id="zeitraum-titel" className="gebiet">{props.titel}</h1>
          {!props.fertig && <p className="ober">{t.zeitraum.ueberspringen}</p>}
        </div>
      </div>
      {props.fertig && (
        <>
          <dl className="zeitraum-zahlen">
            <div>
              <dt>{t.zeitraum.neueKm}</dt>
              <dd><span className="wisch">{alsStrecke(km)}</span></dd>
            </div>
            <div>
              <dt>{t.zeitraum.komplett(komplett)}</dt>
              <dd>{komplett}</dd>
            </div>
            <div>
              <dt>{t.zeitraum.neueStempel(stempel)}</dt>
              <dd>{stempel}</dd>
            </div>
          </dl>
          <button type="button" className="datei-knopf zeit-fertig" onClick={props.schliessen}>{t.zeitraum.fertig}</button>
        </>
      )}
    </section>
  );
}
