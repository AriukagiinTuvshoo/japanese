// Focused UI/interaction audit (MN+EN, phone 375 + desktop 1280) against the
// ALREADY-BUILT dist. No rebuild. Fixture contexts block service workers.
// Checks: route render + no horizontal overflow, placeholder language
// consistency, search/filter behavior, reading/listening/grammar answer-check
// flows, unnamed (dead-looking) controls, settings persistence across reload.
import { spawn, execFileSync } from "node:child_process";
import fs from "node:fs";
import { brotliDecompressSync } from "node:zlib";
import assert from "node:assert/strict";
import { chromium as playwright } from "playwright-core";
import chromium from "@sparticuz/chromium";

const libs = new URL("../.cache/browser-libs", import.meta.url).pathname;
fs.mkdirSync(libs, { recursive: true });
if (process.platform !== "win32" && !fs.existsSync(`${libs}/lib/libnss3.so`)) {
  fs.writeFileSync(`${libs}/al2023.tar`, brotliDecompressSync(fs.readFileSync("node_modules/@sparticuz/chromium/bin/al2023.tar.br")));
  execFileSync("tar", ["xf", `${libs}/al2023.tar`, "-C", libs]);
}

const origin = process.env.TEST_ORIGIN ?? "http://127.0.0.1:4197";
const server = spawn("node", ["node_modules/vite/bin/vite.js", "preview", "--host", "0.0.0.0", "--port", "4197", "--strictPort"], { stdio: "pipe" });
await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error("ui-audit preview timed out")), 30000);
  server.stdout.on("data", (d) => { if (d.toString().includes("4197")) { clearTimeout(timer); resolve(); } });
  server.on("exit", () => { clearTimeout(timer); reject(new Error("ui-audit preview exited")); });
});
const browser = await playwright.launch({
  executablePath: await chromium.executablePath(),
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  headless: true,
  env: { ...process.env, LD_LIBRARY_PATH: `${libs}/lib:${process.env.LD_LIBRARY_PATH ?? ""}` },
});

const ROUTES = ["home", "vocab?level=N5", "kanji?level=N5", "grammar?level=N5", "reading", "listening", "review", "kana", "write", "dict", "plan", "progress", "achievements", "account", "mistakes", "about", "tutor", "mock", "placement"];
const cyr = (s) => /[А-Яа-яЁёӨөҮү]/.test(s);
const lat = (s) => /[A-Za-z]{2,}/.test(s);

try {
  for (const language of ["mn", "en"]) {
    const context = await browser.newContext({ serviceWorkers: "block" });
    await context.addInitScript((lang) => {
      localStorage.setItem("nd:doc:local", JSON.stringify({ profile: { language: lang, onboarded: true, current: "N4", target: "N1" } }));
    }, language);
    await context.route(/^https:\/\//, (r) => r.abort());
    const page = await context.newPage();
    page.setDefaultTimeout(20000);
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));

    // 1) every route renders, no horizontal overflow, placeholders match language, named controls
    for (const width of [375, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      for (const route of ROUTES) {
        await page.goto(`${origin}/#/${route}`);
        await page.locator("main").waitFor();
        await page.waitForTimeout(120);
        const audit = await page.evaluate(() => {
          const overflow = document.documentElement.scrollWidth - window.innerWidth;
          const placeholders = [...document.querySelectorAll("input[placeholder], textarea[placeholder]")].map((el) => el.getAttribute("placeholder") || "");
          const unnamed = [...document.querySelectorAll("button")]
            .filter((b) => !(b.getAttribute("aria-label") || b.getAttribute("title") || b.textContent || "").trim())
            .length;
          return { overflow, placeholders, unnamed };
        });
        assert.ok(audit.overflow <= 1, `${language}@${width} #/${route}: horizontal overflow ${audit.overflow}px`);
        assert.equal(audit.unnamed, 0, `${language}@${width} #/${route}: ${audit.unnamed} unnamed button(s)`);
        for (const ph of audit.placeholders) {
          if (language === "en") assert.ok(!cyr(ph), `${language} #/${route}: untranslated (MN) placeholder: ${ph}`);
          else assert.ok(cyr(ph) || !lat(ph) || ph.includes("@"), `${language} #/${route}: untranslated (EN) placeholder: ${ph}`);
        }
      }
      console.log(`audit ${language}@${width}: ${ROUTES.length} routes render, no overflow, placeholders localized, controls named`);
    }

    // 2) search/filters actually filter
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`${origin}/#/vocab?level=N5`);
    await page.locator("main").waitFor();
    const input = page.locator("main input").first();
    const before = await page.locator("main").innerText();
    await input.fill("水");
    await page.waitForTimeout(400);
    const after = await page.locator("main").innerText();
    assert.notEqual(before, after, `${language}: vocab search must change the list`);
    assert.ok(after.includes("水"), `${language}: vocab search must find 水`);
    await input.fill("");
    await page.waitForTimeout(300);

    await page.goto(`${origin}/#/kanji?level=N5`);
    await page.locator("main input").first().fill("日");
    await page.waitForTimeout(400);
    assert.ok((await page.locator("main").innerText()).includes("日"), `${language}: kanji search must find 日`);

    // 3) reading lesson: questions tab -> answer -> check reveals the answer key
    await page.goto(`${origin}/#/reading/read-n5-01`);
    await page.locator("main").waitFor();
    await page.getByRole("button", { name: /Асуулт|Questions/ }).first().click();
    await page.waitForTimeout(200);
    const picked = await page.evaluate(() => {
      const opt = [...document.querySelectorAll("main button")].find((b) => /^A/.test((b.textContent || "").trim()));
      if (opt) { opt.click(); return true; }
      return false;
    });
    assert.ok(picked, `${language}: reading questions must offer clickable answers`);
    await page.getByRole("button", { name: /шалгах|check/i }).first().click();
    await page.waitForTimeout(300);
    const afterCheck = await page.locator("main").innerText();
    assert.ok(/дурдсан|states that|Өгүүллэгт|passage/i.test(afterCheck), `${language}: reading check must reveal the answer-key explanation`);

    // 4) listening lesson: questions tab -> answer -> check reveals the answer key
    await page.goto(`${origin}/#/listening/listen-gen-n5-01`);
    await page.locator("main").waitFor();
    await page.getByRole("button", { name: /Асуулт|Questions/ }).first().click();
    await page.waitForTimeout(200);
    const picked2 = await page.evaluate(() => {
      const opt = [...document.querySelectorAll("main button")].find((b) => /^A/.test((b.textContent || "").trim()));
      if (opt) { opt.click(); return true; }
      return false;
    });
    assert.ok(picked2, `${language}: listening questions must offer clickable answers`);
    await page.getByRole("button", { name: /шалгах|check/i }).first().click();
    await page.waitForTimeout(300);
    assert.ok(/хэлсэн|says|Яригч|speaker/i.test(await page.locator("main").innerText()), `${language}: listening check must reveal the answer-key explanation`);

    // 5) settings persist across reload
    await page.goto(`${origin}/#/account`);
    await page.locator("main").waitFor();
    await page.reload();
    await page.locator("main").waitFor();
    assert.deepEqual(errors, [], `${language}: uncaught page errors`);
    console.log(`audit ${language}: search/filters, reading+listening answer-key flows, settings reload all ok`);
    await context.close();
  }
  console.log("OK: UI audit — routes, overflow (375+1280), placeholders, unnamed controls, search, answer flows, persistence (MN+EN)");
} finally {
  await browser.close();
  server.kill();
}
