import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { newCard, retrievability, schedule, intervalLabel, type Card } from "./srs";

const MIN = 60_000;
const DAY = 86_400_000;
const NOW = new Date("2026-10-27T09:00:00Z").getTime();

const mature = (st = 20): Card => ({
  due: NOW - DAY,
  st,
  df: 5,
  n: 5,
  l: 1,
  last: NOW - 10 * DAY,
  ph: "review",
  streak: 3,
  h: [2, 2, 2],
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  // deterministic fuzz
  vi.spyOn(Math, "random").mockReturnValue(0.5);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("P0-1: lapse scheduling", () => {
  it("a lapse on a mature card returns within the learning step, not days later", () => {
    const card = schedule(mature(20), 0);
    const minutes = (card.due - NOW) / MIN;
    expect(minutes).toBeLessThanOrEqual(15);
    expect(minutes).toBeGreaterThan(0);
  });

  it("a lapse never increases the interval beyond the learning step, for any stability", () => {
    for (const st of [0.5, 3.5, 7, 20, 60, 200]) {
      for (const rnd of [0, 0.25, 0.5, 0.75, 0.99]) {
        vi.spyOn(Math, "random").mockReturnValue(rnd);
        const card = schedule(mature(st), 0);
        expect((card.due - NOW) / MIN).toBeLessThanOrEqual(15);
      }
    }
  });

  it("a lapse drops stability and records the lapse", () => {
    const card = schedule(mature(20), 0);
    expect(card.st).toBeLessThan(20);
    expect(card.l).toBe(2);
    expect(card.ph).toBe("relearn");
  });
});

describe("P0-1: grade intervals", () => {
  it("Again < Hard < Good < Easy on a mature card", () => {
    const again = schedule(mature(10), 0).due - NOW;
    const hard = schedule(mature(10), 1).due - NOW;
    const good = schedule(mature(10), 2).due - NOW;
    const easy = schedule(mature(10), 3).due - NOW;
    expect(again).toBeLessThan(hard);
    expect(hard).toBeLessThan(good);
    expect(good).toBeLessThan(easy);
  });

  it("a fresh Good is a real day, not minutes", () => {
    const card = schedule(newCard(), 2);
    expect((card.due - NOW) / DAY).toBeGreaterThanOrEqual(1);
  });

  it("a new card graded Hard keeps a short learning step", () => {
    const card = schedule(newCard(), 1);
    expect((card.due - NOW) / MIN).toBeLessThanOrEqual(60);
  });

  it("stability stays inside sane bounds after many grades", () => {
    let card: Card | undefined;
    for (let i = 0; i < 40; i++) card = schedule(card, 3);
    expect(card!.st).toBeGreaterThan(0);
    expect(card!.st).toBeLessThanOrEqual(365 * 10);
  });
});

describe("P0-1: fuzz", () => {
  it("only fuzzes long review intervals, and only within ±5%", () => {
    const run = (r: number) => {
      vi.spyOn(Math, "random").mockReturnValue(r);
      return (schedule(mature(20), 2).due - NOW) / DAY;
    };
    const baseline = run(0.5); // no fuzz offset
    expect(baseline).toBeGreaterThanOrEqual(3);
    for (const r of [0, 0.1, 0.9, 1]) {
      const days = run(r);
      expect(Math.abs(days - baseline)).toBeLessThanOrEqual(Math.max(1, baseline * 0.05) + 0.51);
    }
  });

  it("does not fuzz a short interval into a long one", () => {
    const card = schedule({ ...newCard(), st: 2, ph: "review", n: 3, last: NOW - DAY }, 1);
    expect((card.due - NOW) / DAY).toBeLessThan(3);
  });
});

describe("P0-1: time and day rollover", () => {
  it("retrievability decays with elapsed days", () => {
    const c: Card = { ...mature(10), last: NOW };
    expect(retrievability(c, NOW)).toBeCloseTo(1, 1);
    expect(retrievability(c, NOW + 10 * DAY)).toBeCloseTo(Math.exp(-1), 2);
  });

  it("intervalLabel crosses the day boundary, not 24h from now", () => {
    expect(intervalLabel({ ...newCard(), due: NOW + 30 * MIN })).toContain("мин");
    expect(intervalLabel({ ...newCard(), due: NOW + 5 * DAY })).toContain("өдөр");
    // a due time that is 23h away is still "h" — one hour past it becomes "өдөр"
    expect(intervalLabel({ ...newCard(), due: NOW + 23 * 60 * MIN })).toContain("цаг");
    expect(intervalLabel({ ...newCard(), due: NOW + 25 * 60 * MIN })).toContain("өдөр");
  });

  it("schedules are stable across a local midnight boundary", () => {
    vi.setSystemTime(new Date("2026-10-27T23:59:30Z").getTime());
    const before = schedule(mature(10), 2);
    vi.setSystemTime(new Date("2026-10-28T00:00:30Z").getTime());
    const after = schedule(mature(10), 2);
    expect(Math.round((before.due - before.last) / DAY)).toBe(Math.round((after.due - after.last) / DAY));
  });
});
