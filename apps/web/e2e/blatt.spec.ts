import { expect, test, type Page } from "@playwright/test";
import { blattOffen, ohneRueckblick, planDa, prozent, wischen, ziehen } from "./hilfen";
import { serverErsetzen } from "./server";

async function kopfY(page: Page): Promise<number> {
  const box = (await page.locator(".blatt-zug").boundingBox())!;
  return box.y + 30;
}

test.beforeEach(async ({ page }) => {
  await serverErsetzen(page);
  await ohneRueckblick(page);
  await page.goto("/");
  await planDa(page);
  await expect(prozent(page)).toHaveAttribute("aria-label", /Prozent/);
  await expect(blattOffen(page)).toHaveAttribute("aria-expanded", "false");
});

test("Blatt: Tippen auf den Kopf öffnet und schließt", async ({ page }) => {
  await page.locator(".blatt-kopf .gebiet").tap();
  await expect(blattOffen(page)).toHaveAttribute("aria-expanded", "true");
  await page.locator(".blatt-kopf .gebiet").tap();
  await expect(blattOffen(page)).toHaveAttribute("aria-expanded", "false");
});

test("Blatt: schnell hoch und schnell runter wischen", async ({ page }) => {
  // 90 px is less than half the way: only the speed of the swipe decides.
  await wischen(page, 200, await kopfY(page), (await kopfY(page)) - 90, 40);
  await expect(blattOffen(page)).toHaveAttribute("aria-expanded", "true");
  await page.waitForTimeout(400);
  await wischen(page, 200, await kopfY(page), (await kopfY(page)) + 90, 40);
  await expect(blattOffen(page)).toHaveAttribute("aria-expanded", "false");
});

test("Blatt: langsames Ziehen rastet auf der näheren Höhe ein", async ({ page }) => {
  const y = await kopfY(page);
  // A small slow move snaps back to small, a long one up to tall.
  await ziehen(page, 200, y, y - 40);
  await expect(blattOffen(page)).toHaveAttribute("aria-expanded", "false");
  await ziehen(page, 200, y, y - 300);
  await expect(blattOffen(page)).toHaveAttribute("aria-expanded", "true");
});

test("Blatt: aus dem Inhalt herunterziehen", async ({ page }) => {
  await page.locator(".blatt-kopf .gebiet").tap();
  await expect(blattOffen(page)).toHaveAttribute("aria-expanded", "true");
  await page.waitForTimeout(400);
  const inhalt = (await page.locator(".blatt-inhalt").boundingBox())!;
  const y = inhalt.y + 40;
  await ziehen(page, 200, y, y + 250);
  await expect(blattOffen(page)).toHaveAttribute("aria-expanded", "false");
});
