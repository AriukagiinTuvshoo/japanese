/**
 * B8 — (3) Эвдэрсэн localStorage: recovery + нөөц, ЦАГААН ЭКРАН байхгүй.
 * `nd:doc:local`-г эвдэрхий JSON болгож, хуудсыг дахин ачаална.
 */
import { startAll, launch, watchConsole, poll, assert } from "./helpers.mjs";

const RECOVER_TEXT = "Хадгалагдсан өгөгдөл гэмтсэн байсан тул сэргээв";

const srv = await startAll();
let browser;
try {
  browser = await launch();
  const ctx = await browser.newContext();
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem("nd:doc:local", '{"v":3,"xp":42,"broken"');
    } catch {
      /* noop */
    }
  });
  const page = await ctx.newPage();
  const { errors, pageErrors } = watchConsole(page);

  await page.goto(srv.baseURL, { waitUntil: "domcontentloaded" });

  // 1) recovery мэдэгдэл (error tone → role=alert)
  const alert = page.locator(`[role="alert"]:has-text("${RECOVER_TEXT}")`);
  try {
    await poll(() => alert.count(), { label: "recovery notice shown" });
  } catch (err) {
    const st = await page.evaluate(() => ({
      url: location.href,
      root: document.getElementById("root")?.childElementCount ?? -1,
      body: (document.body.innerText || "").replace(/\n+/g, " | ").slice(0, 300),
      keys: Object.keys(localStorage),
      raw: (localStorage.getItem("nd:doc:local") || "").slice(0, 60),
      alerts: [...document.querySelectorAll('[role="alert"],[role="status"]')].map((e) => e.textContent?.slice(0, 60)),
    }));
    console.log("  debug state:", JSON.stringify(st, null, 1));
    throw err;
  }

  // 2) эвдэрхийг УСТГААГҮЙ — өөрийн түлхүүрт нөөцлөсөн
  const keys = await page.evaluate(() => Object.keys(localStorage));
  const backup = keys.filter((k) => k.startsWith("nd:doc:local:corrupt:"));
  assert(backup.length >= 1, `коррупт нөөц алга: ${JSON.stringify(keys)}`);

  // 3) цагаан дэлгэц байхгүй — апп бүрэн ажиллаж байна
  await poll(() => page.$("#root > *"), { label: "app rendered after recovery" });
  const text = await page.textContent("body");
  assert(text && text.trim().length > 50, "цагаан дэлгэц (white screen)");

  // 4) сэргээсэн баримт хэвийн: xp хадгалагдсан/шинэчлэгдсэн, давтан ачаалалт хэвийн
  await page.reload({ waitUntil: "domcontentloaded" });
  await poll(() => page.$("#root > *"), { label: "second load renders" });
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem("nd:doc:local") || "{}"));
  assert(after && typeof after.xp === "number", `сэргээсэн баримт буруу байна: ${JSON.stringify(after).slice(0, 80)}`);

  assert(pageErrors.length === 0, `uncaught exception: ${pageErrors.join(" | ")}`);
  const real = errors.filter((e) => !/Failed to load resource|net::ERR_/i.test(e));
  assert(real.length === 0, `console алдаа: ${real.join(" | ")}`);

  console.log(`✅ corrupt storage: recovery мэдэгдэл + нөөц (${backup.length} файл), white screen үгүй`);
} finally {
  await browser?.close().catch(() => {});
  await srv.stop();
}