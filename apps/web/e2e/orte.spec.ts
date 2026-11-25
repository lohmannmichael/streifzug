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

// Places far from the start view (Weiden): never loaded on a fresh start. Neighbours in view
// (Frechen, Pulheim) may come with the view, as intended (E4).
const WEIT_WEG = ["freising", "hameln", "emmerthal", "new-york", "leverkusen", "bergisch-gladbach", "dormagen", "wesseling"];

test("frischer Start ohne Wege lädt nur Köln und Orte im Blick", async ({ page }) => {
  const orte = orteMitschreiben(page);
  await serverErsetzen(page, { wege: [] });
  await page.goto("/");
  await planDa(page);
  await expect(page.getByRole("heading", { name: "Weiden" })).toBeVisible();
  await expect(prozent(page)).toHaveAttribute("aria-label", "0 Prozent");
  await page.waitForTimeout(2000);
  expect(orte.has("koeln")).toBe(true);
  expect([...orte].filter((o) => WEIT_WEG.includes(o))).toEqual([]);
});

test("Start mit Wegen lädt die Orte mit Wegen (Köln, Freising), nichts weit weg", async ({ page }) => {
  const orte = orteMitschreiben(page);
  await serverErsetzen(page);
  await ohneRueckblick(page);
  await page.goto("/");
  await planDa(page);
  await expect(prozent(page)).toHaveAttribute("aria-label", "9,5 Prozent");
  await expect.poll(() => orte.has("freising")).toBe(true);
  await page.waitForTimeout(1500);
  expect(orte.has("koeln")).toBe(true);
  expect([...orte].filter((o) => WEIT_WEG.includes(o) && o !== "freising")).toEqual([]);
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
