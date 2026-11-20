import { nearestUnseen, type LonLat, type Spot } from "@streifzug/core";
import { useEffect, useMemo, useState } from "react";
import type { Fortschritt } from "./fortschritt";
import { strassenName, stueckeUm } from "./strassen";

export interface Fleck extends Spot {
  name: string | null;
  /** The whole undiscovered stretch of that street line (same line in the same tile), for the map. */
  linien: LonLat[][];
}

/**
 * "Weißer Fleck in der Nähe": the nearest street that counts and is still undiscovered,
 * within 1.5 km of a point (own position or the middle of the chosen area).
 */
export function useWeisserFleck(bezug: LonLat | null, fortschritt: Fortschritt | null, wege: boolean): Fleck | null {
  const [fleck, setFleck] = useState<Fleck | null>(null);
  const gesehen = useMemo(() => new Set((fortschritt?.stuecke ?? []).map((p) => p.id)), [fortschritt]);
  // Round the point to about 50 m, so small GPS jitter does not search again.
  const schluessel = bezug ? `${bezug[0].toFixed(3)},${bezug[1].toFixed(3)}` : "";
  useEffect(() => {
    if (!bezug) return setFleck(null);
    let aktiv = true;
    void stueckeUm(bezug).then(async (stuecke) => {
      const treffer = nearestUnseen(stuecke, gesehen, bezug, { paths: wege });
      const name = treffer ? await strassenName(treffer.piece) : null;
      const linie = treffer?.piece.id.split(":").slice(0, 2).join(":");
      const linien = treffer ? stuecke.filter((p) => p.id.startsWith(`${linie}:`) && !gesehen.has(p.id)).map((p) => [...p.coords]) : [];
      if (aktiv) setFleck(treffer ? { ...treffer, name, linien } : null);
    });
    return () => {
      aktiv = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schluessel, gesehen, wege]);
  return fleck;
}
