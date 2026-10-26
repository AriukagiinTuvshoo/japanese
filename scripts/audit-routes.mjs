/* Phase-0 runtime sweep: every route, console errors, empty states, edge cases. */
import { chromium } from "playwright";

const BASE = "http://127.0.0.1:4173/";
const results = [];
const issues = [];

const ROUTES = [
  "home", "vocab", "vocab?level=N1", "review", "kanji", "kanji?level=N1",
  "kanji/%E6%97%A5", "write/%E6%97%A5", "grammar", "grammar?level=N4",
  "grammar/wa", "reading", "reading/r1", "listening", "listening/l1",
  "quiz", "mock", "placement", "dict", "dict?q=%E6%97%A5", "plan",
  "progress", "achievements", "account", "kana", "mistakes", "about", "admin",
  "nonexistent-route",
];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();

let cur = "";
const consoleMsgs = [];
page.on("console", (m) => {
  const type = m.type();
  if (type === "error" || type === "warning") consoleMsgs.push({ route: cur, type, text: m.text().slice(0, 400) });
});
page.on("pageerror", (e) => consoleMsgs.push({ route: cur, type: "pageerror", text: String(e).slice(0, 500) }));

async function visit(route) {
  cur = route;
  consoleMsgs.length = 0;
  await page.goto(BASE + "#/" + route, { waitUntil: "load" });
  await page.evaluate(() => location.reload());
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(900);
  const info = await page.evaluate(() => {
    const root = document.getElementById("root");
    const spinners = document.querySelectorAll('[class*="animate-spin"]').length;
    const text = (root?.innerText ?? "").trim();
    return {
      chars: text.length,
      spinners,
      head: text.slice(0, 160).replace(/\s+/g, " "),
      hasBtn: document.querySelectorAll("button, a").length,
    };
  });
  results.push({ route, ...info, issues: consoleMsgs.map((c) => `${c.type}: ${c.text}`) });
  for (const c of consoleMsgs) issues.push({ route, ...c });
}

for (const r of ROUTES) await visit(r);

// ── Edge cases ──────────────────────────────────────────────
async function edge(name, fn) {
  cur = name;
  consoleMsgs.length = 0;
  try { await fn(); } catch (e) { issues.push({ route: name, type: "harness", text: String(e).slice(0, 400) }); }
  for (const c of consoleMsgs) issues.push({ route: name, ...c });
}

await edge("corrupted-localStorage", async () => {
  await page.goto(BASE + "#/home", { waitUntil: "load" });
  await page.evaluate(() => { localStorage.setItem("nd:doc:local", "{NOT JSON!!"); localStorage.setItem("nd:session", "local"); });
  await page.reload(); await page.waitForTimeout(1200);
  const ok = await page.evaluate(() => (document.getElementById("root")?.innerText ?? "").length > 50);
  if (!ok) issues.push({ route: "corrupted-localStorage", type: "finding", text: "app rendered empty after corrupt doc" });
});

await edge("corrupted-shape-localStorage", async () => {
  await page.evaluate(() => localStorage.setItem("nd:doc:local", JSON.stringify({ v: 3, srs: "not-an-object", activity: 42, profile: { language: "mn" }, mistakes: "x" })));
  await page.reload(); await page.waitForTimeout(1200);
  const ok = await page.evaluate(() => (document.getElementById("root")?.innerText ?? "").length > 50);
  if (!ok) issues.push({ route: "corrupted-shape-localStorage", type: "finding", text: "app rendered empty/crashed on wrong-shaped doc" });
});

await edge("deep-link-refresh", async () => {
  await page.goto(BASE + "#/grammar/wa", { waitUntil: "load" });
  await page.reload(); await page.waitForTimeout(900);
  const h = await page.evaluate(() => document.querySelector("h1")?.textContent ?? "");
  if (!h) issues.push({ route: "deep-link-refresh", type: "finding", text: "no h1 after deep-link refresh" });
});

await edge("history-back-forward", async () => {
  await page.goto(BASE + "#/home", { waitUntil: "load" });
  await page.evaluate(() => { location.hash = "#/kanji"; });
  await page.waitForTimeout(400);
  await page.evaluate(() => { location.hash = "#/grammar"; });
  await page.waitForTimeout(400);
  await page.goBack(); await page.waitForTimeout(500);
  const h1 = await page.evaluate(() => document.querySelector("h1, h2")?.textContent ?? "");
  await page.goForward(); await page.waitForTimeout(500);
  const h2 = await page.evaluate(() => document.querySelector("h1, h2")?.textContent ?? "");
  results.push({ route: "history-back-forward", head: `back:${h1.slice(0, 40)} fwd:${h2.slice(0, 40)}` });
});

await edge("rapid-search-input", async () => {
  await page.goto(BASE + "#/dict", { waitUntil: "load" });
  await page.waitForTimeout(700);
  const input = await page.$("input[type=search], input[type=text]");
  if (input) {
    const t0 = Date.now();
    for (const s of ["a", "か", "ん", "日", "日本語", "学校"]) { await input.type(s, { delay: 15 }); }
    await page.waitForTimeout(600);
    results.push({ route: "rapid-search-input", head: `typed in ${Date.now() - t0}ms` });
  } else issues.push({ route: "rapid-search-input", type: "finding", text: "no search input on #/dict" });
});

await edge("huge-list-vocab-N1", async () => {
  await page.goto(BASE + "#/vocab?level=N1", { waitUntil: "load" });
  await page.waitForTimeout(1500);
  const info = await page.evaluate(() => {
    const rows = document.querySelectorAll("a[href*='#/vocab/'], [class*='vocab']").length;
    const long = document.body.innerText.length;
    return { rows, long, heap: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : -1 };
  });
  results.push({ route: "huge-list-vocab-N1", head: `domNodes-ish=${info.rows} textLen=${info.long} heapMB=${info.heap}` });
});

await edge("offline-first-load", async () => {
  await page.goto(BASE + "#/home", { waitUntil: "load" });
  await page.waitForTimeout(800);
  const sw = await page.evaluate(async () => {
    if (!("serviceWorker" in navigator)) return "no-sw-api";
    const rs = await navigator.serviceWorker.getRegistrations();
    return rs.length ? `registered:${rs[0].scope}` : "none-registered";
  });
  await page.evaluate(() => { window.dispatchEvent(new Event("offline")); });
  results.push({ route: "service-worker", head: sw });
});

await browser.close();

console.log("=== ROUTE SWEEP ===");
for (const r of results) {
  console.log(`${(r.route ?? "").padEnd(30)} chars=${String(r.chars ?? "-").padStart(6)} spin=${r.spinners ?? "-"} btns=${String(r.hasBtn ?? "-").padStart(3)} | ${String(r.head ?? "").slice(0, 90)}`);
  if (r.issues?.length) r.issues.forEach((i) => console.log(`    ! ${i.slice(0, 240)}`));
}
console.log("\n=== ALL ISSUES (" + issues.length + ") ===");
const seen = new Set();
for (const i of issues) {
  const key = `${i.type}|${i.text.slice(0, 120)}`;
  if (seen.has(key)) continue;
  seen.add(key);
  console.log(`[${i.route}] ${i.type}: ${i.text.slice(0, 300)}`);
}
