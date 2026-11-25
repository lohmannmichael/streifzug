import { expect, test } from "@playwright/test";
import { ohnePolaroid, planDa, prozent } from "./hilfen";
import { serverErsetzen } from "./server";

test("Rückblick läuft, Tipp überspringt, Endstand stimmt", async ({ page }) => {
  await serverErsetzen(page);
  await ohnePolaroid(page);
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

test("Rückblick fährt alle Wege nach (Drohne, ruhig schwebend): höchstens 40 Sekunden, Endstand wie sonst", async ({ page }) => {
  test.setTimeout(120_000);
  await serverErsetzen(page);
  await ohnePolaroid(page);
  await page.goto("/");
  await planDa(page);
  const ueberspringen = page.getByRole("button", { name: "Überspringen" });
  await expect(ueberspringen).toBeVisible();
  const start = Date.now();
  // On top: the new meters run up, and the name of a street just turned yellow shows (Drohne, 24.11.2026).
  await expect(page.locator(".rb-meter")).toContainText(/neu$/, { timeout: 20_000 });
  await expect(page.locator(".rb-zeile").first()).toContainText(/^(Neu|Komplett): /, { timeout: 20_000 });
  await expect(ueberspringen).toBeHidden({ timeout: 90_000 });
  // At most 40 s for the ways (exactly checked in the core tests: planeDrohne), plus the look from
  // above, the flights between ways and the closing zoom; the test browser draws without a
  // graphics chip and is slower when tests run side by side.
  expect(Date.now() - start).toBeLessThan(75_000);
  await expect(page.getByRole("heading", { name: "Weiden" })).toBeVisible();
  await expect(prozent(page)).toHaveAttribute("aria-label", "9,8 Prozent");
});

test("Polaroid beim Öffnen: Bild je Weg, Datum und Zeile, blättern, schließen (Michi, 25.11.2026)", async ({ page }) => {
  test.setTimeout(120_000);
  await serverErsetzen(page);
  await page.goto("/");
  await planDa(page);
  const polaroid = page.getByRole("dialog", { name: "Rückblick" });
  await expect(polaroid).toBeVisible({ timeout: 20_000 });
  await expect(polaroid.locator(".polaroid-datum")).toHaveText(/^(Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag), \d{1,2}\. \w+/);
  await expect(polaroid.locator(".polaroid-zeile")).toContainText(/(km| m)/);
  // The five test ways of the last 12 hours: one picture per way (or per day around midnight).
  const punkte = polaroid.locator(".polaroid-punkt");
  expect(await punkte.count()).toBeGreaterThan(1);
  await expect(punkte.first()).toHaveAttribute("aria-current", "true");
  // The first picture draws, and something new turns up below.
  await expect(polaroid.locator(".polaroid-zeile")).toContainText(/neu$/, { timeout: 40_000 });
  await polaroid.getByRole("button", { name: "Nächstes Bild" }).click();
  await expect(punkte.nth(1)).toHaveAttribute("aria-current", "true");
  await polaroid.getByRole("button", { name: "Rückblick schließen" }).click();
  await expect(polaroid).toBeHidden();
  await expect(prozent(page)).toHaveAttribute("aria-label", "9,8 Prozent");
});
