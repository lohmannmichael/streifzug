/**
 * Drawing ways nicer (Michi, 25.11.2026: "smoother, nicht 100 % auf die GPS-Daten berufen").
 * Only for drawing: counting stays with the matching. Step A: smoothing.
 */
import type { LonLat } from "./geo";

/** Width of the smoothing (m): GPS wobble of a few meters goes, real corners stay. */
const SIGMA_M = 9;
/** A point that jumps away further than this and comes straight back is a GPS spike. */
const SPRUNG_M = 15;

/** Local meters around the first point (good enough for a few kilometres). */
function lokal(coords: readonly LonLat[]) {
  const [x0, y0] = coords[0]!;
  const kx = 111_320 * Math.cos((y0 * Math.PI) / 180);
  const ky = 110_540;
  return {
    hin: coords.map(([x, y]) => [(x - x0) * kx, (y - y0) * ky] as [number, number]),
    zurueck: ([x, y]: [number, number]): LonLat => [x0 + x / kx, y0 + y / ky],
  };
}

/**
 * Smoothed copy of a way, same number of points (so per-point marks like "driven" still fit),
 * same ends: single spikes out and back are taken out, then each point becomes a weighted mean
 * of its neighbours within a few meters along the way.
 */
export function glaetten(coords: readonly LonLat[]): LonLat[] {
  const n = coords.length;
  if (n < 3) return [...coords];
  const { hin, zurueck } = lokal(coords);
  const d = (a: [number, number], b: [number, number]) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  // Spikes: far from both neighbours while the neighbours are close to each other.
  const p = hin.map((q) => [...q] as [number, number]);
  for (let i = 1; i < n - 1; i++) {
    const a = p[i - 1]!;
    const b = hin[i]!;
    const c = hin[i + 1]!;
    const ab = d(a, b);
    const bc = d(b, c);
    if (ab > SPRUNG_M && bc > SPRUNG_M && d(a, c) < 0.5 * Math.min(ab, bc)) p[i] = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2];
  }
  // Distance along the way.
  const s = [0];
  for (let i = 1; i < n; i++) s.push(s[i - 1]! + d(p[i - 1]!, p[i]!));
  const out: LonLat[] = [coords[0]!];
  let von = 0;
  for (let i = 1; i < n - 1; i++) {
    while (s[i]! - s[von]! > 3 * SIGMA_M) von++;
    // Near the ends the window shrinks, so the line runs into its ends.
    const breite = Math.min(SIGMA_M, (s[i]! - s[0]!) / 2 + 0.01, (s[n - 1]! - s[i]!) / 2 + 0.01);
    let [sx, sy, sw] = [0, 0, 0];
    for (let j = von; j < n && s[j]! - s[i]! <= 3 * SIGMA_M; j++) {
      const w = Math.exp(-((s[j]! - s[i]!) ** 2) / (2 * breite * breite));
      sx += p[j]![0] * w;
      sy += p[j]![1] * w;
      sw += w;
    }
    out.push(zurueck([sx / sw, sy / sw]));
  }
  out.push(coords[n - 1]!);
  return out;
}

/** Snap fully within this distance of a seen street, not at all beyond FANG_BIS_M. */
const FANG_VOLL_M = 10;
const FANG_BIS_M = 20;
/** The way must run roughly along the street (at most this angle). */
const WINKEL_GRAD = 35;
/** Grid for finding nearby streets quickly (degrees). */
const ZELLE = 0.0005;
/** Points on each side over which the snapping fades in and out. */
const UEBERGANG = 2;
/** Step C2: a crossing at most this far from the last point on one street and the first on the next. */
const ECKE_M = 30;
/** At most this many points between them (GPS cutting the corner). */
const ECKE_PUNKTE = 4;

/**
 * Step C1 (Michi, 25.11.2026): where the way clearly runs along a seen street, it is drawn on the
 * street's middle; elsewhere (parks, squares, fields, car rides) it stays as it is. The change fades
 * in and out over a few points, so there is no jump. Same number of points.
 */
export function aufStrassen(coords: readonly LonLat[], strassen: readonly { coords: readonly LonLat[] }[], gefahren?: readonly boolean[]): LonLat[] {
  return einraster(strassen)(coords, gefahren);
}

type Seg = [number, number, number, number];

/** The streets sorted once into a grid; the result snaps any number of ways. */
export function einraster(strassen: readonly { coords: readonly LonLat[] }[]): (coords: readonly LonLat[], gefahren?: readonly boolean[]) => LonLat[] {
  const zellen = new Map<string, Seg[]>();
  const schluessel = (x: number, y: number) => `${Math.floor(x / ZELLE)},${Math.floor(y / ZELLE)}`;
  for (const s of strassen) {
    for (let i = 1; i < s.coords.length; i++) {
      const a = s.coords[i - 1]!;
      const b = s.coords[i]!;
      const seg: Seg = [a[0], a[1], b[0], b[1]];
      const rand = ZELLE / 2;
      for (let x = Math.min(a[0], b[0]) - rand; x <= Math.max(a[0], b[0]) + rand + ZELLE; x += ZELLE)
        for (let y = Math.min(a[1], b[1]) - rand; y <= Math.max(a[1], b[1]) + rand + ZELLE; y += ZELLE) {
          const k = schluessel(x, y);
          const liste = zellen.get(k);
          if (liste) liste.push(seg);
          else zellen.set(k, [seg]);
        }
    }
  }
  const cosMin = Math.cos((WINKEL_GRAD * Math.PI) / 180);
  return (coords, gefahren) => {
    const n = coords.length;
    if (n < 2 || zellen.size === 0) return [...coords];
    const [x0, y0] = coords[0]!;
    const kx = 111_320 * Math.cos((y0 * Math.PI) / 180);
    const ky = 110_540;
    const m = (x: number, y: number): [number, number] => [(x - x0) * kx, (y - y0) * ky];
    const punkte = coords.map(([x, y]) => m(x, y));
    const ziel: ([number, number] | null)[] = [];
    const strecke: ([number, number, number, number] | null)[] = [];
    const gewicht: number[] = [];
    for (let i = 0; i < n; i++) {
      if (gefahren?.[i]) {
        ziel.push(null);
        strecke.push(null);
        gewicht.push(0);
        continue;
      }
      const p = punkte[i]!;
      // Direction of travel coming in and going out (at a corner one of them fits the street).
      const v = punkte[Math.max(0, i - 2)]!;
      const h = punkte[Math.min(n - 1, i + 2)]!;
      const richtungen = [
        [p[0] - v[0], p[1] - v[1]],
        [h[0] - p[0], h[1] - p[1]],
      ].filter(([x, y]) => Math.hypot(x!, y!) > 3) as [number, number][];
      let best: { d: number; q: [number, number]; seg: [number, number, number, number] } | null = null;
      const gesehen = new Set<Seg>();
      const [cx, cy] = coords[i]!;
      for (const dx of [-1, 0, 1])
        for (const dy of [-1, 0, 1]) {
          for (const seg of zellen.get(schluessel(cx + dx * ZELLE, cy + dy * ZELLE)) ?? []) {
            if (gesehen.has(seg)) continue;
            gesehen.add(seg);
            const [ax, ay] = m(seg[0], seg[1]);
            const [bx, by] = m(seg[2], seg[3]);
            const [sx, sy] = [bx - ax, by - ay];
            const sl = Math.hypot(sx, sy);
            if (sl < 0.01) continue;
            if (richtungen.length > 0 && !richtungen.some(([rx, ry]) => Math.abs((rx * sx + ry * sy) / (Math.hypot(rx, ry) * sl)) >= cosMin)) continue;
            const t = Math.max(0, Math.min(1, ((p[0] - ax) * sx + (p[1] - ay) * sy) / (sl * sl)));
            const q: [number, number] = [ax + t * sx, ay + t * sy];
            const d = Math.hypot(p[0] - q[0], p[1] - q[1]);
            if (d < FANG_BIS_M && (!best || d < best.d)) best = { d, q, seg: [ax, ay, bx, by] };
          }
        }
      ziel.push(best ? best.q : null);
      strecke.push(best ? best.seg : null);
      gewicht.push(best ? Math.max(0, Math.min(1, (FANG_BIS_M - best.d) / (FANG_BIS_M - FANG_VOLL_M))) : 0);
    }
    // Fade in and out: each weight at most what its neighbours allow, ramping over a few points.
    const weich = gewicht.map((w, i) => {
      let g = w;
      for (let k = 1; k <= UEBERGANG; k++) {
        const f = k / (UEBERGANG + 1);
        if (i - k >= 0) g = Math.min(g, gewicht[i - k]! + f);
        if (i + k < n) g = Math.min(g, gewicht[i + k]! + f);
      }
      return g;
    });
    const aus: [number, number][] = punkte.map((p, i) => {
      const q = ziel[i];
      const w = weich[i]!;
      return q && w > 0 ? [p[0] + (q[0] - p[0]) * w, p[1] + (q[1] - p[1]) * w] : p;
    });
    ecken(aus, strecke, weich);
    return aus.map(([x, y], i) => (aus[i] === punkte[i] ? coords[i]! : [x0 + x / kx, y0 + y / ky]));
  };
}

/**
 * Step C2: where the way goes from one street onto another (fully snapped on both sides, the
 * streets not parallel), it turns exactly at their crossing instead of cutting the corner. The
 * points in between are laid along the two legs; if there are none, the nearer one moves onto the
 * crossing. Same number of points.
 */
function ecken(aus: [number, number][], strecke: readonly (Seg | null)[], weich: readonly number[]) {
  const voll = (i: number) => weich[i]! >= 0.99 && strecke[i] !== null;
  let i = 0;
  while (i < aus.length - 1) {
    if (!voll(i)) {
      i++;
      continue;
    }
    // The next fully snapped point after i, with at most ECKE_PUNKTE in between.
    let j = i + 1;
    while (j < aus.length && j - i - 1 <= ECKE_PUNKTE && !voll(j)) j++;
    if (j >= aus.length || !voll(j) || j - i - 1 > ECKE_PUNKTE) {
      i = j;
      continue;
    }
    const s1 = strecke[i]!;
    const s2 = strecke[j]!;
    const x = s1 === s2 ? null : kreuzung(s1, s2);
    const a = aus[i]!;
    const b = aus[j]!;
    if (x && Math.hypot(x[0] - a[0], x[1] - a[1]) <= ECKE_M && Math.hypot(x[0] - b[0], x[1] - b[1]) <= ECKE_M) {
      const zwischen = j - i - 1;
      if (zwischen === 0) {
        // Move the nearer of the two onto the crossing.
        const k = Math.hypot(x[0] - a[0], x[1] - a[1]) <= Math.hypot(x[0] - b[0], x[1] - b[1]) ? i : j;
        aus[k] = x;
      } else {
        // Lay the points in between along a → crossing → b.
        const l1 = Math.hypot(x[0] - a[0], x[1] - a[1]);
        const l2 = Math.hypot(b[0] - x[0], b[1] - x[1]);
        for (let k = 1; k <= zwischen; k++) {
          const t = ((l1 + l2) * k) / (zwischen + 1);
          aus[i + k] = t <= l1 ? [a[0] + ((x[0] - a[0]) * t) / (l1 || 1), a[1] + ((x[1] - a[1]) * t) / (l1 || 1)] : [x[0] + ((b[0] - x[0]) * (t - l1)) / (l2 || 1), x[1] + ((b[1] - x[1]) * (t - l1)) / (l2 || 1)];
        }
        // The point nearest the crossing exactly on it.
        let naechster = i + 1;
        for (let k = i + 1; k < j; k++) if (Math.hypot(aus[k]![0] - x[0], aus[k]![1] - x[1]) < Math.hypot(aus[naechster]![0] - x[0], aus[naechster]![1] - x[1])) naechster = k;
        aus[naechster] = x;
      }
    }
    i = j;
  }
}

/** Crossing of the lines through two segments (local meters), unless they run nearly parallel. */
function kreuzung(s1: Seg, s2: Seg): [number, number] | null {
  const [ax, ay, bx, by] = s1;
  const [cx, cy, dx, dy] = s2;
  const r = [bx - ax, by - ay];
  const q = [dx - cx, dy - cy];
  const kreuz = r[0]! * q[1]! - r[1]! * q[0]!;
  if (Math.abs(kreuz) < Math.sin((25 * Math.PI) / 180) * Math.hypot(r[0]!, r[1]!) * Math.hypot(q[0]!, q[1]!)) return null;
  const t = ((cx - ax) * q[1]! - (cy - ay) * q[0]!) / kreuz;
  return [ax + t * r[0]!, ay + t * r[1]!];
}
