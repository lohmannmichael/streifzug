import { expect, test } from "@playwright/test";
import { ohneRueckblick, planDa, prozent } from "./hilfen";
import { serverErsetzen } from "./server";

test("Rückblicke (F2): drei Kacheln, Monatszeile, ein Zeitraum läuft ab und endet mit den Zahlen", async ({ page }) => {
  // One walk 40 days ago: it lies in an earlier month and shows up as a month row.
  await serverErsetzen(page, { tageZurueck: { "Weiden zu Fuß": 40 } });
  await ohneRueckblick(page);
  await page.goto("/");
  await planDa(page);
  await expect(prozent(page)).toHaveAttribute("aria-label", "9,8 Prozent");

  await page.getByRole("button", { name: "Pass öffnen" }).tap();
  await page.locator(".pass-zeile", { hasText: "Rückblicke" }).tap();
  await expect(page.locator(".zeitraum-kachel")).toHaveCount(3);
  await expect(page.locator(".zeitraum-kachel").first()).toContainText("Diese Woche");
  await expect(page.locator(".monat-zeile").first()).toContainText("km neu");

  // The running year holds every test way (also the one 40 days ago, unless it was last year).
  await page.locator(".zeitraum-kachel").nth(2).tap();
  await expect(page.locator(".zeitraum-ende")).toBeVisible();
  await expect(page.locator(".zeitraum-datum")).toBeVisible();
  // About 10 seconds, then the numbers and "Fertig".
  const fertig = page.locator(".zeitraum-ende").getByRole("button", { name: "Fertig" });
  await expect(fertig).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(".zeitraum-zahlen")).toContainText("neu gesehen");
  await fertig.tap();
  await expect(page.locator(".zeitraum-ende")).toBeHidden();
  await expect(prozent(page)).toHaveAttribute("aria-label", "9,8 Prozent");
});
