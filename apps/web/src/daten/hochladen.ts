import { encodeTrack } from "@streifzug/core";
import { alleLaden, melden, speichern, type Streifzug } from "./speicher";
import { supabase } from "./supabase";

const MODUS = { foot: "foot", bike: "bike", car: "car" } as const;

async function gzip(text: string): Promise<Blob> {
  const strom = new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"));
  // The storage only accepts gzip files, so the type must be set explicitly.
  return new Blob([await new Response(strom).arrayBuffer()], { type: "application/gzip" });
}

let laeuft = false;

/**
 * Uploads every finished outing that is only on this device: the compressed raw file to
 * Storage (spuren/<user>/<id>.json.gz), then the summary row. Safe to repeat: ids come from the device.
 */
export async function hochladen(): Promise<void> {
  if (laeuft || !navigator.onLine) return;
  laeuft = true;
  try {
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user;
    if (!user) return;
    const offen = (await alleLaden()).filter((s) => s.status === "lokal");
    for (const s of offen) await einen(s, user.id);
  } finally {
    laeuft = false;
  }
}

async function einen(s: Streifzug, userId: string) {
  const datei = `${userId}/${s.id}.json.gz`;
  const inhalt = await gzip(JSON.stringify(encodeTrack(s.fixes)));
  const hoch = await supabase.storage.from("spuren").upload(datei, inhalt, { contentType: "application/gzip", upsert: true });
  if (hoch.error) return;
  const zeile = await supabase.from("tracks").upsert({
    id: s.id,
    user_id: userId,
    started_at: new Date(s.startedAt).toISOString(),
    ended_at: new Date(s.endedAt ?? s.startedAt).toISOString(),
    mode: MODUS[s.mode],
    distance_m: Math.round(s.distanceM),
    file_key: datei,
  });
  if (zeile.error) return;
  await speichern({ ...s, status: "gesichert" });
  melden();
}

/** Upload when the app starts and whenever the network comes back. */
export function hochladenEinrichten() {
  void hochladen();
  window.addEventListener("online", () => void hochladen());
}
