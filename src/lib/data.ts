/**
 * Өгөгдөл ачаалагч.
 * ------------------------------------------------------------------
 * Бүх контент `public/data/**` дотор статик JSON хэлбэрээр байрлана.
 * Түвшин тус бүрээр тусад нь ачаалдаг тул эхний дэлгэц хурдан ачаална.
 * Ижил хүсэлтийг давхар илгээхгүйн тулд promise-уудыг кэшлэнэ.
 */
import type {
  DataMeta, Grammar, Kanji, Level, ListeningLesson, ReadingPassage, SearchIndex, StrokeMap, Vocab, CurriculumPlan,
} from "./types";
import { LEVELS } from "./types";

const cache = new Map<string, Promise<unknown>>();

function get<T>(url: string): Promise<T> {
  let p = cache.get(url) as Promise<T> | undefined;
  if (!p) {
    p = fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`${url} → HTTP ${r.status}`);
        return r.json() as Promise<T>;
      })
      .catch((e) => {
        cache.delete(url);
        throw e;
      });
    cache.set(url, p);
  }
  return p;
}

const slug = (l: Level) => l.toLowerCase();

export const loadMeta = () => get<DataMeta>("/data/index/meta.json");

export const loadVocab = (lvl: Level) => get<Vocab[]>(`/data/vocab/${slug(lvl)}.json`);
export const loadKanji = (lvl: Level) => get<Kanji[]>(`/data/kanji/${slug(lvl)}.json`);
export const loadGrammar = (lvl: Level) => get<Grammar[]>(`/data/grammar/${slug(lvl)}.json`);
export const loadStrokes = (lvl: Level) => get<StrokeMap>(`/data/strokes/${slug(lvl)}.json`);
export const loadSearchIndex = () => get<SearchIndex>("/data/index/search.json");

/** Бүх түвшний үгийг нэгтгэнэ (SRS, хайлт, курс). */
export async function loadAllVocab(): Promise<Vocab[]> {
  const all = await Promise.all(LEVELS.map(loadVocab));
  return all.flat();
}

export async function loadAllKanji(): Promise<Kanji[]> {
  const all = await Promise.all(LEVELS.map(loadKanji));
  return all.flat();
}

export async function loadAllGrammar(): Promise<Grammar[]> {
  const all = await Promise.all(LEVELS.map(loadGrammar));
  return all.flat();
}

/** Апп-ийн бүх контентыг нэг удаа ачаална (SRS, curriculum-д хэрэгтэй). */
export interface FullData {
  meta: DataMeta;
  vocab: Vocab[];
  kanji: Kanji[];
  grammar: Grammar[];
  vocabByLevel: Record<Level, Vocab[]>;
  kanjiByLevel: Record<Level, Kanji[]>;
  grammarByLevel: Record<Level, Grammar[]>;
  byId: Map<string, Vocab>;
  kanjiByChar: Map<string, Kanji>;
  wordsByKanji: Map<string, Vocab[]>;
}

let fullPromise: Promise<FullData> | null = null;

export function loadFullData(): Promise<FullData> {
  if (fullPromise) return fullPromise;
  fullPromise = (async () => {
    const [meta, vocabByLevelArr, kanjiByLevelArr, grammarByLevelArr] = await Promise.all([
      loadMeta(),
      Promise.all(LEVELS.map(loadVocab)),
      Promise.all(LEVELS.map(loadKanji)),
      Promise.all(LEVELS.map(loadGrammar)),
    ]);
    const vocabByLevel = Object.fromEntries(LEVELS.map((l, i) => [l, vocabByLevelArr[i]])) as Record<Level, Vocab[]>;
    const kanjiByLevel = Object.fromEntries(LEVELS.map((l, i) => [l, kanjiByLevelArr[i]])) as Record<Level, Kanji[]>;
    const grammarByLevel = Object.fromEntries(LEVELS.map((l, i) => [l, grammarByLevelArr[i]])) as Record<Level, Grammar[]>;

    const vocab = vocabByLevelArr.flat();
    const kanji = kanjiByLevelArr.flat();
    const grammar = grammarByLevelArr.flat();
    const byId = new Map(vocab.map((v) => [v.id, v]));
    const kanjiByChar = new Map(kanji.map((k) => [k.k, k]));

    const wordsByKanji = new Map<string, Vocab[]>();
    for (const v of vocab) {
      for (const ch of v.kd) {
        const list = wordsByKanji.get(ch);
        if (list) list.push(v);
        else wordsByKanji.set(ch, [v]);
      }
    }

    return {
      meta, vocab, kanji, grammar,
      vocabByLevel, kanjiByLevel, grammarByLevel,
      byId, kanjiByChar, wordsByKanji,
    };
  })().catch((e) => {
    fullPromise = null;
    throw e;
  });
  return fullPromise;
}

/* ─────────────── Контентын бусад сангууд (статик) ─────────────── */

import listeningRaw from "../../content/listening.json";
import readingRaw from "../../content/reading.json";
import curriculumRaw from "../../content/curriculum.json";

export const LISTENING = listeningRaw as unknown as ListeningLesson[];
export const READING = readingRaw as unknown as ReadingPassage[];
export const CURRICULUM = curriculumRaw as unknown as Record<string, CurriculumPlan>;

export const lessonById = (id: string) => LISTENING.find((l) => l.id === id);
export const passageById = (id: string) => READING.find((r) => r.id === id);

/* ─────────────── Туслах ─────────────── */

export function shuffle<T>(arr: T[], rand: () => number = Math.random): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Deterministic санамсаргүй (тест/шалгалтыг тогтвортой болгох). */
export function seeded(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

export function pick<T>(arr: T[], n: number, rand: () => number = Math.random): T[] {
  return shuffle(arr, rand).slice(0, n);
}
