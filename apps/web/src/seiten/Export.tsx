import { useEffect, useState } from "react";
import { EXPORT_STAND } from "../daten/arbeiter";
import { exportVorbereiten, teilenOderLaden } from "../daten/export";
import { t } from "../texte/de";

const groesse = (b: number) => (b < 1e6 ? `${Math.max(1, Math.round(b / 1e3))} KB` : `${(b / 1e6).toLocaleString("de-DE", { maximumFractionDigits: 1 })} MB`);

/** Einstellungen → Konto → "Alles exportieren": prepare in the background, then share or save. */
export function Export() {
  const tx = t.export;
  const [zustand, setZustand] = useState<"ruhe" | "laeuft" | "fertig" | "fehler">("ruhe");
  const [anteil, setAnteil] = useState(0);
  const [ergebnis, setErgebnis] = useState<{ datei: File; wege: number } | null>(null);
  useEffect(() => {
    const stand = (e: Event) => setAnteil((e as CustomEvent<number>).detail);
    window.addEventListener(EXPORT_STAND, stand);
    return () => window.removeEventListener(EXPORT_STAND, stand);
  }, []);

  return (
    <div className="gruppe import">
      <div className="import-kopf">
        <p className="schalter-label">{tx.titel}</p>
        <p className="schalter-hinweis">{tx.erklaerung}</p>
      </div>
      <div className="import-knoepfe">
        {zustand !== "fertig" ? (
          <button
            type="button"
            className="datei-knopf"
            disabled={zustand === "laeuft"}
            onClick={async () => {
              setZustand("laeuft");
              setAnteil(0);
              try {
                setErgebnis(await exportVorbereiten());
                setZustand("fertig");
              } catch {
                setZustand("fehler");
              }
            }}
          >
            {zustand === "laeuft" ? tx.laeuft(Math.round(anteil * 100)) : tx.starten}
          </button>
        ) : (
          // A second tap: the iPhone only opens the share sheet right after a tap.
          <button type="button" className="datei-knopf" onClick={() => ergebnis && void teilenOderLaden(ergebnis.datei)}>
            {tx.sichern}
          </button>
        )}
      </div>
      {zustand === "fertig" && ergebnis && <p className="zeile-text" role="status">{tx.fertig(ergebnis.wege, groesse(ergebnis.datei.size))}</p>}
      {zustand === "fehler" && <p className="zeile-text fehler" role="alert">{tx.fehler}</p>}
    </div>
  );
}
