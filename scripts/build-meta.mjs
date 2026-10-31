/**
 * `public/data/index/meta.json`-ыг ОДООГИЙН өгөгдлөөс дахин тооцно.
 * Бүтэн rebuild (scripts/build-data.mjs) хийх шаардлагагүй — тиймээс
 * эх сурвалж татахгүйгээр meta-г шударга болгож болно.
 *
 *   node scripts/build-meta.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { computeMeta, readBuiltData } from "./meta.mjs";

const DATA = path.join(process.cwd(), "public/data");
const OUT = path.join(DATA, "index/meta.json");

const data = readBuiltData(DATA);
const prev = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : {};

const meta = computeMeta({
  ...data,
  content: {
    listening: prev.content?.listeningLessons ? Array(prev.content.listeningLessons) : [],
    reading: prev.content?.readingPassages ? Array(prev.content.readingPassages) : [],
    kanjiMnemonics: Object.values(
      JSON.parse(fs.readFileSync(path.join(process.cwd(), "content/mn/kanji.json"), "utf8")),
    ).filter((k) => k && k.n).length,
    grammarExplained: Object.keys(JSON.parse(fs.readFileSync(path.join(process.cwd(), "content/mn/grammar.json"), "utf8"))).length,
    glossaryTerms: Object.keys(JSON.parse(fs.readFileSync(path.join(process.cwd(), "content/mn/terms.json"), "utf8"))).length,
    openjlpt: prev.openjlpt ?? {},
  },
  version: prev.version ?? "3.0.0",
});

fs.writeFileSync(OUT, JSON.stringify(meta, null, 2));

const c = meta.counts;
console.log(`vocab ${c.vocab} (curated ${c.mn.vocab.curated} · draft ${c.mn.vocab.draft} · auto ${c.mn.vocab.auto})`);
console.log(`kanji ${c.kanji} (curated ${c.mn.kanji.curated} · draft ${c.mn.kanji.draft} · auto ${c.mn.kanji.auto})`);
console.log(`grammar ${c.grammar} (mn ${c.mn.grammar.translated}/${c.grammar})`);
console.log(`examples: vocab ${c.vocabExampleMn}/${c.vocabExampleTotal} · grammar ${c.grammarExampleMn}/${c.grammarExampleTotal}`);
console.log(`sources ${meta.sources.length}`);
console.log(`→ ${path.relative(process.cwd(), OUT)}`);
