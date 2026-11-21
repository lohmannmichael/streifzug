// Receives location batches from the Overland iPhone app (https://overland.p3k.io).
// Overland posts {"locations": [GeoJSON Point features]} with the token from the setup link,
// as "Authorization: Bearer <token>" or "?token=<token>". Answering {"result":"ok"} tells
// Overland the batch is stored and may be deleted on the phone.
import { createClient } from "npm:@supabase/supabase-js@2";

const MAX_PUNKTE = 2000;

function antwort(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

async function sha256(text: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

interface Feature {
  geometry?: { type?: string; coordinates?: unknown };
  properties?: { timestamp?: string; horizontal_accuracy?: number };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return antwort({ error: "method not allowed" }, 405);
  const token = new URL(req.url).searchParams.get("token") ?? req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (token.length < 32) return antwort({ error: "unauthorized" }, 401);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const hash = await sha256(token);
  const { data: besitzer } = await admin.from("receive_tokens").select("user_id").eq("token_hash", hash).maybeSingle();
  if (!besitzer) return antwort({ error: "unauthorized" }, 401);

  let body: { locations?: Feature[] };
  try {
    body = await req.json();
  } catch {
    return antwort({ error: "invalid json" }, 400);
  }
  const punkte = (Array.isArray(body.locations) ? body.locations : []).slice(0, MAX_PUNKTE).flatMap((f) => {
    const c = f.geometry?.type === "Point" && Array.isArray(f.geometry.coordinates) ? f.geometry.coordinates : null;
    const t = f.properties?.timestamp ? Date.parse(f.properties.timestamp) : NaN;
    if (!c || typeof c[0] !== "number" || typeof c[1] !== "number" || Number.isNaN(t)) return [];
    if (Math.abs(c[0]) > 180 || Math.abs(c[1]) > 90) return [];
    const acc = f.properties?.horizontal_accuracy;
    return [{ user_id: besitzer.user_id, t: new Date(t).toISOString(), lon: c[0], lat: c[1], acc: typeof acc === "number" && acc >= 0 ? acc : null }];
  });

  if (punkte.length > 0) {
    // A batch may be resent; points already stored (same user and time) are skipped.
    const { error } = await admin.from("received_points").upsert(punkte, { onConflict: "user_id,t", ignoreDuplicates: true });
    if (error) return antwort({ error: "could not store" }, 500);
  }
  await admin.from("receive_tokens").update({ last_used_at: new Date().toISOString() }).eq("token_hash", hash);
  return antwort({ result: "ok", saved: punkte.length });
});
