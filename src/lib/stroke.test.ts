import { describe, expect, it } from "vitest";
import {
  compareKanji,
  KANJI_BOX,
  makeUserStroke,
  normalizeKanjiChar,
  parseKanji,
  parseStroke,
  scaleFor,
  type UserStroke,
} from "./stroke";

/** 三 — гурван хэвтээ зурлага (KanjiVG-тэй ойролцоо координат). */
const SAN = [
  "M20,30 L89,30",
  "M25,55 L84,55",
  "M15,82 L94,82",
];

/** Хэрэглэгчийн шугамыг өгөгдсөн эхлэл/төгсгөлөөр үүсгэнэ. */
function line(
  s: [number, number],
  e: [number, number],
  steps = 8,
): UserStroke {
  const pts: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    pts.push([s[0] + (e[0] - s[0]) * t, s[1] + (e[1] - s[1]) * t]);
  }
  const made = makeUserStroke(pts);
  if (!made) throw new Error("test stroke too short");
  return made;
}

describe("stroke geometry parsing", () => {
  it("parses a KanjiVG path into start/end/length", () => {
    const s = parseStroke("M20,30 L89,30");
    expect(s).not.toBeNull();
    expect(s!.s).toEqual([20, 30]);
    expect(s!.e).toEqual([89, 30]);
    expect(s!.len).toBeCloseTo(69, 5);
  });

  it("rejects a path without enough coordinates", () => {
    expect(parseStroke("M10,10")).toBeNull();
    expect(parseStroke("")).toBeNull();
  });

  it("uses the correct coordinate box", () => {
    expect(KANJI_BOX).toBe(109);
    const t = scaleFor(320);
    expect(t.k).toBeGreaterThan(0);
    expect(t.ox).toBeGreaterThan(0);
  });
});

describe("makeUserStroke", () => {
  it("ignores a tap with a single point", () => {
    expect(makeUserStroke([[10, 10]])).toBeNull();
  });

  it("ignores a stroke shorter than the minimum length", () => {
    expect(makeUserStroke([[10, 10], [11, 10]])).toBeNull();
  });

  it("keeps a real stroke and records its endpoints", () => {
    const s = makeUserStroke([[10, 10], [40, 10], [70, 10]]);
    expect(s).not.toBeNull();
    expect(s!.s).toEqual([10, 10]);
    expect(s!.e).toEqual([70, 10]);
    expect(s!.len).toBeCloseTo(60, 5);
  });
});

describe("compareKanji", () => {
  const target = parseKanji(SAN);

  it("never crashes and asks to retry on an empty canvas", () => {
    const r = compareKanji(target, []);
    expect(r.verdict).toBe("retry");
    expect(r.score).toBe(0);
    expect(r.strokeCount).toEqual({ user: 0, expected: 3 });
    expect(r.missing).toEqual([0, 1, 2]);
  });

  it("does not report success for a single stroke of a multi-stroke kanji", () => {
    const r = compareKanji(target, [line([20, 30], [89, 30])]);
    expect(r.strokeCount.user).toBe(1);
    expect(r.missing.length).toBe(2);
    expect(r.verdict).not.toBe("perfect");
  });

  it("scores a correctly drawn multi-stroke kanji highly", () => {
    const r = compareKanji(target, [
      line([21, 31], [88, 31]),
      line([26, 56], [83, 56]),
      line([16, 83], [93, 83]),
    ]);
    expect(r.strokeCount).toEqual({ user: 3, expected: 3 });
    expect(r.missing).toEqual([]);
    expect(r.extra).toEqual([]);
    expect(r.score).toBeGreaterThanOrEqual(78);
    expect(["perfect", "good"]).toContain(r.verdict);
  });

  it("penalises a wrong order instead of failing silently", () => {
    const forward = compareKanji(target, [
      line([21, 31], [88, 31]),
      line([26, 56], [83, 56]),
      line([16, 83], [93, 83]),
    ]);
    const backward = compareKanji(target, [
      line([16, 83], [93, 83]),
      line([26, 56], [83, 56]),
      line([21, 31], [88, 31]),
    ]);
    expect(backward.orderScore).toBeLessThan(forward.orderScore);
    expect(backward.score).toBeLessThanOrEqual(forward.score);
  });

  it("rejects a completely different character", () => {
    const r = compareKanji(target, [line([10, 100], [20, 100])]);
    expect(r.score).toBeLessThan(60);
    expect(r.verdict).toBe("retry");
  });

  it("counts an extra stroke as extra", () => {
    const r = compareKanji(target, [
      line([21, 31], [88, 31]),
      line([26, 56], [83, 56]),
      line([16, 83], [93, 83]),
      line([70, 15], [105, 95]),
    ]);
    expect(r.extra.length).toBe(1);
    expect(r.strokeCount.user).toBe(4);
  });

  it("handles a kanji without stroke data without throwing", () => {
    const r = compareKanji([], [line([20, 30], [89, 30])]);
    expect(r.verdict).toBe("retry");
    expect(r.strokeCount.expected).toBe(0);
  });
});

describe("unicode normalisation of the target character", () => {
  it("keeps a normal kanji as is", () => {
    expect(normalizeKanjiChar("日")).toBe("日");
  });

  it("normalises full-width / compatibility variants", () => {
    // ｶ (half-width katakana) → カ
    expect(normalizeKanjiChar("ｶ")).toBe("カ");
    expect(normalizeKanjiChar("㍉")).toBe("ミ");
  });

  it("strips zero-width characters and surrounding spaces", () => {
    expect(normalizeKanjiChar("  日\u200B ")).toBe("日");
    expect(normalizeKanjiChar("\uFEFF")).toBe("");
  });

  it("takes the first code point of a longer string", () => {
    expect(normalizeKanjiChar("日本")).toBe("日");
    expect(normalizeKanjiChar("")).toBe("");
  });
});
