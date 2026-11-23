import { useEffect, useState } from "react";
import type { Regionen } from "../daten/regionen";
import { ortWuenschen, orteSuchen, type OrtVorschlag } from "../daten/wuensche";
import { t } from "../texte/de";

/**
 * "Ort hinzufügen" (Michi, 23.11.2026): type a town, pick it from the suggestions, and it is put on
 * the list of places to prepare. A place that is there already opens instead.
 */
export function OrtHinzufuegen(props: { daten: Regionen; oeffnen: (wurzel: string) => void; gewuenscht: () => void }) {
  const [text, setText] = useState("");
  const [vorschlaege, setVorschlaege] = useState<OrtVorschlag[] | null>(null);
  const [fehler, setFehler] = useState(false);
  const [fertig, setFertig] = useState<string | null>(null);

  useEffect(() => {
    if (text.trim().length < 2) return setVorschlaege(null);
    const ab = new AbortController();
    const warten = window.setTimeout(() => {
      orteSuchen(text.trim(), ab.signal)
        .then((v) => {
          setFehler(false);
          setVorschlaege(v);
        })
        .catch((e: unknown) => {
          if ((e as Error).name !== "AbortError") setFehler(true);
        });
    }, 300);
    return () => {
      window.clearTimeout(warten);
      ab.abort();
    };
  }, [text]);

  const waehlen = async (v: OrtVorschlag) => {
    const da = props.daten.liste.find((r) => r.name === v.name && v.punkt[0] >= r.bbox[0] && v.punkt[0] <= r.bbox[2] && v.punkt[1] >= r.bbox[1] && v.punkt[1] <= r.bbox[3]);
    if (da) return props.oeffnen(da.wurzel);
    try {
      await ortWuenschen(v);
      setFertig(v.name);
      setText("");
      props.gewuenscht();
    } catch {
      setFehler(true);
    }
  };

  return (
    <section className="ort-hinzufuegen" aria-labelledby="ort-hinzufuegen-titel">
      <h2 id="ort-hinzufuegen-titel">{t.orte.hinzufuegen}</h2>
      <input
        className="adresse"
        type="search"
        inputMode="search"
        autoComplete="off"
        placeholder={t.orte.suchePlatzhalter}
        aria-label={t.orte.suchePlatzhalter}
        value={text}
        onChange={(e) => {
          setFertig(null);
          setText(e.currentTarget.value);
        }}
      />
      {fertig && <p className="zeile-text" role="status">{t.orte.vorgemerkt(fertig)}</p>}
      {fehler && <p className="zeile-text leise" role="status">{t.orte.sucheFehler}</p>}
      {vorschlaege?.length === 0 && !fehler && <p className="zeile-text leise">{t.orte.nichtsGefunden}</p>}
      {vorschlaege && vorschlaege.length > 0 && (
        <ul className="orte-zeilen">
          {vorschlaege.map((v) => (
            <li key={`${v.name}|${v.gegend}`}>
              <button type="button" className="ort-zeile" onClick={() => void waehlen(v)}>
                <span className="ort-text">
                  <b>{v.name}</b>
                  <span>{v.gegend}</span>
                </span>
                <span className="pfeil" aria-hidden="true">+</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
