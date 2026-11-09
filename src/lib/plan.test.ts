import { describe, expect, it } from "vitest";
import { emptyDay, freshDoc, type Doc } from "./doc";
import { mergeDocs } from "./storage";
import {
  PLAN_MAX_DAYS,
  PLAN_MIN_DAYS,
  clampPlanDays,
  completedPlanDays,
  cumulativeTarget,
  currentPlanDay,
  dailyQuota,
  estimateMinutes,
  isDayCovered,
  planCoverage,
  planLag,
  planMission,
  planSchedule,
  suggestPlanDays,
  todayFromActivity,
  zeroQuota,
} from "./plan";

const content = { vocab: 1000, kanji: 300, grammar: 100, reading: 10, listening: 0 };

const ids = {
  vocab: ["a", "b", "c", "d"],
  kanji: ["日", "月", "火", "水"],
  grammar: ["g1", "g2", "g3", "g4"],
  reading: ["r1", "r2"],
  listening: [],
};

const docWith = (over: Partial<Doc> = {}): Doc => ({ ...freshDoc(), ...over });
const done = (over: Partial<ReturnType<typeof zeroQuota>> = {}) => ({ ...zeroQuota(), ...over });

describe("study plan engine", () => {
  it("splits real level content across the chosen days", () => {
    const q = dailyQuota(content, 30);
    expect(q.vocab).toBe(34); // ceil(1000 / 30)
    expect(q.kanji).toBe(10);
    expect(q.grammar).toBe(4);
    expect(q.reading).toBe(1);
    expect(q.listening).toBe(0);
  });

  it("keeps sections with no content out of the plan", () => {
    const q = dailyQuota(content, 30);
    const items = planMission({ quota: q, content, coverage: zeroQuota(), done: done(), level: "N5" });
    expect(items.map((i) => i.id)).toEqual(["vocab", "kanji", "grammar", "reading"]);
    expect(items.some((i) => i.id === "listening")).toBe(false);
  });

  it("does not report a lag on the first day before any work is due", () => {
    expect(planLag(1, 0)).toBe(0);
    expect(planLag(2, 0)).toBe(1);
    expect(planLag(5, 3)).toBe(1);
    expect(planLag(5, 9)).toBe(0);
  });

  it("clamps durations into a usable range", () => {
    expect(clampPlanDays(0)).toBe(PLAN_MIN_DAYS);
    expect(clampPlanDays(-40)).toBe(PLAN_MIN_DAYS);
    expect(clampPlanDays(9999)).toBe(PLAN_MAX_DAYS);
    expect(clampPlanDays(Number.NaN)).toBe(120);
  });

  it("suggests a duration from study hours and daily minutes", () => {
    expect(suggestPlanDays(30, [325, 600])).toBeGreaterThanOrEqual(PLAN_MIN_DAYS);
    expect(suggestPlanDays(180, [325, 600])).toBeLessThan(suggestPlanDays(30, [325, 600]));
    expect(suggestPlanDays(0, [300, 400])).toBe(suggestPlanDays(30, [300, 400]));
  });

  it("counts only vocabulary SRS cards, including prefixed ids", () => {
    const doc = docWith({ srs: { "v-jm-a": {} as never, "v-ls-b": {} as never, "k-mn-日": {} as never } });
    const cover = planCoverage(doc, ids);
    expect(cover.vocab).toBe(2);
    expect(cover.kanji).toBe(0);
  });

  it("does not recount finished work", () => {
    const doc = docWith({
      srs: { "v-jm-a": {} as never, "v-jm-b": {} as never },
      grammarDone: ["g1"],
    });
    const cover = planCoverage(doc, ids);
    const q = dailyQuota(content, 30);
    const items = planMission({ quota: q, content, coverage: cover, done: done(), level: "N5" });
    expect(cover.vocab).toBe(2);
    expect(cover.grammar).toBe(1);
    // 1000 - 2 болон 100 - 1 үлдсэн тул квот хэвээр.
    expect(items.find((i) => i.id === "vocab")?.target).toBe(34);
    expect(items.find((i) => i.id === "grammar")?.target).toBe(4);
  });

  it("shrinks the target when less content remains than one day's quota", () => {
    const doc = docWith({ srs: { "v-jm-a": {} as never } });
    const cover = planCoverage(doc, ids);
    const items = planMission({
      quota: { ...zeroQuota(), vocab: 10 },
      content: { ...content, vocab: 3 },
      coverage: cover,
      done: done(),
      level: "N5",
    });
    expect(items.find((i) => i.id === "vocab")?.target).toBe(2); // 3 - 1 үлдсэн
  });

  it("drops a section once all of its content is covered", () => {
    const doc = docWith({ readingDone: ["r1", "r2"] });
    const items = planMission({
      quota: dailyQuota(content, 30),
      content: { ...content, reading: 2 },
      coverage: planCoverage(doc, ids),
      done: done(),
      level: "N5",
    });
    expect(items.some((i) => i.id === "reading")).toBe(false);
  });

  it("keeps SRS reviews out of the new-card count", () => {
    const today = { ...emptyDay(), newCards: 5, reviews: 40, grammar: 2, reading: 1, listening: 0 };
    const counts = todayFromActivity(today, 3);
    expect(counts.vocab).toBe(5);
    expect(counts.kanji).toBe(3);
    expect(counts.grammar).toBe(2);
    expect(counts.reading).toBe(1);
    expect(counts.vocab).not.toBe(45);
  });

  it("counts only the active plan level's new cards", () => {
    const today = {
      ...emptyDay(),
      newCards: 9,
      newByLevel: { N5: 5, N3: 2, N2: 2 },
    };
    expect(todayFromActivity(today, 0, "N2").vocab).toBe(2);
    expect(todayFromActivity(today, 0, "N5").vocab).toBe(5);
    expect(todayFromActivity(today, 0).vocab).toBe(9);
  });

  it("does not attribute legacy days without a level breakdown", () => {
    const today = { ...emptyDay(), newCards: 7 };
    expect(todayFromActivity(today, 0, "N2").vocab).toBe(0);
    expect(todayFromActivity(today, 0).vocab).toBe(7);
  });

  it("switching the plan level changes the counted new cards", () => {
    const today = { ...emptyDay(), newCards: 6, newByLevel: { N3: 4, N2: 2 } };
    expect(todayFromActivity(today, 0, "N3").vocab).toBe(4);
    expect(todayFromActivity(today, 0, "N2").vocab).toBe(2);
  });

  it("caps today's done at the quota", () => {
    const items = planMission({
      quota: dailyQuota(content, 30),
      content,
      coverage: zeroQuota(),
      done: done({ vocab: 500 }),
      level: "N5",
    });
    expect(items.find((i) => i.id === "vocab")?.done).toBe(34);
  });

  it("routes tasks to the requested level", () => {
    const items = planMission({
      quota: dailyQuota(content, 30),
      content,
      coverage: zeroQuota(),
      done: done(),
      level: "N2",
    });
    expect(items.every((i) => i.to.includes("level=N2"))).toBe(true);
  });

  it("derives completed days only when every section met its cumulative target", () => {
    const quota = dailyQuota(content, 100);
    const cover = { ...zeroQuota(), vocab: quota.vocab * 2, kanji: quota.kanji * 2, grammar: quota.grammar * 2, reading: quota.reading * 2 };
    expect(completedPlanDays(cover, quota)).toBe(2);
    expect(completedPlanDays({ ...cover, grammar: 0 }, quota)).toBe(0);
  });

  it("never stores completion before the work happens", () => {
    const quota = dailyQuota(content, 100);
    const start = Date.UTC(2026, 0, 1);
    const day = currentPlanDay(start, 100, start + 3 * 86_400_000);
    expect(day).toBe(4);
    expect(completedPlanDays(zeroQuota(), quota)).toBe(0);

    const schedule = planSchedule({
      quota, content, coverage: zeroQuota(), day, days: 100, span: 3,
    });
    expect(schedule.map((s) => s.day)).toEqual([4, 5, 6]);
    expect(schedule.every((s) => !s.done)).toBe(true);
    expect(schedule[0].current).toBe(true);
  });

  it("marks a schedule day done only when coverage reaches its cumulative target", () => {
    const quota = { ...zeroQuota(), vocab: 10 };
    const cover = { ...zeroQuota(), vocab: 20 };
    const schedule = planSchedule({ quota, content: { ...content, vocab: 1000 }, coverage: cover, day: 1, days: 30, span: 3 });
    expect(schedule.map((s) => s.done)).toEqual([true, true, false]);
    const target = cumulativeTarget(quota, content, 2);
    expect(target.vocab).toBe(20);
    expect(isDayCovered(cover, target)).toBe(true);
  });

  it("ignores empty sections when judging a day", () => {
    expect(isDayCovered(zeroQuota(), zeroQuota())).toBe(true);
  });

  it("never exceeds the plan length", () => {
    expect(currentPlanDay(Date.now() - 400 * 86_400_000, 30)).toBe(30);
  });

  it("returns a positive minute estimate", () => {
    expect(estimateMinutes(zeroQuota())).toBe(1);
    expect(estimateMinutes(dailyQuota(content, 30))).toBeGreaterThan(10);
  });

  it("does not mutate the saved document or the id lists", () => {
    const doc = docWith({ srs: { "v-jm-a": {} as never }, grammarDone: ["g1"] });
    const snapshot = JSON.stringify(doc);
    const idsSnapshot = JSON.stringify(ids);
    planCoverage(doc, ids);
    planMission({
      quota: dailyQuota(content, 30), content, coverage: planCoverage(doc, ids), done: done(), level: "N5",
    });
    expect(JSON.stringify(doc)).toBe(snapshot);
    expect(JSON.stringify(ids)).toBe(idsSnapshot);
  });

  it("keeps the new daily counters when two tabs merge", () => {
    const a = docWith({ activity: { "2026-01-01": { ...emptyDay(), grammar: 2, reading: 0, listening: 1 } } });
    const b = docWith({ activity: { "2026-01-01": { ...emptyDay(), grammar: 1, reading: 3, listening: 0 } } });
    const merged = mergeDocs(a, b).activity["2026-01-01"];
    expect(merged.grammar).toBe(2);
    expect(merged.reading).toBe(3);
    expect(merged.listening).toBe(1);
  });
});
