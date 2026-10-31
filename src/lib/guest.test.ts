import { describe, expect, it, vi, afterEach } from "vitest";
import {
  attributeGuest, guestStats, hasProgress, mergeGuestIntoAccount, shouldOfferGuestMerge,
} from "./guest";
import { freshDoc } from "./storage";
import type { Doc } from "./store";

const NOW = 1_700_500_000_000;

function docWith(patch: Partial<Doc>, uid = "x"): Doc {
  const base = freshDoc(uid);
  return { ...base, ...patch, profile: { ...base.profile, ...(patch.profile ?? {}) } };
}

/** Зочин: XP 80, хоёр карт, гурав хоног сурсан. */
const guestDoc = docWith({
  xp: 80, xpParts: { "guest-device": 80 }, updatedAt: NOW - 60_000,
  srs: {
    w1: { due: NOW, st: 6, df: 5, n: 3, l: 1, last: NOW - 5000, ph: "review", streak: 2, h: [2] },
    w2: { due: NOW, st: 2, df: 4, n: 1, l: 0, last: NOW - 9000, ph: "learning", streak: 1, h: [1] },
  },
  activity: {
    "2026-10-20": { xp: 30, min: 9, newCards: 4, reviews: 20, correct: 15, total: 20 },
    "2026-10-21": { xp: 50, min: 12, newCards: 6, reviews: 30, correct: 22, total: 30 },
  },
  favorites: ["fav-g"],
});

const accountDoc = docWith({
  xp: 40, xpParts: { "acct-device": 40 }, updatedAt: NOW,
  srs: { w9: { due: NOW, st: 9, df: 7, n: 12, l: 2, last: NOW - 1000, ph: "review", streak: 4, h: [3] } },
  activity: { "2026-10-22": { xp: 40, min: 8, newCards: 2, reviews: 25, correct: 20, total: 25 } },
  favorites: ["fav-a"],
  profile: { ...freshDoc("a").profile, theme: "sepia", dailyGoal: 60 },
}, "acct");

afterEach(() => vi.unstubAllGlobals());

describe("B2: guest → account", () => {
  it("detects guest progress (and its absence)", () => {
    expect(hasProgress(guestDoc)).toBe(true);
    expect(hasProgress(freshDoc("g"))).toBe(false);
    expect(hasProgress(null)).toBe(false);
  });

  it("offers the merge on first login only (marker blocks repeats)", () => {
    expect(shouldOfferGuestMerge(guestDoc, null)).toBe(true);
    // шийдвэрийн дараа: marker = guest.updatedAt → дахин асуухгүй
    expect(shouldOfferGuestMerge(guestDoc, guestDoc.updatedAt)).toBe(false);
    // зочин дахин сурсан бол (updatedAt өөрчлөгдсөн) л дахин асууна
    expect(shouldOfferGuestMerge({ ...guestDoc, updatedAt: NOW }, guestDoc.updatedAt)).toBe(true);
    // ахицгүй зочин → хэзээ ч асуухгүй
    expect(shouldOfferGuestMerge(freshDoc("g"), null)).toBe(false);
  });

  it("guest + empty account: account adopts everything, XP = guest XP", () => {
    const empty = freshDoc("acct");
    const m = mergeGuestIntoAccount(guestDoc, empty, { now: NOW });
    expect(m.xp).toBe(80);
    expect(Object.keys(m.srs).sort()).toEqual(["w1", "w2"]);
    expect(m.favorites).toEqual(["fav-g"]);
    expect(Object.keys(m.activity).sort()).toEqual(["2026-10-20", "2026-10-21"]);
  });

  it("guest + existing account: both sides kept, XP summed not maxed", () => {
    const m = mergeGuestIntoAccount(guestDoc, accountDoc, { now: NOW });
    expect(m.xp).toBe(120);                                  // 40 + 80 (max биш)
    expect(Object.keys(m.srs).sort()).toEqual(["w1", "w2", "w9"]);
    expect(m.favorites.slice().sort()).toEqual(["fav-a", "fav-g"]);
    expect(Object.keys(m.activity).length).toBe(3);           // 3 өдөр бүгд
    expect(m.srs.w9.n).toBe(12);                              // бүртгэл хэвээр
    expect(m.profile.theme).toBe("sepia");                    // аккаунтын тохиргоо
  });

  it("merging twice is idempotent — XP never inflates", () => {
    const once = mergeGuestIntoAccount(guestDoc, accountDoc, { now: NOW });
    const twice = mergeGuestIntoAccount(guestDoc, once, { now: NOW });
    expect(twice.xp).toBe(once.xp);
    expect(Object.keys(twice.srs).length).toBe(Object.keys(once.srs).length);
    expect(twice.activity["2026-10-20"].xp).toBe(once.activity["2026-10-20"].xp);
  });

  it("after merging, later guest study adds only the new growth", () => {
    const first = mergeGuestIntoAccount(guestDoc, accountDoc, { now: NOW });
    expect(first.xp).toBe(120);
    // зочин тусдаа 20 XP олсон
    const grown = { ...guestDoc, xp: 100, xpParts: { "guest-device": 100 }, updatedAt: NOW + 1000 };
    const second = mergeGuestIntoAccount(grown, first, { now: NOW + 2000 });
    expect(second.xp).toBe(140);                              // 40 + 100
  });

  it("cancel keeps the account untouched and the guest copy intact", () => {
    // "Keep separate" → нэгтгэлгүй: аккаунт баримт өөрчлөгдөхгүй, зочин өөрөө хадгалах ёстой
    const accountAfterCancel = accountDoc;
    expect(accountAfterCancel.xp).toBe(40);
    expect(hasProgress(guestDoc)).toBe(true);                 // зочин хэвээр байна
    // шийдвэр marker-аар тэмдэглэгдэнэ → дахин асуухгүй
    expect(shouldOfferGuestMerge(guestDoc, guestDoc.updatedAt)).toBe(false);
  });

  it("sign out → sign in cycle: local copies survive for both uids", () => {
    const store: Record<string, string> = {};
    const save = (uid: string, d: Doc) => { store[uid] = JSON.stringify(d); };
    const load = (uid: string) => JSON.parse(store[uid]) as Doc;

    save("local", guestDoc);                 // зочинд буцах
    save("acct", accountDoc);                // гарахдаа бичнэ
    expect(load("local").xp).toBe(80);
    expect(load("acct").xp).toBe(40);

    // дахин нэвтрэх → нэгтгэх санал гарна (зочин өөрчлөгдөөгүй ч markerгүй)
    expect(shouldOfferGuestMerge(load("local"), null)).toBe(true);
    const m = mergeGuestIntoAccount(load("local"), load("acct"), { now: NOW });
    expect(m.xp).toBe(120);
  });

  it("attributeGuest collapses every guest day into one guest-keyed part", () => {
    const a = attributeGuest(guestDoc, "guest:dev1");
    expect(a.xpParts).toEqual({ "guest:dev1": 80 });
    for (const day of Object.values(a.activity)) {
      expect(Object.keys(day.parts ?? {})).toEqual(["guest:dev1"]);
      expect(day.parts!["guest:dev1"].xp).toBe(day.xp);
    }
    // нийт тоо өөрчлөгдөөгүй (legacy = 0)
    expect(a.xp).toBe(guestDoc.xp);
  });

  it("same-device guest and account contributions never collide", () => {
    // нэг л төхөөрөмж дээр зочиноор ба аккаунтаар тус тус 40 XP
    const g = docWith({ xp: 40, xpParts: { dev1: 40 }, updatedAt: NOW - 100 });
    const acc = docWith({ xp: 40, xpParts: { dev1: 40 }, updatedAt: NOW });
    const m = mergeGuestIntoAccount(g, acc, { partKey: "guest:dev1", now: NOW });
    expect(m.xp).toBe(80);
  });

  it("guestStats reports what the dialog shows", () => {
    expect(guestStats(guestDoc)).toEqual({ xp: 80, cards: 2, days: 2 });
    expect(guestStats(null)).toEqual({ xp: 0, cards: 0, days: 0 });
  });
});
