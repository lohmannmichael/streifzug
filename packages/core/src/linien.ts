import type { LonLat } from "./geo";
import { MAX_GAP_M } from "./parallel";
import type { Piece } from "./pieces";

/**
 * One line per street on the map (Michi, 22.11.2026): counting already takes every street once,
 * but drawing showed several strokes side by side. Only what is drawn changes:
 * - a path (sidewalk, cycleway) running beside a yellow street is not drawn,
 * - of two yellow carriageways of one street only one is drawn, always the same side (north,
 *   or west for streets running north–south), so the line does not jump between them,
 * - the red pen line is not drawn right beside yellow.
 */
export interface LinienAbstaende {
  /** Sidewalks and cycleways next to the street. */
  wegM: number;
  /** Red beside yellow. */
  rotM: number;
  /** Largest angle between two lines that still count as running side by side. */
  winkelGrad: number;
}

export const LINIEN_STANDARD: LinienAbstaende = { wegM: 18, rotM: 20, winkelGrad: 25 };

const M_LAT = 111_195;
type XY = [number, number];
interface Teil {
  stueck: Piece;
  a: XY;
  b: XY;
}

/**
 * Search among `liste`: does a line run beside piece p (not in front or behind it), roughly
 * parallel and within maxM? `passt` gets the other piece and its side: > 0 north (or west).
 */
function nachbarSuche(liste: readonly Piece[], bezugLat: number, winkelGrad: number) {
  const mx = M_LAT * Math.cos((bezugLat * Math.PI) / 180);
  const xy = (p: LonLat): XY => [p[0] * mx, p[1] * M_LAT];
  const zelle = MAX_GAP_M.major;
  const raster = new Map<string, Teil[]>();
  for (const s of liste)
    for (let i = 1; i < s.coords.length; i++) {
      const a = xy(s.coords[i - 1]!);
      const b = xy(s.coords[i]!);
      const k = `${Math.floor((a[0] + b[0]) / 2 / zelle)}:${Math.floor((a[1] + b[1]) / 2 / zelle)}`;
      (raster.get(k) ?? raster.set(k, []).get(k)!).push({ stueck: s, a, b });
    }
  return (p: Piece, maxM: number, passt: (q: Piece, seite: number) => boolean): boolean => {
    const a = xy(p.coords[0]!);
    const b = xy(p.coords[p.coords.length - 1]!);
    const mitte = xy(p.mid);
    const winkel = Math.atan2(b[1] - a[1], b[0] - a[0]);
    // Mostly east–west: point east (left = north); mostly north–south: point north (left = west).
    let [dx0, dy0] = [b[0] - a[0], b[1] - a[1]];
    if (Math.abs(dx0) >= Math.abs(dy0) ? dx0 < 0 : dy0 < 0) [dx0, dy0] = [-dx0, -dy0];
    const cx = Math.floor(mitte[0] / zelle);
    const cy = Math.floor(mitte[1] / zelle);
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        for (const t of raster.get(`${cx + dx}:${cy + dy}`) ?? []) {
          if (t.stueck.id === p.id) continue;
          const abstand = seitlich(mitte, t.a, t.b);
          if (abstand === null || abstand > maxM) continue;
          let diff = Math.abs(winkel - Math.atan2(t.b[1] - t.a[1], t.b[0] - t.a[0])) % Math.PI;
          diff = Math.min(diff, Math.PI - diff);
          if ((diff * 180) / Math.PI > winkelGrad) continue;
          const tm: XY = [(t.a[0] + t.b[0]) / 2, (t.a[1] + t.b[1]) / 2];
          if (passt(t.stueck, dx0 * (tm[1] - mitte[1]) - dy0 * (tm[0] - mitte[0]))) return true;
        }
    return false;
  };
}

export function eineLinieJeStrasse(gelb: readonly Piece[], rot: readonly Piece[], optionen: Partial<LinienAbstaende> = {}): { gelb: Piece[]; rot: Piece[] } {
  const o = { ...LINIEN_STANDARD, ...optionen };
  const erster = gelb[0] ?? rot[0];
  if (!erster) return { gelb: [], rot: [] };
  const lat = erster.mid[1];
  const strassen = nachbarSuche(
    gelb.filter((p) => p.kind === "street"),
    lat,
    o.winkelGrad,
  );
  const gezeigt = gelb.filter((p) => {
    if (p.kind === "path") return !strassen(p, o.wegM, () => true);
    // Two carriageways (weight 0.5 each): the northern (western) one stands for the street.
    if (p.kind === "street" && p.weight < 1) return !strassen(p, MAX_GAP_M.major, (q, seite) => q.weight < 1 && seite > 0);
    return true;
  });
  const gelbe = nachbarSuche(gezeigt, lat, o.winkelGrad);
  return { gelb: gezeigt, rot: rot.filter((p) => !gelbe(p, o.rotM, () => true)) };
}

/** Perpendicular distance from p to segment a–b, or null if p does not lie beside it. */
function seitlich(p: XY, a: XY, b: XY): number | null {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return null;
  const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2;
  if (t < -0.05 || t > 1.05) return null;
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/**
 * Two carriageways of one street (Michi, 22.11.2026): walking along one of them counts the other
 * too, whichever side. Returns the unseen carriageway pieces lying beside a seen one.
 */
export function fahrbahnenErgaenzen(kandidaten: readonly Piece[], gesehen: ReadonlySet<string>, optionen: Partial<LinienAbstaende> = {}): Set<string> {
  const o = { ...LINIEN_STANDARD, ...optionen };
  const halbe = kandidaten.filter((p) => p.kind === "street" && p.weight < 1);
  const dazu = new Set<string>();
  const erster = halbe[0];
  if (!erster) return dazu;
  const suche = nachbarSuche(halbe.filter((p) => gesehen.has(p.id)), erster.mid[1], o.winkelGrad);
  for (const p of halbe) if (!gesehen.has(p.id) && suche(p, MAX_GAP_M.major, () => true)) dazu.add(p.id);
  return dazu;
}
