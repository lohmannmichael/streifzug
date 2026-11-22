import type { Fix, LonLat, Piece } from "@streifzug/core";
import type { Map as MapLibreMap } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import { orteImBlick } from "@streifzug/core";
import { orteLaden, type Regionen } from "../daten/regionen";
import { t } from "../texte/de";
import { karteBauen, stilNeu } from "./aufbau";
import { eigenesZeichnen, erstesMalSetzen, kompletteNamen, LEER, linienSammlung, namenFilterVergessen, setzeDaten, stifteSetzen, ueberblickSetzen } from "./ebenen";
import { gebieteZeichnen, prozenteSetzen, veedelRahmen } from "./gebiete";
import { ruhig, zeigeBox, zeigeGebiet } from "./kamera";
import { rueckblickAbspielen, type RueckblickWeg } from "./rueckblick";
import { zeitraumAbspielen, type ZeitraumWeg } from "./zeitraum";
import { SchildAnKarte, type EtikettZustand } from "./Schild";
import { gebietAnPunkt, tippenEinrichten } from "./tippen";
import { zeichenMoment } from "./zeichenMoment";

/**
 * The plan. Its parts: building the map and its style (aufbau), own layers and pens (ebenen),
 * areas (gebiete), taps (tippen, Schild), camera (kamera), drawing moment and replay
 * (zeichenMoment, rueckblick). This component connects them to the app's state.
 */

interface KartenProps {
  daten: Regionen | null;
  gewaehlt: string | null;
  gewaehltName: string;
  onWaehlen: (id: string, springen?: boolean) => void;
  /** Whether a newly chosen area should be brought into view (not when it was chosen by locating). */
  springen: boolean;
  /** The current outing (drawn live) and whether the map follows the position. */
  spur: Fix[];
  /** Street pieces already seen (all outings), drawn in highlighter yellow. */
  entdeckt: Piece[];
  /** Pieces only driven (car, bus, train): a pen line under the yellow. Never counted. */
  gefahren: Piece[];
  /** Discovered share (0–100) per area id, for coloring areas when zoomed out. */
  prozente: Map<string, number>;
  folgen: boolean;
  /** While recording: newly seen streets are drawn with a highlighter stroke, "+25 m" pops up. */
  zeichnen: boolean;
  /** Whether paths count (for the "+25 m" number). */
  wegeZaehlen: boolean;
  /** Own position from the location button; the counter moves the map there each time. */
  position: [number, number] | null;
  zentrieren: number;
  /** Replay on opening: the map runs along these outings once (in order); `nr` starts it. */
  rueckblick: { wege: RueckblickWeg[]; seit: number; bis?: number; nr: number } | null;
  onRueckblickEnde: () => void;
  /** A whole period played back ("Dein November", Bauplan 3, F2); `nr` starts it. */
  zeitraum: { wege: ZeitraumWeg[]; von: number; bis: number; nr: number } | null;
  onZeitraumDatum: (t: number) => void;
  onZeitraumEnde: () => void;
  /** Complete streets: their name is underlaid with the highlighter (Bauplan 3, F4). */
  komplett: { name: string; coords: LonLat[][] }[];
  /** Far out (Bauplan 3, F5): fine lines of all ways and a point per place with ways; a tap opens the place. */
  ueberblick: { gelb: LonLat[][]; rot: LonLat[][] } | undefined;
  orte: { id: string; name: string; punkt: LonLat }[];
  onOrt: (id: string) => void;
  /** Bring a box into view (a trip, Bauplan 3, F6); `nr` moves the map. */
  box: { b: [[number, number], [number, number]]; nr: number } | null;
  /** When each seen piece was first walked (year colours, replay). */
  erstesMal: Map<string, number>;
  stifte: { marker: string; kuli: string; jahresFarben: boolean };
}

export function Karte(props: KartenProps) {
  const box = useRef<HTMLDivElement>(null);
  const karteRef = useRef<MapLibreMap | null>(null);
  // The map in state too, for the street sign (a child that needs the map once it exists).
  const [karteDa, setKarteDa] = useState<MapLibreMap | null>(null);
  const gewaehltRef = useRef(props.gewaehlt);
  const datenRef = useRef(props.daten);
  datenRef.current = props.daten;
  const waehlenRef = useRef(props.onWaehlen);
  waehlenRef.current = props.onWaehlen;
  // Latest seen streets and shares, so they can be drawn again whenever the map style (re)loads.
  const entdecktRef = useRef(props.entdeckt);
  entdecktRef.current = props.entdeckt;
  const gefahrenRef = useRef(props.gefahren);
  gefahrenRef.current = props.gefahren;
  const prozenteRef = useRef(props.prozente);
  prozenteRef.current = props.prozente;
  const ueberblickRef = useRef({ linien: props.ueberblick, orte: props.orte });
  ueberblickRef.current = { linien: props.ueberblick, orte: props.orte };
  const ortRef = useRef(props.onOrt);
  ortRef.current = props.onOrt;
  const komplettRef = useRef(props.komplett);
  komplettRef.current = props.komplett;
  const stifteRef = useRef(props.stifte);
  stifteRef.current = props.stifte;
  erstesMalSetzen(props.erstesMal);
  const erstesMalRef = useRef(props.erstesMal);
  erstesMalRef.current = props.erstesMal;
  // Label of a tapped street: a small white sign at the street, moved with the map.
  const [etikett, setEtikett] = useState<EtikettZustand | null>(null);
  const dunkelRef = useRef(false);
  // Map service unreachable (Bauplan 3, C3): grey area with a sentence and "Nochmal".
  const [kaputt, setKaputt] = useState(false);
  // "Nochmal" builds the map anew: MapLibre waits for a failed style forever before it takes a
  // new one (transformStyle), so setStyle alone never asked again (found by the browser tests).
  const [versuch, setVersuch] = useState(0);
  const stilDa = useRef<() => boolean>(() => false);
  // Drawing moment: ids already shown, and the running animation.
  const bekannt = useRef<Set<string> | null>(null);
  const animation = useRef<{ bild: number; ende: () => void } | null>(null);

  useEffect(() => {
    if (!box.current) return;
    const dunkel = window.matchMedia("(prefers-color-scheme: dark)");
    dunkelRef.current = dunkel.matches;
    const { karte, stilDa: da, aufhoeren } = karteBauen(box.current, () => dunkelRef.current, setKaputt);
    karteRef.current = karte;
    // Browser tests (automated browser only) move the map directly.
    if (navigator.webdriver) (window as unknown as { __karte?: MapLibreMap }).__karte = karte;
    stilDa.current = da;
    setKarteDa(karte);

    // Runs after every style load (also after switching light/dark). Seen streets and area shares
    // may have arrived before the style; draw them now so nothing gets lost.
    karte.on("style.load", () => {
      animation.current?.ende();
      eigenesZeichnen(karte);
      stifteSetzen(karte, stifteRef.current);
      namenFilterVergessen();
      kompletteNamen(karte, komplettRef.current);
      ueberblickSetzen(karte, ueberblickRef.current.linien, ueberblickRef.current.orte);
      setzeDaten(karte, "entdeckt", linienSammlung(entdecktRef.current));
      setzeDaten(karte, "gefahren", linienSammlung(gefahrenRef.current));
      if (datenRef.current)
        void gebieteZeichnen(karte, dunkelRef.current, datenRef.current, gewaehltRef.current).then(() => prozenteSetzen(karte, datenRef.current, prozenteRef.current));
    });
    // Places the plan looks at are loaded (Bauplan 3, E4).
    const imBlick = () => orteImBlickLaden(karte, datenRef.current);
    karte.on("moveend", imBlick);
    karte.on("load", imBlick);
    tippenEinrichten(karte, { daten: () => datenRef.current, etikett: setEtikett, waehlen: (id) => waehlenRef.current(id), ort: (id) => ortRef.current(id) });

    const wechsel = (e: MediaQueryListEvent) => {
      dunkelRef.current = e.matches;
      stilNeu(karte);
    };
    dunkel.addEventListener("change", wechsel);
    return () => {
      dunkel.removeEventListener("change", wechsel);
      aufhoeren();
      animation.current?.ende();
      karte.remove();
      karteRef.current = null;
      setKarteDa(null);
    };
  }, [versuch]);

  // Draw regions once their data has arrived.
  useEffect(() => {
    const karte = karteRef.current;
    if (karte) orteImBlickLaden(karte, props.daten);
    if (karte && props.daten && stilDa.current())
      void gebieteZeichnen(karte, dunkelRef.current, props.daten, gewaehltRef.current).then(() => prozenteSetzen(karte, datenRef.current, prozenteRef.current));
  }, [props.daten]);

  // Highlight the chosen area and bring it into view if it is off screen.
  useEffect(() => {
    const karte = karteRef.current;
    const daten = props.daten;
    const alt = gewaehltRef.current;
    const neu = props.gewaehlt;
    gewaehltRef.current = neu;
    if (!karte || !daten) return;
    for (const [id, wert] of [[alt, false], [neu, true]] as const) {
      const regionId = id ? daten.gebiete.get(id)?.regionId : undefined;
      if (id && regionId && karte.getSource(`gebiete-${regionId}`)) karte.setFeatureState({ source: `gebiete-${regionId}`, id }, { gewaehlt: wert });
    }
    for (const r of daten.liste) if (karte.getLayer(`gewaehlt-${r.id}`)) karte.setFilter(`gewaehlt-${r.id}`, ["==", ["get", "id"], neu ?? ""]);
    if (neu && alt !== neu && props.springen) void zeigeGebiet(karte, daten, neu);
  }, [props.gewaehlt, props.daten]);

  // Live track, own position, following, and choosing the area you are in.
  useEffect(() => {
    const karte = karteRef.current;
    if (!karte || !karte.getSource("spur")) return;
    const coords = props.spur.map((f) => [f.lon, f.lat]);
    setzeDaten(karte, "spur", { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coords.length > 1 ? coords : [] } });
    const letzter = props.spur.at(-1);
    const hier: [number, number] | null = letzter ? [letzter.lon, letzter.lat] : props.position;
    setzeDaten(karte, "ich", hier ? { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: hier } } : LEER);
    if (!props.folgen || !letzter) return;
    // While out and about, stay close enough to see single streets turn yellow.
    const ziel = { center: hier!, zoom: Math.max(karte.getZoom(), 16), padding: { top: 0, bottom: karte.getContainer().clientHeight * 0.45, left: 0, right: 0 } };
    if (ruhig()) karte.jumpTo(ziel);
    else karte.easeTo({ ...ziel, duration: 500 });
    karte.once("moveend", () => {
      const id = gebietAnPunkt(karte, datenRef.current, karte.project(hier!));
      // Following you: choose the area you are in without moving the map away.
      if (id && id !== gewaehltRef.current) waehlenRef.current(id, false);
    });
  }, [props.spur, props.folgen, props.position]);

  // A trip: all its places in view above the sheet.
  useEffect(() => {
    const karte = karteRef.current;
    const b = props.box;
    if (!karte || !b) return;
    const h = karte.getContainer().clientHeight;
    zeigeBox(karte, b.b, { top: 70, bottom: h * 0.45, left: 30, right: 30 }, { maxZoom: 14, duration: ruhig() ? 0 : 900 });
  }, [props.box?.nr]);

  // Overview far out.
  useEffect(() => {
    const karte = karteRef.current;
    if (karte && stilDa.current()) ueberblickSetzen(karte, props.ueberblick, props.orte);
  }, [props.ueberblick, props.orte]);

  // Names of complete streets.
  useEffect(() => {
    const karte = karteRef.current;
    if (karte && stilDa.current()) kompletteNamen(karte, props.komplett);
  }, [props.komplett]);

  // Driven streets as a pen line.
  useEffect(() => {
    const karte = karteRef.current;
    if (karte?.getSource("gefahren")) setzeDaten(karte, "gefahren", linienSammlung(props.gefahren));
  }, [props.gefahren]);

  // Seen streets in yellow. While recording, new ones get the drawing moment.
  useEffect(() => {
    const karte = karteRef.current;
    const ids = new Set(props.entdeckt.map((p) => p.id));
    const vorher = bekannt.current;
    bekannt.current = ids;
    if (!karte || !karte.getSource("entdeckt")) return;
    animation.current?.ende();
    const neu = props.zeichnen && vorher ? props.entdeckt.filter((p) => !vorher.has(p.id)) : [];
    if (neu.length === 0) {
      setzeDaten(karte, "entdeckt", linienSammlung(props.entdeckt));
      return;
    }
    const meter = neu.reduce((m, p) => m + (p.kind === "street" || props.wegeZaehlen ? p.lengthM * p.weight : 0), 0);
    const letzter = props.spur.at(-1);
    zeichenMoment(karte, props.entdeckt, neu, meter, letzter ? [letzter.lon, letzter.lat] : null, animation);
  }, [props.entdeckt]);

  // Area coloring by discovered share.
  useEffect(() => {
    const karte = karteRef.current;
    if (karte) prozenteSetzen(karte, props.daten, props.prozente);
  }, [props.prozente, props.daten]);

  // A period played back (Bauplan 3, F2).
  const zr = useRef({ datum: props.onZeitraumDatum, ende: props.onZeitraumEnde });
  zr.current = { datum: props.onZeitraumDatum, ende: props.onZeitraumEnde };
  useEffect(() => {
    const karte = karteRef.current;
    const z = props.zeitraum;
    if (!karte || !z) return;
    return zeitraumAbspielen(
      karte,
      z,
      {
        entdeckt: entdecktRef.current,
        erstesMal: erstesMalRef.current,
        zeichnen: (stuecke) => setzeDaten(karte, "entdeckt", linienSammlung(stuecke)),
        aktuell: () => entdecktRef.current,
        untenFrei: Math.min(260, karte.getContainer().clientHeight * 0.4),
        datum: (t) => zr.current.datum(t),
      },
      () => zr.current.ende(),
    );
  }, [props.zeitraum?.nr]);

  // Replay on opening: fit all new outings into view, then run along them once.
  const rbEnde = useRef(props.onRueckblickEnde);
  rbEnde.current = props.onRueckblickEnde;
  useEffect(() => {
    const karte = karteRef.current;
    const rb = props.rueckblick;
    if (!karte || !rb || rb.wege.length === 0) return;
    // Visible part of the sheet (it is moved down when small).
    const rahmen = document.querySelector(".blatt")?.getBoundingClientRect();
    const blatt = rahmen ? Math.max(0, karte.getContainer().getBoundingClientRect().bottom - rahmen.top) : 160;
    return rueckblickAbspielen(
      karte,
      { wege: rb.wege, seit: rb.seit, bis: rb.bis },
      {
        entdeckt: entdecktRef.current,
        erstesMal: erstesMalRef.current,
        zeichnen: (stuecke) => setzeDaten(karte, "entdeckt", linienSammlung(stuecke)),
        aktuell: () => entdecktRef.current,
        untenFrei: Math.min(blatt, karte.getContainer().clientHeight * 0.4),
        // A past day ends where its ways are, not at the chosen quarter.
        veedel: rb.bis === undefined ? veedelRahmen(gewaehltRef.current, datenRef.current) : null,
      },
      () => rbEnde.current(),
    );
  }, [props.rueckblick?.nr]);

  // Location button: move to the own position.
  useEffect(() => {
    const karte = karteRef.current;
    if (!karte || !props.position || props.zentrieren === 0) return;
    const ziel = { center: props.position, zoom: Math.max(karte.getZoom(), 15), padding: { top: 0, bottom: karte.getContainer().clientHeight * 0.45, left: 0, right: 0 } };
    if (ruhig()) karte.jumpTo(ziel);
    else karte.easeTo({ ...ziel, duration: 600 });
  }, [props.zentrieren]);

  // Pens: colours and year colours.
  useEffect(() => {
    const karte = karteRef.current;
    if (karte) stifteSetzen(karte, props.stifte);
  }, [props.stifte.marker, props.stifte.kuli, props.stifte.jahresFarben]);

  return (
    <>
      <div ref={box} className="karte" role="region" aria-label={t.karte.kartenRegion(props.gewaehltName)} />
      {kaputt && (
        <div className="karte-fehler" role="alert">
          <p>{t.karte.laedtNicht}</p>
          <button
            type="button"
            className="text-knopf"
            onClick={() => {
              setKaputt(false);
              setVersuch((v) => v + 1);
            }}
          >
            {t.karte.nochmal}
          </button>
        </div>
      )}
      <SchildAnKarte karte={karteDa} etikett={etikett} schliessen={() => setEtikett(null)} />
    </>
  );
}

/** Loads the places in view (none when zoomed out far). */
function orteImBlickLaden(karte: MapLibreMap, daten: Regionen | null) {
  if (!daten) return;
  const b = karte.getBounds();
  orteLaden(orteImBlick(daten.liste, [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()], karte.getZoom()));
}
