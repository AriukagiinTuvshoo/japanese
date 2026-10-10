#!/usr/bin/env node
/**
 * Эх өгөгдлийг боловсруулж, апп-д хэрэглэгдэх хэлбэрт оруулна.
 *
 *   .cache/sources/**  +  content/**   →   public/data/**
 *
 * ГҮЙЦЭТГЭЛ:
 *   1. OpenJLPT-ийн JLPT N5–N1 үг / ханз / дүрмийг уншина
 *   2. JMdict-ийн нэр дэвшигчдээс «өргөтгөсөн үгийн сан»-ыг сонгоно
 *   3. kanji-data-гаас ханзны бүрэн шинж чанарыг нэгтгэнэ
 *   4. KanjiVG-ээс бичих дарааллын вектор замыг гаргана
 *   5. content/mn/** доторх гараар хянасан монгол контентыг нэгтгэнэ
 *   6. Бүх бичлэгт эх сурвалж (provenance) тэмдэглэгээ хавсаргана
 *
 * Ажиллуулах:  npm run data:build
 */
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, ".cache", "sources");
const CONTENT = path.join(ROOT, "content");
const OUT = path.join(ROOT, "public", "data");

const LEVELS = ["N5", "N4", "N3", "N2", "N1"];
const slug = (l) => l.toLowerCase();

/* ------------------------------------------------------------------ */
/* туслах                                                              */
/* ------------------------------------------------------------------ */
const json = async (p, fallback = null) =>
  readFile(p, "utf8").then(JSON.parse).catch(() => fallback);

const exists = (p) => readFile(p).then(() => true).catch(() => false);

async function write(location, value, { pretty = false } = {}) {
  const file = path.join(OUT, location);
  await mkdir(path.dirname(file), { recursive: true });
  const body = pretty ? JSON.stringify(value, null, 2) : JSON.stringify(value);
  await writeFile(file, body);
  return Buffer.byteLength(body);
}

const kb = (n) => `${(n / 1024).toFixed(0)} KB`;

const KANJI_RE = /[\u3400-\u4dbf\u4e00-\u9fff]/;
const CJK_RE = /[\u3400-\u4dbf\u4e00-\u9fff]/g;

/** POS кодуудыг суралцагчид ойлгомжтой төрөл болгоно. */
function posType(pos = []) {
  const s = new Set(pos);
  if ([...s].some((p) => /^v|^vs|^vk/.test(p)) || s.has("vt") || s.has("vi")) return "v";
  if ([...s].some((p) => /^adj-i/.test(p))) return "i";
  if ([...s].some((p) => /^adj-na/.test(p))) return "na";
  if ([...s].some((p) => /^adj/.test(p))) return "adj";
  if (s.has("adv") || s.has("adv-to")) return "adv";
  if (s.has("exp") || s.has("conj") || s.has("int")) return "exp";
  if (s.has("pn") || s.has("num")) return "pn";
  if (s.has("ctr")) return "ctr";
  if (s.has("n") || s.has("n-suf") || s.has("n-pref")) return "n";
  return "other";
}

const TYPE_MN = {
  v: "Үйл үг",
  i: "и-тэмдэг нэр",
  na: "на-тэмдэг нэр",
  adj: "Тэмдэг нэр",
  adv: "Дайвар үг",
  exp: "Хэллэг",
  pn: "Төлөөний үг",
  ctr: "Тоолуур",
  n: "Нэр үг",
  other: "Бусад",
};

/** Шинэ үгэнд монгол орчуулга автоматаар санал болгох. */
function makeAutoGloss(terms) {
  const norm = (w) => w.toLowerCase().replace(/^to /, "").replace(/^a /, "").replace(/^an /, "").replace(/\(.*?\)/g, "").trim();
  return (en = []) => {
    if (!en.length) return null;
    const out = [];
    for (const gloss of en.slice(0, 2)) {
      const g = norm(gloss);
      if (!g) continue;
      const parts = g.split(/\s*[,;]\s*|\s+or\s+/).flatMap((x) => x.split(/\s*\/\s*/));
      const mapped = parts.map((part) => {
        if (terms[part]) return terms[part];
        const words = part.split(/\s+/);
        const each = words.map((w) => terms[w] ?? terms[w.replace(/(s|es|ed|ing)$/, "")]);
        return each.every(Boolean) ? each.join(" ") : null;
      });
      if (mapped.every(Boolean) && mapped.length) out.push(mapped.join(", "));
    }
    return out.length ? [...new Set(out)].slice(0, 2) : null;
  };
}

/* ------------------------------------------------------------------ */
/* 1. эх өгөгдөл                                                       */
/* ------------------------------------------------------------------ */
async function loadSources() {
  const openjlpt = {
    vocab: {},
    kanji: {},
    grammar: {},
  };
  for (const lv of LEVELS) {
    const s = slug(lv);
    openjlpt.vocab[lv] = (await json(path.join(SRC, "openjlpt/data/json/vocab", `${s}.json`), [])) ?? [];
    openjlpt.kanji[lv] = (await json(path.join(SRC, "openjlpt/data/json/kanji", `${s}.json`), [])) ?? [];
    openjlpt.grammar[lv] = (await json(path.join(SRC, "openjlpt/data/json/grammar", `${s}.json`), [])) ?? [];
  }
  const kanjiData = (await json(path.join(SRC, "kanji-data/kanji.json"), {})) ?? {};
  const jmCandidates = (await json(path.join(SRC, "jamdict-data/candidates.json"), [])) ?? [];
  const openjlptMeta = (await json(path.join(SRC, "openjlpt/data/json/meta.json"), {})) ?? {};
  const lock = (await json(path.join(SRC, "sources.lock.json"), {})) ?? {};
  return { openjlpt, kanjiData, jmCandidates, openjlptMeta, lock };
}

async function loadContent() {
  return {
    vocab: (await json(path.join(CONTENT, "mn/vocab.json"), {})) ?? {},
    kanji: (await json(path.join(CONTENT, "mn/kanji.json"), {})) ?? {},
    grammar: (await json(path.join(CONTENT, "mn/grammar.json"), {})) ?? {},
    terms: (await json(path.join(CONTENT, "mn/terms.json"), {})) ?? {},
    // AI/машин драфт — хянагдаагүй. Хүний баталгаажуулсны дараа mn/vocab.json руу шилжинэ.
    vocabDraft: (await json(path.join(CONTENT, "mn/vocab-draft.json"), {})) ?? {},
    kanjiDraft: (await json(path.join(CONTENT, "mn/kanji-draft.json"), {})) ?? {},
    listening: (await json(path.join(CONTENT, "listening.json"), [])) ?? [],
    reading: (await json(path.join(CONTENT, "reading.json"), [])) ?? [],
    curriculum: (await json(path.join(CONTENT, "curriculum.json"), {})) ?? {},
  };
}

/* ------------------------------------------------------------------ */
/* 2. үгийн сан                                                        */
/* ------------------------------------------------------------------ */
function buildVocab({ openjlpt, jmCandidates, kanjiData }, content, audit) {
  const auto = makeAutoGloss(content.terms);
  const byLevel = Object.fromEntries(LEVELS.map((l) => [l, []]));
  const seen = new Set();

  // --- A давхарга: OpenJLPT-ийн албан ёсны JLPT жагсаалт -----------------
  for (const lv of LEVELS) {
    for (const v of openjlpt.vocab[lv]) {
      const key = `${v.word}|${v.reading}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const curated = content.vocab[key] ?? content.vocab[v.word];
      const draft = content.vocabDraft[key] ?? content.vocabDraft[v.word];
      const mn = curated ? [curated] : draft ? [draft] : auto(v.meanings);
      const kd = [...new Set((v.word.match(CJK_RE) ?? []))];

      byLevel[lv].push({
        id: v.id,
        w: v.word,
        r: v.reading,
        rm: v.romaji,
        en: v.meanings.slice(0, 3),
        mn,
        mq: curated ? "curated" : draft ? "draft" : mn ? "auto" : "none",
        lvl: lv,
        tier: "jlpt",
        pos: (v.pos ?? []).slice(0, 3),
        t: posType(v.pos ?? []),
        kd,
        src: "openjlpt",
        sid: v.id,
        ex: (v.examples ?? []).slice(0, 2).map((e) => ({
          ja: e.ja,
          fg: e.furigana,
          en: e.en,
          ts: e.tatoeba_id,
        })),
      });
      if (!curated) audit.mnMissingVocab.push(v.word);
    }
  }

  // --- B давхарга: өргөтгөсөн сан (JMdict) ------------------------------
  const CAP = { N5: 400, N4: 450, N3: 620, N2: 560, N1: 620 };
  const taken = Object.fromEntries(LEVELS.map((l) => [l, 0]));
  let ext = 0;
  for (const c of jmCandidates) {
    if (ext >= 2650) break;
    const lv = c.lvl;
    if (!byLevel[lv] || taken[lv] >= CAP[lv]) continue;
    const key = `${c.w}|${c.r}`;
    if (seen.has(key) || seen.has(c.w)) continue;
    seen.add(key);
    seen.add(c.w);
    taken[lv] += 1;
    ext += 1;

    const curated = content.vocab[key] ?? content.vocab[c.w];
    const draft = content.vocabDraft[key] ?? content.vocabDraft[c.w];
    const mn = curated ? [curated] : draft ? [draft] : auto(c.en);
    byLevel[lv].push({
      id: `j${c.idseq}`,
      w: c.w,
      r: c.r,
      rm: "",
      en: c.en,
      mn,
      mq: curated ? "curated" : draft ? "draft" : mn ? "auto" : "none",
      lvl: lv,
      tier: c.isEx ? "ext-example" : "ext-frequency",
      pos: c.pos ?? [],
      t: posType(c.pos ?? []),
      kd: [...new Set(c.w.match(CJK_RE) ?? [])],
      src: "jmdict",
      sid: String(c.idseq),
      ex: [],
    });
  }

  // монгол орчуулга байхгүй бол ханзнуудын монгол утгаас зөвлөмж гаргана
  let derived = 0;
  for (const lv of LEVELS) {
    for (const v of byLevel[lv]) {
      if (v.mq !== "none") continue;
      const known = v.kd.map((k) => content.kanji[k]?.m?.[0]).filter(Boolean);
      if (known.length && known.length === v.kd.length) {
        v.mn = [known.join(" · ")];
        v.mq = "derived";
        derived += 1;
      }
    }
  }
  audit.derivedVocab = derived;

  return byLevel;
}

/* ------------------------------------------------------------------ */
/* 3. ханз                                                             */
/* ------------------------------------------------------------------ */
function buildKanji({ openjlpt, kanjiData }, content, audit, vocabByLevel) {
  const auto = makeAutoGloss(content.terms);
  const jlptOf = new Map();
  for (const lv of LEVELS) {
    for (const k of openjlpt.kanji[lv]) {
      const ch = k.kanji ?? k.character ?? k.literal;
      if (ch) jlptOf.set(ch, { lv, entry: k });
    }
  }

  // ханз → үгс (үгийн сангаас урвуу индекс)
  const wordsOf = new Map();
  for (const lv of LEVELS) {
    for (const v of vocabByLevel[lv]) {
      for (const ch of v.kd) {
        if (!wordsOf.has(ch)) wordsOf.set(ch, []);
        const list = wordsOf.get(ch);
        if (list.length < 14) list.push({ w: v.w, r: v.r, mn: v.mn?.[0] ?? v.en[0], lvl: v.lvl });
      }
    }
  }

  // Сонголт: Jōyō (2136) ∪ JLPT ∪ нийтлэг хэрэглээний ханз → 2,500+
  const selected = new Map();
  for (const [ch, info] of Object.entries(kanjiData)) {
    const jl = jlptOf.get(ch);
    const grade = info.grade ?? null;
    const isJouyou = grade !== null && grade <= 8;
    const isCommon = (info.freq ?? 99999) <= 2600;
    const isWk = !!info.wk_level;
    if (!jl && !isJouyou && !isCommon && !isWk) continue;

    let lv = jl?.lv ?? null;
    if (!lv) {
      if (grade !== null && grade <= 2) lv = "N5";
      else if (grade !== null && grade <= 4) lv = "N4";
      else if (grade !== null && grade <= 6) lv = "N3";
      else if (grade !== null && grade <= 8) lv = "N2";
      else if ((info.freq ?? 99999) <= 3000) lv = "N1";
      else lv = "N1";
    }
    selected.set(ch, { ...info, lvl: lv, lvlSrc: jl ? "jlpt" : "derived" });
  }

  const byLevel = Object.fromEntries(LEVELS.map((l) => [l, []]));
  for (const [ch, info] of selected) {
    const curated = content.kanji[ch] ?? {};
    const jl = jlptOf.get(ch);
    const readings_on = info.readings_on ?? jl?.entry?.on_yomi ?? [];
    const readings_kun = info.readings_kun ?? jl?.entry?.kun_yomi ?? [];
    const enMeanings = (info.meanings ?? jl?.entry?.meanings ?? []).slice(0, 3);
    const draftM = content.kanjiDraft[ch];
    const mn = curated.m ? [curated.m] : draftM ? [draftM] : (auto(enMeanings) ?? []);

    byLevel[info.lvl].push({
      k: ch,
      lvl: info.lvl,
      lvlSrc: info.lvlSrc,
      s: info.strokes ?? jl?.entry?.strokes ?? null,
      g: info.grade ?? null,
      f: info.freq ?? null,
      en: enMeanings,
      mn,
      mq: curated.m ? "curated" : draftM ? "draft" : mn.length ? "auto" : "none",
      on: curated.on ?? readings_on.slice(0, 3),
      kun: curated.kun ?? readings_kun.slice(0, 4),
      rad: curated.rad ?? jl?.entry?.radical ?? info.wk_radicals?.[0] ?? null,
      w: wordsOf.get(ch) ?? [],
      mn_mem: curated.n ?? null,
      src: jl ? "openjlpt+kanji-data" : "kanji-data",
      sid: ch,
    });
    if (!curated.m) audit.mnMissingKanji.push(ch);
  }
  for (const lv of LEVELS) byLevel[lv].sort((a, b) => (a.f ?? 9e9) - (b.f ?? 9e9) || (a.s ?? 0) - (b.s ?? 0));

  return byLevel;
}

/* ------------------------------------------------------------------ */
/* 4. дүрэм                                                           */
/* ------------------------------------------------------------------ */
function buildGrammar({ openjlpt }, content, audit) {
  const byLevel = Object.fromEntries(LEVELS.map((l) => [l, []]));
  for (const lv of LEVELS) {
    for (const g of openjlpt.grammar[lv]) {
      const pat = g.pattern ?? g.grammar ?? g.title ?? g.id;
      const curated = content.grammar[pat] ?? {};
      byLevel[lv].push({
        id: g.id,
        p: pat,
        lvl: lv,
        en: g.meaning ?? g.meanings ?? [],
        mn: curated.m ?? null,
        note: curated.n ?? null,
        form: g.formation ?? g.structure ?? null,
        jlpt: g.jlpt ?? lv,
        ex: (g.examples ?? []).slice(0, 3).map((e) => ({
          ja: e.ja ?? e.japanese,
          fg: e.furigana,
          en: e.en ?? e.english,
          mn: curated.ex?.[e.ja] ?? null,
        })),
        related: g.related ?? g.see_also ?? [],
        src: "openjlpt",
      });
      if (!curated.m) audit.mnMissingGrammar.push(pat);
    }
  }
  return byLevel;
}

/* ------------------------------------------------------------------ */
/* 5. бичих дараалал (KanjiVG)                                         */
/* ------------------------------------------------------------------ */
async function buildStrokes(allKanji) {
  const dir = path.join(SRC, "kanjivg/kanji");
  const files = new Set(await readdir(dir).catch(() => []));
  const byLevel = Object.fromEntries(LEVELS.map((l) => [l, {}]));
  let found = 0;
  for (const [lv, list] of Object.entries(allKanji)) {
    for (const k of list) {
      const cp = k.k.codePointAt(0).toString(16).padStart(5, "0");
      if (!files.has(`${cp}.svg`)) continue;
      const svg = await readFile(path.join(dir, `${cp}.svg`), "utf8");
      const paths = [...svg.matchAll(/<path[^>]*?\sd="([^"]+)"/g)].map((m) => m[1]);
      if (!paths.length) continue;
      byLevel[lv][k.k] = paths;
      found += 1;
    }
  }
  return { byLevel, found };
}

/* ------------------------------------------------------------------ */
/* main                                                                */
/* ------------------------------------------------------------------ */
async function main() {
  const t0 = Date.now();
  console.log("→ Эх өгөгдөл уншиж байна…");
  // Эх сурвалж байхгүй үед гаралтыг ХЭЗЭЭ Ч дарж бичихгүй (өмнөх public/data-г устгахгүй).
  try {
    await stat(path.join(SRC, "openjlpt/data/json/vocab/n5.json"));
  } catch {
    throw new Error(`Эх сурвалж олдсонгүй: ${SRC}. scripts/fetch-sources.mjs-ээр татна уу. public/data өөрчлөгдсөнгүй.`);
  }
  const sources = await loadSources();
  if (!sources.openjlpt.vocab.N5?.length) {
    throw new Error("OpenJLPT үгийн жагсаалт хоосон байна — гаралтыг бичихгүй.");
  }
  const content = await loadContent();
  const audit = { mnMissingVocab: [], mnMissingKanji: [], mnMissingGrammar: [] };

  console.log("→ Үгийн сан…");
  const vocab = buildVocab(sources, content, audit);
  console.log("→ Ханз…");
  const kanji = buildKanji(sources, content, audit, vocab);
  console.log("→ Дүрэм…");
  const grammar = buildGrammar(sources, content, audit);
  console.log("→ Бичих дараалал (KanjiVG)…");
  const strokes = await buildStrokes(kanji);

  await rm(OUT, { recursive: true, force: true });

  // ---------- бичих ----------
  let bytes = 0;
  const counts = { vocab: {}, kanji: {}, grammar: {}, vocabMn: {} };

  for (const lv of LEVELS) {
    const s = slug(lv);
    counts.vocab[lv] = vocab[lv].length;
    counts.kanji[lv] = kanji[lv].length;
    counts.grammar[lv] = grammar[lv].length;
    counts.vocabMn[lv] = vocab[lv].filter((v) => v.mq === "curated").length;
    counts.vocabDraft = (counts.vocabDraft ?? 0) + vocab[lv].filter((v) => v.mq === "draft").length;
    bytes += await write(`vocab/${s}.json`, vocab[lv]);
    bytes += await write(`kanji/${s}.json`, kanji[lv]);
    bytes += await write(`grammar/${s}.json`, grammar[lv]);
    bytes += await write(`strokes/${s}.json`, strokes.byLevel[lv]);
  }

  // ---------- хайлтын индекс (хөнгөн) ----------
  const idx = {
    v: [],
    k: [],
    g: [],
  };
  for (const lv of LEVELS) {
    for (const v of vocab[lv]) {
      idx.v.push([v.w, v.r, v.mn?.[0] ?? v.en[0] ?? "", lv, v.tier === "jlpt" ? 0 : 1, v.id]);
    }
    for (const k of kanji[lv]) {
      idx.k.push([k.k, k.on?.[0] ?? "", k.mn?.[0] ?? k.en[0] ?? "", lv, k.s ?? 0]);
    }
    for (const g of grammar[lv]) {
      idx.g.push([g.p, g.mn ?? (Array.isArray(g.en) ? g.en[0] : g.en) ?? "", lv, g.id]);
    }
  }
  bytes += await write("index/search.json", idx);

  // ---------- нэгдсэн мета ----------
  const meta = {
    version: "3.0.0",
    builtAt: new Date().toISOString(),
    levels: LEVELS,
    counts: {
      vocab: LEVELS.reduce((a, l) => a + counts.vocab[l], 0),
      kanji: LEVELS.reduce((a, l) => a + counts.kanji[l], 0),
      grammar: LEVELS.reduce((a, l) => a + counts.grammar[l], 0),
      strokes: strokes.found,
      vocabMnCurated: LEVELS.reduce((a, l) => a + counts.vocabMn[l], 0),
      byLevel: counts,
    },
    content: {
      listeningLessons: content.listening.length,
      readingPassages: content.reading.length,
      kanjiMnemonics: Object.values(content.kanji).filter((k) => k.n).length,
      grammarExplained: Object.keys(content.grammar).length,
      glossaryTerms: Object.keys(content.terms).length,
    },
    sources: Object.values(sources.lock).map((s) => ({
      id: s.id,
      name: s.name,
      url: s.homepage,
      license: s.license,
      note: s.note,
      retrievedAt: s.retrievedAt,
    })),
    openjlpt: sources.openjlptMeta,
  };
  bytes += await write("index/meta.json", meta, { pretty: true });

  await writeFile(
    path.join(ROOT, ".cache", "build-report.json"),
    JSON.stringify({ meta, audit: { ...audit, mnMissingVocab: audit.mnMissingVocab.length, mnMissingKanji: audit.mnMissingKanji.length, mnMissingGrammar: audit.mnMissingGrammar.length }, mnMissing: audit, ms: Date.now() - t0 }, null, 2),
  );

  console.log("\n─── БОЛОВСРУУЛАЛТ ДУУСЛАА ───────────────────────");
  console.log(`  Үгийн сан   ${meta.counts.vocab.toLocaleString()}  (монгол хянасан: ${meta.counts.vocabMnCurated.toLocaleString()})`);
  console.log(`  Ханз        ${meta.counts.kanji.toLocaleString()}  (бичих дараалалтай: ${meta.counts.strokes.toLocaleString()})`);
  console.log(`  Дүрэм       ${meta.counts.grammar.toLocaleString()}`);
  for (const lv of LEVELS) {
    console.log(`   ${lv}: үг ${counts.vocab[lv]} · ханз ${counts.kanji[lv]} · дүрэм ${counts.grammar[lv]} · mn ${counts.vocabMn[lv]}`);
  }
  console.log(`  Нийт хэмжээ ${(bytes / 1e6).toFixed(1)} MB · ${((Date.now() - t0) / 1000).toFixed(1)}сек`);
  console.log("─────────────────────────────────────────────────");
}

main().then(async () => {
  await import("./apply-translation-batches.mjs");
}).catch((e) => {
  console.error("✗ Боловсруулахад алдаа:", e);
  process.exit(1);
});
