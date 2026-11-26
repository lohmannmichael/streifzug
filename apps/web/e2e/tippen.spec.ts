import { expect, test } from "@playwright/test";
import { gelbSuchen, ohneRueckblick, planDa, prozent, UEBER_DEM_BLATT, zuDenWegen } from "./hilfen";
import { serverErsetzen } from "./server";

test.beforeEach(async ({ page }) => {
  await serverErsetzen(page);
  await ohneRueckblick(page);
  await page.goto("/");
  await planDa(page);
  await expect(prozent(page)).toHaveAttribute("aria-label", "9,8 Prozent");
});

test("Herausgezoomt: Tipp auf ein Viertel wählt es", async ({ page }) => {
  // Köln as a whole (Pass → Orte), then a tap in the middle of the plan picks a quarter there.
  await page.getByRole("button", { name: "Pass öffnen" }).tap();
  await page.locator(".pass-zeile", { hasText: "Orte" }).tap();
  await page.locator(".ort-zeile", { hasText: "Köln" }).tap();
  await expect(page.getByRole("heading", { name: "Köln", exact: true })).toBeVisible();
  await page.waitForTimeout(1500);
  await page.touchscreen.tap(195, 200);
  await expect(page.locator(".blatt h1")).not.toHaveText(/^(Köln|Weiden)$/);
  await expect(page.locator(".blatt .ober")).toContainText("Köln");
});

test("Nah dran: Tipp auf eine gelbe Straße zeigt ihr Schild, Ziehen schließt es", async ({ page }) => {
  await zuDenWegen(page);
  const { punkt } = await gelbSuchen(page, UEBER_DEM_BLATT);
  expect(punkt).not.toBeNull();
  await page.touchscreen.tap(punkt!.x, punkt!.y);
  const schild = page.locator(".schild");
  // Without waiting for anything else to change on the page (fixed in E2).
  await expect(schild).toBeVisible({ timeout: 3000 });
  await expect(schild).toContainText("gegangen am");
  await page.mouse.move(200, 120);
  await page.mouse.down();
  await page.mouse.move(200, 220, { steps: 5 });
  await page.mouse.up();
  await expect(schild).toBeHidden();
});
