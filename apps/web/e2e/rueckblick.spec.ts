import { expect, test } from "@playwright/test";
import { planDa, prozent } from "./hilfen";
import { serverErsetzen } from "./server";

test("Rückblick läuft, Tipp überspringt, Endstand stimmt", async ({ page }) => {
  await serverErsetzen(page);
  // No visit before: the ways of the last 12 hours are played (all five test ways).
  await page.goto("/");
  await planDa(page);
  const ober = page.locator(".blatt .ober");
  await expect(ober).toContainText("5 Wege");
  await expect(page.getByRole("button", { name: "Überspringen" })).toBeVisible();

  await page.waitForTimeout(1500);
  await page.locator(".maplibregl-canvas").tap({ position: { x: 200, y: 200 } });

  await expect(page.getByRole("button", { name: "Überspringen" })).toBeHidden();
  await expect(ober).not.toContainText("5 Wege");
  // After the replay the plan shows the quarter with the most new streets: Weiden.
  await expect(page.getByRole("heading", { name: "Weiden" })).toBeVisible();
  await expect(prozent(page)).toHaveAttribute("aria-label", "9,8 Prozent");

  // Opening again: nothing new, no replay.
  await page.reload();
  await planDa(page);
  await expect(prozent(page)).toHaveAttribute("aria-label", "9,8 Prozent");
  await page.waitForTimeout(3000);
  await expect(page.getByRole("button", { name: "Überspringen" })).toBeHidden();
});
