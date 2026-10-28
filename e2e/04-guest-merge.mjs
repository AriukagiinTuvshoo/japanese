/**
 * B8 — (4) Зочин → аккаунт: нэвтрэх/бүртгүүлэхэд зочин ахиц УСТГАХГҮЙ,
 * "нэгтгэх" санал (default = нэгтгэх) гарч, XP аккаунт руу шилжинэ.
 *
 * Мок API: build дээр `VITE_API_URL=http://127.0.0.1:<E2E_API_PORT>`
 * шигтгэсэн байдаг — энд зөвхөн тэр серверийг ажиллуулна.
 */
import { startAll, launch, watchConsole, poll, assert } from "./helpers.mjs";

const DIALOG = "Зочин ахицаа нэгтгэх үү?";
const MERGE = "Нэгтгэх (зөвлөнө)";
const KEEP = "Тусад нь үлдээх";
const DONE = "Зочин ахицтай бүртгэлдээ нэгтгэлээ.";
const GUEST_XP = 42;

const srv = await startAll();
let browser;
try {
  browser = await launch();
  const ctx = await browser.newContext();
  // Зочин баримт + онбордог дуусгасан (наана нь dialog-ыг хаана уу)
  await ctx.addInitScript(
    ({ xp }) => {
      try {
        if (!localStorage.getItem("nd:doc:local")) {
          localStorage.setItem("nd:doc:local", JSON.stringify({ v: 3, xp, profile: { onboarded: true } }));
        }
      } catch {
        /* noop */
      }
    },
    { xp: GUEST_XP },
  );
  const page = await ctx.newPage();
  const { errors, pageErrors } = watchConsole(page);

  await page.goto(srv.baseURL + "#/account", { waitUntil: "domcontentloaded" });
  await poll(() => page.$('input[placeholder="name@mail.mn"]'), { label: "sign-up form renders" });

  // Сервер бэлэн болсны дараа л товч идэвхижнэ (serverAvailable)
  await poll(
    async () => {
      const btn = page.locator('button:has-text("Бүртгүүлэх")').last();
      return (await btn.count()) > 0 && (await btn.isEnabled());
    },
    { label: "sign-up button enabled (mock /api/health OK)" },
  );

  await page.fill('input[placeholder="Нэр"]', "E2E");
  await page.fill('input[placeholder="name@mail.mn"]', "e2e@example.com");
  await page.fill('input[type="password"]', "secret123");
  await page.locator('button:has-text("Бүртгүүлэх")').last().click();

  // ── зочин ахиц нэгтгэх санал (default = нэгтгэх) ──
  const dialog = page.locator(`[role="dialog"]:has-text("${DIALOG}")`);
  await poll(() => dialog.count(), { label: "guest merge dialog" });
  assert((await dialog.getByRole("button", { name: MERGE }).count()) === 1, `default товч "${MERGE}" алга`);
  assert((await dialog.getByRole("button", { name: KEEP }).count()) === 1, `сонголт "${KEEP}" алга`);
  await dialog.getByRole("button", { name: MERGE }).click();

  // ── амжилтын мэдэгдэл ──
  await poll(() => page.locator(`[role="status"]:has-text("${DONE}")`).count(), { label: "merge success notice" });

  // ── XP алдаагүй: аккаунтын баримтад зочны XP шилжсэн, зочны хуулбар үлдсэн ──
  // (бичлэг debounce 350ms — тиймээс утгыг нөхцөлөөр хүлээнэ)
  const readDocs = () =>
    page.evaluate(() => {
      const out = {};
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        // зөвхөн үндсэн баримтууд: nd:doc:<uid> (дотор нь ":" байхгүй)
        if (k?.startsWith("nd:doc:") && !k.slice("nd:doc:".length).includes(":")) {
          try {
            out[k] = JSON.parse(localStorage.getItem(k) || "{}").xp ?? null;
          } catch {
            out[k] = null;
          }
        }
      }
      return out;
    });
  const state = await poll(
    async () => {
      const d = await readDocs();
      const acc = Object.keys(d).find((k) => k !== "nd:doc:local");
      return acc && d[acc] >= GUEST_XP ? d : null;
    },
    { label: `account doc reaches xp >= ${GUEST_XP}` },
  );
  const accountKey = Object.keys(state).find((k) => k !== "nd:doc:local");
  assert(accountKey, `аккаунтын баримт олдсонгүй: ${JSON.stringify(state)}`);
  assert("nd:doc:local" in state, "зочны хуулбар устсан (санаатай алдаа)");
  assert(await page.evaluate(() => !!localStorage.getItem("nd:token")), "токен хадгалагдаагүй");

  assert(pageErrors.length === 0, `uncaught exception: ${pageErrors.join(" | ")}`);
  const real = errors.filter((e) => !/Failed to load resource|net::ERR_/i.test(e));
  assert(real.length === 0, `console алдаа: ${real.join(" | ")}`);

  console.log(
    `✅ guest→account: "${MERGE}" dialog → XP ${GUEST_XP} аккаунтад шилжсэн, зочны хуулбар хэвээр (${Object.keys(state).length} баримт)`,
  );
} finally {
  await browser?.close().catch(() => {});
  await srv.stop();
}