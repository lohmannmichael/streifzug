import { ERSTES_JAHR, jahresFarbe, KULI_FARBEN, MARKER_FARBEN, type Einstellungen } from "../einstellungen";
import { t } from "../texte/de";

/** Pens (Bauplan 4.2): highlighter and pen colour, and "Jedes Jahr eine Farbe". */
export function Stifte(props: { werte: Einstellungen; aendern: (teil: Partial<Einstellungen>) => void }) {
  const { werte, aendern } = props;
  const tx = t.stifte;
  const jahr = new Date().getFullYear();
  const legende = [0, 1, 2].map((i) => `${Math.max(ERSTES_JAHR, jahr) + i} ${jahresFarbe(Math.max(ERSTES_JAHR, jahr) + i).name.toLowerCase()}`).join(" · ");
  return (
    <div className="gruppe">
      <fieldset className="farbwahl" disabled={werte.jahresFarben}>
        <legend className="schalter-label">{tx.marker}</legend>
        <div className="farben">
          {MARKER_FARBEN.map((f) => (
            <label key={f.farbe} className="farbe" title={f.name}>
              <input type="radio" name="marker" checked={werte.marker === f.farbe} onChange={() => aendern({ marker: f.farbe })} aria-label={f.name} />
              <span className="wisch-probe" style={{ background: f.farbe }} />
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="farbwahl">
        <legend className="schalter-label">{tx.kuli}</legend>
        <div className="farben">
          {KULI_FARBEN.map((f) => (
            <label key={f.farbe} className="farbe" title={f.name}>
              <input type="radio" name="kuli" checked={werte.kuli === f.farbe} onChange={() => aendern({ kuli: f.farbe })} aria-label={f.name} />
              <span className="kuli-probe" style={{ background: f.farbe }} />
            </label>
          ))}
        </div>
      </fieldset>
      <label className="schalter-zeile">
        <span>
          <span className="schalter-label">{tx.jahre}</span>
          <span className="schalter-hinweis">{werte.jahresFarben ? legende : tx.jahreHinweis}</span>
        </span>
        <input type="checkbox" role="switch" className="schalter" checked={werte.jahresFarben} onChange={(e) => aendern({ jahresFarben: e.target.checked })} />
      </label>
    </div>
  );
}
