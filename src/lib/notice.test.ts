/**
 * B8 (сэргээсэн мэдэгдэл): `notify()` нь React-ийн effect-ээс ӨМНӨ дуудагдана —
 * жишээ нь `readDoc()` storage-аас гэмтсэн баримт сэргээсэн мэдэгдлийг
 * `useState` initializer дотор өгдөг. Тухайн үед сонсогч байхгүй тул мэдэгдэл
 * алга болж байв. Дараалалд хадгалж, анхны сонсогч нэгтгэхэд цэгнэнэ.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { notify, subscribeNotices, type Notice } from "./notice";

describe("notice backlog (энхлэгээс өмнө дуудагдсан мэдэгдэл)", () => {
  beforeEach(() => vi.useFakeTimers({ now: 1_700_000_000_000 }));
  afterEach(() => vi.useRealTimers());

  it("сонсогч байхгүй үед алга болохгүй — анхны subscribe дээр ирнэ", () => {
    const got: Notice[] = [];
    notify("error", "Хадгалагдсан өгөгдөл гэмтсэн байсан тул сэргээв");
    const off = subscribeNotices((n) => got.push(n));
    expect(got).toHaveLength(1);
    expect(got[0].kind).toBe("error");
    expect(got[0].text).toContain("сэргээв");
    off();
  });

  it("subscribe-ийн дараахи мэдэгдэл шууд (дараалалгүй) ирнэ", () => {
    const got: Notice[] = [];
    const off = subscribeNotices((n) => got.push(n));
    notify("success", "амжилттай");
    expect(got.map((n) => n.text)).toEqual(["амжилттай"]);
    off();
  });

  it("дараалал хязгаартай (5) — хэт олон бол хамгийн хуучныг хаяна", () => {
    for (let i = 1; i <= 8; i++) notify("info", `мэдэгдэл-${i}`, { dedupeMs: 0 });
    const got: Notice[] = [];
    const off = subscribeNotices((n) => got.push(n));
    expect(got).toHaveLength(5);
    expect(got.map((n) => n.text)).toEqual([
      "мэдэгдэл-4", "мэдэгдэл-5", "мэдэгдэл-6", "мэдэгдэл-7", "мэдэгдэл-8",
    ]);
    off();
  });

  it("давталт (dedupe) backlog дээр ч мөрдөгдөнө", () => {
    const first: Notice[] = [];
    notify("error", "нэг ижил текст");
    notify("error", "нэг ижил текст"); // 8с-ийн дотор давтсан → хаягдана
    const off = subscribeNotices((n) => first.push(n));
    expect(first).toHaveLength(1);
    off();
  });

  it("үйлдэлтэй (action) мэдэгдэл TTL-гүйгаар цэгнэгдэнэ", () => {
    const got: Notice[] = [];
    notify("success", "Undo бэлэн", { action: { label: "Буцаах", run: () => {} } });
    const off = subscribeNotices((n) => got.push(n));
    expect(got[0].ttlMs).toBe(0);
    expect(got[0].action?.label).toBe("Буцаах");
    off();
  });
});