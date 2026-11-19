import { useState, type ReactNode } from "react";
import { useSitzung, type Sitzung } from "./daten/supabase";
import { alsKm, useSummen, zaehlendeMeter, type Summen } from "./daten/summen";
import { useEinstellungen, type Einstellungen } from "./einstellungen";
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
  const [einstellungen, aendern] = useEinstellungen(sitzung);
  const summen = useSummen();

  if (profilOffen)
    return <Profil sitzung={sitzung} werte={einstellungen} aendern={aendern} schliessen={() => setProfilOffen(false)} />;

  return (
    <div className="app">
      <main className="inhalt">
        <div className="ansicht" hidden={reiter !== "karte"}>
          <Karte gewaehlt={gebiet} onWaehlen={setGebiet} />
          <button type="button" className="profil-knopf" aria-label={t.karte.profil} onClick={() => setProfilOffen(true)}>
            <IconIch />
          </button>
          <KartenBlatt gebiet={gebiet} summen={summen} einstellungen={einstellungen} />
        </div>
        {reiter === "gebiete" && (
          <GebieteSeite
            summen={summen}
            einstellungen={einstellungen}
            waehlen={(g) => {
              setGebiet(g);
              setReiter("karte");
            }}
          />
        )}
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

function KartenBlatt(props: { gebiet: Gebiet; summen: Summen | null; einstellungen: Einstellungen }) {
  const [hinweis, setHinweis] = useState(false);
  const summe = props.summen?.stadtteile[props.gebiet.nr];
  const kmText = summe ? t.karte.kmZeile(alsKm(0), alsKm(zaehlendeMeter(summe, props.einstellungen.wegeZaehlen))) : t.karte.kmLaedt;
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
      <div className="fortschritt">
        <div className="balken" aria-hidden="true"><i style={{ width: "0%" }} /></div>
        <p className="km">{kmText}</p>
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

function Profil(props: {
  sitzung: Sitzung;
  werte: Einstellungen;
  aendern: (teil: Partial<Einstellungen>) => void;
  schliessen: () => void;
}) {
  const { werte, aendern } = props;
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

function GebieteSeite(props: { summen: Summen | null; einstellungen: Einstellungen; waehlen: (g: Gebiet) => void }) {
  const { summen, einstellungen } = props;
  if (!summen) return <LeereSeite titel={t.gebiete.titel} text={t.karte.kmLaedt} />;
  const stadtteile = Object.entries(summen.stadtteile).map(([nr, s]) => ({ nr, ...s }));
  const bezirke = [...new Set(stadtteile.map((s) => s.bezirk))].sort((a, b) => a.localeCompare(b, "de"));
  return (
    <section className="seite" aria-labelledby="gebiete-titel">
      <h1 id="gebiete-titel">{t.gebiete.titel}</h1>
      <div className="stadt-kopf">
        <h2 className="stadt-name">{t.gebiete.koeln}</h2>
        <p className="leise">{t.gebiete.stadtZeile(alsKm(zaehlendeMeter(summen.stadt, einstellungen.wegeZaehlen)), stadtteile.length)}</p>
      </div>
      {bezirke.map((bezirk) => (
        <div key={bezirk}>
          <h2>{bezirk}</h2>
          <ul className="gruppe liste">
            {stadtteile
              .filter((s) => s.bezirk === bezirk)
              .sort((a, b) => a.name.localeCompare(b.name, "de"))
              .map((s) => (
                <li key={s.nr}>
                  <button type="button" className="gebiet-zeile" onClick={() => props.waehlen({ nr: s.nr, name: s.name, bezirk: s.bezirk })}>
                    <span className="gebiet-zeile-name">{s.name}</span>
                    <span className="gebiet-zeile-wert">{t.gebiete.zeile(alsKm(zaehlendeMeter(s, einstellungen.wegeZaehlen)))}</span>
                  </button>
                </li>
              ))}
          </ul>
        </div>
      ))}
      <p className="quelle">{t.gebiete.stand(new Date(summen.stand).toLocaleDateString("de-DE"))}</p>
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
