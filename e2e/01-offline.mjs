/**
 * B8 — (1) Офлайн: анхны зочиллогоо (онлайн) → SW кэш дулаацна → preview
 * серверийг УСТГАА → дахин ачаалж бүх гол замаар явна: 0 console алдаа,
 * япон фонт бүрэн ачаалагдсан (tofu байхгүй).
 *
 * Хэрхэн ажилладаг вэ: Playwright-ийн `setOffline()` нь SW-ээр дамжсан
 * модуль скриптийг бүрэн таслахгүй тул жинхэнэ "интернэт тасарсан" үйл
 * явдлыг серверийг үнэхээр устгаж давшгүй болгоно (доор).
 */
import { startAll, launch, watchConsole, poll, assert } from "./helpers.mjs";

const ROUTES = [
  ["#/home", "main"],
  ["#/vocab?level=N5", "main"],
  ["#/kanji", "main"],
  ["#/grammar", "main"],
  ["#/review", "main"],
];

const srv = await startAll();
let browser;
try {
  browser = await launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const { errors, pageErrors } = watchConsole(page);

  // ── 1. Онлайн: анхны ачаалалт, SW кэшилнэ ──
  await page.goto(srv.baseURL, { waitUntil: "domcontentloaded" });
  await poll(() => page.evaluate(() => !!navigator.serviceWorker?.controller), {
    label: "service worker takes control",
  });
  // FIRST_LEVEL (N5 өгөгдөл + shell) кэшилсэн эсэх
  await poll(
    () =>
      page.evaluate(async () => {
        const names = await caches.keys();
        const dataName = names.find((k) => k.startsWith("nd-data-"));
        if (!dataName) return false;
        const c = await caches.open(dataName);
        return (await c.keys()).length >= 5;
      }),
    { label: "N5 data precached" },
  );

  // Онлайн замуудаар явж, фонт/кэш дулаацуулна
  for (const [route] of ROUTES) {
    await page.goto(srv.baseURL + route, { waitUntil: "domcontentloaded" });
    await poll(() => page.evaluate(() => document.fonts.status === "loaded"), { label: `fonts loaded on ${route}` });
  }
  const fontsOnline = await page.evaluate(() => ({
    sans: document.fonts.check('400 16px "Noto Sans JP"', "日本語"),
    serif: document.fonts.check('700 16px "Noto Serif JP"', "道"),
    files: performance.getEntriesByType("resource").filter((r) => /\.woff2/.test(r.name)).length,
  }));
  assert(fontsOnline.sans, "Noto Sans JP шаардлагатай үсгээр баталгаажсан байх ёстой");
  assert(fontsOnline.serif, "Noto Serif JP (mincho) ачаалагдсан байх ёстой");

  // ── 2. СЕРВЕРИЙГ УСТГАА → үнэхээр офлайн ──
  await srv.stop();
  await poll(
    async () => {
      try {
        await fetch(srv.baseURL, { signal: AbortSignal.timeout(1000) });
        return false;
      } catch {
        return true;
      }
    },
    { label: "preview server really down" },
  );

  // ── 3. Офлайнаар дахин ачаалж бүх замаар явна ──
  for (const [route, sel] of ROUTES) {
    await page.goto(srv.baseURL + route, { waitUntil: "domcontentloaded" });
    await page.reload({ waitUntil: "domcontentloaded" });
    await poll(() => page.$(sel), { label: `${route} renders offline` });
    const text = await page.textContent("body");
    assert(text && text.trim().length > 50, `${route} хоосон хуудас (white screen) байна`);
    const fonts = await page.evaluate(() => ({
      sans: document.fonts.check('400 16px "Noto Sans JP"', "日本語"),
      serif: document.fonts.check('700 16px "Noto Serif JP"', "道"),
    }));
    assert(fonts.sans && fonts.serif, `${route}: фонт офлайнаар ачаалагдаагүй (tofu эрсдэл)`);
  }

  // ── 4. Console шүүлт ──
  // Устгасан серверээс ирсэн ресурсын алдаа (INTENTIONAL: сервер үнэхээр
  // устсан) нь console-д "Failed to load resource" бичнэ — энэ нь апп-ын
  // алдаа БИШ. Зөвхөн uncaught exception + бусад console алдаа 0 байх ёстой.
  const resourceNoise = errors.filter((e) => /Failed to load resource|net::ERR_/i.test(e));
  const realErrors = errors.filter((e) => !/Failed to load resource|net::ERR_/i.test(e));
  assert(pageErrors.length === 0, `uncaught exception: ${pageErrors.join(" | ")}`);
  assert(realErrors.length === 0, `console алдаа: ${realErrors.join(" | ")}`);

  console.log(
    `✅ offline: 5 зам офлайнаар ачаалагдлаа, фонт бүрэн, ` +
      `console алдаа 0 (серверээс ирсэн ресурсын шуугиан: ${resourceNoise.length})`,
  );
} finally {
  await browser?.close().catch(() => {});
  await srv.stop();
}