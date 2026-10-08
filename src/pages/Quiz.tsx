import { useEffect, useMemo, useState } from "react";
import { cn } from "../utils/cn";
import { navigate, useQuery } from "../lib/router";
import { useStore } from "../lib/store";
import { loadFullData } from "../lib/data";
import { QUIZ_MODES, buildQuiz, type QuizMode, type QuizSet } from "../lib/study";
import type { Level } from "../lib/types";
import { LEVELS } from "../lib/types";
import { Button, Card, Chip, LevelBadge, SectionTitle, Select, Spinner } from "../components/ui";
import { QuizRunner } from "../components/QuizRunner";
import { ui } from "../lib/i18n";

const TONES: Record<string, string> = {
  shu: "bg-shu-50 text-shu-600", ai: "bg-ai-50 text-ai-600",
  matcha: "bg-matcha-50 text-matcha-600", kin: "bg-kin-50 text-kin-600", murasaki: "bg-murasaki-50 text-murasaki-600",
};

export default function Quiz() {
  const { doc } = useStore();
  const language = doc.profile.language ?? "mn";
  const t = ui[language];
  const { query, set } = useQuery();
  const level = (query.level as Level) || (doc.profile.current === "zero" ? doc.profile.target : doc.profile.current);
  const mode = (query.mode as QuizMode) || null;
  const [count, setCount] = useState(15);
  const [set_, setSet] = useState<QuizSet | null>(null);
  const [loading, setLoading] = useState(false);

  const weakKinds = useMemo(() => {
    const m = new Map<string, { c: number; t: number }>();
    for (const q of doc.quizzes.slice(0, 30)) {
      const cur = m.get(q.kind) ?? { c: 0, t: 0 };
      cur.c += q.correct; cur.t += q.total; m.set(q.kind, cur);
    }
    return [...m.entries()].filter(([, v]) => v.t >= 8 && v.c / v.t < 0.7).map(([k]) => k);
  }, [doc.quizzes]);

  const start = async (m: QuizMode) => {
    setLoading(true);
    const data = await loadFullData();
    const result = buildQuiz(
      { mode: m, level, count: m === "mistakes" ? Math.max(5, doc.mistakes.length) : count, lang: language },
      { vocab: data.vocab, kanji: data.kanji, grammar: data.grammar, weakKinds, mistakeIds: doc.mistakes.map((x) => x.id) },
    );
    if (!result.questions.length) { setLoading(false); return; }
    setSet(result);
    set({ mode: m });
    setLoading(false);
  };

  useEffect(() => {
    if (mode && !set_) void start(mode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  if (set_) {
    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => { setSet(null); set({ mode: "" }); }}>{t.backToKinds}</Button>
          <Chip tone="ai">{(() => { const m2 = QUIZ_MODES.find((q) => q.id === set_.mode); return m2 ? (language === "en" ? m2.labelEn : m2.label) : set_.mode; })()}</Chip>
          <LevelBadge level={set_.level} size="sm" />
          <span className="text-[12px] text-sumi-400">{t.questionsN(set_.questions.length)}</span>
        </div>
        <QuizRunner
          questions={set_.questions}
          options={{ title: (() => { const m2 = QUIZ_MODES.find((q) => q.id === set_.mode); return m2 ? (language === "en" ? m2.labelEn : m2.label) : t.drillBtn; })(), reveal: true }}
          onClose={() => { setSet(null); set({ mode: "" }); }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-jp text-[11.5px] tracking-[0.3em] text-shu-500">練習問題</p>
          <h1 className="mt-1 text-[1.7rem] font-extrabold leading-tight tracking-tight sm:text-[2rem]">{t.quizHero}</h1>
          <p className="mt-1.5 text-[13.5px] text-sumi-500">
            {t.quizHeroSub}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={level} onChange={(v) => set({ level: v })} options={LEVELS.map((l) => ({ id: l, label: l }))} />
          <Select value={String(count)} onChange={(v) => setCount(Number(v))}
            options={[10, 15, 20, 30, 50].map((n) => ({ id: String(n), label: t.questionsN(n) }))} />
        </div>
      </div>

      {weakKinds.length > 0 && (
        <Card className="border-kin-200 bg-kin-50/60">
          <div className="flex flex-wrap items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-kin-500 font-mincho text-[18px] font-bold text-white">弱</span>
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-extrabold text-kin-700">{t.weakDetected}</p>
              <p className="mt-0.5 text-[12.5px] text-sumi-600">
                {t.weakDetectedSub(weakKinds.slice(0, 3).map((k) => { const m2 = QUIZ_MODES.find((q) => q.id === k); return m2 ? (language === "en" ? m2.labelEn : m2.label) : k; }).join(", "))}
              </p>
            </div>
            <Button onClick={() => start("weak")}>{t.drillWeakBtn}</Button>
          </div>
        </Card>
      )}

      {doc.mistakes.length > 0 && (
        <Card>
          <SectionTitle jp="間違い" title={t.mistakesTitle2}
            sub={t.mistakesCountSub(doc.mistakes.length)}
            right={<Button size="sm" variant="outline" onClick={() => navigate("mistakes")}>{t.detailsLink2}</Button>} />
          <div className="flex flex-wrap gap-2">
            {doc.mistakes.slice(0, 8).map((m) => (
              <Chip key={m.id} tone={m.count > 2 ? "shu" : "kin"}>
                <span className="font-jp">{m.prompt}</span> ×{m.count}
              </Chip>
            ))}
          </div>
          <Button className="mt-4" onClick={() => start("mistakes")}>{t.drillMistakesBtn}</Button>
        </Card>
      )}

      <SectionTitle jp="形式を選ぶ" title={t.pickKind} sub={t.pickKindSub(level, count)} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {QUIZ_MODES.map((q) => (
          <button key={q.id} onClick={() => start(q.id)} disabled={loading}
            className="card flex items-start gap-3.5 p-4 text-left transition hover:-translate-y-1 hover:border-shu-300 disabled:opacity-50">
            <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-xl font-mincho text-[19px] font-bold", TONES[q.tone])}>
              {q.icon}
            </span>
            <span className="min-w-0">
              <span className="block text-[14px] font-extrabold text-sumi-900">{language === "en" ? q.labelEn : q.label}</span>
              <span className="mt-0.5 block text-[12px] leading-snug text-sumi-500">{language === "en" ? q.descEn : q.desc}</span>
            </span>
          </button>
        ))}
      </div>

      {loading && <Spinner label={t.genQ2} lang={language} />}

      <Card className="bg-sumi-900 text-washi-50">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-jp text-[10.5px] tracking-[0.28em] text-washi-400">模擬試験</p>
            <h3 className="mt-1 text-[1.25rem] font-extrabold">{t.fullMockCta}</h3>
            <p className="mt-1.5 max-w-xl text-[13px] text-washi-300">
              {t.fullMockBody}
            </p>
          </div>
          <Button size="lg" onClick={() => navigate("mock")}>{t.mockExamBtn}</Button>
        </div>
      </Card>
    </div>
  );
}
