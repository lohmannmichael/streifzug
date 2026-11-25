import { expect, test, type Page } from "@playwright/test";
import { ohneRueckblick, planDa, prozent } from "./hilfen";
import { serverErsetzen } from "./server";

/** Keys of the stored results of all ways on the device. */
const schluessel = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<string[]>((ok) => {
        const req = indexedDB.open("streifzug");
        req.onsuccess = () => {
          const g = req.result.transaction("streifzuege").objectStore("streifzuege").getAll();
          g.onsuccess = () => ok((g.result as { stueckIdsGueltig?: string }[]).map((w) => w.stueckIdsGueltig ?? "").filter(Boolean));
        };
        req.onerror = () => ok([]);
      }),
  );

test("Karten-Update: gespeicherte Ergebnisse werden mit den neuen Kartendaten neu gerechnet", async ({ page }) => {
  const server = await serverErsetzen(page);
  await ohneRueckblick(page);
  await page.goto("/");
  await planDa(page);
  await expect(prozent(page)).toHaveAttribute("aria-label", "9,5 Prozent");
  await expect.poll(async () => (await schluessel(page)).length).toBeGreaterThan(0);
  expect((await schluessel(page)).every((k) => k.includes("20261115_080022_pt"))).toBe(true);

  // OpenFreeMap publishes new map data; on the next opening every way is worked out again.
  server.optionen.kartenStand = "20991231_000000_pt";
  await page.reload();
  await planDa(page);
  await expect.poll(async () => (await schluessel(page)).every((k) => k.includes("20991231_000000_pt")), { timeout: 30_000 }).toBe(true);
  await expect(prozent(page)).toHaveAttribute("aria-label", "9,5 Prozent");
  expect(await page.evaluate(() => localStorage.getItem("streifzug.kartenStand"))).toBe("20991231_000000_pt");
});
