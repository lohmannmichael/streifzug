import { useEffect, useState, type ReactNode } from "react";
import type { OverlandStatus } from "../daten/import";
import { useKonto } from "../daten/konto";
import type { Regionen } from "../daten/regionen";
import type { Sitzung } from "../daten/supabase";
import type { Einstellungen } from "../einstellungen";
import { t } from "../texte/de";
import { IconZurueck } from "../ui/Icons";
import { Export } from "./Export";
import { GpxImport, OverlandEinrichten } from "./Importieren";
import { Konto } from "./Konto";
import { aufzeichnungText, useRandWischen, ZurueckZumPass } from "./Pass";
import { Stifte } from "./Stifte";

type EinstellungsSeite = "stifte" | "aufzeichnung" | "konto" | "ueber" | "gpx";

/**
 * Settings (Bauplan 3, D5, section 3.7): four rows, each with its own page. "Alte Wege importieren"
 * sits quietly under Konto, "Zustand" under Über.
 */
export function EinstellungenSeite(props: {
  sitzung: Sitzung;
  werte: Einstellungen;
  aendern: (teil: Partial<Einstellungen>) => void;
  daten: Regionen | null;
  overland: OverlandStatus;
  /** Opened from the sheet: straight to this page. */
  start: EinstellungsSeite | null;
  zumPass: () => void;
  /** Record with the app open (fallback when Overland fails). */
  offeneApp: () => void;
  /** A few numbers to find problems from a screenshot. */
  zustand: [string, string][];
}) {
  const [seite, setSeite] = useState<EinstellungsSeite | null>(props.start);
  useEffect(() => setSeite(props.start), [props.start]);
  const userId = props.sitzung.status === "bereit" ? props.sitzung.session.user.id : null;
  const { zustand: konto } = useKonto();
  const { werte, aendern } = props;
  const quelle = { daten: props.daten, userId, werte, aendern };

  if (seite === "stifte")
    return (
      <Unterseite titel={t.stifte.titel} zurueck={() => setSeite(null)}>
        <Stifte werte={werte} aendern={aendern} />
      </Unterseite>
    );
  if (seite === "aufzeichnung")
    return (
      <Unterseite titel={t.ich.aufzeichnung} zurueck={() => setSeite(null)}>
        <OverlandEinrichten {...quelle} />
        <h2>{t.ich.offeneApp}</h2>
        <div className="gruppe">
          <p className="zeile-text">{t.ich.offeneAppText}</p>
          <button type="button" className="zeile-knopf innen" onClick={props.offeneApp}>
            <span>{t.ich.offeneApp}</span>
            <span className="wert">›</span>
          </button>
        </div>
      </Unterseite>
    );
  if (seite === "konto")
    return (
      <Unterseite titel={t.ich.konto} zurueck={() => setSeite(null)}>
        {props.sitzung.status === "offline" ? (
          <div className="gruppe">
            <p className="zeile-text">{t.ich.kontoOffline}</p>
          </div>
        ) : (
          <Konto />
        )}
        <h2>{t.ich.daten}</h2>
        <Export />
        <button type="button" className="text-knopf fuss" onClick={() => setSeite("gpx")}>
          {t.ich.gpx}
        </button>
      </Unterseite>
    );
  if (seite === "gpx")
    return (
      <Unterseite titel={t.ich.gpx} zurueck={() => setSeite("konto")} zurueckText={t.ich.konto}>
        <GpxImport {...quelle} />
      </Unterseite>
    );
  if (seite === "ueber")
    return (
      <Unterseite titel={t.ich.ueber} zurueck={() => setSeite(null)}>
        <h2>{t.ich.kartendaten}</h2>
        <p className="zeile-text">{t.ich.karteQuelle}</p>
        <h2>{t.ich.lizenzen}</h2>
        <p className="zeile-text">{t.ich.lizenzenText}</p>
        <h2>{t.zustand.titel}</h2>
        <div className="gruppe">
          {props.zustand.map(([k, v]) => (
            <p key={k} className="zeile-text zustand-zeile">
              <span>{k}</span>
              <span>{v}</span>
            </p>
          ))}
        </div>
      </Unterseite>
    );

  const version = props.zustand[0]?.[1] ?? "";
  const kontoText = konto.art === "gesichert" || konto.art === "ohnePasswort" || konto.art === "wartet" ? konto.mail : t.ich.kontoAnonym;
  return (
    <StartSeite zurueck={props.zumPass}>
      <ul className="pass-zeilen einstellungen-zeilen">
        <Zeile titel={t.stifte.titel} text={t.ich.stifteText} onClick={() => setSeite("stifte")} />
        <Zeile titel={t.ich.aufzeichnung} text={aufzeichnungText(props.overland)} onClick={() => setSeite("aufzeichnung")} />
        <Zeile titel={t.ich.konto} text={kontoText} onClick={() => setSeite("konto")} />
        <Zeile titel={t.ich.ueber} text={t.ich.ueberText(version)} onClick={() => setSeite("ueber")} />
      </ul>
    </StartSeite>
  );
}

function StartSeite(props: { zurueck: () => void; children: ReactNode }) {
  const wischen = useRandWischen(props.zurueck);
  return (
    <div className="app">
      <section className="seite seite-voll" aria-labelledby="unterseite-titel" {...wischen}>
        <ZurueckZumPass onClick={props.zurueck} />
        <h1 id="unterseite-titel">{t.ich.titel}</h1>
        {props.children}
      </section>
    </div>
  );
}

function Zeile(props: { titel: string; text: string; onClick: () => void }) {
  return (
    <li>
      <button type="button" className="pass-zeile kurz" onClick={props.onClick}>
        <span className="pass-text">
          <b>{props.titel}</b>
          <span>{props.text}</span>
        </span>
        <span className="pfeil" aria-hidden="true">›</span>
      </button>
    </li>
  );
}

function Unterseite(props: { titel: string; zurueck: () => void; zurueckText?: string; children: ReactNode }) {
  const wischen = useRandWischen(props.zurueck);
  return (
    <div className="app">
      <section className="seite seite-voll" aria-labelledby="unterseite-titel" {...wischen}>
        <button type="button" className="zurueck" onClick={props.zurueck}>
          <IconZurueck />
          <span>{props.zurueckText ?? t.ich.titel}</span>
        </button>
        <h1 id="unterseite-titel">{props.titel}</h1>
        {props.children}
      </section>
    </div>
  );
}
