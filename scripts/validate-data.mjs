// public/data/** болон content/mn/*-draft.json-ийн бүтэн байдлыг шалгана.
// Ажиллуулах: npm run data:validate
// Алдаа гарвал exit code 1 буцаана. Анхааруулга нь зөвхөн мэдээлэл.
//
// Шалгах зүйлс:
//   1) бүх JSON parse хийгдэх;
//   2) тоо ширхэг meta.json-ийн byLevel-тэй тохирох;
//   3) шаардлагатай талбарууд, lvl/mq/tier утгууд зөв байх;
//   4) id / түлхүүр давхардахгүй байх;
//   5) mn (Монгол утга) нь кирилл текст байх, "-" эсвэл хоосон биш байх;
//   6) драфтын тоо meta.vocabDraft / meta.kanjiDraft-тай тохирох, драфт JSON-той зөрөхгүй байх;
//   7) search.json-ийн v/k/g тоо өгөгдөлтэй тохирох.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "public/data");
const MN = path.join(ROOT, "content/mn");
const LEVELS = ["N5", "N4", "N3", "N2", "N1"];
const VOCAB_TIERS = new Set(["jlpt", "ext-example", "ext-frequency"]);
const MQ = new Set(["none", "draft", "curated", "auto", "derived"]);
const CYRILLIC = /[\u0400-\u04FF]/;
const errors = [];
const warnings = [];
const err = (msg) => errors.push(msg);
const warn = (msg) => warnings.push(msg);

function readJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (e) {
    err(`JSON уншиж чадсангүй: ${path.relative(ROOT, p)} (${e.message})`);
    return null;
  }
}

const meta = readJson(path.join(DATA, "index/meta.json"));
const search = readJson(path.join(DATA, "index/search.json"));
const vocabDraft = readJson(path.join(MN, "vocab-draft.json")) || {};
const kanjiDraft = readJson(path.join(MN, "kanji-draft.json")) || {};

if (!meta) err("index/meta.json байхгүй");

// --- Vocabulary ---------------------------------------------------------------
const allVocab = [];
for (const lv of LEVELS) {
  const lower = lv.toLowerCase();
  const arr = readJson(path.join(DATA, `vocab/${lower}.json`));
  if (!Array.isArray(arr)) {
    err(`vocab/${lower}.json массив биш`);
    continue;
  }
  if (meta && meta.counts.byLevel.vocab[lv] !== arr.length) {
    err(`vocab ${lv}: файл ${arr.length} ≠ meta ${meta.counts.byLevel.vocab[lv]}`);
  }
  arr.forEach((e, i) => {
    const where = `vocab/${lower}[${i}] ${e.w ?? "?"}`;
    if (typeof e.id !== "string" || !e.id) err(`${where}: id байхгүй`);
    if (typeof e.w !== "string" || !e.w) err(`${where}: w байхгүй`);
    if (typeof e.r !== "string" || !e.r) err(`${where}: r (уншлага) байхгүй`);
    if (!Array.isArray(e.en) || e.en.length === 0) err(`${where}: en (англи утга) хоосон`);
    if (!Array.isArray(e.kd)) err(`${where}: kd (агуулсан ханз) массив биш`);
    if (e.lvl !== lv) err(`${where}: lvl=${e.lvl}, файл=${lv}`);
    if (!VOCAB_TIERS.has(e.tier)) err(`${where}: tier буруу (${e.tier})`);
    if (!MQ.has(e.mq)) err(`${where}: mq буруу (${e.mq})`);
    const mn = e.mn ?? [];
    if (e.mn != null && !Array.isArray(e.mn)) err(`${where}: mn массив биш`);
    else {
      if (e.mq !== "none" && mn.length === 0) err(`${where}: mq=${e.mq} боловч mn хоосон`);
      if (e.mq === "none" && mn.length > 0) err(`${where}: mq=none боловч mn утгатай`);
      for (const g of mn) {
        if (typeof g !== "string" || g.trim() === "" || g.trim() === "-") err(`${where}: хоосон/"-" монгол утга`);
        else if (!CYRILLIC.test(g)) warn(`${where}: монгол утга кирилл биш: "${g}"`);
      }
    }
    allVocab.push(e);
  });
}
if (meta && meta.counts.vocab !== allVocab.length) err(`vocab нийт ${allVocab.length} ≠ meta ${meta.counts.vocab}`);

const dupVocabId = allVocab.length - new Set(allVocab.map((e) => e.id)).size;
if (dupVocabId) err(`vocab id давхардсан: ${dupVocabId}`);

// Драфт тооцоо (mq=draft) ба драфт JSON-ий тохирол
const draftVocab = allVocab.filter((e) => e.mq === "draft");
if (meta && meta.counts.vocabDraft !== draftVocab.length)
  err(`vocabDraft: meta ${meta.counts.vocabDraft} ≠ mq=draft ${draftVocab.length}`);
if (Object.keys(vocabDraft).length !== draftVocab.length)
  warn(`vocab-draft.json (${Object.keys(vocabDraft).length}) ≠ mq=draft (${draftVocab.length}); apply-mn-drafts-г ажиллуулна уу`);
for (const e of draftVocab) {
  const key = `${e.w}|${e.r}`;
  if (vocabDraft[key] === undefined) {
    warn(`vocab-draft.json-д байхгүй: ${key}`);
    continue;
  }
  if ((e.mn ?? [])[0] !== vocabDraft[key]) warn(`драфт зөрүү ${key}: data="${e.mn[0]}" draft="${vocabDraft[key]}"`);
}

// --- Kanji ---------------------------------------------------------------------
const allKanji = [];
for (const lv of LEVELS) {
  const lower = lv.toLowerCase();
  const arr = readJson(path.join(DATA, `kanji/${lower}.json`));
  if (!Array.isArray(arr)) {
    err(`kanji/${lower}.json массив биш`);
    continue;
  }
  if (meta && meta.counts.byLevel.kanji[lv] !== arr.length) {
    err(`kanji ${lv}: файл ${arr.length} ≠ meta ${meta.counts.byLevel.kanji[lv]}`);
  }
  arr.forEach((e, i) => {
    const where = `kanji/${lower}[${i}] ${e.k ?? "?"}`;
    if (typeof e.k !== "string" || [...e.k].length !== 1) err(`${where}: k нь нэг тэмдэгт биш`);
    if (e.lvl !== lv) err(`${where}: lvl=${e.lvl}, файл=${lv}`);
    if (!MQ.has(e.mq)) err(`${where}: mq буруу (${e.mq})`);
    const mn = e.mn ?? [];
    if (e.mn != null && !Array.isArray(e.mn)) err(`${where}: mn массив биш`);
    else {
      if (e.mq !== "none" && mn.length === 0) err(`${where}: mq=${e.mq} боловч mn хоосон`);
      if (e.mq === "none" && mn.length > 0) err(`${where}: mq=none боловч mn утгатай`);
      for (const g of mn) {
        if (typeof g !== "string" || g.trim() === "" || g.trim() === "-") err(`${where}: хоосон/"-" монгол утга`);
        else if (!CYRILLIC.test(g)) warn(`${where}: монгол утга кирилл биш: "${g}"`);
      }
    }
    allKanji.push(e);
  });
}
if (meta && meta.counts.kanji !== allKanji.length) err(`kanji нийт ${allKanji.length} ≠ meta ${meta.counts.kanji}`);
const dupK = allKanji.length - new Set(allKanji.map((e) => e.k)).size;
if (dupK) err(`kanji давхардсан: ${dupK}`);

const draftKanji = allKanji.filter((e) => e.mq === "draft");
if (meta && meta.counts.kanjiDraft !== draftKanji.length)
  err(`kanjiDraft: meta ${meta.counts.kanjiDraft} ≠ mq=draft ${draftKanji.length}`);
for (const e of draftKanji) {
  if (kanjiDraft[e.k] === undefined) warn(`kanji-draft.json-д байхгүй: ${e.k}`);
}

// Strokes: тэмдэгт бүр нь kanji-тай тохирох ёстой
const strokeKeys = new Set();
for (const lv of LEVELS) {
  const s = readJson(path.join(DATA, `strokes/${lv.toLowerCase()}.json`));
  if (s && typeof s === "object") for (const k of Object.keys(s)) strokeKeys.add(k);
}
const kanjiSet = new Set(allKanji.map((e) => e.k));

// Cross-reference audit: a vocabulary item's kanji links must point to kanji
// entries we actually ship. `npm run data:links` (part of data:build) prunes
// characters outside the shipped set, so any remaining link is a real bug:
// it renders as a dead "kanji detail" link in the UI.
const missingVocabKanji = [];
for (const v of allVocab) {
  if (!Array.isArray(v.kd)) continue;
  for (const ch of v.kd) {
    if (!kanjiSet.has(ch)) missingVocabKanji.push(`${v.w} → ${ch}`);
  }
}
if (missingVocabKanji.length) {
  err(`Үгийн сангийн ханзны холбоос тасарсан: ${missingVocabKanji.length} (жишээ: ${missingVocabKanji.slice(0, 8).join(", ")}) — «npm run data:links» ажиллуулна уу`);
}
const missingStroke = [...kanjiSet].filter((k) => !strokeKeys.has(k));
if (missingStroke.length) warn(`stroke өгөгдөлгүй kanji: ${missingStroke.length} ширхэг (жишээ: ${missingStroke.slice(0, 5).join(" ")})`);

// --- Grammar --------------------------------------------------------------------
let grammarCount = 0;
const grammarIds = new Set();
const allGrammar = [];
for (const lv of LEVELS) {
  const arr = readJson(path.join(DATA, `grammar/${lv.toLowerCase()}.json`));
  if (!Array.isArray(arr)) {
    err(`grammar/${lv.toLowerCase()}.json массив биш`);
    continue;
  }
  grammarCount += arr.length;
  if (meta && meta.counts.byLevel.grammar?.[lv] !== arr.length) err(`grammar ${lv}: файл ${arr.length} ≠ meta ${meta.counts.byLevel.grammar?.[lv]}`);
  for (const g of arr) {
    if (grammarIds.has(g.id)) err(`grammar id давхардсан: ${g.id}`);
    grammarIds.add(g.id);
    if (g.lvl !== lv) err(`grammar ${g.id}: lvl=${g.lvl}, файл=${lv}`);
    if (!Array.isArray(g.related)) err(`grammar ${g.id}: related массив биш`);
    allGrammar.push(g);
  }
}

// Grammar links are expected to reference IDs in the same shipped grammar
// corpus. Keep unknown external labels visible as warnings until sources are
// normalized; they must never be silently treated as working links.
const brokenGrammarLinks = [];
for (const g of allGrammar) {
  for (const target of Array.isArray(g.related) ? g.related : []) {
    if (typeof target !== "string" || !grammarIds.has(target)) brokenGrammarLinks.push(`${g.id} → ${String(target)}`);
  }
}
if (brokenGrammarLinks.length) {
  warn(`Дүрмийн холбоосын ID олдсонгүй: ${brokenGrammarLinks.length} (жишээ: ${brokenGrammarLinks.slice(0, 8).join(", ")})`);
}
if (meta && meta.counts.grammar !== grammarCount) err(`grammar нийт ${grammarCount} ≠ meta ${meta.counts.grammar}`);

// --- Search index -----------------------------------------------------------------
if (search) {
  if (search.v?.length !== allVocab.length) err(`search.v ${search.v?.length} ≠ vocab ${allVocab.length}`);
  if (search.k?.length !== allKanji.length) err(`search.k ${search.k?.length} ≠ kanji ${allKanji.length}`);
  if (search.g?.length !== grammarCount) err(`search.g ${search.g?.length} ≠ grammar ${grammarCount}`);

  const vocabIds = new Set(allVocab.map((v) => v.id));
  const indexedVocab = Array.isArray(search.v) ? search.v : [];
  const missingVocabIndex = indexedVocab.filter((row) => !Array.isArray(row) || !vocabIds.has(row[5])).length;
  if (missingVocabIndex) err(`search.v: бодит үгтэй холбогдоогүй ID ${missingVocabIndex}`);

  const indexedGrammar = Array.isArray(search.g) ? search.g : [];
  const missingGrammarIndex = indexedGrammar.filter((row) => !Array.isArray(row) || !grammarIds.has(row[3])).length;
  if (missingGrammarIndex) err(`search.g: бодит дүрэмтэй холбогдоогүй ID ${missingGrammarIndex}`);
}

// Metadata should count only genuinely human-reviewed vocabulary, not drafts.
const curatedVocab = allVocab.filter((v) => v.mq === "curated");
if (meta && meta.counts.vocabMnCurated !== curatedVocab.length) {
  err(`vocabMnCurated: meta ${meta.counts.vocabMnCurated} ≠ curated ${curatedVocab.length}`);
}
for (const lv of LEVELS) {
  const actual = curatedVocab.filter((v) => v.lvl === lv).length;
  if (meta?.counts?.byLevel?.vocabMn && meta.counts.byLevel.vocabMn[lv] !== actual) {
    err(`vocabMn ${lv}: meta ${meta.counts.byLevel.vocabMn[lv]} ≠ curated ${actual}`);
  }
}

// --- UI i18n: EN block must contain zero Cyrillic ---------------------------------
const I18N = path.join(ROOT, "src/lib/i18n.ts");
try {
  const src = (await import("node:fs")).readFileSync(I18N, "utf-8");
  const enStart = src.indexOf('export const ui = {');
  const blocks = [];
  // split top-level `mn: { ... }` / `en: { ... }` blocks inside ui
  const enBlock = src.match(/\n  en: \{[\s\S]*?\n  \},/);
  if (enBlock) {
    const lines = enBlock[0].split("\n");
    lines.forEach((ln, i) => {
      if (CYRILLIC.test(ln)) err(`i18n EN блок кирилл агуулсан (мөр ${i + 1}): ${ln.trim().slice(0, 80)}`);
    });
  } else {
    err("i18n EN блок олдсонгүй");
  }
} catch (e) {
  err(`i18n.ts уншиж чадсангүй: ${e}`);
}

// --- Уншиж ойлголт (content/reading.json) -------------------------------------------
const readingPath = path.join(ROOT, "content/reading.json");
const readings = readJson(readingPath) ?? [];
if (!Array.isArray(readings)) err("reading.json массив биш");
const readingIds = new Set();
for (const r of readings) {
  const tag = `reading ${r?.id ?? "?"}`;
  if (!r || typeof r.id !== "string" || !r.id) { err("reading: id байхгүй"); continue; }
  if (readingIds.has(r.id)) err(`${tag}: id давхцсан`);
  readingIds.add(r.id);
  if (!LEVELS.includes(r.level)) err(`${tag}: түвшин буруу (${r.level})`);
  if (typeof r.title !== "string" || !r.title.trim()) err(`${tag}: title хоосон`);
  if (typeof r.titleJp !== "string" || !r.titleJp.trim()) err(`${tag}: titleJp хоосон`);
  if (!Array.isArray(r.body) || r.body.length === 0) err(`${tag}: body хоосон`);
  else for (const line of r.body) {
    if (typeof line !== "string" || !line.trim()) err(`${tag}: body-д хоосон мөр`);
    else if (/\{[^|{}]*\}/.test(line)) warn(`${tag}: фуригана бүтэц буруу байж болзошгүй — ${line.slice(0, 24)}`);
  }
  if (!Array.isArray(r.glossary)) err(`${tag}: glossary массив биш`);
  else for (const g of r.glossary) {
    if (!g || typeof g.w !== "string" || !g.w.trim()) { err(`${tag}: glossary.w хоосон`); continue; }
    if (typeof g.r !== "string" || !g.r.trim()) err(`${tag}: glossary «${g.w}» уншлагагүй`);
    if (typeof g.mn !== "string" || !g.mn.trim()) err(`${tag}: glossary «${g.w}» монгол утгагүй`);
  }
  if (!Array.isArray(r.questions) || r.questions.length === 0) err(`${tag}: асуултгүй`);
  else for (const [qi, q] of r.questions.entries()) {
    const qtag = `${tag} q${qi + 1}`;
    if (!q || typeof q.q !== "string" || !q.q.trim()) err(`${qtag}: асуулт хоосон`);
    if (!q || !Array.isArray(q.opts) || q.opts.length < 2) err(`${qtag}: сонголт 2-оос цөөн`);
    else if (new Set(q.opts).size !== q.opts.length) err(`${qtag}: сонголт давхцсан`);
    else if (!q.opts.every((o) => typeof o === "string" && o.trim())) err(`${qtag}: хоосон сонголт`);
    if (!q || !Number.isInteger(q.a) || q.a < 0 || q.a >= (q.opts?.length ?? 0)) err(`${qtag}: зөв хариултын индекс буруу (${q?.a})`);
    if (!q || typeof q.why !== "string" || !q.why.trim()) warn(`${qtag}: тайлбаргүй`);
  }
}
for (const lv of LEVELS) {
  if (!readings.some((r) => r?.level === lv)) warn(`reading: ${lv} түвшинд унших эх байхгүй`);
}

// --- Report -------------------------------------------------------------------------
const vocabExamples = allVocab.flatMap((v) => Array.isArray(v.ex) ? v.ex : []);
const grammarExamples = allGrammar.flatMap((g) => Array.isArray(g.ex) ? g.ex : []);
const translatedVocabExamples = vocabExamples.filter((e) => typeof e.mn === "string" && e.mn.trim()).length;
const translatedGrammarExamples = grammarExamples.filter((e) => typeof e.mn === "string" && e.mn.trim()).length;
console.log(`vocab ${allVocab.length} (curated ${curatedVocab.length}, draft ${draftVocab.length}), kanji ${allKanji.length} (draft ${draftKanji.length}), grammar ${grammarCount}`);
console.log(`Монгол жишээ орчуулга: үгийн сан ${translatedVocabExamples}/${vocabExamples.length}, дүрэм ${translatedGrammarExamples}/${grammarExamples.length}`);
for (const w of warnings.slice(0, 30)) console.log("  WARN ", w);
if (warnings.length > 30) console.log(`  ... өөр ${warnings.length - 30} анхааруулга`);
for (const e of errors.slice(0, 50)) console.log("  ERROR", e);
if (errors.length > 50) console.log(`  ... өөр ${errors.length - 50} алдаа`);
console.log(errors.length ? `FAIL: ${errors.length} алдаа, ${warnings.length} анхааруулга` : `OK: алдаа байхгүй, ${warnings.length} анхааруулга`);
process.exit(errors.length ? 1 : 0);
