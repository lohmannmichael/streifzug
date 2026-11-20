import type { Map as MapLibreMap } from "maplibre-gl";
import type { LonLat } from "@streifzug/core";

/**
 * Fog over undiscovered map parts ("die Stadt aus dem Nebel holen"): a light veil on a canvas
 * above the map, with clear corridors cut out around seen streets and the own position.
 * Fades out when zoomed out, where the areas glow yellow by their share instead.
 */
export interface Nebel {
  setzen(linien: readonly (readonly LonLat[])[], punkt: LonLat | null): void;
  an(an: boolean): void;
  dunkel(dunkel: boolean): void;
  entfernen(): void;
}

interface Linie {
  coords: readonly LonLat[];
  bbox: [number, number, number, number];
}

// Zoom range in which the fog fades in; below it the area colors take over.
const AB_ZOOM = 11.8;
const VOLL_ZOOM = 13.2;
// Half width of a clear corridor around a seen street, in meters (at least a few pixels).
const KORRIDOR_M = 28;

function bbox(coords: readonly LonLat[]): [number, number, number, number] {
  let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
  for (const [x, y] of coords) {
    if (x < a) a = x;
    if (y < b) b = y;
    if (x > c) c = x;
    if (y > d) d = y;
  }
  return [a, b, c, d];
}

export function nebelAnlegen(karte: MapLibreMap): Nebel {
  const container = karte.getContainer();
  const leinwand = document.createElement("canvas");
  leinwand.className = "nebel";
  leinwand.setAttribute("aria-hidden", "true");
  // Above the map, below the map controls.
  container.insertBefore(leinwand, container.querySelector(".maplibregl-control-container"));
  const ctx = leinwand.getContext("2d")!;

  let linien: Linie[] = [];
  let punkt: LonLat | null = null;
  let sichtbar = true;
  let istDunkel = false;
  let geplant = 0;

  const zeichnen = () => {
    geplant = 0;
    const dpr = window.devicePixelRatio || 1;
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (leinwand.width !== Math.round(w * dpr) || leinwand.height !== Math.round(h * dpr)) {
      leinwand.width = Math.round(w * dpr);
      leinwand.height = Math.round(h * dpr);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, leinwand.width, leinwand.height);
    const zoom = karte.getZoom();
    const staerke = Math.min(1, Math.max(0, (zoom - AB_ZOOM) / (VOLL_ZOOM - AB_ZOOM)));
    if (!sichtbar || staerke === 0) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = istDunkel ? `rgba(6, 8, 12, ${0.38 * staerke})` : `rgba(120, 130, 148, ${0.24 * staerke})`;
    ctx.fillRect(0, 0, w, h);

    // Cut clear corridors: a soft wide pass, then a fully clear narrow one.
    const lat = karte.getCenter().lat;
    const meterProPixel = (40075016.686 * Math.cos((lat * Math.PI) / 180)) / (512 * 2 ** zoom);
    const breite = Math.max(8, (2 * KORRIDOR_M) / meterProPixel);
    const grenzen = karte.getBounds();
    const rand = (breite * meterProPixel) / 111_000;
    const west = grenzen.getWest() - rand, sued = grenzen.getSouth() - rand, ost = grenzen.getEast() + rand, nord = grenzen.getNorth() + rand;

    ctx.globalCompositeOperation = "destination-out";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const pfad = new Path2D();
    for (const l of linien) {
      if (l.bbox[2] < west || l.bbox[0] > ost || l.bbox[3] < sued || l.bbox[1] > nord) continue;
      l.coords.forEach((c, i) => {
        const p = karte.project(c as [number, number]);
        if (i === 0) pfad.moveTo(p.x, p.y);
        else pfad.lineTo(p.x, p.y);
      });
      if (l.coords.length === 1) {
        const p = karte.project(l.coords[0] as [number, number]);
        pfad.lineTo(p.x + 0.1, p.y);
      }
    }
    if (punkt) {
      const p = karte.project(punkt as [number, number]);
      pfad.moveTo(p.x, p.y);
      pfad.lineTo(p.x + 0.1, p.y);
    }
    for (const [faktor, deckung] of [[1.7, 0.45], [1, 1]] as const) {
      ctx.lineWidth = breite * faktor;
      ctx.strokeStyle = `rgba(0, 0, 0, ${deckung})`;
      ctx.stroke(pfad);
    }
  };

  const planen = () => {
    if (!geplant) geplant = requestAnimationFrame(zeichnen);
  };
  // "render" runs every frame while the map moves; draw right away so the fog never lags behind.
  karte.on("render", zeichnen);
  karte.on("resize", planen);

  return {
    setzen(neu, p) {
      linien = neu.filter((c) => c.length > 0).map((coords) => ({ coords, bbox: bbox(coords) }));
      punkt = p;
      planen();
    },
    an(an) {
      sichtbar = an;
      planen();
    },
    dunkel(d) {
      istDunkel = d;
      planen();
    },
    entfernen() {
      karte.off("render", zeichnen);
      karte.off("resize", planen);
      if (geplant) cancelAnimationFrame(geplant);
      leinwand.remove();
    },
  };
}
