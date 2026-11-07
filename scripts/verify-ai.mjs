/**
 * LIVE GEMINI VERIFICATION — `npm run verify:ai`
 * ------------------------------------------------------------------
 * БОДИТ Gemini API-г дуудна (квот зарцуулна). GEMINI_API_KEY `.env`-ээс
 * эсвэл орчны хувьсагчаас уншина; түлхүүр байхгүй бол 1 кодоор гарна.
 *
 * Орчны хувьсагч:
 *  · AI_VERIFY_LEVEL     — түвшин (default N2)
 *  · AI_VERIFY_COUNT     — хэсэг тус бүрийн асуултын тоо (default 5; benchmark 10)
 *  · AI_VERIFY_SECTIONS  — таслалаар: vocabulary,grammar,reading,listening,kanji
 *                          (default: эхний дөрөв = Phase 8-ийн 40 асуултын дээж)
 *  · AI_VERIFY_STUB=1    — СҮЛЖЭЭГҮЙ dry-run: pipeline-ыг шалгах зорилготой,
 *                          хуурамч асуулт үүсгэж артефактад mode:"stub" гэж тэмдэглэнэ.
 *
 * Юуг шалгах вэ:
 *  · Тохируулсан модель бодитоор хариу өгч байгаа эсэх
 *  · Хэсэг тус бүрээр схем/валидаторыг давсан асуултын тоо, татгалзсан тоо
 *  · Давхардал, эх текст, тайлбарын чанарын үндсэн шинж
 *  · Хугацаа (latency), оролдлогын тоо, prompt hash (давтагдах боломжтой байдал)
 *
 * Үр дүнг `artifacts/ai-verify-<огноо>.json`-д хадгална (git-д орохгүй).
 */

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv() {
  const file = path.join(ROOT, ".env");
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    const value = m[2].replace(/^["']|["']$/g, "");
    if (process.env[m[1]] === undefined) process.env[m[1]] = value;
  }
}
loadEnv();

const STUB = process.env.AI_VERIFY_STUB === "1";

if (!STUB && !process.env.GEMINI_API_KEY) {
  console.error("✗ GEMINI_API_KEY тохируулаагүй байна.");
  console.error("  .env.example-ыг .env болгон хуулж, түлхүүрийг бөглөнө үү (чат руу бичихгүй).");
  console.error("  Дараа нь: npm run verify:ai");
  console.error("  (Сүлжээгүй pipeline шалгалт: AI_VERIFY_STUB=1 npm run verify:ai)");
  process.exit(1);
}

const { DEFAULT_MODEL, GENERATION_CONFIG, MAX_OUTPUT_TOKENS, buildPrompt, generateAiExam } =
  await import("../server/generate.ts");
const { AI_SECTIONS } = await import("../src/lib/aiExam.ts");

function gitCommit() {
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

const LEVEL = process.env.AI_VERIFY_LEVEL || "N2";
const COUNT = Number(process.env.AI_VERIFY_COUNT || 5);
const DEFAULT_SECTIONS = ["vocabulary", "grammar", "reading", "listening"];
const RAW_SECTIONS = (process.env.AI_VERIFY_SECTIONS || DEFAULT_SECTIONS.join(","))
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);
const unknown = RAW_SECTIONS.filter((s) => !AI_SECTIONS.includes(s));
if (unknown.length || !RAW_SECTIONS.length) {
  console.error(`✗ AI_VERIFY_SECTIONS буруу: ${unknown.join(", ") || "(хоосон)"}. Зөв утга: ${AI_SECTIONS.join(", ")}`);
  process.exit(1);
}
const SECTIONS = RAW_SECTIONS;

/** Валидаторын гаднах, хүн-унших чанарын үндсэн шалгалт. */
function auditQuestion(q, section) {
  const issues = [];
  const texts = q.options.map((o) => o.text.normalize("NFKC"));
  if (texts.length !== 4) issues.push("option_count");
  if (new Set(texts).size !== 4) issues.push("option_duplicate");
  if (!q.options.some((o) => o.id === q.correctAnswer)) issues.push("answer_not_in_options");
  if ((section === "reading" || section === "listening") && !q.passage) issues.push("passage_missing");
  if (section === "reading" && q.passage && q.passage.length < 120) issues.push("passage_short_for_reading");
  if (!q.explanationJa) issues.push("ja_explanation_missing");
  if (q.explanationMn.length < 40) issues.push("mn_explanation_thin");
  if (texts.some((t) => /^[A-Da-d]$/.test(t.trim()))) issues.push("option_is_letter");
  return issues;
}

/**
 * Сүлжээгүй stub генератор — ЗӨВХӨН pipeline шалгах зорилготой.
 * Асуултууд нь валидаторыг давах бүтэцтэй боловч хэлний чанар шалгах
 * дээж БИШ; артефакт `mode:"stub"` ба `stub:true` гэж тэмдэглэгдэнэ.
 */
function stubGenerator(level, section, count) {
  return async () => {
    const questions = Array.from({ length: count }, (_, i) => {
      const word = `練習${i + 1}`;
      return {
        level,
        section,
        questionType: "stub",
        question: `【検証スタブ】第${i + 1}問：彼は毎日（　）を続けている。`,
        passage:
          section === "reading" || section === "listening"
            ? `【検証スタブ】${i + 1}番目のダミー本文です。内容は評価対象ではありませんが、読解・聴解の問題文として最低限の長さを持たせています。`
            : null,
        options: [
          { id: "A", text: word },
          { id: "B", text: `訓練${i + 1}` },
          { id: "C", text: `運動${i + 1}` },
          { id: "D", text: `活動${i + 1}` },
        ],
        correctAnswer: "A",
        explanationMn: `【STUB】「${word}」 нь энэ өгүүлбэрт хамгийн тохиромжтой. Энэ бол pipeline шалгалтын хуурамч асуулт.`,
        explanationJa: "検証用のダミー解説です。",
        vocabulary: [],
        grammarPoints: [],
      };
    });
    return JSON.stringify({ questions });
  };
}

const results = [];
const allPrompts = new Map();
const promptVersion = createHash("sha256").update(buildPrompt({ level: LEVEL, section: SECTIONS[0], count: COUNT })).digest("hex").slice(0, 12);

for (const section of SECTIONS) {
  const req = { level: LEVEL, section, count: COUNT };
  const prompt = buildPrompt(req);
  const promptHash = createHash("sha256").update(prompt).digest("hex").slice(0, 16);
  const startedAt = new Date().toISOString();
  const started = Date.now();
  const out = await generateAiExam(
    req,
    STUB ? { attempts: 1, generate: stubGenerator(LEVEL, section, COUNT) } : { attempts: 2 },
  );
  const ms = Date.now() - started;

  if (!out.ok) {
    results.push({ section, at: startedAt, ok: false, status: out.status, code: out.code, message: out.message, ms, promptHash });
    console.log(`✗ ${section.padEnd(10)} ${out.status} ${out.code} — ${out.message} (${ms} ms)`);
    continue;
  }

  const audits = out.questions.map((q) => ({ question: q.question, issues: auditQuestion(q, section) }));
  const flagged = audits.filter((a) => a.issues.length);
  for (const q of out.questions) {
    const prev = allPrompts.get(q.question);
    if (prev) flagged.push({ question: q.question, issues: [`duplicate_of_${prev}`] });
    else allPrompts.set(q.question, section);
  }

  results.push({
    section,
    at: startedAt,
    ok: true,
    model: out.model,
    requested: out.requested,
    returned: out.questions.length,
    schemaValid: out.questions.length,
    schemaInvalid: out.rejected,
    shortfall: Math.max(0, out.requested - out.questions.length),
    rejected: out.rejected,
    attempts: out.attempts,
    ms,
    promptHash,
    promptChars: prompt.length,
    questions: out.questions,
    audits,
  });

  console.log(
    `✓ ${section.padEnd(10)} ${out.questions.length}/${out.requested} асуулт · ${out.rejected} татгалзсан · ${out.attempts} оролдлого · ${ms} ms${flagged.length ? ` · ⚠ ${flagged.length} анхааруулга` : ""}`,
  );
}

const passed = results.filter((r) => r.ok);
const failed = results.filter((r) => !r.ok);
const totalQuestions = passed.reduce((n, r) => n + r.returned, 0);
const avgMs = passed.length ? Math.round(passed.reduce((n, r) => n + r.ms, 0) / passed.length) : 0;
const totalRejected = passed.reduce((n, r) => n + r.schemaInvalid, 0);

console.log(`\nModel: ${passed[0]?.model ?? process.env.GEMINI_MODEL ?? DEFAULT_MODEL} · ${LEVEL} · ${totalQuestions} асуулт · дундаж ${avgMs} ms`);
console.log(`Хэсэг: ${passed.length}/${SECTIONS.length} амжилттай · ${totalRejected} асуулт валидаторт хасагдсан`);
if (STUB) console.log("⚠ STUB горим: эдгээр асуулт нь ХЭЛНИЙ ЧАНАРЫН дээж БИШ — зөвхөн pipeline шалгалт.");

mkdirSync(path.join(ROOT, "artifacts"), { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const file = path.join(ROOT, "artifacts", `${STUB ? "ai-bench-stub" : "ai-verify"}-${stamp}.json`);
writeFileSync(
  file,
  JSON.stringify(
    {
      mode: STUB ? "stub" : "live",
      stub: STUB,
      level: LEVEL,
      count: COUNT,
      sections: SECTIONS,
      at: new Date().toISOString(),
      gitCommit: gitCommit(),
      model: passed[0]?.model ?? process.env.GEMINI_MODEL ?? DEFAULT_MODEL,
      promptVersion,
      generationConfig: {
        responseMimeType: GENERATION_CONFIG.responseMimeType,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        responseSchema: "inline QUESTION_SCHEMA (server/generate.ts)",
        samplingParams: "none (temperature/topP/topK unsupported on 3.6+)",
      },
      totals: {
        requested: COUNT * SECTIONS.length,
        returned: totalQuestions,
        schemaInvalid: totalRejected,
        failedSections: failed.length,
        avgMs,
      },
      results,
    },
    null,
    2,
  ),
);
console.log(`Тайлан: ${path.relative(ROOT, file)}`);

if (failed.length) {
  console.error(`\n✗ ${failed.length} хэсэг амжилтгүй — дээрх мессежийг шалгана уу.`);
  process.exit(2);
}
console.log("\n✓ Gemini шалгалт бүрэн давлаа." + (STUB ? " (STUB — бодит API дуудагдаагүй)" : ""));
