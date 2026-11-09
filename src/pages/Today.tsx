import { useEffect, useMemo, useState } from "react";
import { cn } from "../utils/cn";
import { href, navigate, useQuery } from "../lib/router";
import { useStore } from "../lib/store";
import { LISTENING, READING, loadFullData } from "../lib/data";
import type { Level } from "../lib/types";
import { todayKey } from "../lib/text";
import {
  currentPlanDay, dailyQuota, estimateMinutes, planCoverage, planMission, todayFromActivity,
  type PlanContent, type PlanIds,
} from "../lib/plan";
import {
  addSkipped, addStarted, buildTodayTasks, canSkip, flowSummary, nextTask, pruneSkipped, readSkipped, readStarted,
  removeSkipped, type TodayTask,
} from "../lib/today";
import { dueCards } from "../lib/srs";
import { Bar, Button, Card, Chip, Empty, LevelBadge, PageHeader, Spinner } from "../components/ui";
import { ui } from "../lib/i18n";

export default function Today() {
  const { doc, uid, today } = useStore();
  const { query } = useQuery();
  const language = doc.profile.language ?? "mn";
  const t = ui[language];
  const cur = doc.curriculum;
  const level: Level = cur?.level ?? doc.profile.target;
  const [data, setData] = useState<{ content: PlanContent; ids: PlanIds } | null>(null);
  const [started, setStarted] = useState<string[]>(() => readStarted(localStorage, todayKey(), uid));
  const [skipped, setSkipped] = useState<string[]>(() => readSkipped(localStorage, todayKey(), uid));

  /* Нэвтрэлт солигдоход өдрийн UI төлөв ч өөр хэрэглэгчийн түлхүүрээс уншина. */
  useEffect(() => {
    setStarted(readStarted(localStorage, todayKey(), uid));
    setSkipped(readSkipped(localStorage, todayKey(), uid));
  }, [uid]);

  /* Контентын хэмжээ/ID — зөвхөн идэвхтэй планы түвшнээс. */
  useEffect(() => {
    if (!cur) { setData(null); return; }
    let alive = true;
    loadFullData().then((d) => {
      if (!alive) return;
      const passages = READING.filter((r) => r.level === cur.level);
      const lessons = LISTENING.filter((l) => l.level === cur.level && (!l.status || l.status === "approved"));
      setData({
        content: {
          vocab: d.vocabByLevel[cur.level].length,
          kanji: d.kanjiByLevel[cur.level].length,
          grammar: d.grammarByLevel[cur.level].length,
          reading: passages.length,
          listening: lessons.length,
        },
        ids: {
          vocab: d.vocabByLevel[cur.level].map((v) => v.id),
          kanji: d.kanjiByLevel[cur.level].map((k) => k.k),
          grammar: d.grammarByLevel[cur.level].map((g) => g.id),
          reading: passages.map((p) => p.id),
          listening: lessons.map((l) => l.id),
        },
      });
    });
    return () => { alive = false; };
    // Түвшин солигдоход л дахин ачаална.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur?.level]);

  const writingToday = useMemo(
    () => Object.values(doc.writing).filter((w) => todayKey(new Date(w.at)) === todayKey()).length,
    [doc.writing],
  );
  /* Зөвхөн идэвхтэй планы түвшний шинэ карт — бусад түвшний карт өнөөдрийн явцад орохгүй. */
  const done = useMemo(() => todayFromActivity(today, writingToday, cur?.level), [today, writingToday, cur?.level]);
  const dueCount = useMemo(() => dueCards(doc.srs).length, [doc.srs]);
  const quota = useMemo(() => (data && cur ? dailyQuota(data.content, cur.days) : null), [data, cur]);
  const coverage = useMemo(() => (data ? planCoverage(doc, data.ids) : null), [doc, data]);
  const mission = useMemo(
    () => (cur && data && quota && coverage
      ? planMission({ quota, content: data.content, coverage, done, level: cur.level })
      : []),
    [cur, data, quota, coverage, done],
  );
  const tasks = useMemo(
    () => buildTodayTasks({
      mission, level, due: dueCount, reviews: today.reviews, newCards: today.newCards, started, skipped,
    }),
    [mission, level, dueCount, today.reviews, today.newCards, started, skipped],
  );
  const summary = flowSummary(tasks);
  const next = nextTask(tasks);
  const mainTasks = tasks.filter((task) => !task.skipped);
  const skippedTasks = tasks.filter((task) => task.skipped);
  const openMain = mainTasks.filter((task) => task.status !== "done");

  /* Бодитоор дууссан, байхгүй болсон эсвэл өнөөдрийн даалгаварт ороогүй
     хуучирсан skip бичлэгийг цэвэрлэнэ — Home/Plan-ийн тоо ижил байхын тулд. */
  useEffect(() => {
    if (!data) return;
    const next = pruneSkipped(localStorage, todayKey(), skippedTasks.map((task) => task.id), uid);
    if (next.length !== skipped.length) setSkipped(next);
  }, [data, skippedTasks, skipped.length, uid]);
  const focus = query.focus;
  const day = cur ? currentPlanDay(cur.startedAt, cur.days) : 0;
  const minutes = quota ? estimateMinutes(quota) : 0;

  const labels: Record<string, string> = {
    vocab: t.vocab, kanji: t.kanji, grammar: t.grammar, reading: t.reading, listening: t.listening, review: t.todayReview,
  };
  const icons: Record<string, string> = { vocab: "語", kanji: "漢", grammar: "文", reading: "読", listening: "聴", review: "復" };

  const open = (task: TodayTask) => {
    // Зөвхөн «эхэлсэн» UI төлөв — ахиц/XP/activity хөндөхгүй.
    setStarted(addStarted(localStorage, todayKey(), task.id, uid));
    navigate(task.to);
  };

  /* Зөвхөн localStorage — duussan/XP/SRS-д хүрэхгүй. */
  const skip = (task: TodayTask) => {
    if (!canSkip(task)) return;
    setSkipped(addSkipped(localStorage, todayKey(), task.id, uid));
  };
  const resume = (task: TodayTask) => setSkipped(removeSkipped(localStorage, todayKey(), task.id, uid));

  const statusChip = (task: TodayTask) => {
    if (task.status === "done") return <Chip tone="matcha">✓ {t.todayStatusDone}</Chip>;
    if (task.skipped) return <Chip tone="sumi">↷ {t.todaySkippedChip}</Chip>;
    if (task.status === "active") return <Chip tone="kin">▶ {t.todayStatusActive}</Chip>;
    return <Chip tone="sumi">○ {t.todayStatusTodo}</Chip>;
  };

  const actionLabel = (task: TodayTask) =>
    task.status === "done" ? t.todayOpen : task.status === "active" ? t.todayContinue : t.todayStart;

  if (!cur) {
    return (
      <div className="space-y-6">
        <PageHeader jp="今日の学習" title={t.todayHero} sub={t.todayHeroSub} />
        <Card>
          <Empty
            icon="計"
            title={t.todayNoPlanTitle}
            sub={t.todayNoPlanBody}
            action={<Button onClick={() => navigate("plan")}>{t.todayGoPlan}</Button>}
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        jp="今日の学習"
        title={t.todayHero}
        sub={t.todayHeroSub}
        actions={
          <>
            <LevelBadge level={cur.level} />
            <Chip tone="sumi">{t.todayDay(day, cur.days)}</Chip>
            <Chip tone={summary.remaining === 0 ? "matcha" : "kin"}>{t.todayTasks(summary.completed, summary.total)}</Chip>
          </>
        }
      />

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wide text-sumi-400">{t.todayProgressLabel}</p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-sumi-500">{t.planMinutes(minutes)} · {t.todayAutoNote}</p>
          </div>
          <p className="font-mono text-[1.4rem] font-extrabold tabnum text-sumi-900">{Math.round(summary.pct * 100)}%</p>
        </div>
        <Bar value={summary.pct} tone={summary.remaining === 0 ? "matcha" : "shu"} className="mt-3" height={8} />

        {!data && <Spinner label={t.calcContent} lang={language} />}

        {data && next && (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-shu-200 bg-shu-50/60 px-4 py-3">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wide text-shu-600">{t.todayNextTitle}</p>
              <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[14px] font-extrabold text-sumi-900">
                <span className="font-mincho text-[15px]">{icons[next.id]}</span>
                {labels[next.id]}
                {next.skipped
                  ? <Chip tone="sumi">{t.todaySkippedChip}</Chip>
                  : next.status === "active" && <Chip tone="kin">{t.todayStatusActive}</Chip>}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {next.skipped && (
                <Button size="sm" variant="outline" onClick={() => resume(next)}>{t.todayResume}</Button>
              )}
              <Button onClick={() => open(next)}>
                {next.skipped ? t.todayReturnTask : actionLabel(next)} →
              </Button>
            </div>
          </div>
        )}

        {data && tasks.length === 0 && (
          <div className="mt-5">
            <Empty
              icon="✓"
              title={t.todayAllDoneTitle}
              sub={t.todayAllDoneBody}
              action={<Button variant="outline" onClick={() => navigate("plan")}>{t.todayGoPlan}</Button>}
            />
          </div>
        )}

        {data && skippedTasks.length > 0 && openMain.length === 0 && (
          <p className="mt-5 rounded-xl bg-sumi-900/4 px-4 py-3 text-[12.5px] font-bold text-sumi-600">
            {t.todayAllSkipped}
          </p>
        )}

        {data && mainTasks.length > 0 && (
          <div className="mt-5 space-y-2.5">
            {mainTasks.map((task) => {
              const pct = task.target > 0 ? Math.min(1, task.done / task.target) : 0;
              const focused = focus === task.id;
              return (
                <div
                  key={task.id}
                  className={cn(
                    "rounded-xl border px-4 py-3 transition",
                    task.status === "done" ? "border-matcha-200 bg-matcha-50/40"
                      : focused ? "border-shu-400 bg-shu-50/40 ring-2 ring-shu-500/15"
                        : "border-sumi-900/10 bg-white/70",
                  )}
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <span className={cn(
                      "grid h-9 w-9 shrink-0 place-items-center rounded-lg font-mincho text-[15px] font-bold",
                      task.status === "done" ? "bg-matcha-500 text-white"
                        : task.status === "active" ? "bg-kin-400 text-white"
                          : "bg-sumi-900/6 text-sumi-600",
                    )}>
                      {task.status === "done" ? "✓" : icons[task.id]}
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 text-[13.5px] font-bold text-sumi-900">
                        {labels[task.id]}
                        {statusChip(task)}
                        {focused && <Chip tone="shu">{t.todayFocusChip}</Chip>}
                      </p>
                      <p className="mt-0.5 text-[11.5px] text-sumi-500">
                        {task.id === "review" ? t.todayReviewSub(dueCount) : t.planRemaining(Math.max(0, task.target - task.done))}
                      </p>
                      <div className="mt-2 flex items-center gap-3">
                        <Bar value={pct} tone={task.status === "done" ? "matcha" : "shu"} className="flex-1" height={5} />
                        <span className="shrink-0 font-mono text-[12px] font-bold tabnum text-sumi-500">{task.done}/{task.target}</span>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5">
                      <Button
                        size="sm"
                        variant={task.status === "done" ? "outline" : "primary"}
                        onClick={() => open(task)}
                        aria-label={`${labels[task.id]} — ${actionLabel(task)}`}
                      >
                        {actionLabel(task)}
                      </Button>
                      {canSkip(task) && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => skip(task)}
                          title={t.todaySkipNote}
                          aria-label={`${labels[task.id]} — ${t.todaySkip}`}
                        >
                          {t.todaySkip}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {data && skippedTasks.length > 0 && (
          <div className="mt-5 rounded-xl border border-dashed border-sumi-900/15 bg-sumi-900/2 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wide text-sumi-400">{t.todaySkippedTitle}</p>
                <p className="mt-0.5 text-[11.5px] text-sumi-500">{t.todaySkippedSub}</p>
              </div>
              <Chip tone="sumi">{skippedTasks.length}</Chip>
            </div>
            <div className="mt-3 space-y-2">
              {skippedTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex flex-wrap items-center gap-3 rounded-lg border border-sumi-900/8 bg-white/70 px-3 py-2.5"
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-sumi-900/6 font-mincho text-[14px] font-bold text-sumi-600">
                    {icons[task.id]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-[13px] font-bold text-sumi-900">
                      {labels[task.id]}
                      {statusChip(task)}
                    </p>
                    <p className="mt-0.5 text-[11.5px] text-sumi-500">
                      {task.id === "review" ? t.todayReviewSub(dueCount) : t.planRemaining(Math.max(0, task.target - task.done))}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Button size="sm" variant="ghost" onClick={() => resume(task)}>{t.todayResume}</Button>
                    <Button size="sm" variant="outline" onClick={() => open(task)}>{t.todayReturnTask}</Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-sumi-900/8 pt-3">
          <p className="text-[11.5px] text-sumi-400">{t.planDerived}</p>
          <a href={href("plan")} className="text-[12px] font-bold text-ai-600 underline underline-offset-4">{t.planLink}</a>
        </div>
      </Card>
    </div>
  );
}
