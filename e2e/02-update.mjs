/**
 * B8 — (2) Шинэ хувилбар: шинэ SW ирэхэд "шинэчлэх" toast гарч, товч дарсны
 * дараа шинэ SW идэвхжиж, ХУУЧИН build-ийн кэшүүд устдаг.
 *
 * Шинэ build үүсгэлгүйгээр: `dist/sw.js` доторх VERSION токенийг өөрчилж
 * байна → браузер sw.js-ийг дахин татаж (byte өөрчлөгдсөн) шинэ worker
 * суулгана. Ингэж байж давтах тест тогтвортой (build 2 удаа → 20+с).
 */
import fs from "node:fs";
import path from "node:path";
import { startAll, launch, watchConsole, poll, assert, ROOT } from "./helpers.mjs";

const SW_PATH = path.join(ROOT, "dist", "sw.js");
const TOAST = "Шинэ хувилбар бэлэн боллоо.";
const ACTION = "Шинэчлэх";

const original = fs.readFileSync(SW_PATH, "utf8");
const m = /const VERSION = "([^"]+)"/.exec(original);
assert(m, "dist/sw.js дээр VERSION токен олдсонгүй");
const oldVersion = m[1];
const newVersion = `${oldVersion}-e2e`;

const srv = await startAll();
let browser;
try {
  browser = await launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const { errors, pageErrors } = watchConsole(page);

  await page.goto(srv.baseURL, { waitUntil: "domcontentloaded" });
  await poll(() => page.evaluate(() => !!navigator.serviceWorker?.controller), {
    label: "first SW takes control",
  });
  await poll(
    () => page.evaluate(async () => (await caches.keys()).some((k) => k.includes("nd-shell-"))),
    { label: "shell cache exists" },
  );

  // ── шинэ хувилбар үүсгэнэ ──
  fs.writeFileSync(SW_PATH, original.replace(`"${oldVersion}"`, `"${newVersion}"`));

  // ── хуудас шинэчлэлт хийхэд updatefound → installed → toast ──
  const updateSeen = poll(
    () => page.locator(`[role="status"]:has-text("${TOAST}")`).count(),
    { timeout: 30_000, label: "update toast appears" },
  );
  await page.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => r && r.update()));
  await updateSeen;
  const toast = page.locator(`[role="status"]:has-text("${TOAST}")`);
  assert((await toast.count()) === 1, "шинэчлэлийн toast 1 л байх ёстой");
  const btn = toast.getByRole("button", { name: ACTION });
  assert((await btn.count()) === 1, `"${ACTION}" товч олдсонгүй`);
  await btn.click();

  // ── шинэ SW идэвхжиж, хуучин кэш устсан уу? ──
  // Анхаар: шинэ хувилбар = `${oldV}-e2e` гэх тул `includes(oldV)` нь
  // ШИНЭ кэшийг ч “хуучин” гэж тооцно (дэд мөрөөр илэрхийлэх ёстой).
  try {
    await poll(
      () =>
        page.evaluate(async ({ oldV, newV }) => {
          const keys = await caches.keys();
          const names = (v) => [`nd-shell-${v}`, `nd-data-${v}`];
          const stale = names(oldV).filter((n) => keys.includes(n));
          const fresh = names(newV).filter((n) => keys.includes(n));
          return stale.length === 0 && fresh.length === 2;
        }, { oldV: oldVersion, newV: newVersion }),
      { timeout: 30_000, label: "old caches deleted, new caches present" },
    );
  } catch (err) {
    const st = await page.evaluate(async () => {
      const r = await navigator.serviceWorker.getRegistration();
      return {
        keys: await caches.keys(),
        active: r?.active?.state ?? null,
        waiting: r?.waiting ? r.waiting.state : null,
        installing: r?.installing ? r.installing.state : null,
        controller: !!navigator.serviceWorker?.controller,
      };
    });
    console.log("  debug state:", JSON.stringify(st));
    throw err;
  }

  const state = await page.evaluate(async (v) => ({ keys: await caches.keys(), v }), newVersion);
  const leftovers = state.keys.filter((k) => [`nd-shell-${oldVersion}`, `nd-data-${oldVersion}`].includes(k));
  assert(leftovers.length === 0, `хуучин кэш үлдлээ: ${leftovers.join(", ")}`);

  assert(pageErrors.length === 0, `uncaught exception: ${pageErrors.join(" | ")}`);
  assert(errors.length === 0, `console алдаа: ${errors.join(" | ")}`);

  console.log(`✅ update: toast → "${ACTION}" → шинэ SW идэвхжиж, хуучин кэшүүд устлаа (${state.keys.length} кэш)`);
} finally {
  fs.writeFileSync(SW_PATH, original); // дараагийн тестүүдэд цэвэр үлдээнэ
  await browser?.close().catch(() => {});
  await srv.stop();
}