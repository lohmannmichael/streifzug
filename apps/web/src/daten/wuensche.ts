import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase";

/**
 * Places Michi wants before going there ("Ort hinzufügen"): a search with suggestions (Photon by
 * komoot, OpenStreetMap data, called from the phone) and the wish in `region_wishes`, the same
 * list the walked places without data go to. A place is then prepared (`npm run region`).
 */
export interface OrtVorschlag {
  name: string;
  /** "Nordrhein-Westfalen, Deutschland" */
  gegend: string;
  punkt: [number, number];
}

export interface Wunsch {
  name: string;
  meters: number;
}

const ORTSARTEN = new Set(["city", "town", "village", "municipality", "hamlet", "suburb"]);
export const SUCHE_URL = "https://photon.komoot.io/api/";

/** Up to six towns and villages for a typed name. Throws when the search is not reachable. */
export async function orteSuchen(text: string, signal?: AbortSignal): Promise<OrtVorschlag[]> {
  const url = `${SUCHE_URL}?q=${encodeURIComponent(text)}&lang=de&limit=15`;
  const antwort = await fetch(url, signal ? { signal } : {});
  if (!antwort.ok) throw new Error(`Suche ${antwort.status}`);
  const daten = (await antwort.json()) as { features: { properties: Record<string, string | undefined>; geometry: { coordinates: [number, number] } }[] };
  const gesehen = new Set<string>();
  const out: OrtVorschlag[] = [];
  for (const f of daten.features) {
    const p = f.properties;
    if (p.osm_key !== "place" || !ORTSARTEN.has(p.osm_value ?? "") || !p.name) continue;
    const gegend = [p.state, p.country].filter(Boolean).join(", ");
    const k = `${p.name}|${gegend}`;
    if (gesehen.has(k)) continue;
    gesehen.add(k);
    out.push({ name: p.name, gegend, punkt: f.geometry.coordinates });
    if (out.length === 6) break;
  }
  return out;
}

/** Puts a place on the wish list (once per name; a later wish keeps the walked meters). */
export async function ortWuenschen(v: OrtVorschlag): Promise<void> {
  const { error } = await supabase.from("region_wishes").upsert({ name: v.name, lon: v.punkt[0], lat: v.punkt[1], updated_at: new Date().toISOString() }, { onConflict: "user_id,name", ignoreDuplicates: true });
  if (error) throw new Error(error.message);
}

/** Own wishes, for "Wird vorbereitet". */
export function useWuensche(): { wuensche: Wunsch[]; neuLaden: () => void } {
  const [wuensche, setWuensche] = useState<Wunsch[]>([]);
  const neuLaden = useCallback(() => {
    void supabase
      .from("region_wishes")
      .select("name, meters")
      .then(({ data }) => setWuensche((data as Wunsch[] | null) ?? []));
  }, []);
  useEffect(neuLaden, [neuLaden]);
  return { wuensche, neuLaden };
}
