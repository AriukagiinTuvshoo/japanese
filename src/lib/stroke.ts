/**
 * ХАНЗ БИЧИХ ДАСГАЛ — KanjiVG-ийн вектор замыг ашиглана.
 * ------------------------------------------------------------------
 * 1. SVG path-аас зурлагын эхлэл/төгсгөлийн цэг, хайрцгийг гаргана.
 * 2. Хэрэглэгчийн зурсан шугам бүрийг зурлагатай харьцуулна:
 *      · байрлал (эхлэл/төгсгөлийн зай)
 *      · чиглэл (векторын өнцөг)
 *      · урт
 *      · дараалал (хэддэх зурлага вэ)
 * 3. 0..100 оноо буцаана.
 *
 * KanjiVG нь 109×109 хэмжээст координатын системтэй.
 */
export const KANJI_BOX = 109;

export interface Stroke {
  d: string;
  /** Эхлэлийн цэг (KanjiVG координат). */
  s: [number, number];
  /** Төгсгөлийн цэг. */
  e: [number, number];
  /** Замын ойролцоо урт. */
  len: number;
  /** Ойролцоо дундаж цэг. */
  mid: [number, number];
  /** Тэнхлэг тус бүрийн хайрцаг. */
  bbox: [number, number, number, number];
}

const NUM = /-?\d*\.?\d+(?:e-?\d+)?/g;

/** SVG path-аас бүх тоог гаргаж, геометрийн хураангуйг бүрдүүлнэ. */
export function parseStroke(d: string): Stroke | null {
  const nums = (d.match(NUM) ?? []).map(Number);
  if (nums.length < 4) return null;
  const pts: [number, number][] = [];
  for (let i = 0; i + 1 < nums.length; i += 2) pts.push([nums[i], nums[i + 1]]);
  const s = pts[0];
  const e = pts[pts.length - 1];
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const mid = pts[Math.floor(pts.length / 2)] ?? s;
  return {
    d,
    s, e, mid,
    len: len || Math.hypot(e[0] - s[0], e[1] - s[1]),
    bbox: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)],
  };
}

export function parseKanji(paths: string[]): Stroke[] {
  return paths.map(parseStroke).filter((x): x is Stroke => !!x);
}

/* ─────────────── Хэрэглэгчийн зурсан шугам ─────────────── */

export interface UserStroke {
  pts: [number, number][];
  s: [number, number];
  e: [number, number];
  len: number;
  mid: [number, number];
}

export function makeUserStroke(pts: [number, number][]): UserStroke | null {
  if (pts.length < 2) return null;
  const s = pts[0];
  const e = pts[pts.length - 1];
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  if (len < 4) return null;
  return { pts, s, e, len, mid: pts[Math.floor(pts.length / 2)] };
}

const dist = (a: [number, number], b: [number, number]) => Math.hypot(a[0] - b[0], a[1] - b[1]);

function angleDiff(a: [number, number], b: [number, number]) {
  const ang = Math.atan2(a[1], a[0]) - Math.atan2(b[1], b[0]);
  const norm = Math.abs(((ang + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI);
  return norm; // 0..π
}

export interface StrokeMatch {
  targetIndex: number;
  userIndex: number;
  score: number;
  startOff: number;
  endOff: number;
  angleOff: number;
}

export interface CompareResult {
  score: number;          // 0..100
  strokeCount: { user: number; expected: number };
  orderScore: number;     // 0..100 — дараалал зөв эсэх
  shapeScore: number;     // 0..100 — хэлбэр
  matches: StrokeMatch[];
  wrong: number[];        // буруу байрлалтай хэрэглэгчийн зурлагын индекс
  missing: number[];      // зурагдаагүй хэрэглэгчийн зурлагын индекс
  extra: number[];        // илүү зурсан шугам
  verdict: "perfect" | "good" | "ok" | "retry";
}

/**
 * Нэг зурлагыг харьцуулах.
 *  start/end/angle аль алиныг нь 0..1 болгож, жинлэсэн дундаж.
 */
function matchScore(target: Stroke, user: UserStroke): StrokeMatch {
  const startOff = dist(target.s, user.s) / KANJI_BOX;      // 0..~1.5
  const endOff = dist(target.e, user.e) / KANJI_BOX;
  const tAng = Math.atan2(target.e[1] - target.s[1], target.e[0] - target.s[0]);
  const uAng = Math.atan2(user.e[1] - user.s[1], user.e[0] - user.s[0]);
  const angleOff = angleDiff([Math.cos(tAng), Math.sin(tAng)], [Math.cos(uAng), Math.sin(uAng)]) / Math.PI;

  const lenRatio = Math.min(target.len, user.len) / Math.max(target.len, user.len);
  const posScore = Math.max(0, 1 - (startOff * 1.7 + endOff * 1.7) / 2);
  const angScore = Math.max(0, 1 - angleOff * 1.15) * (angleOff < 0.34 ? 1 : 0.75);
  const lenScore = Math.max(0, lenRatio);

  const score = posScore * 0.5 + angScore * 0.35 + lenScore * 0.15;
  return { targetIndex: -1, userIndex: -1, score, startOff, endOff, angleOff };
}

/**
 * Хэрэглэгчийн бичсэнийг зорилтот ханзтай харьцуулна.
 */
export function compareKanji(target: Stroke[], user: UserStroke[]): CompareResult {
  if (!target.length) {
    return { score: 0, strokeCount: { user: user.length, expected: 0 }, orderScore: 0, shapeScore: 0, matches: [], wrong: [], missing: [], extra: user.map((_, i) => i), verdict: "retry" };
  }

  // Бүх боломжит хосын оноог бодож, шуналттайгаар (greedy) тааруулна
  const pairs: StrokeMatch[] = [];
  target.forEach((t, ti) => user.forEach((u, ui) => {
    const m = matchScore(t, u);
    m.targetIndex = ti;
    m.userIndex = ui;
    pairs.push(m);
  }));
  pairs.sort((a, b) => b.score - a.score);

  const usedT = new Set<number>();
  const usedU = new Set<number>();
  const chosen: StrokeMatch[] = [];
  for (const p of pairs) {
    if (usedT.has(p.targetIndex) || usedU.has(p.userIndex)) continue;
    // Хэт муу тохирол — огт тааруулахгүй
    if (p.score < 0.22) continue;
    usedT.add(p.targetIndex);
    usedU.add(p.userIndex);
    chosen.push(p);
  }
  chosen.sort((a, b) => a.targetIndex - b.targetIndex);

  const shapeScore = chosen.length
    ? (chosen.reduce((a, m) => a + m.score, 0) / target.length) * 100
    : 0;

  // Дараалал: зөв дарааллаар бичсэн эсэх
  let orderHits = 0;
  for (let i = 1; i < chosen.length; i++) {
    if (chosen[i].userIndex > chosen[i - 1].userIndex) orderHits++;
  }
  const orderScore = chosen.length <= 1
    ? (chosen.length === target.length && target.length === 1 ? 100 : 60)
    : (orderHits / (chosen.length - 1)) * 100;

  const missing = target.map((_, i) => i).filter((i) => !usedT.has(i));
  const extra = user.map((_, i) => i).filter((i) => !usedU.has(i));
  const wrong: number[] = [];
  if (chosen.length && missing.length === 0 && extra.length === 0) {
    chosen.forEach((m, idx) => { if (idx !== m.targetIndex) wrong.push(m.userIndex); });
  }

  // Нийт оноо: хэлбэр 0.6 + дараалал 0.25 + зурлагын тоо 0.15
  const countRatio = Math.min(target.length, user.length) / Math.max(target.length, user.length);
  const score = Math.round(Math.max(0, Math.min(100, shapeScore * 0.6 + orderScore * 0.25 + countRatio * 100 * 0.15)));

  const verdict: CompareResult["verdict"] =
    score >= 92 ? "perfect" : score >= 78 ? "good" : score >= 60 ? "ok" : "retry";

  return {
    score,
    strokeCount: { user: user.length, expected: target.length },
    orderScore: Math.round(orderScore),
    shapeScore: Math.round(shapeScore),
    matches: chosen,
    wrong,
    missing,
    extra,
    verdict,
  };
}

export const VERDICT_MN: Record<CompareResult["verdict"], { text: string; tone: "matcha" | "ai" | "kin" | "shu" }> = {
  perfect: { text: "Төгс!", tone: "matcha" },
  good: { text: "Сайн", tone: "ai" },
  ok: { text: "Болно", tone: "kin" },
  retry: { text: "Дахин оролдоорой", tone: "shu" },
};

/* ─────────────── SVG зам зурах ─────────────── */

/** KanjiVG-ийн 109×109 замыг өгөгдсөн хэмжээ рүү хөрвүүлэх transform. */
export function scaleFor(size: number, padding = 0.08) {
  const inner = size * (1 - padding * 2);
  const k = inner / KANJI_BOX;
  return { k, ox: size * padding, oy: size * padding };
}

export const toPx = (p: [number, number], t: ReturnType<typeof scaleFor>): [number, number] => [
  t.ox + p[0] * t.k,
  t.oy + p[1] * t.k,
];
