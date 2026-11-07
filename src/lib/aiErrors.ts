/**
 * AI АЛДААНЫ АНГИЛАЛ БА ХЭЛЭЭР ХАРУУЛАХ ТЕКСТ
 * ------------------------------------------------------------------
 * Серверийн `code` болон HTTP статусыг нэг төрөлд оруулж, UI-д Монгол
 * болон English хэлээр ижил утгатай текст харуулна. Энэ модуль цэвэр
 * (React, сүлжээгүй) тул тестээр бүрэн хамгаалагдана.
 *
 * Чухал: 503 нь дандаа «түлхүүр байхгүй» гэсэн үг биш — `no_key`,
 * `quota`, `unavailable` гурвыг ЭНД тус тусад нь ялгана.
 */

export type AiErrorKind =
  | "no_key"
  | "bad_key"
  | "model_unavailable"
  | "rate_limited"
  | "quota"
  | "unavailable"
  | "timeout"
  | "network"
  | "invalid_request"
  | "invalid_response"
  | "quality_failed"
  | "blocked"
  | "cancelled"
  | "server";

export const AI_ERROR_KINDS: readonly AiErrorKind[] = [
  "no_key",
  "bad_key",
  "model_unavailable",
  "rate_limited",
  "quota",
  "unavailable",
  "timeout",
  "network",
  "invalid_request",
  "invalid_response",
  "quality_failed",
  "blocked",
  "cancelled",
  "server",
] as const;

type Lang = "mn" | "en";

export const AI_ERROR_TEXT: Record<AiErrorKind, Record<Lang, string>> = {
  no_key: {
    mn: "Серверт AI түлхүүр (GEMINI_API_KEY) тохируулаагүй байна.",
    en: "The server has no AI key (GEMINI_API_KEY) configured.",
  },
  bad_key: {
    mn: "Серверийн AI түлхүүр хүчингүй байна. Админ шинэчилнэ үү.",
    en: "The server's AI key is invalid. An admin must update it.",
  },
  model_unavailable: {
    mn: "Тохируулсан AI модель боломжгүй байна. Админ GEMINI_MODEL-ийг шалгана уу.",
    en: "The configured AI model is unavailable. An admin should check GEMINI_MODEL.",
  },
  rate_limited: {
    mn: "Хэт олон хүсэлт илгээлээ. Хэсэг хүлээгээд дахин оролдоно уу.",
    en: "Too many requests. Wait a little and try again.",
  },
  quota: {
    mn: "AI үйлчилгээний хязгаар дүүрлээ. Хэсэг хүлээгээд дахин оролдоно уу.",
    en: "The AI usage limit is reached. Wait a while and try again.",
  },
  unavailable: {
    mn: "AI үйлчилгээ түр ачаалалтай байна. Хэдэн минут хүлээгээд дахин оролдоно уу.",
    en: "The AI service is overloaded right now. Try again in a few minutes.",
  },
  timeout: {
    mn: "AI хариу өгөх хугацаа хэтэрлээ. Дараа дахин оролдоно уу.",
    en: "The AI took too long to answer. Try again.",
  },
  network: {
    mn: "Сервертэй холбогдож чадсангүй. Сүлжээ болон API серверийг шалгана уу.",
    en: "Could not reach the server. Check your connection and the API server.",
  },
  invalid_request: {
    mn: "Хүсэлт хүлээн авагдахгүй байна. Түвшин, хэсэг, асуултын тоог шалгана уу.",
    en: "The request was rejected. Check the level, section and question count.",
  },
  invalid_response: {
    mn: "Серверийн хариултыг уншиж чадсангүй. Дараа дахин оролдоно уу.",
    en: "The server's response could not be read. Try again.",
  },
  quality_failed: {
    mn: "AI-аас шалгалтад тэнцсэн асуулт гараагүй. Дахин оролдоно уу.",
    en: "The AI produced no question that passed validation. Try again.",
  },
  blocked: {
    mn: "AI хариултыг аюулгүй байдлын дүрмээр блоклолоо. Өөр хэсгээр оролдоно уу.",
    en: "The AI response was blocked by safety rules. Try another section.",
  },
  cancelled: {
    mn: "Хүсэлт цуцлагдлаа.",
    en: "The request was cancelled.",
  },
  server: {
    mn: "Серверийн алдаа гарлаа. Дараа дахин оролдоно уу.",
    en: "A server error occurred. Try again.",
  },
};

/**
 * UI-д харуулах текст. Танигдахгүй төрөл ирвэл (хуучин state, шинэ серверийн
 * код) UI-г унагахгүй — ерөнхий «серверийн алдаа» мессеж рүү шилжинэ.
 */
export function aiErrorMessage(lang: Lang, kind: AiErrorKind): string {
  return AI_ERROR_TEXT[kind]?.[lang] ?? AI_ERROR_TEXT.server[lang];
}

/**
 * Дахин оролдоход утга учиртай эсэх. Тохиргооны алдаа (key, модель) болон
 * буруу хүсэлтийг давтах нь зөвхөн квот үрээд өөрчлөлт авчрахгүй.
 */
const RETRYABLE: Record<AiErrorKind, boolean> = {
  no_key: false,
  bad_key: false,
  model_unavailable: false,
  invalid_request: false,
  rate_limited: true,
  quota: true,
  unavailable: true,
  timeout: true,
  network: true,
  invalid_response: true,
  quality_failed: true,
  blocked: true,
  cancelled: true,
  server: true,
};

export function isRetryable(kind: AiErrorKind): boolean {
  return RETRYABLE[kind];
}
