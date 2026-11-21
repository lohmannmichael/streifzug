import { freigabeZeiten, planeRueckblick, standBei, type LonLat, type Piece, type ReplayArt, type ReplayWeg } from "@streifzug/core";
import { distanceToLineM } from "@streifzug/core";
import { Marker, type Map as MapLibreMap } from "maplibre-gl";

/**
 * Replay "Stift von oben" (docs/PLAN.md, section 5.1). A cut to the start of the oldest new way,
 * then a highlighter tip runs along the ways; new streets turn yellow when the tip passes them,
 * known ones are glided over, driven parts run through fast with a pen tip. At most 20 s.
 * Tap skips, holding fast-forwards three times. Afterwards the map zooms to the Veedel.
 */
export interface RueckblickDaten {
  wege: LonLat[][];
  /** Everything first walked since this time counts as new. */
  seit: number;
}

export interface RueckblickKontext {
  /** All seen ("aktiv") street pieces with the time each was first walked. */
  entdeckt: readonly Piece[];
  erstesMal: ReadonlyMap<string, number>;
  gefahren: readonly Piece[];
  /** Draws the seen pieces (the replay hides the new ones and releases them one by one). */
  zeichnen: (stuecke: readonly Piece[]) => void;
  /** Colours of the pens now. */
  marker: string;
  kuli: string;
  /** Free space at the bottom (sheet). */
  untenFrei: number;
  /** Bounds of the chosen Veedel, for the closing zoom. */
  veedel: [[number, number], [number, number]] | null;
}

const ZOOM_NAH = 16.5;
const ZOOM_GEFAHREN = 14;

const ruhig = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Puts pieces into a coarse grid, so each point only looks at pieces nearby. */
function raster(stuecke: readonly Piece[]) {
  const g = new Map<string, Piece[]>();
  const k = (x: number, y: number) => `${Math.floor(x / 0.003)},${Math.floor(y / 0.002)}`;
  for (const p of stuecke) {
    const key = k(p.mid[0], p.mid[1]);
    (g.get(key) ?? g.set(key, []).get(key)!).push(p);
  }
  return (pt: LonLat) => {
    const out: Piece[] = [];
    const cx = Math.floor(pt[0] / 0.003);
    const cy = Math.floor(pt[1] / 0.002);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (const p of g.get(`${cx + dx},${cy + dy}`) ?? []) out.push(p);
    return out;
  };
}

/** What each segment of a way is: near a new piece, a known one, or only near driven ones. */
function einordnen(linie: LonLat[], seit: number, k: RueckblickKontext, aktivNah: (p: LonLat) => Piece[], gefahrenNah: (p: LonLat) => Piece[]): ReplayWeg {
  const arten: ReplayArt[] = [];
  for (let i = 0; i < linie.length - 1; i++) {
    const a = linie[i]!;
    const b = linie[i + 1]!;
    const mitte: LonLat = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    let art: ReplayArt | null = null;
    for (const p of aktivNah(mitte)) {
      if (distanceToLineM(mitte, p.coords) > 25) continue;
      if ((k.erstesMal.get(p.id) ?? 0) >= seit) {
        art = "neu";
        break;
      }
      art = "bekannt";
    }
    if (!art) art = gefahrenNah(mitte).some((p) => distanceToLineM(mitte, p.coords) <= 30) ? "gefahren" : "bekannt";
    arten.push(art);
  }
  return { coords: linie, arten };
}

function stiftElement(): HTMLDivElement {
  const el = document.createElement("div");
  el.className = "stift";
  // A chisel tip in highlighter colour with a black shaft start, pointing up (direction of travel).
  el.innerHTML = `<div class="stift-dreh"><svg viewBox="0 0 28 40" width="28" height="40" aria-hidden="true">
    <rect class="stift-schaft" x="7" y="0" width="14" height="22" rx="2" />
    <path class="stift-spitze" d="M7 22 H21 L18 36 L11 39 Z" />
  </svg></div>`;
  return el;
}

export function rueckblickAbspielen(karte: MapLibreMap, daten: RueckblickDaten, k: RueckblickKontext, fertig: () => void): () => void {
  const seit = daten.seit;
  const aktivNah = raster(k.entdeckt);
  const gefahrenNah = raster(k.gefahren);
  const wege = daten.wege.filter((l) => l.length > 1).map((l) => einordnen(l, seit, k, aktivNah, gefahrenNah));
  const plan = planeRueckblick(wege);
  const neu = k.entdeckt.filter((p) => (k.erstesMal.get(p.id) ?? 0) >= seit);
  const alt = k.entdeckt.filter((p) => (k.erstesMal.get(p.id) ?? 0) < seit);
  const freigabe = freigabeZeiten(plan, wege, neu);
  const reihenfolge = [...neu].sort((a, b) => (freigabe.get(a.id) ?? Infinity) - (freigabe.get(b.id) ?? Infinity));
  const padding = { top: 0, bottom: k.untenFrei, left: 0, right: 0 };

  let aus = false;
  let bild = 0;
  const zeiten: number[] = [];
  const stift = stiftElement();
  stift.style.setProperty("--stift-marker", k.marker);
  stift.style.setProperty("--stift-kuli", k.kuli);
  const marker = new Marker({ element: stift, anchor: "bottom" });

  const aufraeumen = () => {
    cancelAnimationFrame(bild);
    zeiten.forEach((z) => window.clearTimeout(z));
    marker.remove();
    container.removeEventListener("pointerdown", runter, true);
    window.removeEventListener("pointerup", hoch, true);
    window.removeEventListener("pointercancel", hoch, true);
  };
  const stopp = () => {
    if (aus) return;
    aus = true;
    aufraeumen();
    k.zeichnen(k.entdeckt);
  };
  /** End (also when skipped): all new streets yellow, zoom to the whole Veedel, then the number. */
  const ende = () => {
    if (aus) return;
    stopp();
    if (k.veedel) karte.fitBounds(k.veedel, { padding: { top: 60, bottom: k.untenFrei + 20, left: 30, right: 30 }, maxZoom: 16, duration: ruhig() ? 0 : 1200 });
    zeiten.push(window.setTimeout(fertig, ruhig() ? 0 : 1200));
  };

  // Tap skips; holding fast-forwards three times.
  const container = karte.getContainer();
  let tempo = 1;
  let haltenSeit = 0;
  let haltenTimer = 0;
  const runter = (e: Event) => {
    e.stopPropagation();
    haltenSeit = performance.now();
    haltenTimer = window.setTimeout(() => (tempo = 3), 250);
  };
  const hoch = () => {
    if (!haltenSeit) return;
    window.clearTimeout(haltenTimer);
    const kurz = performance.now() - haltenSeit < 250;
    haltenSeit = 0;
    tempo = 1;
    if (kurz) ende();
  };
  container.addEventListener("pointerdown", runter, true);
  window.addEventListener("pointerup", hoch, true);
  window.addEventListener("pointercancel", hoch, true);

  if (plan.abschnitte.length === 0) {
    zeiten.push(window.setTimeout(ende, 300));
    return stopp;
  }

  // Reduced motion: no run; the way with the most new is shown, new streets fade in.
  if (ruhig()) {
    const erster = wege[plan.wege[0]!]!.coords;
    let [w, s, o, n] = [Infinity, Infinity, -Infinity, -Infinity];
    for (const [x, y] of erster) [w, s, o, n] = [Math.min(w, x), Math.min(s, y), Math.max(o, x), Math.max(n, y)];
    karte.fitBounds([[w, s], [o, n]], { padding: { ...padding, top: 60, left: 30, right: 30 }, maxZoom: ZOOM_NAH, duration: 0 });
    k.zeichnen(k.entdeckt);
    zeiten.push(window.setTimeout(ende, 2000));
    return stopp;
  }

  // 1. Cut, no flight: the plan stands at the start of the oldest new way.
  const start = standBei(plan, wege, 0);
  karte.jumpTo({ center: [...start.punkt] as [number, number], zoom: ZOOM_NAH, bearing: 0, pitch: 0, padding });
  k.zeichnen(alt);
  marker.setLngLat([...start.punkt] as [number, number]).addTo(karte);

  let t = 0;
  let zuletzt = performance.now();
  let zoom = ZOOM_NAH;
  let freigegeben = 0;
  let weg = start.weg;
  const schritt = (jetzt: number) => {
    if (aus) return;
    t += (jetzt - zuletzt) * tempo;
    zuletzt = jetzt;
    const st = standBei(plan, wege, t);
    // Pieces the tip has passed turn yellow (only redraw when something changed).
    let n = freigegeben;
    while (n < reihenfolge.length && (freigabe.get(reihenfolge[n]!.id) ?? Infinity) <= t) n++;
    if (n !== freigegeben) {
      freigegeben = n;
      k.zeichnen([...alt, ...reihenfolge.slice(0, n)]);
    }
    // Driven parts: pen tip, zoomed out. The plan never turns.
    const ziel = st.art === "gefahren" ? ZOOM_GEFAHREN : ZOOM_NAH;
    zoom += (ziel - zoom) * 0.06;
    if (st.weg !== weg) {
      // Between two ways: a cut, the tip sets down again.
      weg = st.weg;
      zoom = ziel;
    }
    karte.jumpTo({ center: [...st.punkt] as [number, number], zoom, padding });
    marker.setLngLat([...st.punkt] as [number, number]);
    stift.classList.toggle("abgehoben", st.abgehoben);
    stift.classList.toggle("kuli", st.art === "gefahren");
    // Leaning a little in the direction of travel (never more than 25°).
    (stift.firstElementChild as HTMLElement).style.transform = `rotate(${Math.sin((st.richtung * Math.PI) / 180) * 25}deg)`;
    if (st.fertig) {
      zeiten.push(window.setTimeout(ende, 400));
      return;
    }
    bild = requestAnimationFrame(schritt);
  };
  // The tip sets down (150 ms), then runs.
  stift.classList.add("abgehoben");
  zeiten.push(
    window.setTimeout(() => {
      zuletzt = performance.now();
      bild = requestAnimationFrame(schritt);
    }, 350),
  );
  return stopp;
}
