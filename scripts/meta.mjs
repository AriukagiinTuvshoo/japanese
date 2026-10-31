/**
 * meta.json-ийн нэгдсэн тооцоо.
 * ------------------------------------------------------------------
 * `build-data.mjs` (бүтэн rebuild) болон `build-meta.mjs` (зөвхөн meta)
 * хоёулаа энэ функцийг ашиглана — тиймээс meta.json хэзээ ч өгөгдлөөс
 * зөрөхгүй. `validate-data.mjs` мөн адил дүрмээр шалгана.
 *
 * Чухал: `mn` блок нь чанарын төлвийг (curated/draft/auto) шударгаар
 * харуулна. "Орчуулга 100%" гэдэг нь "хүн хянасан" гэсэн үг БИШ.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const LEVELS = ["N5", "N4", "N3", "N2", "N1"];

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** content/sources.json — attribution-ийн цорын ганц эх сурвалж. */
export function loadSources() {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, "content/sources.json"), "utf8"));
  } catch {
    return [];
  }
}

const mnOf = (item) => (Array.isArray(item.mn) ? item.mn.filter((m) => typeof m === "string" && m.trim()).length > 0 : Boolean(item.mn));

const countBy = (arr, fn) => arr.reduce((acc, x) => ((acc[fn(x)] = (acc[fn(x)] ?? 0) + 1), acc), {});

export function computeMeta({ vocab, kanji, grammar, strokesFound, content = {}, builtAt = new Date().toISOString(), version = "3.0.0" }) {
  const byLevel = { vocab: {}, kanji: {}, grammar: {}, vocabMn: {} };
  for (const lvl of LEVELS) {
    byLevel.vocab[lvl] = vocab.filter((v) => v.lvl === lvl).length;
    byLevel.kanji[lvl] = kanji.filter((k) => k.lvl === lvl).length;
    byLevel.grammar[lvl] = grammar.filter((g) => g.lvl === lvl).length;
    // "Монгол утгатай" = хоосон бус mn (чанарын төлвөөс үл хамааран).
    byLevel.vocabMn[lvl] = vocab.filter((v) => v.lvl === lvl && mnOf(v)).length;
  }

  const vocabStatus = countBy(vocab, (v) => v.mq ?? "none");
  const kanjiStatus = countBy(kanji, (k) => k.mq ?? "none");
  const vocabExamples = vocab.flatMap((v) => v.ex ?? []);
  const grammarExamples = grammar.flatMap((g) => g.ex ?? []);

  return {
    version,
    builtAt,
    levels: LEVELS,
    counts: {
      vocab: vocab.length,
      kanji: kanji.length,
      grammar: grammar.length,
      strokes: strokesFound ?? 0,
      vocabMnCurated: vocabStatus.curated ?? 0,
      byLevel,
      // Хуучин талбарууд (UI/скриптүүд ашигладаг) — шударга утгатай.
      vocabDraft: vocabStatus.draft ?? 0,
      kanjiDraft: kanjiStatus.draft ?? 0,
      vocabAuto: vocabStatus.auto ?? 0,
      kanjiAuto: kanjiStatus.auto ?? 0,
      grammarAuto: grammar.filter((g) => g.src && String(g.src).includes("mt")).length,
      vocabExampleMn: vocabExamples.filter((e) => typeof e.mn === "string" && e.mn.trim()).length,
      vocabExampleTotal: vocabExamples.length,
      grammarExampleMn: grammarExamples.filter((e) => typeof e.mn === "string" && e.mn.trim()).length,
      grammarExampleTotal: grammarExamples.length,
      grammarCurated: grammar.filter((g) => typeof g.note === "string" && g.note.trim()).length,
      /** Чанарын төлөв — UI-д "100% орчуулсан" гэж төөрөгдүүлэхгүйн тулд. */
      mn: {
        vocab: {
          curated: vocabStatus.curated ?? 0,
          draft: vocabStatus.draft ?? 0,
          auto: vocabStatus.auto ?? 0,
          derived: vocabStatus.derived ?? 0,
          none: vocabStatus.none ?? 0,
        },
        kanji: {
          curated: kanjiStatus.curated ?? 0,
          draft: kanjiStatus.draft ?? 0,
          auto: kanjiStatus.auto ?? 0,
          derived: kanjiStatus.derived ?? 0,
          none: kanjiStatus.none ?? 0,
        },
        grammar: {
          translated: grammar.filter((g) => typeof g.mn === "string" && g.mn.trim()).length,
          missing: grammar.filter((g) => !(typeof g.mn === "string" && g.mn.trim())).length,
        },
      },
    },
    content: {
      listeningLessons: content.listening?.length ?? 0,
      readingPassages: content.reading?.length ?? 0,
      kanjiMnemonics: content.kanjiMnemonics ?? 0,
      grammarExplained: content.grammarExplained ?? 0,
      glossaryTerms: content.glossaryTerms ?? 0,
    },
    sources: loadSources(),
    openjlpt: content.openjlpt ?? {},
  };
}

/** public/data/**-аас бүх өгөгдлийг уншина (build-meta-д). */
export function readBuiltData(dir) {
  const read = (p) => JSON.parse(fs.readFileSync(path.join(dir, p), "utf8"));
  const vocab = LEVELS.flatMap((l) => read(`vocab/${l.toLowerCase()}.json`));
  const kanji = LEVELS.flatMap((l) => read(`kanji/${l.toLowerCase()}.json`));
  const grammar = LEVELS.flatMap((l) => read(`grammar/${l.toLowerCase()}.json`));
  const strokes = LEVELS.reduce((n, l) => n + Object.keys(read(`strokes/${l.toLowerCase()}.json`)).length, 0);
  return { vocab, kanji, grammar, strokesFound: strokes };
}
