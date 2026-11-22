import { expect, test } from "@playwright/test";
import { gelbePixel, ohneRueckblick, planDa, prozent, UEBER_DEM_BLATT, zuDenWegen } from "./hilfen";
import { serverErsetzen } from "./server";

test("Netz aus: Offline-Zeile, danach wieder normal", async ({ page, context }) => {
  await serverErsetzen(page);
  await ohneRueckblick(page);
  await page.goto("/");
  await planDa(page);
  await expect(prozent(page)).toHaveAttribute("aria-label", "9,8 Prozent");
  await context.setOffline(true);
  await expect(page.getByText("Offline. Neue Wege kommen, sobald Netz da ist.")).toBeVisible();
  await expect(prozent(page)).toHaveAttribute("aria-label", "9,8 Prozent");
  await context.setOffline(false);
  await expect(page.getByText("Offline. Neue Wege kommen, sobald Netz da ist.")).toBeHidden();
});

test("Kartendienst aus: graue Fläche, „Nochmal“ holt den Plan", async ({ page }) => {
  const server = await serverErsetzen(page, { karteAus: true });
  await ohneRueckblick(page);
  await page.goto("/");
  await expect(page.getByText("Der Plan lädt gerade nicht. Deine Wege sind sicher.")).toBeVisible();
  server.optionen.karteAus = false;
  await page.getByRole("button", { name: "Nochmal", exact: true }).tap();
  await expect(page.getByText("Der Plan lädt gerade nicht. Deine Wege sind sicher.")).toBeHidden();
  await zuDenWegen(page);
  await expect.poll(() => gelbePixel(page, UEBER_DEM_BLATT), { timeout: 20_000 }).toBeGreaterThan(1500);
});

test("Einrechnen schlägt fehl: Hinweis, „Nochmal versuchen“ rechnet ein", async ({ page }) => {
  const server = await serverErsetzen(page, { strassenAus: true });
  await ohneRueckblick(page);
  await page.goto("/");
  await planDa(page);
  await expect(page.getByText("Neue Wege ließen sich gerade nicht einrechnen. Deine Wege sind sicher.")).toBeVisible({ timeout: 30_000 });
  server.optionen.strassenAus = false;
  await page.getByRole("button", { name: "Nochmal versuchen" }).tap();
  await expect(prozent(page)).toHaveAttribute("aria-label", "9,8 Prozent");
  await expect(page.getByText("Neue Wege ließen sich gerade nicht einrechnen.")).toBeHidden();
});
