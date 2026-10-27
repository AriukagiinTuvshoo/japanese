import fs from "node:fs";
import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_TARGET = process.env.API_TARGET ?? "http://127.0.0.1:8787";

/**
 * Production build-ийн дараа:
 *  1. `public/sw.js` доторх `__BUILD__`-г asset hash-аар солино — deploy бүрт
 *     кэш хувилбар өөрчлөгдөж, хуучин кэш activate дээр устана.
 *  2. Критик фонтуудыг (Manrope, Noto Sans JP) `<link rel=preload>`-оор
 *     урьдчилан татна — эхний зураг зурах үед фонт аль хэдийн бэлэн.
 */
function pwaBuild(): Plugin {
  const PRELOAD = ["manrope", "noto-sans-jp"];
  return {
    name: "nd-pwa-build",
    apply: "build",
    writeBundle(options, bundle) {
      const outDir = options.dir ?? path.resolve(__dirname, "dist");
      const files = Object.keys(bundle);
      const stamp = files
        .filter((f) => f.endsWith(".js") || f.endsWith(".css"))
        .sort()
        .map((f) => `${f}:${bundle[f].type === "chunk" ? bundle[f].code.length : 0}`)
        .join("|");
      let hash = 0;
      for (let i = 0; i < stamp.length; i++) hash = (hash * 31 + stamp.charCodeAt(i)) >>> 0;
      const version = hash.toString(36) + "-" + Date.now().toString(36).slice(-4);

      const swPath = path.join(outDir, "sw.js");
      if (fs.existsSync(swPath)) {
        fs.writeFileSync(swPath, fs.readFileSync(swPath, "utf8").replace("__BUILD__", version));
      }

      // Precache жагсаалт: бүх JS/CSS/фонт (lazy route chunk-ууд ч орно).
      // SW үүнийг суулгах үед уншаад кэшлэнэ — эс бөгөөс офлайн үед
      // lazy хуудсууд "Failed to fetch dynamically imported module" болно.
      const assets = files
        .filter((f) => /\.(js|css|woff2)$/.test(f))
        .map((f) => path.posix.join(process.env.BASE_PATH ?? "/", f));
      fs.writeFileSync(path.join(outDir, "precache.json"), JSON.stringify({ assets }));

      const indexHtml = path.join(outDir, "index.html");
      if (!fs.existsSync(indexHtml)) return;
      let html = fs.readFileSync(indexHtml, "utf8");
      const preloads = files
        .filter((f) => f.endsWith(".woff2") && PRELOAD.some((p) => path.basename(f).startsWith(p)))
        .map((f) => {
          const href = path.posix.join(process.env.BASE_PATH ?? "/", f);
          return `<link rel="preload" href="${href}" as="font" type="font/woff2" crossorigin>`;
        });
      if (preloads.length) {
        html = html.replace("</head>", `${preloads.join("")}</head>`);
        fs.writeFileSync(indexHtml, html);
      }
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  base: process.env.BASE_PATH ?? "/",
  plugins: [react(), tailwindcss(), pwaBuild()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: false,
    // The browser only ever talks to this origin; the dev server proxies /api
    // to the Node backend so the sandbox preview keeps working from any host.
    proxy: {
      "/api": { target: API_TARGET, changeOrigin: true },
    },
    // Any host is allowed because the preview runs behind a proxy domain.
    allowedHosts: true,
  },
  preview: { host: "0.0.0.0", allowedHosts: true },
  build: {
    target: "es2020",
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom"],
        },
      },
    },
  },
});
