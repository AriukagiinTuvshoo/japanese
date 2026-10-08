import fs from "node:fs";
import assert from "node:assert/strict";

const read = p => JSON.parse(fs.readFileSync(p, "utf8"));
const write = (p, value) => fs.writeFileSync(p, JSON.stringify(value, null, p.endsWith("-draft.json") ? 1 : p.endsWith("meta.json") ? 2 : undefined) + "\n");
const levels = ["n5", "n4", "n3", "n2", "n1"];
const batches = fs.readdirSync("content/mn/batches").filter(f => f.endsWith(".json")).sort().map(f => read(`content/mn/batches/${f}`));
const provenance = batches.map(b => b.provenance);
const data = Object.fromEntries(["vocab", "kanji", "grammar"].map(kind => [kind, Object.fromEntries(levels.map(l => [l, read(`public/data/${kind}/${l}.json`)]))]));
let applied = 0;
const categoryOverrides = read("content/categories/overrides.json");
for (const batch of batches) {
  assert.equal(batch.provenance.license, "CC-BY-SA-4.0");
  assert.ok(batch.provenance.source && batch.provenance.sourceSnapshot && batch.provenance.method);
  for (const kind of ["vocab", "kanji", "grammar"]) {
    const entries = Object.values(data[kind]).flat();
    for (const [id, translation] of Object.entries(batch[kind] ?? {})) {
      const entry = entries.find(e => (kind === "kanji" ? e.k : e.id) === id);
      assert.ok(entry, `Unknown ${kind} key ${id}`);
      if (translation.expected) for (const [field, expected] of Object.entries(translation.expected)) {
        assert.deepEqual(entry[field], expected, `Source mismatch ${kind}/${id}/${field}`);
      }
      // Withdraw a demonstrably conflicting derived sense without deleting its audit trail.
      if (translation.withdrawnMn) {
        assert.ok(translation.sourceNote && translation.expected, `Withdrawal requires guarded source issue: ${id}`);
        assert.equal(translation.mn, undefined, `Withdrawn sense must not also be applied: ${id}`);
        assert.ok(Array.isArray(translation.withdrawnMn) && translation.withdrawnMn.length);
        entry.mn = kind === "grammar" ? "" : [];
        delete entry.mn_provenance;
        entry.mq = "none";
        if (kind !== "grammar") delete categoryOverrides[kind][id];
      }
      const meanings = Array.isArray(translation.mn) ? translation.mn : [translation.mn];
      if (translation.mn !== undefined) {
        assert.ok(meanings.length && meanings.every(m => typeof m === "string" && /[А-Яа-яӨөҮү]/.test(m)), `Invalid MN: ${kind}/${id}`);
        entry.mn = kind === "grammar" ? meanings.join("; ") : meanings;
        entry.mn_provenance = batch.provenance.id;
        if (kind !== "grammar") entry.mq = "draft";
      }
      if (translation.topics) {
        assert.ok(kind !== "grammar" && Array.isArray(translation.topics) && translation.topics.length);
        categoryOverrides[kind][id] = translation.topics;
      }
      if (translation.sourceNote) entry.source_issue = translation.sourceNote;
      if (translation.note) {entry.note = translation.note; entry.note_provenance = batch.provenance.id;}
      if (translation.noteEn) entry.note_en = translation.noteEn;
      if (translation.formMn) {entry.form_mn = translation.formMn; entry.form_mn_provenance = batch.provenance.id;}
      assert.ok(!Array.isArray(translation.examples), `Examples must be keyed by Japanese sentence: ${id}`);
      for (const [ja, value] of Object.entries(translation.examples ?? {})) {
        const example = entry.ex?.find(e => e.ja === ja);
        assert.ok(example, `Unknown Japanese example ${id}/${ja}`);
        const mn = typeof value === "string" ? value : value.mn;
        if (typeof value === "object") assert.equal(example.en, value.en, `Example English drift ${id}/${ja}`);
        assert.ok(/[А-Яа-яӨөҮү]/.test(mn));
        example.mn = mn;
        example.mn_provenance = batch.provenance.id;
      }
      applied++;
    }
  }
}
write("content/categories/overrides.json", categoryOverrides);
// Related words must never store English in a field called mn. Resolve by word + reading.
const words = new Map(Object.values(data.vocab).flat().map(v => [`${v.w}|${v.r}`, v]));
for (const list of Object.values(data.kanji)) for (const kanji of list) for (const word of kanji.w ?? []) {
  const v = words.get(`${word.w}|${word.r}`);
  word.en = v?.en.join("; ") ?? word.en ?? word.mn;
  word.mn = v?.mn?.join("; ") || null;
}
const drafts = { vocab: read("content/mn/vocab-draft.json"), kanji: read("content/mn/kanji-draft.json") };
for (const kind of ["vocab", "kanji"]) for (const list of Object.values(data[kind])) for (const e of list) {
  if (e.mq === "draft") drafts[kind][kind === "kanji" ? e.k : `${e.w}|${e.r}`] = e.mn.join("; ");
}
for (const kind of Object.keys(data)) for (const level of levels) write(`public/data/${kind}/${level}.json`, data[kind][level]);
for (const kind of ["vocab", "kanji"]) write(`content/mn/${kind}-draft.json`, drafts[kind]);
const index = {
  v: Object.values(data.vocab).flat().map(v => [v.w, v.r, v.mn?.[0] ?? v.en[0], v.lvl, v.tier === "jlpt" ? 0 : 1, v.id]),
  k: Object.values(data.kanji).flat().map(k => [k.k, k.on[0] ?? "", k.mn?.[0] ?? k.en[0], k.lvl, k.s ?? 0]),
  g: Object.values(data.grammar).flat().map(g => [g.p, g.mn ?? g.en, g.lvl, g.id]),
};
write("public/data/index/search.json", index);
write("public/data/index/translations.json", provenance);
const meta = read("public/data/index/meta.json");
for (const kind of ["vocab", "kanji"]) meta.counts[`${kind}Draft`] = Object.values(data[kind]).flat().filter(e => e.mq === "draft").length;
// Preserve existing sources; restore missing attribution from the documented source pipeline.
const sourceRecords = [
  { id: "openjlpt", name: "OpenJLPT — evanclan and contributors", url: "https://github.com/evanclan/OpenJLPT", license: "CC-BY-SA-4.0", note: "JLPT үг, ханз, дүрэм ба жишээ. Монгол орчуулгууд нь өөрчилсөн бүтээл; CC-BY-SA-4.0 нөхцөлтэй." },
  { id: "kanji-data", name: "kanji-data — David Luz Gouveia and contributors", url: "https://github.com/davidluzgouveia/kanji-data", license: "MIT", note: "Ханзны уншлага, утга, түвшин, давтамж." },
  { id: "kanjivg", name: "KanjiVG — Ulrich Apel and contributors", url: "https://github.com/KanjiVG/kanjivg", license: "CC-BY-SA-3.0", note: "Бичих дарааллын вектор өгөгдөл; эх лицензийг хэвээр хадгална." },
  { id: "jmdict", name: "JMdict — EDRDG contributors (jamdict-data package)", url: "https://github.com/neocl/jamdict", license: "CC-BY-SA-4.0 (dictionary); MIT (package)", note: "Өргөтгөсөн япон–англи үгийн сан. Монгол өөрчилсөн орчуулга: CC-BY-SA-4.0." },
  { id: "mn-translations", name: "Mongolian translation batches — provenance and review status", url: "https://github.com/AriukagiinTuvshoo/japanese/tree/main/content/mn", license: "CC-BY-SA-4.0", note: "Шинэ орчуулгын гарал, огноо, хяналтын төлөвийг багц бүрд бүртгэнэ. Хуучин орчуулгын зохиогч, хяналтын мэдээлэл бүрэн бус." },
];
meta.sources ??= [];
for (const source of sourceRecords) if (!meta.sources.some(s => s.id === source.id)) meta.sources.push(source);
write("public/data/index/meta.json", meta);
console.log(`Applied ${applied} translation records; preserved Japanese, English, readings and examples.`);
