import { expect, test } from "@playwright/test";
import { gelbePixel, ohneRueckblick, planDa, prozent, UEBER_DEM_BLATT } from "./hilfen";
import { serverErsetzen } from "./server";

test("Pass → Orte → Freising: der Plan zeigt Freising", async ({ page }) => {
  await serverErsetzen(page);
  await ohneRueckblick(page);
  await page.goto("/");
  await planDa(page);
  await expect(prozent(page)).toHaveAttribute("aria-label", /Prozent/);

  await page.getByRole("button", { name: "Pass öffnen" }).tap();
  await expect(page.getByRole("heading", { name: "Dein Pass" })).toBeVisible();
  await page.locator(".pass-zeile", { hasText: "Orte" }).tap();
  await expect(page.locator(".ort-zeile")).toHaveCount(2);
  // Köln has the most yellow metres and is home; Freising comes under "Weitere Orte".
  await expect(page.locator(".ort-zeile").first()).toContainText("Köln");
  await page.locator(".ort-zeile", { hasText: "Freising" }).tap();

  await expect(page.getByRole("heading", { name: "Freising", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Dein Pass" })).toBeHidden();
  // The entered quarter is hatched in highlighter yellow when the whole town is in view.
  await expect.poll(() => gelbePixel(page, UEBER_DEM_BLATT), { timeout: 10_000 }).toBeGreaterThan(50);
});
