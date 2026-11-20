import { pointInGeometry, seenPieceIds, tileFor, TILE_ZOOM, type Fix, type Piece, type PolygonGeometry } from "@streifzug/core";
import { useEffect, useRef, useState } from "react";
import type { Regionen, Summe } from "./regionen";
import { stueckeDerKachel } from "./strassen";

export interface Fortschritt {
  /** Seen pieces, for the yellow layer. */
  stuecke: Piece[];
  /** Seen meters per area id (streets and paths separately). */
  proGebiet: Map<string, Summe>;
}

interface Flaeche {
  id: string;
  geometry: PolygonGeometry;
  bbox: [number, number, number, number];
}

const flaechen = new Map<string, Promise<Flaeche[]>>();

function ladeFlaechen(regionId: string): Promise<Flaeche[]> {
  let p = flaechen.get(regionId);
  if (!p) {
    p = fetch(`/regionen/${regionId}/gebiete.geojson`)
      .then((r) => r.json() as Promise<{ features: { properties: { id: string }; geometry: PolygonGeometry }[] }>)
      .then((d) =>
        d.features.map((f) => {
          const rings = f.geometry.type === "Polygon" ? f.geometry.coordinates : f.geometry.coordinates.flat();
          const pts = rings.flat();
          const xs = pts.map((q) => q[0]);
          const ys = pts.map((q) => q[1]);
          return { id: String(f.properties.id), geometry: f.geometry, bbox: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] as [number, number, number, number] };
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

/**
 * What you have seen: matches all outings against the street pieces around them (on the device),
 * then adds the seen meters to every area (all levels) that contains a piece.
 */
export async function berechne(spuren: Fix[][], daten: Regionen): Promise<Fortschritt> {
  const gesehen = new Map<string, Piece>();
  for (const k of kachelnFuer(spuren)) {
    const stuecke = await stueckeDerKachel({ z: TILE_ZOOM, ...k });
    const nachId = new Map(stuecke.map((s) => [s.id, s]));
    for (const spur of spuren) for (const id of seenPieceIds(stuecke, spur)) gesehen.set(id, nachId.get(id)!);
  }
  const proGebiet = await meterJeGebiet(gesehen.values(), daten);
  return { stuecke: [...gesehen.values()], proGebiet };
}

/** Seen meters per area id (all levels): every piece counts for each area its middle lies in. */
export async function meterJeGebiet(stuecke: Iterable<Piece>, daten: Regionen): Promise<Map<string, Summe>> {
  const proGebiet = new Map<string, Summe>();
  const regionen = await Promise.all(daten.liste.map(async (r) => ({ r, f: await ladeFlaechen(r.id) })));
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

/** Keeps the progress up to date while outings are added and while recording (every 10 new fixes). */
export function useFortschritt(spuren: Fix[][], daten: Regionen | null): Fortschritt | null {
  const [fortschritt, setFortschritt] = useState<Fortschritt | null>(null);
  const anzahl = spuren.reduce((n, s) => n + s.length, 0);
  const schluessel = `${spuren.length}:${Math.floor(anzahl / 10)}`;
  const nr = useRef(0);
  useEffect(() => {
    if (!daten) return;
    const meine = ++nr.current;
    void berechne(spuren, daten).then((f) => {
      if (meine === nr.current) setFortschritt(f);
    });
    // Recalculate only when the set of outings changes or the live track grows.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schluessel, daten]);
  return fortschritt;
}

/** The smallest area (Stadtteil) that contains a point, or null outside all regions. */
export async function gebietAn(punkt: [number, number], daten: Regionen): Promise<string | null> {
  const [x, y] = punkt;
  for (const r of daten.liste) {
    if (x < r.bbox[0] || x > r.bbox[2] || y < r.bbox[1] || y > r.bbox[3]) continue;
    for (const g of await ladeFlaechen(r.id)) {
      if (x < g.bbox[0] || x > g.bbox[2] || y < g.bbox[1] || y > g.bbox[3]) continue;
      if ((daten.gebiete.get(g.id)?.kinder.length ?? 1) === 0 && pointInGeometry(punkt, g.geometry)) return g.id;
    }
  }
  return null;
}
