import { milestoneReached, type LonLat } from "@streifzug/core";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNeueStrassen } from "./daten/unterwegs";
import { useAufzeichnung, useStreifzuege, type Aufzeichnung } from "./daten/aufzeichnung";
import { ergebnisSchluessel, gebietAn, useFortschritt, type Fortschritt, type Spur } from "./daten/fortschritt";
import type { Streifzug } from "./daten/speicher";
import { useSitzung, type Sitzung } from "./daten/supabase";
import { alsKm, alsStrecke, elternText, findeNachName, prozent, prozentText, useMittelpunkte, useRegionen, zaehlendeMeter, type GebietDaten, type Regionen } from "./daten/regionen";
import { useEinstellungen, type Einstellungen } from "./einstellungen";
import { useWeisserFleck, type Fleck } from "./daten/fleck";
import { Importieren } from "./seiten/Importieren";
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
  // Shortcut from the logbook: open the profile at "Importieren".
  const [importZeigen, setImportZeigen] = useState(false);
  const [gewaehlt, setGewaehlt] = useState<string | null>(() => localStorage.getItem(MERKEN));
  const [einstellungen, aendern] = useEinstellungen(sitzung);
  const daten = useRegionen();
  const gebiet = daten ? (daten.gebiete.get(gewaehlt ?? "") ?? findeNachName(daten, START_NAME) ?? null) : null;
  // Choosing from a list or the map brings the area into view; locating keeps the map on your position.
  const springen = useRef(true);
  const waehlen = (id: string, sprung = true) => {
    springen.current = sprung;
    setGewaehlt(id);
    localStorage.setItem(MERKEN, id);
  };
  const aufzeichnung = useAufzeichnung();
  const streifzuege = useStreifzuege();
  // Car rides count only with the switch on (docs/PLAN.md, section 2).
  // Imported histories count only with their switch on (the data stays either way).
  const zaehlende = streifzuege.filter(
    (s) =>
      (s.mode !== "car" || einstellungen.autoZaehlen) &&
      (s.quelle === "google" ? einstellungen.googleZaehlen : s.quelle === "gpx" ? einstellungen.gpxZaehlen : true),
  );
  const spuren: Spur[] = [
    ...zaehlende.map((s) => ({
      id: s.id,
      fixes: s.fixes,
      locker: s.quelle !== undefined && s.quelle !== "aufnahme",
      // Matched in an earlier session: no need to match again.
      ...(s.stueckIds && s.stueckIdsGueltig === ergebnisSchluessel(s.fixes) ? { ids: s.stueckIds } : {}),
    })),
    ...(aufzeichnung.aktiv ? [{ id: `live:${aufzeichnung.startedAt}`, fixes: aufzeichnung.fixes }] : []),
  ];
  const { fortschritt, rechnet } = useFortschritt(spuren, daten);
  // Progress before the current outing, to show what it added afterwards.
  const vorher = useRef<Fortschritt | null>(null);
  const warAktiv = useRef(false);
  if (aufzeichnung.aktiv && !warAktiv.current) vorher.current = fortschritt ?? { stuecke: [], proGebiet: new Map() };
  warAktiv.current = aufzeichnung.aktiv;
  // While out and about: what this outing has discovered so far (for the counter at the top).
  const vorherIds = useMemo(() => new Set((vorher.current?.stuecke ?? []).map((p) => p.id)), [vorher.current]);
  // Only what counts turns yellow: streets, and paths only with the paths switch (never driveways, see rules.ts).
  const zaehlendeStuecke = useMemo(
    () => (fortschritt?.stuecke ?? []).filter((p) => p.kind === "street" || einstellungen.wegeZaehlen),
    [fortschritt, einstellungen.wegeZaehlen],
  );
  const neuUnterwegs = aufzeichnung.aktiv ? zaehlendeStuecke.filter((p) => !vorherIds.has(p.id)) : [];
  const neuUnterwegsM = neuUnterwegs.reduce((m, p) => m + p.lengthM * p.weight, 0);
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
  // Locating: move there and show the area you are standing in (with your share) in the sheet.
  const datenRef = useRef(daten);
  datenRef.current = daten;
  const zumStandort = () => {
    setStandortFehler(false);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const hier: [number, number] = [p.coords.longitude, p.coords.latitude];
        setPosition(hier);
        setZentrieren((n) => n + 1);
        if (datenRef.current)
          void gebietAn(hier, datenRef.current).then((id) => {
            if (id) waehlen(id, false);
          });
      },
      () => setStandortFehler(true),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 30_000 },
    );
  };

  // When location is already allowed, start where you are (no question pops up).
  const gestartet = useRef(false);
  useEffect(() => {
    if (!daten || gestartet.current) return;
    gestartet.current = true;
    void navigator.permissions
      ?.query({ name: "geolocation" })
      .then((s) => {
        if (s.state === "granted") zumStandort();
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [daten]);

  if (profilOffen)
    return <Profil sitzung={sitzung} werte={einstellungen} aendern={aendern} daten={daten} streifzuege={streifzuege} zumImport={importZeigen} schliessen={() => { setProfilOffen(false); setImportZeigen(false); }} />;

  return (
    <div className="app">
      <main className="inhalt">
        <div className="ansicht" hidden={reiter !== "karte"}>
          <Karte
            daten={daten}
            gewaehlt={gebiet?.id ?? null}
            gewaehltName={gebiet?.name ?? ""}
            onWaehlen={(id, sprung) => waehlen(id, sprung)}
            springen={springen.current}
            spur={aufzeichnung.fixes}
            entdeckt={zaehlendeStuecke}
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
            rechnet={rechnet}
          />
        </div>
        {reiter === "gebiete" && (
          <GebieteSeite
            daten={daten}
            fortschritt={fortschritt}
            einstellungen={einstellungen}
            gewaehlt={gebiet}
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
            bereit={fortschritt !== null && rechnet === null}
            importieren={() => {
              setImportZeigen(true);
              setProfilOffen(true);
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
  rechnet: { fertig: number; gesamt: number } | null;
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
      <p className="hinweis" aria-live="polite">{props.standortFehler
          ? t.karte.standortFehler
          : a.aktiv
            ? t.karte.hinweisOffen
            : props.rechnet
              ? t.karte.rechnet(Math.round((100 * props.rechnet.fertig) / props.rechnet.gesamt))
              : ""}</p>
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
  daten: Regionen | null;
  streifzuege: Streifzug[];
  zumImport: boolean;
  schliessen: () => void;
}) {
  const importRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (props.zumImport) importRef.current?.scrollIntoView({ block: "start" });
  }, [props.zumImport]);
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
        <h2 ref={importRef} id="importieren">{t.import.titel}</h2>
        <Importieren daten={props.daten} streifzuege={props.streifzuege} werte={werte} aendern={aendern} />
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

/**
 * Areas you have unlocked: only cities with something discovered, each as a fold-out list
 * (city → district → Stadtteil), most discovered first. Nothing about areas you have not been to.
 */
function GebieteSeite(props: {
  daten: Regionen | null;
  fortschritt: Fortschritt | null;
  einstellungen: Einstellungen;
  gewaehlt: GebietDaten | null;
  waehlen: (id: string) => void;
}) {
  const { daten, einstellungen } = props;
  if (!daten) return <LeereSeite titel={t.gebiete.titel} text={t.karte.kmLaedt} />;

  const wege = einstellungen.wegeZaehlen;
  const gesamtM = (g: GebietDaten) => zaehlendeMeter(g, wege);
  const gesehenM = (g: GebietDaten) => zaehlendeMeter(props.fortschritt?.proGebiet.get(g.id) ?? { strasse_m: 0, weg_m: 0 }, wege);
  const anteil = (g: GebietDaten) => prozent(gesehenM(g), gesamtM(g));
  const entdeckt = (g: GebietDaten) => gesehenM(g) >= 1;
  const kinder = (g: GebietDaten) => g.kinder.map((id) => daten.gebiete.get(id)!).filter(entdeckt).sort((a, b) => anteil(b) - anteil(a));
  const viertel = (g: GebietDaten): number => (g.kinder.length === 0 ? (entdeckt(g) ? 1 : 0) : g.kinder.reduce((n, k) => n + viertel(daten.gebiete.get(k)!), 0));
  // The area chosen on the map and all its parents start opened.
  const offen = new Set<string>();
  for (let g = props.gewaehlt; g; g = g.eltern ? (daten.gebiete.get(g.eltern) ?? null) : null) offen.add(g.id);

  const staedte = daten.liste.map((r) => daten.gebiete.get(r.wurzel)!).filter(entdeckt).sort((a, b) => gesehenM(b) - gesehenM(a));
  if (staedte.length === 0) return <LeereSeite titel={t.gebiete.titel} text={t.gebiete.nochNichts} />;

  const wert = (g: GebietDaten) => {
    const p = anteil(g);
    return (
      <>
        <span className="gebiet-zeile-text">
          <span className="gebiet-zeile-name">{g.name}</span>
          {g.kinder.length > 0 && <span className="gebiet-zeile-zusatz">{t.gebiete.viertelEntdeckt(viertel(g))}</span>}
          {/* Something discovered always shows a visible bit of yellow. */}
          <span className="mini-balken" aria-hidden="true"><i style={{ width: `${p > 0 ? Math.max(p, 3) : 0}%` }} /></span>
        </span>
        <span className="gebiet-zeile-wert">
          <b className="gebiet-prozent an">{t.gebiete.prozentKurz(prozentText(p))}</b>
          <span>{t.gebiete.kmVon(alsKm(gesehenM(g)), alsKm(gesamtM(g)))}</span>
        </span>
      </>
    );
  };
  const zeile = (g: GebietDaten) => (
    <li key={g.id}>
      <button type="button" className="gebiet-zeile" aria-current={props.gewaehlt?.id === g.id ? "true" : undefined} onClick={() => props.waehlen(g.id)}>
        {wert(g)}
      </button>
    </li>
  );
  const ordner = (g: GebietDaten, stadt: boolean) => (
    <details key={g.id} className={stadt ? "ordner stadt" : "ordner"} open={offen.has(g.id) || (stadt && staedte.length === 1)}>
      <summary className="gebiet-zeile">
        {wert(g)}
        <span className="pfeil" aria-hidden="true" />
      </summary>
      <ul className="liste">{kinder(g).map((k) => (k.kinder.length ? <li key={k.id}>{ordner(k, false)}</li> : zeile(k)))}</ul>
    </details>
  );

  return (
    <section className="seite" aria-labelledby="gebiete-titel">
      <h1 id="gebiete-titel">{t.gebiete.titel}</h1>
      <p className="leise seiten-unterzeile">{t.gebiete.unterzeile}</p>
      <div className="ordner-liste">{staedte.map((g) => ordner(g, true))}</div>
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
