import { expect, type Page } from "@playwright/test";

/** Highlighter yellow (default pen) as drawn on the plan. */
const GELB = [0xff, 0xe8, 0x3a];

/**
 * Counts highlighter-yellow pixels on screen (a screenshot, decoded in the browser). The map
 * canvas cannot be read directly (WebGL), the screenshot shows what a person sees.
 */
export async function gelbePixel(page: Page, bereich?: { x: number; y: number; width: number; height: number }): Promise<number> {
  const bild = (await page.screenshot(bereich ? { clip: bereich } : {})).toString("base64");
  return page.evaluate(
    async ({ bild, gelb }) => {
      const b = await createImageBitmap(await (await fetch(`data:image/png;base64,${bild}`)).blob());
      const c = new OffscreenCanvas(b.width, b.height);
      const x = c.getContext("2d")!;
      x.drawImage(b, 0, 0);
      const d = x.getImageData(0, 0, b.width, b.height).data;
      let n = 0;
      for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i]! - gelb[0]!) < 24 && Math.abs(d[i + 1]! - gelb[1]!) < 24 && Math.abs(d[i + 2]! - gelb[2]!) < 40) n++;
      return n;
    },
    { bild, gelb: GELB },
  );
}

/**
 * Before the app starts: no replay. What arrives counts by the time it arrived (Overland sends
 * late), so "seen up to" lies an hour ahead.
 */
export async function ohneRueckblick(page: Page) {
  await page.addInitScript(() => {
    if (!localStorage.getItem("streifzug.rueckblick-bis")) localStorage.setItem("streifzug.rueckblick-bis", String(Date.now() + 3600_000));
  });
}

/** The sheet's big percentage (as read by VoiceOver: "3,4 Prozent"). */
export const prozent = (page: Page) => page.locator(".blatt .prozent");

/** Waits until the map has drawn (MapLibre's canvas is there and the plan is not grey). */
export async function planDa(page: Page) {
  await expect(page.locator("canvas.maplibregl-canvas")).toBeVisible();
}

/** Map area above the half sheet (iPhone 13 viewport: 390 × 664). */
export const UEBER_DEM_BLATT = { x: 0, y: 0, width: 390, height: 420 };

/**
 * A finger moving from (x, y1) to (x, y2) in about `ms` milliseconds. Chrome itself plays the
 * touch moves at that speed (CDP synthesizeScrollGesture), so a busy test machine does not slow
 * the swipe down and the sheet sees the same pointer events as on the iPhone.
 */
export async function wischen(page: Page, x: number, y1: number, y2: number, ms: number) {
  const cdp = await page.context().newCDPSession(page);
  const weg = y2 - y1;
  await cdp.send("Input.synthesizeScrollGesture", {
    x,
    y: y1,
    // Positive scrolls up, that is the finger moves down.
    yDistance: weg,
    xDistance: 0,
    speed: Math.round((Math.abs(weg) / ms) * 1000),
    gestureSourceType: "touch",
    preventFling: true,
  });
  await cdp.detach();
}

/**
 * A slow pull from (x, y1) to (x, y2) as single touch events (CDP), for moves where only the
 * distance counts. Unlike `wischen`, the page can stop the browser from scrolling (pull from the
 * sheet content).
 */
export async function ziehen(page: Page, x: number, y1: number, y2: number, schritte = 10) {
  const cdp = await page.context().newCDPSession(page);
  const punkt = (y: number) => [{ x, y, id: 1 }];
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: punkt(y1) });
  for (let i = 1; i <= schritte; i++) {
    await page.waitForTimeout(60);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: punkt(y1 + ((y2 - y1) * i) / schritte) });
  }
  await page.waitForTimeout(400);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
}

/** Collects script errors of the page; a test can check at the end that there were none. */
export function fehlerSammeln(page: Page): string[] {
  const fehler: string[] = [];
  page.on("pageerror", (e) => fehler.push(e.message));
  return fehler;
}

/** Whether the sheet is pulled up (VoiceOver handle says so). */
export const blattOffen = (page: Page) => page.locator(".blatt .griff");
