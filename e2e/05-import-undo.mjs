/**
 * B8 — (5) Импорт: preview (тоо/xp/статистик) → НЭГТГЭХ → нэг товшилт Undo.
 * Файлыг апп өөрөө экспортолсноос авдаг — схем 100% жинхэнэ байх нь
 * баталгаатай (мөн schema-г буруу тэжээвэл preview-г өөрөө буцаана).
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { startAll, launch, watchConsole, poll, assert } from "./helpers.mjs";

const PREVIEW_TITLE = "Импортын урьдчилсан харах";
const MERGE = "Нэгтгэх (зөвлөнө)";
const IMPORTED_OK = "Импорт амжилттай — дараа нь буцаах боломжтой.";
const UNDO = "Импортыг буцаах";
const UNDONE = "Сүүлийн импортыг буцаалаа.";
const TARGET_XP = 1234;

const srv = await startAll();
let browser;
try {
  browser = await launch();
  const ctx = await browser.newContext({ acceptDownloads: true });
  await ctx.addInitScript(() => {
    try {
      if (!localStorage.getItem("nd:doc:local")) {
        localStorage.setItem("nd:doc:local", JSON.stringify({ v: 3, xp: 0, profile: { onboarded: true } }));
      }
    } catch {
      /* noop */
    }
  });
  const page = await ctx.newPage();
  const { errors, pageErrors } = watchConsole(page);
  const readXp = () =>
    page.evaluate(() => {
      try {
        return JSON.parse(localStorage.getItem("nd:doc:local") || "{}").xp ?? 0;
      } catch {
        return null;
      }
    });
  const xpEq = (want) => async () => (await readXp()) === want;

  await page.goto(srv.baseURL + "#/account", { waitUntil: "domcontentloaded" });
  await poll(() => page.getByRole("button", { name: "Синхрон · нөөц" }).count(), { label: "sync tab" });
  await page.getByRole("button", { name: "Синхрон · нөөц" }).click();

  // readXp() нь 0 байж болно — тиймээс «null биш» нөхцөлөөр хүлээгээд утгыг дахин уншина.
  await poll(async () => (await readXp()) !== null, { label: "original doc readable" });
  const originalXp = await readXp();

  // ── 1. бүрэн экспорт → өөрчилж авна ──
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.locator('button:has-text("Татах")').click(),
  ]);
  const exportedPath = path.join(os.tmpdir(), `nd-e2e-export-${Date.now()}.json`);
  await download.saveAs(exportedPath);
  const payload = JSON.parse(fs.readFileSync(exportedPath, "utf8"));
  assert(typeof payload.v === "number", "экспорт дээр схемийн хувилбар (`v`) байхгүй");
  payload.xp = TARGET_XP;
  const importPath = path.join(os.tmpdir(), `nd-e2e-import-${Date.now()}.json`);
  fs.writeFileSync(importPath, JSON.stringify(payload));

  // ── 2. импорт → PREVIEW ──
  await page.locator('input[type="file"]').setInputFiles(importPath);
  const preview = page.locator(`[role="dialog"]:has-text("${PREVIEW_TITLE}")`);
  await poll(() => preview.count(), { label: "import preview modal" });
  const previewText = await preview.textContent();
  assert(previewText && previewText.includes(String(TARGET_XP)), "preview дээр XP тоо зарагдахгүй байна");

  // ── 3. нэгтгэх (default) ──
  await preview.getByRole("button", { name: MERGE }).click();
  await poll(() => page.locator(`[role="status"]:has-text("${IMPORTED_OK}")`).count(), {
    label: "import success notice",
  });
  await poll(xpEq(TARGET_XP), { label: `xp becomes ${TARGET_XP} (after debounce)` });

  // ── 4. нэг товшилт Undo ──
  const undoBtn = page.locator(`button:has-text("${UNDO}")`);
  await poll(() => undoBtn.count(), { label: "undo button appears" });
  await undoBtn.click();
  await poll(() => page.locator(`[role="status"]:has-text("${UNDONE}")`).count(), { label: "undo notice" });
  await poll(xpEq(originalXp), { label: `xp restored to ${originalXp}` });

  assert(pageErrors.length === 0, `uncaught exception: ${pageErrors.join(" | ")}`);
  const real = errors.filter((e) => !/Failed to load resource|net::ERR_/i.test(e));
  assert(real.length === 0, `console алдаа: ${real.join(" | ")}`);

  console.log(`✅ import: preview → нэгтгэх (xp ${originalXp}→${TARGET_XP}) → Undo (xp буцлаа)`);
} finally {
  await browser?.close().catch(() => {});
  await srv.stop();
}