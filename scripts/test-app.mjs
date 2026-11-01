/**
 * SMOKE TEST — built app-ийг бодитоор serve хийж шалгана.
 *
 * `npm run build`-ийн дараа ажиллана: `dist/`-ийг статик серверээр үйлчилж,
 *  · index.html ачаалагдаж, root элемент байгаа эсэх,
 *  · index.html-д холбогдсон бүх JS/CSS asset 200 буцааж байгаа эсэх,
 *  · бүх түвшний өгөгдлийн JSON татагдаж, meta.json-той тохирч байгаа эсэх.
 *
 * Энэ нь browser E2E биш — гэхдээ build → serve → asset → data гинжийг
 * бодит HTTP-ээр шалгах тул "dist эвдэрсэн" алдааг CI-д барьж авна.
 */
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist");
const LEVELS = ["n5", "n4", "n3", "n2", "n1"];

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
};

const failures = [];
const fail = (msg) => failures.push(msg);

async function resolveFile(urlPath) {
  const clean = decodeURIComponent(urlPath.split("?")[0]);
  const rel = clean === "/" ? "index.html" : clean.replace(/^\/+/, "");
  const full = path.join(DIST, rel);
  if (!full.startsWith(DIST)) return null;
  try {
    const st = await stat(full);
    if (st.isDirectory()) return path.join(full, "index.html");
    return full;
  } catch {
    return null;
  }
}

const server = createServer(async (req, res) => {
  const file = await resolveFile(req.url ?? "/");
  if (!file) {
    // SPA fallback
    try {
      const html = await readFile(path.join(DIST, "index.html"));
      res.writeHead(200, { "content-type": MIME[".html"] });
      res.end(html);
      return;
    } catch {
      res.writeHead(404);
      res.end("not found");
      return;
    }
  }
  try {
    const body = await readFile(file);
    res.writeHead(200, { "content-type": MIME[path.extname(file)] ?? "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end("not found");
  }
});

await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", resolve);
});
const base = `http://127.0.0.1:${server.address().port}`;

const get = async (p) => {
  const res = await fetch(base + p);
  return { status: res.status, type: res.headers.get("content-type") ?? "", body: await res.text() };
};

try {
  /* ── 1. index.html ── */
  const index = await get("/");
  if (index.status !== 200) fail(`GET / → ${index.status}`);
  if (!index.type.includes("text/html")) fail(`GET / content-type ${index.type}`);
  if (!/<div id="root">/.test(index.body)) fail("index.html-д <div id=\"root\"> байхгүй");

  /* ── 2. assets ── */
  const assets = [...index.body.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]);
  if (assets.length === 0) fail("index.html-д asset холбоос олдсонгүй");
  for (const asset of assets) {
    const res = await get(asset);
    if (res.status !== 200) fail(`${asset} → ${res.status}`);
    if (res.body.length === 0) fail(`${asset} хоосон`);
  }

  /* ── 3. өгөгдөл ── */
  const metaRes = await get("/data/index/meta.json");
  if (metaRes.status !== 200) fail(`meta.json → ${metaRes.status}`);
  const meta = JSON.parse(metaRes.body);

  for (const kind of ["vocab", "kanji", "grammar"]) {
    for (const lv of LEVELS) {
      const res = await get(`/data/${kind}/${lv}.json`);
      if (res.status !== 200) {
        fail(`/data/${kind}/${lv}.json → ${res.status}`);
        continue;
      }
      let rows;
      try {
        rows = JSON.parse(res.body);
      } catch {
        fail(`/data/${kind}/${lv}.json нь JSON биш`);
        continue;
      }
      if (!Array.isArray(rows) || rows.length === 0) fail(`/data/${kind}/${lv}.json хоосон`);
      const expected = meta?.counts?.byLevel?.[kind]?.[lv.toUpperCase()];
      if (typeof expected === "number" && rows.length !== expected) {
        fail(`/data/${kind}/${lv}.json: ${rows.length} мөр, meta-д ${expected}`);
      }
    }
  }

  const search = await get("/data/index/search.json");
  if (search.status !== 200) fail(`search.json → ${search.status}`);
  else {
    const parsed = JSON.parse(search.body);
    const total = Object.values(parsed?.entries ?? parsed ?? {}).length;
    if (!total) fail("search.json хоосон");
  }

  /* ── 4. SPA fallback ── */
  const deep = await get("/some/deep/route");
  if (deep.status !== 200 || !/<div id="root">/.test(deep.body)) fail("SPA fallback ажиллахгүй");
} catch (e) {
  fail(`гүйцэтгэлийн алдаа: ${e instanceof Error ? e.message : e}`);
} finally {
  server.close();
}

if (failures.length) {
  for (const f of failures) console.log("  FAIL ", f);
  console.log(`FAIL: ${failures.length} алдаа`);
  process.exit(1);
}
console.log("✅ Served build smoke test passed (index, assets, data, SPA fallback).");
