// Focused phone-usability + offline PWA smoke against the ALREADY-BUILT dist.
// No rebuild happens here. Real browser (playwright-core + sparticuz chromium),
// vite preview serves dist/. Controlled fixtures are labeled as such.
import { spawn, execFileSync } from "node:child_process";
import fs from "node:fs";
import { brotliDecompressSync } from "node:zlib";
import assert from "node:assert/strict";
import { chromium as playwright } from "playwright-core";
import chromium from "@sparticuz/chromium";

const libs = path_resolve();
function path_resolve() {
  const libs = new URL("../.cache/browser-libs", import.meta.url).pathname;
  fs.mkdirSync(libs, { recursive: true });
  if (process.platform !== "win32" && !fs.existsSync(`${libs}/lib/libnss3.so`)) {
    fs.writeFileSync(`${libs}/al2023.tar`, brotliDecompressSync(fs.readFileSync("node_modules/@sparticuz/chromium/bin/al2023.tar.br")));
    execFileSync("tar", ["xf", `${libs}/al2023.tar`, "-C", libs]);
  }
  return libs;
}

const origin = "http://127.0.0.1:4188";
const server = spawn("node", ["node_modules/vite/bin/vite.js", "preview", "--host", "0.0.0.0", "--port", "4188", "--strictPort"], { stdio: "pipe" });
let browser;
const WIDTHS = [320, 360, 375, 390, 430];
try {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("smoke preview timed out")), 30000);
    server.stdout.on("data", (d) => {
      if (d.toString().includes("4188")) { clearTimeout(timer); resolve(); }
    });
    server.on("exit", () => { clearTimeout(timer); reject(new Error("smoke preview exited")); });
  });
  const executablePath = await chromium.executablePath();
  browser = await playwright.launch({
    executablePath,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
    headless: true,
    env: { ...process.env, LD_LIBRARY_PATH: `${libs}/lib:${process.env.LD_LIBRARY_PATH ?? ""}` },
  });

  for (const language of ["mn", "en"]) {
    const context = await browser.newContext();
    await context.addInitScript((lang) => {
      if (!localStorage.getItem("nd:doc:local"))
        localStorage.setItem("nd:doc:local", JSON.stringify({ profile: { language: lang, onboarded: true, current: "N4", target: "N1" } }));
    }, language);
    await context.route(/^https:\/\//, (r) => r.abort());
    const page = await context.newPage();
    page.setDefaultTimeout(25000);
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));

    // --- width matrix: launch, key routes, no horizontal overflow ---
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 800 });
      for (const route of ["home", "vocab?level=N5", "kanji?level=N5", "about"]) {
        await page.goto(`${origin}/#/${route}`);
        await page.locator("main").waitFor();
        await page.waitForTimeout(150);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        assert.ok(overflow <= 1, `${language}@${width}/${route}: horizontal overflow ${overflow}px`);
      }
      // touch targets: bottom nav >= 44px high; inline links >= 24px (WCAG 2.2 AA)
      await page.goto(`${origin}/#/home`);
      await page.locator("main").waitFor();
      const nav = await page.evaluate(() => {
        const out = { navSmall: [], linkSmall: [] };
        for (const el of document.querySelectorAll("nav a, nav button")) {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.height > 0 && (r.height < 44 || r.width < 44)) out.navSmall.push(`${el.textContent?.trim().slice(0, 12)}:${Math.round(r.width)}x${Math.round(r.height)}`);
        }
        for (const el of document.querySelectorAll("main a, main button")) {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.height > 0 && (r.height < 24 || r.width < 24)) out.linkSmall.push(`${el.textContent?.trim().slice(0, 12)}:${Math.round(r.width)}x${Math.round(r.height)}`);
        }
        return out;
      });
      assert.deepEqual(nav.navSmall, [], `${language}@${width}: bottom-nav targets must be >=44px`);
      assert.deepEqual(nav.linkSmall, [], `${language}@${width}: inline targets must be >=24px`);
      console.log(`smoke ${language}@${width}: routes render, no overflow, touch targets ok`);
    }

    // --- install help content (About) ---
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${origin}/#/about`);
    const helpKey = language === "mn" ? /Суулгах алхам/ : /Install steps/;
    await page.getByText(helpKey).first().waitFor();
    const privacy = language === "mn" ? "хэзээ ч кэшлэгдэхгүй" : "never cached";
    await page.getByText(new RegExp(privacy)).waitFor();
    console.log(`smoke ${language}: install help + privacy note visible`);

    // --- install prompt banner (controlled beforeinstallprompt fixture) ---
    await page.goto(`${origin}/#/home`);
    await page.evaluate(() => {
      const e = new Event("beforeinstallprompt", { cancelable: true });
      e.prompt = async () => { window.__prompted = true; };
      e.userChoice = Promise.resolve({ outcome: "accepted" });
      window.dispatchEvent(e);
    });
    await page.getByRole("button", { name: language === "mn" ? "Суулгах" : "Install", exact: true }).waitFor();
    await page.getByRole("button", { name: language === "mn" ? "Суулгах" : "Install", exact: true }).click();
    await page.waitForFunction(() => window.__prompted === true);
    console.log(`smoke ${language}: install prompt flow ok (fixture event)`);

    // --- tutor: consent gate -> explicit action -> config-needed safe state; no persistence ---
    {
      const consentTitle = language === "mn" ? "Өгөгдлийн мэдэгдэл · зөвшөөрөл" : "Data notice · consent";
      const agree = language === "mn" ? "Ойлголоо, үргэлжлүүлэх" : "Got it — continue";
      const send = language === "mn" ? "Илгээх" : "Send";
      const configTitle = language === "mn" ? "Багш одоогоор идэвхгүй байна" : "Tutor is currently disabled";
      await page.goto(`${origin}/#/tutor`);
      await page.getByText(consentTitle, { exact: true }).waitFor();
      await context.route("**/api/gemini-tutor", (r) =>
        r.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "config_needed", hint: "Set GEMINI_API_KEY in Vercel env" }) }));
      await page.getByRole("button", { name: agree, exact: true }).click();
      await page.getByPlaceholder(language === "mn" ? /Бичвэр/ : /Type a message/).fill("こんにちは、今日はいい天気です");
      await page.getByRole("button", { name: send, exact: true }).click();
      await page.getByText(configTitle, { exact: true }).waitFor();
      // transcript must never persist: nothing typed in localStorage/sessionStorage
      const persisted = await page.evaluate(() => JSON.stringify({ l: { ...localStorage }, s: { ...sessionStorage } }));
      assert.ok(!persisted.includes("こんにちは"), "tutor transcripts must not be persisted");
      assert.ok(!persisted.includes("gemini"), "tutor state keys must not persist");
      await context.unroute("**/api/gemini-tutor");
      console.log(`smoke ${language}: tutor consent gate + config-needed state + no transcript persistence`);
    }

    if (language === "mn") {
      // --- service worker: install, control, first-install must NOT self-reload ---
      await page.goto(`${origin}/#/home`);
      await page.evaluate(() => navigator.serviceWorker.ready);
      await page.reload();
      await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 25000 });
      await page.evaluate(() => { window.__aliveMarker = Date.now(); });
      await page.waitForTimeout(3000);
      assert.ok(await page.evaluate(() => window.__aliveMarker != null), "first install must not self-reload (controllerchange)");
      console.log("smoke: first-install controllerchange does not reload the page");

      // --- warm study corpus through the SW ---
      await page.evaluate(() => navigator.serviceWorker.controller.postMessage("WARM_DATA"));
      await page.waitForFunction(async () => {
        const keys = await caches.keys();
        for (const k of keys) { const c = await caches.open(k); if (await c.match("/data/vocab/n5.json")) return true; }
        return false;
      }, null, { timeout: 60000 });
      console.log("smoke: study corpus cached for offline");

      // --- /api (Gemini tutor, transcripts, auth) must NEVER be cached ---
      await context.route("**/api/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ fixture: true, note: "controlled fixture — not a real backend" }) }));
      await page.evaluate(async () => {
        await fetch("/api/health");
        await fetch("/api/gemini-tutor", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ messages: [{ role: "user", text: "fixture" }] }) });
      });
      const apiCached = await page.evaluate(async () => {
        const keys = await caches.keys();
        for (const k of keys) {
          const c = await caches.open(k);
          for (const req of await c.keys()) if (new URL(req.url).pathname.startsWith("/api/")) return req.url;
        }
        return null;
      });
      assert.equal(apiCached, null, `/api must never be cached (found ${apiCached})`);
      const cacheNames = await page.evaluate(() => caches.keys());
      for (const name of cacheNames) {
        const keys = await page.evaluate(async (n) => (await (await caches.open(n)).keys()).map((r) => r.url), name);
        assert.ok(!keys.some((u) => u.includes("/api/")), `cache ${name} holds /api entries`);
      }
      console.log("smoke: /api GET+POST (tutor/transcripts) never cached");
      await context.unroute("**/api/**");

      // --- offline launch + cached study route ---
      await context.setOffline(true);
      await page.goto(`${origin}/#/home`);
      await page.getByRole("heading", { name: new RegExp("Nihongo|Дōjō|無|Өглөө|Орой|Өдөр|Шөнө|Good|Morning|Evening|Night|Hello|тавтай|сайн", "i") }).first().waitFor();
      await page.goto(`${origin}/#/vocab?level=N5`);
      await page.locator("main").getByRole("heading", { name: "Үгийн сан", exact: true }).waitFor();
      const rows = await page.locator("main").innerText();
      assert.ok(rows.length > 200, "offline vocab route must render real cached content");
      await page.goto(`${origin}/#/about`);
      await page.getByText(/Суулгах алхам/).first().waitFor();
      await context.setOffline(false);
      console.log("smoke: offline app launch + cached study route + about all render");
    }

    assert.deepEqual(errors, [], `${language}: uncaught page errors`);
    await context.close();
    console.log(`smoke ${language}: PASS`);
  }
  console.log("OK: focused phone-usability + offline PWA smoke passed (fixtures labeled; no rebuild)");
} finally {
  if (browser) await browser.close();
  server.kill();
}
