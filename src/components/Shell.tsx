import { useEffect, useMemo, useState, type ReactNode } from "react";
import { cn } from "../utils/cn";
import { href, navigate, useRoute } from "../lib/router";
import { useStore } from "../lib/store";
import { LEVELS, type Level } from "../lib/types";
import { LEVEL_LABEL } from "../lib/text";
import { dueCards } from "../lib/srs";
import { ui } from "../lib/i18n";
import { Bar, Button, Chip, Ring } from "./ui";
import { SearchPalette } from "./SearchPalette";
import { AccountModal } from "./AccountModal";

interface NavItem {
  id: string;
  to: string;
  k: string;
  label: string;
  group: string;
  badge?: number;
}

export const MOBILE_TABS: { id: string; to: string; k: string; label: string }[] = [
  { id: "home", to: "home", k: "家", label: "Нүүр" },
  { id: "vocab", to: "vocab", k: "語", label: "Сурах" },
  { id: "quiz", to: "quiz", k: "題", label: "Дасгал" },
  { id: "dict", to: "dict", k: "辞", label: "Толь" },
  { id: "account", to: "account", k: "人", label: "Би" },
];

export default function Shell({ children }: { children: ReactNode }) {
  const route = useRoute();
  const { doc, today, streak, levelInfo, actions } = useStore();
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  const due = useMemo(() => dueCards(doc.srs).length, [doc.srs]);
  const language = doc.profile.language ?? "mn";
  const t = ui[language];
  const level = (route.query.level as Level | undefined) ?? (doc.profile.current === "zero" ? doc.profile.target : doc.profile.current);

  useEffect(() => setMenu(false), [route.hash]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearch((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const nav: NavItem[] = [
    { id: "home", to: "home", k: "家", label: t.home, group: t.start },
    { id: "plan", to: "plan", k: "計", label: t.plan, group: t.start },
    { id: "progress", to: "progress", k: "統", label: t.progress, group: t.start },
    { id: "vocab", to: `vocab?level=${level}`, k: "語", label: t.vocab, group: t.library, badge: due },
    { id: "kanji", to: `kanji?level=${level}`, k: "漢", label: t.kanji, group: t.library },
    { id: "write", to: `write?level=${level}`, k: "筆", label: t.writing, group: t.library },
    { id: "grammar", to: `grammar?level=${level}`, k: "文", label: t.grammar, group: t.library },
    { id: "kana", to: "kana", k: "あ", label: t.kana, group: t.library },
    { id: "reading", to: `reading?level=${level}`, k: "読", label: t.reading, group: t.skills },
    { id: "listening", to: `listening?level=${level}`, k: "聴", label: t.listening, group: t.skills },
    { id: "review", to: "review", k: "復", label: t.review, group: t.practice, badge: due },
    { id: "quiz", to: `quiz?level=${level}`, k: "題", label: t.quiz, group: t.practice },
    { id: "mock", to: "mock", k: "試", label: t.mock, group: t.practice },
    { id: "placement", to: "placement", k: "測", label: t.placement, group: t.practice },
    { id: "dict", to: "dict", k: "辞", label: t.dictionary, group: t.tools },
    { id: "achievements", to: "achievements", k: "賞", label: t.achievements, group: t.tools },
    { id: "account", to: "account", k: "人", label: t.account, group: t.tools },
    { id: "about", to: "about", k: "元", label: t.sources, group: t.tools },
    { id: "admin", to: "admin", k: "管", label: t.admin, group: t.tools },
  ];

  const groups = [...new Set(nav.map((n) => n.group))];
  const goalPct = Math.min(1, today.min / Math.max(1, doc.profile.dailyGoal));

  const SideNav = (
    <nav className="flex flex-col gap-5">
      {groups.map((g) => (
        <div key={g}>
          <p className="mb-1.5 px-3 font-mono text-[9.5px] font-semibold uppercase tracking-[0.26em] text-washi-500/60">{g}</p>
          <ul className="space-y-0.5">
            {nav.filter((n) => n.group === g).map((n) => {
              const on = route.name === n.id;
              return (
                <li key={n.id}>
                  <a
                    href={href(n.to)}
                    className={cn(
                      "group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all duration-200",
                      on ? "bg-washi-50 text-sumi-900" : "text-washi-300 hover:bg-white/[0.06] hover:text-washi-50",
                    )}
                  >
                    <span className={cn(
                      "grid h-8 w-8 shrink-0 place-items-center rounded-lg font-mincho text-[17px] font-bold transition-colors",
                      on ? "bg-shu-500 text-washi-50" : "bg-white/[0.06] text-washi-200 group-hover:bg-white/10",
                    )}>
                      {n.k}
                    </span>
                    <span className="flex-1 truncate text-[13.5px] font-bold">{n.label}</span>
                    {!!n.badge && (
                      <span className={cn("rounded-full px-1.5 py-0.5 font-mono text-[10px] font-bold tabnum", on ? "bg-shu-500 text-white" : "bg-white/10 text-washi-200")}>
                        {n.badge}
                      </span>
                    )}
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  const Brand = (
    <a href={href("home")} className="flex items-center gap-3">
      <span className="hanko grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-shu-500 text-[1.45rem] font-black text-washi-50">道</span>
      <span className="leading-none">
        <span className="block text-[16.5px] font-extrabold tracking-tight text-washi-50">Nihongo Dōjō</span>
        <span className="mt-1.5 block font-jp text-[10.5px] font-medium tracking-[0.16em] text-washi-400">日本語道場 · N5→N1</span>
      </span>
    </a>
  );

  const LanguageSwitcher = (
    <div className="flex items-center rounded-xl border border-sumi-900/10 bg-white/70 p-1" aria-label={t.language}>
      {(["mn", "en"] as const).map((lang) => (
        <button key={lang} onClick={() => actions.patchProfile({ language: lang })}
          aria-pressed={language === lang}
          className={cn("h-7 rounded-lg px-2.5 font-mono text-[11px] font-extrabold transition",
            language === lang ? "bg-shu-500 text-white" : "text-sumi-500 hover:text-sumi-900")}>
          {lang.toUpperCase()}
        </button>
      ))}
    </div>
  );

  const LevelSwitcher = (
    <div className="flex items-center gap-1 rounded-xl bg-sumi-900/5 p-1">
      {LEVELS.map((l) => (
        <button
          key={l}
          onClick={() => {
            actions.patchProfile({ current: l });
            const base = ["vocab", "kanji", "grammar", "reading", "listening", "quiz", "write", "mock"].includes(route.name) ? route.name : "vocab";
            navigate(`${base}?level=${l}`, { keepScroll: true });
          }}
          title={`${l} — ${LEVEL_LABEL[l]}`}
          className={cn(
            "h-7 rounded-lg px-2 font-mono text-[11.5px] font-extrabold transition",
            route.query.level === l ? "bg-sumi-900 text-washi-50" : "text-sumi-500 hover:text-sumi-900",
          )}
        >
          {l}
        </button>
      ))}
    </div>
  );

  return (
    <div className="washi min-h-screen">
      {/* ── Desktop sidebar ── */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[268px] flex-col overflow-y-auto bg-sumi-900 px-4 pb-5 pt-6 lg:flex">
        <div className="seigaiha pointer-events-none absolute inset-x-0 bottom-0 h-48 text-white/[0.035]" />
        <div className="relative px-2">{Brand}</div>

        <div className="relative mx-1 mt-6 flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.04] p-3">
          <Ring value={goalPct} size={50} stroke={5} tone="shu" track="rgba(255,255,255,0.08)">
            <span className="font-mono text-[11px] font-bold text-washi-50 tabnum">{Math.min(99, Math.round(goalPct * 100))}%</span>
          </Ring>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-bold text-washi-100">Өнөөдөр {today.min}/{doc.profile.dailyGoal} мин</p>
            <p className="mt-1 flex items-center gap-2 text-[11.5px] text-washi-400">
              <span>{streak} өдөр</span>
              <span className="h-1 w-1 rounded-full bg-washi-500" />
              <span className="tabnum">Түвшин {levelInfo.level} · {doc.xp} оноо</span>
            </p>
          </div>
        </div>

        <div className="relative mt-6 flex-1">{SideNav}</div>

        <button
          onClick={() => setAccountOpen(true)}
          className="relative mt-6 flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] font-bold text-washi-400 transition-colors hover:bg-white/[0.06] hover:text-washi-50"
        >
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/[0.06] font-mincho text-[16px]">設</span>
          <span className="truncate">{doc.profile.name || "Зочин"} · Тохиргоо</span>
        </button>
      </aside>

      {/* ── Mobile top bar ── */}
      <header className="sticky top-0 z-40 border-b border-sumi-900/10 bg-sumi-900 lg:hidden">
        <div className="flex h-16 items-center gap-3 px-4">
          {Brand}
          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => setSearch(true)} aria-label="Хайлт" className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 text-washi-50">🔎</button>
            <button onClick={() => setMenu(true)} aria-label="Цэс" className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 text-washi-50">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h10" /></svg>
            </button>
          </div>
        </div>
      </header>

      {/* ── Mobile drawer ── */}
      <div className={cn("fixed inset-0 z-50 lg:hidden", menu ? "pointer-events-auto" : "pointer-events-none")} aria-hidden={!menu}>
        <div
          onClick={() => setMenu(false)}
          className={cn("absolute inset-0 bg-sumi-950/50 backdrop-blur-sm transition-opacity duration-300", menu ? "opacity-100" : "opacity-0")}
        />
        <div className={cn(
          "absolute inset-y-0 left-0 w-[86%] max-w-[330px] overflow-y-auto bg-sumi-900 px-4 pb-6 pt-5 transition-transform duration-300",
          menu ? "translate-x-0" : "-translate-x-full",
        )}>
          <div className="mb-5 flex items-center justify-between px-2">
            {Brand}
            <button onClick={() => setMenu(false)} className="grid h-9 w-9 place-items-center rounded-lg bg-white/10 text-washi-50" aria-label="Хаах">✕</button>
          </div>
          <div className="mb-5 flex gap-2 px-2">{LevelSwitcher}{LanguageSwitcher}</div>
          {SideNav}
        </div>
      </div>

      {/* ── Desktop top bar ── */}
      <div className="sticky top-0 z-30 hidden border-b border-sumi-900/8 bg-washi-100/85 backdrop-blur-lg lg:block lg:pl-[268px]">
        <div className="mx-auto flex h-16 max-w-[1240px] items-center gap-3 px-6">
          <button
            onClick={() => setSearch(true)}
            className="flex h-10 flex-1 max-w-md items-center gap-2.5 rounded-xl border border-sumi-900/10 bg-white/70 px-3.5 text-left text-[13px] font-semibold text-sumi-400 transition hover:border-sumi-900/20 hover:bg-white"
          >
            🔎 Хайлт — япон, ромажи, монгол…
            <kbd className="ml-auto rounded-md border border-sumi-900/12 bg-white px-1.5 py-0.5 font-mono text-[10px] font-bold text-sumi-500">⌘K</kbd>
          </button>
          <div className="ml-auto flex items-center gap-2">
            {LanguageSwitcher}
            {LevelSwitcher}
            <Chip tone="shu" className="gap-1.5">{streak} өдөр</Chip>
            <button
              onClick={() => setAccountOpen(true)}
              className="flex items-center gap-2 rounded-xl border border-sumi-900/10 bg-white/70 py-1.5 pl-1.5 pr-3 transition hover:bg-white"
            >
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-sumi-900 font-mono text-[11px] font-bold text-washi-50 tabnum">
                {levelInfo.level}
              </span>
              <span className="max-w-[120px] truncate text-[12.5px] font-bold">{doc.profile.name || "Зочин"}</span>
            </button>
          </div>
        </div>
        <div className="mx-auto max-w-[1240px] px-6 pb-2">
          <Bar value={goalPct} height={3} tone="shu" />
        </div>
      </div>

      {/* ── Content ── */}
      <main className="lg:pl-[268px]">
        <div key={route.hash.split("?")[0]} className="mx-auto max-w-[1240px] animate-rise px-4 pb-32 pt-6 sm:px-6 sm:pt-8 lg:pb-16">
          {children}
        </div>
      </main>

      {/* ── Mobile bottom bar ── */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-sumi-900/10 bg-washi-50/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg lg:hidden">
        <div className="grid grid-cols-5">
          {MOBILE_TABS.map((t) => {
            const on = route.name === t.id || (t.id === "vocab" && ["kanji", "grammar", "reading", "listening", "write", "kana"].includes(route.name));
            return (
              <a key={t.id} href={href(t.to)} className="relative flex flex-col items-center gap-0.5 py-2.5">
                <span className={cn("relative font-mincho text-[19px] font-bold leading-none transition-colors", on ? "text-shu-500" : "text-sumi-500")}>
                  {t.k}
                  {t.id === "vocab" && due > 0 && (
                    <span className="absolute -right-2.5 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-shu-500 px-1 font-mono text-[9px] font-bold text-white tabnum">{due}</span>
                  )}
                </span>
                <span className={cn("text-[10px] font-bold", on ? "text-sumi-900" : "text-sumi-500")}>{t.label}</span>
                {on && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-shu-500" />}
              </a>
            );
          })}
        </div>
      </nav>

      {search && <SearchPalette onClose={() => setSearch(false)} />}
      {accountOpen && <AccountModal onClose={() => setAccountOpen(false)} />}

      {!doc.profile.onboarded && (
        <Onboarding
          onDone={() => actions.patchProfile({ onboarded: true })}
        />
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────── */

function Onboarding({ onDone }: { onDone: () => void }) {
  const { doc, actions } = useStore();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(doc.profile.name);
  const [goal, setGoal] = useState(doc.profile.dailyGoal);
  const [target, setTarget] = useState<Level>(doc.profile.target);

  const save = (extra: Parameters<typeof actions.patchProfile>[0] = {}) =>
    actions.patchProfile({ name: name.trim(), dailyGoal: goal, target, ...extra });

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-sumi-950/70 p-4 backdrop-blur-sm">
      <div className="washi w-full max-w-lg animate-pop overflow-hidden rounded-3xl border border-sumi-900/10 shadow-2xl">
        <div className="relative overflow-hidden bg-sumi-900 px-7 pb-7 pt-8 text-washi-50">
          <div className="seigaiha pointer-events-none absolute inset-0 text-white/[0.05]" />
          <p className="relative font-jp text-[12.5px] tracking-[0.3em] text-washi-400">ようこそ</p>
          <h2 className="relative mt-2 text-[1.7rem] font-extrabold leading-tight">Nihongo Dōjō-д тавтай морил</h2>
          <p className="relative mt-2.5 text-[13.5px] leading-relaxed text-washi-300">
            10,461 үг, 2,686 ханз, 526 дүрэм — монгол хэл дээрх тайлбартай.
            Дараагийн хэдэн алхмаар тохируулъя.
          </p>
          <div className="relative mt-4 flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <span key={i} className={cn("h-1 flex-1 rounded-full transition", i <= step ? "bg-shu-500" : "bg-white/15")} />
            ))}
          </div>
        </div>

        <div className="space-y-5 px-7 py-6">
          {step === 0 && (
            <label className="block">
              <span className="text-[12.5px] font-bold text-sumi-700">Таны нэр</span>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Жишээ: Төвшин"
                className="mt-1.5 h-12 w-full rounded-xl border border-sumi-900/15 bg-white px-4 text-[15px] font-semibold outline-none transition focus:border-shu-500 focus:ring-4 focus:ring-shu-500/10"
              />
            </label>
          )}

          {step === 1 && (
            <div>
              <p className="text-[12.5px] font-bold text-sumi-700">Зорилтот түвшин</p>
              <div className="mt-2 grid grid-cols-5 gap-2">
                {LEVELS.map((l) => (
                  <button
                    key={l}
                    onClick={() => setTarget(l)}
                    className={cn(
                      "rounded-xl border py-3 text-center transition",
                      target === l ? "border-shu-500 bg-shu-50 text-shu-700" : "border-sumi-900/10 bg-white/70 text-sumi-700 hover:border-sumi-900/25",
                    )}
                  >
                    <span className="block font-mono text-[15px] font-extrabold">{l}</span>
                    <span className="mt-0.5 block text-[10px] font-bold leading-tight">{LEVEL_LABEL[l]}</span>
                  </button>
                ))}
              </div>
              <p className="mt-4 text-[12.5px] font-bold text-sumi-700">Өдөрт хэдэн минут?</p>
              <div className="mt-2 grid grid-cols-4 gap-2">
                {[15, 30, 45, 60].map((m) => (
                  <button
                    key={m}
                    onClick={() => setGoal(m)}
                    className={cn(
                      "rounded-xl border py-3 text-center transition",
                      goal === m ? "border-shu-500 bg-shu-50 text-shu-700" : "border-sumi-900/10 bg-white/70 text-sumi-700 hover:border-sumi-900/25",
                    )}
                  >
                    <span className="block text-[18px] font-extrabold tabnum">{m}</span>
                    <span className="text-[10.5px] font-bold">мин</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-2.5">
              <p className="text-[13px] leading-relaxed text-sumi-600">Хаанаас эхлэхээ сонгоно уу:</p>
              {[
                { id: "kana", k: "あ", t: "Тэгээс эхэлнэ", d: "Хирагана, катакана — суурь бүрэн", to: "kana" },
                { id: "placement", k: "測", t: "Түвшнээ тогтоох", d: "40 асуулттай тест — одоогийн түвшнээ мэд", to: "placement" },
                { id: "vocab", k: "語", t: "Шууд суралцах", d: `${target} үгийн сангаас эхлэх`, to: `vocab?level=${target}` },
              ].map((o) => (
                <button
                  key={o.id}
                  onClick={() => {
                    save({ current: o.id === "kana" ? "zero" : target });
                    onDone();
                    navigate(o.to);
                  }}
                  className="flex w-full items-center gap-3.5 rounded-xl border border-sumi-900/10 bg-white/70 p-4 text-left transition hover:-translate-y-0.5 hover:border-shu-400 hover:bg-white"
                >
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-sumi-900 font-mincho text-[20px] font-bold text-washi-50">{o.k}</span>
                  <span className="min-w-0">
                    <span className="block text-[14.5px] font-extrabold text-sumi-900">{o.t}</span>
                    <span className="block text-[12.5px] text-sumi-500">{o.d}</span>
                  </span>
                  <span className="ml-auto text-sumi-300">→</span>
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            {step > 0 ? (
              <Button variant="ghost" size="sm" onClick={() => setStep(step - 1)}>← Буцах</Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => { save(); onDone(); }}>Алгасах</Button>
            )}
            {step < 2 && (
              <Button size="md" onClick={() => { save(); setStep(step + 1); }}>
                Үргэлжлүүлэх →
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
