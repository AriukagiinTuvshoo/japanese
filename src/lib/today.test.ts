import { describe, expect, it } from "vitest";
import {
  addSkipped, addStarted, buildTodayTasks, canSkip, clearTodayState, flowSummary, nextTask, readSkipped,
  readStarted,
  pruneSkipped, removeSkipped, reviewProgress, skippedCount, skippedKey, startedKey, statusOf,
  taskLink, withFrom,
  type TaskKind, type TodayTask,
} from "./today";
import { ui } from "./i18n";
import type { PlanMissionItem } from "./plan";

const mission = (over: Partial<PlanMissionItem> = {}): PlanMissionItem => ({
  id: "vocab",
  target: 7,
  done: 0,
  to: "vocab?level=N5&tab=learn",
  ...over,
});

const task = (id: TaskKind, status: TodayTask["status"], skipped = false): TodayTask => ({
  id,
  target: 1,
  done: status === "done" ? 1 : 0,
  status,
  to: "",
  started: status !== "todo",
  skipped,
});

/** localStorage-ийн хялбар хуулбар — зөвхөн тест. */
function fakeStore() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => { map.set(k, v); },
    removeItem: (k: string) => { map.delete(k); },
    keys: () => [...map.keys()],
  };
}

describe("reviewProgress", () => {
  it("does not count new cards as reviews", () => {
    expect(reviewProgress({ reviews: 10, newCards: 4 }, 4)).toEqual({ target: 10, done: 6 });
  });

  it("is empty when nothing is due and nothing was reviewed", () => {
    expect(reviewProgress({ reviews: 0, newCards: 0 }, 0)).toEqual({ target: 0, done: 0 });
  });

  it("tracks remaining due until the review is finished", () => {
    const partial = reviewProgress({ reviews: 3, newCards: 0 }, 5);
    expect(partial).toEqual({ target: 8, done: 3 });
    expect(statusOf(partial.done, partial.target, true)).toBe("active");

    const complete = reviewProgress({ reviews: 8, newCards: 0 }, 0);
    expect(complete).toEqual({ target: 8, done: 8 });
    expect(statusOf(complete.done, complete.target, true)).toBe("done");
  });

  it("ignores impossible negative values", () => {
    expect(reviewProgress({ reviews: 2, newCards: 9 }, -3)).toEqual({ target: 0, done: 0 });
  });
});

describe("task status", () => {
  it("never starts as completed", () => {
    expect(statusOf(0, 7, false)).toBe("todo");
  });

  it("opening a task only marks it active", () => {
    expect(statusOf(0, 7, true)).toBe("active");
    expect(statusOf(3, 7, true)).toBe("active");
  });

  it("is completed only when the real target is met", () => {
    expect(statusOf(6, 7, true)).toBe("active");
    expect(statusOf(7, 7, false)).toBe("done");
  });
});

describe("buildTodayTasks", () => {
  it("keeps plan order and appends the due review", () => {
    const tasks = buildTodayTasks({
      mission: [mission(), mission({ id: "kanji", target: 2, done: 2, to: "kanji?level=N5" })],
      level: "N5",
      due: 4,
      reviews: 0,
      newCards: 0,
      started: [],
    });
    expect(tasks.map((t) => t.id)).toEqual(["vocab", "kanji", "review"]);
    expect(tasks[0].status).toBe("todo");
    expect(tasks[1].status).toBe("done");
    expect(tasks[2]).toMatchObject({ id: "review", target: 4, done: 0, status: "todo" });
  });

  it("adds from=today to every exercise link", () => {
    const tasks = buildTodayTasks({
      mission: [mission()],
      level: "N4",
      due: 2,
      reviews: 0,
      newCards: 0,
      started: [],
    });
    expect(tasks[0].to).toBe("vocab?level=N5&tab=learn&from=today");
    expect(tasks[1].to).toBe("review?level=N4&from=today");
  });

  it("drops unavailable content instead of padding the plan", () => {
    const tasks = buildTodayTasks({
      mission: [mission({ target: 0 }), mission({ id: "listening", target: 0 })],
      level: "N5",
      due: 0,
      reviews: 0,
      newCards: 0,
      started: [],
    });
    expect(tasks).toEqual([]);
    expect(flowSummary(tasks)).toEqual({ total: 0, completed: 0, remaining: 0, pct: 0 });
  });

  it("marks a started task active without completing it", () => {
    const tasks = buildTodayTasks({
      mission: [mission()],
      level: "N5",
      due: 0,
      reviews: 0,
      newCards: 0,
      started: ["vocab"],
    });
    expect(tasks[0]).toMatchObject({ status: "active", done: 0, started: true });
  });

  it("does not mutate its inputs", () => {
    const list = [mission()];
    const snapshot = JSON.stringify(list);
    buildTodayTasks({ mission: list, level: "N5", due: 2, reviews: 5, newCards: 1, started: ["vocab"] });
    expect(JSON.stringify(list)).toBe(snapshot);
  });

  it("hides reviews when nothing is due", () => {
    const tasks = buildTodayTasks({
      mission: [mission()],
      level: "N5",
      due: 0,
      reviews: 3,
      newCards: 3,
      started: [],
    });
    expect(tasks.some((t) => t.id === "review")).toBe(false);
  });
});

describe("nextTask", () => {
  it("continues an in-progress task before starting a new one", () => {
    expect(nextTask([task("vocab", "todo"), task("kanji", "active"), task("review", "done")])?.id).toBe("kanji");
  });

  it("takes the first not-started task", () => {
    expect(nextTask([task("vocab", "done"), task("kanji", "todo"), task("review", "todo")])?.id).toBe("kanji");
  });

  it("returns null when everything is done", () => {
    expect(nextTask([task("vocab", "done")])).toBeNull();
    expect(nextTask([])).toBeNull();
  });
});

describe("flowSummary", () => {
  it("counts only completed work", () => {
    const s = flowSummary([task("vocab", "done"), task("kanji", "active"), task("review", "todo")]);
    expect(s).toEqual({ total: 3, completed: 1, remaining: 2, pct: 1 / 3 });
  });

  it("is empty for an empty plan", () => {
    expect(flowSummary([])).toEqual({ total: 0, completed: 0, remaining: 0, pct: 0 });
  });
});

describe("started state", () => {
  it("persists across reloads within the same day only", () => {
    const store = fakeStore();
    addStarted(store, "2026-11-07", "vocab");
    addStarted(store, "2026-11-07", "review");
    expect(readStarted(store, "2026-11-07")).toEqual(["vocab", "review"]);
    expect(readStarted(store, "2026-11-08")).toEqual([]);
  });

  it("dedupes ids and survives corrupt values", () => {
    const store = fakeStore();
    addStarted(store, "d", "vocab");
    expect(addStarted(store, "d", "vocab")).toEqual(["vocab"]);
    store.setItem(startedKey("d"), "{oops");
    expect(readStarted(store, "d")).toEqual([]);
  });

  it("never writes to the learning document", () => {
    const store = fakeStore();
    addStarted(store, "d", "vocab");
    expect(store.keys()).toEqual([startedKey("d")]);
  });
});

describe("skip state", () => {
  it("persists a skipped task without completing it", () => {
    const store = fakeStore();
    addSkipped(store, "2026-11-07", "vocab");
    const tasks = buildTodayTasks({
      mission: [mission()], level: "N5", due: 0, reviews: 0, newCards: 0,
      started: [], skipped: readSkipped(store, "2026-11-07"),
    });
    expect(tasks[0]).toMatchObject({ status: "todo", skipped: true, done: 0, started: false });
    expect(flowSummary(tasks).completed).toBe(0);
  });

  it("writes only the skip key — no XP, activity or SRS", () => {
    const store = fakeStore();
    addSkipped(store, "d", "vocab");
    addSkipped(store, "d", "kanji");
    expect(store.keys()).toEqual([skippedKey("d")]);
  });

  it("moves skipped work behind the next eligible task", () => {
    const tasks = buildTodayTasks({
      mission: [mission(), mission({ id: "kanji", to: "kanji?level=N5" })], level: "N5",
      due: 0, reviews: 0, newCards: 0, started: [], skipped: ["vocab"],
    });
    expect(tasks.map((t) => t.id)).toEqual(["vocab", "kanji"]);
    expect(tasks.find((t) => t.id === "vocab")?.skipped).toBe(true);
    expect(nextTask(tasks)?.id).toBe("kanji");
  });

  it("resumes a skipped task back to its original place", () => {
    const store = fakeStore();
    addSkipped(store, "d", "vocab");
    addSkipped(store, "d", "kanji");
    expect(readSkipped(store, "d")).toEqual(["vocab", "kanji"]);
    removeSkipped(store, "d", "vocab");
    expect(readSkipped(store, "d")).toEqual(["kanji"]);
    const tasks = buildTodayTasks({
      mission: [mission(), mission({ id: "kanji", to: "kanji?level=N5" })], level: "N5",
      due: 0, reviews: 0, newCards: 0, started: [], skipped: readSkipped(store, "d"),
    });
    expect(tasks[0].skipped).toBe(false);
    expect(tasks[1].skipped).toBe(true);
  });

  it("shows a skipped task as completed after real practice", () => {
    const tasks = buildTodayTasks({
      mission: [mission({ done: 7 })], level: "N5", due: 0, reviews: 0, newCards: 0,
      started: [], skipped: ["vocab"],
    });
    expect(tasks[0]).toMatchObject({ status: "done", skipped: false });
  });

  it("never skips a completed task", () => {
    const open = buildTodayTasks({
      mission: [mission()], level: "N5", due: 0, reviews: 0, newCards: 0, started: [],
    })[0];
    const done = buildTodayTasks({
      mission: [mission({ done: 7 })], level: "N5", due: 0, reviews: 0, newCards: 0, started: [],
    })[0];
    expect(canSkip(open)).toBe(true);
    expect(canSkip(done)).toBe(false);
  });

  it("ignores duplicate skips and keeps the order", () => {
    const store = fakeStore();
    addSkipped(store, "d", "kanji");
    addSkipped(store, "d", "vocab");
    expect(addSkipped(store, "d", "kanji")).toEqual(["kanji", "vocab"]);
    expect(readSkipped(store, "d")).toEqual(["kanji", "vocab"]);
  });

  it("restores the same order after a reload", () => {
    const store = fakeStore();
    addSkipped(store, "d", "vocab");
    addSkipped(store, "d", "grammar");
    addSkipped(store, "d", "review");
    expect(readSkipped(store, "d")).toEqual(["vocab", "grammar", "review"]);
  });

  it("starts a new day clean without touching yesterday", () => {
    const store = fakeStore();
    addSkipped(store, "2026-11-07", "vocab");
    expect(readSkipped(store, "2026-11-08")).toEqual([]);
    expect(readSkipped(store, "2026-11-07")).toEqual(["vocab"]);
  });

  it("prunes done and unknown ids while keeping the remaining order", () => {
    const store = fakeStore();
    addSkipped(store, "d", "vocab");
    addSkipped(store, "d", "grammar");
    addSkipped(store, "d", "unknown");
    expect(pruneSkipped(store, "d", ["grammar", "vocab"])).toEqual(["vocab", "grammar"]);
    expect(readSkipped(store, "d")).toEqual(["vocab", "grammar"]);
    /* Дахин дуудахад ямар ч өөрчлөлтгүй. */
    expect(pruneSkipped(store, "d", ["vocab", "grammar"])).toEqual(["vocab", "grammar"]);
  });

  it("clears today's started and skipped UI state on reset", () => {
    const store = fakeStore();
    addStarted(store, "2026-11-07", "vocab");
    addSkipped(store, "2026-11-07", "kanji");
    addSkipped(store, "2026-11-06", "grammar");
    clearTodayState(store, "2026-11-07");
    expect(readStarted(store, "2026-11-07")).toEqual([]);
    expect(readSkipped(store, "2026-11-07")).toEqual([]);
    /* Бусад өдрийн тэмдэг хөндөгдөхгүй. */
    expect(readSkipped(store, "2026-11-06")).toEqual(["grammar"]);
  });

  it("survives corrupt skip values", () => {
    const store = fakeStore();
    store.setItem(skippedKey("d"), "not-json");
    expect(readSkipped(store, "d")).toEqual([]);
    store.setItem(skippedKey("d"), JSON.stringify({ a: 1 }));
    expect(readSkipped(store, "d")).toEqual([]);
  });

  it("counts skipped tasks from the real task list, not raw storage", () => {
    const tasks = buildTodayTasks({
      mission: [
        mission({ id: "vocab", done: 7 }),
        mission({ id: "kanji", to: "kanji?level=N5" }),
      ],
      level: "N5", due: 0, reviews: 0, newCards: 0,
      started: [], skipped: ["vocab", "kanji", "removed-item"],
    });
    /* Дууссан vocab ба одоо байхгүй ID тооцогдохгүй. */
    expect(skippedCount(tasks)).toBe(1);
  });

  it("reports the same skipped count for identical inputs (Home/Plan/Today)", () => {
    const opts = {
      mission: [mission({ id: "vocab", done: 2 }), mission({ id: "kanji", to: "kanji?level=N5" })],
      level: "N5" as const, due: 3, reviews: 2, newCards: 1, started: [], skipped: ["kanji"],
    };
    const asToday = skippedCount(buildTodayTasks(opts));
    const asHome = skippedCount(buildTodayTasks(opts));
    const asPlan = skippedCount(buildTodayTasks(opts));
    expect(asToday).toBe(asHome);
    expect(asHome).toBe(asPlan);
    expect(asToday).toBe(1);
  });

  it("drops a stale skip record once the task is completed", () => {
    const open = buildTodayTasks({
      mission: [mission()], level: "N5", due: 0, reviews: 0, newCards: 0,
      started: [], skipped: ["vocab"],
    });
    const done = buildTodayTasks({
      mission: [mission({ done: 7 })], level: "N5", due: 0, reviews: 0, newCards: 0,
      started: [], skipped: ["vocab"],
    });
    expect(skippedCount(open)).toBe(1);
    expect(skippedCount(done)).toBe(0);
  });

  it("counts a skipped review only while it is still open", () => {
    const open = buildTodayTasks({
      mission: [], level: "N5", due: 4, reviews: 1, newCards: 1, started: [], skipped: ["review"],
    });
    const done = buildTodayTasks({
      mission: [], level: "N5", due: 0, reviews: 5, newCards: 1, started: [], skipped: ["review"],
    });
    expect(skippedCount(open)).toBe(1);
    expect(skippedCount(done)).toBe(0);
  });

  it("falls back to a skipped task when everything open is skipped", () => {
    const tasks = buildTodayTasks({
      mission: [mission(), mission({ id: "kanji", to: "kanji?level=N5" })], level: "N5",
      due: 0, reviews: 0, newCards: 0, started: [], skipped: ["vocab", "kanji"],
    });
    expect(nextTask(tasks)).toMatchObject({ skipped: true });
  });
});

describe("links", () => {
  it("uses the active plan level", () => {
    expect(taskLink("review", "N2")).toBe("review?level=N2&from=today");
    expect(taskLink("vocab", "N3")).toBe("vocab?level=N3&tab=learn&from=today");
    expect(taskLink("listening", "N1")).toBe("listening?level=N1&from=today");
  });

  it("appends the query separator only when needed", () => {
    expect(withFrom("review")).toBe("review?from=today");
    expect(withFrom("review?level=N5")).toBe("review?level=N5&from=today");
  });
});

describe("localization", () => {
  it("defines the same daily-flow keys in Mongolian and English", () => {
    const keys = (o: unknown) =>
      Object.keys(o as Record<string, unknown>).filter((k) => k.startsWith("today")).sort();
    expect(keys(ui.mn)).toEqual(keys(ui.en));
    expect(keys(ui.mn).length).toBeGreaterThan(15);
  });

  it("translates labels instead of reusing Mongolian text", () => {
    expect(ui.mn.todayStart).not.toBe(ui.en.todayStart);
    expect(ui.mn.todayStatusDone).not.toBe(ui.en.todayStatusDone);
    expect(ui.mn.todayNoPlanTitle).not.toBe(ui.en.todayNoPlanTitle);
  });

  it("localizes skip and recovery actions in both languages", () => {
    expect(ui.mn.todaySkip).not.toBe(ui.en.todaySkip);
    expect(ui.mn.todayResume).not.toBe(ui.en.todayResume);
    expect(ui.mn.todayReturnTask).not.toBe(ui.en.todayReturnTask);
    expect(ui.mn.todaySkippedCount(2)).toContain("2");
    expect(ui.en.todaySkippedCount(2)).toContain("2");
    expect(ui.mn.todaySkippedCount(2)).not.toBe(ui.en.todaySkippedCount(2));
  });
});

describe("uid-scoped daily UI state", () => {
  it("keeps guest and signed-in users apart on the same browser", () => {
    const store = fakeStore();
    addSkipped(store, "2026-11-08", "vocab", "local");
    addStarted(store, "2026-11-08", "kanji", "local");
    addSkipped(store, "2026-11-08", "review", "u-1");

    expect(readSkipped(store, "2026-11-08", "local")).toEqual(["vocab"]);
    expect(readSkipped(store, "2026-11-08", "u-1")).toEqual(["review"]);
    expect(readSkipped(store, "2026-11-08", "u-2")).toEqual([]);
    expect(readStarted(store, "2026-11-08", "u-1")).toEqual([]);
    expect(startedKey("2026-11-08", "local")).toBe("nd:today:local:2026-11-08");
    expect(skippedKey("2026-11-08", "u-1")).toBe("nd:today:skip:u-1:2026-11-08");
  });

  it("never adopts the legacy unscoped keys for a signed-in uid", () => {
    const store = fakeStore();
    store.setItem("nd:today:2026-11-08", JSON.stringify(["vocab"]));
    store.setItem("nd:today:skip:2026-11-08", JSON.stringify(["kanji"]));
    expect(readStarted(store, "2026-11-08", "u-1")).toEqual([]);
    expect(readSkipped(store, "2026-11-08", "u-1")).toEqual([]);
    // Хуучин түлхүүр хэвээр — устгаж/шилжүүлж болохгүй.
    expect(store.getItem("nd:today:skip:2026-11-08")).toBe(JSON.stringify(["kanji"]));
  });

  it("clears only the requested user's day", () => {
    const store = fakeStore();
    addStarted(store, "2026-11-08", "vocab", "local");
    addSkipped(store, "2026-11-08", "kanji", "local");
    addSkipped(store, "2026-11-08", "review", "u-1");
    addSkipped(store, "2026-11-09", "review", "local");

    clearTodayState(store, "2026-11-08", "local");

    expect(readStarted(store, "2026-11-08", "local")).toEqual([]);
    expect(readSkipped(store, "2026-11-08", "local")).toEqual([]);
    expect(readSkipped(store, "2026-11-08", "u-1")).toEqual(["review"]);
    expect(readSkipped(store, "2026-11-09", "local")).toEqual(["review"]);
  });
});
