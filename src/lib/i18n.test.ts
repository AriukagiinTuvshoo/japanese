import { describe, expect, it } from "vitest";
import { ui } from "./i18n";

describe("UI translations", () => {
  it("keeps Mongolian and English keys in sync", () => {
    expect(Object.keys(ui.en).sort()).toEqual(Object.keys(ui.mn).sort());
  });

  it("labels mistake records and remaining reviews separately", () => {
    expect(ui.mn.mistakeCountsLabel(1, 4)).toContain("1 бичлэг");
    expect(ui.mn.mistakeCountsLabel(1, 4)).toContain("4 давталт");
    expect(ui.en.mistakeCountsLabel(1, 4)).toContain("1 records");
    expect(ui.en.mistakeCountsLabel(1, 4)).toContain("4 reviews left");
  });

  it("has local-only account copy in both languages", () => {
    expect(ui.mn.localOnlyTitle.length).toBeGreaterThan(0);
    expect(ui.en.localOnlyTitle.length).toBeGreaterThan(0);
    expect(ui.mn.localOnlyPageSub.length).toBeGreaterThan(0);
    expect(ui.en.localOnlyPageSub.length).toBeGreaterThan(0);
  });
});
