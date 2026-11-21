import type { Zaehlen } from "../daten/fortschritt";
import { useQuellenInfo } from "../daten/import";
import { useLogbuch, type LogEintrag } from "../daten/logbuch";
import { alsStrecke, prozentText, type Regionen } from "../daten/regionen";
import type { Streifzug } from "../daten/speicher";
import type { Einstellungen } from "../einstellungen";
import { t } from "../texte/de";
import { dauerText } from "../ui/format";
import { MiniKarte } from "../ui/MiniKarte";
import { Stempel } from "../ui/Stempel";

const tag = new Intl.DateTimeFormat("de-DE", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const monat = new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric" });

/** Streifzüge as a logbook: newest first, grouped by month, each with a small street plan. */
export function LogbuchSeite(props: {
  liste: Streifzug[];
  daten: Regionen | null;
  einstellungen: Einstellungen;
  zaehlen: Zaehlen;
  zeigen: (gebietId: string) => void;
  importieren: () => void;
  bereit: boolean;
}) {
  const e = props.einstellungen;
  // Own outings are shown one by one; imports and Overland as one line each (they count for "new" too).
  const logbuch = useLogbuch(props.liste, props.daten, e.wegeZaehlen, props.zaehlen, props.bereit);
  const eigene = props.liste;
  const info = useQuellenInfo();
  const importe = (["overland", "gpx", "google"] as const).flatMap((q) => (info[q] ? [{ q, ...info[q] }] : []));
  if (eigene.length === 0 && importe.length === 0)
    return (
      <section className="seite" aria-labelledby="streifzuege-titel">
        <h1 id="streifzuege-titel">{t.streifzuege.titel}</h1>
        <p className="leer gross">{t.streifzuege.leer}</p>
        <button type="button" className="mehr-knopf" onClick={props.importieren}>{t.import.abkuerzung}</button>
      </section>
    );

  const gruppen: { titel: string; eintraege: Streifzug[] }[] = [];
  for (const s of eigene) {
    const titel = monat.format(s.startedAt);
    if (gruppen.at(-1)?.titel !== titel) gruppen.push({ titel, eintraege: [] });
    gruppen.at(-1)!.eintraege.push(s);
  }

  return (
    <section className="seite" aria-labelledby="streifzuege-titel">
      <h1 id="streifzuege-titel">{t.streifzuege.titel}</h1>
      {importe.length > 0 && (
        <div className="gruppe import-info">
          {importe.map(({ q, wege, km }) => (
            <p key={q} className="zeile-text">
              {t.import.logbuchKarte(t.import[q].kurz, wege, alsStrecke(km * 1000), props.zaehlen.quellen[q])}
            </p>
          ))}
          <p className="zeile-text schalter-hinweis">{t.import.logbuchHinweis}</p>
        </div>
      )}
      {importe.length === 0 && (
        <button type="button" className="mehr-knopf" onClick={props.importieren}>{t.import.abkuerzung}</button>
      )}
      {gruppen.map((g) => (
        <div key={g.titel}>
          <h2>{g.titel}</h2>
          <ol className="logbuch">
            {g.eintraege.map((s) => (
              <Eintrag key={s.id} s={s} e={logbuch?.get(s.id) ?? null} daten={props.daten} zeigen={props.zeigen} />
            ))}
          </ol>
        </div>
      ))}
    </section>
  );
}

function Eintrag(props: { s: Streifzug; e: LogEintrag | null; daten: Regionen | null; zeigen: (gebietId: string) => void }) {
  const { s, e, daten } = props;
  const dauer = dauerText(Math.round(((s.endedAt ?? s.startedAt) - s.startedAt) / 1000));
  const gebiet = e?.gebietId ? daten?.gebiete.get(e.gebietId) : undefined;
  const name = (id: string) => daten?.gebiete.get(id)?.name ?? "";
  return (
    <li className="log-karte">
      <div className="log-bild">
        {e ? (
          <MiniKarte fixes={s.fixes} umgebung={e.umgebung} gesehen={e.gesehen} neu={e.neu} label={t.streifzuege.kartenLabel(alsStrecke(s.distanceM), gebiet?.name ?? "")} />
        ) : (
          <div className="mini-karte laedt" aria-hidden="true" />
        )}
        {e?.meilensteine.slice(-1).map((m) => <Stempel key={m.gebietId} name={name(m.gebietId)} prozent={m.prozent} datum={s.startedAt} klein />)}
      </div>
      <div className="log-text">
        <p className="log-datum">{tag.format(s.startedAt)}</p>
        <p className="leise">
          {alsStrecke(s.distanceM)} · {dauer} · {t.streifzuege.art[s.mode]}
        </p>
        {e && e.neuM >= 1 && gebiet && (
          <p className="log-neu">
            <span className="marker">+{alsStrecke(e.neuM)}</span> {t.streifzuege.neuIn(gebiet.name)}
            {prozentText(e.vorherP) !== prozentText(e.nachherP) && <span className="leise"> · {t.streifzuege.sprung(prozentText(e.vorherP), prozentText(e.nachherP))}</span>}
          </p>
        )}
        {e && e.neuM < 1 && <p className="leise">{s.mode === "car" && e.neu.size === 0 ? t.streifzuege.autoZaehltNicht : t.streifzuege.nichtsNeues}</p>}
        {e && e.strassen.length > 0 && <p className="log-strassen">{t.streifzuege.strassen(e.strassen)}</p>}
        <div className="log-fuss">
          <span className={`status status-${s.status}`}>{s.status === "gesichert" ? t.streifzuege.status.gesichert : t.streifzuege.status.lokal}</span>
          {gebiet && (
            <button type="button" className="text-knopf" onClick={() => props.zeigen(gebiet.id)}>
              {t.streifzuege.aufKarte}
            </button>
          )}
        </div>
      </div>
    </li>
  );
}
