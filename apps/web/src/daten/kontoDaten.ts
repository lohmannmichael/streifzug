import { supabase } from "./supabase";

/**
 * Things that used to live only on the phone travel with the account (Bauplan 3, A2): stamps
 * given, "Hier komme ich nicht hin" and the pen colours. Table `user_state`, one row per account.
 * Changes go up shortly after they happen; on start the server copy is merged in (nothing is lost:
 * stamps and exceptions are combined, never removed by the merge).
 */
const STEMPEL = "streifzug.stempel";
const AUSNAHMEN = "streifzug.ausnahmen";
const EINSTELLUNGEN = "streifzug.einstellungen";
/** Sent after server data was merged in, so the screens read it again. */
export const KONTO_DATEN = "streifzug:konto-daten";

type StempelEintrag = { id: string; gestempeltAm: number } & Record<string, unknown>;
type Stifte = { marker?: string | undefined; kuli?: string | undefined; jahresFarben?: boolean | undefined };

function lesen<T>(key: string, leer: T): T {
  try {
    return (JSON.parse(localStorage.getItem(key) ?? "null") as T | null) ?? leer;
  } catch {
    return leer;
  }
}

function stifteLesen(): Stifte {
  const e = lesen<Stifte>(EINSTELLUNGEN, {});
  return { marker: e.marker, kuli: e.kuli, jahresFarben: e.jahresFarben };
}

let warten = 0;

/** Something changed on the device: send it to the account in a moment. */
export function kontoDatenGeaendert() {
  window.clearTimeout(warten);
  warten = window.setTimeout(() => void hochladen(), 2000);
}

async function hochladen(): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id;
  if (!userId || !navigator.onLine) return;
  const { error } = await supabase.from("user_state").upsert({
    user_id: userId,
    stempel: lesen<StempelEintrag[]>(STEMPEL, []),
    ausnahmen: lesen<string[]>(AUSNAHMEN, []),
    stifte: stifteLesen(),
    updated_at: new Date().toISOString(),
  });
  if (error) console.warn("Kontodaten nicht gesichert, bleiben auf dem Gerät.", error.message);
}

/** On start: merge the account's copy into the device, then send the combined state back. */
export async function kontoDatenHolen(): Promise<void> {
  const { data } = await supabase.auth.getSession();
  if (!data.session || !navigator.onLine) return;
  const { data: zeile, error } = await supabase.from("user_state").select("stempel, ausnahmen, stifte").maybeSingle();
  if (error) return;
  let geaendert = false;
  if (zeile) {
    // Stamps: all of both, the earlier date wins.
    const jeId = new Map<string, StempelEintrag>();
    for (const s of [...lesen<StempelEintrag[]>(STEMPEL, []), ...((zeile.stempel as StempelEintrag[]) ?? [])]) {
      const alt = jeId.get(s.id);
      if (!alt || s.gestempeltAm < alt.gestempeltAm) jeId.set(s.id, s);
    }
    const stempel = [...jeId.values()];
    if (stempel.length !== lesen<StempelEintrag[]>(STEMPEL, []).length) {
      localStorage.setItem(STEMPEL, JSON.stringify(stempel));
      geaendert = true;
    }
    const ausnahmen = [...new Set([...lesen<string[]>(AUSNAHMEN, []), ...((zeile.ausnahmen as string[]) ?? [])])].sort();
    if (ausnahmen.length !== lesen<string[]>(AUSNAHMEN, []).length) {
      localStorage.setItem(AUSNAHMEN, JSON.stringify(ausnahmen));
      geaendert = true;
    }
    // Pens: the account's choice, where it has one.
    const s = (zeile.stifte as Stifte | null) ?? {};
    const lokal = lesen<Record<string, unknown>>(EINSTELLUNGEN, {});
    const neu = { ...lokal, ...Object.fromEntries(Object.entries(s).filter(([, v]) => v !== undefined && v !== null)) };
    if (JSON.stringify(neu) !== JSON.stringify(lokal)) {
      localStorage.setItem(EINSTELLUNGEN, JSON.stringify(neu));
      geaendert = true;
    }
  }
  if (geaendert) window.dispatchEvent(new Event(KONTO_DATEN));
  await hochladen();
}
