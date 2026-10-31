/**
 * B4 — хадгалалтын хязгаар (quota) урьдчилан мэдээлэх.
 * ------------------------------------------------------------------
 * Хэмжилт (scripts/measure-doc.ts, 2026-10-27):
 *   · анхны баримт            0.5 kB
 *   · типик (6 сар, 600 карт) 130 kB
 *   · хүнд (3 жил, бүх үг)   1.72 MB
 *   · хэт хүнд (стресс)      3.54 MB
 * localStorage-ийн хязгаар нь токен тус бүр ⌀5 MB (Safari) – 10 MB (Chrome).
 * 1 основ + нөөцүүд гэвэл хүнд хэрэглэгч 2–4 копи барьж чадна — тиймээс
 * **нөөцийн тоог баримтын хэмжээгээр тогтооно** (backupKeepFor), мөн 80%-д
 * хүрэхээс ӨМНӨ анхааруулна.
 *
 * IndexedDB рүү шилжүүлэх үү? → ҮГҮЙ гэж дүгнэсэн (docs/PROGRESS.md B4):
 * типик 130 kB нь хязгаарын 2.6% бөгөөд хүнд хэрэглэгч ч 2× (основ+undo)
 * 1.72 MB×2 = 3.4 MB < 5 MB байна. Нэмэлт adapter + миграцийн эрсдэл
 * үр ашгаас илүү.
 */

/** Энэ хувийг дээгүүр бол "удахгүй дүүрнэ" — анхааруулна. */
export const NEAR_FULL_RATIO = 0.8;

export interface StorageEstimateLike {
  usage?: number;
  quota?: number;
}

/**
 * Ашиглалт/хязгаарын хувь. `quota` тодорхойгүй (хуучин хөтөч) бол `null` —
 * таамаглахгүй, анхааруулга ч үгүй.
 */
export function usageRatio(est: StorageEstimateLike | null | undefined): number | null {
  if (!est) return null;
  const { usage, quota } = est;
  if (typeof quota !== "number" || !Number.isFinite(quota) || quota <= 0) return null;
  if (typeof usage !== "number" || !Number.isFinite(usage) || usage < 0) return null;
  return Math.min(1, usage / quota);
}

/** ~80% бол бичихээс ӨМНӨ мэдээлнэ (бичлэг амжилтгүй болохоос өмнө). */
export function isNearFull(est: StorageEstimateLike | null | undefined): boolean {
  const r = usageRatio(est);
  return r !== null && r >= NEAR_FULL_RATIO;
}

/** Бичлэгийн хэмжээ (байт) — нөөцийн тоог тогтооход. */
export function bytesOf(json: string): number {
  try {
    return new TextEncoder().encode(json).length;
  } catch {
    return json.length;
  }
}

/**
 * Баримтын хэмжээээс хамаарах хэдэн нөөц үлдээх вэ.
 *   < 256 kB → 3 (жирийн хэрэглэгч бүрэн хамгаалалт)
 *   < 1 MB   → 1 (нэг л нөөц; хэд хэдэн копи quota-г дүүргэнэ)
 *   ≥ 1 MB   → 0 (основ бичлэг + undo хадгалахыг илүүд үзнэ)
 */
export function backupKeepFor(bytes: number): number {
  if (bytes < 256 * 1024) return 3;
  if (bytes < 1024 * 1024) return 1;
  return 0;
}

/** navigator.storage.estimate() — дэмждэггүй бол `null` (алдаа шидэхгүй). */
export async function getEstimate(): Promise<StorageEstimateLike | null> {
  try {
    const storage = (globalThis.navigator as { storage?: { estimate?: () => Promise<StorageEstimateLike> } } | undefined)?.storage;
    if (!storage?.estimate) return null;
    return await storage.estimate();
  } catch {
    return null;
  }
}

/**
 * Тогтмол хадгалалт (persistent storage) хүснэ — **нэг удаа**.
 * Яагаад: хэрэглэгчийн нөөц дүүрвэл/төхөөрөмж дээр даралт үүсвэл хөтөч
 * localStorage-г автомат устгаж магадгүй; persistent бол татгалзахдаа
 * хэрэглэгчийн өгөгдөл үлдэнэ. Амжилтгүй бол зүгээр үргэлжлүүлнэ.
 */
export const PERSIST_ASKED_KEY = "nd:storage-persist-asked";

export async function requestPersistenceOnce(): Promise<boolean | null> {
  try {
    const storage = (globalThis.navigator as { storage?: { persist?: () => Promise<boolean> } } | undefined)?.storage;
    if (!storage?.persist) return null;
    let asked = false;
    try {
      asked = localStorage.getItem(PERSIST_ASKED_KEY) === "1";
    } catch {
      asked = true; // private mode — дахин гуйх шаардлагагүй
    }
    if (asked) return null;
    try {
      localStorage.setItem(PERSIST_ASKED_KEY, "1");
    } catch {
      /* тэмдэглэж чадвал ч саадгүй үргэлжлүүлнэ */
    }
    return await storage.persist();
  } catch {
    return null;
  }
}
