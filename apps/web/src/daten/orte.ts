import { useEffect, useMemo, useState } from "react";
import type { Draussen } from "./abgleich.worker";
import { fragen } from "./arbeiter";
import { supabase } from "./supabase";

/**
 * Places walked in that have no region yet (Bauplan 3.3 "Neuer Ort ohne Daten"). The points are
 * kept and drawn; the place is reported as a wish, prepared later, and then counted.
 */
export interface FremderOrt {
  name: string;
  m: number;
  seit: number;
  punkt: [number, number];
}

const NAMEN = "streifzug.ortsnamen";
const GEMELDET = "streifzug.orte-gemeldet";

function lesen<T>(key: string, leer: T): T {
  try {
    return (JSON.parse(localStorage.getItem(key) ?? "null") as T | null) ?? leer;
  } catch {
    return leer;
  }
}

export function useFremdeOrte(draussen: Draussen[] | undefined, userId: string | null): FremderOrt[] {
  const [namen, setNamen] = useState<Record<string, string>>(() => lesen(NAMEN, {}));
  const zellen = draussen ?? [];
  // Look up names for new cells (once per cell, kept on the device).
  useEffect(() => {
    const fehlen = zellen.filter((z) => namen[z.zelle] === undefined);
    if (fehlen.length === 0 || !navigator.onLine) return;
    let lebt = true;
    void (async () => {
      const neu = { ...namen };
      for (const z of fehlen.slice(0, 20)) {
        const a = await fragen<"ortsName">({ typ: "ortsName", punkt: z.punkt }).antwort;
        if (a.name) neu[z.zelle] = a.name;
      }
      if (!lebt) return;
      localStorage.setItem(NAMEN, JSON.stringify(neu));
      setNamen(neu);
    })();
    return () => {
      lebt = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zellen.map((z) => z.zelle).join("|")]);

  const orte = useMemo(() => {
    const jeName = new Map<string, FremderOrt>();
    for (const z of zellen) {
      const name = namen[z.zelle];
      if (!name) continue;
      const e = jeName.get(name) ?? { name, m: 0, seit: z.seit, punkt: z.punkt };
      e.m += z.m;
      e.seit = Math.min(e.seit, z.seit);
      jeName.set(name, e);
    }
    return [...jeName.values()].sort((a, b) => b.m - a.m);
  }, [zellen, namen]);

  // Report each place once as a wish (the meters are updated when they grew by a lot).
  useEffect(() => {
    if (!userId || orte.length === 0) return;
    const gemeldet = lesen<Record<string, number>>(GEMELDET, {});
    const neu = orte.filter((o) => !gemeldet[o.name] || o.m > gemeldet[o.name]! * 1.5);
    if (neu.length === 0) return;
    void supabase
      .from("region_wishes")
      .upsert(
        neu.map((o) => ({ user_id: userId, name: o.name, lon: o.punkt[0], lat: o.punkt[1], meters: Math.round(o.m), first_seen: new Date(o.seit).toISOString(), updated_at: new Date().toISOString() })),
      )
      .then(({ error }) => {
        if (error) return;
        for (const o of neu) gemeldet[o.name] = o.m;
        localStorage.setItem(GEMELDET, JSON.stringify(gemeldet));
      });
  }, [orte, userId]);

  return orte;
}
