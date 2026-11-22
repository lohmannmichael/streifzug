import type { LonLat } from "@streifzug/core";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNeueStrassen } from "./daten/unterwegs";
import { useAufzeichnung, useStreifzuege } from "./daten/aufzeichnung";
import { ergebnisSchluessel, gebietAn, meterJeGebiet, useFortschritt, type Fortschritt, type Spur, type Zaehlen } from "./daten/fortschritt";
import { useOverlandAbholen, useOverlandStatus, type KurzWeg } from "./daten/import";
import { alsGesehenMerken, kuerzen, useRueckblick } from "./daten/rueckblick";
import { useSitzung, type Sitzung } from "./daten/supabase";
import { findeNachName, gesamtMeter, prozent, useRegionen, zaehlendeMeter, type Regionen } from "./daten/regionen";
import type { OffeneStrasse } from "./daten/veedel";
import { useAusnahmen } from "./daten/ausnahmen";
import { useFremdeOrte } from "./daten/orte";
import { markerJetzt, useEinstellungen, type Einstellungen } from "./einstellungen";
import { GpxImport, OverlandEinrichten } from "./seiten/Importieren";
import { Blatt, SammlungSeite, type BlattProps, type Hoehe, type SammlungTeil } from "./seiten/Blatt";
import { Export } from "./seiten/Export";
import { Konto } from "./seiten/Konto";
import { Stifte } from "./seiten/Stifte";
import { Zuhause } from "./seiten/Zuhause";
import { Karte } from "./karte/Karte";
import { t } from "./texte/de";
import { IconMehr, IconSchliessen, IconStandort } from "./ui/Icons";

// Until the location is used, the map starts at home; the last chosen area is remembered.
const START_NAME = "Weiden";
const MERKEN = "streifzug.gebiet";

export function App() {
  const sitzung = useSitzung();
  const [hoehe, setHoehe] = useState<Hoehe>(1);
  const [teil, setTeil] = useState<SammlungTeil>("veedel");
  const [menueOffen, setMenueOffen] = useState(false);
  const overland = useOverlandStatus();
  const [sammlungOffen, setSammlungOffen] = useState(false);
  const [safariHinweis, setSafariHinweis] = useState(() => new URLSearchParams(location.search).get("konto") === "bestaetigt");
  const [einzeln, setEinzeln] = useState<{ wege: LonLat[][]; seit: number; nr: number } | null>(null);
  const [offen, setOffen] = useState<OffeneStrasse | null>(null);
  const [profilOffen, setProfilOffen] = useState(false);
  // Shortcut from the sheet: open the settings at Overland.
  const [importZeigen, setImportZeigen] = useState<"overland" | "gpx" | null>(null);
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
  const warAktivFuerRueckblick = useRef(false);
  const aufnahmeAktiv = useRef(false);
  // An outing watched live counts as seen (no replay of it on the next opening).
  useEffect(() => {
    if (!aufzeichnung.aktiv && warAktivFuerRueckblick.current) alsGesehenMerken();
    // Unterwegs-Modus: small sheet while recording, the Veedel (with what was added) afterwards.
    if (aufzeichnung.aktiv) setHoehe(1);
    else if (warAktivFuerRueckblick.current) setHoehe(2);
    warAktivFuerRueckblick.current = aufzeichnung.aktiv;
    aufnahmeAktiv.current = aufzeichnung.aktiv;
  }, [aufzeichnung.aktiv]);
  const streifzuege = useStreifzuege();
  // Own finished outings, shortened, for "Zuletzt".
  const eigeneWege: KurzWeg[] = useMemo(
    () =>
      streifzuege
        .filter((s) => s.status !== "aktiv" && s.fixes.length > 1)
        .sort((a, b) => (b.endedAt ?? b.startedAt) - (a.endedAt ?? a.startedAt))
        .slice(0, 5)
        .map((s) => ({ id: s.id, startedAt: s.startedAt, endedAt: s.endedAt ?? s.startedAt, distanceM: s.distanceM, coords: kuerzen(s.fixes) })),
    [streifzuege],
  );
  // Car rides count only with the switch on (docs/PLAN.md, section 2). The page holds only own
  // outings; imports and Overland are loaded by the background worker, each with its switch.
  // All own outings take part; per leg it is decided what is "aktiv" (counts) or "gefahren" (pen line).
  const zaehlende = streifzuege;
  const ausnahmen = useAusnahmen();
  const benutzer = sitzung.status === "bereit" ? sitzung.session.user.id : null;
  const zaehlen: Zaehlen = useMemo(
    // Everything counts (Bauplan: no counting switches); per leg it is decided what is aktiv.
    () => ({ quellen: { gpx: true, overland: true }, ausnahmen }),
    [ausnahmen],
  );
  // The pen colours live in CSS too (marker swipe behind the percentage).
  const marker = markerJetzt(einstellungen);
  useEffect(() => document.documentElement.style.setProperty("--marker", marker), [marker]);
  // Replay on opening: after fetching Overland points, run along what came in since the last visit.
  const { rueckblick, pruefen: rueckblickPruefen, beenden: rueckblickBeenden } = useRueckblick();
  useOverlandAbholen(daten, () => {
    if (!aufnahmeAktiv.current) void rueckblickPruefen();
  });
  const spuren: Spur[] = [
    ...zaehlende.map((s) => ({
      id: s.id,
      t: s.startedAt,
      fixes: s.fixes,
      // Matched in an earlier session: no need to match again.
      ...(s.stueckIds && s.stueckIdsGueltig === ergebnisSchluessel(s.fixes) ? { ids: s.stueckIds, gefahren: s.stueckIdsGefahren ?? [] } : {}),
    })),
    ...(aufzeichnung.aktiv ? [{ id: `live:${aufzeichnung.startedAt}`, t: aufzeichnung.startedAt ?? Date.now(), fixes: aufzeichnung.fixes }] : []),
  ];
  const { fortschritt, rechnet, fehler: rechenFehler } = useFortschritt(spuren, zaehlen, daten);
  // Progress before the current outing, to show what it added afterwards.
  const vorher = useRef<Fortschritt | null>(null);
  const warAktiv = useRef(false);
  if (aufzeichnung.aktiv && !warAktiv.current) vorher.current = fortschritt ?? { stuecke: [], erstesMal: [], gefahren: [], proGebiet: new Map(), abzug: new Map(), draussen: [] };
  warAktiv.current = aufzeichnung.aktiv;
  // While out and about: what this outing has discovered so far (for the counter at the top).
  const vorherIds = useMemo(() => new Set((vorher.current?.stuecke ?? []).map((p) => p.id)), [vorher.current]);
  // Yellow: streets (they count) and paths (shown thinner, never counted).
  const zaehlendeStuecke = useMemo(
    () => (fortschritt?.stuecke ?? []).filter((p) => p.kind === "street" || p.kind === "path"),
    [fortschritt],
  );
  const fremdeOrte = useFremdeOrte(fortschritt?.draussen, benutzer);
  const erstesMal = useMemo(() => new Map((fortschritt?.stuecke ?? []).map((p, i) => [p.id, fortschritt!.erstesMal[i] ?? Date.now()])), [fortschritt]);

  // Replay on opening (Bauplan 5.1): starts once the progress includes the new ways (at most 2.5 s wait).
  const [rbBereit, setRbBereit] = useState<number | null>(null);
  useEffect(() => {
    if (!rueckblick) return setRbBereit(null);
    if (rbBereit === rueckblick.nr) return;
    // Never before the progress is there and fully calculated (after an update everything is
    // matched again, which takes a while on the phone).
    if (!fortschritt || rechnet) return;
    if (fortschritt.erstesMal.some((t) => t >= rueckblick.seit)) return setRbBereit(rueckblick.nr);
    const warten = window.setTimeout(() => setRbBereit(rueckblick.nr), 2500);
    return () => window.clearTimeout(warten);
  }, [rueckblick, fortschritt, rechnet, rbBereit]);
  // The share before the new ways: the number stays there during the replay and counts up afterwards (Nr. 6).
  const [zahlVorher, setZahlVorher] = useState<number | null>(null);
  const [hochzaehlen, setHochzaehlen] = useState<{ von: number; nr: number } | null>(null);
  useEffect(() => {
    if (!rueckblick || rbBereit !== rueckblick.nr || !daten || !gebiet || !fortschritt) return setZahlVorher(null);
    let lebt = true;
    const alt = fortschritt.stuecke.filter((p, i) => (p.kind === "street" || p.kind === "path") && (fortschritt.erstesMal[i] ?? 0) < rueckblick.seit);
    void meterJeGebiet(alt, daten).then((m) => {
      if (lebt) setZahlVorher(prozent(zaehlendeMeter(m.get(gebiet.id) ?? { strasse_m: 0, weg_m: 0 }, false), gesamtMeter(gebiet, fortschritt.abzug)));
    });
    return () => {
      lebt = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rbBereit, gebiet?.id]);
  const stifte = useMemo(
    () => ({ marker: einstellungen.marker, kuli: einstellungen.kuli, jahresFarben: einstellungen.jahresFarben }),
    [einstellungen.marker, einstellungen.kuli, einstellungen.jahresFarben],
  );
  const neuUnterwegs = aufzeichnung.aktiv ? zaehlendeStuecke.filter((p) => !vorherIds.has(p.id)) : [];
  const neuUnterwegsM = neuUnterwegs.reduce((m, p) => m + (p.kind === "street" ? p.lengthM * p.weight : 0), 0);
  const neueStrassen = useNeueStrassen(neuUnterwegs.filter((p) => p.kind === "street"));
  const [position, setPosition] = useState<[number, number] | null>(null);
  const [zentrieren, setZentrieren] = useState(0);
  const [standortFehler, setStandortFehler] = useState(false);
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

  const blattProps: BlattProps = {
    hoehe: hoehe,
    setHoehe: setHoehe,
    gebiet: gebiet,
    daten: daten,
    fortschritt: fortschritt,
    vorher: vorher.current,
    rechnet: rechnet,
    aufzeichnung: aufzeichnung,
    standortFehler: standortFehler,
    neuUnterwegsM: neuUnterwegsM,
    neueStrassen: neueStrassen,
    rueckblick: rueckblick && !aufzeichnung.aktiv ? rueckblick : null,
    rueckblickBeenden: rueckblickBeenden,
    overland,
    einstellungen: (ziel?: "overland") => {
            setImportZeigen(ziel ?? null);
            setProfilOffen(true);
          },
    eigeneWege: eigeneWege,
    abspielen: (w: KurzWeg) => {
            setHoehe(1);
            setEinzeln((alt) => ({ wege: [w.coords], seit: w.startedAt, nr: (alt?.nr ?? 1000) + 1 }));
          },
    position: position,
    offen: offen?.name ?? null,
    offenZeigen: setOffen,
    waehlen: (id: string) => waehlen(id),
    fremdeOrte: fremdeOrte,
    zahlVorher: rueckblick && !aufzeichnung.aktiv ? zahlVorher : null,
    hochzaehlen: hochzaehlen,
    rechenFehler: rechenFehler,
    teil: teil,
    setTeil: setTeil,
  };

  // Opened from the confirmation link (in Safari): say where to go on.
  if (safariHinweis)
    return (
      <div className="app">
        <section className="seite seite-voll" aria-labelledby="bestaetigt-titel">
          <h1 id="bestaetigt-titel">{t.konto.safariTitel}</h1>
          <p className="leer gross">{t.konto.safariText}</p>
          <button
            type="button"
            className="datei-knopf"
            onClick={() => {
              history.replaceState(null, "", "/");
              setSafariHinweis(false);
            }}
          >
            {t.konto.safariWeiter}
          </button>
        </section>
      </div>
    );

  if (sammlungOffen) return <SammlungSeite {...blattProps} schliessen={() => setSammlungOffen(false)} />;

  if (profilOffen)
    return (
      <Profil
        sitzung={sitzung}
        werte={einstellungen}
        aendern={aendern}
        daten={daten}
        zumImport={importZeigen}
        schliessen={() => {
          setProfilOffen(false);
          setImportZeigen(null);
        }}
        zustand={[
          [t.zustand.version, new Date(__BAUSTAND__).toLocaleString("de-DE")],
          [t.zustand.eigene, String(streifzuege.length)],
          [t.zustand.stuecke, fortschritt ? t.zustand.stueckeWert(fortschritt.stuecke.filter((p) => p.kind === "street").length, fortschritt.gefahren.length) : t.zustand.nochNicht],
          [t.zustand.rechnet, rechenFehler ?? (rechnet ? `${rechnet.fertig} / ${rechnet.gesamt}` : t.zustand.fertig)],
        ]}
      />
    );

  // Replay: one way tapped under "Zuletzt", or what came in since the last visit.
  const abspielen =
    einzeln ?? (rueckblick && rbBereit === rueckblick.nr && !aufzeichnung.aktiv ? { wege: rueckblick.wege.map((w) => w.coords), seit: rueckblick.seit, nr: rueckblick.nr } : null);
  return (
    <div className="app">
      <main className="inhalt">
        <Karte
          daten={daten}
          gewaehlt={gebiet?.id ?? null}
          gewaehltName={gebiet?.name ?? ""}
          onWaehlen={(id, sprung) => {
            // A tap on the Veedel already shown puts the sheet down (Bauplan 3, B3).
            if (id === gebiet?.id && sprung === undefined) setHoehe(1);
            waehlen(id, sprung);
            setOffen(null);
          }}
          springen={springen.current}
          spur={aufzeichnung.fixes}
          entdeckt={zaehlendeStuecke}
          gefahren={fortschritt?.gefahren ?? []}
          prozente={prozenteJeGebiet(daten, fortschritt)}
          folgen={aufzeichnung.aktiv}
          zeichnen={aufzeichnung.aktiv}
          wegeZaehlen={false}
          position={position}
          zentrieren={zentrieren}
          rueckblick={abspielen}
          onRueckblickEnde={() => {
            setEinzeln(null);
            if (einzeln) return;
            if (zahlVorher !== null) setHochzaehlen((alt) => ({ von: zahlVorher, nr: (alt?.nr ?? 0) + 1 }));
            rueckblickBeenden();
          }}
          offen={offen?.linien ?? null}
          erstesMal={erstesMal}
          stifte={stifte}
        />
        <div className="karten-knoepfe">
          <button
            type="button"
            className="rund-knopf"
            aria-label={t.menue.titel}
            aria-expanded={menueOffen}
            aria-haspopup="menu"
            onClick={() => setMenueOffen(!menueOffen)}
          >
            {menueOffen ? <IconSchliessen /> : <IconMehr />}
          </button>
          <button type="button" className="rund-knopf" aria-label={t.karte.standort} onClick={zumStandort}>
            <IconStandort />
          </button>
        </div>
        {menueOffen && (
          <>
            <div className="menue-hintergrund" onClick={() => setMenueOffen(false)} />
            <nav className="menue" role="menu" aria-label={t.menue.titel}>
              {(
                [
                  [t.menue.staedte, () => { setTeil("veedel"); setSammlungOffen(true); }],
                  [t.menue.stempelpass, () => { setTeil("pass"); setSammlungOffen(true); }],
                  [t.menue.einstellungen, () => { setImportZeigen(null); setProfilOffen(true); }],
                ] as const
              ).map(([text, tun]) => (
                <button
                  key={text}
                  type="button"
                  role="menuitem"
                  className="menue-zeile"
                  onClick={() => {
                    setMenueOffen(false);
                    tun();
                  }}
                >
                  {text}
                </button>
              ))}
            </nav>
          </>
        )}
        <Blatt {...blattProps} />
      </main>
    </div>
  );
}

function prozenteJeGebiet(daten: Regionen | null, f: Fortschritt | null): Map<string, number> {
  const m = new Map<string, number>();
  if (!daten || !f) return m;
  for (const [id, gesehen] of f.proGebiet) {
    const g = daten.gebiete.get(id);
    if (g) m.set(id, prozent(zaehlendeMeter(gesehen, false), gesamtMeter(g, f.abzug)));
  }
  return m;
}

function Profil(props: {
  sitzung: Sitzung;
  werte: Einstellungen;
  aendern: (teil: Partial<Einstellungen>) => void;
  daten: Regionen | null;
  zumImport: "overland" | "gpx" | null;
  schliessen: () => void;
  /** A few numbers to find problems from a screenshot. */
  zustand: [string, string][];
}) {
  const userId = props.sitzung.status === "bereit" ? props.sitzung.session.user.id : null;
  const importRef = useRef<HTMLHeadingElement>(null);
  const overlandRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (props.zumImport === "gpx") importRef.current?.scrollIntoView({ block: "start" });
    if (props.zumImport === "overland") overlandRef.current?.scrollIntoView({ block: "start" });
  }, [props.zumImport]);
  const { werte, aendern } = props;
  return (
    <div className="app">
      <section className="seite seite-voll" aria-labelledby="profil-titel">
        <button type="button" className="zurueck" onClick={props.schliessen}>
          <IconSchliessen />
          <span>{t.ich.zurueck}</span>
        </button>
        <h1 id="profil-titel">{t.ich.titel}</h1>
        <h2>{t.ich.konto}</h2>
        {props.sitzung.status === "offline" ? (
          <div className="gruppe">
            <p className="zeile-text">{t.ich.kontoOffline}</p>
          </div>
        ) : (
          <Konto />
        )}
        <h2>{t.stifte.titel}</h2>
        <Stifte werte={werte} aendern={aendern} />
        <h2 ref={overlandRef} id="overland">{t.import.overland.ueberschrift}</h2>
        <OverlandEinrichten daten={props.daten} userId={userId} werte={werte} aendern={aendern} />
        <h2>{t.zuhause.titel}</h2>
        <Zuhause userId={userId} />
        <h2 ref={importRef} id="importieren">{t.import.titel}</h2>
        <GpxImport daten={props.daten} userId={userId} werte={werte} aendern={aendern} />
        <h2>{t.ich.daten}</h2>
        <Export />
        <h2>{t.zustand.titel}</h2>
        <div className="gruppe">
          {props.zustand.map(([k, v]) => (
            <p key={k} className="zeile-text zustand-zeile">
              <span>{k}</span>
              <span>{v}</span>
            </p>
          ))}
        </div>
        <p className="quelle">{t.ich.quelle}</p>
      </section>
    </div>
  );
}
