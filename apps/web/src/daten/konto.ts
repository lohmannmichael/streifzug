import type { User } from "@supabase/supabase-js";
import { useCallback, useEffect, useState } from "react";
import { quelleLoeschen } from "./import";
import { alleLaden, loeschen, speichern } from "./speicher";
import { standVergessen } from "./stand";
import { supabase } from "./supabase";

/**
 * Account with mail and password (Bauplan 3, A2, decided with Michi on 22.11.2026: no mail
 * service, no code; one confirmation link, then a password). The anonymous account gets the
 * address, so its id and all its data stay the same. Signing in on another phone needs no mail.
 */
type KontoZustand =
  | { art: "laedt" }
  | { art: "anonym" }
  | { art: "wartet"; mail: string }
  | { art: "ohnePasswort"; mail: string }
  | { art: "gesichert"; mail: string };

function zustandAus(user: User | null): KontoZustand {
  if (!user) return { art: "laedt" };
  if (user.email && user.email_confirmed_at) {
    // The password is set by the app right after the confirmation; this flag remembers it.
    return user.user_metadata?.passwort_gesetzt ? { art: "gesichert", mail: user.email } : { art: "ohnePasswort", mail: user.email };
  }
  if (user.new_email) return { art: "wartet", mail: user.new_email };
  return { art: "anonym" };
}

/** The account state; read again when the app comes back (after the link was tapped in Safari). */
export function useKonto(): { zustand: KontoZustand; neuLesen: () => Promise<void> } {
  const [zustand, setZustand] = useState<KontoZustand>({ art: "laedt" });
  const neuLesen = useCallback(async () => {
    const { data } = await supabase.auth.getUser();
    // After the confirmation the token still says "anonymous": fetch a fresh one.
    if (data.user?.email_confirmed_at && data.user.is_anonymous !== false) await supabase.auth.refreshSession();
    setZustand(zustandAus(data.user));
  }, []);
  useEffect(() => {
    void neuLesen();
    const zurueck = () => document.visibilityState === "visible" && void neuLesen();
    document.addEventListener("visibilitychange", zurueck);
    return () => document.removeEventListener("visibilitychange", zurueck);
  }, [neuLesen]);
  return { zustand, neuLesen };
}

/** German sentence for an auth error. */
function satz(fehler: { code?: string | undefined; message?: string | undefined }): string {
  const c = fehler.code ?? "";
  if (c === "invalid_credentials") return "Mail-Adresse oder Passwort stimmen nicht.";
  if (c === "email_not_confirmed") return "Diese Mail-Adresse ist noch nicht bestätigt. Tipp zuerst den Link in der Mail an.";
  if (c === "email_exists" || c === "user_already_exists") return "Zu dieser Adresse gibt es schon ein Konto. Melde dich damit an.";
  if (c === "over_email_send_rate_limit" || c === "over_request_rate_limit") return "Gerade wurden zu viele Mails verschickt. Bitte in einer Stunde nochmal versuchen.";
  if (c === "weak_password") return "Das Passwort ist zu einfach. Nimm mindestens 8 Zeichen.";
  if (c === "same_password") return "Das ist schon dein Passwort.";
  if (c === "validation_failed" || c === "email_address_invalid") return "Diese Mail-Adresse sieht nicht richtig aus.";
  if (!navigator.onLine) return "Gerade kein Netz. Bitte gleich nochmal versuchen.";
  return `Das hat nicht geklappt (${fehler.message ?? c}).`;
}

/** Step 1: attach the address to this (anonymous) account. Supabase sends one mail with a link. */
export async function mailEintragen(mail: string): Promise<string | null> {
  const { error } = await supabase.auth.updateUser({ email: mail.trim() }, { emailRedirectTo: `${location.origin}/?konto=bestaetigt` });
  return error ? satz(error) : null;
}

/** Step 2, after the link: the password for signing in on other phones. */
export async function passwortSetzen(passwort: string): Promise<string | null> {
  if (passwort.length < 8) return "Nimm mindestens 8 Zeichen.";
  const { error } = await supabase.auth.updateUser({ password: passwort, data: { passwort_gesetzt: true } });
  return error ? satz(error) : null;
}

/** Own recordings on this phone (Overland ways come from the account anyway). */
export async function eigeneWegeAufGeraet(): Promise<number> {
  return (await alleLaden()).filter((s) => s.status !== "aktiv").length;
}

/**
 * Sign in on this phone. Own recordings of the current (anonymous) account are taken over into the
 * signed-in account when `uebernehmen`, otherwise removed from this phone (they stay on the server).
 * Afterwards the app starts again and fetches everything of the account.
 */
export async function anmelden(mail: string, passwort: string, uebernehmen: boolean): Promise<string | null> {
  const eigene = (await alleLaden()).filter((s) => s.status !== "aktiv");
  const { error } = await supabase.auth.signInWithPassword({ email: mail.trim(), password: passwort });
  if (error) return satz(error);
  for (const s of eigene) {
    if (uebernehmen) await speichern({ ...s, status: "lokal" });
    else await loeschen(s.id);
  }
  // Overland ways of the previous account must not mix in; the new account's come from the server.
  await quelleLoeschen("overland");
  localStorage.removeItem("streifzug.overland");
  if (!uebernehmen) {
    localStorage.removeItem("streifzug.stempel");
    localStorage.removeItem("streifzug.ausnahmen");
  }
  location.replace("/");
  return null;
}

/** Sign out on this phone. Nothing on the server is deleted; this phone starts empty. */
export async function abmelden(): Promise<string | null> {
  const eigene = await alleLaden();
  // Never lose a recording that is only on this phone.
  if (eigene.some((s) => s.status === "lokal" || s.status === "aktiv")) return "Ein Weg ist noch nicht im Konto gesichert. Bitte mit Netz kurz warten und nochmal versuchen.";
  for (const s of eigene) await loeschen(s.id);
  await quelleLoeschen("overland");
  for (const k of Object.keys(localStorage)) if (k.startsWith("streifzug.")) localStorage.removeItem(k);
  await standVergessen();
  await supabase.auth.signOut({ scope: "local" });
  location.replace("/");
  return null;
}
