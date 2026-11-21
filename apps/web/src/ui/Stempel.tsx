import type { Stempel as StempelDaten } from "@streifzug/core";
import { useId } from "react";
import { t } from "../texte/de";

const datumKurz = new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });

/** Ink by kind (Bauplan 4.6): Veedel percent blue, entered black, exploring red. */
const TINTE: Record<StempelDaten["art"], string> = {
  prozent: "#24388f",
  betreten: "#1c1c1c",
  "veedel-anzahl": "#c42b22",
  "strassen-komplett": "#c42b22",
  "bezirk-rundum": "#c42b22",
  "stadt-rundum": "#c42b22",
  "km-neu": "#c42b22",
};

export interface StempelProps {
  stempel: StempelDaten;
  /** Name of the area the stamp belongs to (Veedel, district or city). */
  gebietName: string;
  /** Name of the city above it, for "KÖLN-WEIDEN". */
  stadtName?: string | undefined;
  datum: number;
  groesse?: number;
  drehung?: number;
}

/**
 * A rubber stamp drawn in SVG, with ink: a noise filter roughens the edges and a second, coarse
 * noise makes the ink uneven (30–100 %). Four shapes: circle (Veedel percent), rectangle with a
 * date line (Veedel entered), octagon (number of Veedel), circle with text around (the rest).
 */
export function Stempel({ stempel: s, gebietName, stadtName, datum, groesse = 120, drehung = 0 }: StempelProps) {
  const id = useId().replace(/:/g, "");
  const farbe = TINTE[s.art];
  const seed = [...s.id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 997, 3);
  const name = (stadtName && stadtName !== gebietName ? `${stadtName}-${gebietName}` : gebietName).toUpperCase();
  const tag = datumKurz.format(datum);

  let form;
  if (s.art === "prozent") {
    form = (
      <>
        <circle cx="60" cy="60" r="54" fill="none" stroke={farbe} strokeWidth="4" />
        <circle cx="60" cy="60" r="46" fill="none" stroke={farbe} strokeWidth="1.6" />
        <path id={`${id}-o`} d="M 20 60 A 40 40 0 0 1 100 60" fill="none" />
        <path id={`${id}-u`} d="M 22 60 A 38 38 0 0 0 98 60" fill="none" />
        <text fontSize={name.length > 16 ? 8 : 9.5} fontWeight="700" letterSpacing="1" fill={farbe} textAnchor="middle">
          <textPath href={`#${id}-o`} startOffset="50%">{name}</textPath>
        </text>
        <text x="60" y="69" fontSize="27" fontWeight="800" fill={farbe} textAnchor="middle">{s.stufe} %</text>
        <text fontSize="8.5" fontWeight="600" letterSpacing="1" fill={farbe} textAnchor="middle" dy="7">
          <textPath href={`#${id}-u`} startOffset="50%">{tag}</textPath>
        </text>
      </>
    );
  } else if (s.art === "betreten") {
    form = (
      <>
        <rect x="6" y="28" width="108" height="64" rx="3" fill="none" stroke={farbe} strokeWidth="3.5" />
        <text x="60" y="52" fontSize={gebietName.length > 12 ? 11 : 14} fontWeight="800" letterSpacing="1" fill={farbe} textAnchor="middle">{gebietName.toUpperCase()}</text>
        <text x="60" y="66" fontSize="8.5" fontWeight="700" letterSpacing="2" fill={farbe} textAnchor="middle">{t.stempel.betreten}</text>
        <line x1="14" y1="74" x2="106" y2="74" stroke={farbe} strokeWidth="1.4" />
        <text x="60" y="86" fontSize="9" fontWeight="600" letterSpacing="1" fill={farbe} textAnchor="middle">{tag}</text>
      </>
    );
  } else if (s.art === "veedel-anzahl") {
    form = (
      <>
        <polygon points="38,6 82,6 114,38 114,82 82,114 38,114 6,82 6,38" fill="none" stroke={farbe} strokeWidth="4" />
        <text x="60" y="64" fontSize="34" fontWeight="800" fill={farbe} textAnchor="middle">{s.stufe}</text>
        <text x="60" y="82" fontSize="10" fontWeight="700" letterSpacing="2" fill={farbe} textAnchor="middle">{t.stempel.veedel}</text>
        <text x="60" y="97" fontSize="7.5" fontWeight="600" letterSpacing="1" fill={farbe} textAnchor="middle">{tag}</text>
      </>
    );
  } else {
    const umschrift =
      s.art === "strassen-komplett"
        ? t.stempel.strassenKomplett
        : s.art === "km-neu"
          ? t.stempel.kmNeu
          : `${gebietName.toUpperCase()} ${t.stempel.rundum}`;
    const mitte = s.art === "strassen-komplett" ? String(s.stufe) : s.art === "km-neu" ? `${s.stufe} km` : t.stempel.alle;
    form = (
      <>
        <circle cx="60" cy="60" r="54" fill="none" stroke={farbe} strokeWidth="3" />
        <circle cx="60" cy="60" r="36" fill="none" stroke={farbe} strokeWidth="2" />
        <path id={`${id}-r`} d="M 60 14 A 46 46 0 1 1 59.9 14" fill="none" />
        <text fontSize="9" fontWeight="700" fill={farbe} textLength="282" lengthAdjust="spacing">
          <textPath href={`#${id}-r`}>{`${umschrift} · ${tag} ·`}</textPath>
        </text>
        <text x="60" y="66" fontSize={mitte.length > 5 ? 13 : 20} fontWeight="800" fill={farbe} textAnchor="middle">{mitte}</text>
      </>
    );
  }

  return (
    <svg
      className="stempel-svg"
      width={groesse}
      height={groesse}
      viewBox="0 0 120 120"
      role="img"
      aria-label={t.stempel.label(gebietName, s.art, s.stufe)}
      style={{ transform: `rotate(${drehung}deg)` }}
    >
      <defs>
        <filter id={`${id}-tinte`} x="-10" y="-10" width="140" height="140" filterUnits="userSpaceOnUse">
          <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="2" seed={seed} result="fein" />
          <feDisplacementMap in="SourceGraphic" in2="fein" scale="2.4" xChannelSelector="R" yChannelSelector="G" result="rau" />
          <feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="2" seed={seed + 1} result="grob" />
          <feColorMatrix in="grob" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 2.4 -0.25" result="maske" />
          <feComposite in="rau" in2="maske" operator="in" />
        </filter>
      </defs>
      <g filter={`url(#${id}-tinte)`} fontFamily="'Archivo Variable', Archivo, sans-serif" style={{ fontStretch: "88%" }}>
        {form}
      </g>
    </svg>
  );
}
