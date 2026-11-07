// Phase-0 audit: MN coverage per level + data health. Read-only. `node scripts/audit-coverage.mjs`
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const D = path.join(ROOT, "public/data");
const LV = ["N5", "N4", "N3", "N2", "N1"];
const J = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const pct = (a, b) => (b ? ((100 * a) / b).toFixed(1) + "%" : "n/a");

const kanjiSet = new Set();
const allKanji = [];
for (const l of LV) { const k = J(path.join(D, `kanji/${l.toLowerCase()}.json`)); k.forEach(x => { kanjiSet.add(x.k); allKanji.push(x); }); }
const allGrammar = [];
for (const l of LV) allGrammar.push(...J(path.join(D, `grammar/${l.toLowerCase()}.json`)));

console.log("== VOCAB per level ==");
console.log("lvl  total  mn%       mq:cur/draft/auto/der/none  ex-total ex-mn%  no-reading  no-rm  kd-broken");
const vocabTotals = { total: 0, mn: 0, ex: 0, exMn: 0 };
for (const l of LV) {
  const v = J(path.join(D, `vocab/${l.toLowerCase()}.json`));
  const mq = { curated: 0, draft: 0, auto: 0, derived: 0, none: 0 };
  let mn = 0, ex = 0, exMn = 0, noR = 0, noRm = 0, broken = 0;
  for (const e of v) {
    mq[e.mq] = (mq[e.mq] ?? 0) + 1;
    if (Array.isArray(e.mn) && e.mn.length) mn++;
    if (!e.r) noR++;
    if (!e.rm) noRm++;
    for (const ch of e.kd ?? []) if (!kanjiSet.has(ch)) broken++;
    for (const x of e.ex ?? []) { ex++; if (x.mn && x.mn.trim()) exMn++; }
  }
  vocabTotals.total += v.length; vocabTotals.mn += mn; vocabTotals.ex += ex; vocabTotals.exMn += exMn;
  console.log(`${l}  ${String(v.length).padStart(5)}  ${pct(mn, v.length).padStart(7)}  ${mq.curated}/${mq.draft}/${mq.auto}/${mq.derived}/${mq.none}`.padEnd(58) +
    ` ${String(ex).padStart(7)} ${pct(exMn, ex).padStart(7)}  ${String(noR).padStart(10)}  ${String(noRm).padStart(5)}  ${broken}`);
}
console.log(`ALL ${vocabTotals.total}  mn ${vocabTotals.mn} (${pct(vocabTotals.mn, vocabTotals.total)})  ex-mn ${vocabTotals.exMn}/${vocabTotals.ex} (${pct(vocabTotals.exMn, vocabTotals.ex)})`);

console.log("\n== KANJI per level ==");
console.log("lvl  total  mn%       curated/draft/none  no-strokes  no-rad  no-on/kun  words-in-kanji-mn%");
for (const l of LV) {
  const k = J(path.join(D, `kanji/${l.toLowerCase()}.json`));
  const mq = { curated: 0, draft: 0, auto: 0, derived: 0, none: 0 };
  let mn = 0, noS = 0, noRad = 0, noOn = 0, wTot = 0, wMn = 0;
  for (const e of k) {
    mq[e.mq] = (mq[e.mq] ?? 0) + 1;
    if (Array.isArray(e.mn) && e.mn.length) mn++;
    if (e.s == null) noS++;
    if (!e.rad) noRad++;
    if (!(e.on?.length || e.kun?.length)) noOn++;
    for (const w of e.w ?? []) { wTot++; if (w.mn && w.mn.trim() && w.mn !== "-") wMn++; }
  }
  console.log(`${l}  ${String(k.length).padStart(5)}  ${pct(mn, k.length).padStart(7)}  ${mq.curated}/${mq.draft}/${mq.none}`.padEnd(45) +
    ` ${String(noS).padStart(9)}  ${String(noRad).padStart(6)}  ${String(noOn).padStart(9)}  ${pct(wMn, wTot)} (${wMn}/${wTot})`);
}

console.log("\n== GRAMMAR per level ==");
console.log("lvl  total  mn-explained%  ex-total  ex-mn%   broken-related");
for (const l of LV) {
  const g = J(path.join(D, `grammar/${l.toLowerCase()}.json`));
  const ids = new Set(allGrammar.map(x => x.id));
  let mn = 0, ex = 0, exMn = 0, broken = 0;
  for (const e of g) {
    if (e.mn && e.mn.trim()) mn++;
    for (const x of e.ex ?? []) { ex++; if (x.mn && x.mn.trim()) exMn++; }
    for (const t of e.related ?? []) if (!ids.has(t)) broken++;
  }
  console.log(`${l}  ${String(g.length).padStart(5)}  ${pct(mn, g.length).padStart(12)}  ${String(ex).padStart(8)}  ${pct(exMn, ex).padStart(7)}  ${broken}`);
}

// Furigana / audio / strokes coverage
console.log("\n== OTHER FIELDS ==");
const allV = LV.flatMap(l => J(path.join(D, `vocab/${l.toLowerCase()}.json`)));
let fg = 0, exTot = 0, audio = 0;
for (const e of allV) for (const x of e.ex ?? []) { exTot++; if (x.fg) fg++; if (x.audio || x.audioUrl) audio++; }
console.log(`vocab examples with furigana(fg): ${fg}/${exTot} (${pct(fg, exTot)})`);
console.log(`vocab examples with audio field:   ${audio}/${exTot}`);
const strokes = new Set();
for (const l of LV) Object.keys(J(path.join(D, `strokes/${l.toLowerCase()}.json`))).forEach(k => strokes.add(k));
console.log(`kanji with stroke data: ${strokes.size}/${kanjiSet.size} (${pct(strokes.size, kanjiSet.size)})`);
const meta = J(path.join(D, "index/meta.json"));
console.log(`meta.content: ${JSON.stringify(meta.content)}  sources: ${meta.sources.length}`);
console.log(`search index sizes: v=${J(path.join(D, "index/search.json")).v.length}`);

// Duplicate detection
console.log("\n== DUPLICATES ==");
const seenW = new Map();
for (const e of allV) { const key = `${e.w}|${e.r}`; seenW.set(key, (seenW.get(key) ?? 0) + 1); }
const dups = [...seenW].filter(([, c]) => c > 1);
console.log(`duplicate vocab w|r pairs: ${dups.length}` + (dups.length ? ` e.g. ${dups.slice(0, 5).map(([k]) => k).join(", ")}` : ""));
const seenId = new Map();
for (const e of allV) seenId.set(e.id, (seenId.get(e.id) ?? 0) + 1);
console.log(`duplicate vocab ids: ${[...seenId].filter(([, c]) => c > 1).length}`);

// Script hygiene in MN
const CYR = /[А-Яа-яӨөҮүҺһ]/;
const LAT = /[A-Za-z]/;
let mnLatin = 0;
for (const e of allV) for (const m of e.mn ?? []) if (!CYR.test(m)) mnLatin++;
console.log(`vocab mn values with no Cyrillic: ${mnLatin}`);
