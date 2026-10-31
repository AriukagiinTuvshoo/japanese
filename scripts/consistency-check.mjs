#!/usr/bin/env node
/**
 * N2/N1 МОНГОЛ УТГЫН ТОГТВОР БАЙДЛЫН ШАЛГАЛТ (report-only, exit 0).
 * ------------------------------------------------------------------
 * Япон үг нэгтэй олон өөр монгол утга, нэг утга олон үг дээр давхардах,
 * солонгос/латин тэмдэгт, хэт богино/урт утга, уншлага дутуу, холбоос
 * тасарсан зэргийг илрүүлээд markdown тайлан гаргана.
 *
 * АШИГЛАЛТ:  node scripts/consistency-check.mjs [N2 N1 ...]
 * ГАРГАЛТ:   content/mn/consistency-report.md
 *
 * Энэ нь зөвхөн мэдээлдэг — өгөгдөл өөрчилдөггүй. Алдаа олсон ч
 * exit code 0 (CI-г тогтвортой байлгахын тулд; хатуу хяналт нь
 * data:validate болон content:qa-д байна).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { coverageTable, hasMnValue, RULES_TEXT } from "./lib/coverage.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "public/data");
const OUT = path.join(ROOT, "content/mn/consistency-report.md");
const LEVELS = process.argv.slice(2).length ? process.argv.slice(2) : ["N2", "N1"];
const ALL = ["N5", "N4", "N3", "N2", "N1"];
const J = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const pct = (a, b) => (b ? ((100 * a) / b).toFixed(1) + "%" : "—");
const esc = (s) => String(s).replace(/\|/g, "\\|");

/* ── унших ── */
const kanjiSet = new Set();
for (const l of ALL) for (const k of J(path.join(DATA, `kanji/${l.toLowerCase()}.json`))) kanjiSet.add(k.k);
const grammarIds = new Set();
for (const l of ALL) for (const g of J(path.join(DATA, `grammar/${l.toLowerCase()}.json`))) grammarIds.add(g.id);

const vocab = LEVELS.flatMap((l) => J(path.join(DATA, `vocab/${l.toLowerCase()}.json`)));
const kanji = LEVELS.flatMap((l) => J(path.join(DATA, `kanji/${l.toLowerCase()}.json`)));
const grammar = LEVELS.flatMap((l) => J(path.join(DATA, `grammar/${l.toLowerCase()}.json`)));

/* ── 1. нэвтрүүлэлт ──
   ДҮРЭМ: scripts/lib/coverage.mjs (content:qa-тай ЯГ ИЖИЛ) —
   curated+draft+auto+derived+none = нийт; auto ≠ none; hasMn төлөвөөс үл хамаарна. */
const { rows: vocabRows, total: vocabTotal } = coverageTable({ vocab });
const coverage = LEVELS.map((l) => {
  const k = J(path.join(DATA, `kanji/${l.toLowerCase()}.json`));
  const g = J(path.join(DATA, `grammar/${l.toLowerCase()}.json`));
  const row = vocabRows.find((r) => r.level === l);
  return {
    l, vt: row.total, vm: row.hasMn,
    curated: row.curated, draft: row.draft, auto: row.auto, derived: row.derived, none: row.none,
    kt: k.length, km: k.filter((x) => hasMnValue(x.mn)).length,
    gt: g.length, gm: g.filter((x) => x.mn).length,
    ex: row.examples, exMn: row.exMn,
  };
});

/* ── 2. үнэхээр зөрүү: ижил үг + ижил уншлага, өөр монгол утга ── */
const byEntry = new Map();
for (const v of vocab) {
  const key = `${v.w}|${v.r}`;
  if (!byEntry.has(key)) byEntry.set(key, []);
  byEntry.get(key).push(v);
}
const conflicts = [];
for (const [key, list] of byEntry) {
  if (list.length < 2) continue;
  const glosses = new Set(list.flatMap((x) => x.mn ?? []));
  if (glosses.size > 1) {
    conflicts.push({ w: key.split("|")[0], items: list.map((x) => ({ lvl: x.lvl, r: x.r, mn: (x.mn ?? []).join(" / ") || "—" })) });
  }
}

/* ── 2.1. гомоног: ижил бичээс, ӨӨР уншлага — хэвийн тохиолдол (мэдээлэл) ──
   擦る こする / 擬る かしい ... иймэрхүү нь өөр үг тул зөрүүд биш. */
const byWord = new Map();
for (const v of vocab) {
  if (!byWord.has(v.w)) byWord.set(v.w, []);
  byWord.get(v.w).push(v);
}
const homographs = [];
for (const [w, list] of byWord) {
  if (list.length < 2) continue;
  const readings = new Set(list.map((x) => x.r));
  if (readings.size > 1) {
    homographs.push({ w, items: list.map((x) => ({ lvl: x.lvl, r: x.r, mn: (x.mn ?? []).join(" / ") || "—" })) });
  }
}

/* ── 3. нэг утга — олон өөр үг (утга алдагдах) ── */
const byGloss = new Map();
for (const v of vocab) for (const g of v.mn ?? []) {
  if (!byGloss.has(g)) byGloss.set(g, []);
  byGloss.get(g).push(v);
}
const lossy = [...byGloss]
  .filter(([, list]) => new Set(list.map((v) => v.w)).size >= 8)
  .map(([g, list]) => ({ g, n: new Set(list.map((v) => v.w)).size, words: [...new Set(list.map((v) => v.w))].slice(0, 10) }))
  .sort((a, b) => b.n - a.n);

/* ── 4. бичвэр / урт ── */
const latin = [];
const outliers = [];
const placeholders = [];
for (const v of vocab) for (const g of v.mn ?? []) {
  if (/[A-Za-z]/.test(g)) latin.push({ w: v.w, lvl: v.lvl, g });
  if (g.length > 60 || (g.length < 2 && g !== "-")) outliers.push({ w: v.w, lvl: v.lvl, g, len: g.length });
  if (g === "-" || g.trim() === "") placeholders.push({ w: v.w, lvl: v.lvl, g });
}

/* ── 5. уншлага дутуу ── */
const noReading = vocab.filter((v) => !v.r);
const noRomaji = vocab.filter((v) => !v.rm);
const noEn = vocab.filter((v) => !v.en?.length);

/* ── 6. холбоос ── */
const brokenKanjiLinks = [];
for (const v of vocab) for (const ch of v.kd ?? []) if (!kanjiSet.has(ch)) brokenKanjiLinks.push({ w: v.w, lvl: v.lvl, ch });
const brokenGrammarLinks = [];
for (const g of grammar) for (const t of g.related ?? []) if (!grammarIds.has(t)) brokenGrammarLinks.push({ id: g.id, t });

/* ── 7. ханз / дүрэм ── */
const kanjiNoRad = kanji.filter((k) => !k.rad).map((k) => k.k);
const kanjiNoMn = kanji.filter((k) => !k.mn?.length);
const grammarNoMn = grammar.filter((g) => !g.mn).map((g) => g.id);

/* ── тайлан ── */
const L = [];
const now = new Date().toISOString().slice(0, 10);
L.push(`# Монгол утгын тогтворт байдлын тайлан — ${LEVELS.join(", ")}`);
L.push("");
L.push(`Үүсгэсэн: ${now} · \`${path.relative(ROOT, fileURLToPath(import.meta.url))}\` · агуулга: ${vocab.length} үг, ${kanji.length} ханз, ${grammar.length} дүрэм`);
L.push("");
L.push("> Энэ тайлан **зөвхөн мэдээлнэ** — өгөгдөл өөрчлөөгүй. Хүний шийдвэр шаардлагатай зүйлсийг");
L.push("> `content/mn/REVIEW_NEEDED.md`-д оруулна уу. \"curated\" тэмдэг **зөвхөн хүн хянасаны дараа**.");
L.push("");
L.push("## 1. Нэвтрүүлэлт");
L.push("");
L.push("| Түвшин | Үг | MN утга | curated | draft | auto | derived | none | Ханз | Ханз MN | Дүрэм | Дүрэм MN | Жишээ | Жишээ MN |");
L.push("|--------|----|---------|---------|-------|------|---------|------|------|---------|------|----------|--------|----------|");
for (const c of coverage) {
  L.push(`| ${c.l} | ${c.vt} | **${pct(c.vm, c.vt)}** | ${c.curated} | ${c.draft} | ${c.auto} | ${c.derived} | ${c.none} | ${c.kt} | ${pct(c.km, c.kt)} | ${c.gt} | ${pct(c.gm, c.gt)} | ${c.ex} | ${pct(c.exMn, c.ex)} |`);
}
const sum = (f) => coverage.reduce((a, c) => a + c[f], 0);
L.push(`| **НИЙТ** | **${sum("vt")}** | **${pct(sum("vm"), sum("vt"))}** | ${sum("curated")} | ${sum("draft")} | ${sum("auto")} | ${sum("derived")} | ${sum("none")} | ${sum("kt")} | ${pct(sum("km"), sum("kt"))} | ${sum("gt")} | ${pct(sum("gm"), sum("gt"))} | ${sum("ex")} | ${pct(sum("exMn"), sum("ex"))} |`);
L.push("");
L.push("> Коверажийн дүрэм: `scripts/lib/coverage.mjs` — энэ тайлан болон `content:qa` ЯГ ИЖИЛ тоог гаргана.");
L.push("");
for (const line of RULES_TEXT.split("\n")) L.push(`- ${line}`);
L.push("");
void vocabTotal;
L.push("");

const sec = (n, title, count, body) => {
  L.push(`## ${n}. ${title} — **${count}**`);
  L.push("");
  if (!count) { L.push("Асуудал олдсонгүй ✅"); L.push(""); return; }
  body();
  L.push("");
};

sec(2, "Нэг үг + нэг уншлага — олон өөр монгол утга (жинхэнэ зөрүү)", conflicts.length, () => {
  L.push("| Үг | Түвшин | Уншлага | Монгол утга |");
  L.push("|----|--------|---------|-------------|");
  for (const c of conflicts.slice(0, 60)) for (const it of c.items) L.push(`| ${esc(c.w)} | ${it.lvl} | ${it.r} | ${esc(it.mn)} |`);
  if (conflicts.length > 60) L.push(`| … | | | *өөр ${conflicts.length - 60}* |`);
});

if (homographs.length) {
  L.push(`## 2.1. Гомоног — ижил бичээс, өөр уншлага (хэвийн, зөрүү биш) — **${homographs.length}**`);
  L.push("");
  L.push("Өөр уншлага = өөр үг. Утга ялгаатай байх нь зүйн зүйн.");
  L.push("");
  L.push("| Үг | Түвшин | Уншлага | Монгол утга |");
  L.push("|----|--------|---------|-------------|");
  for (const c of homographs.slice(0, 40)) for (const it of c.items) L.push(`| ${esc(c.w)} | ${it.lvl} | ${it.r} | ${esc(it.mn)} |`);
  L.push("");
}

sec(3, "Нэг монгол утга — хэт олон үг (утга алдагдах магадлал)", lossy.length, () => {
  L.push("| Монгол утга | Япон үгийн тоо | Жишээ үгс |");
  L.push("|-------------|----------------|-----------|");
  for (const x of lossy.slice(0, 40)) L.push(`| ${esc(x.g)} | ${x.n} | ${esc(x.words.join(", "))} |`);
});

sec(4, "Латин тэмдэг агуулсан монгол утга", latin.length, () => {
  L.push("| Үг | Түвшин | Утга |");
  L.push("|----|--------|------|");
  for (const x of latin.slice(0, 40)) L.push(`| ${esc(x.w)} | ${x.lvl} | ${esc(x.g)} |`);
});

sec(5, "Хэт богино/урт эсвэл тэмдэгт-төхөөрөмж утга", outliers.length + placeholders.length, () => {
  L.push("| Үг | Түвшин | Утга | Урт |");
  L.push("|----|--------|------|-----|");
  for (const x of [...outliers, ...placeholders].slice(0, 40)) L.push(`| ${esc(x.w)} | ${x.lvl} | ${esc(x.g)} | ${x.g.length} |`);
});

sec(6, "Уншлага / англи утга дутуу", noReading.length + noEn.length, () => {
  L.push(`- \`r\` (уншлага) байхгүй: **${noReading.length}**`);
  L.push(`- \`en\` (англи утга) байхгүй: **${noEn.length}**`);
  L.push(`- \`rm\` (ромажи) байхгүй: **${noRomaji.length}** (N5–N1 бүх түвшин)`);
});

sec(7, "Тасарсан холбоос", brokenKanjiLinks.length + brokenGrammarLinks.length, () => {
  L.push(`- үг → ханз: **${brokenKanjiLinks.length}** (${LEVELS.join(", ")})`);
  if (brokenKanjiLinks.length) L.push(`  - жишээ: ${brokenKanjiLinks.slice(0, 12).map((x) => `${x.w}→${x.ch}`).join(", ")}`);
  L.push(`- дүрэм → related: **${brokenGrammarLinks.length}**`);
  if (brokenGrammarLinks.length) L.push(`  - жишээ: ${brokenGrammarLinks.slice(0, 12).map((x) => `${x.id}→${x.t}`).join(", ")}`);
});

sec(8, "Ханз / дүрэмд монгол утга дутуу", kanjiNoMn.length + grammarNoMn.length, () => {
  L.push(`- ханзны монгол утга байхгүй: **${kanjiNoMn.length}/${kanji.length}**`);
  L.push(`- ханзны радикал (` + "`rad`" + `) байхгүй: **${kanjiNoRad.length}**${kanjiNoRad.length ? " (" + kanjiNoRad.slice(0, 20).join(" ") + ")" : ""}`);
  L.push(`- дүрмийн монгол тайлбар байхгүй: **${grammarNoMn.length}/${grammar.length}**`);
  if (grammarNoMn.length) L.push(`  - жишээ: ${grammarNoMn.slice(0, 15).join(", ")}`);
});

L.push("---");
L.push("");
L.push("## Дараагийн алхам");
L.push("");
L.push("1. Зөрүүтэй утгуудыг (2-р хэсэг) хүн шийдэж, `content/mn/vocab.json`-д **curated** болгон бичнэ.");
L.push("2. Олон үг дээр давхардсан утгыг (3-р хэсэг) ялгаж, тус бүрт тохирох утга өгнө.");
L.push("3. Дүрмийн MN тайлбар (8-р хэсэг) болон жишээ өгүүлбэрийн орчуулга нь тусдаа урсгал — `content/mn/grammar.json`.");
L.push("4. `mq: curated`-ийг **зөвхөн** хүн хянасаны дараа тавина уу.");
L.push("");

fs.writeFileSync(OUT, L.join("\n"), "utf8");
console.log(`Тайлан: ${path.relative(ROOT, OUT)}`);
console.log(`  үг ${vocab.length} · ханз ${kanji.length} · дүрэм ${grammar.length}`);
console.log(`  жинхэнэ зөрүү (ижил уншлага): ${conflicts.length} · гомоног (өөр уншлага): ${homographs.length} · олон үг дээр давхдаг утга: ${lossy.length}`);
console.log(`  латинтэй: ${latin.length} · уртын хязгаар зөрсөн: ${outliers.length} · тэмдэгт: ${placeholders.length}`);
console.log(`  уншлага дутуу: ${noReading.length} · тасарсан холбоос: ${brokenKanjiLinks.length + brokenGrammarLinks.length}`);
console.log(`  ханз MN дутуу: ${kanjiNoMn.length} · дүрэм MN дутуу: ${grammarNoMn.length}`);
