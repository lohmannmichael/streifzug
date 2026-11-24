import { alsStrecke } from "../daten/regionen";
import { t } from "../texte/de";

export interface RbAnzeigeStand {
  m: number;
  zeile: string | null;
  komplett: boolean;
}

/** During the replay (Michi, 24.11.2026): "+340 m neu" on top, below it the street just turned yellow. */
export function RueckblickAnzeige(props: { stand: RbAnzeigeStand }) {
  const { m, zeile, komplett } = props.stand;
  return (
    <div className="rb-anzeige" aria-live="polite">
      <p className="rb-meter">{t.rbAnzeige.neu(alsStrecke(m))}</p>
      {zeile && <p className={komplett ? "rb-zeile komplett" : "rb-zeile"} key={zeile}>{zeile}</p>}
    </div>
  );
}
