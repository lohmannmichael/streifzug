import { UEBERBLICK_ZOOM } from "@streifzug/core";
import type { Map as MapLibreMap, MapLayerMouseEvent } from "maplibre-gl";
import type { Regionen } from "../daten/regionen";
import { etikettAn } from "../daten/veedel";
import type { EtikettZustand } from "./Schild";
import { tippGesperrt } from "./tippSperre";

/** The area (smallest level) at a point on screen, or null. */
export function gebietAnPunkt(karte: MapLibreMap, daten: Regionen | null, punkt: { x: number; y: number }): string | null {
  const ebenen = (daten?.liste ?? []).map((r) => `flaeche-${r.id}`).filter((l) => karte.getLayer(l));
  if (!ebenen.length) return null;
  const id = karte.queryRenderedFeatures([punkt.x, punkt.y], { layers: ebenen })[0]?.properties?.id;
  return id ? String(id) : null;
}

/**
 * Taps on the map. Close up, a tap on a street shows its label (also paths that never count);
 * otherwise, and zoomed out, it chooses the area. Moving the map closes the label.
 */
export function tippenEinrichten(
  karte: MapLibreMap,
  ziel: { daten: () => Regionen | null; etikett: (e: EtikettZustand | null) => void; waehlen: (id: string) => void; ort: (id: string) => void },
) {
  karte.on("click", async (e: MapLayerMouseEvent) => {
    // The tap that skipped the replay (see tippSperre.ts).
    if (tippGesperrt()) return;
    // Far out: a tap on a place's point opens the place (Bauplan 3, F5).
    if (karte.getZoom() < UEBERBLICK_ZOOM && karte.getLayer("orte-punkt")) {
      const pad = 16;
      const box: [[number, number], [number, number]] = [[e.point.x - pad, e.point.y - pad], [e.point.x + pad, e.point.y + pad]];
      const ort = karte.queryRenderedFeatures(box, { layers: ["orte-punkt", "orte-name"] })[0]?.properties?.id;
      if (ort) return ziel.ort(String(ort));
    }
    if (karte.getZoom() >= 14) {
      const punkt: [number, number] = [e.lngLat.lng, e.lngLat.lat];
      const meterProPixel = (40075016 * Math.cos((punkt[1] * Math.PI) / 180)) / (512 * 2 ** karte.getZoom());
      const radiusM = Math.max(6, 16 * meterProPixel);
      const strasse = await etikettAn(punkt, radiusM);
      if (strasse) return ziel.etikett({ punkt, strasse, art: null });
      const pad = 10;
      const box: [[number, number], [number, number]] = [[e.point.x - pad, e.point.y - pad], [e.point.x + pad, e.point.y + pad]];
      const neben = karte.getLayer("plan-nebenweg") ? karte.queryRenderedFeatures(box, { layers: ["plan-nebenweg"] })[0] : undefined;
      if (neben) return ziel.etikett({ punkt, strasse: null, art: String(neben.properties?.class ?? ""), name: (neben.properties?.name as string | undefined) ?? null });
    }
    ziel.etikett(null);
    const id = gebietAnPunkt(karte, ziel.daten(), e.point);
    if (id) ziel.waehlen(id);
  });
  karte.on("dragstart", () => ziel.etikett(null));
  karte.on("zoomstart", () => ziel.etikett(null));
}
