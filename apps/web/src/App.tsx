import { useEffect, useState, type ReactNode } from "react";
import { useAufzeichnung, useStreifzuege, type Aufzeichnung } from "./daten/aufzeichnung";
import { useFortschritt, type Fortschritt } from "./daten/fortschritt";
import type { Streifzug } from "./daten/speicher";
import { useSitzung, type Sitzung } from "./daten/supabase";
import { alsKm, alsStrecke, elternText, findeNachName, prozent, prozentText, useRegionen, zaehlendeMeter, type GebietDaten, type Regionen } from "./daten/regionen";
import { useEinstellungen, type Einstellungen } from "./einstellungen";
import { Karte } from "./karte/Karte";
import { t } from "./texte/de";
import { IconGebiete, IconIch, IconKarte, IconStandort, IconStreifzuege, IconZurueck } from "./ui/Icons";

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
  const aufzeichnung = useAufzeichnung();
  const streifzuege = useStreifzuege();
  // Car rides count only with the switch on (docs/PLAN.md, section 2).
  const zaehlende = streifzuege.filter((s) => s.mode !== "car" || einstellungen.autoZaehlen);
  const spuren = [...zaehlende.map((s) => s.fixes), ...(aufzeichnung.aktiv ? [aufzeichnung.fixes] : [])];
  const fortschritt = useFortschritt(spuren, daten);
  const [position, setPosition] = useState<[number, number] | null>(null);
  const [zentrieren, setZentrieren] = useState(0);
  const [standortFehler, setStandortFehler] = useState(false);
  const zumStandort = () => {
    setStandortFehler(false);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setPosition([p.coords.longitude, p.coords.latitude]);
        setZentrieren((n) => n + 1);
      },
      () => setStandortFehler(true),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 30_000 },
    );
  };

  if (profilOffen)
    return <Profil sitzung={sitzung} werte={einstellungen} aendern={aendern} schliessen={() => setProfilOffen(false)} />;

  return (
    <div className="app">
      <main className="inhalt">
        <div className="ansicht" hidden={reiter !== "karte"}>
          <Karte
            daten={daten}
            gewaehlt={gebiet?.id ?? null}
            gewaehltName={gebiet?.name ?? ""}
            onWaehlen={waehlen}
            spur={aufzeichnung.fixes}
            entdeckt={fortschritt?.stuecke ?? []}
            prozente={prozenteJeGebiet(daten, fortschritt, einstellungen.wegeZaehlen)}
            folgen={aufzeichnung.aktiv}
            position={position}
            zentrieren={zentrieren}
          />
          <div className="karten-knoepfe">
            <button type="button" className="rund-knopf" aria-label={t.karte.profil} onClick={() => setProfilOffen(true)}>
              <IconIch />
            </button>
            <button type="button" className="rund-knopf" aria-label={t.karte.standort} onClick={zumStandort}>
              <IconStandort />
            </button>
          </div>
          <KartenBlatt
            gebiet={gebiet}
            daten={daten}
            einstellungen={einstellungen}
            aufzeichnung={aufzeichnung}
            standortFehler={standortFehler}
            fortschritt={fortschritt}
          />
        </div>
        {reiter === "gebiete" && (
          <GebieteSeite
            daten={daten}
            fortschritt={fortschritt}
            einstellungen={einstellungen}
            waehlen={(id) => {
              waehlen(id);
              setReiter("karte");
            }}
          />
        )}
        {reiter === "streifzuege" && <StreifzuegeSeite liste={streifzuege} />}
      </main>
      <nav className="leiste" aria-label="Hauptnavigation">
        <ReiterKnopf aktiv={reiter === "karte"} onClick={() => setReiter("karte")} icon={<IconKarte />} label={t.tabs.karte} />
        <ReiterKnopf aktiv={reiter === "gebiete"} onClick={() => setReiter("gebiete")} icon={<IconGebiete />} label={t.tabs.gebiete} />
        <ReiterKnopf aktiv={reiter === "streifzuege"} onClick={() => setReiter("streifzuege")} icon={<IconStreifzuege />} label={t.tabs.streifzuege} />
      </nav>
    </div>
  );
}

function prozenteJeGebiet(daten: Regionen | null, f: Fortschritt | null, wege: boolean): Map<string, number> {
  const m = new Map<string, number>();
  if (!daten || !f) return m;
  for (const [id, gesehen] of f.proGebiet) {
    const g = daten.gebiete.get(id);
    if (g) m.set(id, prozent(zaehlendeMeter(gesehen, wege), zaehlendeMeter(g, wege)));
  }
  return m;
}

function ReiterKnopf(props: { aktiv: boolean; onClick: () => void; icon: ReactNode; label: string }) {
  return (
    <button type="button" className="reiter" aria-current={props.aktiv ? "page" : undefined} onClick={props.onClick}>
      {props.icon}
      <span>{props.label}</span>
    </button>
  );
}

function KartenBlatt(props: {
  gebiet: GebietDaten | null;
  daten: Regionen | null;
  einstellungen: Einstellungen;
  aufzeichnung: Aufzeichnung;
  standortFehler: boolean;
  fortschritt: Fortschritt | null;
}) {
  const { gebiet, daten, aufzeichnung: a } = props;
  const wege = props.einstellungen.wegeZaehlen;
  const gesamt = gebiet ? zaehlendeMeter(gebiet, wege) : 0;
  const gesehen = gebiet ? zaehlendeMeter(props.fortschritt?.proGebiet.get(gebiet.id) ?? { strasse_m: 0, weg_m: 0 }, wege) : 0;
  const p = prozent(gesehen, gesamt);
  const kmText = gebiet ? t.karte.kmZeile(alsKm(gesehen), alsKm(gesamt)) : t.karte.kmLaedt;
  return (
    <section className="blatt" aria-labelledby="gebiet-name">
      <div className="griff" aria-hidden="true" />
      <div className="blatt-kopf">
        <div>
          <h1 id="gebiet-name" className="gebiet">{gebiet?.name ?? "\u00a0"}</h1>
          <p className="ober">{gebiet && daten ? elternText(daten, gebiet.id) : "\u00a0"}</p>
        </div>
        <p className="prozent" aria-label={`${prozentText(p)} Prozent ${t.karte.prozentLabel}`}>
          <span className="zahl"><span className="marker">{prozentText(p)}</span><span className="einheit">%</span></span>
          <span className="prozent-label" aria-hidden="true">{t.karte.prozentLabel}</span>
        </p>
      </div>
      <div className="fortschritt">
        <div className="balken" aria-hidden="true"><i style={{ width: `${p}%` }} /></div>
        <p className="km">{kmText}</p>
      </div>
      {a.aktiv ? <Unterwegs a={a} /> : <Ruhe a={a} />}
      <button type="button" className={a.aktiv ? "haupt zweit" : "haupt"} onClick={a.aktiv ? a.beenden : a.starten}>
        {a.aktiv ? t.karte.beenden : t.karte.losziehen}
      </button>
      <p className="hinweis" aria-live="polite">{props.standortFehler ? t.karte.standortFehler : a.aktiv ? t.karte.hinweisOffen : ""}</p>
    </section>
  );
}

/** Live numbers while recording. */
function Unterwegs({ a }: { a: Aufzeichnung }) {
  const [jetzt, setJetzt] = useState(Date.now());
  useEffect(() => {
    const takt = window.setInterval(() => setJetzt(Date.now()), 1000);
    return () => window.clearInterval(takt);
  }, []);
  const sekunden = a.startedAt ? Math.max(0, Math.round((jetzt - a.startedAt) / 1000)) : 0;
  return (
    <div className="unterwegs" aria-live="polite">
      <div className="werte">
        <div><b>{dauerText(sekunden, true)}</b><span>{t.karte.unterwegs}</span></div>
        <div><b>{alsStrecke(a.distanzM)}</b><span>Strecke</span></div>
      </div>
      <p className={`gps gps-${a.gps}`}>{t.karte.gps[a.gps]}</p>
    </div>
  );
}

/** Before the first outing: the invitation; after one: its summary. */
function Ruhe({ a }: { a: Aufzeichnung }) {
  const s = a.letzter;
  if (!s) return <p className="leer">{t.karte.leer}</p>;
  return (
    <p className="leer" aria-live="polite">
      {t.karte.zusammenfassung(alsStrecke(s.distanceM), dauerText(Math.round(((s.endedAt ?? s.startedAt) - s.startedAt) / 1000)), t.streifzuege.art[s.mode])}.{" "}
      <StatusText s={s} />
    </p>
  );
}

function StatusText({ s }: { s: Streifzug }) {
  const liste = useStreifzuege();
  const aktuell = liste.find((x) => x.id === s.id) ?? s;
  return <>{aktuell.status === "gesichert" ? t.karte.gesichert : t.karte.wirdGesichert}</>;
}

function dauerText(sekunden: number, uhr = false): string {
  const h = Math.floor(sekunden / 3600);
  const m = Math.floor((sekunden % 3600) / 60);
  const s = sekunden % 60;
  if (uhr) return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
  return h ? `${h} Std. ${m} Min.` : `${Math.max(1, m)} Min.`;
}

const datum = new Intl.DateTimeFormat("de-DE", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

function StreifzuegeSeite({ liste }: { liste: Streifzug[] }) {
  if (liste.length === 0) return <LeereSeite titel={t.streifzuege.titel} text={t.streifzuege.leer} />;
  return (
    <section className="seite" aria-labelledby="streifzuege-titel">
      <h1 id="streifzuege-titel">{t.streifzuege.titel}</h1>
      <ul className="gruppe liste streifzug-liste">
        {liste.map((s) => (
          <li key={s.id} className="streifzug-zeile">
            <div>
              <p className="streifzug-datum">{datum.format(s.startedAt)}</p>
              <p className="leise">
                {alsStrecke(s.distanceM)}, {dauerText(Math.round(((s.endedAt ?? s.startedAt) - s.startedAt) / 1000))}, {t.streifzuege.art[s.mode]}
              </p>
            </div>
            <span className={`status status-${s.status}`}>{s.status === "gesichert" ? t.streifzuege.status.gesichert : t.streifzuege.status.lokal}</span>
          </li>
        ))}
      </ul>
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

function GebieteSeite(props: { daten: Regionen | null; fortschritt: Fortschritt | null; einstellungen: Einstellungen; waehlen: (id: string) => void }) {
  const { daten, einstellungen } = props;
  const pr = (g: GebietDaten) =>
    prozentText(prozent(zaehlendeMeter(props.fortschritt?.proGebiet.get(g.id) ?? { strasse_m: 0, weg_m: 0 }, einstellungen.wegeZaehlen), zaehlendeMeter(g, einstellungen.wegeZaehlen)));
  if (!daten) return <LeereSeite titel={t.gebiete.titel} text={t.karte.kmLaedt} />;
  const km = (g: GebietDaten) => alsKm(zaehlendeMeter(g, einstellungen.wegeZaehlen));
  const sortiert = (ids: string[]) => ids.map((id) => daten.gebiete.get(id)!).sort((a, b) => a.name.localeCompare(b.name, "de"));
  const zeile = (g: GebietDaten) => (
    <li key={g.id}>
      <button type="button" className="gebiet-zeile" onClick={() => props.waehlen(g.id)}>
        <span className="gebiet-zeile-name">{g.name}</span>
        <span className="gebiet-zeile-wert">{t.gebiete.zeile(pr(g), km(g))}</span>
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
