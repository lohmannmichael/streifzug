import { orteMitPunkten, aktiveFolgen, folgenDerArt, eckenSchliessen, nachzeichnen, lueckenSchliessen, stummelEntfernen, pointInGeometry, seenByLegs, splitLegs, tileFor, TILE_ZOOM, type Fix, type Korrektur, type Piece, type PolygonGeometry, fahrbahnenErgaenzen } from "@streifzug/core";
import { ortDatei } from "./ortDatei";
import type { Region, Summe } from "./regionen";
import { stueckeDerKachel } from "./strassen";

/**
 * The heavy part of the progress, without React, so it can run in the background worker
 * (abgleich.worker.ts) as well as on the page.
 */

/** Bump when the matching rules change: stored results of older versions are worked out again. */
// 2 (21.11.2026): legs "aktiv"/"gefahren" (Bauplan 6.2), results stored separately.
// 10 (22.11.2026): tracks and long service roads drawn as paths.
// 11 (23.11.2026): GPS jitter in a house is a halt, not a way.
// 12 (24.11.2026): gaps in car rides traced along the streets (pen line only).
// 13 (25.11.2026): short stubs with a free end you never came near are taken out.
const ABGLEICH_VERSION = 13;

interface Flaeche {
  id: string;
  geometry: PolygonGeometry;
  bbox: [number, number, number, number];
}

const flaechen = new Map<string, Promise<Flaeche[]>>();

/** Boundaries of one place (loaded once; again after a failure). */
export function ladeFlaechen(region: Region): Promise<Flaeche[]> {
  const regionId = region.id;
  let p = flaechen.get(regionId);
  if (!p) {
    p = fetch(ortDatei(region, "gebiete.geojson"))
      .then((r) => {
        if (!r.ok) throw new Error(`${regionId} ${r.status}`);
        return r.json() as Promise<{ features: { properties: { id: string }; geometry: PolygonGeometry }[] }>;
      })
      .then((d) =>
        d.features.map((f) => {
          const rings = f.geometry.type === "Polygon" ? f.geometry.coordinates : f.geometry.coordinates.flat();
          // A loop, not Math.min(...): large boundaries would overflow the call stack.
          const bbox: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];
          for (const ring of rings)
            for (const [x, y] of ring) {
              bbox[0] = Math.min(bbox[0], x);
              bbox[1] = Math.min(bbox[1], y);
              bbox[2] = Math.max(bbox[2], x);
              bbox[3] = Math.max(bbox[3], y);
            }
          return { id: String(f.properties.id), geometry: f.geometry, bbox };
        }),
      );
    p.catch(() => flaechen.delete(regionId));
    flaechen.set(regionId, p);
  }
  return p;
}

/** Tiles around a track: the tile of each fix plus neighbours within about 30 m. */
export function kachelnFuer(spuren: Fix[][]): { x: number; y: number }[] {
  const d = 0.0004;
  const set = new Map<string, { x: number; y: number }>();
  for (const spur of spuren)
    for (const f of spur)
      for (const [dx, dy] of [[0, 0], [d, 0], [-d, 0], [0, d], [0, -d]] as const) {
        const t = tileFor([f.lon + dx * 1.6, f.lat + dy], TILE_ZOOM);
        set.set(`${t.x}/${t.y}`, { x: t.x, y: t.y });
      }
  return [...set.values()];
}

/** Ids of the pieces one track has covered (all kinds; the caller decides what counts). */
/**
 * What one track covered, per kind of leg: "aktiv" (on foot, by bike; counts) and "gefahren"
 * (car, bus, train; drawn as a pen line, never counts). See packages/core/src/legs.ts.
 */
/** Short fingerprint of a way's corrections ("" without any), part of the key a stored result is valid for. */
export function korrekturHash(k: readonly Korrektur[] | undefined): string {
  if (!k?.length) return "";
  let h = 5381;
  for (const c of JSON.stringify(k)) h = ((h * 33) ^ c.charCodeAt(0)) >>> 0;
  return h.toString(36);
}

/** Key under which a stored result is valid: matching rules, track length and corrections. */
/**
 * Version of the map data the piece ids belong to (Michi, 24.11.2026): after an OpenFreeMap update
 * the same id may name another piece, so a stored result is valid only for the same version.
 */
let kartenStand = "";
export const kartenStandSetzen = (stand: string) => {
  kartenStand = stand;
};
export const kartenStandJetzt = () => kartenStand;

export const gueltigFuer = (n: number, hash: string) => (hash ? `${ABGLEICH_VERSION}:${kartenStand}:${n}:${hash}` : `${ABGLEICH_VERSION}:${kartenStand}:${n}`);

export async function abgleichen(fixes: Fix[], locker: boolean, korrekturen: readonly Korrektur[] = []): Promise<{ aktiv: Piece[]; gefahren: Piece[] }> {
  const alle: Piece[] = [];
  const aktivIds = new Set<string>();
  const gefahrenIds = new Set<string>();
  for (const k of kachelnFuer([fixes])) {
    const teile = await stueckeDerKachel({ z: TILE_ZOOM, ...k });
    const r = seenByLegs(teile, fixes, locker ? { maxGapM: 60 } : {}, korrekturen);
    for (const p of teile) {
      alle.push(p);
      if (r.aktiv.has(p.id)) aktivIds.add(p.id);
      else if (r.gefahren.has(p.id)) gefahrenIds.add(p.id);
    }
  }
  // Corners cut by sparse points, then short white gaps between walked pieces, are closed
  // (only with points walked or cycled, never driven).
  const zuFuss = splitLegs(fixes, korrekturen).filter((l) => l.art === "aktiv").flatMap((l) => l.fixes);
  // Gaps between points traced along the streets, where the way is clear (Michi, 22.11.2026).
  for (const id of nachzeichnen(alle, aktiveFolgen(fixes, korrekturen), aktivIds)) aktivIds.add(id);
  // Car rides too, only for the pen line (never counted): at car speed points are 150–300 m
  // apart, so gaps are traced up to 400 m along the shortest way; two carriageways side by side
  // are no reason to leave the gap open here, as nothing is counted (Michi, 24.11.2026).
  for (const id of nachzeichnen(alle, folgenDerArt(fixes, korrekturen, "gefahren"), gefahrenIds, { maxM: 400, eindeutigFaktor: 0.99, fangM: 25, alleNahen: true })) if (!aktivIds.has(id)) gefahrenIds.add(id);
  for (const id of eckenSchliessen(alle, aktivIds, zuFuss)) aktivIds.add(id);
  for (const id of lueckenSchliessen(alle, aktivIds)) aktivIds.add(id);
  // Two carriageways: one walked counts the other too (Michi, 22.11.2026).
  for (const id of fahrbahnenErgaenzen(alle, aktivIds)) aktivIds.add(id);
  // Stubs: a short piece with a free end you never came near (Michi, 25.11.2026).
  for (const id of stummelEntfernen(alle, aktivIds, zuFuss)) aktivIds.delete(id);
  return { aktiv: alle.filter((p) => aktivIds.has(p.id)), gefahren: alle.filter((p) => !aktivIds.has(p.id) && gefahrenIds.has(p.id)) };
}

/** Pieces for stored ids ("<z>/<x>/<y>:<line>:<piece>"), loading each tile once. */
export async function stueckeFuerIds(ids: Iterable<string>): Promise<Piece[]> {
  const jeKachel = new Map<string, Set<string>>();
  for (const id of ids) {
    const k = id.split(":")[0]!;
    (jeKachel.get(k) ?? jeKachel.set(k, new Set()).get(k)!).add(id);
  }
  const out: Piece[] = [];
  for (const [k, gesucht] of jeKachel) {
    const [z, x, y] = k.split("/").map(Number) as [number, number, number];
    for (const p of await stueckeDerKachel({ z, x, y })) if (gesucht.has(p.id)) out.push(p);
  }
  return out;
}

/**
 * Seen meters per area id (all levels): every piece counts for each area its middle lies in.
 * With `zeit`, each area also gets the time of its first piece (`seit`).
 */
export async function meterJeGebiet(
  stuecke: Iterable<Piece>,
  liste: Region[],
  zeit?: (p: Piece) => number | undefined,
  /** Called for every area a piece lies in (e.g. the Zeitreise's meters per area and day). */
  jeGebiet?: (gebietId: string, p: Piece) => void,
): Promise<Map<string, Summe>> {
  const proGebiet = new Map<string, Summe>();
  const alle = [...stuecke];
  // Only the places where pieces lie are loaded (Bauplan 3, E4).
  const noetig = new Set(orteMitPunkten(liste, alle.map((p) => p.mid)));
  const regionen = await Promise.all(liste.filter((r) => noetig.has(r.id)).map(async (r) => ({ r, f: await ladeFlaechen(r) })));
  for (const piece of alle) {
    const [x, y] = piece.mid;
    for (const { r, f } of regionen) {
      if (x < r.bbox[0] || x > r.bbox[2] || y < r.bbox[1] || y > r.bbox[3]) continue;
      for (const g of f) {
        if (x < g.bbox[0] || x > g.bbox[2] || y < g.bbox[1] || y > g.bbox[3] || !pointInGeometry(piece.mid, g.geometry)) continue;
        const s = proGebiet.get(g.id) ?? { strasse_m: 0, weg_m: 0 };
        if (piece.kind === "street") s.strasse_m += piece.lengthM * piece.weight;
        else s.weg_m += piece.lengthM * piece.weight;
        const t = zeit?.(piece);
        if (t !== undefined && (s.seit === undefined || t < s.seit)) s.seit = t;
        proGebiet.set(g.id, s);
        jeGebiet?.(g.id, piece);
      }
    }
  }
  return proGebiet;
}
