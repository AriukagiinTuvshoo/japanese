/**
 * ӨДРИЙН ДАРААЛАЛЫН ЦЭВЭР ЛОГИК (React-гүй).
 * ------------------------------------------------------------------
 * `planMission`-ийн өдрийн даалгаврыг «эхлээгүй / үргэлжилж байна /
 * дууссан» төлөвтэй жагсаалт болгож, дараагийн алхмыг тодорхойлно.
 *
 * ЧУХАЛ: энд `Doc`-ыг өөрчлөх ямар ч функц байхгүй. Даалгавар «дууссан»
 * эсэх нь зөвхөн бодит ахицаас (SRS шинэ карт, бичсэн ханз, grammarDone…)
 * бодогдоно. «Эхэлсэн» тэмдэг нь зөвхөн UI-ийн төлөв бөгөөд тусад нь
 * localStorage-д хадгалагдана — XP, activity, completion-д хүрэхгүй.
 */
import type { ActivityDay } from "./doc";
import type { PlanMissionItem, PlanType } from "./plan";
import type { Level } from "./types";

export type TaskKind = PlanType | "review";
export type TaskStatus = "todo" | "active" | "done";

export interface TodayTask {
  id: TaskKind;
  target: number;
  done: number;
  status: TaskStatus;
  /** Бодит дасгалын линк (`from=today`-той). */
  to: string;
  started: boolean;
  /** Өнөөдрөөс хойшлуулсан — completed биш, дараалалд үлдэнэ. */
  skipped: boolean;
}

export interface FlowSummary {
  total: number;
  completed: number;
  remaining: number;
  pct: number;
}

/** «Эхэлсэн» төлөвийн түлхүүр — өдөр бүрээр шинээр эхэлнэ. */
export const STARTED_PREFIX = "nd:today:";

/** «Хойшлуулсан» төлөв — тусдаа түлхүүр тул хуучин `nd:today:<day>`
 *  өгөгдлийг (зөвхөн массив) хөндөхгүй, migration шаардлагагүй. */
export const SKIPPED_PREFIX = "nd:today:skip:";

/**
 * UID-тэй түлхүүр — нэг browser дээр guest/хэрэглэгч солиход өдрийн UI төлөв
 * холилдохгүй. `uid` өгөөгүй үед хуучин (scope-гүй) түлхүүр — зөвхөн
 * тест/хуучин contract-т зориулсан; апп үргэлж uid дамжуулна.
 * Хуучин scope-гүй түлхүүрийг автоматаар эзэмшүүлэхгүй (таамгалж болохгүй).
 */
export function startedKey(day: string, uid?: string): string {
  return uid ? `${STARTED_PREFIX}${uid}:${day}` : `${STARTED_PREFIX}${day}`;
}

export function skippedKey(day: string, uid?: string): string {
  return uid ? `${SKIPPED_PREFIX}${uid}:${day}` : `${SKIPPED_PREFIX}${day}`;
}

type ReadStore = Pick<Storage, "getItem">;
type WriteStore = Pick<Storage, "getItem" | "setItem">;

/** Эвдэрсэн/байхгүй утга нь хоосон жагсаалт — хэзээ ч шидэхгүй. */
export function readStarted(store: ReadStore, day: string, uid?: string): string[] {
  try {
    const raw = store.getItem(startedKey(day, uid));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed.filter((x): x is string => typeof x === "string"))];
  } catch {
    return [];
  }
}

export function addStarted(store: WriteStore, day: string, id: string, uid?: string): string[] {
  const cur = readStarted(store, day, uid);
  if (cur.includes(id)) return cur;
  const next = [...cur, id];
  try {
    store.setItem(startedKey(day, uid), JSON.stringify(next));
  } catch {
    /* quota/private mode — UI төлөв л, ахиц хөндөгдөхгүй */
  }
  return next;
}

/** Хойшлуулсан даалгаврын жагсаалт — дэс дараа нь сэргээнэ. */
export function readSkipped(store: ReadStore, day: string, uid?: string): string[] {
  try {
    const raw = store.getItem(skippedKey(day, uid));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed.filter((x): x is string => typeof x === "string"))];
  } catch {
    return [];
  }
}

function writeSkipped(store: WriteStore, day: string, ids: string[], uid?: string): string[] {
  try {
    store.setItem(skippedKey(day, uid), JSON.stringify(ids));
  } catch {
    /* quota/private mode — зөвхөн UI төлөв */
  }
  return ids;
}

/** Давхар skip → өөрчлөлтгүй; зөвхөн localStorage, doc/XP/SRS хөндөгдөхгүй. */
export function addSkipped(store: WriteStore, day: string, id: string, uid?: string): string[] {
  const cur = readSkipped(store, day, uid);
  if (cur.includes(id)) return cur;
  return writeSkipped(store, day, [...cur, id], uid);
}

export function removeSkipped(store: WriteStore, day: string, id: string, uid?: string): string[] {
  const cur = readSkipped(store, day, uid);
  if (!cur.includes(id)) return cur;
  return writeSkipped(store, day, cur.filter((x) => x !== id), uid);
}

/**
 * Зөвхөн бодит, нээлттэй даалгаврын skip ID-г үлдээнэ. Ингэснээр дууссан,
 * байхгүй болсон эсвэл өнөөдрийн даалгаварт ороогүй ID хадгалалтад
 * хуримтлагдахгүй — Home/Plan-ийн тоо Today-той ижил эх сурвалжтай болно.
 */
export function pruneSkipped(store: WriteStore, day: string, keep: readonly string[], uid?: string): string[] {
  const cur = readSkipped(store, day, uid);
  const allowed = new Set(keep);
  const next = cur.filter((id) => allowed.has(id));
  if (next.length === cur.length) return cur;
  return writeSkipped(store, day, next, uid);
}

/**
 * Өнөөдрийн UI төлөвийг (эхэлсэн/хойшлуулсан) устгана. Эдгээр нь ахиц
 * БИШ — зөвхөн дарааллын тэмдэг тул reset/startFresh үед хамт цэвэрлэнэ.
 */
export function clearTodayState(store: Pick<Storage, "removeItem">, day: string, uid?: string): void {
  try {
    store.removeItem(startedKey(day, uid));
    store.removeItem(skippedKey(day, uid));
  } catch {
    /* storage хаагдсан — ахицад нөлөөгүй */
  }
}

/** Дууссан даалгаврыг хойшлуулах боломжгүй. */
export function canSkip(task: TodayTask): boolean {
  return task.status !== "done";
}

/**
 * SRS давталтын бодит явц.
 * `reviews` нь ШИНЭ картын үнэлгээг ч тоолдог тул `newCards`-ыг хасна —
 * ингэснээр нэг карт «шинэ сурах» ба «давтах» гэж хоёр удаа тооцогдохгүй.
 */
export function reviewProgress(
  today: Pick<ActivityDay, "reviews" | "newCards">,
  due: number,
): { target: number; done: number } {
  const reviewed = Math.max(0, Math.round(today.reviews || 0) - Math.round(today.newCards || 0));
  const target = Math.max(0, Math.round(due) || 0) + reviewed;
  return { target, done: Math.min(target, reviewed) };
}

export function statusOf(done: number, target: number, started: boolean): TaskStatus {
  if (target > 0 && done >= target) return "done";
  return started ? "active" : "todo";
}

/** Линкэд «өнөөдийн дараалал руу буцах» тэмдэг нэмнэ. */
export function withFrom(to: string): string {
  return `${to}${to.includes("?") ? "&" : "?"}from=today`;
}

export function taskLink(id: TaskKind, level: Level): string {
  switch (id) {
    case "review": return withFrom(`review?level=${level}`);
    case "vocab": return withFrom(`vocab?level=${level}&tab=learn`);
    case "kanji": return withFrom(`kanji?level=${level}`);
    case "grammar": return withFrom(`grammar?level=${level}`);
    case "reading": return withFrom(`reading?level=${level}`);
    case "listening": return withFrom(`listening?level=${level}`);
  }
}

/**
 * Өнөөдрийн дараалал. `mission` нь зөвхөн бодит контенттой, үлдсэн
 * даалгавруудыг агуулна (`target > 0`). Давталт нь зөвхөн өнөөдөр
 * шаардлагатай карт байвал нэмэгдэнэ.
 */
export function buildTodayTasks(opts: {
  mission: PlanMissionItem[];
  level: Level;
  due: number;
  reviews: number;
  newCards: number;
  started: string[];
  skipped?: string[];
}): TodayTask[] {
  const { mission, level, due, reviews, newCards } = opts;
  const started = new Set(opts.started);
  const skipped = new Set(opts.skipped ?? []);
  const out: TodayTask[] = [];

  for (const m of mission) {
    if (!Number.isFinite(m.target) || m.target <= 0) continue;
    const done = Math.min(m.target, Math.max(0, Math.round(m.done) || 0));
    const status = statusOf(done, m.target, started.has(m.id));
    out.push({
      id: m.id,
      target: m.target,
      done,
      status,
      to: withFrom(m.to),
      started: started.has(m.id),
      // Хожим нь бодитоор дууссан бол «хойшлуулсан» тэмдэг автоматаар арилна.
      skipped: status !== "done" && skipped.has(m.id),
    });
  }

  const rp = reviewProgress({ reviews, newCards }, due);
  if (rp.target > 0) {
    const status = statusOf(rp.done, rp.target, started.has("review"));
    out.push({
      id: "review",
      target: rp.target,
      done: rp.done,
      status,
      to: taskLink("review", level),
      started: started.has("review"),
      skipped: status !== "done" && skipped.has("review"),
    });
  }

  return out;
}

/**
 * Дараагийн алхам: хойшлуулаагүй эхэлсэн → хойшлуулаагүй эхлээгүй →
 * бүгд хойшлуулсан бол эхний хойшлуулсан (Resume санал болгоно).
 */
export function nextTask(tasks: TodayTask[]): TodayTask | null {
  const open = tasks.filter((t) => t.status !== "done");
  return open.find((t) => t.status === "active" && !t.skipped)
    ?? open.find((t) => t.status === "todo" && !t.skipped)
    ?? open[0]
    ?? null;
}

/**
 * Хойшлуулсан БОДИТ даалгаврын тоо.
 * `buildTodayTasks` аль хэдийн дууссан, байхгүй эсвэл өнөөдрийн
 * даалгаварт ороогүй ID-г `skipped: false` болгодог тул Home, Plan,
 * Today бүгд ижил тоог харуулна — localStorage-ийн түүхий уртыг биш.
 */
export function skippedCount(tasks: readonly TodayTask[]): number {
  return tasks.filter((task) => task.skipped).length;
}

export function flowSummary(tasks: TodayTask[]): FlowSummary {
  const total = tasks.length;
  const completed = tasks.filter((t) => t.status === "done").length;
  return {
    total,
    completed,
    remaining: total - completed,
    pct: total ? completed / total : 0,
  };
}
