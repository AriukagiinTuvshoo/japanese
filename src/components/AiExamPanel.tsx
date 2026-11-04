import { useState } from "react";
import { cn } from "../utils/cn";
import type { Level } from "../lib/types";
import type { Question } from "../lib/study";
import { AI_SECTIONS, type AiSection } from "../lib/aiExam";
import { requestAiExam } from "../lib/aiClient";
import { Button, Card, Chip, SectionTitle } from "./ui";

const TEXT = {
  mn: {
    title: "AI дасгал үүсгэх",
    sub: "Gemini асуулт зохиож, сервер дээр схем/хариулт/тайлбарын шалгалтад оруулна.",
    section: "Хэсэг",
    count: "Асуултын тоо",
    focus: "Миний алдаануудад төвлөрөх",
    focusOff: "Алдааны дэвтэр хоосон байна",
    generate: "AI дасгал эхлүүлэх",
    loading: "AI асуулт үүсгэж байна…",
    done: (n: number, model: string, rejected: number) =>
      `${n} асуулт бэлэн (${model})` + (rejected > 0 ? ` · ${rejected} татгалзсан` : ""),
    setup: "Серверт GEMINI_API_KEY тохируулаагүй байна. Түлхүүргүйгээр AI дасгал ажиллахгүй.",
    disclaimer: "AI үүсгэсэн асуулт — албан ёсны JLPT асуулт БИШ. Хүчинтэй байх шалгалтыг давсан ч агуулга нь алдаатай байж болно.",
  },
  en: {
    title: "Generate with AI",
    sub: "Gemini writes the questions; the server validates schema, answer and explanation before they reach you.",
    section: "Section",
    count: "Questions",
    focus: "Focus on my mistakes",
    focusOff: "Your mistake log is empty",
    generate: "Start AI practice",
    loading: "Generating questions…",
    done: (n: number, model: string, rejected: number) =>
      `${n} questions ready (${model})` + (rejected > 0 ? ` · ${rejected} rejected` : ""),
    setup: "GEMINI_API_KEY is not configured on the server, so AI practice cannot run.",
    disclaimer: "AI-generated questions — NOT official JLPT questions. Validation is structural; content can still be wrong.",
  },
} as const;

const SECTION_LABEL: Record<AiSection, { mn: string; en: string }> = {
  vocabulary: { mn: "Үгийн сан", en: "Vocabulary" },
  grammar: { mn: "Дүрэм", en: "Grammar" },
  reading: { mn: "Уншлага", en: "Reading" },
  kanji: { mn: "Ханз", en: "Kanji" },
  listening: { mn: "Сонсгол", en: "Listening" },
};

export function AiExamPanel({
  level, language, mistakes, onStart,
}: {
  level: Level;
  language: "mn" | "en";
  /** Алдааны дэвтрийн товч мэдээлэл. */
  mistakes: string[];
  onStart: (qs: Question[]) => void;
}) {
  const t = TEXT[language];
  const [section, setSection] = useState<AiSection>("vocabulary");
  const [count, setCount] = useState(10);
  const [focus, setFocus] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ msg: string; setup: boolean } | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    setInfo(null);
    const out = await requestAiExam({
      level,
      section,
      count,
      focus: focus && mistakes.length ? mistakes.slice(0, 10) : undefined,
    });
    setBusy(false);
    if (!out.ok) {
      setError({ msg: out.message, setup: out.needsSetup });
      return;
    }
    setInfo(t.done(out.questions.length, out.model, out.rejected));
    onStart(out.questions);
  };

  return (
    <Card>
      <SectionTitle jp="AI 練習" title={t.title} sub={t.sub} />

      <div className="flex flex-wrap gap-1.5">
        {AI_SECTIONS.map((s) => (
          <button
            key={s}
            onClick={() => setSection(s)}
            aria-pressed={section === s}
            className={cn("rounded-xl border px-3 py-1.5 text-[12.5px] font-bold transition",
              section === s ? "border-shu-400 bg-shu-50 text-shu-700" : "border-sumi-900/10 bg-white/70 text-sumi-600 hover:border-shu-300")}
          >
            {SECTION_LABEL[s][language]}
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-[12px] font-bold text-sumi-500">{t.count}</span>
        {[5, 10, 20].map((n) => (
          <button key={n} onClick={() => setCount(n)} aria-pressed={count === n}
            className={cn("rounded-lg border px-2.5 py-1 font-mono text-[12px] font-bold tabnum transition",
              count === n ? "border-sumi-900 bg-sumi-900 text-washi-50" : "border-sumi-900/10 bg-white/70 text-sumi-600")}>
            {n}
          </button>
        ))}
        <label className={cn("ml-1 flex items-center gap-2 text-[12px] font-bold",
          mistakes.length ? "text-sumi-600" : "text-sumi-300")}>
          <input type="checkbox" checked={focus} disabled={!mistakes.length} onChange={(e) => setFocus(e.target.checked)} className="h-4 w-4 accent-shu-500" />
          {mistakes.length ? t.focus : t.focusOff}
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button onClick={run} disabled={busy}>{busy ? t.loading : t.generate}</Button>
        <Chip tone="ai">{level}</Chip>
        {info && <span className="text-[12px] font-bold text-matcha-600">{info}</span>}
      </div>

      {error && (
        <div className="mt-3 rounded-xl border border-shu-200 bg-shu-50 px-4 py-3">
          <p className="text-[12.5px] font-bold text-shu-700">{error.msg}</p>
          {error.setup && <p className="mt-1 text-[11.5px] text-shu-600">{t.setup}</p>}
        </div>
      )}

      <p className="mt-3 text-[11.5px] leading-relaxed text-sumi-400">{t.disclaimer}</p>
    </Card>
  );
}
