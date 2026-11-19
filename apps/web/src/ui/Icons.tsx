const strich = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;

export function IconKarte() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      <path {...strich} d="M9 4 3 6.5v13L9 17l6 2.5 6-2.5V4l-6 2.5L9 4Zm0 0v13m6-10.5v13" />
    </svg>
  );
}

export function IconGebiete() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      <rect {...strich} x="4" y="4" width="7" height="7" rx="1.5" />
      <rect {...strich} x="13" y="4" width="7" height="7" rx="1.5" />
      <rect {...strich} x="4" y="13" width="7" height="7" rx="1.5" />
      <rect {...strich} x="13" y="13" width="7" height="7" rx="1.5" />
    </svg>
  );
}

export function IconStreifzuege() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      <path {...strich} d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4Zm0 13a3 3 0 0 1 3-3h11" />
    </svg>
  );
}

export function IconIch() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      <circle {...strich} cx="12" cy="8.5" r="3.5" />
      <path {...strich} d="M5 20c1.2-3.5 3.8-5.5 7-5.5s5.8 2 7 5.5" />
    </svg>
  );
}

export function IconZurueck() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      <path {...strich} d="M15 5 8 12l7 7" />
    </svg>
  );
}

export function IconStandort() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      <path {...strich} d="M20 4 4 11l7 2 2 7 7-16Z" />
    </svg>
  );
}
