import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { makeAutoGloss } from "./gloss.mjs";

describe("makeAutoGloss (terms.json → автоматаар монгол утга)", () => {
  it("хуучин string хэлбэртэй толь ажиллана (back-compat)", () => {
    const auto = makeAutoGloss({ noun: "Нэр үг", only: "зөвхөн" });
    expect(auto(["noun"])).toEqual(["Нэр үг"]);
    expect(auto(["only"])).toEqual(["зөвхөн"]);
  });

  it("C2-ийн объект хэлбэрээс зөвхөн mn-ийг авна, [object Object] гарахгүй", () => {
    const auto = makeAutoGloss({
      counter: { mn: "Тоолуур", ja: "助数詞", status: "draft", source: "test" },
    });
    const out = auto(["counter"]);
    expect(out).toEqual(["Тоолуур"]);
    expect(JSON.stringify(out)).not.toContain("[object Object]");
  });

  it("хоёр хэлбэр хамтдаа байж болно", () => {
    const auto = makeAutoGloss({
      verb: "Үйл үг",
      noun: { mn: "Нэр үг", ja: "名詞" },
    });
    expect(auto(["verb"])).toEqual(["Үйл үг"]);
    expect(auto(["noun"])).toEqual(["Нэр үг"]);
  });

  it("тольд байхгүй үг → null (зохиомол утга үүсгэхгүй)", () => {
    expect(makeAutoGloss({})() ).toBeNull();
    expect(makeAutoGloss({ noun: "Нэр үг" })(["verb"])).toBeNull();
    expect(makeAutoGloss({})([])).toBeNull();
  });

  it("бүх үг тольд байвал үг тус бүрээр нийлүүлнэ", () => {
    const auto = makeAutoGloss({ example: "жишээ", sentence: "өгүүлбэр" });
    expect(auto(["example sentence"])).toEqual(["жишээ өгүүлбэр"]);
    // нэг үг л дутвал бүтэн хэлцэл нь null
    expect(auto(["example unknown"])).toBeNull();
  });

  it("бодит content/mn/terms.json уншиж ажиллана", () => {
    const file = new URL("../../content/mn/terms.json", import.meta.url);
    const terms = JSON.parse(readFileSync(file, "utf8"));
    const auto = makeAutoGloss(terms);
    expect(Object.keys(terms).length).toBeGreaterThan(0);
    expect(auto(["noun"])).toEqual(["Нэр үг"]);
    expect(auto(["counter"])).toEqual(["Тоолуур"]);
    expect(auto(["only"])).toEqual(["Зөвхөн"]);
    // бүх утга эсвэл string, эсвэл mn-тэй объект байна
    for (const v of Object.values(terms)) {
      const mn = typeof v === "string" ? v : v?.mn;
      expect(typeof mn).toBe("string");
      expect(mn.trim().length).toBeGreaterThan(0);
    }
  });
});
