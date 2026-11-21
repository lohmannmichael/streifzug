import { useState } from "react";
import {
  lesen,
  overlandAbholen,
  overlandTrennen,
  overlandVerbinden,
  overlandVerbunden,
  overlandZuletzt,
  quelleLoeschen,
  uebernehmen,
  useQuellenInfo,
  type ImportVorschau,
  type QuellenInfo,
} from "../daten/import";
import { alsKm, type Regionen } from "../daten/regionen";
import type { Einstellungen } from "../einstellungen";
import { t } from "../texte/de";

const monat = new Intl.DateTimeFormat("de-DE", { month: "short", year: "numeric" });
const zeitpunkt = new Intl.DateTimeFormat("de-DE", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const OVERLAND_APP_STORE = "https://apps.apple.com/app/id1292426766";

/** Other sources: Overland (automatic, in the background) and GPX files, each with a switch. */
export function Importieren(props: { daten: Regionen | null; userId: string | null; werte: Einstellungen; aendern: (teil: Partial<Einstellungen>) => void }) {
  const info = useQuellenInfo();
  return (
    <>
      <Overland {...props} info={info} />
      {/* Google import is paused (large timelines made the app hang; Michi had them removed on 21.11.2026). */}
      <Gpx {...props} info={info} />
    </>
  );
}

/** Count, km and the "count it" switch for a source that already has outings. */
function Bestand(props: { info: QuellenInfo[keyof QuellenInfo]; an: boolean; setzen: (an: boolean) => void; empfangen?: boolean }) {
  if (!props.info) return null;
  const text = props.empfangen ? t.import.empfangen : t.import.vorhanden;
  return (
    <>
      <p className="zeile-text">{text(props.info.wege, alsKm(props.info.km * 1000))}</p>
      <label className="schalter-zeile">
        <span>
          <span className="schalter-label">{t.import.einrechnen}</span>
          <span className="schalter-hinweis">{t.import.einrechnenHinweis}</span>
        </span>
        <input type="checkbox" role="switch" className="schalter" checked={props.an} onChange={(e) => props.setzen(e.target.checked)} />
      </label>
    </>
  );
}

function Loeschen(props: { text: string; tun: () => void }) {
  const [fragen, setFragen] = useState(false);
  return (
    <button
      type="button"
      className="text-knopf warnung"
      onClick={() => {
        if (!fragen) return setFragen(true);
        setFragen(false);
        props.tun();
      }}
    >
      {fragen ? t.import.wirklichLoeschen : props.text}
    </button>
  );
}

function Overland(props: { daten: Regionen | null; userId: string | null; werte: Einstellungen; aendern: (teil: Partial<Einstellungen>) => void; info: QuellenInfo }) {
  const tx = t.import.overland;
  const [verbunden, setVerbunden] = useState(overlandVerbunden);
  const [link, setLink] = useState<string | null>(null);
  const [zustand, setZustand] = useState<"ruhe" | "verbindet" | "holt">("ruhe");
  const [meldung, setMeldung] = useState<string | null>(null);
  const [trennenFragen, setTrennenFragen] = useState(false);
  const zuletzt = overlandZuletzt();

  const verbinden = async () => {
    if (!props.userId) return setMeldung(tx.keinKonto);
    setZustand("verbindet");
    setMeldung(null);
    try {
      setLink(await overlandVerbinden(props.userId));
      setVerbunden(true);
    } catch (e) {
      setMeldung(e instanceof Error ? e.message : String(e));
    } finally {
      setZustand("ruhe");
    }
  };

  return (
    <div className="gruppe import">
      <div className="import-kopf">
        <p className="schalter-label">{tx.titel}</p>
        <p className="schalter-hinweis">{tx.erklaerung}</p>
        <details className="anleitung" open={!verbunden}>
          <summary>{t.import.soGehts}</summary>
          <ol>{tx.schritte.map((s) => <li key={s}>{s}</li>)}</ol>
        </details>
      </div>

      {verbunden && (
        <>
          <p className="zeile-text">
            {tx.verbunden} {zuletzt ? tx.zuletzt(zeitpunkt.format(zuletzt)) : tx.nochNie}
          </p>
          <Bestand empfangen info={props.info.overland} an={props.werte.overlandZaehlen} setzen={(an) => props.aendern({ overlandZaehlen: an })} />
        </>
      )}

      {link && (
        <div className="vorschau">
          <a className="haupt link-knopf" href={link}>{tx.uebernehmen}</a>
          <p className="schalter-hinweis">{tx.nurIphone}</p>
        </div>
      )}

      <div className="import-knoepfe">
        {!verbunden ? (
          <>
            <button type="button" className="datei-knopf" disabled={zustand !== "ruhe"} onClick={() => void verbinden()}>
              {zustand === "verbindet" ? tx.verbindet : tx.verbinden}
            </button>
            <a className="text-knopf" href={OVERLAND_APP_STORE} target="_blank" rel="noreferrer">{tx.installieren}</a>
          </>
        ) : (
          <>
            <button
              type="button"
              className="datei-knopf"
              disabled={zustand !== "ruhe" || !props.daten}
              onClick={async () => {
                setZustand("holt");
                const n = await overlandAbholen(props.daten!);
                setMeldung(tx.neuePunkte(n));
                setZustand("ruhe");
              }}
            >
              {zustand === "holt" ? tx.holt : tx.abholen}
            </button>
            {!link && (
              <button type="button" className="text-knopf" onClick={() => void verbinden()}>{tx.neuVerbinden}</button>
            )}
          </>
        )}
      </div>

      {verbunden && (
        <div className="import-knoepfe">
          <button
            type="button"
            className="text-knopf warnung"
            onClick={async () => {
              if (!trennenFragen) return setTrennenFragen(true);
              setTrennenFragen(false);
              if (props.userId) await overlandTrennen(props.userId);
              setVerbunden(false);
              setLink(null);
            }}
          >
            {trennenFragen ? tx.wirklichTrennen : tx.trennen}
          </button>
          {props.info.overland && <Loeschen text={t.import.loeschen} tun={() => void quelleLoeschen("overland")} />}
        </div>
      )}
      {meldung && <p className="zeile-text" role="status">{meldung}</p>}
    </div>
  );
}

function Gpx(props: { daten: Regionen | null; werte: Einstellungen; aendern: (teil: Partial<Einstellungen>) => void; info: QuellenInfo }) {
  const tx = t.import.gpx;
  const [vorschau, setVorschau] = useState<ImportVorschau | null>(null);
  const [zustand, setZustand] = useState<"ruhe" | "liest" | "speichert">("ruhe");
  const [fehler, setFehler] = useState<string | null>(null);
  const vorhanden = props.info.gpx;

  const dateienLesen = async (dateien: FileList | null) => {
    if (!dateien?.length || !props.daten) return;
    setFehler(null);
    setVorschau(null);
    setZustand("liest");
    try {
      setVorschau(await lesen("gpx", [...dateien], props.daten));
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

      <Bestand info={vorhanden} an={props.werte.gpxZaehlen} setzen={(an) => props.aendern({ gpxZaehlen: an })} />

      {vorschau ? (
        <Vorschau
          v={vorschau}
          speichert={zustand === "speichert"}
          abbrechen={() => setVorschau(null)}
          uebernehmen={async () => {
            setZustand("speichert");
            await uebernehmen("gpx");
            setZustand("ruhe");
            setVorschau(null);
            props.aendern({ gpxZaehlen: true });
          }}
        />
      ) : (
        <div className="import-knoepfe">
          <label className={zustand === "liest" || !props.daten ? "datei-knopf aus" : "datei-knopf"}>
            {zustand === "liest" ? t.import.liest : vorhanden ? t.import.nochmal : tx.waehlen}
            <input
              type="file"
              accept=".gpx,application/gpx+xml"
              multiple
              disabled={zustand === "liest" || !props.daten}
              onChange={(e) => {
                void dateienLesen(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
          {vorhanden && <Loeschen text={t.import.loeschen} tun={() => void quelleLoeschen("gpx")} />}
        </div>
      )}
      {fehler && <p className="zeile-text fehler" role="alert">{fehler}</p>}
    </div>
  );
}

function Vorschau(props: { v: ImportVorschau; speichert: boolean; abbrechen: () => void; uebernehmen: () => void }) {
  const { v } = props;
  if (v.wege === 0)
    return (
      <div className="vorschau">
        <p>{t.import.nichtsInGebieten(v.punkteGesamt)}</p>
        <button type="button" className="text-knopf" onClick={props.abbrechen}>{t.import.ok}</button>
      </div>
    );
  const dichte = v.dichte >= 0.7 ? "gut" : v.dichte >= 0.35 ? "mittel" : "grob";
  return (
    <div className="vorschau" aria-live="polite">
      <p className="vorschau-titel">{t.import.gefunden(v.wege)}</p>
      <ul>
        <li>{t.import.zeitraum(monat.format(v.von!), monat.format(v.bis!))}</li>
        <li>{t.import.kmZeile(alsKm(v.km.fuss * 1000), alsKm(v.km.rad * 1000), alsKm(v.km.auto * 1000))}</li>
        <li>{t.import.dichte[dichte]}</li>
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
