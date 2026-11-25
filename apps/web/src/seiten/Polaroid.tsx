import { useEffect, useRef } from "react";
import { alsStrecke } from "../daten/regionen";
import { t } from "../texte/de";
import { IconSchliessen, IconWeiter, IconZurueck } from "../ui/Icons";

export interface PolaroidBild {
  tag: number;
  /** Second line, e.g. "8:10 · Rad" or "3 Wege". */
  zeile: string;
}

/**
 * Polaroid on opening (Michi, 25.11.2026): a picture frame flies onto the map, the replay plays in
 * its window. Below: the date, the way (or the day) and the new meters; arrows, dots and swiping
 * go through the pictures.
 */
export function Polaroid(props: {
  bilder: readonly PolaroidBild[];
  i: number;
  neuM: number;
  /** Meters on the way in this picture (all of it, also car rides). */
  gesamtM: number;
  onWahl: (i: number) => void;
  onZu: () => void;
  /** The picture's window on screen, once the frame has landed. */
  onFenster: (r: DOMRect) => void;
}) {
  const foto = useRef<HTMLDivElement>(null);
  const wisch = useRef<number | null>(null);
  const { bilder, i } = props;
  const bild = bilder[i]!;
  const n = bilder.length;
  const onFenster = useRef(props.onFenster);
  onFenster.current = props.onFenster;
  useEffect(() => {
    const ruhig = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const z = window.setTimeout(() => foto.current && onFenster.current(foto.current.getBoundingClientRect()), ruhig ? 0 : 700);
    return () => window.clearTimeout(z);
  }, []);
  const gehe = (j: number) => j >= 0 && j < n && j !== i && props.onWahl(j);

  return (
    <div className="polaroid-buehne" role="dialog" aria-modal="true" aria-label={t.polaroid.dialog} onClick={props.onZu}>
      <div
        className="polaroid"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => (wisch.current = e.clientX)}
        onPointerUp={(e) => {
          if (wisch.current === null) return;
          const dx = e.clientX - wisch.current;
          wisch.current = null;
          if (Math.abs(dx) > 50) gehe(dx < 0 ? i + 1 : i - 1);
        }}
      >
        <div className="polaroid-foto" ref={foto} />
        <div className="polaroid-rand">
          <p className="polaroid-datum">{t.polaroid.datum(bild.tag)}</p>
          <p className="polaroid-zeile">{bild.zeile}</p>
          <p className="polaroid-zahlen" aria-live="polite">
            <span><b>{alsStrecke(props.gesamtM)}</b> {t.polaroid.unterwegs}</span>
            <span><b>+{alsStrecke(props.neuM)}</b> {t.polaroid.neuWort}</span>
          </p>
          {n > 1 && (
            <div className="polaroid-nav">
              <button type="button" className="polaroid-pfeil" aria-label={t.polaroid.zurueck} disabled={i === 0} onClick={() => gehe(i - 1)}>
                <IconZurueck />
              </button>
              <div className="polaroid-punkte">
                {bilder.map((_, j) => (
                  <button key={j} type="button" className="polaroid-punkt" aria-label={t.polaroid.bild(j + 1, n)} aria-current={j === i} onClick={() => gehe(j)} />
                ))}
              </div>
              <button type="button" className="polaroid-pfeil" aria-label={t.polaroid.weiter} disabled={i === n - 1} onClick={() => gehe(i + 1)}>
                <IconWeiter />
              </button>
            </div>
          )}
        </div>
      </div>
      <button type="button" className="polaroid-zu" aria-label={t.polaroid.schliessen} onClick={props.onZu}>
        <IconSchliessen />
      </button>
    </div>
  );
}
