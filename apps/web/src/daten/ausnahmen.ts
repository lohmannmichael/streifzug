import { useEffect, useState } from "react";
import { KONTO_DATEN, kontoDatenGeaendert } from "./kontoDaten";

/**
 * "Hier komme ich nicht hin" (Bauplan 3.2): street pieces that do not count for you, e.g. a
 * private road. Kept on the device; they leave both the seen meters and the total.
 */
const KEY = "streifzug.ausnahmen";
const GEAENDERT = "streifzug:ausnahmen";

export function ausnahmenLesen(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

export function ausnahmeSetzen(id: string, an: boolean) {
  const alle = new Set(ausnahmenLesen());
  if (an) alle.add(id);
  else alle.delete(id);
  localStorage.setItem(KEY, JSON.stringify([...alle].sort()));
  window.dispatchEvent(new Event(GEAENDERT));
  kontoDatenGeaendert();
}

export function useAusnahmen(): string[] {
  const [liste, setListe] = useState(ausnahmenLesen);
  useEffect(() => {
    const neu = () => setListe(ausnahmenLesen());
    window.addEventListener(GEAENDERT, neu);
    window.addEventListener(KONTO_DATEN, neu);
    return () => {
      window.removeEventListener(GEAENDERT, neu);
      window.removeEventListener(KONTO_DATEN, neu);
    };
  }, []);
  return liste;
}
