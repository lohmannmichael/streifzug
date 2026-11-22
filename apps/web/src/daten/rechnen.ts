import { aktiveFolgen, eckenSchliessen, nachzeichnen, lueckenSchliessen, pointInGeometry, seenByLegs, splitLegs, tileFor, TILE_ZOOM, type Fix, type Piece, type PolygonGeometry } from "@streifzug/core";
import type { Region, Summe } from "./regionen";
import { stueckeDerKachel } from "./strassen";

/**
 * The heavy part of the progress, without React, so it can run in the background worker
 * (abgleich.worker.ts) as well as on the page.
 */

/** Bump when the matching rules change: stored results of older versions are worked out again. */
// 2 (21.11.2026): legs "aktiv"/"gefahren" (Bauplan 6.2), results stored separately.
export const ABGLEICH_VERSION = 8;

interface Flaeche {
  id: string;
  geometry: PolygonGeometry;
  bbox: [number, number, number, number];
}

const flaechen = new Map<string, Promise<Flaeche[]>>();

export function ladeFlaechen(regionId: string): Promise<Flaeche[]> {
  let p = flaechen.get(regionId);
  if (!p) {
    p = fetch(`/regionen/${regionId}/gebiete.geojson`)
      .then((r) => r.json() as Promise<{ features: { properties: { id: string }; geometry: PolygonGeometry }[] }>)
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
export async function abgleichen(fixes: Fix[], locker: boolean): Promise<{ aktiv: Piece[]; gefahren: Piece[] }> {
  const alle: Piece[] = [];
  const aktivIds = new Set<string>();
  const gefahrenIds = new Set<string>();
  for (const k of kachelnFuer([fixes])) {
    const teile = await stueckeDerKachel({ z: TILE_ZOOM, ...k });
    const r = seenByLegs(teile, fixes, locker ? { maxGapM: 60 } : {});
    for (const p of teile) {
      alle.push(p);
      if (r.aktiv.has(p.id)) aktivIds.add(p.id);
      else if (r.gefahren.has(p.id)) gefahrenIds.add(p.id);
    }
  }
  // Corners cut by sparse points, then short white gaps between walked pieces, are closed
  // (only with points walked or cycled, never driven).
  const zuFuss = splitLegs(fixes).filter((l) => l.art === "aktiv").flatMap((l) => l.fixes);
  // Gaps between points traced along the streets, where the way is clear (Michi, 22.11.2026).
  for (const id of nachzeichnen(alle, aktiveFolgen(fixes), aktivIds)) aktivIds.add(id);
  for (const id of eckenSchliessen(alle, aktivIds, zuFuss)) aktivIds.add(id);
  for (const id of lueckenSchliessen(alle, aktivIds)) aktivIds.add(id);
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

/** Seen meters per area id (all levels): every piece counts for each area its middle lies in. */
export async function meterJeGebiet(stuecke: Iterable<Piece>, liste: Region[]): Promise<Map<string, Summe>> {
  const proGebiet = new Map<string, Summe>();
  const regionen = await Promise.all(liste.map(async (r) => ({ r, f: await ladeFlaechen(r.id) })));
  for (const piece of stuecke) {
    const [x, y] = piece.mid;
    for (const { r, f } of regionen) {
      if (x < r.bbox[0] || x > r.bbox[2] || y < r.bbox[1] || y > r.bbox[3]) continue;
      for (const g of f) {
        if (x < g.bbox[0] || x > g.bbox[2] || y < g.bbox[1] || y > g.bbox[3] || !pointInGeometry(piece.mid, g.geometry)) continue;
        const s = proGebiet.get(g.id) ?? { strasse_m: 0, weg_m: 0 };
        if (piece.kind === "street") s.strasse_m += piece.lengthM * piece.weight;
        else s.weg_m += piece.lengthM * piece.weight;
        proGebiet.set(g.id, s);
      }
    }
  }
  return proGebiet;
}
