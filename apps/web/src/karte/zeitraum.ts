import { freigabeZeiten, planeNachfahren, standBei, type LonLat, type Piece, type ReplayArt, type ReplayPlan, type ReplayWeg } from "@streifzug/core";
import type { Map as MapLibreMap } from "maplibre-gl";
import { LEER, setzeDaten } from "./ebenen";
import { zeigeBox } from "./kamera";
import type { RueckblickWeg } from "./rueckblick";

/**
 * A whole period played back ("Dein November", Bauplan 3, F2): zoomed out with all ways of the
 * period in view, one section per area (ways more than about 40 km apart), all ways in the order
 * walked with a narrow highlighter stroke, about 10 seconds. The date of the running way is
 * reported for the line on top. At the end everything new of the period is yellow.
 */
export interface ZeitraumWeg extends RueckblickWeg {
  startedAt: number;
}

interface ZeitraumKontext {
  entdeckt: readonly Piece[];
  erstesMal: ReadonlyMap<string, number>;
  zeichnen: (stuecke: readonly Piece[]) => void;
  aktuell: () => readonly Piece[];
  untenFrei: number;
  /** Start of the way being drawn (for the date on top). */
  datum: (t: number) => void;
}

export const ZEITRAUM_MS = 10_000;

const ruhig = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function box(wege: readonly { coords: LonLat[] }[]): [[number, number], [number, number]] {
  let [w, s, o, n] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const weg of wege) for (const [x, y] of weg.coords) [w, s, o, n] = [Math.min(w, x), Math.min(s, y), Math.max(o, x), Math.max(n, y)];
  return [[w, s], [o, n]];
}

/** Areas: a way belongs to the first group whose start lies within about 40 km. */
function gegend(wege: readonly ZeitraumWeg[]): number[] {
  const mitten: LonLat[] = [];
  return wege.map((w) => {
    const a = w.coords[0]!;
    let g = mitten.findIndex((m) => Math.abs(m[0] - a[0]) < 0.6 && Math.abs(m[1] - a[1]) < 0.36);
    if (g === -1) g = mitten.push(a) - 1;
    return g;
  });
}

/** Stretches a short plan to the full length, so even one short way takes about 10 s. */
function strecken(plan: ReplayPlan, ziel: number): ReplayPlan {
  if (plan.dauer <= 0 || plan.dauer >= ziel) return plan;
  const f = ziel / plan.dauer;
  return { ...plan, dauer: ziel, abschnitte: plan.abschnitte.map((a) => ({ ...a, start: a.start * f, dauer: a.dauer * f })) };
}

export function zeitraumAbspielen(karte: MapLibreMap, daten: { wege: ZeitraumWeg[]; von: number; bis: number }, k: ZeitraumKontext, fertig: () => void): () => void {
  // One section per area (in the order first visited), within it the ways in the order walked.
  const zeitlich = daten.wege.filter((w) => w.coords.length > 1).sort((a, b) => a.startedAt - b.startedAt);
  const g0 = gegend(zeitlich);
  const sortiert = zeitlich.map((w, i) => ({ w, g: g0[i]! })).sort((a, b) => a.g - b.g || a.w.startedAt - b.w.startedAt).map((x) => x.w);
  const wege: ReplayWeg[] = sortiert.map((w) => ({ coords: w.coords, arten: w.coords.slice(1).map((): ReplayArt => "neu") }));
  const gruppe = gegend(sortiert);
  const plan = strecken(planeNachfahren(wege, wege.map(() => true), ZEITRAUM_MS, { mitNeuem: 0, ohneNeues: 0 }), ZEITRAUM_MS);
  const neu = k.entdeckt.filter((p) => {
    const t = k.erstesMal.get(p.id) ?? 0;
    return t >= daten.von && t < daten.bis;
  });
  const alt = k.entdeckt.filter((p) => (k.erstesMal.get(p.id) ?? 0) < daten.von);
  const freigabe = freigabeZeiten(plan, wege, neu);
  const reihenfolge = [...neu].sort((a, b) => (freigabe.get(a.id) ?? Infinity) - (freigabe.get(b.id) ?? Infinity));

  let aus = false;
  let bild = 0;
  const zeiten: number[] = [];
  const container = karte.getContainer();
  const ziehenWar = karte.dragPan.isEnabled();
  karte.dragPan.disable();
  const rand = { top: 90, bottom: k.untenFrei + 30, left: 30, right: 30 };

  const aufraeumen = () => {
    cancelAnimationFrame(bild);
    zeiten.forEach((z) => window.clearTimeout(z));
    container.removeEventListener("pointerdown", tippen, true);
    if (ziehenWar) karte.dragPan.enable();
    setzeDaten(karte, "rb", LEER);
  };
  const ende = () => {
    if (aus) return;
    aus = true;
    aufraeumen();
    // Everything new of the period yellow, the whole period in view.
    k.zeichnen(k.aktuell());
    const alle = gegend(sortiert);
    const meiste = [...new Set(alle)].sort((a, b) => alle.filter((x) => x === b).length - alle.filter((x) => x === a).length)[0];
    if (sortiert.length) zeigeBox(karte, box(sortiert.filter((_, i) => alle[i] === meiste)), rand, { maxZoom: 15, duration: ruhig() ? 0 : 800 });
    fertig();
  };
  const tippen = (e: Event) => {
    e.stopPropagation();
    ende();
  };
  container.addEventListener("pointerdown", tippen, true);

  if (plan.abschnitte.length === 0 || ruhig()) {
    zeiten.push(window.setTimeout(ende, ruhig() ? 600 : 300));
    return () => {
      if (!aus) {
        aus = true;
        aufraeumen();
      }
    };
  }

  k.zeichnen(alt);
  let freigegeben = 0;
  let gruppeJetzt = -1;
  let wegJetzt = -1;
  // Narrow highlighter strokes of the ways drawn so far in this area.
  let fertigeStriche: LonLat[][] = [];
  let t = 0;
  let letzt = 0;
  const schritt = (jetzt: number) => {
    if (aus) return;
    const dt = letzt ? Math.min(500, jetzt - letzt) : 0;
    letzt = jetzt;
    t += dt;
    const st = standBei(plan, wege, t);
    if (st.weg !== wegJetzt) {
      if (wegJetzt !== -1 && gruppe[wegJetzt] === gruppe[st.weg]) fertigeStriche.push(wege[wegJetzt]!.coords);
      wegJetzt = st.weg;
      k.datum(sortiert[st.weg]!.startedAt);
      // A new area: a hard cut to all of its ways of the period.
      if (gruppe[st.weg] !== gruppeJetzt) {
        gruppeJetzt = gruppe[st.weg]!;
        fertigeStriche = [];
        zeigeBox(karte, box(sortiert.filter((_, i) => gruppe[i] === gruppeJetzt)), rand, { maxZoom: 15, duration: 0 });
      }
    }
    const meter = plan.meter[st.weg]!;
    const weg = wege[st.weg]!;
    const jetztStrich: LonLat[] = [];
    for (let i = 0; i < weg.coords.length && meter[i]! <= st.m; i++) jetztStrich.push(weg.coords[i]!);
    jetztStrich.push(st.punkt);
    setzeDaten(karte, "rb", {
      type: "FeatureCollection",
      features: [...fertigeStriche, jetztStrich].filter((c) => c.length > 1).map((coordinates) => ({ type: "Feature", properties: { zeitraum: true }, geometry: { type: "LineString", coordinates } })),
    });
    let m = freigegeben;
    while (m < reihenfolge.length && (freigabe.get(reihenfolge[m]!.id) ?? Infinity) <= t) m++;
    if (m !== freigegeben) {
      freigegeben = m;
      k.zeichnen([...alt, ...reihenfolge.slice(0, m)]);
    }
    if (st.fertig || t >= plan.dauer) {
      zeiten.push(window.setTimeout(ende, 400));
      return;
    }
    bild = requestAnimationFrame(schritt);
  };
  zeiten.push(window.setTimeout(() => (bild = requestAnimationFrame(schritt)), 300));
  return () => {
    if (!aus) {
      aus = true;
      aufraeumen();
      k.zeichnen(k.aktuell());
    }
  };
}
