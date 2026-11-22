import { eineLinieJeStrasse, vormonat } from "@streifzug/core";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNeueStrassen } from "./daten/unterwegs";
import { useAufzeichnung, useStreifzuege } from "./daten/aufzeichnung";
import { ergebnisSchluessel, gebietAn, meterJeGebiet, useFortschritt, type Fortschritt, type Spur, type Zaehlen } from "./daten/fortschritt";
import { useOverlandAbholen, useOverlandStatus, wegeSeit } from "./daten/import";
import { useOnline } from "./daten/netz";
import { alsGesehenMerken, kurzMitArt, useRueckblick } from "./daten/rueckblick";
import { useSitzung } from "./daten/supabase";
import { findeNachName, gesamtMeter, orteLaden, ortLadenAuf, prozent, regionenJetzt, useRegionen, zaehlendeMeter, type Regionen } from "./daten/regionen";
import { useAusnahmen } from "./daten/ausnahmen";
import { useKorrekturen } from "./daten/korrekturen";
import { useFremdeOrte } from "./daten/orte";
import { markerJetzt, useEinstellungen } from "./einstellungen";
import { Blatt, type BlattProps, type Hoehe } from "./seiten/Blatt";
import { StempelSeite } from "./seiten/Stempel";
import { OrteSeite } from "./seiten/Orte";
import { PassSeite, type PassTeil } from "./seiten/Pass";
import { EinstellungenSeite } from "./seiten/Einstellungen";
import { neuInZeitraum, RueckblickeSeite, type Tag, type ZeitraumWahl } from "./seiten/Rueckblicke";
import { ZeitraumDatum, ZeitraumKarte } from "./seiten/ZeitraumKarte";
import type { ZeitraumWeg } from "./karte/zeitraum";
import { ZeitreiseLeiste } from "./seiten/Zeitreise";
import { Karte } from "./karte/Karte";
import type { RueckblickWeg } from "./karte/rueckblick";
import { t } from "./texte/de";
import { IconPass, IconStandort } from "./ui/Icons";

// Until the location is used, the map starts at home; the last chosen area is remembered.
const START_NAME = "Weiden";
const START_ORT = "koeln";
const MONAT_GESEHEN = "streifzug.monat-gesehen";
const monatLang = new Intl.DateTimeFormat("de-DE", { month: "long" });
// The place of the chosen area, so it can be loaded on opening (Bauplan 3, E4).
const MERKEN_ORT = "streifzug.gebietOrt";
const MERKEN = "streifzug.gebiet";

export function App() {
  const sitzung = useSitzung();
  const [hoehe, setHoehe] = useState<Hoehe>(1);
  // The Pass and its pages (Bauplan 3, D1); null = the plan.
  const [pass, setPass] = useState<PassTeil | null>(null);
  const overland = useOverlandStatus();
  const [safariHinweis, setSafariHinweis] = useState(() => new URLSearchParams(location.search).get("konto") === "bestaetigt");
  // One past day from "Rückblicke" (Bauplan 3, D4).
  // A period played back (Bauplan 3, F2), and the date of the way being drawn.
  const [zeitraum, setZeitraum] = useState<(ZeitraumWahl & { wege: ZeitraumWeg[]; nr: number; fertig: boolean }) | null>(null);
  const [zrDatum, setZrDatum] = useState<number | null>(null);
  // Zeitreise (Bauplan 3, F3): end of the chosen day, or null.
  const [zeitreise, setZeitreise] = useState<number | null>(null);
  const [einzeln, setEinzeln] = useState<{ wege: RueckblickWeg[]; seit: number; bis: number; nr: number } | null>(null);
  // Shortcut from the sheet: open the settings at Overland.
  const [importZeigen, setImportZeigen] = useState<"overland" | "gpx" | "ueber" | null>(null);
  const [gewaehlt, setGewaehlt] = useState<string | null>(() => localStorage.getItem(MERKEN));
  const [einstellungen, aendern] = useEinstellungen(sitzung);
  // On opening only Köln and the place of the chosen area are loaded; more places follow when needed.
  const [startOrte] = useState(() => [...new Set([START_ORT, localStorage.getItem(MERKEN_ORT) ?? START_ORT])]);
  const daten = useRegionen(startOrte);
  // While the place of the chosen area is still loading, nothing is shown instead of jumping to Weiden.
  const gewaehltOrt = localStorage.getItem(MERKEN_ORT);
  const wartetAufOrt = !!gewaehlt && !!gewaehltOrt && !!daten && !daten.gebiete.has(gewaehlt) && !daten.geladen.has(gewaehltOrt) && daten.liste.some((r) => r.id === gewaehltOrt);
  const gebiet = daten && !wartetAufOrt ? (daten.gebiete.get(gewaehlt ?? "") ?? findeNachName(daten, START_NAME) ?? null) : null;
  // Choosing from a list or the map brings the area into view; locating keeps the map on your position.
  const springen = useRef(true);
  const waehlen = (id: string, sprung = true) => {
    springen.current = sprung;
    setGewaehlt(id);
    localStorage.setItem(MERKEN, id);
    const ort = regionenJetzt()?.gebiete.get(id)?.regionId;
    if (ort) localStorage.setItem(MERKEN_ORT, ort);
  };
  // Remember the place of an area chosen before this version too.
  useEffect(() => {
    if (gebiet) localStorage.setItem(MERKEN_ORT, gebiet.regionId);
  }, [gebiet?.regionId]);
  const aufzeichnung = useAufzeichnung();
  const warAktivFuerRueckblick = useRef(false);
  const aufnahmeAktiv = useRef(false);
  // An outing watched live counts as seen (no replay of it on the next opening).
  useEffect(() => {
    if (!aufzeichnung.aktiv && warAktivFuerRueckblick.current) alsGesehenMerken();
    // Unterwegs-Modus: small sheet while recording, the quarter (with what was added) afterwards.
    if (aufzeichnung.aktiv) setHoehe(1);
    else if (warAktivFuerRueckblick.current) setHoehe(2);
    warAktivFuerRueckblick.current = aufzeichnung.aktiv;
    aufnahmeAktiv.current = aufzeichnung.aktiv;
  }, [aufzeichnung.aktiv]);
  const streifzuege = useStreifzuege();
  // Car rides count only with the switch on (docs/PLAN.md, section 2). The page holds only own
  // outings; imports and Overland are loaded by the background worker, each with its switch.
  // All own outings take part; per leg it is decided what is "aktiv" (counts) or "gefahren" (pen line).
  const zaehlende = streifzuege;
  const ausnahmen = useAusnahmen();
  const korrekturen = useKorrekturen();
  const benutzer = sitzung.status === "bereit" ? sitzung.session.user.id : null;
  const zaehlen: Zaehlen = useMemo(
    // Everything counts (Bauplan: no counting switches); per leg it is decided what is aktiv.
    () => ({ quellen: { gpx: true, overland: true }, ausnahmen, korrekturen }),
    [ausnahmen, korrekturen],
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
      ...(s.stueckIds && s.stueckIdsGueltig === ergebnisSchluessel(s.fixes, korrekturen[s.id]) ? { ids: s.stueckIds, gefahren: s.stueckIdsGefahren ?? [] } : {}),
    })),
    ...(aufzeichnung.aktiv ? [{ id: `live:${aufzeichnung.startedAt}`, t: aufzeichnung.startedAt ?? Date.now(), fixes: aufzeichnung.fixes }] : []),
  ];
  const { fortschritt, vorlaeufig, rechnet, fehler: rechenFehler, nochmal: nochmalRechnen } = useFortschritt(spuren, zaehlen, daten);
  // Places where ways lie are loaded too (names, shares, stamps).
  useEffect(() => {
    if (!daten || !fortschritt) return;
    orteLaden(daten.liste.filter((r) => zaehlendeMeter(fortschritt.proGebiet.get(r.wurzel) ?? { strasse_m: 0, weg_m: 0 }, false) >= 1).map((r) => r.id));
  }, [daten?.liste, fortschritt]);
  const zeitraumStarten = (z: ZeitraumWahl) => {
    void wegeSeit(z.von - 86400_000).then((andere) => {
      const wege: ZeitraumWeg[] = [
        ...andere.filter((w) => w.startedAt >= z.von && w.startedAt < z.bis).map((w) => ({ coords: w.coords, startedAt: w.startedAt })),
        ...streifzuege.filter((s) => s.status !== "aktiv" && s.startedAt >= z.von && s.startedAt < z.bis && s.fixes.length > 1).map((s) => ({ coords: kurzMitArt(s.fixes).coords, startedAt: s.startedAt })),
      ];
      setPass(null);
      setZrDatum(null);
      setZeitraum((alt) => ({ ...z, wege, nr: (alt?.nr ?? 0) + 1, fertig: false }));
    });
  };
  // First days of a new month: "Dein November ist fertig" in the sheet, played only on a tap.
  const vm = vormonat(Date.now());
  const vormonatM = useMemo(() => neuInZeitraum(fortschritt, vormonat(Date.now())), [fortschritt]);
  const monatFertig =
    new Date().getDate() <= 7 && localStorage.getItem(MONAT_GESEHEN) !== String(vm.von) && vormonatM >= 1
      ? {
          titel: monatLang.format(vm.von),
          abspielen: () => {
            localStorage.setItem(MONAT_GESEHEN, String(vm.von));
            zeitraumStarten({ ...vm, titel: t.zeitraum.dein(monatLang.format(vm.von)) });
          },
        }
      : null;
  const online = useOnline();
  // Back online after a failed calculation: try again by itself.
  useEffect(() => {
    if (online && rechenFehler) nochmalRechnen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online]);
  // When the app was opened or came back (Bauplan 3, C3: replay only on its own within 8 s).
  const geoeffnetAm = useRef(Date.now());
  useEffect(() => {
    const zurueck = () => document.visibilityState === "visible" && (geoeffnetAm.current = Date.now());
    document.addEventListener("visibilitychange", zurueck);
    return () => document.removeEventListener("visibilitychange", zurueck);
  }, []);
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
  // On the map one line per street (Michi, 22.11.): no sidewalk, second carriageway or red pen
  // line beside the yellow. Counting is not affected.
  const linien = useMemo(() => eineLinieJeStrasse(zaehlendeStuecke, fortschritt?.gefahren ?? []), [zaehlendeStuecke, fortschritt]);
  const fremdeOrte = useFremdeOrte(fortschritt?.draussen, benutzer);
  // Places with ways, as points for the overview far out (Bauplan 3, F5): the middle of their box.
  const ortePunkte = useMemo(
    () =>
      (daten?.liste ?? [])
        .filter((r) => zaehlendeMeter(fortschritt?.proGebiet.get(r.wurzel) ?? { strasse_m: 0, weg_m: 0 }, false) >= 1)
        .map((r) => ({ id: r.id, name: r.name, punkt: [(r.bbox[0] + r.bbox[2]) / 2, (r.bbox[1] + r.bbox[3]) / 2] as [number, number] })),
    [daten?.liste, fortschritt],
  );
  const ortOeffnen = (id: string) => {
    const r = daten?.liste.find((x) => x.id === id);
    if (r) void ortLadenAuf(r.id).then(() => waehlen(r.wurzel), () => undefined);
  };
  // Complete streets with the lines of their pieces, for their names on the plan (Bauplan 3, F4).
  const komplettLinien = useMemo(() => {
    const k = fortschritt?.komplett ?? [];
    if (k.length === 0) return [];
    const nachId = new Map((fortschritt?.stuecke ?? []).map((p) => [p.id, p]));
    return k.map((s) => ({ name: s.name, coords: s.ids.flatMap((id) => { const p = nachId.get(id); return p ? [p.coords] : []; }) }));
  }, [fortschritt]);
  // During the Zeitreise only what was yellow by the chosen day; the red pen line is left out.
  const gelbZeitreise = useMemo(
    () => (zeitreise === null ? linien.gelb : linien.gelb.filter((p) => (erstesMalRoh(fortschritt, p.id) ?? 0) < zeitreise)),
    [zeitreise, linien.gelb, fortschritt],
  );
  const erstesMal = useMemo(() => new Map((fortschritt?.stuecke ?? []).map((p, i) => [p.id, fortschritt!.erstesMal[i] ?? Date.now()])), [fortschritt]);

  // Replay on opening (Bauplan 5.1): starts once the progress includes the new ways (at most 2.5 s wait).
  const [rbBereit, setRbBereit] = useState<number | null>(null);
  // Took longer than 8 s: the replay is offered as a button instead of starting by itself.
  const [rbAngebot, setRbAngebot] = useState<number | null>(null);
  useEffect(() => {
    if (!rueckblick) {
      setRbAngebot(null);
      return setRbBereit(null);
    }
    if (rbBereit === rueckblick.nr || rbAngebot === rueckblick.nr) return;
    // Never before the progress is there and fully calculated (after an update everything is
    // matched again, which takes a while on the phone).
    // The stored last state does not have the new ways yet: wait for the real result.
    if (!fortschritt || vorlaeufig || rechnet || rechenFehler) return;
    const los = () => (Date.now() - geoeffnetAm.current > 8000 ? setRbAngebot(rueckblick.nr) : setRbBereit(rueckblick.nr));
    if (fortschritt.erstesMal.some((t) => t >= rueckblick.seit)) return los();
    const warten = window.setTimeout(los, 2500);
    return () => window.clearTimeout(warten);
  }, [rueckblick, fortschritt, vorlaeufig, rechnet, rechenFehler, rbBereit, rbAngebot]);
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
    rueckblickAngebot: !!rueckblick && rbAngebot === rueckblick.nr && rbBereit !== rueckblick.nr,
    rueckblickStarten: () => rueckblick && setRbBereit(rueckblick.nr),
    online: online,
    nochmalRechnen: nochmalRechnen,
    overland,
    einstellungen: (ziel?: "overland") => {
            setImportZeigen(ziel ?? null);
            setPass("einstellungen");
          },
    position: position,
    waehlen: (id: string) => waehlen(id),
    fremdeOrte: fremdeOrte,
    zahlVorher: rueckblick && !aufzeichnung.aktiv ? zahlVorher : null,
    hochzaehlen: hochzaehlen,
    rechenFehler: rechenFehler,
    monatFertig,
    quelle: () => {
      setImportZeigen("ueber");
      setPass("einstellungen");
    },
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

  const zumPass = () => setPass("start");
  const seite =
    pass === "start" && daten ? (
      <PassSeite
        daten={daten}
        fortschritt={fortschritt}
        fremdeOrte={fremdeOrte}
        overland={overland}
        marker={marker}
        kuli={einstellungen.kuli}
        oeffnen={(teil) => {
          if (teil === "einstellungen") setImportZeigen(null);
          setPass(teil);
        }}
        schliessen={() => setPass(null)}
      />
    ) : pass === "orte" && daten ? (
      <OrteSeite
        daten={daten}
        fortschritt={fortschritt}
        fremdeOrte={fremdeOrte}
        zurueck={zumPass}
        oeffnen={(wurzel) => {
          // Pass closes, the plan goes to the whole place, the sheet shows it (Bauplan 3, D2).
          setPass(null);
          setHoehe(1);
          const ort = daten.liste.find((r) => r.wurzel === wurzel);
          if (ort) void ortLadenAuf(ort.id).then(() => waehlen(wurzel), () => undefined);
        }}
      />
    ) : pass === "stempel" ? (
      <StempelSeite daten={daten!} fortschritt={fortschritt} fremdeOrte={fremdeOrte} zurueck={zumPass} />
    ) : pass === "rueckblicke" ? (
      <RueckblickeSeite
        fortschritt={fortschritt}
        zurueck={zumPass}
        zeitraum={zeitraumStarten}
        zeitreise={() => {
          // Starts today; the slider goes back from there.
          setPass(null);
          setZeitreise(new Date().setHours(24, 0, 0, 0));
        }}
        abspielen={(tag: Tag) => {
          // The pass closes and the day runs on the plan: its ways, only what was new that day.
          void wegeSeit(tag.von - 86400_000).then((andere) => {
            const wege = [
              ...andere.filter((w) => w.startedAt >= tag.von && w.startedAt < tag.bis).map((w) => ({ coords: w.coords, ...(w.gefahren ? { gefahren: w.gefahren } : {}) })),
              ...streifzuege.filter((s) => s.status !== "aktiv" && s.startedAt >= tag.von && s.startedAt < tag.bis && s.fixes.length > 1).map((s) => kurzMitArt(s.fixes)),
            ];
            setPass(null);
            setHoehe(1);
            setEinzeln((alt) => ({ wege, seit: tag.von, bis: tag.bis, nr: (alt?.nr ?? 1000) + 1 }));
          });
        }}
      />
    ) : pass === "einstellungen" ? (
      <EinstellungenSeite
        sitzung={sitzung}
        werte={einstellungen}
        aendern={aendern}
        daten={daten}
        overland={overland}
        start={importZeigen === "overland" ? "aufzeichnung" : importZeigen === "gpx" ? "gpx" : importZeigen === "ueber" ? "ueber" : null}
        zumPass={() => {
          setPass("start");
          setImportZeigen(null);
        }}
        offeneApp={() => {
          // Fallback when Overland fails (Bauplan 3, D8): record while the app is open.
          setPass(null);
          setImportZeigen(null);
          aufzeichnung.starten();
        }}
        zustand={[
          [t.zustand.version, new Date(__BAUSTAND__).toLocaleString("de-DE")],
          [t.zustand.eigene, String(streifzuege.length)],
          [t.zustand.stuecke, fortschritt ? t.zustand.stueckeWert(fortschritt.stuecke.filter((p) => p.kind === "street").length, fortschritt.gefahren.length) : t.zustand.nochNicht],
          [t.zustand.rechnet, rechenFehler ?? (rechnet ? `${rechnet.fertig} / ${rechnet.gesamt}` : t.zustand.fertig)],
          [t.zustand.netz, online ? t.zustand.online : t.zustand.offline],
        ]}
      />
    ) : null;

  // Replay: one way tapped under "Zuletzt", or what came in since the last visit.
  const abspielen =
    einzeln ?? (rueckblick && rbBereit === rueckblick.nr && !aufzeichnung.aktiv ? { wege: rueckblick.wege.map((w) => ({ coords: w.coords, ...(w.gefahren ? { gefahren: w.gefahren } : {}) })), seit: rueckblick.seit, nr: rueckblick.nr } : null);
  // Pages of the Pass lie over the plan; the plan stays as it is underneath (Bauplan 3, D2).
  return (
    <>
    <div className="app" aria-hidden={seite ? true : undefined}>
      <main className="inhalt">
        <Karte
          daten={daten}
          gewaehlt={gebiet?.id ?? null}
          gewaehltName={gebiet?.name ?? ""}
          onWaehlen={(id, sprung) => {
            // A tap on the quarter already shown puts the sheet down (Bauplan 3, B3).
            if (id === gebiet?.id && sprung === undefined) setHoehe(1);
            waehlen(id, sprung);
          }}
          springen={springen.current}
          spur={aufzeichnung.fixes}
          entdeckt={gelbZeitreise}
          gefahren={zeitreise === null ? linien.rot : []}
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
          erstesMal={erstesMal}
          stifte={stifte}
          zeitraum={zeitraum}
          komplett={zeitreise === null ? komplettLinien : []}
          ueberblick={zeitreise === null ? fortschritt?.ueberblick : undefined}
          orte={ortePunkte}
          onOrt={ortOeffnen}
          onZeitraumDatum={setZrDatum}
          onZeitraumEnde={() => setZeitraum((z) => (z ? { ...z, fertig: true } : z))}
        />
        {zeitraum && !zeitraum.fertig && zrDatum !== null && <ZeitraumDatum t={zrDatum} />}
        <div className="karten-knoepfe">
          <button type="button" className="rund-knopf" aria-label={t.pass.oeffnen} onClick={() => setPass("start")}>
            <IconPass />
          </button>
          <button type="button" className="rund-knopf" aria-label={t.karte.standort} onClick={zumStandort}>
            <IconStandort />
          </button>
        </div>
        {zeitraum ? (
          <ZeitraumKarte titel={zeitraum.titel} von={zeitraum.von} bis={zeitraum.bis} fortschritt={fortschritt} fertig={zeitraum.fertig} schliessen={() => setZeitraum(null)} />
        ) : zeitreise !== null && daten && fortschritt ? (
          <ZeitreiseLeiste daten={daten} gebiet={gebiet} fortschritt={fortschritt} bis={zeitreise} setBis={setZeitreise} schliessen={() => setZeitreise(null)} />
        ) : (
          <Blatt {...blattProps} />
        )}
      </main>
    </div>
    {seite && <div className="ueber-plan">{seite}</div>}
    </>
  );
}

/** When a piece was first walked (index lookup, built once per progress). */
const erstesMalIndex = new WeakMap<Fortschritt, Map<string, number>>();
function erstesMalRoh(f: Fortschritt | null, id: string): number | undefined {
  if (!f) return undefined;
  let m = erstesMalIndex.get(f);
  if (!m) {
    m = new Map(f.stuecke.map((p, i) => [p.id, f.erstesMal[i] ?? 0]));
    erstesMalIndex.set(f, m);
  }
  return m.get(id);
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
