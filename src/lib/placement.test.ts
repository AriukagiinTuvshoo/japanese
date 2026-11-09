import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { seeded } from "./data";
import { buildPlacementQuestions, type PlacementData } from "./placement";
import type { Grammar, Kanji, Level, Vocab } from "./types";

const LEVELS: Level[] = ["N5", "N4", "N3", "N2", "N1"];
const load = <T>(path: string): T => JSON.parse(readFileSync(path, "utf8")) as T;

const realData: PlacementData = {
  vocabByLevel: Object.fromEntries(LEVELS.map((level) => [level, load<Vocab[]>(`public/data/vocab/${level.toLowerCase()}.json`)])),
  kanjiByLevel: Object.fromEntries(LEVELS.map((level) => [level, load<Kanji[]>(`public/data/kanji/${level.toLowerCase()}.json`)])),
  grammarByLevel: Object.fromEntries(LEVELS.map((level) => [level, load<Grammar[]>(`public/data/grammar/${level.toLowerCase()}.json`)])),
} as PlacementData;

const emptyData = (): PlacementData => ({
  vocabByLevel: { N5: [], N4: [], N3: [], N2: [], N1: [] },
  kanjiByLevel: { N5: [], N4: [], N3: [], N2: [], N1: [] },
  grammarByLevel: { N5: [], N4: [], N3: [], N2: [], N1: [] },
});

const vocab = (id: string, mn: string[] | null, en: string[]): Vocab => ({
  id, w: id, r: id, rm: id, en, mn, mq: "draft", lvl: "N5", tier: "jlpt",
  pos: [], t: "n", kd: [], src: "test", sid: id, ex: [],
}) as Vocab;

const kanji = (k: string, mn: string[], en: string[]): Kanji => ({
  k, lvl: "N5", lvlSrc: "jlpt", s: 1, g: 1, f: 1, en, mn, mq: "draft",
  on: [], kun: [], rad: null, w: [], mn_mem: null, src: "test", sid: k,
}) as Kanji;

const grammar = (id: string, mn: string | null, en: string[]): Grammar => ({
  id, p: id, lvl: "N5", en, mn, note: null, form: null, jlpt: "N5",
  ex: [], related: [], src: "test",
}) as Grammar;

describe("placement questions stay in the selected language", () => {
  it("builds a full, structurally valid MN test from real data", () => {
    const qs = buildPlacementQuestions(realData, "mn", seeded(7));
    expect(qs.length).toBeGreaterThan(0);
    expect(qs.length).toBeLessThanOrEqual(45);
    for (const q of qs) {
      expect(q.options).toHaveLength(4);
      expect(new Set(q.options).size).toBe(4);
      expect(q.options.every((o) => o.trim().length > 0)).toBe(true);
      expect(q.answer).toBeGreaterThanOrEqual(0);
      expect(q.answer).toBeLessThan(q.options.length);
      expect(q.options[q.answer]).toBeTruthy();
    }
  });

  it("never uses an untranslated vocabulary distractor in MN mode", () => {
    const data = emptyData();
    data.vocabByLevel.N5 = [
      ...Array.from({ length: 6 }, (_, i) => vocab(`v${i}`, [`утга ${i}`], [`meaning ${i}`])),
      vocab("untranslated", null, ["chopping board"]),
    ];
    const qs = buildPlacementQuestions(data, "mn", seeded(11));
    expect(qs.length).toBeGreaterThan(0);
    for (const q of qs) {
      expect(q.options).not.toContain("chopping board");
      expect(q.prompt).not.toBe("untranslated");
    }
  });

  it("skips untranslated kanji instead of using their English meaning", () => {
    const data = emptyData();
    data.kanjiByLevel.N5 = [
      ...Array.from({ length: 5 }, (_, i) => kanji(`k${i}`, [`утга ${i}`], [`meaning ${i}`])),
      kanji("bad", [], ["English kanji"]),
    ];
    const qs = buildPlacementQuestions(data, "mn", seeded(12));
    expect(qs.length).toBeGreaterThan(0);
    for (const q of qs) expect(q.options).not.toContain("English kanji");
  });

  it("skips untranslated grammar instead of using its English meaning", () => {
    const data = emptyData();
    data.grammarByLevel.N5 = [
      ...Array.from({ length: 4 }, (_, i) => grammar(`g${i}`, `утга ${i}`, [`meaning ${i}`])),
      grammar("bad", null, ["English grammar"]),
    ];
    const qs = buildPlacementQuestions(data, "mn", seeded(13));
    expect(qs.length).toBeGreaterThan(0);
    for (const q of qs) expect(q.options).not.toContain("English grammar");
  });

  it("keeps EN mode English when English data exists", () => {
    const data = emptyData();
    data.vocabByLevel.N5 = Array.from({ length: 6 }, (_, i) => vocab(`e${i}`, [`утга ${i}`], [`meaning ${i}`]));
    const qs = buildPlacementQuestions(data, "en", seeded(14));
    expect(qs.length).toBeGreaterThan(0);
    for (const q of qs) expect(q.options.every((o) => o.startsWith("meaning "))).toBe(true);
  });
});
