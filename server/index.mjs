/**
 * ЛОКАЛ API СЕРВЕР — `npm run server`
 * ------------------------------------------------------------------
 * Vite dev сервер `/api`-г энэ сервер рүү прокси хийдэг (vite.config.ts).
 * Vercel дээр ижил endpoint `api/exam/generate.ts` хэлбэрээр ажиллана.
 *
 * GEMINI_API_KEY-г .env-ээс уншина (хөтөч рүү хэзээ ч орохгүй).
 */

import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

/** .env-ийг Vite-тэй ижил энгийн дүрмээр уншина (зөвхөн дутуу утгуудыг нэмнэ). */
function loadEnv() {
  const file = path.join(ROOT, ".env");
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    const value = m[2].replace(/^["']|["']$/g, "");
    if (process.env[m[1]] === undefined) process.env[m[1]] = value;
  }
}
loadEnv();

const { default: generateHandler } = await import("../api/exam/generate.ts");

const PORT = Number(process.env.API_PORT || 8787);

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > 64 * 1024) {
        reject(new Error("too large"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

  if (url.pathname === "/api/health") {
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ ok: true, version: "3.0.0", ai: process.env.GEMINI_API_KEY ? "configured" : "missing" }));
    return;
  }

  if (url.pathname === "/api/exam/generate") {
    try {
      const body = await readBody(req);
      await generateHandler({ ...req, body, headers: req.headers }, res);
    } catch (err) {
      res.statusCode = 413;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: err instanceof Error ? err.message : "bad request" }));
    }
    return;
  }

  res.statusCode = 404;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ error: "Not found" }));
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`API dev server → http://127.0.0.1:${PORT}/api/health`);
  console.log(`Gemini: ${process.env.GEMINI_API_KEY ? "key configured" : "GEMINI_API_KEY missing (AI endpoints return 503)"}`);
});
