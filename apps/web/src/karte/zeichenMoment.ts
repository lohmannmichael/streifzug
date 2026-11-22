import { distanceM, type LonLat, type Piece } from "@streifzug/core";
import { Marker, type Map as MapLibreMap } from "maplibre-gl";
import { alsStrecke } from "../daten/regionen";
import { strassenName } from "../daten/strassen";
import { t } from "../texte/de";
import { LEER, linienSammlung, setzeDaten, strich } from "./ebenen";
import { ruhig } from "./kamera";

// Duration of the highlighter stroke over a newly seen street, and of the glow afterwards.
const ZEICHNEN_MS = 700;
const GLANZ_MS = 1400;

/**
 * New streets are not simply switched on: a highlighter stroke runs along them, a short glow follows,
 * and "+25 m" rises next to the own position. Calm (no stroke, no rising) with "reduce motion".
 */
export function zeichenMoment(
  karte: MapLibreMap,
  alle: readonly Piece[],
  neu: readonly Piece[],
  meter: number,
  hier: LonLat | null,
  animation: { current: { bild: number; ende: () => void } | null },
) {
  const neuIds = new Set(neu.map((p) => p.id));
  setzeDaten(karte, "entdeckt", linienSammlung(alle.filter((p) => !neuIds.has(p.id))));
  setzeDaten(karte, "neu", linienSammlung(neu));
  navigator.vibrate?.(12);

  // "+25 m" next to where you are (or the new street), as a map marker so it moves with the map.
  let marke: Marker | null = null;
  if (meter >= 1) {
    // MapLibre positions the marker element via transform; the badge (tilted, animated) sits inside.
    const el = document.createElement("div");
    const plakette = document.createElement("span");
    plakette.className = "plus-meter";
    plakette.textContent = `+${alsStrecke(meter)}`;
    el.append(plakette);
    el.setAttribute("role", "status");
    el.setAttribute("aria-label", t.karte.neuEntdeckt(alsStrecke(meter)));
    const ort = hier ?? neu.at(-1)!.mid;
    marke = new Marker({ element: el, anchor: "bottom", offset: [0, -18] }).setLngLat(ort as [number, number]).addTo(karte);
    // The street name follows a moment later (the tile is already loaded, so this is quick).
    const naechstes = hier ? [...neu].sort((a, b) => distanceM(a.mid, hier) - distanceM(b.mid, hier))[0]! : neu.at(-1)!;
    void strassenName(naechstes).then((name) => {
      if (!name || !plakette.isConnected) return;
      const zeile = document.createElement("small");
      zeile.className = "plus-name";
      zeile.textContent = name;
      plakette.prepend(zeile);
      el.setAttribute("aria-label", t.karte.neuEntdecktIn(alsStrecke(meter), name));
    }).catch(() => undefined);
    el.addEventListener("animationend", () => marke?.remove());
    window.setTimeout(() => marke?.remove(), 2500);
  }

  let fertig = false;
  const ende = () => {
    if (fertig) return;
    fertig = true;
    cancelAnimationFrame(animation.current?.bild ?? 0);
    animation.current = null;
    if (!karte.getSource("entdeckt")) return;
    setzeDaten(karte, "entdeckt", linienSammlung(alle));
    setzeDaten(karte, "neu", LEER);
    karte.setPaintProperty("neu", "line-gradient", strich(0));
    karte.setPaintProperty("neu-glanz", "line-opacity", 0);
  };
  if (ruhig()) {
    karte.setPaintProperty("neu", "line-gradient", strich(1));
    animation.current = { bild: 0, ende };
    window.setTimeout(ende, 600);
    return;
  }
  const start = performance.now();
  const bild = (jetzt: number) => {
    if (fertig) return;
    // The frame time can lie slightly before the start time.
    const z = Math.max(0, jetzt - start);
    const p = Math.min(1, z / ZEICHNEN_MS);
    karte.setPaintProperty("neu", "line-gradient", strich(1 - (1 - p) ** 3));
    // Glow rises with the stroke and fades afterwards.
    const g = Math.max(0, z < ZEICHNEN_MS ? 0.5 * p : 0.5 * (1 - (z - ZEICHNEN_MS) / (GLANZ_MS - ZEICHNEN_MS)));
    karte.setPaintProperty("neu-glanz", "line-opacity", g);
    if (z >= GLANZ_MS) ende();
    else if (animation.current) animation.current.bild = requestAnimationFrame(bild);
  };
  animation.current = { bild: requestAnimationFrame(bild), ende };
}
