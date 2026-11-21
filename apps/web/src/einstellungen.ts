import { useCallback, useEffect, useRef, useState } from "react";
import { supabase, type Sitzung } from "./daten/supabase";

export interface Einstellungen {
  wegeZaehlen: boolean;
  autoZaehlen: boolean;
  /** Whether imported histories count (switch per source; the data stays either way). */
  gpxZaehlen: boolean;
  overlandZaehlen: boolean;
  /** Pens (Bauplan 4.2): highlighter for walked streets, pen for driven ones. */
  marker: string;
  kuli: string;
  /** Each street keeps the highlighter colour of the year it was first walked. */
  jahresFarben: boolean;
}

export const MARKER_FARBEN = [
  { farbe: "#ffe83a", name: "Gelb" },
  { farbe: "#b8f060", name: "Grün" },
  { farbe: "#ff9bcb", name: "Pink" },
  { farbe: "#ffb95a", name: "Orange" },
  { farbe: "#7de6d9", name: "Türkis" },
] as const;

export const KULI_FARBEN = [
  { farbe: "#d92b20", name: "Rot" },
  { farbe: "#2447c9", name: "Blau" },
  { farbe: "#1f7a4d", name: "Grün" },
  { farbe: "#1c1c1c", name: "Schwarz" },
] as const;

/** Year colours: 2026 yellow, 2027 green, … and from the start again (earlier years backwards). */
export const ERSTES_JAHR = 2026;
export function jahresFarbe(jahr: number): (typeof MARKER_FARBEN)[number] {
  const n = MARKER_FARBEN.length;
  return MARKER_FARBEN[(((jahr - ERSTES_JAHR) % n) + n) % n]!;
}

/** The highlighter colour in use now (the year's colour with "Jedes Jahr eine Farbe"). */
export const markerJetzt = (e: Einstellungen) => (e.jahresFarben ? jahresFarbe(new Date().getFullYear()).farbe : e.marker);

const KEY = "streifzug.einstellungen";
const STANDARD: Einstellungen = {
  wegeZaehlen: false,
  autoZaehlen: false,
  gpxZaehlen: true,
  overlandZaehlen: true,
  marker: "#ffe83a",
  kuli: "#d92b20",
  jahresFarben: false,
};

function lesen(): Einstellungen {
  try {
    const roh = localStorage.getItem(KEY);
    // Paths and car rides no longer count (Bauplan 6.1/6.2): the old switches are ignored.
    return roh ? { ...STANDARD, ...(JSON.parse(roh) as Partial<Einstellungen>), wegeZaehlen: false, autoZaehlen: false } : STANDARD;
  } catch {
    return STANDARD;
  }
}

/** Local first: the device copy is shown at once, the account copy is loaded and saved in the background. */
export function useEinstellungen(sitzung: Sitzung) {
  const [werte, setWerte] = useState<Einstellungen>(lesen);
  const aktuell = useRef(werte);
  aktuell.current = werte;
  const userId = sitzung.status === "bereit" ? sitzung.session.user.id : null;

  useEffect(() => {
    if (!userId) return;
    let aktiv = true;
    supabase
      .from("user_settings")
      .select("count_paths, count_car")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!aktiv || !data) return;
        const neu = { ...aktuell.current, wegeZaehlen: false, autoZaehlen: false };
        localStorage.setItem(KEY, JSON.stringify(neu));
        setWerte(neu);
      });
    return () => {
      aktiv = false;
    };
  }, [userId]);

  const aendern = useCallback(
    (teil: Partial<Einstellungen>) => {
      const neu = { ...aktuell.current, ...teil };
      aktuell.current = neu;
      setWerte(neu);
      localStorage.setItem(KEY, JSON.stringify(neu));
      if (!userId) return;
      // Supabase queries only run when awaited or then'd.
      supabase
        .from("user_settings")
        .upsert({ user_id: userId, count_paths: neu.wegeZaehlen, count_car: neu.autoZaehlen, updated_at: new Date().toISOString() })
        .then(({ error }) => {
          if (error) console.warn("Einstellungen nicht gesichert, bleiben auf dem Gerät.", error.message);
        });
    },
    [userId],
  );

  return [werte, aendern] as const;
}
