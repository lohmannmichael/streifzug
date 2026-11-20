import { distanceM, milestoneReached, type LonLat } from "@streifzug/core";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNeueStrassen } from "./daten/unterwegs";
import { useAufzeichnung, useStreifzuege, type Aufzeichnung } from "./daten/aufzeichnung";
import { useFortschritt, type Fortschritt } from "./daten/fortschritt";
import type { Streifzug } from "./daten/speicher";
import { useSitzung, type Sitzung } from "./daten/supabase";
import { alsKm, alsStrecke, elternText, findeNachName, prozent, prozentText, useMittelpunkte, useRegionen, zaehlendeMeter, type GebietDaten, type Regionen } from "./daten/regionen";
import { useEinstellungen, type Einstellungen } from "./einstellungen";
import { useWeisserFleck, type Fleck } from "./daten/fleck";
import { LogbuchSeite } from "./seiten/Logbuch";
import { Stempel } from "./ui/Stempel";
import { Karte } from "./karte/Karte";
import { t } from "./texte/de";
import { dauerText } from "./ui/format";
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
  // Progress before the current outing, to show what it added afterwards.
  const vorher = useRef<Fortschritt | null>(null);
  const warAktiv = useRef(false);
  if (aufzeichnung.aktiv && !warAktiv.current) vorher.current = fortschritt ?? { stuecke: [], proGebiet: new Map() };
  warAktiv.current = aufzeichnung.aktiv;
  // While out and about: what this outing has discovered so far (for the counter at the top).
  const vorherIds = useMemo(() => new Set((vorher.current?.stuecke ?? []).map((p) => p.id)), [vorher.current]);
  const neuUnterwegs = aufzeichnung.aktiv && fortschritt ? fortschritt.stuecke.filter((p) => !vorherIds.has(p.id)) : [];
  const neuUnterwegsM = neuUnterwegs.reduce((m, p) => m + (p.kind === "street" || einstellungen.wegeZaehlen ? p.lengthM * p.weight : 0), 0);
  const neueStrassen = useNeueStrassen(neuUnterwegs);
  const [position, setPosition] = useState<[number, number] | null>(null);
  const [zentrieren, setZentrieren] = useState(0);
  const [standortFehler, setStandortFehler] = useState(false);
  // "Weißer Fleck": from the own position, otherwise from the middle of the chosen area.
  const punkte = useMittelpunkte(daten);
  const fleckBezug: LonLat | null = position ?? (gebiet ? (punkte?.get(gebiet.id) ?? null) : null);
  const fleck = useWeisserFleck(aufzeichnung.aktiv ? null : fleckBezug, fortschritt, einstellungen.wegeZaehlen);
  const [markiert, setMarkiert] = useState<{ fleck: Fleck; nr: number } | null>(null);
  useEffect(() => {
    if (aufzeichnung.aktiv) setMarkiert(null);
  }, [aufzeichnung.aktiv]);
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
            zeichnen={aufzeichnung.aktiv}
            wegeZaehlen={einstellungen.wegeZaehlen}
            nebel={einstellungen.nebel}
            position={position}
            zentrieren={zentrieren}
            markiert={markiert ? { linien: markiert.fleck.linien, nr: markiert.nr } : null}
          />
          {aufzeichnung.aktiv && (
            <p className="unterwegs-zaehler" aria-live="polite">
              {neuUnterwegsM >= 1 ? (
                <>
                  <span className="marker">+{alsStrecke(neuUnterwegsM)}</span> {t.karte.zaehlerNeu}
                  {neueStrassen > 0 && <span className="leise"> · {t.karte.zaehlerStrassen(neueStrassen)}</span>}
                </>
              ) : (
                t.karte.zaehlerNichts
              )}
            </p>
          )}
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
            vorher={vorher.current}
            fleck={fleck}
            fleckVomStandort={position !== null}
            fleckZeigen={(f) => setMarkiert((m) => ({ fleck: f, nr: (m?.nr ?? 0) + 1 }))}
          />
        </div>
        {reiter === "gebiete" && (
          <GebieteSeite
            daten={daten}
            fortschritt={fortschritt}
            einstellungen={einstellungen}
            gewaehlt={gebiet}
            position={aufzeichnung.fixes.length ? [aufzeichnung.fixes.at(-1)!.lon, aufzeichnung.fixes.at(-1)!.lat] : position}
            standortHolen={zumStandort}
            waehlen={(id) => {
              waehlen(id);
              setReiter("karte");
            }}
          />
        )}
        {reiter === "streifzuege" && (
          <LogbuchSeite
            liste={streifzuege}
            daten={daten}
            einstellungen={einstellungen}
            zeigen={(id) => {
              waehlen(id);
              setReiter("karte");
            }}
          />
        )}
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
  vorher: Fortschritt | null;
  fleck: Fleck | null;
  fleckVomStandort: boolean;
  fleckZeigen: (f: Fleck) => void;
}) {
  const { gebiet, daten, aufzeichnung: a } = props;
  const wege = props.einstellungen.wegeZaehlen;
  const gesamt = gebiet ? zaehlendeMeter(gebiet, wege) : 0;
  const gesehen = gebiet ? zaehlendeMeter(props.fortschritt?.proGebiet.get(gebiet.id) ?? { strasse_m: 0, weg_m: 0 }, wege) : 0;
  const p = prozent(gesehen, gesamt);
  // The sheet can be pulled down (or the handle tapped) to free the map, and pulled up again.
  const [klein, setKlein] = useState(false);
  // Unterwegs-Modus: small sheet and a big map while recording; back to full size for the reward.
  useEffect(() => setKlein(a.aktiv), [a.aktiv]);
  const zug = useRef<number | null>(null);
  const kmText = gebiet ? t.karte.kmZeile(alsKm(gesehen), alsKm(gesamt)) : t.karte.kmLaedt;
  return (
    <section
      className={klein ? "blatt klein" : "blatt"}
      aria-labelledby="gebiet-name"
      onPointerDown={(e) => (zug.current = e.clientY)}
      onPointerUp={(e) => {
        if (zug.current === null) return;
        const weg = e.clientY - zug.current;
        zug.current = null;
        if (weg > 40) setKlein(true);
        else if (weg < -40) setKlein(false);
      }}
    >
      <button type="button" className="griff" aria-label={klein ? t.karte.blattAuf : t.karte.blattZu} aria-expanded={!klein} onClick={() => setKlein(!klein)} />
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
      {a.aktiv ? (
        <Unterwegs a={a} />
      ) : !a.letzter && props.fleck && gebiet ? (
        <FleckZeile fleck={props.fleck} gebietName={gebiet.name} vomStandort={props.fleckVomStandort} zeigen={props.fleckZeigen} />
      ) : (
        <Ruhe a={a} schonGelb={gesehen > 0} />
      )}
      {!a.aktiv && a.letzter && gebiet && props.vorher && (
        <Belohnung
          name={gebiet.name}
          vorherM={zaehlendeMeter(props.vorher.proGebiet.get(gebiet.id) ?? { strasse_m: 0, weg_m: 0 }, wege)}
          jetztM={gesehen}
          gesamtM={gesamt}
        />
      )}
      <button type="button" className={a.aktiv ? "haupt zweit" : "haupt"} onClick={a.aktiv ? a.beenden : a.starten}>
        {a.aktiv ? t.karte.beenden : t.karte.losziehen}
      </button>
      <p className="hinweis" aria-live="polite">{props.standortFehler ? t.karte.standortFehler : a.aktiv ? t.karte.hinweisOffen : ""}</p>
    </section>
  );
}

/** Nearest undiscovered street, with a button that shows it on the map. */
function FleckZeile(props: { fleck: Fleck; gebietName: string; vomStandort: boolean; zeigen: (f: Fleck) => void }) {
  const name = props.fleck.name ?? t.karte.fleckOhneName;
  return (
    <div className="fleck">
      <span className="fleck-punkt" aria-hidden="true" />
      <p>
        <b>{t.karte.fleckTitel}</b>
        <span className="leise">{props.vomStandort ? t.karte.fleckNah(name, alsStrecke(props.fleck.distanceM)) : t.karte.fleckIn(name, props.gebietName)}</span>
      </p>
      <button type="button" className="text-knopf" onClick={() => props.zeigen(props.fleck)}>{t.karte.fleckZeigen}</button>
    </div>
  );
}

/** What the last outing added in the shown area, with a stamp when it reached a milestone. */
function Belohnung(props: { name: string; vorherM: number; jetztM: number; gesamtM: number }) {
  const neu = props.jetztM - props.vorherM;
  if (neu < 1) return null;
  const vorherP = prozent(props.vorherM, props.gesamtM);
  const jetztP = prozent(props.jetztM, props.gesamtM);
  const stufe = milestoneReached(vorherP, jetztP);
  return (
    <div className="belohnung-zeile">
      <p className="belohnung" role="status">
        <span className="marker">+{alsStrecke(neu)}</span> {t.karte.belohnung(props.name, prozentText(vorherP), prozentText(jetztP))}
      </p>
      {stufe && <Stempel name={props.name} prozent={stufe} datum={Date.now()} neu />}
    </div>
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
function Ruhe({ a, schonGelb }: { a: Aufzeichnung; schonGelb: boolean }) {
  const s = a.letzter;
  if (!s) return <p className="leer">{schonGelb ? t.karte.schonEntdeckt : t.karte.leer}</p>;
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
        <h2>{t.ich.ansicht}</h2>
        <div className="gruppe">
          <Schalter label={t.ich.nebel} hinweis={t.ich.nebelHinweis} an={werte.nebel} onChange={(an) => aendern({ nebel: an })} />
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

type Sortierung = "naehe" | "entdeckt" | "az";
const SORTIERUNG = "streifzug.gebiete-sortierung";
const SCHRITT = 15;

function GebieteSeite(props: {
  daten: Regionen | null;
  fortschritt: Fortschritt | null;
  einstellungen: Einstellungen;
  gewaehlt: GebietDaten | null;
  position: [number, number] | null;
  standortHolen: () => void;
  waehlen: (id: string) => void;
}) {
  const { daten, einstellungen } = props;
  const punkte = useMittelpunkte(daten);
  const [sortierung, setSortierung] = useState<Sortierung>(() => (localStorage.getItem(SORTIERUNG) as Sortierung | null) ?? "naehe");
  const [anzahl, setAnzahl] = useState(SCHRITT);
  const sortieren = (s: Sortierung) => {
    setSortierung(s);
    setAnzahl(SCHRITT);
    localStorage.setItem(SORTIERUNG, s);
  };
  if (!daten) return <LeereSeite titel={t.gebiete.titel} text={t.karte.kmLaedt} />;

  const wege = einstellungen.wegeZaehlen;
  const gesamtM = (g: GebietDaten) => zaehlendeMeter(g, wege);
  const anteil = (g: GebietDaten) => prozent(zaehlendeMeter(props.fortschritt?.proGebiet.get(g.id) ?? { strasse_m: 0, weg_m: 0 }, wege), gesamtM(g));
  const blaetter = [...daten.gebiete.values()].filter((g) => g.kinder.length === 0);
  const sortiert = (ids: string[]) => ids.map((id) => daten.gebiete.get(id)!).sort((a, b) => a.name.localeCompare(b.name, "de"));

  // "Near you": from the own position, otherwise from the area chosen on the map.
  const bezugPunkt = props.position ?? (props.gewaehlt ? punkte?.get(props.gewaehlt.id) : undefined) ?? null;
  const entfernung = (g: GebietDaten) => {
    const p = punkte?.get(g.id);
    return p && bezugPunkt ? distanceM(bezugPunkt, p) : Infinity;
  };

  const zeile = (g: GebietDaten, zusatz?: string) => {
    const p = anteil(g);
    return (
      <li key={g.id}>
        <button type="button" className="gebiet-zeile" onClick={() => props.waehlen(g.id)}>
          <span className="gebiet-zeile-text">
            <span className="gebiet-zeile-name">{g.name}</span>
            {zusatz && <span className="gebiet-zeile-zusatz">{zusatz}</span>}
            {/* Something discovered always shows a visible bit of yellow. */}
            <span className="mini-balken" aria-hidden="true"><i style={{ width: `${p > 0 ? Math.max(p, 3) : 0}%` }} /></span>
          </span>
          <span className="gebiet-zeile-wert">
            <b className={p > 0 ? "gebiet-prozent an" : "gebiet-prozent"}>{t.gebiete.prozentKurz(prozentText(p))}</b>
            <span>{t.gebiete.vonKm(alsKm(gesamtM(g)))}</span>
          </span>
        </button>
      </li>
    );
  };

  let inhalt: ReactNode;
  if (sortierung === "naehe") {
    const liste = [...blaetter].sort((a, b) => entfernung(a) - entfernung(b));
    inhalt = (
      <>
        <div className="sortier-zeile">
          <p className="leise">{props.position ? t.gebiete.naeheStandort : t.gebiete.naeheGebiet(props.gewaehlt?.name ?? "")}</p>
          {!props.position && (
            <button type="button" className="text-knopf" onClick={props.standortHolen}>{t.gebiete.standortNutzen}</button>
          )}
        </div>
        <ul className="gruppe liste">
          {liste.slice(0, anzahl).map((g) => {
            const d = entfernung(g);
            const zusatz = [elternText(daten, g.id).split(", ")[0], d < 400 ? t.gebiete.hier : Number.isFinite(d) ? t.gebiete.entfernung(alsStrecke(d)) : ""].filter(Boolean).join(" · ");
            return zeile(g, zusatz);
          })}
        </ul>
        {anzahl < liste.length && <button type="button" className="mehr-knopf" onClick={() => setAnzahl(anzahl + SCHRITT)}>{t.gebiete.mehr}</button>}
      </>
    );
  } else if (sortierung === "entdeckt") {
    const liste = blaetter.map((g) => ({ g, p: anteil(g) })).filter((x) => x.p > 0).sort((a, b) => b.p - a.p);
    inhalt = liste.length ? (
      <>
        <ul className="gruppe liste">{liste.slice(0, anzahl).map(({ g }) => zeile(g, elternText(daten, g.id)))}</ul>
        {anzahl < liste.length && <button type="button" className="mehr-knopf" onClick={() => setAnzahl(anzahl + SCHRITT)}>{t.gebiete.mehr}</button>}
      </>
    ) : (
      <p className="leer gross">{t.gebiete.nochNichts}</p>
    );
  } else {
    inhalt = daten.liste.map((region) => {
      const wurzel = daten.gebiete.get(region.wurzel)!;
      const kinder = sortiert(wurzel.kinder);
      const mitEnkeln = kinder.some((k) => k.kinder.length > 0);
      const zaehlen = (g: GebietDaten): number => (g.kinder.length === 0 ? 1 : g.kinder.reduce((n, k) => n + zaehlen(daten.gebiete.get(k)!), 0));
      const pStadt = anteil(wurzel);
      return (
        <div key={region.id} className="region">
          <div className="stadt-kopf">
            <h2 className="stadt-name">{region.name}</h2>
            <p className="leise">
              <b className={pStadt > 0 ? "gebiet-prozent an" : "gebiet-prozent"}>{t.gebiete.prozentKurz(prozentText(pStadt))}</b> · {t.gebiete.stadtZeile(alsKm(gesamtM(wurzel)), zaehlen(wurzel))}
            </p>
          </div>
          {mitEnkeln ? (
            kinder.map((kind) => (
              <div key={kind.id}>
                <h2>{kind.name}</h2>
                <ul className="gruppe liste">{kind.kinder.length ? sortiert(kind.kinder).map((g) => zeile(g)) : zeile(kind)}</ul>
              </div>
            ))
          ) : (
            <ul className="gruppe liste">{kinder.map((g) => zeile(g))}</ul>
          )}
        </div>
      );
    });
  }

  return (
    <section className="seite" aria-labelledby="gebiete-titel">
      <h1 id="gebiete-titel">{t.gebiete.titel}</h1>
      <div className="segmente" role="group" aria-label={t.gebiete.sortierung}>
        {(["naehe", "entdeckt", "az"] as const).map((s) => (
          <button key={s} type="button" aria-pressed={sortierung === s} onClick={() => sortieren(s)}>
            {t.gebiete.sortiert[s]}
          </button>
        ))}
      </div>
      {inhalt}
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
