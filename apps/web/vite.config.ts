import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  // Build time, shown under Einstellungen → "Zustand", to see which version runs on the phone.
  define: { __BAUSTAND__: JSON.stringify(new Date().toISOString()) },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/apple-touch-icon.png", "icons/icon.svg"],
      manifest: {
        name: "Unterwegs",
        short_name: "Unterwegs",
        description: "Entdecke deine Stadt Straße für Straße.",
        lang: "de",
        start_url: "/",
        display: "standalone",
        background_color: "#FBFBF8",
        theme_color: "#FBFBF8",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // The map style, tiles and street data come from other hosts and are not precached.
        globPatterns: ["**/*.{js,mjs,css,html,svg,png,webp,woff2,geojson}", "regionen/**/*.json"],
        // Street tiles are loaded when needed and then kept on the device.
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/strassen/"),
            handler: "CacheFirst",
            options: { cacheName: "strassen", expiration: { maxEntries: 2000 } },
          },
          // Map style and tile index from OpenFreeMap: fresh when online, the last copy when offline.
          {
            urlPattern: ({ url }) => url.hostname === "tiles.openfreemap.org" && !/\.(pbf|png|webp)$/.test(url.pathname),
            handler: "NetworkFirst",
            options: { cacheName: "karte-stil", networkTimeoutSeconds: 4, expiration: { maxEntries: 60 } },
          },
          // Map tiles, fonts and icons seen before: kept for offline use (about 30 MB at most).
          {
            urlPattern: ({ url }) => url.hostname === "tiles.openfreemap.org",
            handler: "CacheFirst",
            options: { cacheName: "karte-kacheln", expiration: { maxEntries: 1500, maxAgeSeconds: 60 * 86400 }, cacheableResponse: { statuses: [200] } },
          },
        ],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
    }),
  ],
});
