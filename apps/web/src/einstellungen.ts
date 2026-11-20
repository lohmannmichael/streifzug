import { useCallback, useEffect, useRef, useState } from "react";
import { supabase, type Sitzung } from "./daten/supabase";

export interface Einstellungen {
  wegeZaehlen: boolean;
  autoZaehlen: boolean;
  /** Fog over undiscovered map parts; only on this device. */
  nebel: boolean;
  /** Whether imported histories count (switch per source; the data stays either way). */
  googleZaehlen: boolean;
  gpxZaehlen: boolean;
}

const KEY = "streifzug.einstellungen";
const STANDARD: Einstellungen = { wegeZaehlen: false, autoZaehlen: false, nebel: true, googleZaehlen: true, gpxZaehlen: true };

function lesen(): Einstellungen {
  try {
    const roh = localStorage.getItem(KEY);
    return roh ? { ...STANDARD, ...(JSON.parse(roh) as Partial<Einstellungen>) } : STANDARD;
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
        const neu = { ...aktuell.current, wegeZaehlen: data.count_paths, autoZaehlen: data.count_car };
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
