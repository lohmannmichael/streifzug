import "@fontsource/barlow/400.css";
import "@fontsource/barlow/600.css";
import "@fontsource/barlow-condensed/600.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { hochladenEinrichten } from "./daten/hochladen";
import { importeEntfernen } from "./daten/speicher";
import "./styles.css";

// Large Google imports made the app hang (20.11.2026). They are removed once in the background
// (Michi's wish); "?notfall" removes all imports (Google and GPX) if the app ever hangs again.
const GOOGLE_ENTFERNT = "streifzug.google-importe-entfernt-1";

async function aufraeumen() {
  const notfall = new URLSearchParams(location.search).has("notfall");
  try {
    if (notfall || !localStorage.getItem(GOOGLE_ENTFERNT)) {
      await importeEntfernen("google");
      localStorage.setItem(GOOGLE_ENTFERNT, "1");
    }
    if (notfall) {
      await importeEntfernen("gpx");
      history.replaceState(null, "", "/");
    }
  } catch {
    // Without storage there is nothing to clean up.
  }
}

hochladenEinrichten();

// The page never loads imported data itself (own outings only), so it can start right away;
// the clean-up runs in the background and may take a while with a large Google timeline.
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
void aufraeumen();
