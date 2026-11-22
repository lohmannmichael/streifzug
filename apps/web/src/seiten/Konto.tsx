import { useState } from "react";
import { abmelden, anmelden, eigeneWegeAufGeraet, mailEintragen, passwortSetzen, useKonto } from "../daten/konto";
import { t } from "../texte/de";

/** Einstellungen → Konto: secure the account with mail and password, sign in, sign out. */
export function Konto() {
  const { zustand, neuLesen } = useKonto();
  const tx = t.konto;
  const [mail, setMail] = useState("");
  const [passwort, setPasswort] = useState("");
  const [meldung, setMeldung] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [anmeldenOffen, setAnmeldenOffen] = useState(false);
  // Before signing in: own ways on this phone? Then ask whether to take them over.
  const [frage, setFrage] = useState<number | null>(null);
  const [abmeldenFragen, setAbmeldenFragen] = useState(false);

  const tun = async (f: () => Promise<string | null>, danach?: () => void) => {
    setLaeuft(true);
    setMeldung(null);
    const fehler = await f();
    setLaeuft(false);
    if (fehler) setMeldung(fehler);
    else danach?.();
  };

  const anmeldenStarten = async () => {
    const n = await eigeneWegeAufGeraet();
    if (n > 0) setFrage(n);
    else void tun(() => anmelden(mail, passwort, false));
  };

  if (zustand.art === "laedt") return <div className="gruppe"><p className="zeile-text">{t.ich.kontoLaedt}</p></div>;

  return (
    <div className="gruppe konto">
      {zustand.art === "gesichert" && (
        <>
          <p className="zeile-text">{tx.angemeldet(zustand.mail)}</p>
          <div className="import-knoepfe">
            <button
              type="button"
              className="text-knopf warnung"
              disabled={laeuft}
              onClick={() => {
                if (!abmeldenFragen) return setAbmeldenFragen(true);
                void tun(abmelden);
              }}
            >
              {abmeldenFragen ? tx.wirklichAbmelden : tx.abmelden}
            </button>
          </div>
          {abmeldenFragen && <p className="zeile-text klein">{tx.abmeldenHinweis}</p>}
        </>
      )}

      {zustand.art === "ohnePasswort" && (
        <form
          className="konto-form"
          onSubmit={(e) => {
            e.preventDefault();
            void tun(() => passwortSetzen(passwort), () => void neuLesen());
          }}
        >
          <p className="zeile-text">{tx.bestaetigt(zustand.mail)}</p>
          {/* Hidden user name, so the iPhone saves the password for this address. */}
          <input type="email" name="email" autoComplete="username" value={zustand.mail} readOnly hidden />
          <label className="feld-label">
            {tx.passwort}
            <input className="eingabe" type="password" name="password" autoComplete="new-password" minLength={8} value={passwort} onChange={(e) => setPasswort(e.target.value)} required />
          </label>
          <button type="submit" className="datei-knopf" disabled={laeuft}>{tx.passwortFestlegen}</button>
        </form>
      )}

      {zustand.art === "wartet" && (
        <>
          <p className="zeile-text">{tx.mailUnterwegs(zustand.mail)}</p>
          <div className="import-knoepfe">
            <button type="button" className="datei-knopf" disabled={laeuft} onClick={() => void tun(async () => { await neuLesen(); return null; })}>
              {tx.habeBestaetigt}
            </button>
            <button type="button" className="text-knopf" disabled={laeuft} onClick={() => void tun(() => mailEintragen(zustand.mail), () => setMeldung(tx.nochmalGeschickt))}>
              {tx.nochmalSchicken}
            </button>
          </div>
        </>
      )}

      {zustand.art === "anonym" && !anmeldenOffen && (
        <form
          className="konto-form"
          onSubmit={(e) => {
            e.preventDefault();
            void tun(() => mailEintragen(mail), () => void neuLesen());
          }}
        >
          <p className="zeile-text">{tx.sichernText}</p>
          <label className="feld-label">
            {tx.mail}
            <input className="eingabe" type="email" name="email" autoComplete="email" inputMode="email" value={mail} onChange={(e) => setMail(e.target.value)} required />
          </label>
          <button type="submit" className="datei-knopf" disabled={laeuft}>{tx.mailSchicken}</button>
          <button type="button" className="text-knopf" onClick={() => setAnmeldenOffen(true)}>{tx.schonKonto}</button>
        </form>
      )}

      {zustand.art === "anonym" && anmeldenOffen && (
        <form
          className="konto-form"
          onSubmit={(e) => {
            e.preventDefault();
            void anmeldenStarten();
          }}
        >
          <p className="zeile-text">{tx.anmeldenText}</p>
          <label className="feld-label">
            {tx.mail}
            <input className="eingabe" type="email" name="email" autoComplete="username" inputMode="email" value={mail} onChange={(e) => setMail(e.target.value)} required />
          </label>
          <label className="feld-label">
            {tx.passwort}
            <input className="eingabe" type="password" name="password" autoComplete="current-password" value={passwort} onChange={(e) => setPasswort(e.target.value)} required />
          </label>
          {frage === null ? (
            <>
              <button type="submit" className="datei-knopf" disabled={laeuft}>{tx.anmelden}</button>
              <button type="button" className="text-knopf" onClick={() => setAnmeldenOffen(false)}>{tx.zurueckSichern}</button>
            </>
          ) : (
            <div className="vorschau">
              <p>{tx.uebernehmenFrage(frage)}</p>
              <div className="vorschau-knoepfe">
                <button type="button" className="haupt" disabled={laeuft} onClick={() => void tun(() => anmelden(mail, passwort, true))}>{tx.uebernehmen}</button>
                <button type="button" className="text-knopf" disabled={laeuft} onClick={() => void tun(() => anmelden(mail, passwort, false))}>{tx.nichtUebernehmen}</button>
              </div>
            </div>
          )}
        </form>
      )}

      {laeuft && <p className="zeile-text klein">{tx.einenMoment}</p>}
      {meldung && <p className="zeile-text fehler" role="alert">{meldung}</p>}
    </div>
  );
}
