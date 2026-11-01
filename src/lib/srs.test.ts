import { describe, expect, it } from "vitest";
import {
  MAX_INTERVAL_DAYS,
  newCard,
  previewIntervals,
  schedule,
  type Card,
  type Grade,
} from "./srs";

const MIN = 60_000;
const DAY = 86_400_000;
// intervalLabel() compares against the real clock, so anchor the tests close to it.
const NOW = Date.now();

/** A card that has graduated and survived several reviews. */
function mature(over: Partial<Card> = {}): Card {
  return {
    due: NOW - DAY,
    st: 21,
    df: 5,
    n: 10,
    l: 0,
    last: NOW - 21 * DAY,
    ph: "review",
    streak: 4,
    h: [2, 2, 2],
    ...over,
  };
}

function learning(over: Partial<Card> = {}): Card {
  return { due: NOW - MIN, st: 0.6, df: 6, n: 2, l: 0, last: NOW - DAY, ph: "learning", streak: 0, h: [0, 1], ...over };
}

function at(prev: Card | undefined, g: Grade, now = NOW) {
  return schedule(prev, g, { now });
}

describe("schedule — Again (lapse) always returns to relearning", () => {
  it("new card + Again → learning step of 10 minutes, not a lapse", () => {
    const c = at(newCard(), 0);
    expect(c.ph).toBe("learning");
    expect(c.due - NOW).toBe(10 * MIN);
    expect(c.l).toBe(0);
    expect(c.streak).toBe(0);
  });

  it("learning card + Again → still 10 minutes, lapse count unchanged", () => {
    const c = at(learning(), 0);
    expect(c.ph).toBe("learning");
    expect(c.due - NOW).toBe(10 * MIN);
    expect(c.l).toBe(0);
  });

  it("mature card + Again → relearn in 10 minutes, never days (regression: fuzz overriding lapse)", () => {
    for (let i = 0; i < 50; i++) {
      const c = at(mature(), 0);
      expect(c.ph).toBe("relearn");
      expect(c.due - NOW).toBe(10 * MIN);
      expect(c.l).toBe(1);
      expect(c.st).toBeLessThan(21);
    }
  });

  it("repeated Again on a relearning card keeps 10 minutes and never grows the interval", () => {
    let c = at(mature(), 0);
    for (let i = 0; i < 5; i++) {
      c = at(c, 0);
      expect(c.ph).toBe("relearn");
      expect(c.due - NOW).toBe(10 * MIN);
    }
    // Only the first failure after graduation counts as a lapse.
    expect(c.l).toBe(1);
  });
});

describe("schedule — Good / Hard / Easy", () => {
  it("first Good on a new card → one day, review phase", () => {
    const c = at(newCard(), 2);
    expect(c.ph).toBe("review");
    expect(c.due - NOW).toBe(DAY);
  });

  it("mature card: Hard < Good < Easy", () => {
    const h = at(mature(), 1);
    const g = at(mature(), 2);
    const e = at(mature(), 3);
    expect(h.due).toBeLessThan(g.due);
    expect(g.due).toBeLessThan(e.due);
    expect(g.st).toBeGreaterThan(21);
    expect(e.st).toBeGreaterThan(g.st);
  });

  it("Good on a relearning card graduates with a real interval", () => {
    const lapsed = at(mature(), 0);
    const c = at(lapsed, 2);
    expect(c.ph).toBe("review");
    expect(c.due - NOW).toBeGreaterThanOrEqual(DAY);
    expect(c.streak).toBe(1);
  });

  it("Again after graduating a relearning card lapses again", () => {
    const lapsed = at(mature(), 0);
    const graduated = at(lapsed, 2);
    const again = at(graduated, 0);
    expect(again.ph).toBe("relearn");
    expect(again.due - NOW).toBe(10 * MIN);
    expect(again.l).toBe(2);
  });
});

describe("schedule — interval cap and determinism", () => {
  it("never exceeds MAX_INTERVAL_DAYS", () => {
    let c = newCard();
    for (let i = 0; i < 30; i++) c = at(c, 3);
    const days = (c.due - NOW) / DAY;
    expect(days).toBeGreaterThan(0);
    expect(days).toBeLessThanOrEqual(MAX_INTERVAL_DAYS + 0.001);
    expect(Number.isFinite(c.st)).toBe(true);
  });

  it("is deterministic for the same card and grade (preview must not drift)", () => {
    const card = mature();
    const a = at(card, 2);
    const b = at(card, 2);
    expect(a.due).toBe(b.due);
    expect(a.st).toBe(b.st);
  });

  it("fuzz never shortens a long interval below the base and keeps young cards exact", () => {
    const card = mature({ st: 40 });
    const c = at(card, 2);
    const base = 40 * 2.35 * (1 - (c.df - 1) * 0.035);
    expect(c.due - NOW).toBeGreaterThanOrEqual(Math.floor(base * 0.95) * DAY);
    // A one-day card must not be stretched by a day of fuzz.
    expect(at(newCard(), 2).due - NOW).toBe(DAY);
  });

  it("previewIntervals returns identical labels on every call", () => {
    const card = mature();
    const first = previewIntervals(card, "mn", { now: NOW });
    const second = previewIntervals(card, "mn", { now: NOW });
    expect(second).toEqual(first);
    // The Again preview must advertise minutes, not days.
    expect(first[0].label).toMatch(/мин/);
  });
});
