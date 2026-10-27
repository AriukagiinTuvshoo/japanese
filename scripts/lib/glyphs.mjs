/**
 * Хялбаршуулсан хятад (Simplified Chinese) үсгийн шалгалт.
 * ------------------------------------------------------------------
 * Япон хэлэнд 漢字/復習 гэж бичдэг бол хятад хэлэнд 汉字/复习 гэж бичдэг.
 * Машины орчуулга/хуулбарлалтаас болж эдгээр үсэг гулган орж ирдэг —
 * япон текст дотор гарвал алдаа (шугам дээрх хүснэгтээс үзнэ үү).
 *
 * Жагсаалт нь зөвхөн хялбаршуулсан хэлбэрт байдаг (японы shinjitai-тай
 * давхцдаггүй) тэмдэгтүүд: 写, 学, 体, 国 зэрэг нь энд ОРОХГҮЙ, учир нь
 * эдгээр япон хэлэнд мөн адил бичигддэг.
 */
export const SIMPLIFIED_ONLY =
  // Зөвхөн хялбаршуулсан хэлбэрт байдаг, япон бичигтэй ХЭЗЭЭ Ч давхцдаггүй тэмдэгтүүд.
  // (写, 学, 体, 国, 会, 店, 医, 与, 号, 决 гэх мэт нь япон хэлэнд мөн адил — ОРОХГҮЙ.)
  "汉复习语试练题页单简课记说话门问时长见现发开关东车马鸟鱼龙龟贝让认识译词书买卖欢气爱为难飞风饭馆广厂产业务员虽经红绿网络线织级给结统绝继绩续约纪绿电边过还们个应头实际师张两无";

const RE = new RegExp(`[${SIMPLIFIED_ONLY}]`, "g");

/** Текст доторх хялбаршуулсан үсгүүдийг буцаана (давхардалгүй). */
export function findSimplified(text) {
  if (typeof text !== "string" || !text) return [];
  return [...new Set(text.match(RE) ?? [])];
}

/** Объектын бүх string талбарыг шалгана → [{path, chars}] */
export function scanObject(obj, path = "", out = []) {
  if (typeof obj === "string") {
    const chars = findSimplified(obj);
    if (chars.length) out.push({ path, chars: chars.join(""), text: obj });
  } else if (Array.isArray(obj)) {
    obj.forEach((v, i) => scanObject(v, `${path}[${i}]`, out));
  } else if (obj && typeof obj === "object") {
    for (const [k, v] of Object.entries(obj)) scanObject(v, path ? `${path}.${k}` : k, out);
  }
  return out;
}
