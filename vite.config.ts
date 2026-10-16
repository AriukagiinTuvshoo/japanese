import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_TARGET = process.env.API_TARGET ?? "http://127.0.0.1:8787";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
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
