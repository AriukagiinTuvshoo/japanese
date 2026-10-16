import { readFile, writeFile } from "node:fs/promises";

const content = JSON.parse(await readFile("content/mn/grammar.json", "utf8"));
const LEVELS = ["N5", "N4", "N3", "N2", "N1"];
const byId = new Map();
let applied = 0;

for (const level of LEVELS) {
  const path = `public/data/grammar/${level.toLowerCase()}.json`;
  const rules = JSON.parse(await readFile(path, "utf8"));
  for (const rule of rules) {
    const translation = content[rule.p];
    if (!translation) continue;
    if (translation.m) {
      rule.mn = translation.m;
      applied += 1;
    }
    for (const example of rule.ex ?? []) {
      if (translation.ex?.[example.ja]) example.mn = translation.ex[example.ja];
    }
    byId.set(rule.id, [rule.p, rule.mn ?? rule.en, level, rule.id]);
  }
  await writeFile(path, `${JSON.stringify(rules)}\n`, "utf8");
}

const indexPath = "public/data/index/search.json";
const index = JSON.parse(await readFile(indexPath, "utf8"));
for (const entry of index.g ?? []) {
  const translated = byId.get(entry[3]);
  if (translated) entry[1] = translated[1];
}
await writeFile(indexPath, `${JSON.stringify(index)}\n`, "utf8");
console.log(`Монгол тайлбар оруулсан дүрэм: ${applied}`);
