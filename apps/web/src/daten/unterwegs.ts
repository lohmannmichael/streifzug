import type { Piece } from "@streifzug/core";
import { useEffect, useState } from "react";
import { strassenName } from "./strassen";

/** Number of different named streets among the pieces discovered on the current outing. */
export function useNeueStrassen(stuecke: Piece[]): number {
  const [anzahl, setAnzahl] = useState(0);
  const schluessel = stuecke.length;
  useEffect(() => {
    if (stuecke.length === 0) return setAnzahl(0);
    let aktiv = true;
    void Promise.all(stuecke.map(strassenName)).then((namen) => {
      if (aktiv) setAnzahl(new Set(namen.filter(Boolean)).size);
    });
    return () => {
      aktiv = false;
    };
    // Only when new pieces come in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schluessel]);
  return anzahl;
}
