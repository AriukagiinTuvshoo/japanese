// Gemini tutor core — pure, testable logic shared by the Vercel function.
// SECURITY RULES (do not relax):
//  - GEMINI_API_KEY lives only in server-side env (Vercel env vars). It is never
//    returned to clients, never written to logs, never embedded in prompts.
//  - Learner transcripts are never persisted here: handled per-request only.
//  - Responses are Cache-Control: no-store.

// Default model = Google's current stable Flash model per official docs
// (https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash — stable id
// `gemini-3.8-flash`, updated 2026-09). Retired model ids must never appear
// as defaults. Override per deployment with GEMINI_MODEL.
const DEFAULT_MODEL = "gemini-3.8-flash";
const GEMINI_URL = (model) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

export function hasGeminiKey(env = process.env) {
  return typeof env.GEMINI_API_KEY === "string" && env.GEMINI_API_KEY.trim().length > 0;
}

export function scrub(value) {
  // Defensive: never let a key-shaped string reach logs/clients.
  if (typeof value !== "string") return value;
  return value.replace(/AIza[0-9A-Za-z_-]{10,}/g, "[redacted-key]");
}

export function buildSystemPrompt({ level, language }) {
  const langLine =
    language === "en"
      ? "Reply in natural English (learners are English speakers)."
      : "Reply in natural, idiomatic Mongolian (learners are Mongolian speakers) — concise sentences, no English calques.";
  return [
    "You are the Nihongo Dōjō sensei: a friendly, patient Japanese conversation tutor.",
    `Learner JLPT level: ${level || "N5"}. Match vocabulary and grammar to that level.`,
    langLine,
    "When the learner writes or speaks Japanese, gently correct mistakes: show the corrected Japanese sentence and briefly explain the fix.",
    "When helpful, include a short Japanese practice line with reading support.",
    "Keep replies under 120 words. Be encouraging. Never ask for personal data (name, age, contacts, location).",
    'Respond ONLY with strict JSON: {"reply": string, "correction": string|null, "tip": string|null}.',
  ].join("\n");
}

export function buildGeminiRequest({ messages, level, language, model, apiKey }) {
  const contents = (Array.isArray(messages) ? messages : [])
    .filter((m) => m && typeof m.text === "string" && m.text.trim())
    .slice(-16)
    .map((m) => ({
      role: m.role === "tutor" ? "model" : "user",
      parts: [{ text: m.text.slice(0, 2000) }],
    }));
  return {
    url: GEMINI_URL(model || process.env.GEMINI_MODEL || DEFAULT_MODEL),
    headers: {
      "content-type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: {
      systemInstruction: { parts: [{ text: buildSystemPrompt({ level, language }) }] },
      contents,
      generationConfig: { temperature: 0.7, maxOutputTokens: 400, responseMimeType: "application/json" },
    },
  };
}

export function parseGeminiReply(data) {
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") ?? "";
  const cleaned = scrub(text).trim();
  try {
    const parsed = JSON.parse(cleaned);
    return {
      reply: String(parsed.reply ?? "").slice(0, 2000),
      correction: parsed.correction ? String(parsed.correction).slice(0, 1000) : null,
      tip: parsed.tip ? String(parsed.tip).slice(0, 500) : null,
    };
  } catch {
    return { reply: cleaned.slice(0, 2000), correction: null, tip: null };
  }
}

export const NO_STORE_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store, no-cache, must-revalidate",
};

// Pure request handler. env + fetchImpl injected for tests.
export async function handleTutorRequest({ method, body, env = process.env, fetchImpl = fetch }) {
  if (method !== "POST") {
    return { status: 405, headers: NO_STORE_HEADERS, body: { error: "method_not_allowed" } };
  }
  if (!hasGeminiKey(env)) {
    // Safe disabled state: no upstream call, no key handling at all.
    return {
      status: 503,
      headers: NO_STORE_HEADERS,
      body: {
        error: "config_needed",
        hint: "Set the GEMINI_API_KEY environment variable in the Vercel project (Settings → Environment Variables) and redeploy. Optionally set GEMINI_MODEL (default: gemini-3.8-flash).",
      },
    };
  }
  let payload;
  try {
    payload = typeof body === "string" ? JSON.parse(body || "{}") : (body || {});
  } catch {
    return { status: 400, headers: NO_STORE_HEADERS, body: { error: "bad_request" } };
  }
  const messages = Array.isArray(payload.messages) ? payload.messages : [];
  if (!messages.some((m) => m && typeof m.text === "string" && m.text.trim())) {
    return { status: 400, headers: NO_STORE_HEADERS, body: { error: "bad_request" } };
  }
  const req = buildGeminiRequest({
    messages,
    level: payload.level,
    language: payload.language === "en" ? "en" : "mn",
    model: env.GEMINI_MODEL,
    apiKey: env.GEMINI_API_KEY,
  });
  let res;
  try {
    res = await fetchImpl(req.url, {
      method: "POST",
      headers: req.headers,
      body: JSON.stringify(req.body),
      signal: AbortSignal.timeout?.(30_000),
    });
  } catch {
    return { status: 502, headers: NO_STORE_HEADERS, body: { error: "upstream_unavailable" } };
  }
  if (res.status === 429) {
    return { status: 503, headers: NO_STORE_HEADERS, body: { error: "rate_limited" } };
  }
  if (!res.ok) {
    // Never forward upstream bodies (they can contain request ids tied to the key).
    return { status: 502, headers: NO_STORE_HEADERS, body: { error: "upstream_error" } };
  }
  let data;
  try {
    data = await res.json();
  } catch {
    return { status: 502, headers: NO_STORE_HEADERS, body: { error: "upstream_error" } };
  }
  return { status: 200, headers: NO_STORE_HEADERS, body: parseGeminiReply(data) };
}
