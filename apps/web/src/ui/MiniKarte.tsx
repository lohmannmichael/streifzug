import type { Fix, Piece } from "@streifzug/core";
import { useMemo } from "react";

const M_PRO_GRAD = 111_195;
// Width : height of the mini map; the view always shows at least this many meters across.
const SEITENVERHAELTNIS = 2.2;
const MIN_BREITE_M = 400;

/**
 * Small street plan of one outing, drawn without map tiles: streets around it in grey,
 * what it covered in highlighter yellow (new ones full, known ones lighter), the track in ink.
 */
export function MiniKarte(props: { fixes: Fix[]; umgebung: Piece[]; gesehen: Set<string>; neu: Set<string>; label: string }) {
  const bild = useMemo(() => {
    if (props.fixes.length === 0) return null;
    const lat0 = props.fixes[0]!.lat;
    const mx = M_PRO_GRAD * Math.cos((lat0 * Math.PI) / 180);
    const x = (lon: number) => lon * mx;
    const y = (lat: number) => -lat * M_PRO_GRAD;
    // West/east in x, north/south in y (y grows southwards).
    let [w, o, n, s] = [Infinity, -Infinity, Infinity, -Infinity];
    for (const f of props.fixes) {
      w = Math.min(w, x(f.lon));
      o = Math.max(o, x(f.lon));
      n = Math.min(n, y(f.lat));
      s = Math.max(s, y(f.lat));
    }
    // Some room around the track, then widen to the box's aspect ratio.
    let breite = Math.max(MIN_BREITE_M, (o - w) * 1.25);
    let hoehe = Math.max(breite / SEITENVERHAELTNIS, (s - n) * 1.25);
    breite = Math.max(breite, hoehe * SEITENVERHAELTNIS);
    hoehe = breite / SEITENVERHAELTNIS;
    const cx = (w + o) / 2;
    const cy = (n + s) / 2;
    const box = [cx - breite / 2, cy - hoehe / 2, breite, hoehe] as const;
    const sichtbar = (p: Piece) =>
      p.coords.some(([lon, lat]) => {
        const px = x(lon);
        const py = y(lat);
        return px >= box[0] && px <= box[0] + breite && py >= box[1] && py <= box[1] + hoehe;
      });
    const pfad = (coords: readonly (readonly [number, number])[]) =>
      coords.map(([lon, lat], i) => `${i ? "L" : "M"}${Math.round(x(lon) - box[0])} ${Math.round(y(lat) - box[1])}`).join("");
    // One path per kind keeps the SVG small even with thousands of street pieces.
    let grau = "";
    let bekannt = "";
    let neu = "";
    for (const p of props.umgebung) {
      if (!sichtbar(p)) continue;
      const d = pfad(p.coords);
      if (props.neu.has(p.id)) neu += d;
      else if (props.gesehen.has(p.id)) bekannt += d;
      else grau += d;
    }
    const spur = pfad(props.fixes.map((f) => [f.lon, f.lat] as const));
    return { breite: Math.round(breite), hoehe: Math.round(hoehe), grau, bekannt, neu, spur };
  }, [props.fixes, props.umgebung, props.gesehen, props.neu]);

  if (!bild) return <div className="mini-karte" />;
  return (
    <svg className="mini-karte" viewBox={`0 0 ${bild.breite} ${bild.hoehe}`} preserveAspectRatio="xMidYMid slice" role="img" aria-label={props.label}>
      <path className="mk-grau" d={bild.grau} vectorEffect="non-scaling-stroke" />
      <path className="mk-bekannt" d={bild.bekannt} vectorEffect="non-scaling-stroke" />
      <path className="mk-neu" d={bild.neu} vectorEffect="non-scaling-stroke" />
      <path className="mk-spur" d={bild.spur} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
