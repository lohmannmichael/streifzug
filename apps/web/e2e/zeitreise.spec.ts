import { expect, test } from "@playwright/test";
import { gelbePixel, ohneRueckblick, planDa, prozent, UEBER_DEM_BLATT, zuDenWegen } from "./hilfen";
import { serverErsetzen } from "./server";

test("Zeitreise (F3): Schieber zurück zeigt weniger Gelb und eine kleinere Zahl", async ({ page }) => {
  // The first walk 40 days ago, the bike ride 10 days ago, the rest today.
  await serverErsetzen(page, { tageZurueck: { "Weiden zu Fuß": 40, "Weiden Rad": 10 } });
  await ohneRueckblick(page);
  await page.goto("/");
  await planDa(page);
  await expect(prozent(page)).toHaveAttribute("aria-label", "9,5 Prozent");
  await zuDenWegen(page);
  await expect.poll(() => gelbePixel(page, UEBER_DEM_BLATT)).toBeGreaterThan(1500);
  const heute = await gelbePixel(page, UEBER_DEM_BLATT);

  await page.getByRole("button", { name: "Pass öffnen" }).tap();
  await page.locator(".pass-zeile", { hasText: "Rückblicke" }).tap();
  await page.getByRole("button", { name: /Zeitreise/ }).tap();

  const leiste = page.locator(".zeitreise");
  await expect(leiste).toBeVisible();
  const schieber = page.getByRole("slider", { name: "Tag der Zeitreise" });
  // First point: 40 days and 10 hours ago; counted in calendar days (one more before 10 am).
  const erster = Date.now() - (40 * 1440 + 600) * 60_000;
  const tage = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(erster).setHours(0, 0, 0, 0)) / 86_400_000);
  await expect(schieber).toHaveAttribute("max", String(tage));
  await expect(leiste.locator(".prozent")).toHaveAttribute("aria-label", "9,5 Prozent");

  // Back to the first day: only the first walk is yellow.
  await schieber.fill("0");
  await expect(leiste.locator(".ober")).toHaveText(new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "long", year: "numeric" }).format(new Date(erster)));
  const ersterTag = await leiste.locator(".prozent").getAttribute("aria-label");
  expect(Number(ersterTag!.replace(" Prozent", "").replace(",", "."))).toBeLessThan(9.8);
  await expect.poll(() => gelbePixel(page, UEBER_DEM_BLATT)).toBeLessThan(heute * 0.9);

  // Zoomed out, the share under the quarter's name follows the slider too.
  const weidenText = () =>
    page.evaluate(`(() => {
      const f = window.__karte.querySourceFeatures("namen-koeln").find((x) => x.properties.name === "Weiden");
      return f ? String(f.properties.pt ?? "") : "fehlt";
    })()`);
  await expect.poll(weidenText).toMatch(/^\d,\d %$/);
  expect(await weidenText()).not.toBe("9,5 %");
  await schieber.fill(String(tage));
  await expect.poll(weidenText).toBe("9,5 %");

  // "Fertig": the sheet and today's yellow are back.
  await leiste.getByRole("button", { name: "Fertig" }).tap();
  await expect(leiste).toBeHidden();
  await expect(prozent(page)).toHaveAttribute("aria-label", "9,5 Prozent");
  await expect.poll(() => gelbePixel(page, UEBER_DEM_BLATT)).toBeGreaterThan(heute * 0.95);
});
