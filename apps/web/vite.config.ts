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
        globPatterns: ["**/*.{js,css,html,svg,png,woff2,geojson}", "regionen/**/*.json"],
        // Street tiles are loaded when needed and then kept on the device.
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/strassen/"),
            handler: "CacheFirst",
            options: { cacheName: "strassen", expiration: { maxEntries: 2000 } },
          },
        ],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
    }),
  ],
});
