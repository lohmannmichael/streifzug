/**
 * Map data versions (Michi, 24.11.2026). Piece ids ("<tile>:<line>:<piece>") point to a line of one
 * version of the map data; OpenFreeMap publishes new data about weekly and the lines of a tile then
 * come in another order. Stored results carry the version and are worked out again after an update;
 * exceptions also keep their place, so they are found again under the new id.
 */
import { distanceM, type LonLat } from "./geo";

/** "20261122_124456_pt" from ".../planet/20261122_124456_pt/{z}/{x}/{y}.pbf". */
export function kartenStandAusUrl(url: string): string {
  return /\/planet\/([^/]+)\//.exec(url)?.[1] ?? url;
}

/** An exception with the middle of its piece: "<id>|<lon>,<lat>". */
export function ausnahmeEintrag(id: string, mid: LonLat): string {
  return `${id}|${mid[0].toFixed(6)},${mid[1].toFixed(6)}`;
}

export function ausnahmeLesen(eintrag: string): { id: string; mid: LonLat | null } {
  const [id, ort] = eintrag.split("|");
  const [lon, lat] = (ort ?? "").split(",").map(Number);
  return { id: id!, mid: ort && Number.isFinite(lon) && Number.isFinite(lat) ? [lon!, lat!] : null };
}

/** The current id of an exception: the piece of its tile whose middle lies within 3 m, else the stored id. */
export function ausnahmeAufloesen(eintrag: string, stueckeDerKachel: readonly { id: string; mid: LonLat }[]): string {
  const { id, mid } = ausnahmeLesen(eintrag);
  if (!mid) return id;
  let best: { id: string; d: number } | null = null;
  for (const p of stueckeDerKachel) {
    const d = distanceM(mid, p.mid);
    if (d <= 3 && (!best || d < best.d)) best = { id: p.id, d };
  }
  return best?.id ?? id;
}
