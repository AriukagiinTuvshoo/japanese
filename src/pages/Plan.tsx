import { useEffect, useMemo, useState } from "react";
import { cn } from "../utils/cn";
import { href, navigate } from "../lib/router";
import { useStore } from "../lib/store";
import { loadFullData, CURRICULUM, LISTENING, READING } from "../lib/data";
import type { Level } from "../lib/types";
import { LEVELS } from "../lib/types";
import { LEVEL_LABEL, todayKey } from "../lib/text";
import { LEVEL_META } from "../data/levels";
import {
  DEFAULT_PLAN_DAYS,
  clampPlanDays,
  completedPlanDays,
  currentPlanDay,
  dailyQuota,
  estimateMinutes,
  planCoverage,
  planLag,
  planMission,
  planSchedule,
  suggestPlanDays,
  todayFromActivity,
  zeroQuota,
  type PlanContent,
  type PlanIds,
} from "../lib/plan";
import { Bar, Button, Card, Chip, LevelBadge, ProgressRow, SectionTitle, Select, Spinner } from "../components/ui";
import { ui } from "../lib/i18n";
import { buildTodayTasks, readSkipped, skippedCount } from "../lib/today";
import { dueCards } from "../lib/srs";

export default function Plan() {
  const { doc, uid, actions, today } = useStore();
  const language = doc.profile.language ?? "mn";
  const t = ui[language];
  const cur = doc.curriculum;
  const [level, setLevel] = useState<Level>(cur?.level ?? doc.profile.target);
  const [days, setDays] = useState(() => clampPlanDays(cur?.days ?? DEFAULT_PLAN_DAYS));
  const [goal, setGoal] = useState(doc.profile.dailyGoal);
  const [data, setData] = useState<{ content: PlanContent; ids: PlanIds } | null>(null);

  /* Контентын хэмжээ ба ID-ууд — зөвхөн сонгосон түвшинээс. */
  useEffect(() => {
    let alive = true;
    loadFullData().then((d) => {
      if (!alive) return;
      const passages = READING.filter((r) => r.level === level);
      const lessons = LISTENING.filter((l) => l.level === level && (!l.status || l.status === "approved"));
      setData({
        content: {
          vocab: d.vocabByLevel[level].length,
          kanji: d.kanjiByLevel[level].length,
          grammar: d.grammarByLevel[level].length,
          reading: passages.length,
          listening: lessons.length,
        },
        ids: {
          vocab: d.vocabByLevel[level].map((v) => v.id),
          kanji: d.kanjiByLevel[level].map((k) => k.k),
          grammar: d.grammarByLevel[level].map((g) => g.id),
          reading: passages.map((p) => p.id),
          listening: lessons.map((l) => l.id),
        },
      });
    });
    return () => { alive = false; };
  }, [level]);

  const meta = LEVEL_META[level];
  const activeDays = cur ? clampPlanDays(cur.days) : 0;
  const previewDays = clampPlanDays(days);

  /* Шалгалтын огноо байвал түүн рүү, эс бөгөөс цаг + ALP-ийн тооцоогоор санал болгоно. */
  const examDays = useMemo(() => {
    const at = doc.profile.examDate ? new Date(doc.profile.examDate).getTime() : Number.NaN;
    return Number.isFinite(at) ? Math.ceil((at - Date.now()) / 86_400_000) : 0;
  }, [doc.profile.examDate]);

  useEffect(() => {
    if (!cur) setDays(examDays > 0 ? clampPlanDays(examDays) : suggestPlanDays(goal, meta.hours));
  }, [level, goal, cur, meta.hours, examDays]);

  const activeQuota = useMemo(() => (data && cur ? dailyQuota(data.content, activeDays) : null), [data, cur, activeDays]);
  const previewQuota = useMemo(() => (data ? dailyQuota(data.content, previewDays) : null), [data, previewDays]);
  const coverage = useMemo(() => (data ? planCoverage(doc, data.ids) : zeroQuota()), [doc, data]);
  const day = cur ? currentPlanDay(cur.startedAt, activeDays) : 0;
  const doneDays = activeQuota ? Math.min(activeDays, completedPlanDays(coverage, activeQuota)) : 0;
  const behind = cur ? planLag(day, doneDays) : 0;
  const writingToday = useMemo(
    () => Object.values(doc.writing).filter((w) => todayKey(new Date(w.at)) === todayKey()).length,
    [doc.writing],
  );
  /* Хойшлуулсан даалгавар — Today-той ижил бодит даалгаврын жагсаалтаас. */
  const done = useMemo(() => todayFromActivity(today, writingToday, cur?.level), [today, writingToday, cur?.level]);
  const mission = useMemo(
    () => (cur && data && activeQuota ? planMission({ quota: activeQuota, content: data.content, coverage, done, level: cur.level }) : []),
    [cur, data, activeQuota, coverage, done],
  );
  const skippedToday = useMemo(() => (cur
    ? skippedCount(buildTodayTasks({
      mission,
      level: cur.level,
      due: dueCards(doc.srs).length,
      reviews: today.reviews,
      newCards: today.newCards,
      started: [],
      skipped: readSkipped(localStorage, todayKey(), uid),
    }))
    : 0), [cur, mission, doc.srs, today.reviews, today.newCards, uid]);
  const schedule = useMemo(
    () => (cur && data && activeQuota ? planSchedule({ quota: activeQuota, content: data.content, coverage, day, days: activeDays }) : []),
    [cur, data, activeQuota, coverage, day, activeDays],
  );

  const minutes = activeQuota ? estimateMinutes(activeQuota) : 0;
  const previewMinutes = previewQuota ? estimateMinutes(previewQuota) : 0;
  const planMeta = cur ? CURRICULUM[cur.level] : undefined;
  const labels: Record<string, string> = {
    vocab: t.vocab, kanji: t.kanji, grammar: t.grammar, reading: t.reading, listening: t.listening,
  };
  const icons: Record<string, string> = { vocab: "語", kanji: "漢", grammar: "文", reading: "読", listening: "聴" };
  const contentByType: { id: keyof PlanContent; label: string; tone: "shu" | "ai" | "murasaki" | "matcha" | "kin" }[] = [
    { id: "vocab", label: t.vocab, tone: "shu" },
    { id: "kanji", label: t.kanji, tone: "ai" },
    { id: "grammar", label: t.grammar, tone: "murasaki" },
    { id: "reading", label: t.reading, tone: "matcha" },
    { id: "listening", label: t.listening, tone: "kin" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-jp text-[11.5px] tracking-[0.3em] text-shu-500">学習計画</p>
          <h1 className="mt-1 text-[1.7rem] font-extrabold leading-tight tracking-tight sm:text-[2rem]">{t.planHero}</h1>
          <p className="mt-1.5 text-[13.5px] text-sumi-500">{t.planHeroSub}</p>
        </div>
      </div>

      {cur ? (
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <Chip tone="shu">{t.activePlan}</Chip>
              <h2 className="mt-2.5 text-[1.35rem] font-extrabold">{t.planDaysN(cur.level, activeDays)}</h2>
              <p className="mt-1 text-[13px] text-sumi-500">
                {t.startedAt} {new Date(cur.startedAt).toLocaleDateString(language === "en" ? "en-US" : "mn-MN")} · {t.daysDone(doneDays, activeDays)}
              </p>
              {planMeta?.summary && <p className="mt-1.5 max-w-2xl text-[12.5px] text-sumi-500">{planMeta.summary}</p>}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => navigate("today")}>{t.todayOpenFlow}</Button>
              {skippedToday > 0 && (
                <a href={href("today")}>
                  <Chip tone="shu">{t.todaySkippedCount(skippedToday)}</Chip>
                </a>
              )}
              <Button variant="outline" size="sm" onClick={() => navigate(`mock?level=${cur.level}`)}>{t.mockExamBtn}</Button>
              <Button variant="outline" size="sm" onClick={() => {
                if (confirm(t.deletePlanQ)) actions.startCurriculum(cur.level, activeDays);
              }}>
                {t.restartPlan}
              </Button>
              <Button variant="danger" size="sm" onClick={() => { if (confirm(t.deletePlanQ)) actions.cancelCurriculum(); }}>
                {t.planDelete}
              </Button>
            </div>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <div className="card-flat px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-sumi-400">{t.currentDayRow}</p>
              <p className="mt-1 font-mono text-[1.5rem] font-extrabold tabnum leading-none">{day}</p>
            </div>
            <div className="card-flat px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-sumi-400">{t.lagRow}</p>
              <p className={cn("mt-1 font-mono text-[1.5rem] font-extrabold tabnum leading-none", behind > 0 && "text-shu-600")}>
                {behind > 0 ? `${behind} ${t.days}` : "—"}
              </p>
            </div>
            <div className="card-flat px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-sumi-400">{t.adjustedTime}</p>
              <p className="mt-1 font-mono text-[1.5rem] font-extrabold tabnum leading-none">{minutes} {t.minutes}</p>
            </div>
          </div>

          <Bar value={doneDays / Math.max(1, activeDays)} tone="shu" className="mt-5" height={8} />

          {behind > 0 && (
            <p className="mt-3 rounded-xl bg-shu-50 px-4 py-3 text-[12.5px] font-bold text-shu-700">
              {t.catchUp(behind, Math.min(200, Math.round(((day + 1) / Math.max(1, doneDays + 1)) * 100)))}
            </p>
          )}

          <SectionTitle jp="今日の仕事" title={t.planTodayTitle} sub={t.planAutoNote} />
          <div className="space-y-2">
            {mission.map((m) => {
              const pct = m.target > 0 ? Math.min(1, m.done / m.target) : 0;
              return (
                <a key={m.id} href={href(`today?focus=${m.id}`)} className="flex flex-wrap items-center gap-3 rounded-xl border border-sumi-900/8 bg-white/60 px-4 py-3 transition hover:border-shu-300">
                  <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg font-mincho text-[14px] font-bold",
                    pct >= 1 ? "bg-matcha-500 text-white" : "bg-sumi-900/6 text-sumi-600")}>
                    {pct >= 1 ? "✓" : icons[m.id]}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-bold text-sumi-800">{labels[m.id]}</span>
                    <Bar value={pct} tone={pct >= 1 ? "matcha" : "shu"} className="mt-1.5" height={4} />
                  </span>
                  <span className="shrink-0 font-mono text-[12.5px] font-bold tabnum text-sumi-500">
                    {m.done}/{m.target}
                  </span>
                </a>
              );
            })}
            {mission.length === 0 && (
              <p className="rounded-xl bg-matcha-50 px-4 py-3 text-[12.5px] font-bold text-matcha-700">{t.planDoneForNow}</p>
            )}
            {data && data.content.listening === 0 && (
              <p className="text-[11.5px] text-sumi-400">{t.planNoListening}</p>
            )}
          </div>

          <SectionTitle jp="今週の予定" title={t.upcomingDays} />
          <div className="space-y-2">
            {schedule.map((s) => (
              <div key={s.day} className={cn("flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3",
                s.done ? "border-matcha-200 bg-matcha-50/50" : s.current ? "border-shu-300 bg-shu-50/50" : "border-sumi-900/8 bg-white/60")}>
                <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg font-mono text-[12px] font-bold",
                  s.done ? "bg-matcha-500 text-white" : s.current ? "bg-shu-500 text-white" : "bg-sumi-900/6 text-sumi-600")}>
                  {s.done ? "✓" : s.day}
                </span>
                <div className="flex flex-wrap gap-x-3.5 gap-y-1 text-[12.5px] text-sumi-600">
                  {s.target.vocab > 0 && <span>{t.dayVocab(s.target.vocab)}</span>}
                  {s.target.kanji > 0 && <span>{t.dayKanji(s.target.kanji)}</span>}
                  {s.target.grammar > 0 && <span>{t.dayGrammar(s.target.grammar)}</span>}
                  {s.target.reading > 0 && <span>{t.dayReading(s.target.reading)}</span>}
                  {s.target.listening > 0 && <span>{t.dayListening(s.target.listening)}</span>}
                </div>
                <div className="ml-auto flex items-center gap-2">
                  {s.current && !s.done && <Chip tone="shu">{t.today}</Chip>}
                  {s.done && <Chip tone="matcha">{t.doneChip}</Chip>}
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : (
        <Card>
          <SectionTitle jp="計画を作る" title={t.newPlanTitle} sub={t.newPlanSub} />

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <p className="text-[12.5px] font-bold text-sumi-700">{t.targetLevelLabel}</p>
              <div className="mt-2 grid grid-cols-5 gap-2">
                {LEVELS.map((l) => (
                  <button key={l} onClick={() => setLevel(l)}
                    className={cn("rounded-xl border py-2.5 text-center transition",
                      level === l ? "border-shu-500 bg-shu-50 text-shu-700" : "border-sumi-900/10 bg-white/70 text-sumi-700 hover:border-sumi-900/25")}>
                    <span className="block font-mono text-[14px] font-extrabold">{l}</span>
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[12px] text-sumi-500">{LEVEL_LABEL[language][level]} · {(language === "en" ? meta.descEn : meta.desc).slice(0, 60)}…</p>
            </div>

            <div className="space-y-4">
              <label className="block">
                <span className="text-[12.5px] font-bold text-sumi-700">{t.daysLabel(days, Math.round(days / 30))}</span>
                <input type="range" min={14} max={365} step={7} value={days} onChange={(e) => setDays(clampPlanDays(Number(e.target.value)))} className="mt-2 w-full" />
              </label>
              <label className="block">
                <span className="text-[12.5px] font-bold text-sumi-700">{t.freeTimeLabel(goal)}</span>
                <input type="range" min={15} max={180} step={15} value={goal} onChange={(e) => setGoal(Number(e.target.value))} className="mt-2 w-full" />
              </label>
            </div>
          </div>

          {!data && <Spinner label={t.calcContent} lang={language} />}

          {data && previewQuota && (
            <div className="mt-6">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-[13px] font-extrabold">{t.dailyPlanTitle}</p>
                <p className="font-mono text-[12px] font-bold text-sumi-500">{t.planMinutes(previewMinutes)}</p>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {contentByType.filter((c) => data.content[c.id] > 0).map((c) => (
                  <div key={c.id} className="card-flat px-4 py-3">
                    <ProgressRow label={c.label} value={previewQuota[c.id]} max={Math.max(previewQuota[c.id], 1)} tone={c.tone} hint={t.totalHint(data.content[c.id])} />
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[11.5px] text-sumi-400">{t.planDerived}</p>
              {data.content.listening === 0 && <p className="mt-1 text-[11.5px] text-sumi-400">{t.planNoListening}</p>}
            </div>
          )}

          <div className="mt-6 rounded-2xl border border-sumi-900/10 bg-white/60 p-4">
            <p className="text-[13px] font-extrabold">{t.estTimeTitle}</p>
            <p className="mt-1 text-[12.5px] text-sumi-600">
              {t.estTimeBody(language === "en" ? meta.nameEn : meta.name, meta.hours[0], meta.hours[1], goal, Math.ceil((meta.hours[0] * 60) / Math.max(15, goal)), Math.ceil((meta.hours[1] * 60) / Math.max(15, goal)), days, days < Math.ceil((meta.hours[0] * 60) / Math.max(15, goal)) ? t.lessWord : t.moreWord)}
            </p>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <Button size="lg" disabled={!data} onClick={() => {
              actions.patchProfile({ target: level, dailyGoal: goal });
              actions.startCurriculum(level, days);
              navigate("home");
            }}>
              {t.startPlanBtn}
            </Button>
            <Button variant="outline" size="lg" onClick={() => navigate(`mock?level=${level}`)}>{t.placementFirst}</Button>
          </div>
        </Card>
      )}

      <Card>
        <SectionTitle jp="目標" title={t.reqTitle} />
        <div className="grid gap-3 sm:grid-cols-5">
          {LEVELS.map((l) => {
            const m = LEVEL_META[l];
            const on = l === level;
            return (
              <div key={l} className={cn("card-flat p-4", on && "border-shu-300 bg-shu-50/40")}>
                <div className="flex items-center justify-between">
                  <LevelBadge level={l} size="sm" />
                  <span className="text-[10.5px] text-sumi-400">{t.hoursN(m.hours[0])}</span>
                </div>
                <p className="mt-2.5 text-[12px] font-bold text-sumi-700">{t.kanjiN(m.kanji)}</p>
                <p className="text-[12px] font-bold text-sumi-700">{t.wordsN(m.vocab.toLocaleString())}</p>
                <p className="mt-2 text-[11px] leading-snug text-sumi-400">{language === "en" ? m.nameEn : m.name}</p>
              </div>
            );
          })}
        </div>
        <p className="mt-4 rounded-xl bg-sumi-900/[0.04] px-3.5 py-3 text-[11.5px] leading-relaxed text-sumi-500">
          {t.reqFoot}
        </p>
      </Card>

      <Card>
        <SectionTitle jp="試験日" title={t.examDateRow}
          sub={doc.profile.examDate ? t.untilDays(doc.profile.examDate, Math.max(0, Math.ceil((new Date(doc.profile.examDate).getTime() - Date.now()) / 86400000))) : t.noDate} />
        <Select value={doc.profile.target} onChange={(v) => actions.patchProfile({ target: v })}
          options={LEVELS.map((l) => ({ id: l, label: `${l} — ${LEVEL_LABEL[language][l]}` }))} />
        <p className="mt-3 text-[12px] text-sumi-500">
          {t.setDateIn}<a href={href("account")} className="font-bold text-ai-600 underline underline-offset-4">{t.accountSettingsLink}</a>{t.setDateInPost}
          {" "}{t.todayLabel} {todayKey()}
        </p>
      </Card>
    </div>
  );
}
