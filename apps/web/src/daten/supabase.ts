import { createClient, type Session } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "../konfig";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
});

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
      if (data.session) return data.session;
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
