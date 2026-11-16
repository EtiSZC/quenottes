import { defineConfig, type Plugin } from "vite";
import { copyFileSync, readFileSync } from "node:fs";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// The version shown at the bottom of the Parents page and compared with `version.json`. APP_VERSION_OVERRIDE
// only serves test builds (a pretend older app, to see the update notice).
const appVersion = process.env.APP_VERSION_OVERRIDE ?? JSON.parse(readFileSync("package.json", "utf8")).version;

// GitHub Pages serves the PWA under a sub-path (e.g. /quenottes/); every other
// build (dev server, Android/Capacitor) keeps "/". Set only by the Pages workflow.
const base = process.env.PAGES_BASE ?? "/";

// Pages has no SPA rewrite: serve index.html for unknown paths too (Pages build only).
const pagesSpaFallback = (): Plugin => ({
  name: "pages-spa-fallback",
  apply: "build",
  closeBundle() {
    if (process.env.PAGES_BASE) copyFileSync("dist/index.html", "dist/404.html");
  },
});

// Publishes `version.json` next to the site (`{ version, url }`): the Android app reads it, at most once a day
// when the Parents area opens, to tell a parent that a newer version exists.
const versionFile = (): Plugin => ({
  name: "version-file",
  apply: "build",
  generateBundle() {
    this.emitFile({
      type: "asset",
      fileName: "version.json",
      source: JSON.stringify({ version: appVersion, url: "https://github.com/EtiSZC/quenottes/releases/latest" }),
    });
  },
});

export default defineConfig(({ mode }) => ({
  base,
  define: { __APP_VERSION__: JSON.stringify(appVersion) },
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    pagesSpaFallback(),
    versionFile(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "apple-touch-icon.png"],
      manifest: {
        name: "Quenottes",
        short_name: "Quenottes",
        description: "App ludique de brossage de dents pour enfants",
        theme_color: "#DFF7F0",
        background_color: "#DFF7F0",
        display: "standalone",
        orientation: "portrait",
        lang: "fr",
        // Relative, so the installed app works under the Pages sub-path too.
        start_url: "./",
        scope: "./",
        icons: [
          { src: "pwa-192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512.png", sizes: "512x512", type: "image/png" },
          { src: "pwa-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        navigateFallbackDenylist: [/^\/~oauth/],
        // Everything needed offline: code, Lily's voice clips, fonts, mascot images, icons.
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2,mp3,json,webmanifest}"],
        // version.json must always come fresh from the network, never from the offline cache.
        globIgnores: ["version.json"],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
