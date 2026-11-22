import { defineConfig, devices } from "@playwright/test";

// Browser tests (Bauplan 3, E1): the built app (`npm run build`) in iPhone size with touch.

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  ...(process.env.CI ? { workers: 2 } : {}),
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    ...devices["iPhone 13"],
    // iPhone size and touch, but Chromium (WebKit is not needed for these checks).
    defaultBrowserType: "chromium",
    baseURL: "http://localhost:4173",
    locale: "de-DE",
    timezoneId: "Europe/Berlin",
    // The service worker would answer requests itself; the tests replace the server instead.
    serviceWorkers: "block",
    permissions: ["geolocation"],
    geolocation: { latitude: 50.9395, longitude: 6.8285 },
    trace: "off",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "iphone" }],
  webServer: {
    command: "npx vite preview --port 4173 --strictPort",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
  },
});
