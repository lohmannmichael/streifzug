import { Marker, type Map as MapLibreMap } from "maplibre-gl";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { ausnahmeSetzen } from "../daten/ausnahmen";
import { alsStrecke } from "../daten/regionen";
import type { Etikett } from "../daten/veedel";
import { t } from "../texte/de";

export type EtikettZustand = { punkt: [number, number]; strasse: Etikett | null; art: string | null; name?: string | null };

const tagMonatKurz = new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" });

/** Small white sign: name in bold; state in the second line; "Hier komme ich nicht hin" for counting streets. */
function Schild({ z, schliessen }: { z: EtikettZustand; schliessen: () => void }) {
  const s = z.strasse;
  const tx = t.etikett;
  const name = s?.name ?? z.name ?? tx.ohneName;
  const zeile = !s
    ? tx.zaehltNicht(tx.arten[z.art as keyof typeof tx.arten] ?? tx.arten.path)
    : s.ausnahme
      ? tx.ausgenommen
      : s.zustand === "aktiv"
        ? tx.gegangen(s.zeit ? tagMonatKurz.format(s.zeit) : "")
        : s.zustand === "gefahren"
          ? tx.gefahren(s.zeit ? tagMonatKurz.format(s.zeit) : "")
          : tx.offen(alsStrecke(s.restM));
  return (
    <div className="schild" role="dialog" aria-label={name} onClick={(e) => e.stopPropagation()}>
      <b>{name}</b>
      <span>{zeile}</span>
      {s && (
        <button
          type="button"
          className="text-knopf"
          onClick={() => {
            ausnahmeSetzen(s.id, !s.ausnahme);
            schliessen();
          }}
        >
          {s.ausnahme ? tx.zaehltDoch : tx.nichtHin}
        </button>
      )}
    </div>
  );
}

/** The street label as a map marker (so it stays at the street while the map moves). */
export function SchildAnKarte(props: { karte: MapLibreMap | null; etikett: EtikettZustand | null; schliessen: () => void }) {
  const schild = useRef<{ marker: Marker; el: HTMLDivElement } | null>(null);
  const { karte, etikett } = props;
  if (etikett && !schild.current) {
    const el = document.createElement("div");
    schild.current = { el, marker: new Marker({ element: el, anchor: "bottom", offset: [0, -10] }) };
  }
  useEffect(() => {
    if (!karte) return;
    if (!etikett) {
      schild.current?.marker.remove();
      return;
    }
    schild.current!.marker.setLngLat(etikett.punkt).addTo(karte);
  }, [etikett, karte]);
  return etikett && schild.current ? createPortal(<Schild z={etikett} schliessen={props.schliessen} />, schild.current.el) : null;
}
