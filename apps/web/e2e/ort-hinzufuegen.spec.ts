import { expect, test, type Page } from "@playwright/test";
import { ohneRueckblick, planDa, prozent } from "./hilfen";
import { serverErsetzen } from "./server";

/** The place search (Photon) answers with fixed places. */
async function sucheErsetzen(page: Page) {
  const ort = (name: string, state: string, lon: number, lat: number, osm_value = "town") => ({
    type: "Feature",
    properties: { name, state, country: "Deutschland", osm_key: "place", osm_value },
    geometry: { type: "Point", coordinates: [lon, lat] },
  });
  await page.route("https://photon.komoot.io/**", (r) => {
    const q = new URL(r.request().url()).searchParams.get("q") ?? "";
    const alle = [
      ort("Hürth", "Nordrhein-Westfalen", 6.8761, 50.8771),
      ort("Hürtgenwald", "Nordrhein-Westfalen", 6.36, 50.71, "village"),
      ort("Freising", "Bayern", 11.7489, 48.4029),
      { type: "Feature", properties: { name: "Hürther Straße", osm_key: "highway", osm_value: "residential" }, geometry: { type: "Point", coordinates: [6.9, 50.9] } },
    ];
    return r.fulfill({ json: { features: alle.filter((f) => f.properties.name.toLowerCase().startsWith(q.toLowerCase().slice(0, 3))) }, headers: { "access-control-allow-origin": "*" } });
  });
}

test("Ort hinzufügen: suchen, vormerken, schon vorhandene Orte öffnen", async ({ page }) => {
  const server = await serverErsetzen(page);
  await sucheErsetzen(page);
  await ohneRueckblick(page);
  await page.goto("/");
  await planDa(page);
  await expect(prozent(page)).toHaveAttribute("aria-label", "9,8 Prozent");
  await page.getByRole("button", { name: "Pass öffnen" }).tap();
  await page.locator(".pass-zeile", { hasText: "Orte" }).tap();

  const suche = page.getByRole("searchbox", { name: "Stadt oder Gemeinde" });
  await suche.fill("Hürt");
  // Only towns and villages, no streets.
  await expect(page.locator(".ort-hinzufuegen .ort-zeile")).toHaveCount(2);
  await page.locator(".ort-hinzufuegen .ort-zeile", { hasText: "Hürtgenwald" }).tap();
  await expect(page.getByRole("status")).toContainText("Hürtgenwald ist vorgemerkt");
  expect(server.wuensche).toEqual([{ name: "Hürtgenwald", lon: 6.36, lat: 50.71 }]);
  await expect(page.locator(".ort-vorbereitet", { hasText: "Hürtgenwald" })).toContainText("vorgemerkt");

  // A place that is there already opens on the plan (Hürth since the Umkreis, 23.11.2026).
  await suche.fill("Hürth");
  await page.locator(".ort-hinzufuegen .ort-zeile", { hasText: /^Hürth/ }).first().tap();
  await expect(page.getByRole("heading", { name: "Hürth", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Pass öffnen" }).tap();
  await page.locator(".pass-zeile", { hasText: "Orte" }).tap();
  await suche.fill("Freising");
  await page.locator(".ort-hinzufuegen .ort-zeile", { hasText: "Freising" }).tap();
  await expect(page.getByRole("heading", { name: "Freising", exact: true })).toBeVisible();
});
