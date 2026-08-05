import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(), 
    mode === "development" && componentTagger(),
    VitePWA({
      strategies: 'generateSW',
      registerType: 'autoUpdate',
      injectRegister: null,
      filename: 'sw.js',
      includeAssets: ['favicon.ico', 'robots.txt'],
      manifest: {
        name: 'متجر - تطبيق التسوق الإلكتروني',
        short_name: 'متجر',
        description: 'تسوق أحدث صيحات الموضة والإلكترونيات بأفضل الأسعار',
        theme_color: '#9333ea',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        navigateFallbackDenylist: [/^\/~oauth/],
        runtimeCaching: [{
          urlPattern: ({ request }) => request.mode === 'navigate',
          handler: 'NetworkFirst',
          options: { cacheName: 'siloshop-pages', networkTimeoutSeconds: 3, expiration: { maxEntries: 20, maxAgeSeconds: 86400 } }
        }, {
          urlPattern: ({ url }) => url.origin === self.location.origin && /\/assets\/.*-[\w-]+\.(?:js|css)$/.test(url.pathname),
          handler: 'CacheFirst',
          options: { cacheName: 'siloshop-versioned-assets', expiration: { maxEntries: 80, maxAgeSeconds: 2592000 } }
        }]
      },
      devOptions: { enabled: false }
    })
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
