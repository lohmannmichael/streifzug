import type { Korrektur } from "@streifzug/core";
import { useEffect, useState } from "react";
import { KONTO_DATEN, kontoDatenGeaendert } from "./kontoDaten";

/**
 * Corrected legs (Bauplan 3, C2): "war zu Fuß / Rad / gefahren", per way. Kept on the device and
 * in the account (`user_state.korrekturen`); the raw points stay untouched. Only the corrected way
 * is calculated again (its stored result carries a fingerprint of its corrections).
 */
type Korrekturen = Record<string, Korrektur[]>;

const KEY = "streifzug.korrekturen";
const GEAENDERT = "streifzug:korrekturen";

function korrekturenLesen(): Korrekturen {
  try {
    return (JSON.parse(localStorage.getItem(KEY) ?? "{}") as Korrekturen) ?? {};
  } catch {
    return {};
  }
}

/** Sets (or replaces) the correction for one leg of a way. */
export function korrekturSetzen(weg: string, k: Korrektur) {
  const alle = korrekturenLesen();
  const liste = (alle[weg] ?? []).filter((x) => !(Math.abs(x.von - k.von) < 1000 && Math.abs(x.bis - k.bis) < 1000));
  alle[weg] = [...liste, k].sort((a, b) => a.von - b.von);
  localStorage.setItem(KEY, JSON.stringify(alle));
  window.dispatchEvent(new Event(GEAENDERT));
  kontoDatenGeaendert();
}

/** Takes a correction back: the recognition decides again. */
export function korrekturEntfernen(weg: string, von: number) {
  const alle = korrekturenLesen();
  alle[weg] = (alle[weg] ?? []).filter((x) => Math.abs(x.von - von) >= 1000);
  if (alle[weg]!.length === 0) delete alle[weg];
  localStorage.setItem(KEY, JSON.stringify(alle));
  window.dispatchEvent(new Event(GEAENDERT));
  kontoDatenGeaendert();
}

export function useKorrekturen(): Korrekturen {
  const [k, setK] = useState(korrekturenLesen);
  useEffect(() => {
    const neu = () => setK(korrekturenLesen());
    window.addEventListener(GEAENDERT, neu);
    window.addEventListener(KONTO_DATEN, neu);
    return () => {
      window.removeEventListener(GEAENDERT, neu);
      window.removeEventListener(KONTO_DATEN, neu);
    };
  }, []);
  return k;
}
