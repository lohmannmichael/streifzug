import { expect, test, type Page } from "@playwright/test";
import { ohneRueckblick, planDa, prozent } from "./hilfen";
import { serverErsetzen } from "./server";

/** Places only when needed (Bauplan 3, E4): which place files the app fetches. */
function orteMitschreiben(page: Page): Set<string> {
  const orte = new Set<string>();
  page.on("request", (r) => {
    const pfad = new URL(r.url()).pathname;
    const ort = /^\/regionen\/([^/]+)\//.exec(pfad)?.[1];
    if (ort) orte.add(ort);
  });
  return orte;
}

test("frischer Start ohne Wege lädt nur Köln", async ({ page }) => {
  const orte = orteMitschreiben(page);
  await serverErsetzen(page, { wege: [] });
  await page.goto("/");
  await planDa(page);
  await expect(page.getByRole("heading", { name: "Weiden" })).toBeVisible();
  await expect(prozent(page)).toHaveAttribute("aria-label", "0 Prozent");
  await page.waitForTimeout(2000);
  expect([...orte]).toEqual(["koeln"]);
});

test("Start mit Wegen lädt nur die Orte mit Wegen (Köln, Freising)", async ({ page }) => {
  const orte = orteMitschreiben(page);
  await serverErsetzen(page);
  await ohneRueckblick(page);
  await page.goto("/");
  await planDa(page);
  await expect(prozent(page)).toHaveAttribute("aria-label", "9,8 Prozent");
  await expect.poll(() => orte.has("freising")).toBe(true);
  await page.waitForTimeout(1500);
  expect([...orte].sort()).toEqual(["freising", "koeln"]);
});

test("zuletzt gewählter Ort wird beim Öffnen geladen", async ({ page }) => {
  const orte = orteMitschreiben(page);
  await serverErsetzen(page, { wege: [] });
  await page.addInitScript(() => {
    // Lerchenfeld in Freising, chosen in an earlier visit.
    localStorage.setItem("streifzug.gebiet", "721aa80e-8915-48dc-a80c-6b7e88124851");
    localStorage.setItem("streifzug.gebietOrt", "freising");
  });
  await page.goto("/");
  await planDa(page);
  await expect(page.getByRole("heading", { name: "Lerchenfeld" })).toBeVisible();
  expect(orte.has("freising")).toBe(true);
  expect(orte.has("hameln")).toBe(false);
});
