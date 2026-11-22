import { expect, test } from "@playwright/test";
import { fehlerSammeln, gelbePixel, ohneRueckblick, planDa, prozent, UEBER_DEM_BLATT } from "./hilfen";
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
  await expect.poll(() => gelbePixel(page, UEBER_DEM_BLATT)).toBeGreaterThan(GELB_MINDESTENS);
  expect(fehler).toEqual([]);
});

test("Karte lädt verzögert: Gelb ist danach trotzdem da (Fehler vom 20.11.)", async ({ page }) => {
  await serverErsetzen(page, { stilVerzoegerung: 6000 });
  await ohneRueckblick(page);
  await page.goto("/");
  // The ways are calculated before the map style arrives.
  await expect(prozent(page)).toHaveAttribute("aria-label", WEIDEN_PROZENT);
  await expect.poll(() => gelbePixel(page, UEBER_DEM_BLATT), { timeout: 20_000 }).toBeGreaterThan(GELB_MINDESTENS);
});
