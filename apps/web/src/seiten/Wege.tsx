import type { KorrekturArt } from "@streifzug/core";
import { useEffect, useState } from "react";
import type { Abschnitt, WegKopf } from "../daten/abgleich.worker";
import { ANDERE_GEAENDERT, fragen } from "../daten/arbeiter";
import { korrekturEntfernen, korrekturSetzen, useKorrekturen } from "../daten/korrekturen";
import { alsStrecke } from "../daten/regionen";
import { t } from "../texte/de";
import { IconSchliessen } from "../ui/Icons";

const tagName = new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "numeric", month: "short" });
const uhr = new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit" });
const ARTEN: KorrekturArt[] = ["zuFuss", "rad", "gefahren"];

/**
 * Ways of the last 30 days, by day (Bauplan 3, C2; becomes the "Rückblicke" list in D4).
 * Opening a way shows its legs; each can be set to "zu Fuß", "Rad" or "gefahren".
 */
export function WegeSeite(props: { schliessen: () => void }) {
  const [wege, setWege] = useState<WegKopf[] | null>(null);
  const [offen, setOffen] = useState<string | null>(null);
  useEffect(() => {
    const laden = () => void fragen<"wegeListe">({ typ: "wegeListe", seit: Date.now() - 30 * 86400_000 }).antwort.then((a) => setWege(a.wege));
    laden();
    window.addEventListener(ANDERE_GEAENDERT, laden);
    return () => window.removeEventListener(ANDERE_GEAENDERT, laden);
  }, []);

  const tage = new Map<string, WegKopf[]>();
  for (const w of wege ?? []) {
    const k = tagName.format(w.startedAt);
    (tage.get(k) ?? tage.set(k, []).get(k)!).push(w);
  }

  return (
    <div className="app">
      <section className="seite seite-voll" aria-labelledby="wege-titel">
        <button type="button" className="zurueck" onClick={props.schliessen}>
          <IconSchliessen />
          <span>{t.ich.zurueck}</span>
        </button>
        <h1 id="wege-titel">{t.wege.titel}</h1>
        <p className="leise seiten-unterzeile">{t.wege.unterzeile}</p>
        {wege === null && <p className="zeile-text leise">{t.blatt.nochOffenLaedt}</p>}
        {wege?.length === 0 && <p className="zeile-text leise">{t.blatt.keineWege}</p>}
        {[...tage].map(([tag, liste]) => (
          <div key={tag}>
            <h2>{tag}</h2>
            <ul className="zeilen gruppe">
              {liste.map((w) => (
                <li key={w.id}>
                  <button type="button" className="zeile-knopf weg-zeile" aria-expanded={offen === w.id} onClick={() => setOffen(offen === w.id ? null : w.id)}>
                    <span>{t.wege.zeile(uhr.format(w.startedAt), uhr.format(w.endedAt), alsStrecke(w.distanceM))}</span>
                    <span className="wert">{offen === w.id ? "‹" : "›"}</span>
                  </button>
                  {offen === w.id && <Abschnitte weg={w.id} />}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>
    </div>
  );
}

/** The legs of one way, each with "zu Fuß · Rad · gefahren". */
function Abschnitte({ weg }: { weg: string }) {
  const korrekturen = useKorrekturen();
  const eigene = korrekturen[weg] ?? [];
  const [liste, setListe] = useState<Abschnitt[] | null>(null);
  const schluessel = JSON.stringify(eigene);
  useEffect(() => {
    let lebt = true;
    void fragen<"abschnitte">({ typ: "abschnitte", id: weg, korrekturen: eigene }).antwort.then((a) => lebt && setListe(a.abschnitte));
    return () => {
      lebt = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weg, schluessel]);

  if (!liste) return <p className="zeile-text leise">{t.blatt.nochOffenLaedt}</p>;
  if (liste.length === 0) return <p className="zeile-text leise">{t.wege.keineAbschnitte}</p>;
  return (
    <ol className="abschnitte">
      {liste.map((a) => (
        <li key={a.von} className="abschnitt-zeile">
          <span className="abschnitt-text">
            {t.wege.abschnitt(uhr.format(a.von), uhr.format(a.bis), alsStrecke(a.m), Math.max(1, Math.round((a.bis - a.von) / 60_000)))}
            {a.korrigiert && (
              <>
                {" · "}
                <button type="button" className="text-knopf klein" onClick={() => korrekturEntfernen(weg, a.von)}>{t.wege.zuruecksetzen}</button>
              </>
            )}
            {!a.korrigiert && a.unsicher && <span className="leise"> · {t.wege.unsicher}</span>}
          </span>
          <span className="umschalt-gruppe" role="radiogroup" aria-label={t.wege.artLabel}>
            {ARTEN.map((art) => (
              <button
                key={art}
                type="button"
                role="radio"
                aria-checked={a.art === art}
                className={a.art === art ? (art === "gefahren" ? "art an gefahren" : "art an") : "art"}
                onClick={() => a.art !== art && korrekturSetzen(weg, { von: a.von, bis: a.bis, art })}
              >
                {t.wege.arten[art]}
              </button>
            ))}
          </span>
        </li>
      ))}
    </ol>
  );
}
