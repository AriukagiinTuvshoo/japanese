/**
 * ХАНЗНЫ СЕССИЙН СОНГОЛТ.
 * ------------------------------------------------------------------
 * SRS-ийн бүрэн бүтэн байдлыг хамгаална:
 *  · Эхлээд хугацаа болсон (due) картуудыг сонгоно.
 *  · Хугацаа болоогүй мэдэгдэж байгаа картыг ХЭЗЭЭ Ч сонгохгүй —
 *    эс бөгөөс «Хэвийн» үнэлгээ интервалыг хиймлээр уртасгана.
 *  · Зөвхөн шинэ карт (SRS-д байхгүй эсвэл ph === "new") нөхөж орно.
 */
import type { Card } from "./srs";
import type { Kanji } from "./types";

export interface KanjiSessionOptions {
  /** Цаг — тестэд тогтмол болгоход. */
  now?: number;
  /** Холигч — тестэд deterministic болгоход. */
  shuffle?: <T>(list: T[]) => T[];
}

function randomShuffle<T>(list: T[]): T[] {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function selectKanjiSession(
  items: Kanji[],
  srs: Record<string, Card>,
  count: number,
  onlyDue = false,
  opts: KanjiSessionOptions = {},
): Kanji[] {
  if (count <= 0 || items.length === 0) return [];
  const now = opts.now ?? Date.now();
  const shuffle = opts.shuffle ?? randomShuffle;

  const due: Kanji[] = [];
  const fresh: Kanji[] = [];
  for (const k of items) {
    const c = srs[k.k];
    if (!c || c.ph === "new") { fresh.push(k); continue; }
    if (c.due <= now) due.push(k);
  }

  const duePicked = shuffle(due).slice(0, count);
  if (onlyDue) return duePicked;

  const freshPicked = shuffle(fresh).slice(0, Math.max(0, count - duePicked.length));
  return [...duePicked, ...freshPicked].slice(0, count);
}
