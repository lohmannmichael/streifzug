import { useState, type ReactNode } from "react";
import { useEinstellungen } from "./einstellungen";
import { Karte } from "./karte/Karte";
import { t } from "./texte/de";
import { IconGebiete, IconIch, IconKarte } from "./ui/Icons";

type Reiter = "karte" | "gebiete" | "ich";

export function App() {
  const [reiter, setReiter] = useState<Reiter>("karte");

  return (
    <div className="app">
      <main className="inhalt">
        <div className="ansicht" hidden={reiter !== "karte"}>
          <Karte />
          <KartenBlatt />
        </div>
        {reiter === "gebiete" && <Gebiete />}
        {reiter === "ich" && <Ich />}
      </main>
      <nav className="leiste" aria-label="Hauptnavigation">
        <ReiterKnopf aktiv={reiter === "karte"} onClick={() => setReiter("karte")} icon={<IconKarte />} label={t.tabs.karte} />
        <ReiterKnopf aktiv={reiter === "gebiete"} onClick={() => setReiter("gebiete")} icon={<IconGebiete />} label={t.tabs.gebiete} />
        <ReiterKnopf aktiv={reiter === "ich"} onClick={() => setReiter("ich")} icon={<IconIch />} label={t.tabs.ich} />
      </nav>
    </div>
  );
}

function ReiterKnopf(props: { aktiv: boolean; onClick: () => void; icon: ReactNode; label: string }) {
  return (
    <button type="button" className="reiter" aria-current={props.aktiv ? "page" : undefined} onClick={props.onClick}>
      {props.icon}
      <span>{props.label}</span>
    </button>
  );
}

function KartenBlatt() {
  const [hinweis, setHinweis] = useState(false);
  return (
    <section className="blatt" aria-labelledby="gebiet-name">
      <div className="griff" aria-hidden="true" />
      <div className="blatt-kopf">
        <div>
          <h1 id="gebiet-name" className="gebiet">{t.karte.gebiet}</h1>
          <p className="ober">{t.karte.oberGebiet}</p>
        </div>
        <p className="prozent" aria-label={`0 Prozent ${t.karte.prozentLabel}`}>
          <span className="zahl"><span className="marker">0</span><span className="einheit">%</span></span>
          <span className="prozent-label" aria-hidden="true">{t.karte.prozentLabel}</span>
        </p>
      </div>
      <p className="leer">{t.karte.leer}</p>
      <button type="button" className="haupt" onClick={() => setHinweis(true)}>
        {t.karte.losziehen}
      </button>
      <p className="hinweis" aria-live="polite">{hinweis ? t.karte.bald : ""}</p>
    </section>
  );
}

function Gebiete() {
  return (
    <section className="seite" aria-labelledby="gebiete-titel">
      <h1 id="gebiete-titel">{t.gebiete.titel}</h1>
      <p className="leer gross">{t.gebiete.leer}</p>
    </section>
  );
}

function Ich() {
  const [werte, aendern] = useEinstellungen();
  return (
    <section className="seite" aria-labelledby="ich-titel">
      <h1 id="ich-titel">{t.ich.titel}</h1>
      <h2>{t.ich.zaehlen}</h2>
      <div className="gruppe">
        <Schalter label={t.ich.wege} hinweis={t.ich.wegeHinweis} an={werte.wegeZaehlen} onChange={(an) => aendern({ wegeZaehlen: an })} />
        <Schalter label={t.ich.auto} hinweis={t.ich.autoHinweis} an={werte.autoZaehlen} onChange={(an) => aendern({ autoZaehlen: an })} />
      </div>
      <h2>{t.ich.daten}</h2>
      <div className="gruppe">
        <p className="zeile-text">{t.ich.datenHinweis}</p>
      </div>
      <p className="quelle">{t.ich.quelle}</p>
    </section>
  );
}

function Schalter(props: { label: string; hinweis: string; an: boolean; onChange: (an: boolean) => void }) {
  return (
    <label className="schalter-zeile">
      <span>
        <span className="schalter-label">{props.label}</span>
        <span className="schalter-hinweis">{props.hinweis}</span>
      </span>
      <input type="checkbox" role="switch" className="schalter" checked={props.an} onChange={(e) => props.onChange(e.target.checked)} />
    </label>
  );
}
