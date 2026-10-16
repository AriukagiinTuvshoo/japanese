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
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu", "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
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
      let lastBody = "";
      await context.route("**/api/gemini-tutor", (r) => {
        lastBody = r.request().postData() ?? "";
        r.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "config_needed", hint: "Set GEMINI_API_KEY in Vercel env" }) });
      });
      await page.getByRole("button", { name: agree, exact: true }).click();
      await page.getByPlaceholder(language === "mn" ? /Бичвэр/ : /Type a message/).fill("こんにちは、今日はいい天気です");
      await page.getByRole("button", { name: send, exact: true }).click();
      await page.getByText(configTitle, { exact: true }).waitFor();
      // transcript must never persist: nothing typed in localStorage/sessionStorage
      const persisted = await page.evaluate(() => JSON.stringify({ l: { ...localStorage }, s: { ...sessionStorage } }));
      assert.ok(!persisted.includes("こんにちは"), "tutor transcripts must not be persisted");
      assert.ok(!persisted.includes("gemini"), "tutor state keys must not persist");

      // --- voice turn (real Gemini voice path): record -> cancel, then record -> send ---
      // Controlled fixture: Chromium fake media device; endpoint answers config_needed.
      await context.grantPermissions(["microphone"], { origin });
      const voiceBtn = page.getByRole("button", { name: language === "mn" ? "Микрофон" : "Microphone", exact: true });
      const recLabel = language === "mn" ? "Бичлэг хийж байна…" : "Recording…";
      lastBody = "";
      await voiceBtn.click();
      await page.getByText(recLabel, { exact: true }).waitFor();
      await page.getByRole("button", { name: language === "mn" ? "Цуцлах" : "Cancel", exact: true }).click();
      await page.getByText(recLabel, { exact: true }).waitFor({ state: "detached" });
      assert.equal(lastBody, "", "cancelled recording must not be sent");
      await voiceBtn.click();
      await page.getByText(recLabel, { exact: true }).waitFor();
      await page.waitForTimeout(600);
      await page.getByRole("button", { name: language === "mn" ? "Зогсоож илгээх" : "Stop & send" }).click();
      await page.getByText(language === "mn" ? "🎤 (дуут мессеж)" : "🎤 (voice message)", { exact: true }).waitFor();
      const sendDeadline = Date.now() + 15000;
      while (!lastBody.includes('"audio"') && Date.now() < sendDeadline) await page.waitForTimeout(100);
      assert.ok(lastBody.includes('"audio"'), "voice turn must upload audio to the tutor endpoint");
      await page.getByText(configTitle, { exact: true }).waitFor();
      const persistedAfter = await page.evaluate(() => JSON.stringify({ l: { ...localStorage }, s: { ...sessionStorage } }));
      assert.equal(persistedAfter, persisted, "voice turns must not persist anything beyond the text flow");

      await context.unroute("**/api/gemini-tutor");
      console.log(`smoke ${language}: tutor consent gate + config-needed state + voice turn (record/cancel/send) + no persistence`);
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
      // NOTE: page.waitForFunction does NOT await async predicates (a returned
      // Promise is truthy and resolves the wait instantly) — poll via
      // page.evaluate, which does await. Wait until the study corpus AND the
      // lazy route chunks needed by the offline checks below are on disk.
      {
        const deadline = Date.now() + 120000;
        for (;;) {
          const ready = await page.evaluate(async () => {
            const want = ["index-", "react-", "Home-", "Vocabulary-", "About-", "categories-", "Session-"];
            const found = new Set();
            let corpora = 0;
            for (const k of await caches.keys()) {
              const c = await caches.open(k);
              for (const req of await c.keys()) {
                const p = new URL(req.url).pathname;
                if (p === "/data/index/meta.json" || /^\/data\/(vocab|kanji|grammar)\/n[1-5]\.json$/.test(p)) corpora++;
                for (const w of want) if (p.includes(`/assets/${w}`)) found.add(w);
              }
            }
            return corpora >= 16 && found.size >= want.length;
          });
          if (ready) break;
          if (Date.now() > deadline) throw new Error("warm cache timeout (corpus + route chunks)");
          await page.waitForTimeout(250);
        }
      }
      console.log("smoke: study corpus + route chunks cached for offline");

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

      // --- offline launch (full document load, not a hash hop) + cached study route ---
      await page.goto(`${origin}/#/about`); // leave home so the launch below is real
      await context.setOffline(true);
      await page.goto(`${origin}/?offline-launch=1`);
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
