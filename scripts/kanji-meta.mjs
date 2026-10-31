#!/usr/bin/env node
/**
 * `npm run kanji:meta` — ханзын metadata-н record тус бүрийн тайлан.
 *
 *   public/data/kanji/*.json  +  .cache/sources/**  →  content/review/KANJI-META.md
 *
 * Юу хийдэг вэ:
 *   1. Бүх түвшний ханзыг уншина.
 *   2. `rad` / `on` / `kun` бүр дээр: байна уу, дутуу уу? Дутуу бол
 *      KANJIDIC2 / kanji-data / OpenJLPT гэсэн гурван эх сурвалжийг шалгана.
 *   3. Эх сурвалжгүй мөрийг `needs-review` гэж record тус бүрээр гаргана —
 *      **таамаглаар дүүргэдэггүй**.
 *   4. Эх сурвалжаар нөхсөн мөрийг мөн record тус бүрээр (эх сурвалжтай) хэвлий.
 *
 * Эх сурвалж (` .cache/sources/** `) байхгүй бол зогсоно: тайланг өгөгдөлгүй
 * «болгох» нь буруу тайлан үүсгэнэ.
 *
 * Ажиллуулах:  npm run data:fetch  (эхлээд)  дараа нь  npm run kanji:meta
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { kanjiGaps, kangxiChar, renderReport } from "./lib/kanji-meta.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_REL = "content/review/KANJI-META.md";
const LEVELS = ["N5", "N4", "N3", "N2", "N1"];

const read = (p, fallback) => {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return fallback;
  }
};

const nonEmpty = (v) => (typeof v === "string" && v.trim() ? v : null);
const nonEmptyArr = (v) => (Array.isArray(v) && v.length ? v : null);
/** Англи үг (WaniKani радикалын нэр) эсэх — радикал талбарт ханз биш. */
const isLatinWord = (v) => typeof v === "string" && v.trim() !== "" && !/[\u3040-\u30ff\u3400-\u9fff\u2f00-\u2fd5]/.test(v);

/**
 * Олон эх сурвалжаас радикал сонгоно — build-data.mjs-ийн дараалалтай ИЖИЛ.
 * @returns {{v: string|null, from: string|null}}
 */
export function pickRadical(k, curated, kanjiData, openjlpt, radicals) {
  const c = nonEmpty(curated?.rad);
  if (c) return { v: c, from: "content" };
  const o = nonEmpty(openjlpt?.radical);
  if (o) return { v: o, from: "openjlpt" };
  const kc = kangxiChar(radicals[k]);
  if (kc) return { v: kc, from: "kanjidic2" };
  const wk = nonEmpty(kanjiData?.wk_radicals?.[0]);
  if (wk) return { v: wk, from: "wk" };
  return { v: null, from: null };
}

/** Эх сурвалжуудыг уншина (тайлан хоёрт ашиглана). */
function loadSources(root) {
  const src = path.join(root, ".cache/sources");
  const kdFile = path.join(src, "kanji-data/kanji.json");
  if (!fs.existsSync(kdFile)) {
    throw new Error(`эх сурвалж олдсонгүй (${path.relative(root, kdFile)}) — эхлээд \`npm run data:fetch\` ажиллуулна уу`);
  }
  const radicals = read(path.join(src, "jamdict-data/kanji-radicals.json"), null)?.radicals ?? {};
  const kanjiData = read(kdFile, {}) ?? {};
  const openjlpt = {};
  for (const lv of LEVELS) {
    const arr = read(path.join(src, "openjlpt/data/json/kanji", `${lv.toLowerCase()}.json`), []) ?? [];
    for (const e of arr) openjlpt[e.character ?? e.kanji ?? e.literal] = e;
  }
  return { radicals, kanjiData, openjlpt };
}

/**
 * Дутуу `rad` / `on` / `kun`-ийг ЭХ СУРВАЛЖААР нөхнө (зөвхөн хоосон талбар;
 * байгаа утгыг хэзээ ч өөрчилдөггүй, мөрүүдийн дараалал өөрчлөгдөхгүй).
 *
 * Радикалд ганц нөхцөл өөрчилнө: одоогийн утга нь англи үг байхад
 * (WaniKani радикалын нэр — «Bamboo» мэт) KANJIDIC2-ийн баримтат
 * радикалаар солино. Ханз эсвэл хоосон байвал хэвээр үлдэнэ.
 *
 * `src` талбарт radical KANJIDIC2-аас ирсэн бол `+kanjidic2` нэмэгдэнэ —
 * ингэж л тайлан (content/review/KANJI-META.md) эх сурвалжийг record
 * тус бүрээр харуулна.
 */
export function applyKanjiMeta(root = ROOT) {
  const { radicals, kanjiData, openjlpt } = loadSources(root);
  const curated = read(path.join(root, "content/mn/kanji.json"), {}) ?? {};
  const stats = { radFilled: 0, radReplaced: 0, onFilled: 0, kunFilled: 0, files: 0 };
  const notes = [];
  let offset = 0;
  let searchDirty = false;
  const searchFile = path.join(root, "public/data/index/search.json");
  const search = read(searchFile, null);

  for (const lv of LEVELS) {
    const rel = `public/data/kanji/${lv.toLowerCase()}.json`;
    const file = path.join(root, rel);
    const arr = read(file, null);
    if (!Array.isArray(arr)) throw new Error(`${rel} уншигдсангүй`);
    let changed = false;

    arr.forEach((r, i) => {
      const k = r.k;
      const c = curated[k];
      const oj = openjlpt[k];
      const kd = kanjiData[k];

      // 1) радикал
      const cur = nonEmpty(r.rad);
      if (!cur || isLatinWord(cur)) {
        const { v, from } = pickRadical(k, c, kd, oj, radicals);
        if (v && v !== cur) {
          r.rad = v;
          changed = true;
          if (cur) {
            stats.radReplaced++;
            notes.push(`rad ${k}: "${cur}" → ${v} (${from})`);
          } else {
            stats.radFilled++;
          }
          if (from === "kanjidic2" && typeof r.src === "string" && !r.src.includes("+kanjidic2")) {
            r.src = `${r.src}+kanjidic2`;
          }
        }
      }

      // 2) он/кун уншлага — зөвхөн хоосон байхад
      let onChanged = false;
      for (const [field, kdKey, ojKey, max] of [
        ["on", "readings_on", "onyomi", 3],
        ["kun", "readings_kun", "kunyomi", 4],
      ]) {
        if (nonEmptyArr(r[field])) continue;
        const list = nonEmptyArr(c?.[field]) ?? nonEmptyArr(kd?.[kdKey]) ?? nonEmptyArr(oj?.[ojKey]);
        if (!list) continue;
        r[field] = list.slice(0, max);
        changed = true;
        if (field === "on") onChanged = true;
        stats[`${field}Filled`]++;
      }

      // 3) хайлтын индекс ханзны анхны он-уншлагыг (k[i][1]) ашиглана
      if (onChanged && search && Array.isArray(search.k)) {
        const entry = search.k[offset + i];
        if (entry && entry[1] !== (r.on?.[0] ?? "")) {
          entry[1] = r.on?.[0] ?? "";
          searchDirty = true;
        }
      }
    });

    if (changed) {
      fs.writeFileSync(file, JSON.stringify(arr));
      stats.files++;
    }
    offset += arr.length;
  }

  if (search && Array.isArray(search.k) && search.k.length !== offset) {
    throw new Error(`search.k (${search.k.length}) ≠ ханзны нийт (${offset}) — индексийг дахин барих шаардлагатай`);
  }
  if (search && searchDirty) fs.writeFileSync(searchFile, JSON.stringify(search));
  return { stats, notes };
}

/**
 * Тайлан бэлтгэнэ.
 * @param {string} root төслийн үндсэн зам
 * @returns {{md: string, rows: object[], stats: object}}
 */
export function buildKanjiMetaReport(root = ROOT) {
  const { radicals, kanjiData, openjlpt } = loadSources(root);

  const records = [];
  for (const lv of LEVELS) {
    const arr = read(path.join(root, "public/data/kanji", `${lv.toLowerCase()}.json`), []) ?? [];
    records.push(...arr);
  }
  if (!records.length) throw new Error("public/data/kanji/*.json уншигдсангүй");

  const rows = kanjiGaps(records, { radicals, kanjiData, openjlpt });

  const empty = (v) => !(Array.isArray(v) && v.length);
  const byField = {};
  for (const f of ["rad", "on", "kun"]) {
    const have = records.filter((r) => (f === "rad" ? !!r.rad : !empty(r[f]))).length;
    byField[f] = { have, miss: records.length - have };
  }
  const byLevel = LEVELS.map((lvl) => {
    const recs = records.filter((r) => r.lvl === lvl);
    const missRows = rows.filter((r) => r.lvl === lvl && r.status === "needs-review");
    return {
      lvl,
      total: recs.length,
      miss: missRows.length,
      records: new Set(missRows.map((r) => r.k)).size,
    };
  });

  return { md: renderReport(rows, { total: records.length, byField, byLevel }), rows, stats: { total: records.length, byField, byLevel } };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const cmd = process.argv[2] ?? "report";
  try {
    if (cmd === "apply") {
      const { stats, notes } = applyKanjiMeta();
      console.log("✓ дутуу metadata-г эх сурвалжаар нөхлөө:");
      console.log(`  радикал нөхсөн ${stats.radFilled} · англи нэрийг солисон ${stats.radReplaced}`);
      console.log(`  он нөхсөн ${stats.onFilled} · кун нөхсөн ${stats.kunFilled} · файл ${stats.files}`);
      for (const n of notes.slice(0, 30)) console.log(`  · ${n}`);
      if (notes.length > 30) console.log(`  ... өөр ${notes.length - 30} зам`);
      process.exit(0);
    }
    if (cmd !== "report") throw new Error(`танигдаагүй тушаал: ${cmd} (боломжтой: report, apply)`);
    const { md, rows, stats } = buildKanjiMetaReport();
    const file = path.join(ROOT, OUT_REL);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, md);
    const needs = rows.filter((r) => r.status === "needs-review").length;
    const filled = rows.filter((r) => r.status !== "needs-review").length;
    console.log(`✓ ${OUT_REL} шинэчлэгдлээ`);
    console.log(`  бичлэг ${stats.total} · нөхсөн ${filled} · needs-review ${needs}`);
    for (const b of stats.byLevel) console.log(`  ${b.lvl}: ${b.total} бичлэг, дутуу талбар ${b.miss} (ханз ${b.records})`);
    process.exit(0);
  } catch (e) {
    console.error(`✗ ${e.message}`);
    process.exit(1);
  }
}
