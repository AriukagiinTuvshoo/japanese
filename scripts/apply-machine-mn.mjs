#!/usr/bin/env node
/**
 * Машин тусламжтай орчуулгыг (content/mn/machine/*.json) public/data-д
 * `mq: "auto"` (“Авто санал”) төлөвтэйгээр тавина.
 *
 * Дүрэм:
 *   - зөвхөн одоо `mq: "none"` буюу утгагүй бичлэгт орно;
 *   - хүний драфт (`draft`) болон курац (`curated`)-ийг **хэзээ ч дарахгүй**;
 *   - жишээ өгүүлбэрийн `mn` зөвхөн хоосон үедээ нэмэгдэнэ;
 *   - эх өгөгдөл (уншлага, түвшин, бичээс, id) өөрчлөгдөхгүй.
 *
 * Ашиглах: node scripts/apply-machine-mn.mjs
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

for (const lv of LEVELS) {
  // vocab
  const vp = path.join(DATA, "vocab", `${lv}.json`);
  const vocab = await readJson(vp, []);
  vocab.forEach((v, i) => {
    if (v.mq === "draft" || v.mq === "curated") { stats.vocabKept++; return; }
    const val = vocabStore[lv]?.[i];
    if (val && !v.mn) { v.mn = [val]; v.mq = "auto"; stats.vocabAuto++; }
  });
  await writeJson(vp, vocab);

  // kanji
  const kp = path.join(DATA, "kanji", `${lv}.json`);
  const kanji = await readJson(kp, []);
  kanji.forEach((k, i) => {
    if (k.mq === "draft" || k.mq === "curated") { stats.kanjiKept++; return; }
    const val = kanjiStore[lv]?.[i];
    if (val && !(k.mn?.length)) { k.mn = [val]; k.mq = "auto"; stats.kanjiAuto++; }
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

/* 4) meta (2-тэйц, төгсгөлд шинэ мөр үгүй — HEAD хэвээр) ---------- */
const metaPath = path.join(DATA, "index/meta.json");
const meta = await readJson(metaPath, null);
if (meta?.counts) {
  const countMq = async (kind) => {
    const out = { auto: 0, draft: 0, curated: 0, none: 0 };
    for (const lv of LEVELS) {
      for (const e of await readJson(path.join(DATA, kind, `${lv}.json`), [])) {
        const q = e.mq ?? (e.mn ? "curated" : "none");
        out[q] = (out[q] ?? 0) + 1;
      }
    }
    return out;
  };
  const vq = await countMq("vocab");
  const kq = await countMq("kanji");
  // бүх тоог өгөгдлөөс дахин тоолно — дахин ажиллуулахад давхарддаггүй
  let grammarExpl = 0, grammarAuto = 0, gexMn = 0, gexAll = 0, vexMn = 0, vexAll = 0;
  for (const lv of LEVELS) {
    for (const g of await readJson(path.join(DATA, "grammar", `${lv}.json`), [])) {
      if (g.mn) {
        grammarExpl++;
        // machine/grammar.json-д байгаа id = машин орчуулга; үгүй бол curated
        if (grammarStore[g.id]) grammarAuto++;
      }
      for (const e of g.ex ?? []) { gexAll++; if (e.mn) gexMn++; }
    }
    for (const v of await readJson(path.join(DATA, "vocab", `${lv}.json`), [])) {
      for (const e of v.ex ?? []) { vexAll++; if (e.mn) vexMn++; }
    }
  }
  meta.counts.vocabDraft = vq.draft;
  meta.counts.kanjiDraft = kq.draft;
  meta.counts.vocabAuto = vq.auto;
  meta.counts.kanjiAuto = kq.auto;
  meta.counts.vocabMnCurated = vq.curated;
  meta.counts.grammarAuto = grammarAuto;
  meta.counts.grammarCurated = grammarExpl - grammarAuto;
  meta.counts.vocabExampleMn = vexMn;
  meta.counts.vocabExampleTotal = vexAll;
  meta.counts.grammarExampleMn = gexMn;
  meta.counts.grammarExampleTotal = gexAll;
  if (meta.content) meta.content.grammarExplained = grammarExpl;
  await writeFile(metaPath, JSON.stringify(meta, null, 2), "utf8");
}

console.log("Машин орчуулга нэгтгэл:", stats);
