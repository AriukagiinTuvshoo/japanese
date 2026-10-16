import taxonomy from "../../content/categories/taxonomy.json";
import overrides from "../../content/categories/overrides.json";
import type { Language } from "./i18n";
import type { Kanji, Vocab } from "./types";

export type Topic = string;
export const topicLabel: Record<Language, Record<Topic, string>> = {
  mn: Object.fromEntries(taxonomy.groups.map(g => [g.id, g.mn])),
  en: Object.fromEntries(taxonomy.groups.map(g => [g.id, g.en])),
};
const rules = taxonomy.groups.map(g => ({ id: g.id, rule: new RegExp(g.pattern, "i") }));
/** Multi-label suggestions. Unmatched entries stay unclassified for the release audit. */
export function entryTopics(entry: Vocab | Kanji): Topic[] {
  const kind = "k" in entry ? "kanji" : "vocab";
  const key = "k" in entry ? entry.k : entry.id;
  const explicit = (overrides[kind] as Record<string, string[]>)[key];
  if (explicit) return explicit;
  const topics = rules.filter(g => g.rule.test(entry.en.join("; "))).map(g => g.id);
  if ("t" in entry) {
    if (entry.t === "v") topics.push("actions");
    if (["adj", "i", "na"].includes(entry.t)) topics.push("descriptions");
    if (entry.t === "ctr") topics.push("quantity");
  }
  return [...new Set(topics)];
}
