import { freigabeZeiten, passtBeiZoom, planeNachfahren, punktBei, standBei, type LonLat, type Piece, type ReplayArt, type ReplayPlan, type ReplayWeg } from "@streifzug/core";
import { MercatorCoordinate, type Map as MapLibreMap } from "maplibre-gl";
import { LEER, setzeDaten } from "./ebenen";
import { zeigeBox } from "./kamera";
import { tippSperren } from "./tippSperre";

/**
 * Replay "näher heran, nachfahren" (Bauplan 3, F1). Each way on its own, in the order walked,
 * with a hard cut between them. A thin ink line grows with the pen tip; where something new is
 * walked, the yellow comes in the same beat. A way that fits on screen at zoom 15.5 is shown
 * still, a longer one is followed at zoom 16 with the tip at 40 % from the rear edge. Car rides:
 * red pen line, eight times as fast, zoomed out to the whole ride, no following.
 * Tap skips everything, holding plays three times as fast. Afterwards the map zooms to the
 * quarter and the number counts up.
 */
export interface RueckblickWeg {
  coords: LonLat[];
  /** Per coordinate: part of a car, bus or train leg. */
  gefahren?: boolean[];
}

export interface RueckblickDaten {
  wege: RueckblickWeg[];
  /** Everything first walked since this time counts as new. */
  seit: number;
  /** One past day (Rückblicke, Bauplan 3, D4): only what was new before this; later yellow waits. */
  bis?: number | undefined;
}

export interface RueckblickKontext {
  /** All seen ("aktiv") street pieces with the time each was first walked. */
  entdeckt: readonly Piece[];
  erstesMal: ReadonlyMap<string, number>;
  /** Draws the seen pieces (the replay hides the new ones and releases them one by one). */
  zeichnen: (stuecke: readonly Piece[]) => void;
  /** The seen pieces as they are now (they may change while the replay runs). */
  aktuell: () => readonly Piece[];
  /** Free space at the bottom (sheet). */
  untenFrei: number;
  /** Bounds of the chosen quarter, for the closing zoom. */
  veedel: [[number, number], [number, number]] | null;
  /** New pieces just turned yellow (for "+340 m neu" and the street name on top). */
  gelbDazu?: (stuecke: readonly Piece[]) => void;
  /**
   * Polaroid (Michi, 25.11.2026): play only inside this window (px from the map's edges). At the
   * end the picture stays (all ways of it in view, ink and yellow) until the next one starts.
   */
  fenster?: Fenster | null;
}

export interface Fenster {
  oben: number;
  unten: number;
  links: number;
  rechts: number;
}

const ZOOM_FOLGEN = 16;
const ZOOM_STILL = 15.5;
const OBEN = 70;
/** Tip at 40 % from the rear edge: the map centre lies 10 % of the view ahead of it. */
const VORAUS = 0.1;
/** Camera smoothing (ms): no jolts at corners. */
const GLAETTEN_MS = 450;
const HALTEN_MS = 350;
const SCHNELL = 3;
const RUHIG_JE_WEG_MS = 1000;

const ruhig = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function alsReplayWeg(w: RueckblickWeg): ReplayWeg {
  return { coords: w.coords, arten: w.coords.slice(1).map((_, i): ReplayArt => (w.gefahren?.[i] && w.gefahren?.[i + 1] ? "gefahren" : "neu")) };
}

/** Only the parts walked or cycled release yellow (a car ride never does). */
export const nurAktiv = (plan: ReplayPlan): ReplayPlan => ({ ...plan, abschnitte: plan.abschnitte.filter((a) => a.art !== "gefahren") });

export function box(coords: readonly LonLat[]): [number, number, number, number] {
  let [w, s, o, n] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [x, y] of coords) [w, s, o, n] = [Math.min(w, x), Math.min(s, y), Math.max(o, x), Math.max(n, y)];
  return [w, s, o, n];
}

/** The way up to `m` meters, split into ink and pen-line parts. */
export function spurBis(weg: ReplayWeg, meter: readonly number[], m: number) {
  const features: { type: "Feature"; properties: { gefahren: boolean }; geometry: { type: "LineString"; coordinates: LonLat[] } }[] = [];
  let aktuell: LonLat[] = [weg.coords[0]!];
  let art = weg.arten[0] === "gefahren";
  for (let i = 1; i < weg.coords.length; i++) {
    const segArt = weg.arten[i - 1] === "gefahren";
    if (segArt !== art) {
      if (aktuell.length > 1) features.push({ type: "Feature", properties: { gefahren: art }, geometry: { type: "LineString", coordinates: aktuell } });
      aktuell = [weg.coords[i - 1]!];
      art = segArt;
    }
    if (meter[i]! <= m) aktuell.push(weg.coords[i]!);
    else {
      aktuell.push(punktBei(weg.coords, meter, m).punkt);
      break;
    }
  }
  if (aktuell.length > 1) features.push({ type: "Feature", properties: { gefahren: art }, geometry: { type: "LineString", coordinates: aktuell } });
  return { type: "FeatureCollection" as const, features };
}

export function rueckblickAbspielen(karte: MapLibreMap, daten: RueckblickDaten, k: RueckblickKontext, fertig: () => void): () => void {
  const wege = daten.wege.filter((w) => w.coords.length > 1).map(alsReplayWeg);
  const bis = daten.bis ?? Infinity;
  const neu = k.entdeckt.filter((p) => (k.erstesMal.get(p.id) ?? 0) >= daten.seit && (k.erstesMal.get(p.id) ?? 0) < bis);
  const alt = k.entdeckt.filter((p) => (k.erstesMal.get(p.id) ?? 0) < daten.seit);
  // Which ways bring something new (they get at least 2 s, the others 1 s).
  const probe = planeNachfahren(wege, wege.map(() => true), Infinity);
  const probeFrei = freigabeZeiten(nurAktiv(probe), wege, neu);
  const mitNeuem = wege.map(() => false);
  for (const t of probeFrei.values()) {
    const a = probe.abschnitte.find((x) => t >= x.start && t <= x.start + x.dauer);
    if (a) mitNeuem[a.weg] = true;
  }
  const plan = planeNachfahren(wege, mitNeuem);
  const freigabe = freigabeZeiten(nurAktiv(plan), wege, neu);
  const reihenfolge = [...neu].sort((a, b) => (freigabe.get(a.id) ?? Infinity) - (freigabe.get(b.id) ?? Infinity));

  let aus = false;
  let bild = 0;
  const zeiten: number[] = [];
  const container = karte.getContainer();
  let tempo = 1;
  let halten = 0;
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
    // Always end with the latest state, never with the snapshot from the start.
    k.zeichnen(k.aktuell());
  };
  /** End (also when skipped): all new streets yellow, zoom to the whole quarter, then the number. */
  const ende = () => {
    if (aus) return;
    stopp();
    if (k.veedel) zeigeBox(karte, k.veedel, { top: 60, bottom: k.untenFrei + 20, left: 30, right: 30 }, { maxZoom: 16, duration: ruhig() ? 0 : 1200 });
    zeiten.push(window.setTimeout(fertig, ruhig() ? 0 : 1200));
  };
  // A tap skips; holding the finger down plays three times as fast.
  let gehalten = false;
  let gedrueckt = false;
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

  const breite = () => container.clientWidth;
  const hoehe = () => container.clientHeight;
  const sichtbarUnten = () => hoehe() - k.untenFrei;
  const passend = (b: [number, number, number, number], maxZoom: number) =>
    zeigeBox(karte, [[b[0], b[1]], [b[2], b[3]]], { top: OBEN, bottom: k.untenFrei + 30, left: 30, right: 30 }, { maxZoom, duration: 0 });

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

  // "Reduce motion": no following, no growing; each way's final state for a second.
  if (ruhig()) {
    let i = 0;
    const naechster = () => {
      if (aus) return;
      if (i >= plan.wege.length) return ende();
      const wi = plan.wege[i++]!;
      const weg = wege[wi]!;
      passend(box(weg.coords), 16.5);
      setzeDaten(karte, "rb", spurBis(weg, plan.meter[wi]!, Infinity));
      const letzter = plan.abschnitte.filter((a) => a.weg === wi).at(-1)!;
      freigeben(letzter.start + letzter.dauer);
      zeiten.push(window.setTimeout(naechster, RUHIG_JE_WEG_MS));
    };
    naechster();
    return stopp;
  }

  let wegJetzt = -1;
  let folgen = false;
  let artJetzt: ReplayArt | null = null;
  let mitte: { x: number; y: number } | null = null;
  let t = 0;
  let letzt = 0;

  const neuerWeg = (wi: number) => {
    wegJetzt = wi;
    artJetzt = null;
    mitte = null;
    const b = box(wege[wi]!.coords);
    // Still if the whole way fits at zoom 15.5 above the sheet, else follow the tip.
    folgen = !passtBeiZoom(b, breite() - 60, sichtbarUnten() - OBEN - 30, ZOOM_STILL);
    if (!folgen) passend(b, 17);
  };

  const kamera = (wi: number, m: number, art: ReplayArt, dt: number) => {
    const weg = wege[wi]!;
    const meter = plan.meter[wi]!;
    if (art !== artJetzt) {
      artJetzt = art;
      mitte = null;
      // A car ride: the whole ride in view, zoomed out, no following.
      if (art === "gefahren") {
        const a = plan.abschnitte.find((x) => x.weg === wi && m >= x.von - 0.5 && m <= x.bis + 0.5 && x.art === "gefahren");
        if (a) passend(box(weg.coords.filter((_, i) => meter[i]! >= a.von - 1 && meter[i]! <= a.bis + 1)), 15);
      } else if (!folgen) passend(box(weg.coords), 17);
    }
    if (!folgen || art === "gefahren") return;
    const { punkt } = punktBei(weg.coords, meter, m);
    // Direction from a little behind to a little ahead, so single corners do not jolt the view.
    const hinten = punktBei(weg.coords, meter, Math.max(0, m - 40)).punkt;
    const vorne = punktBei(weg.coords, meter, Math.min(meter.at(-1)!, m + 80)).punkt;
    const dx = (vorne[0] - hinten[0]) * Math.cos((punkt[1] * Math.PI) / 180);
    const dy = vorne[1] - hinten[1];
    const laenge = Math.hypot(dx, dy) || 1;
    // Screen direction (north up): x to the right, y downwards.
    const [rx, ry] = [dx / laenge, -dy / laenge];
    const w = breite();
    const oben = OBEN;
    const unten = sichtbarUnten();
    const ausdehnung = Math.abs(rx) * w + Math.abs(ry) * (unten - oben);
    // Where the tip should be on screen, and the map centre that puts it there.
    const spitze = { x: w / 2 - rx * VORAUS * ausdehnung, y: (oben + unten) / 2 - ry * VORAUS * ausdehnung };
    const welt = 512 * 2 ** ZOOM_FOLGEN;
    const p = MercatorCoordinate.fromLngLat([punkt[0], punkt[1]]);
    const ziel = { x: p.x + (w / 2 - spitze.x) / welt, y: p.y + (hoehe() / 2 - spitze.y) / welt };
    const f = mitte ? 1 - Math.exp(-dt / GLAETTEN_MS) : 1;
    mitte = mitte ? { x: mitte.x + (ziel.x - mitte.x) * f, y: mitte.y + (ziel.y - mitte.y) * f } : ziel;
    karte.jumpTo({ center: new MercatorCoordinate(mitte.x, mitte.y).toLngLat(), zoom: ZOOM_FOLGEN, bearing: 0 });
  };

  const schritt = (jetzt: number) => {
    if (aus) return;
    // Real time, also on slow devices; only a long pause (app in the background) is cut short.
    const dt = letzt ? Math.min(500, jetzt - letzt) : 0;
    letzt = jetzt;
    t += dt * tempo;
    const st = standBei(plan, wege, t);
    if (st.weg !== wegJetzt) neuerWeg(st.weg);
    setzeDaten(karte, "rb", spurBis(wege[st.weg]!, plan.meter[st.weg]!, st.m));
    setzeDaten(karte, "rb-kopf", { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: st.punkt } });
    freigeben(t);
    if (st.fertig || t >= plan.dauer) {
      k.zeichnen(k.aktuell());
      zeiten.push(window.setTimeout(ende, 600));
      return;
    }
    kamera(st.weg, st.m, st.art, dt);
    bild = requestAnimationFrame(schritt);
  };
  // A short look at the plan before the pen starts.
  zeiten.push(window.setTimeout(() => (bild = requestAnimationFrame(schritt)), 400));
  return stopp;
}
