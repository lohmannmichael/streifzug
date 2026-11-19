import { useState, type ReactNode } from "react";
import { useSitzung, type Sitzung } from "./daten/supabase";
import { alsKm, elternText, findeNachName, useRegionen, zaehlendeMeter, type GebietDaten, type Regionen } from "./daten/regionen";
import { useEinstellungen, type Einstellungen } from "./einstellungen";
import { Karte } from "./karte/Karte";
import { t } from "./texte/de";
import { IconGebiete, IconIch, IconKarte, IconStreifzuege, IconZurueck } from "./ui/Icons";

type Reiter = "karte" | "gebiete" | "streifzuege";

// Until the location is used, the map starts at home; the last chosen area is remembered.
const START_NAME = "Weiden";
const MERKEN = "streifzug.gebiet";

export function App() {
  const sitzung = useSitzung();
  const [reiter, setReiter] = useState<Reiter>("karte");
  const [profilOffen, setProfilOffen] = useState(false);
  const [gewaehlt, setGewaehlt] = useState<string | null>(() => localStorage.getItem(MERKEN));
  const [einstellungen, aendern] = useEinstellungen(sitzung);
  const daten = useRegionen();
  const gebiet = daten ? (daten.gebiete.get(gewaehlt ?? "") ?? findeNachName(daten, START_NAME) ?? null) : null;
  const waehlen = (id: string) => {
    setGewaehlt(id);
    localStorage.setItem(MERKEN, id);
  };

  if (profilOffen)
    return <Profil sitzung={sitzung} werte={einstellungen} aendern={aendern} schliessen={() => setProfilOffen(false)} />;

  return (
    <div className="app">
      <main className="inhalt">
        <div className="ansicht" hidden={reiter !== "karte"}>
          <Karte daten={daten} gewaehlt={gebiet?.id ?? null} gewaehltName={gebiet?.name ?? ""} onWaehlen={waehlen} />
          <button type="button" className="profil-knopf" aria-label={t.karte.profil} onClick={() => setProfilOffen(true)}>
            <IconIch />
          </button>
          <KartenBlatt gebiet={gebiet} daten={daten} einstellungen={einstellungen} />
        </div>
        {reiter === "gebiete" && (
          <GebieteSeite
            daten={daten}
            einstellungen={einstellungen}
            waehlen={(id) => {
              waehlen(id);
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

function KartenBlatt(props: { gebiet: GebietDaten | null; daten: Regionen | null; einstellungen: Einstellungen }) {
  const [hinweis, setHinweis] = useState(false);
  const { gebiet, daten } = props;
  const kmText = gebiet ? t.karte.kmZeile(alsKm(0), alsKm(zaehlendeMeter(gebiet, props.einstellungen.wegeZaehlen))) : t.karte.kmLaedt;
  return (
    <section className="blatt" aria-labelledby="gebiet-name">
      <div className="griff" aria-hidden="true" />
      <div className="blatt-kopf">
        <div>
          <h1 id="gebiet-name" className="gebiet">{gebiet?.name ?? "\u00a0"}</h1>
          <p className="ober">{gebiet && daten ? elternText(daten, gebiet.id) : "\u00a0"}</p>
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

function GebieteSeite(props: { daten: Regionen | null; einstellungen: Einstellungen; waehlen: (id: string) => void }) {
  const { daten, einstellungen } = props;
  if (!daten) return <LeereSeite titel={t.gebiete.titel} text={t.karte.kmLaedt} />;
  const km = (g: GebietDaten) => alsKm(zaehlendeMeter(g, einstellungen.wegeZaehlen));
  const sortiert = (ids: string[]) => ids.map((id) => daten.gebiete.get(id)!).sort((a, b) => a.name.localeCompare(b.name, "de"));
  const zeile = (g: GebietDaten) => (
    <li key={g.id}>
      <button type="button" className="gebiet-zeile" onClick={() => props.waehlen(g.id)}>
        <span className="gebiet-zeile-name">{g.name}</span>
        <span className="gebiet-zeile-wert">{t.gebiete.zeile(km(g))}</span>
      </button>
    </li>
  );
  return (
    <section className="seite" aria-labelledby="gebiete-titel">
      <h1 id="gebiete-titel">{t.gebiete.titel}</h1>
      {daten.liste.map((region) => {
        const wurzel = daten.gebiete.get(region.wurzel)!;
        const kinder = sortiert(wurzel.kinder);
        const mitEnkeln = kinder.some((k) => k.kinder.length > 0);
        const blaetter = (g: GebietDaten): number => (g.kinder.length === 0 ? 1 : g.kinder.reduce((n, k) => n + blaetter(daten.gebiete.get(k)!), 0));
        return (
          <div key={region.id} className="region">
            <div className="stadt-kopf">
              <h2 className="stadt-name">{region.name}</h2>
              <p className="leise">{t.gebiete.stadtZeile(km(wurzel), blaetter(wurzel))}</p>
            </div>
            {mitEnkeln ? (
              kinder.map((kind) => (
                <div key={kind.id}>
                  <h2>{kind.name}</h2>
                  <ul className="gruppe liste">{kind.kinder.length ? sortiert(kind.kinder).map(zeile) : zeile(kind)}</ul>
                </div>
              ))
            ) : (
              <ul className="gruppe liste">{kinder.map(zeile)}</ul>
            )}
          </div>
        );
      })}
      <p className="quelle">{t.gebiete.stand(new Date(daten.liste[0]?.stand ?? Date.now()).toLocaleDateString("de-DE"))}</p>
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
