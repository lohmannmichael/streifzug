import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/apple-touch-icon.png", "icons/icon.svg"],
      manifest: {
        name: "Streifzug",
        short_name: "Streifzug",
        description: "Entdecke deine Stadt Straße für Straße.",
        lang: "de",
        start_url: "/",
        display: "standalone",
        background_color: "#E9ECEF",
        theme_color: "#1E2A4A",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // The map style, tiles and street data come from other hosts and are not precached.
        globPatterns: ["**/*.{js,css,html,svg,png,woff2,geojson}"],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
    }),
  ],
});
