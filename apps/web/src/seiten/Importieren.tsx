import { useState } from "react";
import { googleLesen, gpxLesen, importeLoeschen, uebernehmen, type ImportVorschau } from "../daten/import";
import { alsKm, type Regionen } from "../daten/regionen";
import type { Streifzug } from "../daten/speicher";
import type { Einstellungen } from "../einstellungen";
import { t } from "../texte/de";

const monat = new Intl.DateTimeFormat("de-DE", { month: "short", year: "numeric" });
type QuelleImport = ImportVorschau["quelle"];

/** Import of other apps' histories (Google Maps Timeline, GPX), with a preview and a switch per source. */
export function Importieren(props: {
  daten: Regionen | null;
  streifzuege: Streifzug[];
  werte: Einstellungen;
  aendern: (teil: Partial<Einstellungen>) => void;
}) {
  return (
    <>
      <Quelle quelle="google" {...props} an={props.werte.googleZaehlen} setzen={(an) => props.aendern({ googleZaehlen: an })} />
      <Quelle quelle="gpx" {...props} an={props.werte.gpxZaehlen} setzen={(an) => props.aendern({ gpxZaehlen: an })} />
    </>
  );
}

function Quelle(props: { quelle: QuelleImport; daten: Regionen | null; streifzuege: Streifzug[]; an: boolean; setzen: (an: boolean) => void }) {
  const tx = t.import[props.quelle];
  const [vorschau, setVorschau] = useState<ImportVorschau | null>(null);
  const [zustand, setZustand] = useState<"ruhe" | "liest" | "speichert">("ruhe");
  const [fehler, setFehler] = useState<string | null>(null);
  const [loeschenFragen, setLoeschenFragen] = useState(false);
  const vorhanden = props.streifzuege.filter((s) => s.quelle === props.quelle);
  const vorhandenKm = vorhanden.reduce((m, s) => m + s.distanceM, 0);

  const lesen = async (dateien: FileList | null) => {
    if (!dateien?.length || !props.daten) return;
    setFehler(null);
    setVorschau(null);
    setZustand("liest");
    try {
      setVorschau(props.quelle === "google" ? await googleLesen(dateien[0]!, props.daten) : await gpxLesen([...dateien], props.daten));
    } catch (e) {
      setFehler(e instanceof Error ? e.message : String(e));
    } finally {
      setZustand("ruhe");
    }
  };

  return (
    <div className="gruppe import">
      <div className="import-kopf">
        <p className="schalter-label">{tx.titel}</p>
        <details className="anleitung">
          <summary>{t.import.soGehts}</summary>
          <ol>{tx.schritte.map((s) => <li key={s}>{s}</li>)}</ol>
        </details>
      </div>

      {vorhanden.length > 0 && (
        <>
          <p className="zeile-text">{t.import.vorhanden(vorhanden.length, alsKm(vorhandenKm))}</p>
          <label className="schalter-zeile">
            <span>
              <span className="schalter-label">{t.import.einrechnen}</span>
              <span className="schalter-hinweis">{t.import.einrechnenHinweis}</span>
            </span>
            <input type="checkbox" role="switch" className="schalter" checked={props.an} onChange={(e) => props.setzen(e.target.checked)} />
          </label>
        </>
      )}

      {vorschau ? (
        <Vorschau
          v={vorschau}
          speichert={zustand === "speichert"}
          abbrechen={() => setVorschau(null)}
          uebernehmen={async () => {
            setZustand("speichert");
            await uebernehmen(vorschau);
            setZustand("ruhe");
            setVorschau(null);
            props.setzen(true);
          }}
        />
      ) : (
        <div className="import-knoepfe">
          <label className={zustand === "liest" || !props.daten ? "datei-knopf aus" : "datei-knopf"}>
            {zustand === "liest" ? t.import.liest : vorhanden.length ? t.import.nochmal : tx.waehlen}
            <input
              type="file"
              accept={props.quelle === "google" ? ".json,application/json" : ".gpx,application/gpx+xml"}
              multiple={props.quelle === "gpx"}
              disabled={zustand === "liest" || !props.daten}
              onChange={(e) => {
                void lesen(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
          {vorhanden.length > 0 && (
            <button
              type="button"
              className="text-knopf warnung"
              onClick={() => {
                if (!loeschenFragen) return setLoeschenFragen(true);
                setLoeschenFragen(false);
                void importeLoeschen(props.quelle);
              }}
            >
              {loeschenFragen ? t.import.wirklichLoeschen : t.import.loeschen}
            </button>
          )}
        </div>
      )}
      {fehler && <p className="zeile-text fehler" role="alert">{fehler}</p>}
    </div>
  );
}

function Vorschau(props: { v: ImportVorschau; speichert: boolean; abbrechen: () => void; uebernehmen: () => void }) {
  const { v } = props;
  if (v.wege.length === 0)
    return (
      <div className="vorschau">
        <p>{t.import.nichtsInGebieten(v.punkteGesamt)}</p>
        <button type="button" className="text-knopf" onClick={props.abbrechen}>{t.import.ok}</button>
      </div>
    );
  const dichte = v.dichte >= 0.7 ? "gut" : v.dichte >= 0.35 ? "mittel" : "grob";
  return (
    <div className="vorschau" aria-live="polite">
      <p className="vorschau-titel">{t.import.gefunden(v.wege.length)}</p>
      <ul>
        <li>{t.import.zeitraum(monat.format(v.von!), monat.format(v.bis!))}</li>
        <li>{t.import.kmZeile(alsKm(v.km.fuss * 1000), alsKm(v.km.rad * 1000), alsKm(v.km.auto * 1000))}</li>
        <li>
          {t.import.dichte[dichte]}
        </li>
      </ul>
      <div className="vorschau-knoepfe">
        <button type="button" className="haupt" disabled={props.speichert} onClick={props.uebernehmen}>
          {props.speichert ? t.import.speichert : t.import.uebernehmen}
        </button>
        <button type="button" className="text-knopf" onClick={props.abbrechen}>{t.import.abbrechen}</button>
      </div>
      <p className="schalter-hinweis">{t.import.nurGeraet}</p>
    </div>
  );
}
