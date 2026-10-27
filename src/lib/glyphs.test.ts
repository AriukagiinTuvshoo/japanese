import { describe, expect, it } from "vitest";
// @ts-expect-error — scripts/*.mjs нь .d.ts-гүй, гэхдээ тест нь шууд ажиллуулна
import { findSimplified, scanObject } from "../../scripts/lib/glyphs.mjs";

describe("EXTRA: simplified-Chinese glyph guard", () => {
  it("flags the classic pairs", () => {
    expect(findSimplified("汉字")).toEqual(["汉"]);
    expect(findSimplified("复习")).toEqual(["复", "习"]);
  });

  it("accepts correct Japanese forms", () => {
    expect(findSimplified("漢字")).toEqual([]);
    expect(findSimplified("復習")).toEqual([]);
    expect(findSimplified("写真を写す")).toEqual([]); // 写 is shinjitai, not simplified-only
    expect(findSimplified("学校 体 国 語")).toEqual([]); // 語 is traditional/Japanese
    expect(findSimplified("Монгол хэл")).toEqual([]);
  });

  it("reports the path of the offending field", () => {
    const hits = scanObject({ w: "漢字", ex: [{ ja: "汉字を書く", mn: "Ханз бичих" }] });
    expect(hits).toHaveLength(1);
    expect(hits[0].path).toBe("ex[0].ja");
    expect(hits[0].chars).toBe("汉");
  });
});
