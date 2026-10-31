#!/usr/bin/env node
/**
 * Тасарсан үг→ханз холбоосыг засна (Phase 1, алхам 1).
 *
 * Шалтгаан: build-data.mjs-ийн сонголтын шүүлтүүр ховор ханзыг гаргаж чадахгүй
 * байв. Эх өгөгдөл (.cache/sources) бүрэн биш тул бүтээн байгуулалтыг
 * дахин гүйцэтгэхгүй — харин:
 *   1) тасарсан 108 ханзыг kanji-data-гаас нэмнэ;
 *   2) KanjiVG-аас бичих дарааллын замыг нь татаж авна (энэгүй бол шинэ WARN үүснэ);
 *   3) хэвийг бүтээн байгуулагчтай ижил болгоно;
 *   4) search index / meta-г шинэчилнэ;
 *   5) content/mn/machine/kanji.json-ийн индексийг шинэ байрлалд дахин түлхүүрлэнэ.
 *
 * Ашиглах: node scripts/fix-broken-kanji-links.mjs
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "public/data");
const SRC = path.join(ROOT, ".cache/sources");
const KANJI_DATA = path.join(SRC, "kanji-data-master/kanji.json");
const MACHINE = path.join(ROOT, "content/mn/machine");
const KANJI_VG = (cp) => `https://raw.githubusercontent.com/KanjiVG/kanjivg/master/kanji/${cp}.svg`;
const LEVELS = ["N5", "N4", "N3", "N2", "N1"];
const slug = (l) => l.toLowerCase();

const readJson = async (p, fb = null) => {
  try { return JSON.parse(await readFile(p, "utf8")); } catch { return fb; }
};
const writeJson = (p, v) => writeFile(p, JSON.stringify(v), "utf8");

/* 1. тасарсан холбоос олох ------------------------------------------------ */
const kd = await readJson(KANJI_DATA, null);
if (!kd) { console.error("ОЛДСОНГҮЙ: " + KANJI_DATA); process.exit(1); }

const kanjiSet = new Set();
const byLevel = {};
for (const lv of LEVELS) {
  byLevel[lv] = await readJson(path.join(DATA, "kanji", `${slug(lv)}.json`), []);
  byLevel[lv].forEach((k) => kanjiSet.add(k.k));
}

// vocab → ханз урвуу индекс (build-data-тай ижил дараалал, хязгаар 14)
const wordsOf = new Map();
const missing = new Map(); // char -> "N5" | ... (анхны дэмжсэн түвшин)
for (const lv of LEVELS) {
  const vocab = await readJson(path.join(DATA, "vocab", `${slug(lv)}.json`), []);
  for (const v of vocab) {
    for (const ch of v.kd ?? []) {
      if (!wordsOf.has(ch)) wordsOf.set(ch, []);
      const list = wordsOf.get(ch);
      if (list.length < 14) list.push({ w: v.w, r: v.r, mn: v.mn?.[0] ?? v.en[0], lvl: v.lvl });
      if (!kanjiSet.has(ch) && !missing.has(ch)) missing.set(ch, lv);
    }
  }
}
console.log(`Тасарсан холбоос: ${missing.size} ханз`);
if (!missing.size) { console.log("Засах зүйлгүй."); process.exit(0); }

/* 2. эх мэдээлэл + бичих дараалал ---------------------------------------- */
const svgCache = path.join(SRC, "kanjivg/kanji");
await mkdir(svgCache, { recursive: true });

async function strokesFor(ch) {
  const cp = ch.codePointAt(0).toString(16).padStart(5, "0");
  try {
    const res = await fetch(KANJI_VG(cp));
    if (!res.ok) return null;
    const svg = await res.text();
    const paths = [...svg.matchAll(/<path[^>]*?\sd="([^"]+)"/g)].map((m) => m[1]);
    return paths.length ? paths : null;
  } catch { return null; }
}

// build-data-ийн түвшин гаргах дүрмийг яг давтана (jl байхгүй тохиолдол)
function deriveLevel(info) {
  const g = info.grade ?? null;
  if (g !== null && g <= 2) return "N5";
  if (g !== null && g <= 4) return "N4";
  if (g !== null && g <= 6) return "N3";
  if (g !== null && g <= 8) return "N2";
  return "N1";
}

const entries = [];
for (const [ch, vocabLvl] of missing) {
  const info = kd[ch];
  if (!info) { console.error(`  УНШСАНГҮЙ: ${ch} (kanji-data-д алга)`); process.exitCode = 1; continue; }
  const lvl = deriveLevel(info);
  const en = (info.meanings ?? []).slice(0, 3);
  entries.push({
    ch, lvl, vocabLvl, info, en,
    src: (info.readings_on ?? []).slice(0, 3),
    kun: (info.readings_kun ?? []).slice(0, 4),
    s: info.strokes ?? null,
    g: info.grade ?? null,
    f: info.freq ?? null,
    rad: info.wk_radicals?.[0] ?? null,
  });
}
console.log(`Түвшинд хуваарилалт: ${LEVELS.map((l) => `${l}=${entries.filter((e) => e.lvl === l).length}`).join(" ")}`);

/* 3. монгол утга (EN→MN машин тусламж) ----------------------------------- */
const DELIM = "\n␟\n";
const machineKanji = await readJson(path.join(MACHINE, "kanji.json"), {});
async function translate(texts) {
  const out = new Array(texts.length).fill(null);
  for (let i = 0; i < texts.length; i += 30) {
    const chunk = texts.slice(i, i + 30);
    try {
      const url = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=mn&dt=t&q=" +
        encodeURIComponent(chunk.join(DELIM));
      const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const joined = (json[0] ?? []).map((s) => s[0] ?? "").join("");
      const parts = joined.split(DELIM);
      if (parts.length === chunk.length) parts.forEach((p, j) => (out[i + j] = p.trim()));
      else chunk.forEach((_, j) => (out[i + j] = null));
    } catch { /* дараа нь үлдээнэ */ }
    await new Promise((r) => setTimeout(r, 150));
  }
  return out;
}
const mnResults = await translate(entries.map((e) => e.en.filter(Boolean).join("; ")));
let mtOk = 0;
entries.forEach((e, i) => { e.mn = mnResults[i]; if (e.mn) mtOk++; });
console.log(`Монгол утга: ${mtOk}/${entries.length}`);
if (mtOk !== entries.length) {
  entries.filter((e) => !e.mn).forEach((e) => console.error(`  ОРЧУУЛАГДСАНГҮЙ: ${e.ch} ${e.en.join("; ")}`));
}

/* 4. кановыг түвшинд оруулах + бичих дараалал ---------------------------- */
let inserted = 0;
for (const e of entries) {
  if (!e.mn) continue;
  if (kanjiSet.has(e.ch)) continue;
  byLevel[e.lvl].push({
    k: e.ch,
    lvl: e.lvl,
    lvlSrc: "derived",
    s: e.s, g: e.g, f: e.f,
    en: e.en,
    mn: [e.mn],
    mq: "auto",
    on: e.src,
    kun: e.kun,
    rad: e.rad,
    w: wordsOf.get(e.ch) ?? [],
    mn_mem: null,
    src: "kanji-data",
    sid: e.ch,
  });
  kanjiSet.add(e.ch);
  inserted++;
}
// build-data.mj-ийн жин тэнцвэрийг яг давтана
for (const lv of LEVELS) {
  byLevel[lv].sort((a, b) => (a.f ?? 9e9) - (b.f ?? 9e9) || (a.s ?? 0) - (b.s ?? 0));
}
console.log(`Нэмэгдсэн ханз: ${inserted}`);

/* 5. бичих дараалал (KanjiVG) ------------------------------------------- */
const strokeStats = { added: 0, failed: [] };
for (const e of entries) {
  if (!e.mn) continue;
  const sp = path.join(DATA, "strokes", `${slug(e.lvl)}.json`);
  const strokes = await readJson(sp, {});
  if (strokes[e.ch]) continue;
  const paths = await strokesFor(e.ch);
  if (!paths) { strokeStats.failed.push(e.ch); continue; }
  strokes[e.ch] = paths;
  await writeJson(sp, strokes);
  strokeStats.added++;
}
console.log(`Бичих дараалал: +${strokeStats.added}${strokeStats.failed.length ? `, амжилтгүй: ${strokeStats.failed.join(" ")}` : ""}`);
if (strokeStats.failed.length) process.exitCode = 1;

/* 6. machine/kanji.json-ийг ханз түлхүүрээр шинэчлэх --------------------- */
// Эрэмбэ өөрчлөгдөхөд индекс-түлхүүр хүчингүй болдог тул формат нь ханз өөрөө.
const rekeyed = await readJson(path.join(MACHINE, "kanji.json"), {});
let autoCount = 0;
for (const lv of LEVELS) {
  for (const k of byLevel[lv]) {
    if (k.mq === "auto" && k.mn?.[0]) { rekeyed[k.k] = k.mn[0]; autoCount++; }
  }
}
const sortKeys = (o) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => (a < b ? -1 : 1)));
await writeFile(path.join(MACHINE, "kanji.json"), JSON.stringify(sortKeys(rekeyed), null, 1), "utf8");
console.log(`machine/kanji.json шинэчлэв: ${autoCount} бичлэг`);

/* 7. ханз файлуудыг бичих ------------------------------------------------- */
for (const lv of LEVELS) await writeJson(path.join(DATA, "kanji", `${slug(lv)}.json`), byLevel[lv]);

/* 8. search index ---------------------------------------------------------- */
const idxV = [], idxK = [], idxG = [];
for (const lv of LEVELS) {
  for (const v of await readJson(path.join(DATA, "vocab", `${slug(lv)}.json`), []))
    idxV.push([v.w, v.r, v.mn?.[0] ?? v.en?.[0] ?? "", lv, v.tier === "jlpt" ? 0 : 1, v.id]);
  for (const k of byLevel[lv])
    idxK.push([k.k, k.on?.[0] ?? "", k.mn?.[0] ?? k.en?.[0] ?? "", lv, k.s ?? 0]);
  for (const g of await readJson(path.join(DATA, "grammar", `${slug(lv)}.json`), []))
    idxG.push([g.p, g.mn ?? (Array.isArray(g.en) ? g.en[0] : g.en) ?? "", lv, g.id]);
}
await writeJson(path.join(DATA, "index/search.json"), { v: idxV, k: idxK, g: idxG });

/* 9. meta ------------------------------------------------------------------ */
const metaPath = path.join(DATA, "index/meta.json");
const meta = await readJson(metaPath, null);
if (meta?.counts) {
  meta.counts.kanji = LEVELS.reduce((a, lv) => a + byLevel[lv].length, 0);
  let strokeCount = 0;
  for (const lv of LEVELS) strokeCount += Object.keys(await readJson(path.join(DATA, "strokes", `${slug(lv)}.json`), {})).length;
  meta.counts.strokes = strokeCount;
  meta.counts.byLevel.kanji = Object.fromEntries(LEVELS.map((lv) => [lv, byLevel[lv].length]));
  meta.counts.kanjiAuto = LEVELS.reduce((a, lv) => a + byLevel[lv].filter((k) => k.mq === "auto").length, 0);
  await writeFile(metaPath, JSON.stringify(meta, null, 2), "utf8");
}
console.log("Дууслаа.");
