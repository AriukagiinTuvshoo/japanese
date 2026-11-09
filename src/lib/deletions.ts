/**
 * УСТГАЛЫН ТҮҮХ (tombstone) — React-гүй цэвэр функцууд.
 * ------------------------------------------------------------------
 * `favorites`, `grammarDone`, `mistakes` нь merge-д union/max байсан тул
 * хуучин tab-ийн snapshot устгасан ID-г буцааж сэргээдэг байв. Энд устгал
 * бүрийг цагтай бүртгэж, дахин нэмэлтийг тусад нь (`marked`) тэмдэглэнэ.
 *
 * Дүрэм: `marked[key] > deleted[key]` үед л бичлэг байна; эс бөгөөс устсан.
 * Тэнцсэн (нэг мс) үед устгал ялна — deterministic боловч маш ховор тохиолдол.
 *
 * Цэвэрлэгээ: цаг хугацаагаар автомат устгал ХИЙХГҮЙ. Tombstone нь хэрэглэгч
 * устгасан/дахин нэмсэн ID тус бүрд нэг жижиг тоо (~20 байт), контентын ID-аар
 * хязгаарлагддаг тул хэмжээ бага; хугацаагаар устгавал удаан хугацааны offline
 * tab-аас сэргэх эрсдэл үүснэ.
 */
import type { Doc, Mistake } from "./doc";

export const FAVORITE_PREFIX = "f:";
export const GRAMMAR_PREFIX = "g:";
export const MISTAKE_PREFIX = "m:";

const withTime = (map: Record<string, number> | undefined, key: string, at: number) => ({
  ...map,
  [key]: Math.max(map?.[key] ?? 0, at),
});

const withoutKey = (map: Record<string, number> | undefined, key: string) => {
  if (!map || !(key in map)) return map;
  const next = { ...map };
  delete next[key];
  return next;
};

/** Favorites-ыг нэмэх/устгах — устгалд tombstone, нэмэлтэд `marked` бичнэ. */
export function setFavorite(doc: Doc, id: string, on: boolean, now = Date.now()): Doc {
  const key = FAVORITE_PREFIX + id;
  if (on) {
    return {
      ...doc,
      favorites: doc.favorites.includes(id) ? doc.favorites : [...doc.favorites, id],
      marked: withTime(doc.marked, key, now),
    };
  }
  return {
    ...doc,
    favorites: doc.favorites.filter((x) => x !== id),
    marked: withoutKey(doc.marked, key),
    deleted: withTime(doc.deleted, key, now),
  };
}

/** Grammar «үзсэн» төлөвийг тохируулах — XP/activity-г store нэмнэ. */
export function setGrammarDone(doc: Doc, id: string, on: boolean, now = Date.now()): Doc {
  const key = GRAMMAR_PREFIX + id;
  if (on) {
    return {
      ...doc,
      grammarDone: doc.grammarDone.includes(id) ? doc.grammarDone : [...doc.grammarDone, id],
      marked: withTime(doc.marked, key, now),
    };
  }
  return {
    ...doc,
    grammarDone: doc.grammarDone.filter((x) => x !== id),
    marked: withoutKey(doc.marked, key),
    deleted: withTime(doc.deleted, key, now),
  };
}

/**
 * Grammar «үзсэн» toggle + XP шийдвэр.
 * `deleted[g:<id>]` нь тухайн дүрмийг өмнө нь үзэж, дараа нь буцаасан
 * гэдгийг илтгэнэ. Тиймээс унтрааж дахин асаахад XP дахин олгохгүй.
 */
export function toggleGrammarDone(
  doc: Doc,
  id: string,
  on?: boolean,
  now = Date.now(),
): { doc: Doc; awarded: boolean } {
  const has = doc.grammarDone.includes(id);
  const want = on ?? !has;
  if (want === has) return { doc, awarded: false };
  const everCompleted = (doc.deleted?.[GRAMMAR_PREFIX + id] ?? 0) > 0;
  return { doc: setGrammarDone(doc, id, want, now), awarded: want && !everCompleted };
}

/** Нэг алдааг бүртгэлээс хасах — tombstone-той. */
export function dropMistake(doc: Doc, id: string, now = Date.now()): Doc {
  return {
    ...doc,
    mistakes: doc.mistakes.filter((m) => m.id !== id),
    deleted: withTime(doc.deleted, MISTAKE_PREFIX + id, now),
  };
}

/** Бүх алдааг цэвэрлэх — одоогийн ID бүрд tombstone. */
export function dropAllMistakes(doc: Doc, now = Date.now()): Doc {
  let deleted = doc.deleted;
  for (const m of doc.mistakes) deleted = withTime(deleted, MISTAKE_PREFIX + m.id, now);
  return { ...doc, mistakes: [], deleted };
}

/**
 * Шинэ алдаа бүртгэх — давтан алдвал `count` +1, харин `resolved` хэвээр.
 * Сүүлийн 400 бичлэгийг л хадгална (өмнөх зан төлөв хэвээр).
 */
export function addMistakes(
  doc: Doc,
  list: Omit<Mistake, "at" | "count" | "resolved">[],
  now = Date.now(),
): Doc {
  const map = new Map(doc.mistakes.map((m) => [m.id, m]));
  for (const m of list) {
    const prev = map.get(m.id);
    map.set(m.id, {
      ...m,
      at: now,
      count: (prev?.count ?? 0) + 1,
      ...(prev?.resolved ? { resolved: prev.resolved } : {}),
    });
  }
  return {
    ...doc,
    mistakes: [...map.values()]
      .filter((m) => mistakeRemaining(m) > 0)
      .sort((a, b) => b.at - a.at)
      .slice(0, 400),
  };
}

/** Үлдсэн давталт: нийт алдсан − хуримтлагдсан «Ойлголоо». */
export function mistakeRemaining(m: Pick<Mistake, "count" | "resolved">): number {
  return Math.max(0, m.count - (m.resolved ?? 0));
}

/**
 * Алдааны хоёр өөр үзүүлэлт: бичлэгийн тоо ба нийт үлдсэн давталт.
 * UI нь хоёуланг нь тусдаа label-тэй харуулна — ижил нэрээр хольж болохгүй.
 */
export function mistakeCounts(
  mistakes: Pick<Mistake, "count" | "resolved">[],
): { records: number; remaining: number } {
  let remaining = 0;
  for (const m of mistakes) remaining += mistakeRemaining(m);
  return { records: mistakes.length, remaining };
}

/**
 * Нэг «Ойлголоо» — `count`-ыг БУУРУУЛАХГҮЙ, `resolved`-ыг нэмнэ. Ингэснээр
 * хуучин snapshot-аас count буцаж өсөхгүй (merge нь хоёуланг нь max авна).
 * Сүүлийн давталтыг хасахад бичлэгийг tombstone-той устгана — дахин алдвал
 * шинэ `at` тул дахин гарна.
 */
export function resolveMistake(doc: Doc, id: string, now = Date.now()): Doc {
  const cur = doc.mistakes.find((m) => m.id === id);
  if (!cur) return doc;
  if (mistakeRemaining(cur) <= 1) return dropMistake(doc, id, now);
  return {
    ...doc,
    mistakes: doc.mistakes.map((m) => (m.id === id ? { ...m, resolved: (m.resolved ?? 0) + 1 } : m)),
  };
}

/**
 * Алдааны бичлэг tombstone-оор устсан эсэх.
 * `at` нь тухайн алдаа хамгийн сүүлд тохиолдсон цаг — дахин алдвал `at` шинэ
 * болж tombstone-оос хойш гарна.
 */
export function mistakeDeleted(m: Pick<Mistake, "id" | "at">, deleted: Record<string, number> | undefined): boolean {
  const at = deleted?.[MISTAKE_PREFIX + m.id] ?? 0;
  return at > 0 && m.at <= at;
}
