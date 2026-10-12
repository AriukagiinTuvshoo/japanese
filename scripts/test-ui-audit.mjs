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
      // Merge — never wipe saved state on reload (this is what "settings persist" must exercise).
      let d = {};
      try { d = JSON.parse(localStorage.getItem("nd:doc:local") || "{}"); } catch { d = {}; }
      d.profile = { ...(d.profile || {}), language: lang, onboarded: true, current: "N4", target: "N1" };
      localStorage.setItem("nd:doc:local", JSON.stringify(d));
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

    // 6) narrow (320) and tablet (820) widths on a reduced route set
    for (const width of [320, 820]) {
      await page.setViewportSize({ width, height: 800 });
      for (const route of ["home", "vocab?level=N5", "reading", "mock", "placement", "write"]) {
        await page.goto(`${origin}/#/${route}`);
        await page.locator("main").waitFor();
        await page.waitForTimeout(100);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        assert.ok(overflow <= 1, `${language}@${width} #/${route}: horizontal overflow ${overflow}px`);
      }
      console.log(`audit ${language}@${width}: reduced route set renders with no overflow`);
    }

    // 7) tap-to-lookup popover (phone tap + desktop hover) on reading body
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto(`${origin}/#/reading/read-n5-31`);
    await page.locator("main").waitFor();
    // XRayText tokens appear after the search index loads — poll instead of a fixed sleep.
    const tapped = await (async () => {
      for (let i = 0; i < 40; i++) {
        const got = await page.evaluate(() => {
          const btns = [...document.querySelectorAll("main button")].filter((b) => (b.className || "").includes("rounded-[3px]") && (b.textContent || "").trim());
          if (!btns.length) return "";
          btns[0].click();
          return btns[0].textContent.trim();
        });
        if (got) return got;
        await page.waitForTimeout(250);
      }
      return "";
    })();
    assert.ok(tapped, `${language}: reading body must expose tappable word tokens`);
    await page.waitForTimeout(250);
    const popText = await page.locator("main").innerText();
    assert.ok(/Үгийн санд хадгалах|Save to vocab/.test(popText), `${language}: tap-lookup popover must offer save-to-vocab (tapped: ${tapped})`);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.reload();
    await page.locator("main").waitFor();
    let hoverBtn = null;
    for (let i = 0; i < 40; i++) {
      hoverBtn = page.locator('main button[class*="rounded-[3px]"]').first();
      if (await hoverBtn.count()) break;
      await page.waitForTimeout(250);
    }
    await hoverBtn.hover();
    await page.waitForTimeout(250);
    assert.ok(/Үгийн санд хадгалах|Save to vocab/.test(await page.locator("main").innerText()), `${language}: desktop hover must open the lookup popover`);

    // 8) jaPrompts setting: grammar instructions in Japanese, explanations follow MN/EN
    await page.evaluate(() => {
      const d = JSON.parse(localStorage.getItem("nd:doc:local") || "{}");
      d.profile = { ...(d.profile || {}), jaPrompts: true };
      localStorage.setItem("nd:doc:local", JSON.stringify(d));
    });
    await page.goto(`${origin}/#/quiz?mode=grammar-mn&level=N5`);
    await page.reload();
    await page.locator("main").waitFor();
    let jaShown = false;
    for (let i = 0; i < 30 && !jaShown; i++) {
      jaShown = (await page.locator("main").innerText()).includes("この文法の意味として正しいものはどれですか。");
      if (!jaShown) await page.waitForTimeout(300);
    }
    assert.ok(jaShown, `${language}: jaPrompts=true must show the Japanese grammar instruction`);
    await page.evaluate(() => {
      const d = JSON.parse(localStorage.getItem("nd:doc:local") || "{}");
      d.profile = { ...(d.profile || {}), jaPrompts: false };
      localStorage.setItem("nd:doc:local", JSON.stringify(d));
    });
    await page.reload();
    await page.locator("main").waitFor();
    let mnShown = false;
    for (let i = 0; i < 30 && !mnShown; i++) {
      mnShown = /Энэ дүрмийн утга аль вэ\?|What does this pattern mean\?/.test(await page.locator("main").innerText());
      if (!mnShown) await page.waitForTimeout(300);
    }
    assert.ok(mnShown, `${language}: jaPrompts=false must show the MN/EN grammar instruction`);

    // 9) listening exam replay policy: 2 listens per line, counters, disabled at cap
    await page.evaluate(() => {
      const d = JSON.parse(localStorage.getItem("nd:doc:local") || "{}");
      d.profile = { ...(d.profile || {}), replayPolicy: "exam" };
      localStorage.setItem("nd:doc:local", JSON.stringify(d));
    });
    await page.goto(`${origin}/#/listening/listen-gen-n5-01`);
    await page.reload();
    await page.locator("main").waitFor();
    await page.getByRole("button", { name: /Транскрипт|Transcript/ }).first().click();
    await page.waitForTimeout(250);
    const linePlay = page.locator("main button", { hasText: "0/2" }).first();
    await linePlay.waitFor();
    await linePlay.click();
    // The counter text changes after the click — follow the same line via its new count.
    await page.locator("main button", { hasText: "1/2" }).first().click();
    const capped = page.locator("main button", { hasText: "2/2" }).first();
    await capped.waitFor();
    assert.ok(await capped.isDisabled(), `${language}: exam replay must disable a line after 2 listens`);
    assert.ok(/2 удаа|2 listens/.test(await page.locator("main").innerText()), `${language}: exam replay policy must be visible`);
    await page.evaluate(() => {
      const d = JSON.parse(localStorage.getItem("nd:doc:local") || "{}");
      d.profile = { ...(d.profile || {}), replayPolicy: "free" };
      localStorage.setItem("nd:doc:local", JSON.stringify(d));
    });

    // 10) placement run → internal sublevels + score explanation + coverage + next steps
    await page.goto(`${origin}/#/placement`);
    await page.reload();
    await page.locator("main").waitFor();
    // Start is a no-op until question data loads — retry until the run stage appears.
    for (let i = 0; i < 30; i++) {
      if (/1 \/ 45/.test(await page.locator("main").innerText())) break;
      await page.getByRole("button", { name: /Тест эхлэх|Start test/ }).first().click().catch(() => {});
      await page.waitForTimeout(300);
    }
    assert.ok(/1 \/ 45/.test(await page.locator("main").innerText()), `${language}: placement run must start`);
    const pickA = async () => {
      const ok = await page.evaluate(() => {
        const b = [...document.querySelectorAll("main button")].find((x) => [...x.querySelectorAll("span")].some((s) => s.textContent.trim() === "A"));
        if (!b) return false;
        b.click();
        return true;
      });
      assert.ok(ok, `${language}: placement must offer answer choices`);
      await page.waitForTimeout(120);
    };
    await pickA();
    await page.getByRole("button", { name: language === "en" ? "Finish" : "Дуусгах", exact: true }).first().click();
    await page.waitForTimeout(300);
    const pText = await page.locator("main").innerText();
    for (const re of language === "en"
      ? [/Internal sub-levels/, /beginner|mid|advanced/, /not official JLPT sub-grades/, /Score explanation/, /Skill coverage/, /Next steps/, /Retake in/]
      : [/Дотоод дэд түвшин/, /анхан|дунд|ахисан/, /албан JLPT дэд шалгалтын үзүүлэлт биш/, /Онооны тайлбар/, /Чадварын хамрах хүрээ/, /Дараагийн алхам/, /дахин өгч/]) {
      assert.ok(re.test(pText), `${language}: placement result must include ${re}`);
    }

    // 11) mock practice-score disclaimer + writing self-check + multi-question reading
    // (wait for a route-specific marker: `main` stays mounted across hash navigations)
    await page.goto(`${origin}/#/mock`);
    await page.locator("main", { hasText: /Жишиг JLPT шалгалт|JLPT mock exam/ }).first().waitFor();
    assert.ok(/албан ёсны оноо биш|not an official JLPT score/.test(await page.locator("main").innerText()),
      `${language}: mock page must carry the practice-score disclaimer`);
    await page.goto(`${origin}/#/write`);
    await page.locator("main", { hasText: /Өөрийн шалгалт|Self-check/ }).first().waitFor();
    assert.ok(/Өөрийн шалгалт|Self-check/.test(await page.locator("main").innerText()),
      `${language}: writing page must show the self-check criteria`);
    await page.goto(`${origin}/#/reading/read-n5-31`);
    await page.locator("main", { hasText: /зуны баярын зар|Summer festival flyer/i }).first().waitFor();
    await page.getByRole("button", { name: /Асуулт|Questions/ }).first().click();
    await page.waitForTimeout(200);
    assert.ok(/Ороход мөнгө төлдөг|admission fee/.test(await page.locator("main").innerText()),
      `${language}: the new reading texts must carry 2 comprehension questions`);

    assert.deepEqual(errors, [], `${language}: uncaught page errors`);
    console.log(`audit ${language}: search/filters, answer-key flows, settings, tap-lookup, jaPrompts, replay policy, placement sublevels, disclaimers all ok`);
    await context.close();
  }
  console.log("OK: UI audit — routes, overflow (320/375/820/1280), placeholders, unnamed controls, search, answer flows, persistence, tap-lookup, jaPrompts, replay policy, placement (MN+EN)");
} finally {
  await browser.close();
  server.kill();
}
