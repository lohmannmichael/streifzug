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

export function eineLinieJeStrasse(gelb: readonly Piece[], rot: readonly Piece[], optionen: Partial<LinienAbstaende> = {}): { gelb: Piece[]; rot: Piece[] } {
  const o = { ...LINIEN_STANDARD, ...optionen };
  const erster = gelb[0] ?? rot[0];
  if (!erster) return { gelb: [], rot: [] };
  const mx = M_LAT * Math.cos((erster.mid[1] * Math.PI) / 180);
  const xy = (p: LonLat): XY => [p[0] * mx, p[1] * M_LAT];
  const zelle = MAX_GAP_M.major;
  const schluessel = (p: XY) => `${Math.floor(p[0] / zelle)}:${Math.floor(p[1] / zelle)}`;
  const raster = (liste: readonly Piece[]) => {
    const r = new Map<string, Teil[]>();
    for (const s of liste)
      for (let i = 1; i < s.coords.length; i++) {
        const a = xy(s.coords[i - 1]!);
        const b = xy(s.coords[i]!);
        const k = schluessel([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]);
        (r.get(k) ?? r.set(k, []).get(k)!).push({ stueck: s, a, b });
      }
    return r;
  };
  const strassen = gelb.filter((p) => p.kind === "street");
  const strassenRaster = raster(strassen);

  // Is there a line of `r` beside piece p (not in front or behind), parallel and within maxM?
  // `passt` gets the other piece and on which side it lies: > 0 north (or west), < 0 south (or east).
  const daneben = (p: Piece, r: Map<string, Teil[]>, maxM: number, passt: (q: Piece, seite: number) => boolean) => {
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
        for (const t of r.get(`${cx + dx}:${cy + dy}`) ?? []) {
          if (t.stueck.id === p.id) continue;
          const abstand = seitlich(mitte, t.a, t.b);
          if (abstand === null || abstand > maxM) continue;
          const tm: XY = [(t.a[0] + t.b[0]) / 2, (t.a[1] + t.b[1]) / 2];
          // Left of the east-pointing direction: positive (north, or west for north–south streets).
          const seite = dx0 * (tm[1] - mitte[1]) - dy0 * (tm[0] - mitte[0]);
          if (!passt(t.stueck, seite)) continue;
          let diff = Math.abs(winkel - Math.atan2(t.b[1] - t.a[1], t.b[0] - t.a[0])) % Math.PI;
          diff = Math.min(diff, Math.PI - diff);
          if ((diff * 180) / Math.PI <= o.winkelGrad) return true;
        }
    return false;
  };

  const gezeigt = gelb.filter((p) => {
    if (p.kind === "path") return !daneben(p, strassenRaster, o.wegM, () => true);
    // Two carriageways (weight 0.5 each): the northern (western) one stands for the street.
    if (p.kind === "street" && p.weight < 1) return !daneben(p, strassenRaster, MAX_GAP_M.major, (q, seite) => q.weight < 1 && seite > 0);
    return true;
  });
  const gelbRaster = raster(gezeigt);
  return { gelb: gezeigt, rot: rot.filter((p) => !daneben(p, gelbRaster, o.rotM, () => true)) };
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
