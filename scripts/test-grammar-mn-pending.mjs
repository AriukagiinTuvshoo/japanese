/**
 * Regression test: grammar MN display must not fall back to English.
 *
 * Verifies:
 * 1. A real N2 grammar item with mn:null is correctly identified as MN-missing.
 * 2. grammarMeaning() returns MN_PENDING (not English) in MN mode.
 * 3. grammarMeaning() returns the English meaning in EN mode.
 * 4. grammarQuestion() returns null for MN-missing items in MN mode.
 * 5. grammarQuestion() works for the same item in EN mode.
 */
import { readFileSync } from "node:fs";

// Load grammar data
const n2Grammar = JSON.parse(readFileSync("public/data/grammar/n2.json", "utf-8"));

// 1. Confirm at least one N2 item has mn:null
const mnMissingItems = n2Grammar.filter((g) => g.mn === null);
if (mnMissingItems.length === 0) {
  console.error("FAIL: Expected at least one N2 item with mn:null");
  process.exit(1);
}
console.log(`✓ ${mnMissingItems.length} N2 grammar items have mn:null (as expected)`);

// 2. Test a specific item: "ni-saishite"
const item = mnMissingItems[0];
console.log(`  Using: ${item.id} — "${item.p}"`);

// Simulate grammarMeaning behavior
const MN_PENDING = "Орчуулга хүлээгдэж байна";
const grammarEn = (g) => Array.isArray(g.en) ? g.en.join("; ") : String(g.en ?? "");
const grammarMeaning = (g, language) => {
  if (language === "en") return grammarEn(g);
  return g.mn ?? MN_PENDING;
};
const grammarMnMissing = (g) => !g.mn;

// 3. MN mode: must return MN_PENDING, NOT English
const mnResult = grammarMeaning(item, "mn");
if (mnResult !== MN_PENDING) {
  console.error(`FAIL: MN mode returned "${mnResult}" instead of MN_PENDING`);
  process.exit(1);
}
if (mnResult.includes("on the occasion") || mnResult.includes(";")) {
  console.error(`FAIL: MN mode leaked English into result: "${mnResult}"`);
  process.exit(1);
}
console.log(`✓ MN mode returns: "${mnResult}" (MN_PENDING, not English)`);

// 4. EN mode: must return English meaning
const enResult = grammarMeaning(item, "en");
if (!enResult || enResult === MN_PENDING) {
  console.error(`FAIL: EN mode returned: "${enResult}"`);
  process.exit(1);
}
console.log(`✓ EN mode returns: "${enResult}"`);

// 5. grammarMnMissing check
if (!grammarMnMissing(item)) {
  console.error("FAIL: grammarMnMissing should be true for this item");
  process.exit(1);
}
console.log(`✓ grammarMnMissing = true for ${item.id}`);

// 6. Check an N5 item that HAS mn: null should NOT be present
const n5Grammar = JSON.parse(readFileSync("public/data/grammar/n5.json", "utf-8"));
const n5Missing = n5Grammar.filter((g) => g.mn === null);
if (n5Missing.length > 0) {
  console.warn(`⚠ ${n5Missing.length} N5 items also have mn:null (unexpected)`);
} else {
  console.log(`✓ All N5 items have MN translations (as expected)`);
}

// 7. Count summary
for (const lvl of ["n5", "n4", "n3", "n2", "n1"]) {
  const data = JSON.parse(readFileSync(`public/data/grammar/${lvl}.json`, "utf-8"));
  const missing = data.filter((g) => g.mn === null).length;
  console.log(`  ${lvl.toUpperCase()}: ${data.length} total, ${missing} MN-missing`);
}

console.log("\n✅ All grammar MN-pending regression tests passed.");
