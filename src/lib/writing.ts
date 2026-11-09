/**
 * ХАНЗ БИЧИХ ДАСГАЛЫН БҮРТГЭЛ (React-гүй).
 * ------------------------------------------------------------------
 * `recordWriting` нь StrokePad-ын «Шалгах» товч бүрт дуудагдана. Тиймээс
 * XP-г зөвхөн тухайн ханз АНХ бүртгэгдэхэд нэг удаа олгоно — дараагийн
 * оролдлого нь зөвхөн `best`/`tries`/`at`-ыг шинэчилж, daily kanji явцад
 * тоологдоно. Ингэснээр SRS-ийн нэг удаагийн XP загвартай нийцнэ.
 */
import { emptyDay, type Doc } from "./doc";
import { XP } from "./gamification";
import { todayKey } from "./text";

export function recordWritingResult(doc: Doc, kanji: string, score: number, now = Date.now()): Doc {
  const prev = doc.writing[kanji];
  const best = Math.max(prev?.best ?? 0, score);
  const writing = {
    ...doc.writing,
    [kanji]: { best, tries: (prev?.tries ?? 0) + 1, at: now },
  };

  /* Аль хэдийн бүртгэгдсэн ханз — XP давхар олгохгүй. */
  if (prev) return { ...doc, writing };

  const day = todayKey(new Date(now));
  const cur = doc.activity[day] ?? emptyDay();
  return {
    ...doc,
    writing,
    xp: doc.xp + XP.writing,
    activity: { ...doc.activity, [day]: { ...cur, xp: cur.xp + XP.writing } },
  };
}
