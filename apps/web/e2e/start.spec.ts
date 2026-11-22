import { expect, test } from "@playwright/test";
import { fehlerSammeln, gelbePixel, ohneRueckblick, planDa, prozent, UEBER_DEM_BLATT, zuDenWegen } from "./hilfen";
import { serverErsetzen } from "./server";

// Weiden with the three test ways and the car ride (fixed data, fixed recorded street tiles).
const WEIDEN_PROZENT = "9,8 Prozent";
// Clearly more than none: the three ways leave a few thousand yellow pixels above the sheet.
const GELB_MINDESTENS = 1500;

test("erster Start ohne Wege: Satz erscheint, kein Fehler", async ({ page }) => {
  const fehler = fehlerSammeln(page);
  await serverErsetzen(page, { wege: [] });
  await page.goto("/");
  await planDa(page);
  await expect(page.getByRole("heading", { name: "Weiden" })).toBeVisible();
  await expect(page.getByText("Geh eine Straße entlang. Sie wird gelb.")).toBeVisible();
  await expect(prozent(page)).toHaveAttribute("aria-label", "0 Prozent");
  await page.waitForTimeout(2000);
  expect(await gelbePixel(page, UEBER_DEM_BLATT)).toBe(0);
  expect(fehler).toEqual([]);
});

test("Start mit Wegen: Gelb auf dem Plan, Prozent stimmt", async ({ page }) => {
  const fehler = fehlerSammeln(page);
  await serverErsetzen(page);
  await ohneRueckblick(page);
  await page.goto("/");
  await planDa(page);
  await expect(prozent(page)).toHaveAttribute("aria-label", WEIDEN_PROZENT);
  await zuDenWegen(page);
  await expect.poll(() => gelbePixel(page, UEBER_DEM_BLATT)).toBeGreaterThan(GELB_MINDESTENS);
  expect(fehler).toEqual([]);
});

test("Karte lädt verzögert: Gelb ist danach trotzdem da (Fehler vom 20.11.)", async ({ page }) => {
  await serverErsetzen(page, { stilVerzoegerung: 6000 });
  await ohneRueckblick(page);
  await page.goto("/");
  // The ways are calculated before the map style arrives.
  await expect(prozent(page)).toHaveAttribute("aria-label", WEIDEN_PROZENT);
  await zuDenWegen(page);
  await expect.poll(() => gelbePixel(page, UEBER_DEM_BLATT), { timeout: 20_000 }).toBeGreaterThan(GELB_MINDESTENS);
});

test("Öffnen zeigt sofort den letzten Stand, auch wenn Straßendaten nicht kommen (E3)", async ({ page }) => {
  const server = await serverErsetzen(page);
  await ohneRueckblick(page);
  await page.goto("/");
  await expect(prozent(page)).toHaveAttribute("aria-label", WEIDEN_PROZENT);
  // Into the background: the state is saved.
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  // Wait until the state with the ways is stored on the device.
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          new Promise<number>((ok) => {
            const req = indexedDB.open("streifzug-stand");
            req.onsuccess = () => {
              const g = req.result.transaction("stand").objectStore("stand").get("letzter");
              g.onsuccess = () => ok(g.result?.stand?.stuecke?.length ?? 0);
              g.onerror = () => ok(0);
            };
            req.onerror = () => ok(0);
          }),
      ),
    )
    .toBeGreaterThan(0);
  server.optionen.strassenAus = true;
  await page.reload();
  await expect(prozent(page)).toHaveAttribute("aria-label", WEIDEN_PROZENT, { timeout: 5000 });
  await zuDenWegen(page);
  await expect.poll(() => gelbePixel(page, UEBER_DEM_BLATT)).toBeGreaterThan(GELB_MINDESTENS);
});
