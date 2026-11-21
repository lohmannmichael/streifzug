import { createClient, type Session } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "../konfig";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
});

/**
 * Only when the server says the account is really gone may the app start a new one. A failed
 * token refresh, no network or a busy server must never cost the account (21.11.2026: that
 * happened once and the app started empty).
 */
export function kontoWeg(fehler: { code?: string | undefined; message?: string | undefined } | null): boolean {
  if (!fehler) return false;
  return fehler.code === "user_not_found" || /user .*(does not exist|not found)/i.test(fehler.message ?? "");
}

export type Sitzung = { status: "laedt" } | { status: "bereit"; session: Session } | { status: "offline" };

/**
 * Starts without an account: if there is no session yet, an anonymous one is created.
 * An account (mail link or Apple) can be linked later to keep progress.
 * Without network the app keeps working from local data.
 */
export function useSitzung(): Sitzung {
  const [sitzung, setSitzung] = useState<Sitzung>({ status: "laedt" });

  useEffect(() => {
    let aktiv = true;
    async function start() {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        // A stored session can belong to an account that no longer exists on the server; start fresh then.
        const pruefung = await supabase.auth.getUser();
        if (!kontoWeg(pruefung.error)) return data.session;
        await supabase.auth.signOut({ scope: "local" });
      }
      const anmeldung = await supabase.auth.signInAnonymously();
      return anmeldung.data.session;
    }
    start()
      .then((session) => aktiv && setSitzung(session ? { status: "bereit", session } : { status: "offline" }))
      .catch(() => aktiv && setSitzung({ status: "offline" }));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (aktiv && session) setSitzung({ status: "bereit", session });
    });
    return () => {
      aktiv = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return sitzung;
}
