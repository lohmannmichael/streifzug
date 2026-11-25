import { distanceM, freigabeZeiten, planeDrohne, punktBei, segmentArten, standBei, type LonLat, type ReplayArt, type ReplayWeg } from "@streifzug/core";
import { MercatorCoordinate, type Map as MapLibreMap } from "maplibre-gl";
import { LEER, setzeDaten } from "./ebenen";
import { zeigeBox } from "./kamera";
import { tippSperren } from "./tippSperre";
import { box, nurAktiv, rueckblickAbspielen, spurBis, type RueckblickDaten, type RueckblickKontext } from "./rueckblick";

/**
 * Replay "Drohne" (Michi, 24.11.2026; the second variant next to the calm one in rueckblick.ts).
 * The camera starts high above the whole day and flies down to the start. Along the way the zoom
 * glides with what is happening: close over new streets, further out over known stretches, far
 * out over car rides in time lapse. Between two ways it flies to the next. Time: 5 s plus 3 s per
 * new kilometre, at most 15 s. Tap skips, holding plays three times as fast. With "Reduce motion"
 * the calm variant runs (no following, no growing).
 */
// Zoom per kind; the speeds in core/drohne.ts are made for these (Michi, 25.11.2026: too fast).
const ZOOM: Record<ReplayArt, number> = { neu: 16.5, bekannt: 15, gefahren: 13.5 };
const ZOOM_FLUG = 14.5;
/** A jump of the tip further than this (a left-out stretch) is a hard cut, not a glide. */
const SCHNITT_M = 250;
const FLUG_MS = 900;
const UEBERBLICK_MS = 700;
const OBEN = 70;
/** Tip slightly ahead of the middle: 45 % from the rear edge. */
const VORAUS = 0.05;
/** Smoothing (ms): the position follows closely, the zoom glides. */
const MITTE_MS = 220;
const ZOOM_MS = 650;
const HALTEN_MS = 350;
const SCHNELL = 3;

const ruhig = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function drohneAbspielen(karte: MapLibreMap, daten: RueckblickDaten, k: RueckblickKontext, fertig: () => void): () => void {
  if (ruhig()) return rueckblickAbspielen(karte, daten, k, fertig);
  const bis = daten.bis ?? Infinity;
  const neu = k.entdeckt.filter((p) => (k.erstesMal.get(p.id) ?? 0) >= daten.seit && (k.erstesMal.get(p.id) ?? 0) < bis);
  const alt = k.entdeckt.filter((p) => (k.erstesMal.get(p.id) ?? 0) < daten.seit);
  const roh = daten.wege.filter((w) => w.coords.length > 1);
  const wege: ReplayWeg[] = roh.map((w) => ({ coords: w.coords, arten: segmentArten(w.coords, neu, w.gefahren) }));
  const plan = planeDrohne(wege, { flugMs: FLUG_MS });
  const freigabe = freigabeZeiten(nurAktiv(plan), wege, neu);
  const reihenfolge = [...neu].sort((a, b) => (freigabe.get(a.id) ?? Infinity) - (freigabe.get(b.id) ?? Infinity));

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

  // Areas: ways within about 40 km of each other. Each area starts high above all its ways of the
  // day, then the camera goes down; a new area (Köln, then Freising) begins with a hard cut.
  const mitten: LonLat[] = [];
  const gegend = wege.map((w) => {
    const a = w.coords[0]!;
    let g = mitten.findIndex((m) => Math.abs(m[0] - a[0]) < 0.6 && Math.abs(m[1] - a[1]) < 0.36);
    if (g === -1) g = mitten.push(a) - 1;
    return g;
  });
  const ueberblick = (g: number) => {
    const b = box(wege.filter((_, i) => gegend[i] === g).flatMap((w) => w.coords));
    zeigeBox(karte, [[b[0], b[1]], [b[2], b[3]]], { top: OBEN, bottom: k.untenFrei + 30, left: 30, right: 30 }, { maxZoom: 14, duration: 0 });
  };
  let gegendJetzt = gegend[plan.wege[0]!]!;
  ueberblick(gegendJetzt);

  const breite = () => container.clientWidth;
  const hoehe = () => container.clientHeight;
  const unten = () => hoehe() - k.untenFrei;
  let mitte: { x: number; y: number } | null = null;
  let zoom = karte.getZoom();
  let t = 0;
  let letzt = 0;
  let wegJetzt = -1;
  const fertigeWege: number[] = [];
  let letzterPunkt: LonLat | null = null;
  /** The next camera step jumps (hard cut) instead of gliding. */
  let schnitt = false;

  /** Camera towards the tip (or the next way's start during a flight), smoothly. */
  const kamera = (ziel: LonLat, richtung: LonLat | null, zielZoom: number, dt: number) => {
    zoom = schnitt ? zielZoom : zoom + (zielZoom - zoom) * (1 - Math.exp(-dt / ZOOM_MS));
    let [rx, ry] = [0, 0];
    if (richtung) {
      const dx = (richtung[0] - ziel[0]) * Math.cos((ziel[1] * Math.PI) / 180);
      const dy = richtung[1] - ziel[1];
      const l = Math.hypot(dx, dy) || 1;
      [rx, ry] = [dx / l, -dy / l];
    }
    const w = breite();
    const ausdehnung = Math.abs(rx) * w + Math.abs(ry) * (unten() - OBEN);
    const spitze = { x: w / 2 - rx * VORAUS * ausdehnung, y: (OBEN + unten()) / 2 - ry * VORAUS * ausdehnung };
    const welt = 512 * 2 ** zoom;
    const p = MercatorCoordinate.fromLngLat([ziel[0], ziel[1]]);
    const soll = { x: p.x + (w / 2 - spitze.x) / welt, y: p.y + (hoehe() / 2 - spitze.y) / welt };
    if (!mitte) {
      const c = MercatorCoordinate.fromLngLat(karte.getCenter());
      mitte = { x: c.x, y: c.y };
    }
    const f = schnitt ? 1 : 1 - Math.exp(-dt / MITTE_MS);
    schnitt = false;
    mitte = { x: mitte.x + (soll.x - mitte.x) * f, y: mitte.y + (soll.y - mitte.y) * f };
    karte.jumpTo({ center: new MercatorCoordinate(mitte.x, mitte.y).toLngLat(), zoom, bearing: 0 });
  };

  const schritt = (jetzt: number) => {
    if (aus) return;
    const dt = letzt ? Math.min(500, jetzt - letzt) : 16;
    letzt = jetzt;
    t += dt * tempo;
    const st = standBei(plan, wege, t);
    if (st.weg !== wegJetzt) {
      if (wegJetzt !== -1) fertigeWege.push(wegJetzt);
      wegJetzt = st.weg;
      if (gegend[st.weg] !== gegendJetzt) {
        gegendJetzt = gegend[st.weg]!;
        fertigeWege.length = 0;
        ueberblick(gegendJetzt);
        mitte = null;
        zoom = karte.getZoom();
      }
    }
    const weg = wege[st.weg]!;
    const meter = plan.meter[st.weg]!;
    // A left-out stretch (known or driven, too long a day): cut, do not glide across.
    if (letzterPunkt && distanceM(letzterPunkt, st.punkt) > SCHNITT_M && t >= plan.abschnitte.find((x) => x.weg === st.weg)!.start) schnitt = true;
    letzterPunkt = st.punkt;
    // Ink lines: the ways done so far in full, the current one up to the tip.
    const linien = [...fertigeWege.map((i) => spurBis(wege[i]!, plan.meter[i]!, Infinity).features).flat(), ...spurBis(weg, meter, st.m).features];
    setzeDaten(karte, "rb", { type: "FeatureCollection", features: linien });
    setzeDaten(karte, "rb-kopf", { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: st.punkt } });
    freigeben(t);
    if (st.fertig || t >= plan.dauer) {
      k.zeichnen(k.aktuell());
      zeiten.push(window.setTimeout(ende, 500));
      return;
    }
    // Flying to the next way (its first section has not begun yet): a bit further out.
    const a = plan.abschnitte.find((x) => x.weg === st.weg)!;
    const fliegt = t < a.start;
    const vorne = punktBei(weg.coords, meter, Math.min(meter.at(-1)!, st.m + 80)).punkt;
    const hinten = punktBei(weg.coords, meter, Math.max(0, st.m - 40)).punkt;
    // Direction of travel (from a little behind to a little ahead), as a point ahead of the tip.
    const richtung: LonLat | null = fliegt ? null : [st.punkt[0] + (vorne[0] - hinten[0]), st.punkt[1] + (vorne[1] - hinten[1])];
    kamera(st.punkt, richtung, fliegt ? ZOOM_FLUG : ZOOM[st.art], dt);
    bild = requestAnimationFrame(schritt);
  };
  // A look at the whole day from above, then down to the start.
  zeiten.push(window.setTimeout(() => (bild = requestAnimationFrame(schritt)), UEBERBLICK_MS));
  return stopp;
}
