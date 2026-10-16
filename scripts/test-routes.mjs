/**
 * Regression test: hash route → detail page resolution.
 *
 * Bug (PR #10): App.tsx read the detail id from params[1], but href() emits
 * `#/grammar/<id>` (id = params[0]). So every card click on a list page
 * (grammar, vocab, kanji, reading, listening) fell back to the list page.
 *
 * Imports src/lib/routes.ts (pure, no React) via the TypeScript transpiler,
 * so it runs under plain Node without a bundler.
 *
 * Run: node scripts/test-routes.mjs
 */
import { readFileSync } from "node:fs";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const src = readFileSync("src/lib/routes.ts", "utf-8");
const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
const dir = mkdtempSync(join(tmpdir(), "routes-test-"));
const file = join(dir, "routes.mjs");
writeFileSync(file, js);
const { parseHash, href, routeArg, routeLevel } = await import(pathToFileURL(file).href);
rmSync(dir, { recursive: true, force: true });

let failures = 0;
const check = (label, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? "✓" : "✗"} ${label}${ok ? "" : `\n    expected ${JSON.stringify(expected)}\n    actual   ${JSON.stringify(actual)}`}`);
};

// 1. The live card-click URL must resolve to the N2 detail id.
const liveRoute = parseHash("#/grammar/ni-saishite");
check("#/grammar/ni-saishite → arg is ni-saishite", routeArg(liveRoute), "ni-saishite");
check("#/grammar/ni-saishite → name grammar", liveRoute.name, "grammar");

// 2. Level is carried in the query and parsed.
const withLevel = parseHash("#/grammar/ni-saishite?level=N2");
check("#/grammar/ni-saishite?level=N2 → arg", routeArg(withLevel), "ni-saishite");
check("#/grammar/ni-saishite?level=N2 → level N2", routeLevel(withLevel), "N2");
check("lowercase level=n2 normalised", routeLevel(parseHash("#/grammar/x?level=n2")), "N2");
check("invalid level ignored", routeLevel(parseHash("#/grammar/x?level=N9")), undefined);

// 3. List pages have no detail arg (must still show the list).
check("#/grammar → no arg (list)", routeArg(parseHash("#/grammar")), undefined);
check("#/grammar?level=N2 → no arg (list)", routeArg(parseHash("#/grammar?level=N2")), undefined);
check("#/grammar?level=N2 → level N2", routeLevel(parseHash("#/grammar?level=N2")), "N2");

// 4. Other detail routes use the same first-segment argument.
check("#/vocab/ada066edfd → arg", routeArg(parseHash("#/vocab/ada066edfd")), "ada066edfd");
check("#/kanji/%E6%97%A5 → decoded arg", routeArg(parseHash("#/kanji/%E6%97%A5")), "日");
check("#/write/%E6%97%A5 → decoded arg", routeArg(parseHash("#/write/%E6%97%A5")), "日");
check("#/reading/r1 → arg", routeArg(parseHash("#/reading/r1")), "r1");
check("#/listening/l1 → arg", routeArg(parseHash("#/listening/l1")), "l1");
check("#/admin/content → arg is tab", routeArg(parseHash("#/admin/content")), "content");

// 5. href() ↔ parseHash() round-trip, incl. level query.
const link = href("grammar?level=N2", "ni-saishite");
check("href grammar with level", link, "#/grammar/ni-saishite?level=N2");
const back = parseHash(link);
check("round-trip name", back.name, "grammar");
check("round-trip arg", routeArg(back), "ni-saishite");
check("round-trip level", routeLevel(back), "N2");
check("href without level", href("grammar", "ni-saishite"), "#/grammar/ni-saishite");

// 6. Legacy encoded query form still parses.
const legacy = parseHash("#/grammar%3Flevel%3DN2");
check("legacy %3F form → name grammar", legacy.name, "grammar");
check("legacy %3F form → level N2", routeLevel(legacy), "N2");

// 7. The arg must be a real N2 grammar id (data-level guard).
const n2 = JSON.parse(readFileSync("public/data/grammar/n2.json", "utf-8"));
check("ni-saishite exists in N2 data", n2.some((g) => g.id === routeArg(liveRoute)), true);

if (failures) {
  console.error(`\n❌ ${failures} route check(s) failed`);
  process.exit(1);
}
console.log("\n✅ All route regression tests passed.");
