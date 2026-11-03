import { describe, expect, it } from "vitest";
import {
  DRAFT_KEY,
  DRAFT_VERSION,
  clearExamDraft,
  isValidExamDraft,
  readExamDraft,
  saveExamDraft,
  type ExamDraft,
} from "./examSession";
import { EXAM_BLUEPRINTS } from "./study";
import type { Question } from "./study";

class MemoryKV {
  map = new Map<string, string>();
  getItem(k: string) {
    return this.map.has(k) ? this.map.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.map.set(k, v);
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
}

const q = (id: string, answer = 1): Question => ({
  id,
  kind: "vocab",
  level: "N5",
  prompt: `q-${id}`,
  options: ["a", "b", "c", "d"],
  answer,
  section: "Үгийн сан",
});

const bp = EXAM_BLUEPRINTS.N5;

const draft = (over: Partial<ExamDraft> = {}): ExamDraft => ({
  v: DRAFT_VERSION,
  level: "N5",
  stage: "running",
  secIdx: 1,
  startedAt: 1_700_000_000_000,
  updatedAt: 1_700_000_600_000,
  sections: [
    { section: bp.sections[0], questions: [q("a"), q("b")] },
    { section: bp.sections[1], questions: [q("c"), q("d", 0)] },
  ],
  results: [{ section: bp.sections[0], correct: 1, total: 2 }],
  answers: [[1, 0], [null, 3]],
  index: [1, 1],
  ...over,
});

describe("mock exam draft", () => {
  it("round-trips the exam exactly after a reload", () => {
    const kv = new MemoryKV();
    const d = draft();
    expect(saveExamDraft(kv, d)).toBe(true);
    const back = readExamDraft(kv);
    expect(back).not.toBeNull();
    expect(back!.level).toBe("N5");
    expect(back!.stage).toBe("running");
    expect(back!.secIdx).toBe(1);
    expect(back!.startedAt).toBe(d.startedAt);
    expect(back!.sections).toHaveLength(2);
    expect(back!.sections[1].questions.map((x) => x.id)).toEqual(["c", "d"]);
    expect(back!.results).toHaveLength(1);
    expect(back!.results[0].correct).toBe(1);
    // Хариулт ба асуултын байрлал хадгалагдана — refresh хийсэн ч алдагдахгүй.
    expect(back!.answers).toEqual([[1, 0], [null, 3]]);
    expect(back!.index).toEqual([1, 1]);
  });

  it("stores the draft under one stable key", () => {
    const kv = new MemoryKV();
    saveExamDraft(kv, draft());
    expect(kv.getItem(DRAFT_KEY)).toBeTruthy();
    expect(kv.map.size).toBe(1);
  });

  it("rejects a draft written by an unknown schema version", () => {
    const kv = new MemoryKV();
    kv.setItem(DRAFT_KEY, JSON.stringify({ ...draft(), v: DRAFT_VERSION + 1 }));
    expect(isValidExamDraft({ ...draft(), v: DRAFT_VERSION + 1 })).toBe(false);
    expect(readExamDraft(kv)).toBeNull();
  });

  it("returns null for corrupt JSON and for non-object payloads", () => {
    const kv = new MemoryKV();
    kv.setItem(DRAFT_KEY, "{not json");
    expect(readExamDraft(kv)).toBeNull();
    kv.setItem(DRAFT_KEY, JSON.stringify([1, 2, 3]));
    expect(readExamDraft(kv)).toBeNull();
    kv.setItem(DRAFT_KEY, "null");
    expect(readExamDraft(kv)).toBeNull();
    expect(readExamDraft(new MemoryKV())).toBeNull();
  });

  it("rejects an unknown level, stage or a broken section list", () => {
    expect(isValidExamDraft(draft({ level: "N9" as never }))).toBe(false);
    expect(isValidExamDraft(draft({ stage: "final" as never }))).toBe(false);
    expect(isValidExamDraft(draft({ sections: [] }))).toBe(false);
    expect(isValidExamDraft(draft({ secIdx: 5 }))).toBe(false);
    expect(isValidExamDraft(draft({ results: [1, 2] as never }))).toBe(false);
  });

  it("drops answers that no longer fit their question instead of restoring a wrong answer", () => {
    const kv = new MemoryKV();
    kv.setItem(DRAFT_KEY, JSON.stringify(draft({ answers: [[9, -1], [null, 3]] })));
    const back = readExamDraft(kv);
    expect(back).not.toBeNull();
    expect(back!.answers[0]).toEqual([null, null]);
    expect(back!.answers[1]).toEqual([null, 3]);
  });

  it("clears the draft after the exam is submitted", () => {
    const kv = new MemoryKV();
    saveExamDraft(kv, draft());
    clearExamDraft(kv);
    expect(kv.getItem(DRAFT_KEY)).toBeNull();
    expect(readExamDraft(kv)).toBeNull();
  });

  it("never throws when storage refuses writes", () => {
    const failing = {
      getItem: () => null,
      setItem: () => { throw new Error("quota"); },
      removeItem: () => { throw new Error("quota"); },
    };
    expect(saveExamDraft(failing, draft())).toBe(false);
    expect(() => clearExamDraft(failing)).not.toThrow();
  });
});
