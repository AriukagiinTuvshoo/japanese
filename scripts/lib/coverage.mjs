/**
 * КОНТЕНТЫН КОВЕРАЖИЙН НЭГДСЭН ДҮРЭМ (single source of truth)
 * -------------------------------------------------------------
 * `consistency-check.mjs` (тайлан) болон `content-qa.mjs` (хатуу хаалга) эндээс
 * уншина — хоёр хэрэгсэл **ядвал ижил тоог** гаргах ёстой. Өмнө нь хоёр
 * тооцоо зөрж байсан (нэг нь хуучирсан тайлан, нөгөө нь 0.0% мөрийг коддог
 * байсан) тул дүрмийг энд нэгтгэв.
 *
 * ДҮРЭМ:
 *  1. Төлөв (mq) бүрээс урт: `curated | draft | auto | derived | none`.
 *     Тэд **харилцан чөлөөтэй бөгөөд нийлбэр нь нийттэй тэнцэнэ**:
 *       curated + draft + auto + derived + none === total
 *  2. `auto` болон `none` — **хоёр өөр утга**.
 *       · `auto`   = машин/эх сурвалжаас гарсан санал (мөр байгаа, хүн хянаагүй)
 *       · `none`   = монгол утга огт байхгүй
 *     Тиймээс: хүн хянаагүй = curated биш (auto+draft+derived+none = бүгд
 *     "хянаагүй"); харин хоосон = auto ч биш.
 *  3. "Монгол утгатай" (hasMn) нь **төлөвөөс үл хамаарна**: mn массивад хоосон
 *     бус мөр байвал тоологдоно. Иймээс hasMn ≥ curated үргэлж үнэн.
 *  4. Жишээний орчуулга: жишээ бүрт `mn` мөр байвал тоологдоно (мөн төлөвгүй).
 *
 * Төлөвийн нэрийг (mq) кодоос уншина — нэрийг нотолгоогүйгээр өөрчлөхгүй.
 */
import fs from "node:fs";
import path from "node:path";

export const LEVELS = ["N5", "N4", "N3", "N2", "N1"];

/** src/lib/types.ts дэх MnQuality-тэй ижил байх ёстой (тэнцэх байдлыг шалгана). */
export const MQ_STATUSES = ["curated", "draft", "auto", "derived", "none"];
/** Хүн хянаагүй төлөвүүд (curated-ээс бусад бүгд). */
export const UNREVIEWED = ["draft", "auto", "derived", "none"];

export const RULES_TEXT = [
  "1) curated + draft + auto + derived + none === нийт (бүх төлөв харилцан чөлөөтэй)",
  "2) auto ≠ none: auto = мөр байгаа, хүн хянаагүй; none = монгол утга байхгүй",
  "3) хүн хянаагүй = curated биш (draft/auto/derived/none бүгд)",
  "4) hasMn (монгол утгатай) нь төлөвөөс үл хамаарна — хоосон бус мөр байвал тоологдоно",
  "5) жишээ: жишээ бүрт `mn` мөр байвал тоологдоно (төлөвгүй)",
].join("\n  ");

const J = (p, fallback) => {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return fallback;
  }
};

/** public/data-г нэгтгэн уншина (файл байхгүй бол алгасана — түүнийг data:validate хянана). */
export function loadRecords(root) {
  const data = path.join(root, "public/data");
  const vocab = LEVELS.flatMap((l) => J(path.join(data, `vocab/${l.toLowerCase()}.json`), []));
  const kanji = LEVELS.flatMap((l) => J(path.join(data, `kanji/${l.toLowerCase()}.json`), []));
  const grammar = LEVELS.flatMap((l) => J(path.join(data, `grammar/${l.toLowerCase()}.json`), []));
  const meta = J(path.join(data, "index/meta.json"), null);
  return { vocab, kanji, grammar, meta };
}

export function hasMnValue(x) {
  return Array.isArray(x) && x.some((m) => typeof m === "string" && m.trim() !== "");
}

/** mq төлөв бүрийн тоо + нийтлэх шалгалт. records = массив. */
export function statusCounts(records) {
  const counts = Object.fromEntries(MQ_STATUSES.map((s) => [s, 0]));
  let unknown = 0;
  for (const r of records) {
    const mq = r?.mq;
    if (Object.prototype.hasOwnProperty.call(counts, mq)) counts[mq] += 1;
    else unknown += 1;
  }
  const total = records.length;
  const sum = MQ_STATUSES.reduce((a, s) => a + counts[s], 0);
  return { counts, total, sum, unknown, balanced: sum === total && unknown === 0 };
}

/** Нэг түвшний бүх тоо (тайлан ба хаалга аль алинаа энэ ашиглана). */
export function levelRow(level, records) {
  const sc = statusCounts(records);
  const examples = records.flatMap((r) => (Array.isArray(r.ex) ? r.ex : []));
  return {
    level,
    total: sc.total,
    ...sc.counts,
    unknown: sc.unknown,
    balanced: sc.balanced,
    hasMn: records.filter((r) => hasMnValue(r.mn)).length,
    examples: examples.length,
    exMn: examples.filter((e) => typeof e.mn === "string" && e.mn.trim() !== "").length,
  };
}

/** Бүх түвшний мөр + НИЙТ мөр (хуучин тайлангийн хатуу 0.0%-ийг орлоно). */
export function coverageTable({ vocab }) {
  const rows = LEVELS.map((l) => levelRow(l, vocab.filter((v) => v.lvl === l)));
  const agg = rows.reduce(
    (a, r) => {
      for (const k of ["total", ...MQ_STATUSES, "unknown", "hasMn", "examples", "exMn"]) a[k] += r[k];
      a.balanced = a.balanced && r.balanced;
      return a;
    },
    { total: 0, unknown: 0, hasMn: 0, examples: 0, exMn: 0, balanced: true, ...Object.fromEntries(MQ_STATUSES.map((s) => [s, 0])) },
  );
  return { rows, total: agg };
}

export function readTerms(root) {
  return J(path.join(root, "content/mn/terms.json"), {});
}
