import { shuffle } from "./data";
import type { Language } from "./i18n";
import { grammarEn } from "./i18n";
import type { Grammar, Kanji, Level, Vocab } from "./types";
import { LEVELS } from "./types";

export interface PlacementQuestion {
  id: string;
  level: Level;
  prompt: string;
  kind: "vocab" | "kanji" | "grammar";
  options: string[];
  answer: number;
  explain: string;
}

export interface PlacementData {
  vocabByLevel: Record<Level, Vocab[]>;
  kanjiByLevel: Record<Level, Kanji[]>;
  grammarByLevel: Record<Level, Grammar[]>;
}

type Rand = () => number;

/** Эхний хоосон биш утгыг авна; өөр хэл рүү чимээгүй fallback хийхгүй. */
function text(values: string[] | null | undefined): string | null {
  for (const value of values ?? []) {
    const clean = value.trim();
    if (clean) return clean;
  }
  return null;
}

function joined(values: string[] | null | undefined, separator: string): string {
  return (values ?? []).map((value) => value.trim()).filter(Boolean).join(separator);
}

function vocabLabel(item: Vocab, language: Language): string | null {
  return language === "en" ? text(item.en) : text(item.mn);
}

function kanjiLabel(item: Kanji, language: Language): string | null {
  return language === "en" ? text(item.en) : text(item.mn);
}

function grammarLabel(item: Grammar, language: Language): string | null {
  if (language === "en") {
    const value = grammarEn(item);
    return value?.trim() || null;
  }
  return text([item.mn ?? ""]);
}

function normalize(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

/** Зөв хариулттай ижил утгатай сонголтыг давхардуулахгүйгээр сонгоно. */
function pickDistractors<T>(
  pool: T[],
  correct: T,
  label: (item: T) => string | null,
  count: number,
  rand: Rand,
): { items: T[]; labels: string[] } {
  const answer = label(correct);
  if (!answer) return { items: [], labels: [] };

  const seen = new Set([normalize(answer)]);
  const items: T[] = [];
  const labels: string[] = [];

  for (const item of shuffle(pool, rand)) {
    if (item === correct) continue;
    const value = label(item);
    if (!value) continue;
    const key = normalize(value);
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(item);
    labels.push(value);
    if (items.length >= count) break;
  }
  return { items, labels };
}

/**
 * Түвшин тогтоох тестийн асуултуудыг бүтээнэ.
 * MN горимд монгол утгагүй item-ийг бүхэлд нь хасна — англи утгыг
 * монгол сонголт мэт харуулахгүй. Сонголтуудын текст давхцахгүй.
 */
export function buildPlacementQuestions(
  data: PlacementData,
  language: Language,
  rand: Rand = Math.random,
): PlacementQuestion[] {
  const out: PlacementQuestion[] = [];

  for (const level of LEVELS) {
    const vocabPool = data.vocabByLevel[level].filter((item) => vocabLabel(item, language));
    for (const word of shuffle(vocabPool, rand).slice(0, 8)) {
      const answer = vocabLabel(word, language);
      const distractors = pickDistractors(vocabPool, word, (item) => vocabLabel(item, language), 3, rand);
      if (!answer || distractors.items.length < 3) continue;
      const options = shuffle([word, ...distractors.items], rand);
      out.push({
        id: word.id,
        level,
        kind: "vocab",
        prompt: word.w,
        options: options.map((item) => vocabLabel(item, language)!),
        answer: options.indexOf(word),
        explain: `${word.w}（${word.r}） = ${language === "en" ? joined(word.en, "; ") : joined(word.mn, ", ")}`,
      });
    }

    const kanjiPool = data.kanjiByLevel[level].filter((item) => kanjiLabel(item, language));
    for (const kanji of shuffle(kanjiPool, rand).slice(0, 5)) {
      const answer = kanjiLabel(kanji, language);
      const distractors = pickDistractors(kanjiPool, kanji, (item) => kanjiLabel(item, language), 3, rand);
      if (!answer || distractors.items.length < 3) continue;
      const options = shuffle([kanji, ...distractors.items], rand);
      out.push({
        id: kanji.k,
        level,
        kind: "kanji",
        prompt: kanji.k,
        options: options.map((item) => kanjiLabel(item, language)!),
        answer: options.indexOf(kanji),
        explain: `${kanji.k} = ${language === "en" ? joined(kanji.en, ", ") : joined(kanji.mn, ", ")}`,
      });
    }

    const grammarPool = data.grammarByLevel[level].filter((item) => grammarLabel(item, language));
    for (const grammar of shuffle(grammarPool, rand).slice(0, 4)) {
      const answer = grammarLabel(grammar, language);
      const distractors = pickDistractors(grammarPool, grammar, (item) => grammarLabel(item, language), 3, rand);
      if (!answer || distractors.items.length < 3) continue;
      const options = shuffle([grammar, ...distractors.items], rand);
      out.push({
        id: grammar.id,
        level,
        kind: "grammar",
        prompt: grammar.p,
        options: options.map((item) => grammarLabel(item, language)!),
        answer: options.indexOf(grammar),
        explain: `${grammar.p} — ${answer}`,
      });
    }
  }

  return shuffle(out, rand).slice(0, 45);
}
