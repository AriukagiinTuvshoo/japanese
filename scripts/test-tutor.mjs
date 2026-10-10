// Unit tests for the Gemini tutor core (stubbed fetch — no real network/key).
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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
delete process.env.GEMINI_MODEL; // pin default-model assertions

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
//    Model selection: the default must be Google's current stable gemini-3.8-flash
//    (https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash).
{
  const req = buildGeminiRequest({
    messages: [{ role: "user", text: "わたしは学生です" }, { role: "tutor", text: "いいですね" }],
    level: "N4",
    language: "mn",
    apiKey: KEY,
  });
  assert.equal(
    req.url,
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent",
    "default model must be gemini-3.8-flash (current official stable)"
  );
  assert.equal(req.headers["x-goog-api-key"], KEY, "key travels only in x-goog-api-key header");
  assert.ok(!req.url.includes(KEY), "key must not be in the URL");
  assert.ok(!JSON.stringify(req.body).includes(KEY), "key must not be in the request body/prompt");
  const sys = req.body.systemInstruction.parts[0].text;
  assert.ok(sys.includes("N4"), "prompt is level-aware");
  assert.ok(/Mongolian/.test(sys), "prompt is language-aware");
  assert.ok(req.body.contents.length === 2);
  assert.equal(req.body.contents[0].role, "user");
  assert.equal(req.body.contents[1].role, "model");
  console.log("tutor: key header-only; default model gemini-3.8-flash; level/language prompt wiring ok");
}

// 3b. Full request path: the fetch goes to the exact model URL; GEMINI_MODEL overrides it.
{
  const calls = [];
  const fakeOk = {
    ok: true,
    status: 200,
    json: async () => ({ candidates: [{ content: { parts: [{ text: '{"reply":"ok","correction":null,"tip":null}' }] } }] }),
  };
  await handleTutorRequest({
    method: "POST",
    body: JSON.stringify({ messages: [{ role: "user", text: "a" }] }),
    env: { GEMINI_API_KEY: KEY },
    fetchImpl: async (url, init) => { calls.push({ url, init }); return fakeOk; },
  });
  assert.equal(calls.length, 1);
  assert.equal(
    calls[0].url,
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent",
    "request path must target the default stable model"
  );
  assert.equal(calls[0].init.method, "POST");
  assert.equal(calls[0].init.headers["x-goog-api-key"], KEY, "key must be sent only in x-goog-api-key header");
  assert.ok(!calls[0].url.includes(KEY), "key must not appear in the request URL");
  assert.ok(!calls[0].init.body.includes(KEY), "key must not appear in the request body");

  await handleTutorRequest({
    method: "POST",
    body: JSON.stringify({ messages: [{ role: "user", text: "a" }] }),
    env: { GEMINI_API_KEY: KEY, GEMINI_MODEL: "custom-test-model" },
    fetchImpl: async (url, init) => { calls.push({ url, init }); return fakeOk; },
  });
  assert.equal(
    calls[1].url,
    "https://generativelanguage.googleapis.com/v1beta/models/custom-test-model:generateContent",
    "GEMINI_MODEL env must override the default in the request path"
  );
  console.log("tutor: request path + model selection (default and GEMINI_MODEL override) verified");
}

// 3c. Regression guard: no retired model ids in server code, hints or UI strings.
{
  const core = await readFile(new URL("../api/_tutor-core.mjs", import.meta.url), "utf8");
  const i18n = await readFile(new URL("../src/lib/i18n.ts", import.meta.url), "utf8");
  assert.ok(core.includes('DEFAULT_MODEL = "gemini-3.8-flash"'), "core default must be gemini-3.8-flash");
  assert.ok(!/gemini-[12]\./.test(core), "retired 1.x/2.x model ids must not appear in api/_tutor-core.mjs");
  assert.ok(!/gemini-[12]\./.test(i18n), "retired 1.x/2.x model ids must not appear in UI strings");
  const missingKey = await handleTutorRequest({
    method: "POST",
    body: JSON.stringify({ messages: [{ role: "user", text: "a" }] }),
    env: {},
    fetchImpl: async () => { throw new Error("no"); },
  });
  assert.ok(missingKey.body.hint.includes("gemini-3.8-flash"), "config hint must name the current default");
  assert.ok(!/gemini-[12]\./.test(JSON.stringify(missingKey.body)), "hints must not name retired model ids");
  console.log("tutor: no retired-model defaults remain");
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

// 7. Voice turns: the clip rides as an inlineData user part; "heard" is parsed.
{
  const req = buildGeminiRequest({
    messages: [{ role: "user", text: "さくら" }, { role: "tutor", text: "いいですね" }],
    level: "N5",
    language: "mn",
    apiKey: KEY,
    audio: { mimeType: "audio/webm;codecs=opus", data: "AAAAIGZvbw==" },
  });
  const last = req.body.contents[req.body.contents.length - 1];
  assert.equal(last.role, "user");
  assert.deepEqual(last.parts, [{ inlineData: { mimeType: "audio/webm;codecs=opus", data: "AAAAIGZvbw==" } }]);
  assert.ok(!JSON.stringify(req.body).includes(KEY), "key must not be in the body with audio present");
  assert.ok(req.body.systemInstruction.parts[0].text.includes('"heard"'), "prompt must define the heard field");
  const parsed = parseGeminiReply({
    candidates: [{ content: { parts: [{ text: JSON.stringify({ reply: "Сайн!", correction: null, tip: null, heard: "さくら" }) }] } }],
  });
  assert.equal(parsed.heard, "さくら");

  const calls = [];
  const fakeOk = {
    ok: true,
    status: 200,
    json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ reply: "ok", correction: null, tip: null, heard: "こんにちは" }) }] } }] }),
  };
  const r = await handleTutorRequest({
    method: "POST",
    body: JSON.stringify({ messages: [{ role: "user", text: "hi" }], audio: { mimeType: "audio/webm", data: "AAAA" }, level: "N5", language: "mn" }),
    env,
    fetchImpl: async (url, init) => { calls.push({ url, init }); return fakeOk; },
  });
  assert.equal(r.status, 200);
  assert.equal(r.body.heard, "こんにちは");
  assert.equal(
    calls[0].url,
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent",
    "voice turns use the same model-selection request path"
  );
  const sent = JSON.parse(calls[0].init.body);
  assert.deepEqual(sent.contents[sent.contents.length - 1].parts, [{ inlineData: { mimeType: "audio/webm", data: "AAAA" } }]);
  assert.equal(calls[0].init.headers["x-goog-api-key"], KEY, "voice turns keep the key in the header only");
  assert.ok(!calls[0].init.body.includes(KEY));
  console.log("tutor: voice turn request path (inlineData + heard + model selection) verified");
}

// 7b. Voice guards: oversize/bad mime/shape rejected locally; missing key never forwards audio.
{
  let called = 0;
  const fetchImpl = async () => { called++; throw new Error("must not fetch"); };
  const big = { mimeType: "audio/webm", data: "x".repeat(2_500_001) };
  const r1 = await handleTutorRequest({ method: "POST", body: JSON.stringify({ audio: big }), env, fetchImpl });
  assert.equal(r1.status, 400);
  assert.equal(r1.body.error, "audio_too_large");
  const r2 = await handleTutorRequest({ method: "POST", body: JSON.stringify({ audio: { mimeType: "text/html", data: "AAAA" } }), env, fetchImpl });
  assert.equal(r2.status, 400);
  assert.equal(r2.body.error, "audio_unsupported");
  const r3 = await handleTutorRequest({ method: "POST", body: JSON.stringify({ audio: { mimeType: "audio/webm", data: 123 } }), env, fetchImpl });
  assert.equal(r3.status, 400);
  assert.equal(r3.body.error, "bad_request");
  const r4 = await handleTutorRequest({ method: "POST", body: JSON.stringify({ audio: { mimeType: "audio/webm", data: "AAAA" } }), env: {}, fetchImpl });
  assert.equal(r4.status, 503);
  assert.equal(r4.body.error, "config_needed");
  assert.equal(called, 0, "invalid or unkeyed audio must never reach upstream");

  // A voice-only turn (no text messages) is valid input.
  const fakeOk = {
    ok: true,
    status: 200,
    json: async () => ({ candidates: [{ content: { parts: [{ text: '{"reply":"r","correction":null,"tip":null,"heard":"きく"}' }] } }] }),
  };
  const r5 = await handleTutorRequest({
    method: "POST",
    body: JSON.stringify({ audio: { mimeType: "audio/ogg;codecs=opus", data: "AAAA" } }),
    env,
    fetchImpl: async () => fakeOk,
  });
  assert.equal(r5.status, 200);
  assert.equal(r5.body.heard, "きく");
  const scrubbed = parseGeminiReply({
    candidates: [{ content: { parts: [{ text: `{"reply":"x","correction":null,"tip":null,"heard":"${KEY}"}` }] } }],
  });
  assert.ok(!JSON.stringify(scrubbed).includes(KEY), "key-shaped strings must be scrubbed from heard too");
  console.log("tutor: voice guards (size/mime/shape/missing-key) + voice-only turn ok");
}

console.log("OK: Gemini tutor core — disabled state, guards, model selection (gemini-3.8-flash default), voice turns, privacy and error paths verified (no real key used)");
