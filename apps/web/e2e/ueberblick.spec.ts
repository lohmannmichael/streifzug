import { expect, test, type Page } from "@playwright/test";
import { ohneRueckblick, planDa, prozent } from "./hilfen";
import { serverErsetzen } from "./server";

const karte = (page: Page, f: string) => page.evaluate(`(() => { const k = window.__karte; ${f} })()`);

test("Deutschland-Blick (F5): weit draußen feine Linien und ein Punkt je Ort, Tipp öffnet den Ort", async ({ page }) => {
  await serverErsetzen(page);
  await ohneRueckblick(page);
  await page.goto("/");
  await planDa(page);
  await expect(prozent(page)).toHaveAttribute("aria-label", "9,5 Prozent");
  await page.waitForTimeout(1500);

  // Zoom 8 over Köln: the ways as fine yellow lines, no quarter areas.
  await karte(page, "k.jumpTo({ center: [6.95, 50.93], zoom: 8 });");
  await expect.poll(() => karte(page, 'return k.queryRenderedFeatures({ layers: ["ueberblick"] }).length;')).toBeGreaterThan(0);
  expect(await karte(page, 'return k.queryRenderedFeatures({ layers: ["entdeckt"] }).length;')).toBe(0);

  // A tap on Köln's point opens Köln.
  await page.waitForTimeout(800);
  const p = (await karte(page, "const p = k.project([6.9673, 50.9577]); return { x: p.x, y: p.y };")) as { x: number; y: number };
  await page.locator(".maplibregl-canvas").tap({ position: { x: p.x, y: p.y } });
  await expect(page.getByRole("heading", { name: "Köln", exact: true })).toBeVisible();
});
