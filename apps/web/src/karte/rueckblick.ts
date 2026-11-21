import { freigabeZeiten, planeRueckblick, type LonLat, type Piece, type ReplayArt, type ReplayWeg } from "@streifzug/core";
import type { Map as MapLibreMap } from "maplibre-gl";

/**
 * Replay on opening (Michi, 21.11.2026: no pen, only the yellow). The plan shows all new ways at
 * once; the new streets turn yellow one after another in the order they were walked (3–7 s).
 * Tap skips. Afterwards the map zooms to the Veedel and the number counts up.
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
  /** Draws the seen pieces (the replay hides the new ones and releases them one by one). */
  zeichnen: (stuecke: readonly Piece[]) => void;
  /** Free space at the bottom (sheet). */
  untenFrei: number;
  /** Bounds of the chosen Veedel, for the closing zoom. */
  veedel: [[number, number], [number, number]] | null;
}

const MIN_MS = 3000;
const MAX_MS = 7000;

const ruhig = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Order only needs "new or not": every segment counts the same. */
const alsWeg = (coords: LonLat[]): ReplayWeg => ({ coords, arten: coords.slice(1).map((): ReplayArt => "neu") });

export function rueckblickAbspielen(karte: MapLibreMap, daten: RueckblickDaten, k: RueckblickKontext, fertig: () => void): () => void {
  const wege = daten.wege.filter((l) => l.length > 1).map(alsWeg);
  const plan = planeRueckblick(wege, 60_000);
  const neu = k.entdeckt.filter((p) => (k.erstesMal.get(p.id) ?? 0) >= daten.seit);
  const alt = k.entdeckt.filter((p) => (k.erstesMal.get(p.id) ?? 0) < daten.seit);
  const freigabe = freigabeZeiten(plan, wege, neu);
  // New pieces no way reaches (e.g. from a way shown earlier) come at the end.
  const reihenfolge = [...neu].sort((a, b) => (freigabe.get(a.id) ?? Infinity) - (freigabe.get(b.id) ?? Infinity));
  const dauer = Math.min(MAX_MS, Math.max(MIN_MS, plan.dauer));
  const skala = plan.dauer > 0 ? plan.dauer / dauer : 1;

  let aus = false;
  let bild = 0;
  const zeiten: number[] = [];
  const container = karte.getContainer();
  const aufraeumen = () => {
    cancelAnimationFrame(bild);
    zeiten.forEach((z) => window.clearTimeout(z));
    container.removeEventListener("pointerdown", tippen, true);
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
  const tippen = (e: Event) => {
    e.stopPropagation();
    ende();
  };
  container.addEventListener("pointerdown", tippen, true);

  // All new ways in view at once (a cut, no flight).
  let [w, s, o, n] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const weg of wege) for (const [x, y] of weg.coords) [w, s, o, n] = [Math.min(w, x), Math.min(s, y), Math.max(o, x), Math.max(n, y)];
  if (!Number.isFinite(w) || neu.length === 0) {
    zeiten.push(window.setTimeout(ende, 300));
    return stopp;
  }
  karte.fitBounds([[w, s], [o, n]], { padding: { top: 70, bottom: k.untenFrei + 30, left: 40, right: 40 }, maxZoom: 16.5, duration: 0 });

  if (ruhig()) {
    k.zeichnen(k.entdeckt);
    zeiten.push(window.setTimeout(ende, 1500));
    return stopp;
  }

  k.zeichnen(alt);
  let freigegeben = 0;
  let start = 0;
  const schritt = (jetzt: number) => {
    if (aus) return;
    start ||= jetzt;
    const t = (jetzt - start) * skala;
    let m = freigegeben;
    while (m < reihenfolge.length && (freigabe.get(reihenfolge[m]!.id) ?? plan.dauer) <= t) m++;
    if (m !== freigegeben) {
      freigegeben = m;
      k.zeichnen([...alt, ...reihenfolge.slice(0, m)]);
    }
    if (t >= plan.dauer) {
      k.zeichnen(k.entdeckt);
      zeiten.push(window.setTimeout(ende, 700));
      return;
    }
    bild = requestAnimationFrame(schritt);
  };
  // A short look at the plan before the yellow starts.
  zeiten.push(window.setTimeout(() => (bild = requestAnimationFrame(schritt)), 500));
  return stopp;
}
