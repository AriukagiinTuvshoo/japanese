// Unit tests for the Gemini tutor core (stubbed fetch — no real network/key).
import assert from "node:assert/strict";
import {
  handleTutorRequest,
  buildGeminiRequest,
  parseGeminiReply,
  buildSystemPrompt,
  hasGeminiKey,
  scrub,
} from "../api/_tutor-core.mjs";

const KEY = "AIzaFAKEKEYFORTESTS1234567890abcdefgh";
const env = { GEMINI_API_KEY: KEY };

// 1. Missing key -> safe disabled state, no fetch attempted.
{
  let called = 0;
  const r = await handleTutorRequest({
    method: "POST",
    body: JSON.stringify({ messages: [{ role: "user", text: "こんにちは" }] }),
    env: {},
    fetchImpl: async () => { called++; throw new Error("must not fetch"); },
  });
  assert.equal(r.status, 503);
  assert.equal(r.body.error, "config_needed");
  assert.ok(r.body.hint.includes("GEMINI_API_KEY"), "hint must name the env var");
  assert.equal(called, 0, "no upstream call without a key");
  assert.equal(JSON.stringify(r.body).includes(KEY), false);
  console.log("tutor: missing key -> config_needed, zero upstream calls");
}

// 2. Method + payload guards.
{
  const r1 = await handleTutorRequest({ method: "GET", env, fetchImpl: async () => ({ ok: true }) });
  assert.equal(r1.status, 405);
  const r2 = await handleTutorRequest({ method: "POST", body: "{not json", env, fetchImpl: async () => ({ ok: true }) });
  assert.equal(r2.status, 400);
  const r3 = await handleTutorRequest({ method: "POST", body: JSON.stringify({ messages: [] }), env, fetchImpl: async () => ({ ok: true }) });
  assert.equal(r3.status, 400);
  console.log("tutor: method/payload guards pass");
}

// 3. Request shape: key in header only, never in prompt/body; level+language aware.
{
  const req = buildGeminiRequest({
    messages: [{ role: "user", text: "わたしは学生です" }, { role: "tutor", text: "いいですね" }],
    level: "N4",
    language: "mn",
    model: "gemini-2.0-flash",
    apiKey: KEY,
  });
  assert.equal(req.headers["x-goog-api-key"], KEY);
  assert.ok(!req.url.includes(KEY), "key must not be in the URL");
  assert.ok(!JSON.stringify(req.body).includes(KEY), "key must not be in the request body/prompt");
  const sys = req.body.systemInstruction.parts[0].text;
  assert.ok(sys.includes("N4"), "prompt is level-aware");
  assert.ok(/Mongolian/.test(sys), "prompt is language-aware");
  assert.ok(req.body.contents.length === 2);
  assert.equal(req.body.contents[0].role, "user");
  assert.equal(req.body.contents[1].role, "model");
  console.log("tutor: key header-only; level/language prompt wiring ok");
}

// 4. Success path parses strict JSON and scrubs key-shaped strings.
{
  const fake = {
    ok: true,
    status: 200,
    json: async () => ({
      candidates: [{ content: { parts: [{ text: JSON.stringify({ reply: "Сайн байна! 私は学生です。", correction: "わたしは学生です (とおりです)", tip: "は/が-г анхаар" }) }] } }],
    }),
  };
  const r = await handleTutorRequest({
    method: "POST",
    body: JSON.stringify({ messages: [{ role: "user", text: "私は学生です" }], level: "N5", language: "mn" }),
    env,
    fetchImpl: async () => fake,
  });
  assert.equal(r.status, 200);
  assert.ok(r.body.reply.includes("学生"));
  assert.equal(r.body.correction.includes("学生です"), true);
  assert.equal(r.headers["cache-control"], "no-store, no-cache, must-revalidate");
  const leak = parseGeminiReply({ candidates: [{ content: { parts: [{ text: `{"reply":"x ${KEY} y","correction":null,"tip":null}` }] } }] });
  assert.ok(!JSON.stringify(leak).includes(KEY), "key-shaped strings must be scrubbed from replies");
  console.log("tutor: success parse + key scrub + no-store headers");
}

// 5. Error mapping: 429 -> rate_limited; 5xx -> upstream_error; throw -> upstream_unavailable.
{
  const r429 = await handleTutorRequest({ method: "POST", body: JSON.stringify({ messages: [{ role: "user", text: "a" }] }), env, fetchImpl: async () => ({ ok: false, status: 429 }) });
  assert.equal(r429.status, 503);
  assert.equal(r429.body.error, "rate_limited");
  const r500 = await handleTutorRequest({ method: "POST", body: JSON.stringify({ messages: [{ role: "user", text: "a" }] }), env, fetchImpl: async () => ({ ok: false, status: 500 }) });
  assert.equal(r500.status, 502);
  assert.equal(r500.body.error, "upstream_error");
  const rNet = await handleTutorRequest({ method: "POST", body: JSON.stringify({ messages: [{ role: "user", text: "a" }] }), env, fetchImpl: async () => { throw new Error("boom"); } });
  assert.equal(rNet.status, 502);
  assert.equal(rNet.body.error, "upstream_unavailable");
  console.log("tutor: rate-limit/upstream/network error mapping ok");
}

// 6. Helpers.
{
  assert.equal(hasGeminiKey({}), false);
  assert.equal(hasGeminiKey({ GEMINI_API_KEY: "  " }), false);
  assert.equal(hasGeminiKey(env), true);
  assert.equal(scrub(`x ${KEY} y`), "x [redacted-key] y");
  assert.ok(buildSystemPrompt({ level: "N2", language: "en" }).includes("English"));
  console.log("tutor: helpers pass");
}

console.log("OK: Gemini tutor core — disabled state, guards, privacy and error paths verified (no real key used)");
