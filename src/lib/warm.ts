/**
 * Офлайны "дулаацуулалт".
 * ------------------------------------------------------------------
 * SW нь суулгах үед зөвхөн N5-ыг татдаг (хурдан эхлэх). Гэвч Review,
 * хайлт зэрэг нь бүх түвшний өгөгдөл хэрэглэдэг тул N4–N1-ийг ч
 * арын дэвсгэрт татна. SW-ийн data стратеги cache-first тул эдгээр
 * хүсэлт кэшэд орж, дараа нь интернэтгүй ч бүх апп ажиллана.
 */
import { LEVELS } from "./types";

const KINDS = ["vocab", "kanji", "grammar", "strokes"] as const;

/** N5-аас бусад бүх түвшний өгөгдлийн зам. */
export function offlineWarmUrls(base = import.meta.env.BASE_URL): string[] {
  const urls: string[] = [];
  for (const kind of KINDS) {
    for (const lvl of LEVELS) {
      if (lvl === "N5") continue;
      urls.push(`${base}data/${kind}/${lvl.toLowerCase()}.json`);
    }
  }
  return urls;
}

/**
 * Дараалан (нэг нэгээр) татна — хэрэглэгчийн үндсэн хүсэлтийг боомилохгүй.
 * Алдаа гарвал чимээгүй зогсоно: офлайн кэш дутуу байх нь апп-ыг эвдэхгүй.
 */
export async function warmOfflineData(shouldStop: () => boolean = () => false): Promise<number> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return 0;
  let done = 0;
  for (const url of offlineWarmUrls()) {
    if (shouldStop()) break;
    try {
      const res = await fetch(url);
      if (!res.ok) return done;
      await res.arrayBuffer();
      done++;
    } catch {
      return done;
    }
  }
  return done;
}
