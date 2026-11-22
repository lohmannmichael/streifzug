// Few icons (Bauplan 4.1): location arrow, Pass (a small booklet), back, close.
const strich = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;

export function IconStandort() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      <path {...strich} d="M20 4 4 11l7 2 2 7 7-16Z" />
    </svg>
  );
}

export function IconMehr() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      <circle cx="5.5" cy="12" r="1.7" fill="currentColor" />
      <circle cx="12" cy="12" r="1.7" fill="currentColor" />
      <circle cx="18.5" cy="12" r="1.7" fill="currentColor" />
    </svg>
  );
}

export function IconSchliessen() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      <path {...strich} d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

/** The Pass: a small booklet (Bauplan 3, D1). */
export function IconPass() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      <path {...strich} d="M6.5 3.5h11a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1h-11a1.5 1.5 0 0 1-1.5-1.5v-14a1.5 1.5 0 0 1 1.5-1.5Z" />
      <circle {...strich} cx="12" cy="10.5" r="3" />
      <path {...strich} d="M9 16.5h6" />
    </svg>
  );
}

export function IconZurueck() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      <path {...strich} d="M15 5l-7 7 7 7" />
    </svg>
  );
}
