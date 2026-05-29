import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";

// En production (BASE_PATH env), on déploie sous un sous-dossier (ex: /comptaos/)
const BASE_PATH = process.env.BASE_PATH ?? "/";

export default defineConfig({
  base: BASE_PATH,
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "apple-touch-icon.png", "icons/*.png"],
      manifest: {
        name: "ComptaOS",
        short_name: "ComptaOS",
        description: "Assistant comptable intelligent local-first",
        theme_color: "#1c6cbf",
        background_color: "#1e1e2e",
        display: "standalone",
        start_url: BASE_PATH,
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // Précache : JS/CSS/HTML du build
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        // Cache réseau pour l'API : stale-while-revalidate
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.includes("/api/"),
            // urlPattern historique (dev local)
            // urlPattern: /^https?:\/\/localhost:3001\/api\//,
            handler: "NetworkFirst",
            options: {
              cacheName: "api-cache",
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 },
            },
          },
        ],
      },
      devOptions: {
        enabled: false, // désactivé en dev pour éviter les conflits HMR
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3001",
        changeOrigin: true,
      },
    },
  },
});
