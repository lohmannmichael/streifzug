import { useCallback, useState } from "react";

export interface Einstellungen {
  wegeZaehlen: boolean;
  autoZaehlen: boolean;
}

const KEY = "streifzug.einstellungen";
const STANDARD: Einstellungen = { wegeZaehlen: false, autoZaehlen: false };

function lesen(): Einstellungen {
  try {
    const roh = localStorage.getItem(KEY);
    return roh ? { ...STANDARD, ...(JSON.parse(roh) as Partial<Einstellungen>) } : STANDARD;
  } catch {
    return STANDARD;
  }
}

/** Settings stay on this device for now; they move to the account in Phase 0 (Supabase). */
export function useEinstellungen() {
  const [werte, setWerte] = useState<Einstellungen>(lesen);
  const aendern = useCallback((teil: Partial<Einstellungen>) => {
    setWerte((alt) => {
      const neu = { ...alt, ...teil };
      localStorage.setItem(KEY, JSON.stringify(neu));
      return neu;
    });
  }, []);
  return [werte, aendern] as const;
}
