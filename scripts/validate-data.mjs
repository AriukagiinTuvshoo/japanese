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
const MQ = new Set(["none", "draft", "curated"]);
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
const missingStroke = [...kanjiSet].filter((k) => !strokeKeys.has(k));
if (missingStroke.length) warn(`stroke өгөгдөлгүй kanji: ${missingStroke.length} ширхэг (жишээ: ${missingStroke.slice(0, 5).join(" ")})`);

// --- Grammar --------------------------------------------------------------------
let grammarCount = 0;
const grammarIds = new Set();
for (const lv of LEVELS) {
  const arr = readJson(path.join(DATA, `grammar/${lv.toLowerCase()}.json`));
  if (!Array.isArray(arr)) {
    err(`grammar/${lv.toLowerCase()}.json массив биш`);
    continue;
  }
  grammarCount += arr.length;
  for (const g of arr) {
    if (grammarIds.has(g.id)) err(`grammar id давхардсан: ${g.id}`);
    grammarIds.add(g.id);
    if (g.lvl !== lv) err(`grammar ${g.id}: lvl=${g.lvl}, файл=${lv}`);
  }
}
if (meta && meta.counts.grammar !== grammarCount) err(`grammar нийт ${grammarCount} ≠ meta ${meta.counts.grammar}`);

// --- Search index -----------------------------------------------------------------
if (search) {
  if (search.v?.length !== allVocab.length) err(`search.v ${search.v?.length} ≠ vocab ${allVocab.length}`);
  if (search.k?.length !== allKanji.length) err(`search.k ${search.k?.length} ≠ kanji ${allKanji.length}`);
  if (search.g?.length !== grammarCount) err(`search.g ${search.g?.length} ≠ grammar ${grammarCount}`);
}

// --- Report -------------------------------------------------------------------------
console.log(`vocab ${allVocab.length} (draft ${draftVocab.length}), kanji ${allKanji.length} (draft ${draftKanji.length}), grammar ${grammarCount}`);
for (const w of warnings.slice(0, 30)) console.log("  WARN ", w);
if (warnings.length > 30) console.log(`  ... өөр ${warnings.length - 30} анхааруулга`);
for (const e of errors.slice(0, 50)) console.log("  ERROR", e);
if (errors.length > 50) console.log(`  ... өөр ${errors.length - 50} алдаа`);
console.log(errors.length ? `FAIL: ${errors.length} алдаа, ${warnings.length} анхааруулга` : `OK: алдаа байхгүй, ${warnings.length} анхааруулга`);
process.exit(errors.length ? 1 : 0);
