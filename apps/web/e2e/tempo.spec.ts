/**
 * Speed with a year of data (Bauplan 3, E3). Not part of the normal check: it needs the year
 * data set (`npx tsx apps/web/e2e/werkzeuge/jahr-erzeugen.ts`), loads street tiles from the
 * network and takes minutes. Run with `MESSEN=1 npx playwright test e2e/tempo.spec.ts`.
 * The phone is imitated by a four times slower CPU (Chrome DevTools throttling).
 */
import { expect, test, type Page } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { gelbePixel, ohneRueckblick, UEBER_DEM_BLATT } from "./hilfen";
import { serverErsetzen, type ServerOptionen } from "./server";

const DATEI = new URL("./daten/jahr.json", import.meta.url);
test.skip(!process.env.MESSEN || !existsSync(DATEI), "nur mit MESSEN=1 und Jahresdaten");
test.setTimeout(30 * 60_000);

interface P {
  vorMin: number;
  lon: number;
  lat: number;
  acc: number;
  motion: string[];
  speed: number;
}

async function bremsen(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  return cdp;
}

/** Milliseconds from now until `bedingung` holds (checked as often as possible). */
async function bis(bedingung: () => Promise<boolean>, maxMs: number): Promise<number> {
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    if (await bedingung()) return Date.now() - t0;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error("Zeit abgelaufen");
}

const rechnetNoch = (page: Page) => page.getByText(/eingerechnet/).isVisible();
const prozent = (page: Page) => page.locator(".blatt .prozent").getAttribute("aria-label");

test("ein Jahr Wege: Öffnen, Einrechnen, Speicher", async ({ page }) => {
  const jahr = JSON.parse(readFileSync(DATEI, "utf8")) as P[];
  const jetzt = Date.now();
  // A normal day: three new ways of the last day again, two hours ago.
  const tag = jahr.filter((p) => p.vorMin < 1440).map((p) => ({ ...p, vorMin: p.vorMin - 1440 + 120 }));
  let punkte = jahr;
  const optionen: ServerOptionen = {};
  await serverErsetzen(page, optionen);
  await page.route("https://tiles.openfreemap.org/**", (r) => r.continue());
  await page.route("https://*.supabase.co/rest/v1/received_points**", (r) => {
    const u = new URL(r.request().url());
    const zeilen = punkte
      .map((p) => ({ t: new Date(jetzt - p.vorMin * 60_000).toISOString(), lon: p.lon, lat: p.lat, acc: p.acc, motion: p.motion, speed: p.speed }))
      .sort((a, b) => a.t.localeCompare(b.t));
    if (u.searchParams.get("order") === "t.desc") return r.fulfill({ json: zeilen.slice(-1) });
    const ab = u.searchParams.get("t");
    const rest = ab?.startsWith("gt.") ? zeilen.filter((z) => z.t > ab.slice(3)) : zeilen;
    return r.fulfill({ json: rest.slice(0, 1000) });
  });
  await ohneRueckblick(page);
  const cdp = await bremsen(page);
  const werte: Record<string, number | string> = {};

  // 1. First start: fetch all points and calculate everything (like after a new ABGLEICH_VERSION).
  await page.goto("/");
  werte["Erster Start: alles eingerechnet (s)"] = (await bis(async () => (await prozent(page)) !== "0 Prozent" && !(await rechnetNoch(page)), 25 * 60_000)) / 1000;
  werte["Prozent Weiden"] = (await prozent(page)) ?? "";

  // 2. Opening again: plan with the last state, yellow, everything up to date.
  const t0 = Date.now();
  await page.reload({ waitUntil: "commit" });
  const marken: Record<string, number> = {};
  for (let i = 0; i < 400 && Object.keys(marken).length < 4; i++) {
    const z = Date.now() - t0;
    if (!marken.canvas && (await page.locator("canvas.maplibregl-canvas").isVisible().catch(() => false))) marken.canvas = z;
    if (!marken.name && ((await page.locator(".blatt h1").textContent().catch(() => "")) ?? "").trim()) marken.name = z;
    if (!marken.prozent && (await prozent(page).catch(() => null))) marken.prozent = z;
    if (!marken.endProzent && (await prozent(page).catch(() => null)) === werte["Prozent Weiden"]) marken.endProzent = z;
    await new Promise((r) => setTimeout(r, 25));
  }
  werte["Öffnen: Prozent da, Plan da, Name da, endgültige Zahl (ms)"] = JSON.stringify(marken);
  werte["Stand im Speicher"] = await page.evaluate(
    () =>
      new Promise<string>((ok) => {
        const t = performance.now();
        const req = indexedDB.open("streifzug-stand");
        req.onsuccess = () => {
          const g = req.result.transaction("stand").objectStore("stand").get("letzter");
          g.onsuccess = () => ok(`${Math.round(performance.now() - t)} ms, ${g.result ? JSON.stringify(g.result).length : 0} Zeichen, ${g.result?.stand?.stuecke?.length} Stücke`);
        };
        req.onerror = () => ok("fehlt");
      }),
  );
  await bis(async () => !(await rechnetNoch(page)), 120_000);
  werte["Öffnen: fertig (s)"] = (Date.now() - t0) / 1000;
  // Yellow at fixed times after opening (a screenshot itself takes a while on the slow CPU).
  for (const nach of [1000, 1500, 2000, 3000]) {
    const t = Date.now();
    await page.reload({ waitUntil: "commit" });
    await page.waitForTimeout(nach - (Date.now() - t));
    const gelb = await gelbePixel(page, UEBER_DEM_BLATT);
    werte[`Gelb nach ${nach} ms`] = gelb > 0 ? "ja" : "nein";
    if (gelb > 0) break;
  }
  await cdp.send("Performance.enable");
  const metriken = (await cdp.send("Performance.getMetrics")) as { metrics: { name: string; value: number }[] };
  const heap = metriken.metrics.find((m) => m.name === "JSHeapUsedSize")?.value ?? 0;
  werte["Speicher Seite (MB)"] = Math.round(heap / 1e6);

  // 3. A normal day: three new ways arrive while opening.
  punkte = [...jahr, ...tag];
  const t1 = Date.now();
  await page.reload();
  await bis(async () => (await page.getByText(/eingerechnet/).isVisible()) || (await prozent(page)) !== werte["Prozent Weiden"], 120_000).catch(() => 0);
  await bis(async () => !(await rechnetNoch(page)) && (await prozent(page)) !== "0 Prozent", 300_000);
  werte["Neuer Tag (3 Wege): eingerechnet nach Öffnen (s)"] = (Date.now() - t1) / 1000;

  console.log("MESSUNG", JSON.stringify(werte, null, 1));
  expect(Object.keys(werte).length).toBeGreaterThan(0);
});
