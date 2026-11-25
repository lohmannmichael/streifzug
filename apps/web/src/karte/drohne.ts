import { distanceM, DROHNE_TEMPO, freigabeZeiten, planeDrohne, segmentArten, standBei, type LonLat, type ReplayWeg } from "@streifzug/core";
import { MercatorCoordinate, type Map as MapLibreMap } from "maplibre-gl";
import { LEER, setzeDaten } from "./ebenen";
import { zeigeBox } from "./kamera";
import { tippSperren } from "./tippSperre";
import { box, nurAktiv, rueckblickAbspielen, spurBis, type RueckblickDaten, type RueckblickKontext } from "./rueckblick";

/**
 * Replay "Drohne" (Michi, 24.11.2026; the second variant next to the calm one in rueckblick.ts).
 * Since 25.11.2026 ("viel zu hektisch, eher ruhig drüber schweben, Straßen gut lesbar") the camera
 * hovers at one height (zoom 15) and mostly stands still: it only glides gently after the pen when
 * the pen leaves a calm zone in the middle. Car rides, left-out stretches and the way to the next
 * way are a calm flight (MapLibre flyTo) while the pen waits. Start: a look over the day, then down
 * to the start. Tap skips, holding plays three times as fast. With "Reduce motion" the calm variant
 * runs.
 */
const ZOOM = 15;
/** On a very full day the pen goes faster; then the camera goes up a little (at most this much). */
const ZOOM_HOECHSTENS_HOEHER = 0.8;
/** A jump of the pen further than this (car ride, left-out stretch, next way) is a flight. */
const SPRUNG_M = 250;
const UEBERBLICK_MS = 1200;
const OBEN = 70;
/** Calm zone: the camera stands still while the pen is within this share of the free area. */
const RUHE = 0.2;
/** Gliding after the pen (ms): high = calm. */
const GLEITEN_MS = 900;
const HALTEN_MS = 350;
const SCHNELL = 3;

const ruhig = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const flugDauer = (m: number) => (m < 1500 ? 1000 : m < 20_000 ? 1600 : 2400);

export function drohneAbspielen(karte: MapLibreMap, daten: RueckblickDaten, k: RueckblickKontext, fertig: () => void): () => void {
  if (ruhig()) return rueckblickAbspielen(karte, daten, k, fertig);
  const bis = daten.bis ?? Infinity;
  const neu = k.entdeckt.filter((p) => (k.erstesMal.get(p.id) ?? 0) >= daten.seit && (k.erstesMal.get(p.id) ?? 0) < bis);
  const alt = k.entdeckt.filter((p) => (k.erstesMal.get(p.id) ?? 0) < daten.seit);
  const roh = daten.wege.filter((w) => w.coords.length > 1);
  const wege: ReplayWeg[] = roh.map((w) => ({ coords: w.coords, arten: segmentArten(w.coords, neu, w.gefahren) }));
  const plan = planeDrohne(wege);
  const freigabe = freigabeZeiten(nurAktiv(plan), wege, neu);
  const reihenfolge = [...neu].sort((a, b) => (freigabe.get(a.id) ?? Infinity) - (freigabe.get(b.id) ?? Infinity));
  // A very full day: new streets go faster than planned; the camera goes up a little so the pen
  // keeps a calm pace on the screen.
  const neuPlan = plan.abschnitte.filter((a) => a.art === "neu");
  const neuDauer = neuPlan.reduce((s, a) => s + a.dauer, 0);
  const neuNatuerlich = neuPlan.reduce((s, a) => s + ((a.bis - a.von) / DROHNE_TEMPO.neu) * 1000, 0);
  const zoom = ZOOM - Math.min(ZOOM_HOECHSTENS_HOEHER, Math.max(0, neuDauer > 0 ? Math.log2(neuNatuerlich / neuDauer) : 0));

  let aus = false;
  let bild = 0;
  const zeiten: number[] = [];
  const container = karte.getContainer();
  let tempo = 1;
  let halten = 0;
  let gehalten = false;
  let gedrueckt = false;
  const ziehenWar = karte.dragPan.isEnabled();
  karte.dragPan.disable();

  const aufraeumen = () => {
    cancelAnimationFrame(bild);
    zeiten.forEach((z) => window.clearTimeout(z));
    window.clearTimeout(halten);
    container.removeEventListener("pointerdown", runter, true);
    container.removeEventListener("pointerup", hoch, true);
    container.removeEventListener("pointercancel", hoch, true);
    if (ziehenWar) karte.dragPan.enable();
    tippSperren();
    karte.stop();
    setzeDaten(karte, "rb", LEER);
    setzeDaten(karte, "rb-kopf", LEER);
  };
  const stopp = () => {
    if (aus) return;
    aus = true;
    aufraeumen();
    k.zeichnen(k.aktuell());
  };
  const ende = () => {
    if (aus) return;
    stopp();
    if (k.veedel) zeigeBox(karte, k.veedel, { top: 60, bottom: k.untenFrei + 20, left: 30, right: 30 }, { maxZoom: 16, duration: 1200 });
    zeiten.push(window.setTimeout(fertig, 1200));
  };
  const runter = (e: Event) => {
    e.stopPropagation();
    tippSperren(60_000);
    gehalten = false;
    gedrueckt = true;
    halten = window.setTimeout(() => {
      gehalten = true;
      tempo = SCHNELL;
    }, HALTEN_MS);
  };
  const hoch = (e: Event) => {
    e.stopPropagation();
    tippSperren();
    window.clearTimeout(halten);
    if (!gedrueckt) return;
    gedrueckt = false;
    if (gehalten) tempo = 1;
    else ende();
  };
  container.addEventListener("pointerdown", runter, true);
  container.addEventListener("pointerup", hoch, true);
  container.addEventListener("pointercancel", hoch, true);

  if (plan.abschnitte.length === 0) {
    zeiten.push(window.setTimeout(ende, 300));
    return stopp;
  }

  let freigegeben = 0;
  const freigeben = (t: number) => {
    let m = freigegeben;
    while (m < reihenfolge.length && (freigabe.get(reihenfolge[m]!.id) ?? Infinity) <= t) m++;
    if (m !== freigegeben) {
      k.gelbDazu?.(reihenfolge.slice(freigegeben, m));
      freigegeben = m;
      k.zeichnen([...alt, ...reihenfolge.slice(0, m)]);
    }
  };
  k.zeichnen(alt);

  const hoehe = () => container.clientHeight;
  const unten = () => hoehe() - k.untenFrei;
  /** Shift (in px, downwards positive) from the map's middle to the middle of the free area. */
  const versatz = () => (OBEN + unten()) / 2 - hoehe() / 2;
  /** Map middle so that `punkt` is in the middle of the free area at zoom `z`. */
  const mitteFuer = (punkt: LonLat, z: number) => {
    const p = MercatorCoordinate.fromLngLat([punkt[0], punkt[1]]);
    return new MercatorCoordinate(p.x, p.y - versatz() / (512 * 2 ** z)).toLngLat();
  };

  // A look at the whole day from above (all ways near the first), then down to the start.
  const erster = wege[plan.wege[0]!]!;
  const nah = wege.filter((w) => Math.abs(w.coords[0]![0] - erster.coords[0]![0]) < 0.6 && Math.abs(w.coords[0]![1] - erster.coords[0]![1]) < 0.36);
  const b = box(nah.flatMap((w) => w.coords));
  zeigeBox(karte, [[b[0], b[1]], [b[2], b[3]]], { top: OBEN, bottom: k.untenFrei + 30, left: 30, right: 30 }, { maxZoom: 14, duration: 0 });

  let mitte: { x: number; y: number } | null = null;
  let t = 0;
  let letzt = 0;
  let wegJetzt = -1;
  const fertigeWege: number[] = [];
  let letzterPunkt: LonLat | null = null;
  /** While a flight runs (until this time), the pen waits and the camera is MapLibre's. */
  let fliegtBis = 0;

  const fliegen = (ziel: LonLat, dauer: number, jetzt: number) => {
    karte.flyTo({ center: mitteFuer(ziel, zoom), zoom, bearing: 0, duration: dauer, essential: true });
    fliegtBis = jetzt + dauer;
    mitte = null;
  };

  /** The camera stands still while the pen is in the calm zone, else it glides gently after it. */
  const kamera = (stift: LonLat, dt: number) => {
    const welt = 512 * 2 ** zoom;
    if (!mitte) {
      const c = MercatorCoordinate.fromLngLat(karte.getCenter());
      mitte = { x: c.x, y: c.y };
    }
    const p = MercatorCoordinate.fromLngLat([stift[0], stift[1]]);
    // Pen relative to the middle of the free area, in px.
    const dx = (p.x - mitte.x) * welt;
    const dy = (p.y - mitte.y) * welt - versatz();
    const d = Math.hypot(dx, dy);
    const ruhe = RUHE * Math.min(container.clientWidth, unten() - OBEN);
    if (d <= ruhe) return;
    const f = (1 - ruhe / d) * (1 - Math.exp(-dt / GLEITEN_MS));
    mitte = { x: mitte.x + (dx * f) / welt, y: mitte.y + (dy * f) / welt };
    karte.jumpTo({ center: new MercatorCoordinate(mitte.x, mitte.y).toLngLat(), zoom, bearing: 0 });
  };

  const schritt = (jetzt: number) => {
    if (aus) return;
    const dt = letzt ? Math.min(500, jetzt - letzt) : 16;
    letzt = jetzt;
    if (jetzt < fliegtBis) {
      bild = requestAnimationFrame(schritt);
      return;
    }
    t += dt * tempo;
    const st = standBei(plan, wege, t);
    if (st.weg !== wegJetzt) {
      if (wegJetzt !== -1) fertigeWege.push(wegJetzt);
      wegJetzt = st.weg;
    }
    const weg = wege[st.weg]!;
    const meter = plan.meter[st.weg]!;
    // Ink lines: the ways done so far in full, the current one up to the pen.
    const linien = [...fertigeWege.map((i) => spurBis(wege[i]!, plan.meter[i]!, Infinity).features).flat(), ...spurBis(weg, meter, st.m).features];
    setzeDaten(karte, "rb", { type: "FeatureCollection", features: linien });
    setzeDaten(karte, "rb-kopf", { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: st.punkt } });
    freigeben(t);
    if (st.fertig || t >= plan.dauer) {
      k.zeichnen(k.aktuell());
      zeiten.push(window.setTimeout(ende, 500));
      return;
    }
    // A jump (first start, car ride, left-out stretch, next way): a calm flight, the pen waits.
    const sprung = letzterPunkt ? distanceM(letzterPunkt, st.punkt) : Infinity;
    letzterPunkt = st.punkt;
    if (sprung > SPRUNG_M) fliegen(st.punkt, sprung === Infinity ? 1800 : flugDauer(sprung), jetzt);
    else kamera(st.punkt, dt);
    bild = requestAnimationFrame(schritt);
  };
  zeiten.push(window.setTimeout(() => (bild = requestAnimationFrame(schritt)), UEBERBLICK_MS));
  return stopp;
}
