#!/usr/bin/env node
/**
 * Хүний хяналтын **файлд суурилсан** workflow (Milestone C4).
 * ------------------------------------------------------------
 * Яагаад файл, UI биш: браузер репозиторийн файлыг бичих боломжгүй, мөн энэ
 * репод `server/` (backend) **байхгүй** тул Admin-ийн Approve/Reject товчнууд
 * `/api/admin/*` руу дуудаж алдаа өгдөг. Тиймээс шийдвэр бүр Git-д хадгалагдаж,
 * diff-ээр хянагдана, CI (`content:qa`) баталгаажуулна.
 *
 *   АЖИЛЛАХ АЛХАМ (reviewer):
 *   1) npm run review:queue        → content/review/QUEUE.md шинэчлэнэ
 *   2) QUEUE.md-г уншиж, шийдвэрээ авна
 *   3) npm run review:mark -- <kind> <key> --action=approve|revise|reject \
 *                              --reviewer="<нэр>" [--note="..."] [--mn="..."]
 *   4) git diff content/review/decisions.json   → шийдвэрийг хянах/коммит
 *   5) npm run content:qa          → шалгалт 0 алдаа байх ёстой
 *
 * ДҮРЭМ:
 *  · `--reviewer` ЗААВАЛ — хүнгүйгээр шийдвэр үүсдэггүй, "curated" хэзээ ч
 *    нотолгоогүйгээр тавигдахгүй.
 *  · action: approve (батлах) / revise (засвар санал) / reject (татгалзах).
 *  · Шийдвэрийн файл: content/review/decisions.json
 *      "<kind>:<key>": { "action", "reviewer", "at", "note"?, "mn"? }
 *  · terms-ийг approve хийхэд content/mn/terms.json-ийн төлөв `curated`
 *    болох ба reviewedBy/reviewedAt бичигдэнэ (content:qa шалгана).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = process.env.REVIEW_ROOT
  ? path.resolve(process.env.REVIEW_ROOT)
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DECISIONS = path.join(ROOT, "content/review/decisions.json");
const QUEUE = path.join(ROOT, "content/review/QUEUE.md");
const TERMS = path.join(ROOT, "content/mn/terms.json");
const DATA = path.join(ROOT, "public/data");

const KINDS = ["vocab", "kanji", "grammar", "terms"];
const ACTIONS = ["approve", "revise", "reject"];
const LEVELS = ["N5", "N4", "N3", "N2", "N1"];

const readJson = (p, fallback) => {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return fallback;
  }
};
const today = () => new Date().toISOString().slice(0, 10);

function loadAll() {
  const levels = (kind) =>
    LEVELS.flatMap((l) => readJson(path.join(DATA, `${kind}/${l.toLowerCase()}.json`), []));
  return {
    vocab: levels("vocab"),
    kanji: levels("kanji"),
    grammar: levels("grammar"),
    terms: readJson(TERMS, {}),
    decisions: readJson(DECISIONS, {}),
  };
}

/** Нэг бичлэгийг хүн хянахад шаардлагатай талбаруудаар хураангуйлна. */
function summarize(kind, key, rec, decisions) {
  const decision = decisions[`${kind}:${key}`] ?? null;
  if (kind === "vocab") {
    return {
      id: key,
      level: rec.lvl,
      type: "үг",
      jp: `${rec.w}（${rec.r}）`,
      mn: (rec.mn ?? []).join(" / ") || "—",
      source: `${rec.src ?? "?"}#${rec.sid ?? "?"}`,
      status: rec.mq,
      decision,
      note: (rec.en ?? []).join("; "),
    };
  }
  if (kind === "kanji") {
    return {
      id: key,
      level: rec.lvl,
      type: "ханз",
      jp: `${rec.k}（${(rec.on ?? []).join("/") || "?"} · ${(rec.kun ?? []).join("/") || "?"}）`,
      mn: (rec.mn ?? []).join(" / ") || "—",
      source: `${rec.src ?? "?"}#${rec.sid ?? "?"}`,
      status: rec.mq,
      decision,
      note: (rec.en ?? []).join("; "),
    };
  }
  if (kind === "grammar") {
    return {
      id: key,
      level: rec.lvl,
      type: "дүрэм",
      jp: rec.p ?? key,
      mn: rec.mn ?? "—",
      source: rec.src ?? "?",
      status: rec.mn ? "mn байгаа" : "мn алга",
      decision,
      note: Array.isArray(rec.en) ? rec.en.join("; ") : String(rec.en ?? ""),
    };
  }
  return {
    id: key,
    level: "—",
    type: "нэр томьёо",
    jp: `${rec.ja} → ${rec.mn}`,
    mn: rec.mn,
    source: rec.source ?? "?",
    status: rec.status ?? "?",
    decision,
    note: rec.note ?? "",
  };
}

/* ── queue ───────────────────────────────────────────────────────────────── */
export function cmdQueue(args) {
  const opt = Object.fromEntries(args.filter((a) => a.startsWith("--")).map((a) => a.split("=")));
  const limit = Number(opt["--limit"] ?? 50);
  const kindFilter = opt["--kind"];
  const levelFilter = opt["--level"];
  const d = loadAll();

  const unreviewed = (kind, records) =>
    records.filter((r) => (kind === "vocab" || kind === "kanji" ? r.mq === "auto" || r.mq === "draft" : !r.mn));

  const out = [];
  out.push("# Хүний хяналтын дараалал (QUEUE)");
  out.push("");
  out.push(`Үүсгэсэн: **${today()}** · \`${path.relative(ROOT, fileURLToPath(import.meta.url))}\` · шинэчлэх: \`npm run review:queue\``);
  out.push("");
  out.push("> Энэ файл **машин үүсгэнэ** — гар аргаар бүү зас. Шийдвэрийг доорх");
  out.push("> `review:mark` командаар бичнэ; тэр нь `content/review/decisions.json`-д");
  out.push("> бичигдэж, `git diff`-ээр хянагдана. **`curated` төлөв зөвхөн хүн");
  out.push("> баталгаажуулсны дараа** (`content:qa` нотолгоогүйгээр устгана/эсэргүүцнэ).");
  out.push("");
  out.push("## Төлөвийн хуваарилалт (нийт)");
  out.push("");
  out.push("| Хэв | Нийт | curated | draft | auto | Хүн хянаагүй |");
  out.push("|---|---:|---:|---:|---:|---:|");
  for (const kind of ["vocab", "kanji"]) {
    const recs = d[kind];
    const c = (mq) => recs.filter((r) => r.mq === mq).length;
    out.push(`| ${kind} | ${recs.length} | ${c("curated")} | ${c("draft")} | ${c("auto")} | ${recs.length - c("curated")} |`);
  }
  out.push(`| grammar | ${d.grammar.length} | — | — | — | ${d.grammar.filter((g) => !g.mn).length} мn-гүй |`);
  out.push(`| terms | ${Object.keys(d.terms).length} | ${Object.values(d.terms).filter((t) => t?.status === "curated").length} | ${Object.values(d.terms).filter((t) => t?.status === "draft").length} | — | ${Object.values(d.terms).filter((t) => t?.status === "needs_review").length} needs_review |`);
  out.push("");

  const section = (title, kind, rows) => {
    if (!rows.length) return;
    out.push(`## ${title}`);
    out.push("");
    out.push("| Ключ | Түвшин | Төрөл | Япон | Монгол | Эх сурвалж | Төлөв | Тайлбар |");
    out.push("|---|---|---|---|---|---|---|---|");
    for (const r of rows) {
      const esc = (s) => String(s).replace(/\|/g, "\\|").replace(/\n/g, " ");
      const dec = r.decision ? ` **[${r.decision.action}]** ${r.decision.reviewer}` : "";
      out.push(`| \`${esc(r.id)}\` | ${r.level} | ${r.type} | ${esc(r.jp)} | ${esc(r.mn)} | ${esc(r.source)} | ${esc(r.status)}${dec} | ${esc(r.note)} |`);
    }
    out.push("");
    void kind;
  };

  const termsNeeding = Object.entries(d.terms)
    .filter(([, t]) => t && typeof t === "object" && t.status !== "curated")
    .map(([k, t]) => summarize("terms", k, t, d.decisions));
  section("Нэр томьёо (terms) — хүлээгдэж буй шийдвэр", "terms", termsNeeding);

  for (const kind of ["vocab", "kanji", "grammar"]) {
    if (kindFilter && kindFilter !== kind) continue;
    const recs = unreviewed(kind, d[kind])
      .filter((r) => !levelFilter || (r.lvl ?? "N5") === levelFilter)
      .slice(0, limit)
      .map((r) => {
        const key = kind === "vocab" ? `${r.w}|${r.r}` : kind === "kanji" ? r.k : r.p;
        return summarize(kind, key, r, d.decisions);
      });
    section(`${kind[0].toUpperCase()}${kind.slice(1)} — хүн хянаагүй (доорх ${limit} нь жишээ)`, kind, recs);
  }

  const decided = Object.entries(d.decisions);
  out.push("## Бүртгэгдсэн шийдвэрүүд");
  out.push("");
  if (!decided.length) {
    out.push("_Одоогоор шийдвэр бүртгэгдээгүй._");
  } else {
    out.push("| Ключ | Үйлдэл | Reviewer | Огноо | Тэмдэглэл |");
    out.push("|---|---|---|---|---|");
    for (const [k, v] of decided.sort()) out.push(`| \`${k}\` | ${v.action} | ${v.reviewer} | ${v.at} | ${(v.note ?? "").replace(/\|/g, "\\|")} |`);
  }
  out.push("");
  out.push("## Дараагийн алхам");
  out.push("");
  out.push("```bash");
  out.push("npm run review:mark -- terms particle --action=approve --reviewer=\"<нэр>\"");
  out.push("git diff content/review/decisions.json content/mn/terms.json");
  out.push("npm run content:qa");
  out.push("```");
  out.push("");

  fs.mkdirSync(path.dirname(QUEUE), { recursive: true });
  fs.writeFileSync(QUEUE, out.join("\n"), "utf8");
  console.log(`Тайлан: ${path.relative(ROOT, QUEUE)}`);
  console.log(`  нэр томьёо хүлээгдэж буй: ${termsNeeding.length} · шийдвэр бүртгэгдсэн: ${decided.length}`);
  return 0;
}

/* ── status ──────────────────────────────────────────────────────────────── */
export function cmdStatus() {
  const d = loadAll();
  const byAction = {};
  for (const v of Object.values(d.decisions)) byAction[v.action] = (byAction[v.action] ?? 0) + 1;
  console.log(`Шийдвэр: ${Object.keys(d.decisions).length} (${Object.entries(byAction).map(([k, v]) => `${k}=${v}`).join(" ") || "—"})`);
  console.log(`terms: ${Object.keys(d.terms).length} нийт · curated=${Object.values(d.terms).filter((t) => t?.status === "curated").length} · needs_review=${Object.values(d.terms).filter((t) => t?.status === "needs_review").length}`);
  for (const kind of ["vocab", "kanji", "grammar"]) {
    const recs = d[kind];
    const cur = kind === "grammar" ? 0 : recs.filter((r) => r.mq === "curated").length;
    console.log(`${kind}: ${recs.length} нийт · curated=${cur}`);
  }
  return 0;
}

/* ── mark ────────────────────────────────────────────────────────────────── */
function parseMarkArgs(argv) {
  const positional = [];
  const flags = {};
  for (const a of argv) {
    if (a.startsWith("--")) {
      const [k, ...rest] = a.split("=");
      flags[k] = rest.join("=");
    } else positional.push(a);
  }
  return { positional, flags };
}

export function cmdMark(argv) {
  const { positional, flags } = parseMarkArgs(argv);
  const [kind, key] = positional;
  const action = flags["--action"];
  const reviewer = flags["--reviewer"]?.trim();
  const note = flags["--note"];
  const mn = flags["--mn"];

  if (!KINDS.includes(kind)) return fail(`kind буруу (${KINDS.join(" | ")})`);
  if (!key) return fail("key заавал (жнь: `terms particle`, `vocab 学校|がっこう`, `kanji 学`)");
  if (!ACTIONS.includes(action)) return fail(`--action буруу (${ACTIONS.join(" | ")})`);
  if (!reviewer) return fail("--reviewer заавал: хүнгүйгээр шийдвэр үүсдэггүй (curated нотолгоогүй тавигдахгүй)");

  const d = loadAll();

  // түлхүүр байх ёстой — байхгүй бол шийдвэрийг чимээгүй бүү үүсгэ
  if (kind === "terms") {
    if (!d.terms[key]) return fail(`terms тольд "${key}" олдсонгүй`);
  } else {
    const found = d[kind].some((r) => (kind === "vocab" ? `${r.w}|${r.r}` : kind === "kanji" ? r.k : r.p) === key);
    if (!found) return fail(`${kind} дээр "${key}" олдсонгүй`);
  }

  const ledgerKey = `${kind}:${key}`;
  const decision = { action, reviewer, at: today() };
  if (note) decision.note = note;
  if (mn) decision.mn = mn;

  const before = { ...(d.decisions[ledgerKey] ?? null) };
  d.decisions[ledgerKey] = decision;
  const sorted = Object.fromEntries(Object.entries(d.decisions).sort(([a], [b]) => (a < b ? -1 : 1)));
  fs.mkdirSync(path.dirname(DECISIONS), { recursive: true });
  fs.writeFileSync(DECISIONS, `${JSON.stringify(sorted, null, 2)}\n`, "utf8");

  let termsChanged = false;
  if (kind === "terms" && action === "approve") {
    // баталгаажуулалт нь толь дээр шууд харагдана: status → curated + хэн хянасан
    const entry = d.terms[key];
    entry.status = "curated";
    entry.reviewedBy = reviewer;
    entry.reviewedAt = decision.at;
    if (mn) entry.mn = mn;
    fs.writeFileSync(TERMS, `${JSON.stringify(d.terms, null, 2)}\n`, "utf8");
    termsChanged = true;
  }

  console.log(`✓ ${ledgerKey}: ${action} (${reviewer}, ${decision.at})`);
  if (Object.keys(before).length) console.log(`  (өмнөх шийдвэр: ${before.action} ${before.reviewer})`);
  if (termsChanged) console.log("  content/mn/terms.json: status → curated (reviewedBy/reviewedAt бичигдлээ)");
  console.log(`Дараа: git diff content/review/ ${termsChanged ? "content/mn/terms.json " : ""}&& npm run content:qa`);
  return 0;
}

function fail(msg) {
  console.error(`✗ ${msg}`);
  return 1;
}

/* ── main ────────────────────────────────────────────────────────────────── */
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const [cmd = "queue", ...rest] = process.argv.slice(2);
  const code = cmd === "queue" ? cmdQueue(rest) : cmd === "mark" ? cmdMark(rest) : cmd === "status" ? cmdStatus() : fail(`танигдаагүй команда: ${cmd} (queue | mark | status)`);
  process.exit(code);
}
