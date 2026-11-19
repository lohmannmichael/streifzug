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
      <path {...strich} d="M4 6h10M4 12h16M4 18h7" />
      <circle {...strich} cx="18" cy="6" r="2" />
      <circle {...strich} cx="15" cy="18" r="2" />
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
