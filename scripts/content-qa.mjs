#!/usr/bin/env node
/**
 * `content:qa` — контентын чанарын **хатуу** хаалга (Milestone C3).
 *
 *   Ажиллуулах:  npm run content:qa        (exit 0 = цэвэр, 1 = алдаа)
 *
 * ── ГУРВАН ХЭРЭГСЭЛИЙН ҮҮРЭГ (хоорондоо зөрөхгүй) ───────────────────────────
 *   data:validate        public/data/**-ийн схем, тоо, холбоос, глиф  → хатуу
 *   consistency-check    N2/N1 монгол утгын тайлан (markdown)          → тайлан
 *   content:qa (энэ файл) контентын ДЭВД + чанарын төлөв + нэр томьёо  → хатуу
 *
 * ── КОВЕРАЖИЙН ДҮРМИЙГ ХААНААС УНШИХ ВЭ ──────────────────────────────────────
 *   scripts/lib/coverage.mjs — эндээс `RULES_TEXT` уншина. Тэр дүрмийг
 *   consistency-check мөн ашигладаг тул хоёр хэрэгсэл яг ижил тоог гаргана.
 *   (Хуучин тайлан "НИЙТ … Жишээ MN 0.0%" мөрийг коддог байсан — энэ нь
 *    дүрмээс бус, хатуу мөрөөс байсан алдаа. Одоо бүгд бодит тоо.)
 *
 * ── АЛДАА vs АНХУУРУУЛГА ────────────────────────────────────────────────────
 *   ERROR → exit 1 (CI зогсооно): буруу төлөв, хоосон монгол утга, хүчингүй
 *           холбоос, эх сурвалж/review баталгаагүй curated, нэр томьёо зөрөлдөх
 *   WARN  → зөвхөн мэдээлнэ: хувилбар нэр, латин үсэгтэй монгол утга, уртадсан утга
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  LEVELS,
  MQ_STATUSES,
  RULES_TEXT,
  coverageTable,
  hasMnValue,
} from "./lib/coverage.mjs";

const CYRILLIC = /[\u0400-\u04FF]/;
const LATIN = /[A-Za-z]/;
const VALID_STATUS = new Set(["curated", "draft", "needs_review"]);

/** JSON уншина; алдааг `errors`-д file түвшинд бичнэ. */
function readJson(file, label, errors, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    errors.push(`${label} :: JSON уншиж чадсангүй :: ${e.message}`);
    return fallback;
  }
}

/**
 * JSON дотор ижил түлхүүр давхардсаныг илрүүлнэ.
 * `JSON.parse` давхардсан түлхүүрийг **дамжин өнгөрөөд** (соноогүй) хамгийн
 * сүүлийн утгыг авдаг тул гараар бичсэн файлд мөр алга болох эрсдэлтэй.
 * public/data-г data:validate (id-ийн тоо) хянадаг; контентын файлыг энд.
 * @returns {string[]} давхардсан түлхүүрүүд
 */
export function duplicateJsonKeys(raw) {
  const dups = [];
  const stack = [];
  let i = 0;
  const n = raw.length;
  while (i < n) {
    const c = raw[i];
    if (c === '"') {
      let j = i + 1;
      let s = "";
      while (j < n) {
        if (raw[j] === "\\") {
          s += raw[j + 1];
          j += 2;
          continue;
        }
        if (raw[j] === '"') break;
        s += raw[j];
        j++;
      }
      let k = j + 1;
      while (k < n && /\s/.test(raw[k])) k++;
      const top = stack[stack.length - 1];
      if (raw[k] === ":" && top && top.type === "obj") {
        if (top.keys.has(s)) dups.push(s);
        else top.keys.add(s);
      }
      i = j + 1;
      continue;
    }
    if (c === "{") stack.push({ type: "obj", keys: new Set() });
    else if (c === "[") stack.push({ type: "arr", keys: new Set() });
    else if (c === "}" || c === "]") stack.pop();
    i++;
  }
  return dups;
}

export function runQa({ root = process.cwd() } = {}) {
  const errors = [];
  const warnings = [];
  const info = [];
  const E = (where, record, field, msg) =>
    errors.push(`${where} :: ${record ? `${record} :: ` : ""}${field ? `${field}: ` : ""}${msg}`);
  const W = (where, record, field, msg) =>
    warnings.push(`${where} :: ${record ? `${record} :: ` : ""}${field ? `${field}: ` : ""}${msg}`);

  /* ── 1. унших ─────────────────────────────────────────────────────────── */
  const dataDir = path.join(root, "public/data");
  const contentDir = path.join(root, "content/mn");
  const vocab = LEVELS.flatMap((l) =>
    readJson(path.join(dataDir, `vocab/${l.toLowerCase()}.json`), `public/data/vocab/${l.toLowerCase()}.json`, errors, []),
  );
  const kanji = LEVELS.flatMap((l) =>
    readJson(path.join(dataDir, `kanji/${l.toLowerCase()}.json`), `public/data/kanji/${l.toLowerCase()}.json`, errors, []),
  );
  const grammar = LEVELS.flatMap((l) =>
    readJson(path.join(dataDir, `grammar/${l.toLowerCase()}.json`), `public/data/grammar/${l.toLowerCase()}.json`, errors, []),
  );
  const meta = readJson(path.join(dataDir, "index/meta.json"), "public/data/index/meta.json", errors, null);

  const contentVocab = readJson(path.join(contentDir, "vocab.json"), "content/mn/vocab.json", errors, null);
  const contentKanji = readJson(path.join(contentDir, "kanji.json"), "content/mn/kanji.json", errors, null);
  const contentGrammar = readJson(path.join(contentDir, "grammar.json"), "content/mn/grammar.json", errors, null);
  const terms = readJson(path.join(contentDir, "terms.json"), "content/mn/terms.json", errors, null);

  // давхардсан түлхүүр: JSON.parse амжилттай ч нэг мөр нь алга болдог
  for (const name of ["vocab.json", "kanji.json", "grammar.json", "terms.json"]) {
    const file = path.join(contentDir, name);
    if (!fs.existsSync(file)) continue;
    for (const key of duplicateJsonKeys(fs.readFileSync(file, "utf8"))) {
      E(`content/mn/${name}`, key, "key", "давхардсан түлхүүр — нэг мөр нь алга болно (JSON сүүлийн утгыг авна)");
    }
  }

  if (!vocab.length) E("public/data/vocab", "", "", "үгийн сан уншигдсангүй");

  /* ── 2. terms.json (C2 нэр томьёоны толь) ────────────────────────────── */
  const TERMS = "content/mn/terms.json";
  const jaToMn = new Map();
  if (terms !== null) {
    if (Array.isArray(terms) || typeof terms !== "object") {
      E(TERMS, "", "", "толь нь объект байх ёстой (түлхүүр = тогтмол нэр)");
    } else {
      for (const [key, v] of Object.entries(terms)) {
        if (!key.trim()) E(TERMS, key, "key", "хоосон түлхүүр");
        if (typeof v === "string") {
          // хуучин хэлбэр: makeAutoGloss ажиллана, гэхдээ provenance үгүй
          if (!v.trim()) E(TERMS, key, "value", "хоосон монгол утга");
          W(TERMS, key, "value", "хуучин string хэлбэр — эх сурвалж/төлөвгүй (объект хэлбэрт шилжүүлнэ үү)");
          continue;
        }
        if (!v || typeof v !== "object") {
          E(TERMS, key, "value", "объект биш (mn/ja/source/status шаардлагатай)");
          continue;
        }
        for (const f of ["mn", "ja", "source", "status"]) {
          if (typeof v[f] !== "string" || !v[f].trim()) E(TERMS, key, f, "хоосон эсвэл string биш");
        }
        if (typeof v.status === "string" && !VALID_STATUS.has(v.status)) {
          E(TERMS, key, "status", `"${v.status}" буруу (allowed: ${[...VALID_STATUS].join(", ")})`);
        }
        // 4-р нөхцөл: review хийгдээгүй зүйл curated болохгүй
        if (v.status === "curated") {
          for (const f of ["source", "reviewedBy", "reviewedAt"]) {
            if (typeof v[f] !== "string" || !v[f].trim()) {
              E(TERMS, key, "status", `curated төлөвт ${f} заавал (хүн хяналгүйгээр curated тавьдаггүй)`);
            }
          }
        }
        // нэг ойлголт (ижил япон нэр) — олон монгол нэр байж болохгүй
        if (typeof v.ja === "string" && v.ja && typeof v.mn === "string" && v.mn) {
          const prev = jaToMn.get(v.ja);
          if (prev && prev !== v.mn) {
            E(TERMS, key, "ja", `нэг япон нэр "${v.ja}" хоёр монгол нэртэй: "${prev}" ба "${v.mn}"`);
          } else jaToMn.set(v.ja, v.mn);
        }
        if (v.status === "needs_review") info.push(`${TERMS} :: ${key} :: хүлээгдэж буй (needs_review)`);
      }
    }
  }

  /* ── 3. content/mn/* → public/data холбоос + монгол утга ─────────────── */
  const vocabKeys = new Set(vocab.map((v) => `${v.w}|${v.r}`));
  const kanjiKeys = new Set(kanji.map((k) => k.k));
  const patternKeys = new Set(grammar.map((g) => g.p));

  /** @returns {string|null} монгол утга (хоосон бол null) */
  const pickVocab = (val) => (typeof val === "string" ? val : null);
  const pickKanji = (val) => {
    if (typeof val === "string") return val;
    if (val && typeof val === "object" && Array.isArray(val.m)) return val.m.filter(Boolean).join(" · ");
    if (val && typeof val === "object" && typeof val.m === "string") return val.m;
    return null;
  };
  const pickGrammar = (val) => {
    if (val && typeof val === "object" && typeof val.m === "string") return val.m;
    return null;
  };

  const checkEntries = (obj, label, validKeys, keyDesc, pick, extra, maxLength = 60) => {
    if (obj === null) return;
    if (Array.isArray(obj) || typeof obj !== "object") {
      E(label, "", "", "объект биш");
      return;
    }
    for (const [key, val] of Object.entries(obj)) {
      const text = pick(val);
      if (typeof text !== "string" || !text.trim() || text.trim() === "-") {
        E(label, key, "value", "монгол утга хоосон");
      } else if (!CYRILLIC.test(text)) {
        W(label, key, "value", `монгол утга кирилл биш: "${text}"`);
      } else if (LATIN.test(text)) {
        W(label, key, "value", `латин үсэгтэй монгол утга: "${text}"`);
      }
      // уртын дүрэм: толь/утга богино байх ёстой (жишээ тайлбар — бусад хязгаар)
      if (maxLength > 0 && typeof text === "string" && text.length > maxLength) {
        W(label, key, "value", `хэт урт (${text.length} тэмдэгт, хязгаар ${maxLength})`);
      }
      if (extra) extra(key, val, label);
      if (!validKeys.has(key)) E(label, key, "key", `хүчингүй холбоос — ${keyDesc} олдсонгүй`);
    }
  };

  checkEntries(contentVocab, "content/mn/vocab.json", vocabKeys, 'үгийн мөр ("үг|уншлага")', pickVocab);
  checkEntries(contentKanji, "content/mn/kanji.json", kanjiKeys, "канжийн мөр", pickKanji);
  // дүрмийн тайлбар өгүүлбэр тул уртын хязгаар тавьдаггүй (зөвхөн хоосон/кодыг шалгана)
  checkEntries(
    contentGrammar,
    "content/mn/grammar.json",
    patternKeys,
    "дүрмийн хэв (public/data/grammar p)",
    pickGrammar,
    (key, val, label) => {
      // жишээний орчуулга (ex: {"日本語": "..."}) — байвал хоосон байж болохгүй
      if (val && typeof val === "object" && val.ex && typeof val.ex === "object") {
        for (const [ja, mn] of Object.entries(val.ex)) {
          if (typeof mn !== "string" || !mn.trim()) E(label, `${key} → ex[${ja}]`, "ex", "хоосон жишээний орчуулга");
        }
      }
    },
    0,
  );

  /* ── 4. чанарын төлөв + provenance (public/data) ─────────────────────── */
  for (const [list, label, idOf] of [
    [vocab, "public/data/vocab", (r) => `${r.w}|${r.r}`],
    [kanji, "public/data/kanji", (r) => r.k],
  ]) {
    for (const r of list) {
      const id = idOf(r);
      if (!MQ_STATUSES.includes(r.mq)) E(label, id, "mq", `"${r.mq}" буруу төлөв`);
      // curated = хүн хянасан гэдэгт эх сурвалж/баталгаа заавал
      if (r.mq === "curated" && !(typeof r.src === "string" && r.src && typeof r.sid === "string" && r.sid)) {
        E(label, id, "mq", "curated боловч эх сурвалж (src/sid) дутуу — хянагдаагүй мөр curated байж болохгүй");
      }
      if (r.mq === "none" && hasMnValue(r.mn)) E(label, id, "mq", "none боловч монгол утга байна (төлөв үнэн бус)");
      if (r.mq !== "none" && !hasMnValue(r.mn)) E(label, id, "mn", `mq=${r.mq} боловч монгол утга хоосон`);
    }
  }

  /* ── 5. нэр томьёоны хувилбарууд (вариант) — WARN ────────────────────── */
  if (terms && typeof terms === "object") {
    const corpus = [...vocab, ...kanji, ...grammar]
      .flatMap((r) => [r.mn, ...(Array.isArray(r.mn) ? r.mn : []), ...(Array.isArray(r.ex) ? r.ex.map((e) => e.mn) : [])])
      .filter((x) => typeof x === "string");
    for (const [key, v] of Object.entries(terms)) {
      if (!v || typeof v !== "object" || !Array.isArray(v.variants)) continue;
      for (const variant of v.variants) {
        const text = typeof variant === "string" ? variant : variant?.text;
        if (!text) continue;
        const hits = corpus.filter((t) => t.includes(text)).length;
        if (hits > 0) {
          W(TERMS, key, "variants", `"${text}" стандарт бус хувилбар контентод ${hits} удаа байна`);
        }
      }
    }
  }

  /* ── 6. ковераж: нэгдсэн дүрмээр ──────────────────────────────────────── */
  const { rows, total } = coverageTable({ vocab });
  for (const r of rows) {
    const sum = MQ_STATUSES.reduce((a, s) => a + r[s], 0);
    if (!r.balanced) {
      E("coverage", r.level, "mq", `төлөвийн нийлбэр ${sum} ≠ нийт ${r.total} (auto/none-ийг давхар/алгасан байж магадгүй)`);
    }
  }
  if (meta?.counts?.mn?.vocab) {
    const sum = MQ_STATUSES.reduce((a, s) => a + (meta.counts.mn.vocab[s] ?? 0), 0);
    if (sum !== total.total) {
      E("public/data/index/meta.json", "counts.mn.vocab", "", `нийлбэр ${sum} ≠ бодит ${total.total} — тайлан/мэта зөрж байна`);
    }
  }

  /* ── 7. мэдээлэл ─────────────────────────────────────────────────────── */
  const grammarFromContent = contentGrammar && typeof contentGrammar === "object" ? Object.keys(contentGrammar).length : 0;
  info.push(
    `дүрэм: ${grammarFromContent}/${grammar.length} мөр content/mn/grammar.json-аас (үлдсэн нь машин/эх сурвалжаас)`,
  );
  info.push(`төлөв: ${MQ_STATUSES.map((s) => `${s}=${total[s]}`).join(" ")} · нийт=${total.total}`);
  info.push(`нэр томьёо: ${terms && typeof terms === "object" ? Object.keys(terms).length : 0} · needs_review=${info.filter((x) => x.includes("needs_review")).length}`);

  return { errors, warnings, info, coverage: { rows, total }, rules: RULES_TEXT };
}

/* ── CLI ─────────────────────────────────────────────────────────────────── */
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const { errors, warnings, info, coverage, rules } = runQa();
  console.log("── content:qa — контентын чанарын хаалга ─────────────────────────");
  console.log("Коверажийн дүрэм (scripts/lib/coverage.mjs — бүх хэрэгсэл ижил):");
  console.log(`  ${rules}`);
  console.log("");
  console.log("  түвшин  нийт  curated  draft  auto  derived  none   монгол-утгатай  жишээ-MN");
  for (const r of coverage.rows) {
    console.log(
      `  ${r.level.padEnd(6)} ${String(r.total).padStart(4)} ${String(r.curated).padStart(7)} ${String(r.draft).padStart(6)} ${String(r.auto).padStart(5)} ${String(r.derived).padStart(8)} ${String(r.none).padStart(5)} ${String(r.hasMn).padStart(14)} ${String(r.exMn).padStart(9)}`,
    );
  }
  const t = coverage.total;
  console.log(
    `  ${"НИЙТ".padEnd(6)} ${String(t.total).padStart(4)} ${String(t.curated).padStart(7)} ${String(t.draft).padStart(6)} ${String(t.auto).padStart(5)} ${String(t.derived).padStart(8)} ${String(t.none).padStart(5)} ${String(t.hasMn).padStart(14)} ${String(t.exMn).padStart(9)}`,
  );
  for (const i of info) console.log(`  info  ${i}`);
  for (const w of warnings.slice(0, 40)) console.log(`  WARN  ${w}`);
  if (warnings.length > 40) console.log(`  ... өөр ${warnings.length - 40} анхааруулга`);
  for (const e of errors.slice(0, 60)) console.log(`  ERROR ${e}`);
  if (errors.length > 60) console.log(`  ... өөр ${errors.length - 60} алдаа`);
  console.log(
    errors.length
      ? `FAIL: ${errors.length} алдаа, ${warnings.length} анхааруулга`
      : `OK: алдаа байхгүй, ${warnings.length} анхааруулга`,
  );
  process.exit(errors.length ? 1 : 0);
}
