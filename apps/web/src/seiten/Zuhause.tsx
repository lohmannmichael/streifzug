import { useEffect, useState } from "react";
import { supabase } from "../daten/supabase";
import { t } from "../texte/de";

const RADIEN = [100, 200, 300] as const;

/**
 * Zuhause-Zone: points from Overland inside it are dropped on the server as they arrive
 * (database trigger, migration 20261121140000), and points already stored there are deleted.
 */
export function Zuhause(props: { userId: string | null }) {
  const tx = t.zuhause;
  const [zone, setZone] = useState<{ id: string; radius_m: number } | null | undefined>(undefined);
  const [radius, setRadius] = useState<number>(200);
  const [meldung, setMeldung] = useState<string | null>(null);

  useEffect(() => {
    if (!props.userId) return;
    void supabase
      .from("privacy_zones")
      .select("id, radius_m")
      .eq("user_id", props.userId)
      .limit(1)
      .then(({ data }) => setZone(data?.[0] ?? null));
  }, [props.userId]);

  const festlegen = () => {
    if (!props.userId) return setMeldung(tx.keinKonto);
    setMeldung(tx.sucht);
    navigator.geolocation.getCurrentPosition(
      async (p) => {
        if (zone) await supabase.from("privacy_zones").delete().eq("id", zone.id);
        const { data, error } = await supabase
          .from("privacy_zones")
          .insert({ user_id: props.userId, label: "Zuhause", center: `SRID=4326;POINT(${p.coords.longitude} ${p.coords.latitude})`, radius_m: radius })
          .select("id, radius_m")
          .single();
        if (error) return setMeldung(tx.fehler);
        setZone(data);
        setMeldung(tx.gesetzt);
      },
      () => setMeldung(tx.keinStandort),
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  };

  return (
    <div className="gruppe import">
      <div className="import-kopf">
        <p className="schalter-label">{tx.titel}</p>
        <p className="schalter-hinweis">{tx.erklaerung}</p>
      </div>
      {zone && <p className="zeile-text">{tx.aktiv(zone.radius_m)}</p>}
      <div className="import-knoepfe">
        <label className="radius">
          <span className="schalter-hinweis">{tx.radius}</span>
          <select value={radius} onChange={(e) => setRadius(Number(e.target.value))}>
            {RADIEN.map((r) => <option key={r} value={r}>{r} m</option>)}
          </select>
        </label>
        <button type="button" className="datei-knopf" onClick={festlegen}>{zone ? tx.neuSetzen : tx.setzen}</button>
        {zone && (
          <button
            type="button"
            className="text-knopf warnung"
            onClick={async () => {
              await supabase.from("privacy_zones").delete().eq("id", zone.id);
              setZone(null);
              setMeldung(tx.entfernt);
            }}
          >
            {tx.entfernen}
          </button>
        )}
      </div>
      {meldung && <p className="zeile-text" role="status">{meldung}</p>}
    </div>
  );
}
