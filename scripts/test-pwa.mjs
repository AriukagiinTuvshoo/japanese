// Static PWA policy checks: manifest shape, icon assets, service-worker
// privacy rules (no /api caching), update strategy hooks, install UI wiring.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const read = (p) => fs.readFileSync(p, "utf8");

const manifest = JSON.parse(read("public/manifest.webmanifest"));
assert.equal(manifest.name.includes("Nihongo"), true, "manifest name");
assert.equal(manifest.short_name, "Nihongo Dōjō", "manifest short_name");
assert.equal(manifest.start_url, "/", "manifest start_url");
assert.equal(manifest.scope, "/", "manifest scope");
assert.equal(manifest.display, "standalone", "manifest display");
assert.equal(manifest.theme_color, "#1c1b18", "manifest theme_color matches html theme-color");
assert.ok(manifest.icons.some((i) => i.sizes === "192x192"), "192 icon declared");
assert.ok(manifest.icons.some((i) => i.sizes === "512x512" && /any/.test(i.purpose ?? "")), "512 icon declared");
assert.ok(manifest.icons.some((i) => i.sizes === "512x512" && /maskable/.test(i.purpose ?? "")), "maskable icon declared");
for (const icon of manifest.icons) {
  const p = path.join("public", icon.src);
  assert.ok(fs.existsSync(p), `icon exists: ${icon.src}`);
  const buf = fs.readFileSync(p);
  assert.deepEqual([...buf.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], `${icon.src} is a PNG`);
  const w = buf.readUInt32BE(16);
  const h = buf.readUInt32BE(20);
  assert.equal(w, h, `${icon.src} square`);
  assert.equal(String(w), icon.sizes.split("x")[0], `${icon.src} IHDR matches declared size`);
}
assert.ok(fs.existsSync("public/icons/apple-touch-icon.png"), "apple-touch-icon exists");

const html = read("index.html");
assert.ok(html.includes('rel="manifest"'), "index.html links the manifest");
assert.ok(html.includes('rel="apple-touch-icon"'), "index.html links apple-touch-icon");
assert.ok(html.includes('name="apple-mobile-web-app-capable"'), "iOS standalone meta");

const sw = read("public/sw.js");
assert.ok(sw.includes('startsWith("/api/")'), "SW must special-case /api");
assert.ok(/url\.pathname\.startsWith\("\/api\/"\)\) return;/.test(sw), "SW must never respond from cache for /api (pass through)");
assert.ok(!/cache\.put\([^)]*api/.test(sw), "SW must never cache.put API responses");
assert.ok(sw.includes("SKIP_WAITING"), "SW update strategy: SKIP_WAITING");
assert.ok(sw.includes("WARM_DATA"), "SW warms the study corpus");
assert.ok(sw.includes("clients.claim()"), "SW claims clients on activate");
assert.ok(/caches\.delete/.test(sw), "SW deletes stale caches");
assert.ok(sw.includes("request.method !== \"GET\""), "SW only handles GET");
assert.ok(sw.includes("/data/"), "SW caches the study corpus");
assert.ok(/cache\.match\("\/index\.html"/.test(sw), "SW falls back to the app shell for offline navigation");

const pwaTs = read("src/lib/pwa.ts");
assert.ok(pwaTs.includes("registerServiceWorker"), "registration exported");
assert.ok(pwaTs.includes("beforeinstallprompt"), "install prompt captured");
assert.ok(pwaTs.includes("SKIP_WAITING"), "update flow posts SKIP_WAITING");

const main = read("src/main.tsx");
assert.ok(main.includes("registerServiceWorker()"), "main registers the service worker");
const app = read("src/App.tsx");
assert.ok(app.includes("<PwaBar />"), "App renders the install/update bar");
const i18n = read("src/lib/i18n.ts");
for (const key of ["installTitle", "updateReady", "pwaPrivacyNote"]) {
  const count = i18n.split(`${key}:`).length - 1;
  assert.equal(count, 2, `i18n key ${key} present in both mn and en`);
}

console.log("OK: manifest, icons, SW privacy/update policy and install UI wiring verified");
