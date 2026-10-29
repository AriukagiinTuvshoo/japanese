/**
 * Ханзын metadata-н дутуу хэсэг, эх сурвалж, нөхсөн утгыг нэг дүрмээр тооцох.
 * ------------------------------------------------------------------
 * Milestone C5. Гурван хэрэгсэл нэгэн зүйлийг ашиглана:
 *   · scripts/build-data.mjs  → kangxiChar (эцсийн JSON-д нөхнө)
 *   · scripts/kanji-meta.mjs  → content/review/KANJI-N1.md (record тус бүрийн тайлан)
 *   · scripts/kanji-meta.test.mjs → дүрмийн баталгаа
 *
 * Зарчим: **таамаглахгүй**. Зөвхөн баримтат эх сурвалжаас (KANJIDIC2,
 * OpenJLPT, kanji-data) ирсэн утга л «нөхсөн» гэж тэмдэглэгдэнэ; бусад нь
 * record тус бүрээр `needs-review` үлдэнэ.
 */

/** Unicode "KANGXI RADICALS" блокийн эхлэл: n=1 → U+2F00. */
export const KANGXI_BASE = 0x2f00;

/**
 * Кангийн зурлагын дугаар (1–214) → бүтэн хэлбэрийн ханз.
 * KANJIDIC2-ийн `classical` зураг жинхэнэ дугаар бөгөөд Unicode блок дээрх
 * товч хэлбэрийг NFKC-гаар задлахад OpenJLPT-ийн `radical` утгатай
 * 2,383-аас 2,381 (99.9%) нь тохирдог. Хязгаараас гадуур бол `null`
 * (тайлан руу needs-review бичигдэнэ).
 * @param {unknown} n
 * @returns {string|null}
 */
export function kangxiChar(n) {
  if (typeof n !== "number" || !Number.isInteger(n) || n < 1 || n > 214) return null;
  return String.fromCodePoint(KANGXI_BASE + n - 1).normalize("NFKC");
}

/**
 * Аль эсвэл хоосон биш мөрийг сонгоно.
 * Жишээ: kanji-data `readings_kun: []` байхад OpenJLPT-ийн уншлага
 * (`??` оператор) алгасагдах байсан — энэ нь 314 ханзны кун уншлагыг
 * алдсаны шалтгаан байв.
 * @param {...unknown} lists
 * @returns {any[]}
 */
export function firstNonEmpty(...lists) {
  for (const l of lists) if (Array.isArray(l) && l.length) return l;
  return [];
}

/**
 * record тус бүрийн metadata-н төлөв + эх сурвалж.
 *
 * @param {Array<object>} records  public/data/kanji/*.json бичлэгүүд
 * @param {{radicals?: Record<string,number>, kanjiData?: Record<string,any>, openjlpt?: Record<string,any>}} sources
 *   · radicals   — KANJIDIC2 классик зурлагын дугаар (scripts/lib/kanjidic_export.py)
 *   · kanjiData  — kanji-data/kanji.json (readings_on / readings_kun)
 *   · openjlpt   — ханз → OpenJLPT бичлэг (onyomi / kunyomi / radical)
 * @returns {Array<{k: string, lvl: string, field: string, value: string, status: string, source: string}>}
 *
 * status:
 *   `filled-kanjidic` — энэ milestone-д KANJIDIC2-аар нөхсөн (src-д +kanjidic2)
 *   `filled-openjlpt` — kanji-data-д уншлага байхгүй, OpenJLPT-ээс авсан
 *   `needs-review`    — баримтат эх сурвалжинд ч байхгүй → хүн шийдэнэ
 */
export function kanjiGaps(records, { radicals = {}, kanjiData = {}, openjlpt = {} } = {}) {
  const rows = [];
  for (const r of records) {
    const k = r.k;
    const src = typeof r.src === "string" ? r.src : "";
    const kd = kanjiData[k] ?? null;
    const oj = openjlpt[k] ?? null;

    // 1) радикал
    if (!r.rad) {
      rows.push({
        k,
        lvl: r.lvl,
        field: "rad",
        value: "",
        status: "needs-review",
        source: describeMiss("rad", radicals, kanjiData, openjlpt, k),
      });
    } else if (src.includes("+kanjidic2")) {
      rows.push({
        k,
        lvl: r.lvl,
        field: "rad",
        value: r.rad,
        status: "filled-kanjidic",
        source: `KANJIDIC2 классик зураг №${radicals[k] ?? "?"}`,
      });
    }

    // 2) он/кун уншлага — зөвхөн kanji-data-д байхгүй бол OpenJLPT-ээс ирсэн
    for (const [field, values, kdKey, ojKey] of [
      ["on", r.on, "readings_on", "onyomi"],
      ["kun", r.kun, "readings_kun", "kunyomi"],
    ]) {
      const has = Array.isArray(values) && values.length > 0;
      if (!has) {
        rows.push({
          k,
          lvl: r.lvl,
          field,
          value: "",
          status: "needs-review",
          source: describeMiss(field, radicals, kanjiData, openjlpt, k),
        });
        continue;
      }
      const kdHas = Array.isArray(kd?.[kdKey]) && kd[kdKey].length > 0;
      const ojHas = Array.isArray(oj?.[ojKey]) && oj[ojKey].length > 0;
      if (!kdHas && ojHas) {
        rows.push({
          k,
          lvl: r.lvl,
          field,
          value: values[0],
          status: "filled-openjlpt",
          source: `OpenJLPT ${ojKey}`,
        });
      }
    }
  }
  return rows;
}

/**
 * Тухайн ТАЛБАРЫГ шалгасан эх сурвалжуудыг товчоор тайлбарлана.
 * («мөр байна» гэдэг нь ханзын бичлэг байгаа гэсэн үг — уншлага/зурлага
 *  тус бүрээр шалгана, үгүй бол хууралт үүснэ.)
 */
function describeMiss(field, radicals, kanjiData, openjlpt, k) {
  const kd = kanjiData[k];
  const oj = openjlpt[k];
  if (field === "rad") {
    return radicals[k] != null
      ? `KANJIDIC2 №${radicals[k]} байна (утга оруулаагүй)`
      : "KANJIDIC2-д байхгүй · OpenJLPT-д байхгүй";
  }
  const kdKey = field === "on" ? "readings_on" : "readings_kun";
  const ojKey = field === "on" ? "onyomi" : "kunyomi";
  const kdHas = Array.isArray(kd?.[kdKey]) && kd[kdKey].length > 0;
  const ojHas = Array.isArray(oj?.[ojKey]) && oj[ojKey].length > 0;
  return `kanji-data ${kdHas ? "д байна" : "-д алга"} · OpenJLPT ${ojHas ? "д байна" : "-д алга"}`;
}

/**
 * Тайлангийн Markdown бэлтгэнэ (тогтмол дараалал — дахин ажиллуулахад
 * ижил үр дүн).
 * @param {Array<object>} rows kanjiGaps()-ийн үр дүн
 * @param {object} stats { total, byField: {rad:{have,miss}, on:{...}, kun:{...}}, byLevel: [{lvl,total,miss}] }
 */
export function renderReport(rows, stats) {
  const L = [];
  L.push("# Ханзын metadata (N5–N1) — record тус бүрийн тайлан");
  L.push("");
  L.push("Үүсгэгч: `npm run kanji:meta` (scripts/kanji-meta.mjs).");
  L.push("Дахин ажиллуулахад ижил үр дүн гарна. **Эх сурвалжгүй мөрүүдийг");
  L.push("таамаглаар дүүргээгүй** — тэд `needs-review` хэсэгт үлдэнэ.");
  L.push("");
  L.push("## 1. Дүгнэлэв");
  L.push("");
  L.push("| Талбар | Нийт | Байна | Дутуу | Эх сурвалжаар нөхсөн |");
  L.push("|--------|------|-------|-------|------------------------|");
  for (const f of ["rad", "on", "kun"]) {
    const s = stats.byField[f];
    const filled = rows.filter((r) => r.field === f && r.status !== "needs-review").length;
    L.push(`| ${f} | ${stats.total} | ${s.have} | ${s.miss} | ${filled} |`);
  }
  L.push("");
  if (Array.isArray(stats.byLevel) && stats.byLevel.length) {
    L.push("Түвшин тус бүр (дугуй нь дутуу metadata-тай бичлэг): ");
    L.push("");
    L.push("| Түвшин | Бичлэг | Дутуу талбар | Дутуу бичлэг |" );
    L.push("|--------|--------|--------------|--------------|");
    for (const b of stats.byLevel) L.push(`| ${b.lvl} | ${b.total} | ${b.miss} | ${b.records} |`);
    L.push("");
  }

  const needs = rows.filter((r) => r.status === "needs-review");
  L.push(`## 2. Дутуу үлдсэн бичлэгүүд — \`needs-review\` (**${needs.length}**)`);
  L.push("");
  if (!needs.length) {
    L.push("Олдсонгүй ✅");
    L.push("");
  } else {
    L.push("Шалгасан эх сурвалж бүгдэд байхгүй тул хүн (эсвэл шинэ эх сурвалж) шийднэ.");
    L.push("");
    L.push("| Ханз | Түвшин | Талбар | Шалгасан эх сурвалж |");
    L.push("|------|--------|--------|----------------------|");
    for (const r of needs) L.push(`| ${r.k} | ${r.lvl} | ${r.field} | ${r.source} |`);
    L.push("");
  }

  const filled = rows.filter((r) => r.status !== "needs-review");
  L.push(`## 3. Эх сурвалжаар нөхсөн бичлэгүүд (**${filled.length}**)`);
  L.push("");
  if (!filled.length) {
    L.push("Энэ удаа шинээр нөхсөн зүйлгүй.");
    L.push("");
  } else {
    L.push("| Ханз | Түвшин | Талбар | Утга | Эх сурвалж |");
    L.push("|------|--------|--------|------|-------------|");
    for (const r of filled) L.push(`| ${r.k} | ${r.lvl} | ${r.field} | ${r.value} | ${r.source} |`);
    L.push("");
  }
  return L.join("\n");
}
