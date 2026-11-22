import { decodeTrack, encodeTrack, type EncodedTrack } from "@streifzug/core";
import { alleLaden, einenLaden, melden, speichern, type Streifzug } from "./speicher";
import { kontoDatenHolen } from "./kontoDaten";
import { kontoWeg, supabase } from "./supabase";

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
    for (const s of offen) {
      if (await einen(s, user.id)) continue;
      // The account may no longer exist on the server: start a fresh one and try once more.
      const pruefung = await supabase.auth.getUser();
      if (!kontoWeg(pruefung.error)) continue;
      await supabase.auth.signOut({ scope: "local" });
      const neu = await supabase.auth.signInAnonymously();
      if (neu.data.user) await einen(s, neu.data.user.id);
      break;
    }
  } finally {
    laeuft = false;
  }
}

/** Uploads one outing; true when it is safely stored on the server. */
async function einen(s: Streifzug, userId: string): Promise<boolean> {
  const datei = `${userId}/${s.id}.json.gz`;
  const inhalt = await gzip(JSON.stringify(encodeTrack(s.fixes)));
  const hoch = await supabase.storage.from("spuren").upload(datei, inhalt, { contentType: "application/gzip", upsert: true });
  if (hoch.error) return false;
  const zeile = await supabase.from("tracks").upsert({
    id: s.id,
    user_id: userId,
    started_at: new Date(s.startedAt).toISOString(),
    ended_at: new Date(s.endedAt ?? s.startedAt).toISOString(),
    mode: MODUS[s.mode],
    distance_m: Math.round(s.distanceM),
    file_key: datei,
  });
  if (zeile.error) return false;
  await speichern({ ...s, status: "gesichert" });
  melden();
  return true;
}

/**
 * The other way round: own outings that are on the server but not on this device (new phone, or
 * the phone cleared the app's storage) are fetched back.
 */
async function zurueckholen(): Promise<number> {
  const { data } = await supabase.auth.getSession();
  if (!data.session || !navigator.onLine) return 0;
  const { data: zeilen, error } = await supabase.from("tracks").select("id, started_at, ended_at, mode, distance_m, file_key");
  if (error || !zeilen) return 0;
  let geholt = 0;
  for (const z of zeilen as { id: string; started_at: string; ended_at: string; mode: Streifzug["mode"]; distance_m: number; file_key: string }[]) {
    if (await einenLaden(z.id)) continue;
    const datei = await supabase.storage.from("spuren").download(z.file_key);
    if (datei.error || !datei.data) continue;
    const roh = new Blob([await datei.data.arrayBuffer()]);
    let text: string;
    try {
      text = await new Response(roh.stream().pipeThrough(new DecompressionStream("gzip"))).text();
    } catch {
      text = await roh.text();
    }
    const fixes = decodeTrack(JSON.parse(text) as EncodedTrack);
    await speichern({ id: z.id, startedAt: Date.parse(z.started_at), endedAt: Date.parse(z.ended_at), fixes, distanceM: z.distance_m, mode: z.mode, status: "gesichert" });
    geholt++;
  }
  if (geholt > 0) melden();
  return geholt;
}

/** Upload when the app starts and whenever the network comes back. */
export function hochladenEinrichten() {
  // Ask the phone to keep the app's storage (it may otherwise clear it when space runs low).
  void navigator.storage?.persist?.();
  void hochladen();
  // A little later (the sign-in may still be running): fetch back what is missing here.
  window.setTimeout(() => {
    void hochladen();
    void zurueckholen();
    void kontoDatenHolen();
  }, 4000);
  window.addEventListener("online", () => void hochladen());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void hochladen();
  });
  // Keep trying while something is still only on this device.
  window.setInterval(() => void hochladen(), 60_000);
}
