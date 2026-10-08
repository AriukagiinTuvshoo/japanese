// Монгол утгын драфтуудыг (content/mn/drafts/*.tsv) нэгтгэж, public/data-г
// .cache/ шаардалгүйгээр шууд шинэчилдэг скрипт.
//
// TSV формат:  <индекс>\t<монгол утга>
//   индекс = public/data/vocab/nX.json (эсвэл kanji/nX.json) дахь массивын байрлал
//   утга "-" эсвэл хоосон бол алгасна.
//
// Файлын нэр:  vocab-n5-a.tsv, vocab-n4-b.tsv ...   kanji-n4.tsv, kanji-n3-a.tsv ...
//
// Ажиллуулах:  node scripts/apply-mn-drafts.mjs
// Энэ нь:
//   1) content/mn/vocab-draft.json, kanji-draft.json-д драфтуудыг нэмнэ
//      (байгаа түлхүүрийг дарахгүй);
//   2) public/data/{vocab,kanji}/*.json-ийн mn/mq талбарыг шинэчилнэ;
//   3) public/data/index/search.json-ийн v/k хэсгийг дахин үүсгэнэ;
//   4) public/data/index/meta.json-ийн vocabDraft/kanjiDraft тоог шинэчилнэ.
// Курац (curated) утга нь драфтаас өмнө орно.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MN = path.join(ROOT, "content/mn");
const DRAFTS = path.join(MN, "drafts");
const DATA = path.join(ROOT, "public/data");
const LEVELS = ["n5", "n4", "n3", "n2", "n1"];

const readJson = (p, fb) => (fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : fb);
const writeJson = (p, v, pretty = false) =>
  fs.writeFileSync(p, (pretty ? JSON.stringify(v, null, 1) + "\n" : JSON.stringify(v)), "utf8");

function readTsv(file) {
  const out = new Map();
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    if (!line.trim()) continue;
    const tab = line.indexOf("\t");
    if (tab < 0) throw new Error(`${path.basename(file)}: таб алга: ${line}`);
    const idx = Number(line.slice(0, tab));
    const gloss = line.slice(tab + 1).trim();
    if (!Number.isInteger(idx)) throw new Error(`${path.basename(file)}: буруу индекс: ${line}`);
    if (!gloss || gloss === "-") continue;
    out.set(idx, gloss);
  }
  return out;
}

const vocabDraftPath = path.join(MN, "vocab-draft.json");
const kanjiDraftPath = path.join(MN, "kanji-draft.json");
const vocabDraft = readJson(vocabDraftPath, {});
const kanjiDraft = readJson(kanjiDraftPath, {});
const vocabCurated = readJson(path.join(MN, "vocab.json"), {});
const kanjiCurated = readJson(path.join(MN, "kanji.json"), {});

const files = fs.existsSync(DRAFTS) ? fs.readdirSync(DRAFTS).sort() : [];
const report = { vocabAdded: 0, vocabSame: 0, vocabConflict: 0, kanjiAdded: 0, kanjiSame: 0, kanjiConflict: 0 };

// 1) TSV -> draft JSON --------------------------------------------------------
for (const lv of LEVELS) {
  const entries = readJson(path.join(DATA, "vocab", `${lv}.json`), []);
  for (const f of files.filter((x) => new RegExp(`^vocab-${lv}-.*\\.tsv$`).test(x))) {
    for (const [idx, gloss] of readTsv(path.join(DRAFTS, f))) {
      const e = entries[idx];
      if (!e) throw new Error(`${f}: ${lv} индекс ${idx} олдсонгүй`);
      const key = `${e.w}|${e.r}`;
      if (vocabDraft[key] === undefined) {
        vocabDraft[key] = gloss;
        report.vocabAdded++;
      } else if (vocabDraft[key] === gloss) report.vocabSame++;
      else report.vocabConflict++;
    }
  }
  for (const f of files.filter((x) => new RegExp(`^kanji-${lv}(-.*)?\\.tsv$`).test(x))) {
    const chars = readJson(path.join(DATA, "kanji", `${lv}.json`), []);
    for (const [idx, gloss] of readTsv(path.join(DRAFTS, f))) {
      const c = chars[idx];
      if (!c) throw new Error(`${f}: ${lv} индекс ${idx} олдсонгүй`);
      if (kanjiDraft[c.k] === undefined) {
        kanjiDraft[c.k] = gloss;
        report.kanjiAdded++;
      } else if (kanjiDraft[c.k] === gloss) report.kanjiSame++;
      else report.kanjiConflict++;
    }
  }
}
writeJson(vocabDraftPath, vocabDraft, true);
writeJson(kanjiDraftPath, kanjiDraft, true);

// 2) public/data-г драфтаар шинэчлэх ----------------------------------------
const searchPath = path.join(DATA, "index/search.json");
const search = readJson(searchPath, { v: [], k: [], g: [] });
const counts = { vocabDraft: 0, kanjiDraft: 0, vocabMn: 0, kanjiMn: 0 };
const idxV = [];
const idxK = [];

for (const lv of LEVELS) {
  const vp = path.join(DATA, "vocab", `${lv}.json`);
  const vocab = readJson(vp, []);
  for (const v of vocab) {
    const key = `${v.w}|${v.r}`;
    const cur = vocabCurated[key] ?? vocabCurated[v.w];
    const dr = vocabDraft[key] ?? vocabDraft[v.w];
    if (cur) {
      v.mn = [cur];
      v.mq = "curated";
    } else if (dr) {
      v.mn = [dr];
      v.mq = "draft";
    }
    if (v.mq === "draft") counts.vocabDraft++;
    if (v.mq === "curated") counts.vocabMn++;
    idxV.push([v.w, v.r, v.mn?.[0] ?? v.en?.[0] ?? "", v.lvl, v.tier === "jlpt" ? 0 : 1, v.id]);
  }
  writeJson(vp, vocab);

  const kp = path.join(DATA, "kanji", `${lv}.json`);
  const kanji = readJson(kp, []);
  for (const k of kanji) {
    const cur = kanjiCurated[k.k]?.m;
    const dr = kanjiDraft[k.k];
    if (cur) {
      k.mn = [cur];
      k.mq = "curated";
    } else if (dr) {
      k.mn = [dr];
      k.mq = "draft";
    }
    if (k.mq === "draft") counts.kanjiDraft++;
    if (k.mq === "curated") counts.kanjiMn++;
    idxK.push([k.k, k.on?.[0] ?? "", k.mn?.[0] ?? k.en?.[0] ?? "", k.lvl, k.s ?? 0]);
  }
  writeJson(kp, kanji);
}

// 3) search.json (g хэсгийг хэвээр үлдээнэ) ----------------------------------
writeJson(searchPath, { v: idxV, k: idxK, g: search.g ?? [] });

// 4) meta.json --------------------------------------------------------------
const metaPath = path.join(DATA, "index/meta.json");
const meta = readJson(metaPath, null);
if (meta?.counts) {
  meta.counts.vocabDraft = counts.vocabDraft;
  meta.counts.kanjiDraft = counts.kanjiDraft;
  meta.counts.vocabMnCurated = counts.vocabMn;
  writeJson(metaPath, meta);
}

console.log("Драфт нэгтгэл:", report);
console.log("public/data-д драфттай:", counts);
