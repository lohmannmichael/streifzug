import { expect, test } from "@playwright/test";
import { ohneRueckblick, planDa, prozent } from "./hilfen";
import { serverErsetzen } from "./server";

test("Reisen (F6): Freising über eine Nacht ist eine Reise, mit Rückblick", async ({ page }) => {
  // Freising yesterday and today (far from home Köln, a night in between), then back in Weiden.
  await serverErsetzen(page, { kopien: { "Freising zu Fuß": 1 } });
  await ohneRueckblick(page);
  await page.goto("/");
  await planDa(page);
  await expect(prozent(page)).toHaveAttribute("aria-label", "9,8 Prozent");

  await page.getByRole("button", { name: "Pass öffnen" }).tap();
  await page.locator(".pass-zeile", { hasText: "Orte" }).tap();
  await expect(page.getByRole("heading", { name: "Reisen" })).toBeVisible();
  const zeile = page.locator(".ort-zeile", { hasText: "1 Ort" });
  await expect(zeile).toContainText("Freising");
  await zeile.tap();

  // The plan shows the trip, the sheet offers its replay.
  const angebot = page.getByRole("button", { name: "Rückblick dieser Reise" });
  await expect(angebot).toBeVisible();
  await angebot.tap();
  await expect(page.locator(".zeitraum-ende")).toBeVisible();
  await expect(page.locator(".zeitraum-ende")).toContainText("Freising");
  const fertig = page.locator(".zeitraum-ende").getByRole("button", { name: "Fertig" });
  await expect(fertig).toBeVisible({ timeout: 30_000 });
  await fertig.tap();
  await expect(page.locator(".zeitraum-ende")).toBeHidden();
});
