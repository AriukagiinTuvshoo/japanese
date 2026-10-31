#!/usr/bin/env node
/**
 * Машин тусламжтай орчуулгыг (content/mn/machine/*.json) public/data-д
 * `mq: "auto"` (“Авто санал”) төлөвтэйгээр тавина.
 *
 * Дүрэм:
 *   - хүний драфт (`draft`) болон курац (`curated`)-ийг **хэзээ ч дарахгүй**;
 *   - үг/ханз нь **текст түлхүүрээр** (`w|r`, ханз) тулгагдана — индексээр биш.
 *     Эрэмбэ өөрчлөгдөхөд орчуулга өөр үг дээр наалдах эрсдэлгүй;
 *   - түлхүүртэй орчуулга байвал авто-тайлбараас (glossary) **давуу**;
 *   - жишээ өгүүлбэрийн `mn` зөвхөн хоосон үедээ нэмэгдэнэ;
 *   - эх өгөгдөл (уншлага, түвшин, бичээс, id) өөрчлөгдөхгүй.
 *
 * Ашиглах: node scripts/apply-machine-mn.mjs  (эсвэл `npm run data:build`)
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { computeMeta, readBuiltData } from "./meta.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "public/data");
const M = path.join(ROOT, "content/mn/machine");
const LEVELS = ["n5", "n4", "n3", "n2", "n1"];
const UP = (l) => l.toUpperCase();

const readJson = async (p, fb = null) => {
  try {
    return JSON.parse(await readFile(p, "utf8"));
  } catch {
    return fb;
  }
};
const writeJson = (p, v, newline = false) =>
  writeFile(p, JSON.stringify(v, null, newline ? 2 : undefined), "utf8");

const stats = {
  vocabAuto: 0, kanjiAuto: 0, grammarAuto: 0,
  vocabEx: 0, grammarEx: 0,
  vocabKept: 0, kanjiKept: 0, grammarKept: 0,
};

/* 1) үгийн сан + ханз ---------------------------------------------- */
const vocabStore = await readJson(path.join(M, "vocab.json"), {});
const kanjiStore = await readJson(path.join(M, "kanji.json"), {});

// Хуучин индекс-түлхүүрт формат (`{ n5: { "0": "..." } }`) эрэмбэ өөрчлөгдөхөд
// орчуулгыг өөр бичлэг дээр тавьдаг байсан. Чимээгүй үргэлжлүүлэхгүй — зогсоно.
for (const [name, store] of [["vocab.json", vocabStore], ["kanji.json", kanjiStore]]) {
  for (const lv of LEVELS) {
    if (store[lv] !== undefined) {
      console.error(
        `✗ content/mn/machine/${name} нь хуучин индекс-түлхүүрт форматтай (${lv}).\n` +
          `  Текстийн түлхүүр рүү хөрвүүлнэ үү (w|r / ханз) — эс бөгөөс орчуулга буруу бичлэгт наалдана.`,
      );
      process.exit(1);
    }
  }
}
if (!Object.keys(vocabStore).length && !Object.keys(kanjiStore).length) {
  console.error("✗ machine store хоосон — орчуулгыг устгахаас сэргийлж зогслоо.");
  process.exit(1);
}

for (const lv of LEVELS) {
  // vocab — түлхүүр: `бичлэг|уншлага`
  const vp = path.join(DATA, "vocab", `${lv}.json`);
  const vocab = await readJson(vp, []);
  vocab.forEach((v) => {
    if (v.mq === "draft" || v.mq === "curated") { stats.vocabKept++; return; }
    const val = vocabStore[`${v.w}|${v.r}`];
    if (!val) return;
    // авто-тайлбар (glossary) байсан ч түлхүүртэй орчуулга давуу
    if (v.mn?.[0] !== val) v.mn = [val];
    v.mq = "auto";
    stats.vocabAuto++;
  });
  await writeJson(vp, vocab);

  // kanji — түлхүүр: ханз өөрөө
  const kp = path.join(DATA, "kanji", `${lv}.json`);
  const kanji = await readJson(kp, []);
  kanji.forEach((k) => {
    if (k.mq === "draft" || k.mq === "curated") { stats.kanjiKept++; return; }
    const val = kanjiStore[k.k];
    if (!val) return;
    if (k.mn?.[0] !== val) k.mn = [val];
    k.mq = "auto";
    stats.kanjiAuto++;
  });
  await writeJson(kp, kanji);
}

/* 2) дүрэм + жишээ өгүүлбэрүүд ------------------------------------- */
const grammarStore = await readJson(path.join(M, "grammar.json"), {});
const vexStore = await readJson(path.join(M, "vex.json"), {});
const gexStore = await readJson(path.join(M, "gex.json"), {});

for (const lv of LEVELS) {
  const gp = path.join(DATA, "grammar", `${lv}.json`);
  const grammar = await readJson(gp, []);
  for (const g of grammar) {
    if (!g.mn && grammarStore[g.id]) { g.mn = grammarStore[g.id]; stats.grammarAuto++; }
    else if (g.mn) stats.grammarKept++;
    for (const e of g.ex ?? []) {
      if (!e.mn && gexStore[e.ja]) { e.mn = gexStore[e.ja]; stats.grammarEx++; }
    }
  }
  await writeJson(gp, grammar);
}
for (const lv of LEVELS) {
  const vp = path.join(DATA, "vocab", `${lv}.json`);
  const vocab = await readJson(vp, []);
  for (const v of vocab) {
    for (const e of v.ex ?? []) {
      if (!e.mn && vexStore[e.ja]) { e.mn = vexStore[e.ja]; stats.vocabEx++; }
    }
  }
  await writeJson(vp, vocab);
}

/* 3) search index (apply-mn-drafts.mjs-тэй ижил хэвээр) ------------- */
const search = await readJson(path.join(DATA, "index/search.json"), { v: [], k: [], g: [] });
const idxV = [], idxK = [], idxG = [];
for (const lv of LEVELS) {
  for (const v of await readJson(path.join(DATA, "vocab", `${lv}.json`), [])) {
    idxV.push([v.w, v.r, v.mn?.[0] ?? v.en?.[0] ?? "", UP(lv), v.tier === "jlpt" ? 0 : 1, v.id]);
  }
  for (const k of await readJson(path.join(DATA, "kanji", `${lv}.json`), [])) {
    idxK.push([k.k, k.on?.[0] ?? "", k.mn?.[0] ?? k.en?.[0] ?? "", UP(lv), k.s ?? 0]);
  }
  for (const g of await readJson(path.join(DATA, "grammar", `${lv}.json`), [])) {
    idxG.push([g.p, g.mn ?? (Array.isArray(g.en) ? g.en[0] : g.en) ?? "", UP(lv), g.id]);
  }
}
await writeJson(path.join(DATA, "index/search.json"), { v: idxV, k: idxK, g: idxG });

/* 4) meta — өгөгдлөөс бүрэн дахин тооцно -------------------------- */
// Гараар тоолуур нэмэх нь build-ийн тооцоотой зөрөх шалтгаан болдог байсан
// (`counts.mn` хуучирч, `grammarExplained` машин орчуулгыг хүний гэж тоолж байв).
// Иймд meta.mjs-ийн computeMeta л ашиглана — нэг л дүрэм.
const metaPath = path.join(DATA, "index/meta.json");
const prevMeta = (await readJson(metaPath, null)) ?? {};
const built = readBuiltData(DATA);
const grammarExpl = built.grammar.filter((g) => typeof g.mn === "string" && g.mn.trim()).length;
const grammarAuto = built.grammar.filter((g) => grammarStore[g.id]).length;
const terms = (await readJson(path.join(ROOT, "content/mn/terms.json"), {})) ?? {};
const meta = computeMeta({
  ...built,
  content: {
    listening: [],
    reading: [],
    kanjiMnemonics: prevMeta.content?.kanjiMnemonics ?? 0,
    // хүний бичсэн тайлбар л — машин орчуулгыг curated мэт тоолохгүй
    grammarExplained: grammarExpl - grammarAuto,
    glossaryTerms: Object.keys(terms).length,
    openjlpt: prevMeta.openjlpt,
  },
  builtAt: prevMeta.builtAt ?? new Date().toISOString(),
  version: prevMeta.version ?? "3.0.0",
});
await writeFile(metaPath, JSON.stringify(meta, null, 2), "utf8");

console.log("Машин орчуулга нэгтгэл:", stats);
