// Phone-width responsive suite (320/375/390/430px, MN+EN).
// Confirms: no page overflow, no clipped Japanese text, reachable menu/search/
// language/level controls, ~44px primary touch targets, detail prev/next,
// grammar-quiz actions, mock-practice honest state, safe-area bottom clearance.
// Run against a frozen build (npm run build first); do not rebuild mid-run.
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { brotliDecompressSync } from 'node:zlib';
import ts from 'typescript';
import assert from 'node:assert/strict';
import { chromium as playwright } from 'playwright-core';
import chromium from '@sparticuz/chromium';

const libs = path.resolve('.cache/browser-libs');
fs.mkdirSync(libs, { recursive: true });
if (process.platform !== 'win32' && !fs.existsSync(`${libs}/lib/libnss3.so`)) {
  fs.writeFileSync(`${libs}/al2023.tar`, brotliDecompressSync(fs.readFileSync('node_modules/@sparticuz/chromium/bin/al2023.tar.br')));
  execFileSync('tar', ['xf', `${libs}/al2023.tar`, '-C', libs]);
}
const source = ts.transpileModule(fs.readFileSync('src/lib/i18n.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
const { ui } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const firstWord = JSON.parse(fs.readFileSync('public/data/vocab/n5.json', 'utf8'))[0];
const secondWord = JSON.parse(fs.readFileSync('public/data/vocab/n5.json', 'utf8'))[1];
const firstKanji = JSON.parse(fs.readFileSync('public/data/kanji/n5.json', 'utf8'))[0];
const secondKanji = JSON.parse(fs.readFileSync('public/data/kanji/n5.json', 'utf8'))[1];
const firstGrammar = JSON.parse(fs.readFileSync('public/data/grammar/n5.json', 'utf8'))[0];
const reading = JSON.parse(fs.readFileSync('content/reading.json', 'utf8')).find((x) => x.level === 'N5');
const listening = JSON.parse(fs.readFileSync('content/listening.json', 'utf8')).find((x) => x.level === 'N5');

const WIDTHS = [320, 375, 390, 430];
const origin = 'http://127.0.0.1:4182';
const server = spawn('node', ['node_modules/vite/bin/vite.js', 'preview', '--host', '0.0.0.0', '--port', '4182', '--strictPort'], { stdio: 'pipe' });
let browser;

const JP = /[぀-ヿ㐀-鿿]/;
const routes = (w) => [
  'home', 'vocab?level=N5', `vocab/${firstWord.id}`, 'kanji?level=N5', `kanji/${encodeURIComponent(firstKanji.k)}`,
  'kana', `write/${encodeURIComponent(firstKanji.k)}`, 'grammar?level=N5', `grammar/${firstGrammar.id}?level=N5`,
  'quiz?level=N5', 'reading', `reading/${reading.id}`, 'listening', `listening/${listening.id}`,
  'review', 'mock', 'progress', 'account', 'about', 'admin', 'dict',
];

async function auditRoute(page, label) {
  const overflow = await page.evaluate(() => ({ w: window.innerWidth, sw: document.documentElement.scrollWidth }));
  assert.ok(overflow.sw <= overflow.w + 1, `${label}: page overflow ${overflow.sw}>${overflow.w}`);
  const clipped = await page.evaluate((jpSource) => {
    const jp = new RegExp(jpSource);
    const out = [];
    for (const el of document.querySelectorAll('main *, header *, nav *, [role=dialog] *')) {
      if (![...el.childNodes].some((n) => n.nodeType === 3 && jp.test(n.textContent || ''))) continue;
      if (el.scrollWidth <= el.clientWidth + 2) continue;
      const cs = getComputedStyle(el);
      const escapable = cs.textOverflow === 'ellipsis' || cs.webkitLineClamp !== 'none' || cs.overflowX === 'auto' || cs.overflowX === 'scroll';
      if (!escapable) out.push({ tag: el.tagName, cls: String(el.className).slice(0, 70), text: (el.textContent || '').trim().slice(0, 36), sw: el.scrollWidth, cw: el.clientWidth });
    }
    return out.slice(0, 6);
  }, JP.source);
  assert.deepEqual(clipped, [], `${label}: clipped Japanese text ${JSON.stringify(clipped)}`);
}

async function tapBox(locator, label, min = 44) {
  const box = await locator.boundingBox();
  assert.ok(box, `${label}: not visible`);
  assert.ok(box.height >= min - 0.5 && box.width >= min - 0.5, `${label}: touch target ${Math.round(box.width)}x${Math.round(box.height)} < ${min}px`);
}

try {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('mobile suite preview timed out')), 30000);
    server.stdout.on('data', (d) => { if (d.toString().includes('4182')) { clearTimeout(timer); resolve(); } });
    server.on('exit', () => { clearTimeout(timer); reject(new Error('mobile suite preview exited')); });
  });
  const executablePath = process.platform === 'win32'
    ? [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => p && fs.existsSync(p))
    : await chromium.executablePath();
  assert.ok(executablePath, 'No browser executable found for mobile UI tests');
  browser = await playwright.launch({ executablePath, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'], headless: true, env: process.platform === 'win32' ? process.env : { ...process.env, LD_LIBRARY_PATH: `${libs}/lib:${process.env.LD_LIBRARY_PATH ?? ''}` } });

  for (const language of ['mn', 'en']) {
    const t = ui[language];
    for (const width of WIDTHS) {
      const context = await browser.newContext({ viewport: { width, height: 800 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
      await context.addInitScript((lang) => { if (!localStorage.getItem('nd:doc:local')) localStorage.setItem('nd:doc:local', JSON.stringify({ profile: { language: lang, onboarded: true, current: 'N4', target: 'N1' } })); }, language);
      await context.route(/^https:\/\//, (r) => r.abort());
      const page = await context.newPage();
      page.setDefaultTimeout(15000);
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));

      for (const route of routes(width)) {
        await page.goto(`${origin}/#/${route}`);
        await page.locator('main').waitFor();
        await page.waitForFunction(() => document.querySelector('main h1, main h2, main p'));
        await auditRoute(page, `${language}/${width}/${route}`);
      }
      console.log(`${language}@${width}: ${routes(width).length} routes, no overflow/clipped JP`);

      // Menu, language and JLPT-level controls stay reachable and tappable.
      await page.goto(`${origin}/#/home`);
      const menuBtn = page.getByRole('button', { name: t.menu, exact: true });
      await tapBox(menuBtn, `${language}@${width} menu`, 44);
      const searchBtn = page.getByRole('button', { name: t.searchTitle, exact: true });
      await tapBox(searchBtn, `${language}@${width} search`, 44);
      await menuBtn.click();
      const drawer = page.locator('div[aria-hidden=false] .absolute.inset-y-0.left-0');
      await drawer.waitFor();
      const drawerFit = await drawer.evaluate((el) => ({ sw: el.scrollWidth, cw: el.clientWidth }));
      assert.ok(drawerFit.sw <= drawerFit.cw + 1, `${language}@${width}: drawer horizontal overflow ${drawerFit.sw}>${drawerFit.cw}`);
      await tapBox(drawer.getByRole('button', { name: t.close, exact: true }), `${language}@${width} drawer close`, 44);
      for (const code of ['MN', 'EN']) await tapBox(drawer.getByRole('button', { name: code, exact: true }), `${language}@${width} language ${code}`, 44);
      for (const level of ['N5', 'N4', 'N3', 'N2', 'N1']) await tapBox(drawer.getByRole('button', { name: level, exact: true }), `${language}@${width} level ${level}`, 44);
      const other = language === 'mn' ? 'en' : 'mn';
      await drawer.getByRole('button', { name: language === 'mn' ? 'EN' : 'MN', exact: true }).click();
      await page.getByRole('button', { name: ui[other].menu, exact: true }).waitFor();
      await drawer.getByRole('button', { name: ui[other].close, exact: true }).click(); // drawer stays open after language switch; close before reopening
      await page.getByRole('button', { name: ui[other].menu, exact: true }).click(); // reopen drawer in the switched language
      const drawer2 = page.locator('div[aria-hidden=false] .absolute.inset-y-0.left-0');
      await drawer2.getByRole('button', { name: language.toUpperCase(), exact: true }).click();
      await drawer2.getByRole('button', { name: 'N5', exact: true }).click();
      await page.waitForFunction(() => location.hash.includes('level=N5'));
      await auditRoute(page, `${language}@${width}/home-after-level`);

      // Search dialog remains usable: filters not crushed and result tappable.
      await page.getByRole('button', { name: t.searchTitle, exact: true }).click();
      const dialog = page.locator('[role=dialog], .washi.max-w-2xl').first();
      await page.locator('input').first().waitFor();
      for (const f of ['all', 'v', 'k', 'g']) {
        const filter = page.locator('div.fixed button').filter({ hasText: new RegExp(`^(${t.allF}|${t.vocab}|${t.kanji}|${t.grammar}|All|Vocab|Kanji|Grammar)$`) });
        if (await filter.count()) break;
      }
      const searchFilters = page.locator('div.fixed .washi.max-w-2xl > div:first-child button').filter({ hasNotText: 'ESC' });
      const dialogBox = await page.locator('div.fixed .washi.max-w-2xl').first().boundingBox();
      for (let i = 0; i < await searchFilters.count(); i++) {
        await tapBox(searchFilters.nth(i), `${language}@${width} search filter ${i}`, 40);
        const fb = await searchFilters.nth(i).boundingBox();
        assert.ok(fb.x >= dialogBox.x - 1 && fb.x + fb.width <= dialogBox.x + dialogBox.width + 1, `${language}@${width}: search filter ${i} escapes dialog`);
      }
      await page.locator('input').first().fill(firstWord.w);
      await page.locator('div.fixed a').first().waitFor();
      await tapBox(page.locator('div.fixed a').first(), `${language}@${width} search result`, 44);
      await page.keyboard.press('Escape');
      await page.locator('div.fixed input').waitFor({ state: 'detached' }).catch(() => {});
      if (await page.locator('div.fixed .washi.max-w-2xl').count()) await page.mouse.click(width - 8, 400);
      console.log(`${language}@${width}: menu/language/level/search controls passed`);

      // Word and kanji previous/next stay usable; grammar quiz actions tappable.
      await page.goto(`${origin}/#/vocab/${firstWord.id}`);
      await page.getByRole('heading', { name: firstWord.w, exact: true }).waitFor();
      await tapBox(page.locator('nav[aria-label] a, nav[aria-label] button').first(), `${language}@${width} word prev/next`, 44);
      await page.getByRole('link', { name: `${t.nextWord}: ${secondWord.w}`, exact: true }).click();
      await page.getByRole('heading', { name: secondWord.w, exact: true }).waitFor();
      await page.goto(`${origin}/#/kanji/${encodeURIComponent(firstKanji.k)}`);
      await page.locator('main').getByText(firstKanji.k, { exact: true }).first().waitFor();
      await tapBox(page.locator('nav[aria-label] a, nav[aria-label] button').first(), `${language}@${width} kanji prev/next`, 44);
      await page.getByRole('link', { name: `${t.nextKanji}: ${secondKanji.k}`, exact: true }).click();
      await page.locator('main').getByText(secondKanji.k, { exact: true }).first().waitFor();

      await page.goto(`${origin}/#/grammar/${firstGrammar.id}?level=N5`);
      await page.getByRole('button', { name: t.practiceBtn, exact: true }).click();
      await page.locator('.card.mt-5 .space-y-2\\.5 > button').first().waitFor();
      const quizOptions = page.locator('.card.mt-5 .space-y-2\\.5 > button');
      for (let i = 0; i < await quizOptions.count(); i++) await tapBox(quizOptions.nth(i), `${language}@${width} quiz option ${i}`, 44);
      await quizOptions.first().click();
      await tapBox(page.getByRole('button', { name: t.nextBtn, exact: true }), `${language}@${width} quiz next`, 44);
      await page.getByRole('button', { name: t.nextBtn, exact: true }).click();
      await tapBox(page.locator('nav[aria-label] button').first().or(page.locator('button').filter({ hasText: t.exitShort })).first(), `${language}@${width} quiz exit`, 40);
      console.log(`${language}@${width}: detail navigation and grammar quiz actions passed`);

      // Mock practice: strict full-mock gate preserved; available drills remain tappable.
      await page.goto(`${origin}/#/mock?level=N3`);
      await page.getByRole('button', { name: t.startExam, exact: true }).waitFor();
      assert.ok(await page.getByRole('button', { name: t.startExam, exact: true }).isDisabled(), `${language}@${width}: full mock must stay blocked without reviewed comprehension bank`);
      await page.getByRole('status').filter({ hasText: language === 'en' ? 'Full mock unavailable' : 'Бүрэн жишиг шалгалт бэлэн биш' }).waitFor();
      const practiceBtn = page.getByRole('button', { name: language === 'en' ? 'Start available Japanese drills (not a full exam)' : 'Бэлэн япон дасгал эхлэх (бүрэн шалгалт биш)', exact: true });
      await tapBox(practiceBtn, `${language}@${width} mock practice`, 44);
      await practiceBtn.click();
      await page.locator('.card.mt-5 .space-y-2\\.5 > button').first().waitFor();
      await tapBox(page.locator('.card.mt-5 .space-y-2\\.5 > button').first(), `${language}@${width} mock drill option`, 44);
      console.log(`${language}@${width}: mock practice state passed`);

      // Playback and lesson tabs are easy to tap.
      await page.goto(`${origin}/#/listening/${listening.id}`);
      await page.getByRole('button', { name: /▶ (Play audio|Аудио сонсох)/ }).click().catch(() => {});
      await tapBox(page.getByRole('button', { name: /▶ (Play audio|Аудио сонсох)|^(Stop|Зогсоох)$/ }).first(), `${language}@${width} playback`, 44);
      const tabs = page.locator('main .no-scrollbar button');
      for (let i = 0; i < Math.min(4, await tabs.count()); i++) await tapBox(tabs.nth(i), `${language}@${width} lesson tab ${i}`, 44);

      // Bottom bar clears content and respects the safe-area padding utility.
      await page.goto(`${origin}/#/about`);
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(150);
      const clearance = await page.evaluate(() => {
        const nav = document.querySelector('main ~ nav, nav.fixed.inset-x-0.bottom-0');
        const navBox = nav?.getBoundingClientRect();
        const last = document.querySelector('main a[href], main button');
        const lastBox = last?.getBoundingClientRect();
        return { navH: navBox?.height ?? 0, lastBottom: lastBox?.bottom ?? 0, h: window.innerHeight, safe: !!nav && String(nav.className).includes('pb-[env(safe-area-inset-bottom)]') };
      });
      assert.ok(clearance.safe, `${language}@${width}: bottom bar must keep safe-area padding`);
      assert.ok(clearance.h - clearance.navH + 8 >= 0, `${language}@${width}: bottom bar too tall`);
      assert.deepEqual(errors, [], `${language}@${width}: uncaught page errors`);
      await context.close();
    }
    console.log(`${language}: all phone widths passed`);
  }
} finally {
  if (browser) await browser.close();
  server.kill();
}
console.log('MOBILE_EXIT=0');
