import { besteStempel } from "@streifzug/core";
import { useMemo, useRef, useState } from "react";
import type { Fortschritt } from "../daten/fortschritt";
import type { FremderOrt } from "../daten/orte";
import type { Regionen } from "../daten/regionen";
import { useGesetzteStempel, type GesetzterStempel } from "../daten/veedel";
import { t } from "../texte/de";
import { Stempel } from "../ui/Stempel";
import { orteMitWegen, PassUnterseite } from "./Pass";

/**
 * Stamp passport (Bauplan 3, D3, picture Stempelpass.png): first page special stamps (km, places,
 * countries), then one page per place. Per Veedel only the best stamp; all stay stored.
 */
export function StempelSeite(props: { daten: Regionen; fortschritt: Fortschritt | null; fremdeOrte: FremderOrt[]; zurueck: () => void }) {
  const { daten } = props;
  const gesetzt = useGesetzteStempel();
  const seiten = useMemo(() => {
    const wurzel = (id: string) => {
      let g = daten.gebiete.get(id);
      while (g?.eltern) g = daten.gebiete.get(g.eltern);
      return g?.id ?? null;
    };
    const beste = besteStempel(gesetzt).sort((a, b) => b.gestempeltAm - a.gestempeltAm);
    const jeOrt = new Map<string, GesetzterStempel[]>();
    const sonder: GesetzterStempel[] = [];
    for (const s of beste) {
      const w = s.gebietId ? wurzel(s.gebietId) : null;
      if (!w) sonder.push(s);
      else (jeOrt.get(w) ?? jeOrt.set(w, []).get(w)!).push(s);
    }
    // Places in the order of the Orte page (most walked first), then any other with stamps.
    const reihe = orteMitWegen(daten, props.fortschritt, props.fremdeOrte).regionen.map((x) => x.r.wurzel);
    for (const w of jeOrt.keys()) if (!reihe.includes(w)) reihe.push(w);
    return [
      { id: "sonder", titel: t.stempelSeite.sonder, stempel: sonder },
      ...reihe.filter((w) => jeOrt.has(w)).map((w) => ({ id: w, titel: daten.gebiete.get(w)?.name ?? "", stempel: jeOrt.get(w)! })),
    ];
  }, [gesetzt, daten, props.fortschritt, props.fremdeOrte]);
  const name = (id: string | null) => (id ? (daten.gebiete.get(id)?.name ?? "") : "");

  // Pages side by side; the dots show where you are.
  const leiste = useRef<HTMLDivElement>(null);
  const [aktiv, setAktiv] = useState(0);

  return (
    <PassUnterseite titel={t.pass.stempelTitel} zurueck={props.zurueck}>
      {gesetzt.length === 0 ? (
        <p className="zeile-text leise">{t.stempelSeite.keine}</p>
      ) : (
        <>
          <div className="stempel-reiter" role="tablist">
            {seiten.map((s, i) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={i === aktiv}
                onClick={() => leiste.current?.scrollTo({ left: i * leiste.current.clientWidth, behavior: "smooth" })}
              >
                {s.titel}
              </button>
            ))}
          </div>
          <div
            ref={leiste}
            className="stempel-seiten"
            onScroll={(e) => setAktiv(Math.round(e.currentTarget.scrollLeft / Math.max(1, e.currentTarget.clientWidth)))}
          >
            {seiten.map((s, i) => (
              <section key={s.id} className="stempel-blatt" aria-label={`${s.titel}, ${t.stempelSeite.seite(i + 1, seiten.length)}`}>
                {s.stempel.length === 0 && <p className="zeile-text leise">{t.stempelSeite.sonderLeer}</p>}
                {s.stempel.map((x, j) => (
                  <div
                    key={x.id}
                    className="pass-stempel"
                    // Slightly offset, alternating left and right, like stamped by hand.
                    style={{ transform: `translate(${(x.x - 0.5) * 24 + (j % 2 ? 6 : -6)}px, ${((x.y * 7) % 1) * 18 - 9}px)` }}
                  >
                    <Stempel stempel={x} gebietName={name(x.gebietId)} stadtName={x.gebietId && x.art === "prozent" ? stadt(daten, x.gebietId) : undefined} datum={x.gestempeltAm} groesse={x.art === "prozent" ? 150 : 124} drehung={x.drehung} />
                  </div>
                ))}
              </section>
            ))}
          </div>
        </>
      )}
    </PassUnterseite>
  );
}

function stadt(daten: Regionen, id: string): string | undefined {
  let g = daten.gebiete.get(id);
  while (g?.eltern) g = daten.gebiete.get(g.eltern);
  return g?.name;
}
