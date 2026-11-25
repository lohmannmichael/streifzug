import { expect, test } from "@playwright/test";
import { ohneRueckblick, planDa, prozent } from "./hilfen";
import { serverErsetzen } from "./server";

// Standing in the Erkelenzhofweg: the test ways walk all of its counted part.
test.use({ geolocation: { latitude: 50.9341, longitude: 6.8247 } });

test("Straße komplett (F4): Name unterlegt, Schild sagt „komplett seit“", async ({ page }) => {
  await serverErsetzen(page);
  await ohneRueckblick(page);
  await page.goto("/");
  await planDa(page);
  await expect(prozent(page)).toHaveAttribute("aria-label", "9,5 Prozent");
  // The complete streets come with the calculation; then go there.
  await page.waitForTimeout(3000);
  await page.getByRole("button", { name: "Zu meinem Standort" }).tap();
  await page.waitForTimeout(2500);
  // The hook at the end of the street, right of the position.
  await page.locator(".maplibregl-canvas").tap({ position: { x: 215, y: 165 } });
  const schild = page.locator(".schild");
  await expect(schild).toBeVisible();
  await expect(schild).toContainText("Erkelenzhofweg");
  await expect(schild).toContainText(/komplett seit \d+\. \w+\.? \d{4}/);
});
