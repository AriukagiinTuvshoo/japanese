import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "../utils/cn";
import { href, navigate } from "../lib/router";
import { useStore } from "../lib/store";
import type { Question } from "../lib/study";
import { Bar, Button, Chip, Furigana, LevelBadge, Ring } from "./ui";
import { speak } from "./ui";
import { relTime } from "../lib/text";
import { ui } from "../lib/i18n";

export interface QuizResult {
  correct: number;
  total: number;
  minutes: number;
  wrong: Question[];
}

/** Дуудагчийн тохиргоо. */
export interface RunnerOptions {
  /** Шалгалтын горим: таймер, явцын хязгаарлалт. */
  timed?: number;          // минутаар
  /** Асуулт бүрийн дараа тайлбар харуулах эсэх (шалгалтад үгүй). */
  reveal?: boolean;
  /** Асуулт бүрийн дараа автоматаар дараагийнх руу. */
  autoNext?: boolean;
  title?: string;
  sectionLabel?: (q: Question) => string;
  onFinish?: (r: QuizResult) => void;
  /** Дараагийн хэсэг рүү шилжих. */
  nextLabel?: string;
  onNext?: () => void;
}

export function QuizRunner({
  questions, options = {}, onClose,
}: {
  questions: Question[];
  options?: RunnerOptions;
  onClose?: () => void;
}) {
  const { actions, doc } = useStore();
  const language = doc.profile.language ?? "mn";
  const t = ui[language];
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [answers, setAnswers] = useState<(number | null)[]>(() => questions.map(() => null));
  const [done, setDone] = useState(false);
  const startRef = useRef(Date.now());
  const [left, setLeft] = useState<number | null>(options.timed ? options.timed * 60 : null);
  const wrongRef = useRef<Question[]>([]);

  const q = questions[idx];
  const total = questions.length;

  /* ── таймер ── */
  useEffect(() => {
    if (left === null || done) return;
    if (left <= 0) { setDone(true); return; }
    const t = setTimeout(() => setLeft((l) => (l === null ? null : l - 1)), 1000);
    return () => clearTimeout(t);
  }, [left, done]);

  /* ── дуусгах ── */
  const finish = useCallback((finalAnswers: (number | null)[]) => {
    const correct = questions.reduce((a, qq, i) => a + (finalAnswers[i] === qq.answer ? 1 : 0), 0);
    const minutes = Math.max(1, Math.round((Date.now() - startRef.current) / 60000));
    const wrong = questions.filter((qq, i) => finalAnswers[i] !== qq.answer);
    wrongRef.current = wrong;

    actions.logQuiz({
      kind: options.title ?? q?.kind ?? "quiz",
      level: q?.level ?? "N5",
      correct,
      total,
      minutes,
    });

    // Алдааны дэвтэрт бүртгэх
    const mistakes = wrong
      .map((qq) => {
        const i = questions.indexOf(qq);
        return {
          id: qq.refId ?? qq.refKanji ?? qq.id,
          kind: qq.kind,
          level: qq.level,
          prompt: qq.prompt,
          answer: qq.options[qq.answer] ?? "",
          given: finalAnswers[i] !== null ? qq.options[finalAnswers[i] as number] ?? "—" : "—",
          note: qq.promptSub,
        };
      })
      .filter((m) => !!m.id);
    if (mistakes.length) actions.addMistakes(mistakes);
    // Зөв хариулсан алдаануудыг хасах
    questions.forEach((qq, i) => {
      if (finalAnswers[i] === qq.answer) actions.resolveMistake(qq.refId ?? qq.refKanji ?? qq.id);
    });

    setDone(true);
    options.onFinish?.({ correct, total, minutes, wrong });
  }, [questions, actions, options, q, total]);

  const choose = (i: number) => {
    if (picked !== null || done) return;
    setPicked(i);
    setAnswers((a) => {
      const next = a.slice();
      next[idx] = i;
      return next;
    });
    if (options.autoNext) {
      window.setTimeout(() => advance(i), 450);
    }
  };

  const advance = (override?: number) => {
    const answersNow = answers.slice();
    if (override !== undefined) answersNow[idx] = override;
    if (idx + 1 >= total) {
      finish(answersNow);
    } else {
      setIdx(idx + 1);
      setPicked(null);
    }
  };

  /* ── keyboard ── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (picked === null && /^[1-4]$/.test(e.key)) choose(Number(e.key) - 1);
      else if (e.key === "Enter" && picked !== null) advance();
      else if (e.key === "ArrowRight" && picked !== null) advance();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  /* ── сонсголтой асуулт: автоматаар тоглуулах ── */
  useEffect(() => {
    if (q?.audio) {
      const t = setTimeout(() => speak(q.audio!, doc.profile.rate), 350);
      return () => clearTimeout(t);
    }
  }, [q, doc.profile.rate]);

  const stats = useMemo(() => {
    const answered = answers.filter((a) => a !== null).length;
    const correct = answers.filter((a, i) => a !== null && a === questions[i].answer).length;
    return { answered, correct };
  }, [answers, questions]);

  if (!total) {
    return (
      <div className="grid place-items-center rounded-2xl border border-dashed border-sumi-900/15 bg-white/40 px-6 py-14 text-center">
        <span className="font-mincho text-[2.4rem] font-bold text-sumi-900/12">無</span>
        <p className="mt-2 text-[14px] font-extrabold text-sumi-700">{t.emptyQTitle}</p>
        <p className="mt-1 text-[12.5px] text-sumi-500">{t.emptyQSub}</p>
        {onClose && <Button className="mt-4" onClick={onClose}>{t.backBtn}</Button>}
      </div>
    );
  }

  if (done) {
    return (
      <ResultView
        questions={questions}
        answers={answers}
        minutes={Math.max(1, Math.round((Date.now() - startRef.current) / 60000))}
        onRetry={() => {
          setIdx(0); setPicked(null); setAnswers(questions.map(() => null)); setDone(false);
          startRef.current = Date.now();
          if (options.timed) setLeft(options.timed * 60);
        }}
        onClose={onClose}
        onNext={options.onNext}
        nextLabel={options.nextLabel}
        title={options.title}
      />
    );
  }

  const isCorrect = picked !== null && picked === q.answer;
  const showReveal = options.reveal !== false && picked !== null;

  return (
    <div className="mx-auto max-w-3xl">
      {/* ── толгой ── */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <LevelBadge level={q.level} size="sm" />
            <Chip tone="sumi">{options.sectionLabel?.(q) ?? q.section}</Chip>
            {q.kind === "grammar" && <Chip tone="murasaki">{t.grammarChip}</Chip>}
          </div>
          <p className="mt-1.5 font-mono text-[12px] font-bold tabnum text-sumi-500">
            {t.questionN} {idx + 1} / {total}
            {stats.answered > 0 && <> · {t.correctShort} {stats.correct}</>}
          </p>
        </div>
        {left !== null && <Timer seconds={left} />}
        <div className="flex items-center gap-2">
          {onClose && <Button size="sm" variant="ghost" onClick={onClose}>{t.exitShort}</Button>}
        </div>
      </div>
      <Bar value={(idx + (picked !== null ? 1 : 0)) / total} tone="ai" height={5} />

      {/* ── асуулт ── */}
      <div key={q.id} className="card mt-5 animate-rise p-6 sm:p-7">
        <div className="flex items-start gap-4">
          {q.audio ? (
            <button
              onClick={() => speak(q.audio!, doc.profile.rate)}
              className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-ai-50 text-[26px] text-ai-600 transition hover:bg-ai-100"
              aria-label={t.listenAgain}
            >
              🔊
            </button>
          ) : null}
          <div className="min-w-0 flex-1">
            <p
              className={cn(
                "font-jp font-bold leading-snug text-sumi-900",
                q.prompt.length <= 4 ? "text-[2.4rem]" : q.prompt.length <= 14 ? "text-[1.7rem]" : "text-[1.15rem]",
              )}
            >
              {q.prompt}
            </p>
            {q.promptSub && <p className="mt-1.5 text-[13px] font-bold text-sumi-500">{q.promptSub}</p>}
          </div>
          {q.audio && (
            <Button size="sm" variant="ghost" onClick={() => speak(q.audio!, Math.max(0.6, doc.profile.rate - 0.25))}>{t.slowBtn}</Button>
          )}
        </div>

        {/* ── сонголтууд ── */}
        <div className="mt-6 space-y-2.5">
          {q.options.map((o, i) => {
            const isAnswer = i === q.answer;
            const isPicked = picked === i;
            return (
              <button
                key={i}
                onClick={() => choose(i)}
                disabled={picked !== null}
                className={cn(
                  "flex w-full items-center gap-3.5 rounded-xl border-2 px-4 py-3.5 text-left transition-all",
                  picked === null && "border-sumi-900/10 bg-white/70 hover:-translate-y-0.5 hover:border-ai-400 hover:bg-white",
                  showReveal && isAnswer && "border-matcha-400 bg-matcha-50",
                  showReveal && isPicked && !isAnswer && "animate-[shake_0.4s] border-shu-400 bg-shu-50",
                  picked !== null && !isAnswer && !isPicked && "border-sumi-900/8 bg-white/40 opacity-60",
                )}
              >
                <span className={cn(
                  "grid h-8 w-8 shrink-0 place-items-center rounded-lg font-mono text-[13px] font-extrabold",
                  showReveal && isAnswer ? "bg-matcha-500 text-white"
                    : showReveal && isPicked ? "bg-shu-500 text-white"
                    : "bg-sumi-900/6 text-sumi-600",
                )}>
                  {showReveal && isAnswer ? "✓" : showReveal && isPicked ? "✕" : i + 1}
                </span>
                <Furigana text={o} className="text-[15px] font-semibold text-sumi-900" show={false} />
              </button>
            );
          })}
        </div>

        {/* ── тайлбар ── */}
        {showReveal && (
          <div className={cn("mt-5 animate-pop rounded-2xl border p-4", isCorrect ? "border-matcha-200 bg-matcha-50" : "border-shu-200 bg-shu-50")}>
            <p className={cn("text-[14px] font-extrabold", isCorrect ? "text-matcha-600" : "text-shu-700")}>
              {isCorrect ? `✓ ${t.correct2}` : `✕ ${t.wrong2}`}
            </p>
            {q.explain && (
              <p className="mt-2 whitespace-pre-line text-[13.5px] leading-relaxed text-sumi-700">{q.explain}</p>
            )}
            {q.example?.ja && (
              <div className="mt-3 border-t border-sumi-900/8 pt-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-sumi-400">{t.exampleLabel}</p>
                <p className="mt-1"><Furigana text={q.example.ja} className="text-[15px] font-semibold text-sumi-900" /></p>
                {(q.example.mn || q.example.en) && (
                  <p className="mt-1 text-[13px] text-sumi-600">{language === "en" ? q.example.en ?? q.example.mn : q.example.mn ?? q.example.en}</p>
                )}
              </div>
            )}
            {(q.refId || q.refKanji) && (
              <a
                href={href(q.refKanji ? "kanji" : "vocab", q.refKanji ?? q.refId!)}
                className="mt-3 inline-block text-[12.5px] font-bold text-ai-600 underline underline-offset-4"
              >
                {q.refKanji ? t.kanjiDetailLink : t.wordDetailLink}
              </a>
            )}
          </div>
        )}

        <div className="mt-5 flex items-center gap-3">
          {picked !== null ? (
            <Button size="lg" onClick={() => advance()} className="flex-1 sm:flex-none">
              {idx + 1 >= total ? t.finishBtn2 : t.nextBtn}
            </Button>
          ) : (
            <p className="text-[12.5px] text-sumi-400">{t.chooseAnswer}</p>
          )}
          {picked === null && idx + 1 < total && (
            <Button variant="ghost" size="sm" className="ml-auto" onClick={() => advance(-1)}>{t.skipBtn}</Button>
          )}
          {picked !== null && idx + 1 < total && (
            <Button variant="ghost" size="sm" className="ml-auto" onClick={() => finish(answers.slice())}>{t.finishShort}</Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Timer({ seconds }: { seconds: number }) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  const low = seconds < 120;
  return (
    <div className={cn("flex items-center gap-2 rounded-xl border px-3 py-1.5", low ? "animate-pulse border-shu-200 bg-shu-50" : "border-sumi-900/10 bg-white/70")}>
      <span className="text-[13px]">⏱</span>
      <span className={cn("font-mono text-[15px] font-extrabold tabnum", low ? "text-shu-600" : "text-sumi-900")}>
        {String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
      </span>
    </div>
  );
}

/* ─────────────── Үр дүн ─────────────── */
export function ResultView({
  questions, answers, minutes, onRetry, onClose, onNext, nextLabel, title,
}: {
  questions: Question[];
  answers: (number | null)[];
  minutes: number;
  onRetry: () => void;
  onClose?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  title?: string;
}) {
  const { doc } = useStore();
  const language = doc.profile.language ?? "mn";
  const t = ui[language];
  const correct = questions.reduce((a, q, i) => a + (answers[i] === q.answer ? 1 : 0), 0);
  const total = questions.length;
  const pct = total ? correct / total : 0;

  const bySection = useMemo(() => {
    const m = new Map<string, { correct: number; total: number }>();
    questions.forEach((q, i) => {
      const cur = m.get(q.section) ?? { correct: 0, total: 0 };
      cur.total += 1;
      if (answers[i] === q.answer) cur.correct += 1;
      m.set(q.section, cur);
    });
    return [...m.entries()].map(([name, v]) => ({ name, ...v, pct: v.correct / Math.max(1, v.total) }));
  }, [questions, answers]);

  const wrong = questions.filter((q, i) => answers[i] !== q.answer);
  const weakest = [...bySection].sort((a, b) => a.pct - b.pct)[0];

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="card p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-6">
          <Ring value={pct} size={110} stroke={9} tone={pct >= 0.6 ? "matcha" : pct >= 0.4 ? "kin" : "shu"}>
            <div className="text-center">
              <p className="font-mono text-[1.7rem] font-extrabold leading-none tabnum text-sumi-900">{Math.round(pct * 100)}%</p>
              <p className="mt-0.5 text-[10.5px] font-bold text-sumi-400">{t.pointsUnit}</p>
            </div>
          </Ring>
          <div className="min-w-0 flex-1">
            <p className="font-jp text-[11px] tracking-[0.3em] text-sumi-400">結果</p>
            <h2 className="mt-1 text-[1.5rem] font-extrabold">{title ?? t.resultTitle}</h2>
            <p className="mt-2 text-[13.5px] text-sumi-600">
              {t.resultOf(correct, total, minutes)}
            </p>
            <p className="mt-1 text-[12px] text-sumi-400">{t.practiceScoreNote}</p>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          {bySection.map((s) => (
            <div key={s.name}>
              <div className="flex items-baseline justify-between">
                <span className="text-[13px] font-bold text-sumi-700">{s.name}</span>
                <span className="font-mono text-[12px] font-bold tabnum text-sumi-500">{s.correct}/{s.total} · {Math.round(s.pct * 100)}%</span>
              </div>
              <Bar value={s.pct} tone={s.pct >= 0.7 ? "matcha" : s.pct >= 0.5 ? "kin" : "shu"} className="mt-1.5" height={7} />
            </div>
          ))}
        </div>

        {weakest && weakest.pct < 0.7 && (
          <div className="mt-6 rounded-2xl border border-kin-200 bg-kin-50 p-4">
            <p className="text-[13.5px] font-extrabold text-kin-600">{t.weakest(weakest.name)}</p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-sumi-600">{t.weakestSub(Math.round(weakest.pct * 100))}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => navigate(`quiz?mode=mixed&level=${questions[0]?.level ?? "N5"}`)}>{t.mixedDrill}</Button>
              <Button size="sm" variant="outline" onClick={() => navigate("review")}>{t.srsReviewBtn}</Button>
              <Button size="sm" variant="outline" onClick={() => navigate("mistakes")}>{t.mistakesBtn}</Button>
            </div>
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-2">
          <Button onClick={onRetry}>{t.retryBtn}</Button>
          {onNext && <Button variant="outline" onClick={onNext}>{nextLabel ?? t.nextSectionBtn}</Button>}
          {onClose && <Button variant="ghost" onClick={onClose}>{t.exitShort}</Button>}
          <Button variant="ghost" className="ml-auto" onClick={() => navigate("progress")}>{t.viewProgressBtn}</Button>
        </div>
      </div>

      {wrong.length > 0 && (
        <div className="card p-5">
          <p className="text-[13.5px] font-extrabold text-sumi-900">{t.wrongTitle(wrong.length)}</p>
          <ul className="mt-3 divide-y divide-sumi-900/8">
            {wrong.map((q) => {
              const i = questions.indexOf(q);
              return (
                <li key={q.id} className="py-3">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md bg-shu-50 text-[12px] text-shu-600">✕</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-jp text-[15px] font-bold text-sumi-900">{q.prompt}</p>
                      {q.promptSub && <p className="text-[12px] text-sumi-500">{q.promptSub}</p>}
                      <p className="mt-1 text-[12.5px] text-sumi-600">
                        {t.correctLabel} <span className="font-bold text-matcha-600">{q.options[q.answer] ?? "—"}</span>
                        {answers[i] !== null && <> · {t.yourAnswerLabel} <span className="font-bold text-shu-600">{q.options[answers[i] as number] ?? "—"}</span></>}
                        {answers[i] === null && <> · {t.unanswered}</>}
                      </p>
                    </div>
                    <span className="shrink-0 text-[11px] text-sumi-400">{relTime(Date.now(), language)}</span>
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-[12px] text-sumi-500">
            {t.loggedPre}<a href={href("mistakes")} className="font-bold text-ai-600 underline underline-offset-4">{t.loggedLink}</a>{t.loggedPost}
          </p>
        </div>
      )}
    </div>
  );
}
