import { useState, type ReactNode } from "react";
import { useSitzung, type Sitzung } from "./daten/supabase";
import { useEinstellungen } from "./einstellungen";
import { Karte, type Gebiet } from "./karte/Karte";
import { t } from "./texte/de";
import { IconGebiete, IconIch, IconKarte, IconStreifzuege, IconZurueck } from "./ui/Icons";

type Reiter = "karte" | "gebiete" | "streifzuege";

// Until the location is used, the map starts at home.
const START_GEBIET: Gebiet = { nr: "307", name: "Weiden", bezirk: "Lindenthal" };

export function App() {
  const sitzung = useSitzung();
  const [reiter, setReiter] = useState<Reiter>("karte");
  const [profilOffen, setProfilOffen] = useState(false);
  const [gebiet, setGebiet] = useState<Gebiet>(START_GEBIET);

  if (profilOffen) return <Profil sitzung={sitzung} schliessen={() => setProfilOffen(false)} />;

  return (
    <div className="app">
      <main className="inhalt">
        <div className="ansicht" hidden={reiter !== "karte"}>
          <Karte gewaehlt={gebiet} onWaehlen={setGebiet} />
          <button type="button" className="profil-knopf" aria-label={t.karte.profil} onClick={() => setProfilOffen(true)}>
            <IconIch />
          </button>
          <KartenBlatt gebiet={gebiet} />
        </div>
        {reiter === "gebiete" && <LeereSeite titel={t.gebiete.titel} text={t.gebiete.leer} />}
        {reiter === "streifzuege" && <LeereSeite titel={t.streifzuege.titel} text={t.streifzuege.leer} />}
      </main>
      <nav className="leiste" aria-label="Hauptnavigation">
        <ReiterKnopf aktiv={reiter === "karte"} onClick={() => setReiter("karte")} icon={<IconKarte />} label={t.tabs.karte} />
        <ReiterKnopf aktiv={reiter === "gebiete"} onClick={() => setReiter("gebiete")} icon={<IconGebiete />} label={t.tabs.gebiete} />
        <ReiterKnopf aktiv={reiter === "streifzuege"} onClick={() => setReiter("streifzuege")} icon={<IconStreifzuege />} label={t.tabs.streifzuege} />
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

function KartenBlatt(props: { gebiet: Gebiet }) {
  const [hinweis, setHinweis] = useState(false);
  return (
    <section className="blatt" aria-labelledby="gebiet-name">
      <div className="griff" aria-hidden="true" />
      <div className="blatt-kopf">
        <div>
          <h1 id="gebiet-name" className="gebiet">{props.gebiet.name}</h1>
          <p className="ober">{t.karte.oberGebiet(props.gebiet.bezirk)}</p>
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

function LeereSeite(props: { titel: string; text: string }) {
  return (
    <section className="seite" aria-labelledby="seiten-titel">
      <h1 id="seiten-titel">{props.titel}</h1>
      <p className="leer gross">{props.text}</p>
    </section>
  );
}

function Profil(props: { sitzung: Sitzung; schliessen: () => void }) {
  const [werte, aendern] = useEinstellungen(props.sitzung);
  const kontoText =
    props.sitzung.status === "bereit" ? t.ich.kontoAnonym : props.sitzung.status === "offline" ? t.ich.kontoOffline : t.ich.kontoLaedt;
  return (
    <div className="app">
      <section className="seite seite-voll" aria-labelledby="profil-titel">
        <button type="button" className="zurueck" onClick={props.schliessen}>
          <IconZurueck />
          <span>{t.ich.zurueck}</span>
        </button>
        <h1 id="profil-titel">{t.ich.titel}</h1>
        <h2>{t.ich.zaehlen}</h2>
        <div className="gruppe">
          <Schalter label={t.ich.wege} hinweis={t.ich.wegeHinweis} an={werte.wegeZaehlen} onChange={(an) => aendern({ wegeZaehlen: an })} />
          <Schalter label={t.ich.auto} hinweis={t.ich.autoHinweis} an={werte.autoZaehlen} onChange={(an) => aendern({ autoZaehlen: an })} />
        </div>
        <h2>{t.ich.konto}</h2>
        <div className="gruppe">
          <p className="zeile-text">{kontoText}</p>
        </div>
        <h2>{t.ich.daten}</h2>
        <div className="gruppe">
          <p className="zeile-text">{t.ich.datenHinweis}</p>
        </div>
        <p className="quelle">{t.ich.quelle}</p>
      </section>
    </div>
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
