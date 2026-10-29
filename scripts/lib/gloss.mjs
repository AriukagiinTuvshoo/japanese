/**
 * terms.json → автоматаар монгол утга (auto gloss).
 *
 * `content/mn/terms.json`-ийн үнэ нь хоёр хэлбэртэй байж болно:
 *   "verb": "Үйл үг"                       // хуучин, энгийн хэлбэр
 *   "verb": { "mn": "Үйл үг", "ja": "動詞",  // C2-оос: баяжуулсан нэр томьёоны толь
 *             "status": "draft", "source": "...", ... }
 *
 * Автомат утга зөвхөн `mn`-ийг авна. Япон нэр, эх сурвалж, review төлөв
 * зөвхөн хүний/чанарын шалгалтад (content:qa) ашиглагдана — machine-д
 * "зөв" мэт харагдахын тулд бусад талбар нөлөөлдөггүй.
 *
 * Ашиглах: npm run data:build (scripts/build-data.mjs). Чист функц — I/O үгүй.
 */
export function makeAutoGloss(terms) {
  const std = (v) => {
    if (typeof v === "string") return v.trim() || null;
    if (v && typeof v === "object" && typeof v.mn === "string") return v.mn.trim() || null;
    return null;
  };
  const norm = (w) =>
    w.toLowerCase().replace(/^to /, "").replace(/^a /, "").replace(/^an /, "").replace(/\(.*?\)/g, "").trim();

  return (en = []) => {
    if (!en.length) return null;
    const out = [];
    for (const gloss of en.slice(0, 2)) {
      const g = norm(gloss);
      if (!g) continue;
      const parts = g.split(/\s*[,;]\s*|\s+or\s+/).flatMap((x) => x.split(/\s*\/\s*/));
      const mapped = parts.map((part) => {
        const direct = std(terms[part]);
        if (direct) return direct;
        const words = part.split(/\s+/);
        // зүгийн түвшний нийлүүлэлт: бүх үг тольд байж л үр дүн гарна
        const each = words.map((w) => std(terms[w]) ?? std(terms[w.replace(/(s|es|ed|ing)$/, "")]));
        return each.every(Boolean) ? each.join(" ") : null;
      });
      if (mapped.every(Boolean) && mapped.length) out.push(mapped.join(", "));
    }
    return out.length ? [...new Set(out)].slice(0, 2) : null;
  };
}
