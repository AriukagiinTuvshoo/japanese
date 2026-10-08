import fs from "node:fs";
import { pathToFileURL } from "node:url";

const read = p => JSON.parse(fs.readFileSync(p, "utf8"));
export const validMn = value => typeof value === "string" && value.trim().length > 0 && /[А-Яа-яӨөҮү]/.test(value) && !/pending|placeholder|TODO|TBD|хүлээгдэж|орчуулга байхгүй/i.test(value);
const validMeaning = e => Array.isArray(e.mn) ? e.mn.length > 0 && e.mn.every(validMn) : validMn(e.mn);
export function topicsFor(entry, kind, taxonomy, overrides) {
  const explicit = overrides[kind]?.[kind === "kanji" ? entry.k : entry.id];
  if (explicit) return explicit;
  const topics = taxonomy.groups.filter(g => new RegExp(g.pattern, "i").test(entry.en.join("; "))).map(g => g.id);
  if (kind === "vocab") {
    if (entry.t === "v") topics.push("actions");
    if (["adj", "i", "na"].includes(entry.t)) topics.push("descriptions");
    if (entry.t === "ctr") topics.push("quantity");
  }
  return [...new Set(topics)];
}

export function auditCoverage() {
  const taxonomy = read("content/categories/taxonomy.json");
  const overrides = read("content/categories/overrides.json");
  const provenance = new Set(read("public/data/index/translations.json").map(p => p.id));
  const groupIds = new Set(taxonomy.groups.map(g => g.id));
  const issues = [];
  const byLevel = {};
  const totals = { missingMeanings: 0, missingExamples: 0, missingForms: 0, unclassified: 0, invalidCategories: 0, missingProvenance: 0, mislabeledMn: 0, unresolvedSourceIssues: 0 };
  for (const level of ["N5", "N4", "N3", "N2", "N1"]) {
    byLevel[level] = {};
    for (const kind of ["vocab", "kanji", "grammar"]) {
      const entries = read(`public/data/${kind}/${level.toLowerCase()}.json`);
      const counts = { entries: entries.length, missingMeanings: 0, missingExamples: 0, missingForms: 0, unclassified: 0, invalidCategories: 0, missingProvenance: 0, mislabeledMn: 0, unresolvedSourceIssues: 0 };
      for (const e of entries) {
        const id = kind === "kanji" ? e.k : e.id;
        const issue = (field, detail) => { counts[field]++; totals[field]++; issues.push({ kind, level, id, field, detail }); };
        if (e.source_issue) issue("unresolvedSourceIssues", e.source_issue);
        if (!validMeaning(e)) issue("missingMeanings", "Missing, invalid or placeholder Mongolian meaning");
        if (validMeaning(e) && (!e.mn_provenance || !provenance.has(e.mn_provenance))) issue("missingProvenance", "Translation has no maintained batch provenance");
        for (const [i, example] of (e.ex ?? []).entries()) {
          if (example.en && !validMn(example.mn)) issue("missingExamples", `ex[${i}]`);
        }
        if (kind === "grammar" && e.form && /[A-Za-z]/.test(e.form) && !validMn(e.form_mn)) issue("missingForms", "English formation explanation has no Mongolian version");
        if (kind !== "grammar") {
          const topics = topicsFor(e, kind, taxonomy, overrides);
          if (!topics.length) issue("unclassified", "No topic group; no catch-all assignment is accepted");
          if (topics.some(t => !groupIds.has(t)) || new Set(topics).size !== topics.length) issue("invalidCategories", topics);
        }
        if (Array.isArray(e.mn) && e.mn.some(m => !validMn(m))) issue("mislabeledMn", "Non-Mongolian meaning in mn field");
        for (const w of kind === "kanji" ? e.w ?? [] : []) if (w.mn && !validMn(w.mn)) issue("mislabeledMn", `Related word ${w.w}|${w.r}`);
      }
      byLevel[level][kind] = counts;
    }
  }
  return { schemaVersion: 1, byLevel, totals, issues };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const report = auditCoverage();
  for (const [level, kinds] of Object.entries(report.byLevel)) for (const [kind, count] of Object.entries(kinds)) console.log(`${level} ${kind}: ${count.missingMeanings}/${count.entries} meanings missing; ${count.missingExamples} examples; ${count.missingForms} forms; ${count.unclassified} unclassified`);
  console.log("Totals:", report.totals);
  if (process.argv.includes("--write")) {
    fs.writeFileSync("content/coverage-report.json", JSON.stringify({ ...report, issues: undefined }, null, 2) + "\n");
    fs.mkdirSync(".cache", { recursive: true });
    fs.writeFileSync(".cache/coverage-issues.json", JSON.stringify(report.issues, null, 2));
  }
  const incomplete = Object.values(report.totals).some(n => n > 0);
  console.log(incomplete ? "INCOMPLETE — release blocked" : "Complete structural coverage (semantic review still required)");
  process.exitCode = incomplete && !process.argv.includes("--report") ? 1 : 0;
}
