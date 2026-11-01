/**
 * CANONICAL FIX — үг → ханз холбоосыг бодит ханзны сантай тааруулна.
 *
 * `build-data.mjs` нь үгийн доторх бүх CJK тэмдэгтийг `kd`-д бичдэг ч
 * зарим нь бидний нийлүүлдэг ханзны санд байхгүй (JLPT-д хамаарахгүй
 * ховор тэмдэгт). Тийм холбоос нь дэлгэрэнгүй хуудас дээр хоосон
 * линк үүсгэдэг тул энд цэвэрлэнэ. Скрипт идемпотент — дахин ажиллуулж
 * болно, өөрчлөлт байхгүй бол файлд хүрэхгүй.
 *
 * Ажиллуулах: node scripts/fix-links.mjs  (эсвэл npm run data:links)
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "public/data");
const LEVELS = ["n5", "n4", "n3", "n2", "n1"];

const kanji = new Set();
for (const lv of LEVELS) {
  const rows = JSON.parse(await readFile(path.join(DATA, `kanji/${lv}.json`), "utf8"));
  for (const k of rows) kanji.add(k.k);
}

let filesChanged = 0;
let linksRemoved = 0;
let wordsAffected = 0;

for (const lv of LEVELS) {
  const file = path.join(DATA, `vocab/${lv}.json`);
  const raw = await readFile(file, "utf8");
  const rows = JSON.parse(raw);
  let touched = false;

  for (const v of rows) {
    if (!Array.isArray(v.kd)) continue;
    const kept = v.kd.filter((ch) => kanji.has(ch));
    if (kept.length === v.kd.length) continue;
    linksRemoved += v.kd.length - kept.length;
    wordsAffected += 1;
    v.kd = kept;
    touched = true;
  }

  if (touched) {
    filesChanged += 1;
    await writeFile(file, JSON.stringify(rows) + (raw.endsWith("\n") ? "\n" : ""));
  }
}

console.log(
  filesChanged
    ? `kanji холбоос: ${linksRemoved} тасарсан холбоос, ${wordsAffected} үг цэвэрлэгдлээ (${filesChanged} файл).`
    : "kanji холбоос: засах зүйл байхгүй.",
);
