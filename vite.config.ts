import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  build: {
    target: "es2020",
    cssCodeSplit: true,
    // Vendor libraries change far less often than app code: splitting them keeps
    // long-term browser caches warm across deploys and shrinks the entry chunk.
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-supabase": ["@supabase/supabase-js"],
          "vendor-charts": ["recharts"],
          "vendor-query": ["@tanstack/react-query"],
        },
      },
    },
    chunkSizeWarningLimit: 900,
  },
  esbuild: {
    // Strip debug noise from production bundles.
    drop: mode === "production" ? ["console", "debugger"] : [],
  },
  plugins: [
    react(), 
    mode === "development" && componentTagger(),
    // Installable app support. public/manifest.webmanifest stays the single manifest
    // source of truth; registration happens only from src/lib/registerServiceWorker.ts.
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: null,
      manifest: false,
      filename: "sw.js",
      strategies: "generateSW",
      devOptions: { enabled: false },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,webmanifest}", "pwa-*.png", "favicon.png", "apple-touch-icon.png"],
        globIgnores: ["**/splash/**", "og-image.png", "push-notifications-sw.js"],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/~oauth/, /^\/api\//],
        runtimeCaching: [
          {
            urlPattern: ({ request, sameOrigin }) => sameOrigin && request.mode === "navigate",
            handler: "NetworkFirst",
            options: {
              cacheName: "siloshop-pages",
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 },
            },
          },
          {
            urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith("/assets/"),
            handler: "CacheFirst",
            options: {
              cacheName: "siloshop-versioned-assets",
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
