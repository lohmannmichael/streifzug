import { expect, test } from "@playwright/test";
import { planDa } from "./hilfen";
import { serverErsetzen } from "./server";

test("Öffnen beginnt am letzten Standort, nicht am zuletzt gewählten Ort", async ({ page }) => {
  await serverErsetzen(page, { wege: [] });
  await page.addInitScript(() => {
    // Chosen last: Lerchenfeld in Freising. Last known place: Weiden (newer than anything on the server).
    localStorage.setItem("streifzug.gebiet", "721aa80e-8915-48dc-a80c-6b7e88124851");
    localStorage.setItem("streifzug.gebietOrt", "freising");
    localStorage.setItem("streifzug.letzterOrt", JSON.stringify({ punkt: [6.8285, 50.9395], t: Date.now() + 3600_000 }));
  });
  await page.goto("/");
  await planDa(page);
  await expect(page.getByRole("heading", { name: "Weiden" })).toBeVisible();
  await page.waitForTimeout(2000);
  await expect(page.getByRole("heading", { name: "Lerchenfeld" })).toBeHidden();
  // The map stayed at Weiden (no jump to Freising).
  const mitte = (await page.evaluate("(() => { const c = window.__karte.getCenter(); return [c.lng, c.lat]; })()")) as [number, number];
  expect(Math.abs(mitte[0] - 6.8285)).toBeLessThan(0.02);
  expect(Math.abs(mitte[1] - 50.9395)).toBeLessThan(0.02);
});
