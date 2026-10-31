#!/usr/bin/env node
/**
 * Бүрэн rebuild: эх сурвалж → `public/data` → машин орчуулга нэгтгэх.
 *
 *   .cache/sources/** + content/**  →  public/data/**
 *
 * Хоёр шаттай:
 *   1. `build-data.mjs`      — эх сурвалжаас JSON үүсгэнэ
 *   2. `apply-machine-mn.mjs` — content/mn/machine/*.json орчуулгыг нэгтгэнэ
 *
 * Зөвхөн эхний шатыг ажиллуулбал жишээ өгүүлбэрийн 13,718 монгол орчуулга
 * устана — тиймээс `npm run data:build` энэ скриптийг дуудна.
 *
 * `meta.json`-ийн `builtAt`-ыг зөвхөн агуулга өөрчлөгдсөн үед шинэчилнэ:
 * өөрчлөлтгүй rebuild нь git-д хуурамч diff үүсгэхгүй.
 */
import { spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const META = path.join(ROOT, "public/data/index/meta.json");

const readMeta = async () => {
  try {
    return JSON.parse(await readFile(META, "utf8"));
  } catch {
    return null;
  }
};

const before = await readMeta();

for (const script of ["build-data.mjs", "apply-machine-mn.mjs"]) {
  const res = spawnSync(process.execPath, [path.join(ROOT, "scripts", script)], { stdio: "inherit" });
  if (res.status !== 0) process.exit(res.status ?? 1);
}

const after = await readMeta();
if (before && after) {
  const { builtAt: _a, ...a } = before;
  const { builtAt: _b, ...b } = after;
  if (JSON.stringify(a) === JSON.stringify(b)) {
    after.builtAt = before.builtAt;
    await writeFile(META, JSON.stringify(after, null, 2), "utf8");
  }
}
