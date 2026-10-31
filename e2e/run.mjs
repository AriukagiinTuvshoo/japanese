/**
 * B8 — `npm run test:e2e`
 * ------------------------------------------------------------------
 * 1. `dist`-ийг **мок API хаягийг шигтгээд** шинээр барина
 *    (`VITE_API_URL=http://127.0.0.1:<E2E_API_PORT>` — үгүйгээр
 *     production build API-г огт дууддаггүй тул нэвтрэх шалгах боломжгүй).
 * 2. Сценарийг тус бүрт ТУСДАА процессээр дараалан ажиллуулна —
 *    бүрэн изолаци (бүрэн шинэ браузер + өөрийн сервер, 0 портын мөргөлдөөн).
 * 3. Аль нэг нь унавал exit 1 → CI зогсооно.
 *
 * Root шаардлагагүй: браузер бол системийн Chrome (`channel: "chrome"`);
 * байхгүй бол татсан Chromium. Татвал: `npx playwright install chromium`
 * (`--with-deps` шаардлагагүй — локал номын сан аль хэдийн байгаа бол).
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const VITE_BIN = path.join(ROOT, "node_modules", "vite", "bin", "vite.js");
const API_PORT = Number(process.env.E2E_API_PORT ?? 8791);

const SCENARIOS = [
  "01-offline.mjs",
  "02-update.mjs",
  "03-corrupt-storage.mjs",
  "04-guest-merge.mjs",
  "05-import-undo.mjs",
];

const run = (cmd, args, opts = {}) =>
  new Promise((resolve) => {
    const p = spawn(cmd, args, { cwd: ROOT, stdio: "inherit", ...opts });
    p.on("exit", (code) => resolve(code ?? 1));
    p.on("error", () => resolve(1));
  });

if (!process.env.E2E_SKIP_BUILD) {
  console.log("▶ build (VITE_API_URL шигтгэсэн)");
  const code = await run(process.execPath, [VITE_BIN, "build"], {
    env: { ...process.env, VITE_API_URL: `http://127.0.0.1:${API_PORT}` },
  });
  if (code !== 0) {
    console.error("❌ build амжилтгүй");
    process.exit(code);
  }
}

const results = [];
for (const file of SCENARIOS) {
  console.log(`\n▶ ${file}`);
  const code = await run(process.execPath, [path.join(HERE, file)]);
  results.push({ file, ok: code === 0 });
}

console.log("\n──────── E2E тайлан ────────");
for (const r of results) console.log(`${r.ok ? "✅" : "❌"} ${r.file}`);
const failed = results.filter((r) => !r.ok);
if (failed.length) {
  console.error(`\n❌ ${failed.length} сценарийг унагаллаа`);
  process.exit(1);
}
console.log("\n✅ Бүх E2E сценарийг амжилттай давлав.");