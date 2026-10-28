/**
 * E2E туслах хэсэг (B8).
 * ------------------------------------------------------------------
 * · `startPreview(port)`  — `vite preview`-ийг (dist) хүүхэд процессээр ажиллуулна
 *   (npx биш → PID шууд устгана, Windows дээр ч аюулгүй).
 * · `startMockApi(port)`  — жинхэнэ сервер шаардлагагүй: /api/**-г Node http
 *   серверээр бүрэн дуурианалдаг (CORS тусгай).
 * · `launch()`            — системийн Chrome (`channel: "chrome"`) → root,
 *   браузер таталт шаардлагагүй; боломжгүй бол татсан Chromium руу унана.
 * · `watchConsole(page)`  — console алдаа + uncaught exception цуглуулна.
 * · `poll(fn)`            - фикс sleep-гүй, нөхцөлөөр хүлээх (тогтвортой байдал).
 */
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const VITE_BIN = path.join(ROOT, "node_modules", "vite", "bin", "vite.js");

export function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Нөхцөл биелэхийг фикс sleep-гүй хүлээнэ. */
export async function poll(fn, { timeout = 20_000, interval = 120, label = "condition" } = {}) {
  const t0 = Date.now();
  let lastErr = null;
  for (;;) {
    try {
      const v = await fn();
      if (v) return v;
    } catch (e) {
      lastErr = e;
    }
    if (Date.now() - t0 > timeout) {
      throw new Error(`poll timeout (${timeout}ms): ${label}${lastErr ? ` — last error: ${lastErr.message}` : ""}`);
    }
    await sleep(interval);
  }
}

/** `vite preview` сервер (энэ процессийг л тогтооно). */
export async function startPreview(port) {
  const proc = spawn(process.execPath, [VITE_BIN, "preview", "--port", String(port), "--strictPort"], {
    cwd: ROOT,
    stdio: "ignore",
    windowsHide: true,
  });
  const url = `http://127.0.0.1:${port}/`;
  await poll(
    async () => {
      const res = await fetch(url, { signal: AbortSignal.timeout(1500) });
      return res.ok;
    },
    { timeout: 30_000, label: `vite preview ready on ${url}` },
  );
  return {
    url,
    stop: () =>
      new Promise((resolve) => {
        if (proc.exitCode != null) return resolve();
        // Timer REF'd үлдээнэ — үгүй бол event loop хоосорч "unsettled top-level
        // await" (exit 13) болно, алдаа ч хэзээ ч хэвлэгдэхгүй.
        const done = () => resolve();
        proc.once("exit", done);
        proc.once("error", done);
        try {
          proc.kill();
        } catch {
          /* аль хэдийн үхсэн */
        }
        setTimeout(done, 2500);
      }),
  };
}

const ACCOUNT = {
  id: "acc-e2e",
  email: "e2e@example.com",
  name: "E2E",
  createdAt: "2026-01-01T00:00:00.000Z",
};

/**
 * Мок API: `VITE_API_URL` ижилхэн хаягаар ажиллах тул браузер fetch хийнэ.
 * GET /api/sync → rev 0 → клиент `remote.rev <= rev.current` гэж үзээд
 * merge хийхгүй (эхний таталт үед) → тогтвортой.
 */
export async function startMockApi(port) {
  const server = createServer((req, res) => {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "GET, POST, PATCH, PUT, OPTIONS",
    };
    if (req.method === "OPTIONS") {
      res.writeHead(204, cors);
      return res.end();
    }
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const url = req.url || "";
      const json = (code, obj) => {
        res.writeHead(code, { "Content-Type": "application/json", ...cors });
        res.end(JSON.stringify(obj));
      };
      if (url.startsWith("/api/health")) return json(200, { ok: true, version: "e2e-mock" });
      if (url.startsWith("/api/auth/register") || url.startsWith("/api/auth/login")) {
        const parsed = body ? JSON.parse(body) : {};
        return json(200, {
          token: "e2e-token",
          account: { ...ACCOUNT, email: parsed.email || ACCOUNT.email, name: parsed.name || ACCOUNT.name },
        });
      }
      if (url.startsWith("/api/auth/me")) return json(200, { account: ACCOUNT });
      if (url.startsWith("/api/auth/logout")) return json(200, { ok: true });
      if (url.startsWith("/api/auth/profile")) return json(200, { account: ACCOUNT });
      if (url.startsWith("/api/sync")) {
        if (req.method === "PUT") return json(200, { rev: 1, updatedAt: new Date().toISOString() });
        return json(200, { rev: 0, updatedAt: new Date().toISOString(), doc: null });
      }
      if (url.startsWith("/api/sync/pair")) return json(200, { code: "E2E2E2", expiresAt: Date.now() + 600_000, account: ACCOUNT, token: "e2e-token" });
      return json(200, { ok: true });
    });
  });
  await new Promise((r) => server.listen(port, "127.0.0.1", r));
  return {
    url: `http://127.0.0.1:${port}`,
    stop: () => new Promise((r) => server.close(r)),
  };
}

/** Эхнээс: mock API + preview бэлэн болгож, дуусахдаа цэвэрлэнэ. */
/* Тогтмол портууд: `VITE_API_URL` build үед шигтгэдэг тул порт бөх үед
 * таарах ёстой (E2E_API_PORT / E2E_PREVIEW_PORT өөрчилж болно). */
export const API_PORT = Number(process.env.E2E_API_PORT ?? 8791);
export const PREVIEW_PORT = Number(process.env.E2E_PREVIEW_PORT ?? 4399);
export const API_URL = `http://127.0.0.1:${API_PORT}`;
export const BASE_URL = `http://127.0.0.1:${PREVIEW_PORT}/`;

export async function startAll() {
  for (const [name, port] of [
    ["mock API", API_PORT],
    ["vite preview", PREVIEW_PORT],
  ]) {
    const busy = await new Promise((r) => {
      const s = net.createConnection({ port: port, host: "127.0.0.1" });
      s.once("connect", () => {
        s.destroy();
        r(true);
      });
      s.once("error", () => r(false));
    });
    if (busy) throw new Error(`${name} порт ${port} аль хэдийн дүүрэн байна — E2E_*_PORT өөрчилнө үү.`);
  }
  const api = await startMockApi(API_PORT);
  const preview = await startPreview(PREVIEW_PORT);
  return {
    apiURL: api.url,
    baseURL: preview.url,
    stop: async () => {
      await preview.stop();
      await api.stop();
    },
  };
}

/** Системийн Chrome → дараа нь суулгагдаагүй бол татсан chromium. */
export async function launch() {
  const { chromium } = await import("playwright");
  try {
    return await chromium.launch({ channel: "chrome", headless: true });
  } catch {
    return await chromium.launch({ headless: true });
  }
}

/** console алдаа + pageerror цуглуулна. */
export function watchConsole(page) {
  const errors = [];
  const pageErrors = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => pageErrors.push(String(e?.message ?? e)));
  return { errors, pageErrors };
}

export function assert(cond, msg) {
  if (!cond) throw new Error(`ASSERT: ${msg}`);
}

/** Сценарийн алдааг цэвэрхэн хэвлээд exit 1-тэй гаргана. */
export function fail(file, err) {
  console.error(`\n❌ ${file}: ${err?.message ?? err}`);
  if (err?.stack) console.error(err.stack.split("\n").slice(1, 4).join("\n"));
  process.exitCode = 1;
}