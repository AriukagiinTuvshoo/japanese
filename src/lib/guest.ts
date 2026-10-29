/**
 * B2 — зочин (guest) хэлбэрийн ахицыг аккаунт руу шилжүүлэх.
 * ------------------------------------------------------------------
 * Энд зөвхөн цэвэр логик: I/O үгүй (маркерыг дуудагч хадгална).
 *
 * Яагаад `attributeGuest` хэрэгтэй вэ:
 *  зочин баримт ба аккаунт баримт **нийт XP-ийг хуваалцахгүй** — нэг бүрээр
 *  max авбал (legacy дүрэм) аль нэг талын ажил алдана. Тиймээс зочны бүх XP-ийг
 *  `guest:<deviceId>` түлхүүртэй хувь нэмэр болгон хувиргана:
 *   · анхны нэгтгэл: account.xp + guest.xp (харилцан нэмэгдэнэ),
 *   · дахин нэгтгэл: түлхүүр бүрээр max → ИДЕМПОТЕНТ (давтан нэмэхгүй),
 *   · зочин дараа нь сурвал (guest.xp өснө) → зөвхөн өсөлт нь нэмэгдэнэ.
 * Дүрэм бүрэн: docs/SYNC.md §2.
 */
import { mergeDocs } from "./merge";
import type { Doc } from "./store";

/** Зочин баримтад бодит ахиц байна уу? */
export function hasProgress(d: Doc | null | undefined): boolean {
  if (!d) return false;
  return (
    d.xp > 0 ||
    Object.keys(d.srs ?? {}).length > 0 ||
    (d.favorites?.length ?? 0) > 0 ||
    (d.grammarDone?.length ?? 0) > 0 ||
    Object.keys(d.achievements ?? {}).length > 0 ||
    Object.keys(d.activity ?? {}).length > 0 ||
    (d.exams?.length ?? 0) > 0 ||
    (d.mistakes?.length ?? 0) > 0 ||
    Object.keys(d.mnemonics ?? {}).length > 0
  );
}

/** Санал болгох тэмдэг (аккаунт бүрт тусдаа) — localStorage-д хадгална. */
export const guestMarkerKey = (uid: string) => `nd:guest-merged:${uid}`;

export function readGuestMarker(uid: string): number | null {
  try {
    const raw = localStorage.getItem(guestMarkerKey(uid));
    const n = raw == null ? NaN : Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export function writeGuestMarker(uid: string, at: number): void {
  try {
    localStorage.setItem(guestMarkerKey(uid), String(at));
  } catch {
    /* quota/private mode — маркергүйгээр дараа дахин асуухад ноцтой зүйлгүй */
  }
}

/**
 * Санал болгох эсэх: зочинд ахиц байх ёстой, МӨН энэ аккаунтанд сүүлийн
 * шийдвэрийн дараа зочин өөрчлөгдөөгүй байх (давтан логинд залгаж асуухгүй).
 * `marker` = сүүлд шийдвэр гаргасан үеийн `guest.updatedAt`.
 */
export function shouldOfferGuestMerge(guest: Doc | null | undefined, marker: number | null | undefined): boolean {
  if (!hasProgress(guest)) return false;
  if (marker == null) return true;
  return (guest as Doc).updatedAt !== marker;
}

/** Зочны хувь нэмэрийг `guest:<key>` түлхүүрт шилжүүлнэ (дээрх тайлбар). */
export function attributeGuest(guest: Doc, partKey: string): Doc {
  const counts = (a: { xp: number; min: number; newCards: number; reviews: number; correct: number; total: number }) => ({
    xp: a.xp, min: a.min, newCards: a.newCards, reviews: a.reviews, correct: a.correct, total: a.total,
  });
  const activity: Doc["activity"] = {};
  for (const [day, a] of Object.entries(guest.activity ?? {})) {
    activity[day] = { ...counts(a), parts: { [partKey]: counts(a) } };
  }
  return {
    ...guest,
    xpParts: { [partKey]: guest.xp },
    activity,
  };
}

/**
 * Зочны ахицыг аккаунт баримтад нэгтгэнэ (default = НЭГТГЭХ).
 * `partKey`: `guest:<device>` — өөр төхөөрөмжийн хувь нэмрээс ялгахын тулд.
 */
export function mergeGuestIntoAccount(
  guest: Doc,
  account: Doc,
  opts: { partKey?: string; now?: number } = {},
): Doc {
  const partKey = opts.partKey ?? "guest";
  const attributed = attributeGuest(guest, partKey);
  const res = mergeDocs(account, attributed, opts.now != null ? { now: opts.now } : {});
  return res.doc;
}

/** Хэдэн XP / карт / өдөр байгааг UI-д үзүүлэхэд. */
export function guestStats(d: Doc | null | undefined): { xp: number; cards: number; days: number } {
  if (!d) return { xp: 0, cards: 0, days: 0 };
  return {
    xp: d.xp,
    cards: Object.keys(d.srs ?? {}).length,
    days: Object.values(d.activity ?? {}).filter((a) => a.xp > 0).length,
  };
}
