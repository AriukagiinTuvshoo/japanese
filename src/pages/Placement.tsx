import { useMemo, useState } from "react";
import { cn } from "../utils/cn";
import { navigate } from "../lib/router";
import { useStore } from "../lib/store";
import { loadFullData } from "../lib/data";
import type { Level } from "../lib/types";
import { LEVELS } from "../lib/types";
import { LEVEL_LABEL, TYPE_LABEL } from "../lib/text";
import { shuffle } from "../lib/data";
import { Bar, Button, Card, Chip, LevelBadge, Ring, SectionTitle, Spinner } from "../components/ui";
import { ui } from "../lib/i18n";

interface PQ {
  id: string; level: Level; prompt: string; kind: "vocab" | "kanji" | "grammar";
  options: string[]; answer: number; explain: string;
}

export default function Placement() {
  const { actions, doc } = useStore();
  const language = doc.profile.language ?? "mn";
  const t = ui[language];
  const [stage, setStage] = useState<"intro" | "run" | "result">("intro");
  const [qs, setQs] = useState<PQ[]>([]);
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [loading, setLoading] = useState(false);

  const start = async () => {
    setLoading(true);
    const data = await loadFullData();
    const out: PQ[] = [];
    // Түвшин бүрээс жигд дээж авна
    for (const l of LEVELS) {
      const v = shuffle(data.vocabByLevel[l].filter((x) => x.mn?.length || x.en.length)).slice(0, 8);
      const k = shuffle(data.kanjiByLevel[l]).slice(0, 5);
      const g = shuffle(data.grammarByLevel[l].filter((x) => x.mn || x.en)).slice(0, 4);
      for (const w of v) {
        const others = shuffle(data.vocabByLevel[l].filter((x) => x.id !== w.id && (x.mn?.length || x.en.length))).slice(0, 3);
        const opts = shuffle([w, ...others]);
        out.push({
          id: w.id, level: l, kind: "vocab", prompt: w.w, options: opts.map((o) => language === "en" ? (o.en[0] ?? o.mn?.[0] ?? "") : (o.mn?.[0] ?? o.en[0])),
          answer: opts.indexOf(w), explain: `${w.w}（${w.r}） = ${language === "en" ? w.en.join("; ") : (w.mn?.join(", ") ?? w.en.join("; "))}`,
        });
      }
      for (const c of k) {
        const others = shuffle(data.kanjiByLevel[l].filter((x) => x.k !== c.k)).slice(0, 3);
        const opts = shuffle([c, ...others]);
        out.push({
          id: c.k, level: l, kind: "kanji", prompt: c.k, options: opts.map((o) => (language === "en" ? (o.en[0] ?? o.mn[0] ?? o.k) : (o.mn[0] ?? o.en[0] ?? o.k))),
          answer: opts.indexOf(c), explain: `${c.k} = ${language === "en" ? (c.en.join(", ") || c.mn.join(", ")) : (c.mn.join(", ") || c.en.join(", "))}`,
        });
      }
      for (const gr of g) {
        const others = shuffle(data.grammarByLevel[l].filter((x) => x.id !== gr.id && (x.mn || x.en))).slice(0, 3);
        const opts = shuffle([gr, ...others]);
        const mnOf = (x: typeof gr) => language === "en" ? ((Array.isArray(x.en) ? x.en.join("; ") : String(x.en ?? "")) || x.mn || "") : (x.mn ?? (Array.isArray(x.en) ? x.en.join("; ") : String(x.en ?? "")));
        out.push({
          id: gr.id, level: l, kind: "grammar", prompt: gr.p, options: opts.map(mnOf),
          answer: opts.indexOf(gr), explain: `${gr.p} — ${mnOf(gr)}`,
        });
      }
    }
    const ordered = shuffle(out).slice(0, 45);
    setQs(ordered);
    setAnswers(ordered.map(() => null));
    setIdx(0); setPicked(null); setStage("run"); setLoading(false);
  };

  const byKind = useMemo(() => {
    const m: Record<string, { perLevel: Record<string, { c: number; t: number }> }> = {};
    qs.forEach((q, i) => {
      m[q.kind] ??= { perLevel: {} };
      m[q.kind].perLevel[q.level] ??= { c: 0, t: 0 };
      m[q.kind].perLevel[q.level].t++;
      if (answers[i] === q.answer) m[q.kind].perLevel[q.level].c++;
    });
    return m;
  }, [qs, answers]);

  const finish = () => {
    const detail: Record<string, Level> = {};
    for (const [kind, v] of Object.entries(byKind)) {
      let best: Level = "N5";
      for (const l of LEVELS) {
        const r = v.perLevel[l];
        if (r && r.c / r.t >= 0.6) best = l;
      }
      detail[kind] = best;
    }
    const scores = Object.values(byKind).map((v) => {
      let best = 0;
      for (const l of LEVELS) {
        const r = v.perLevel[l];
        if (r && r.c / r.t >= 0.6) best = LEVELS.indexOf(l) + 1;
      }
      return best;
    });
    const avg = scores.reduce((a, b) => a + b, 0) / Math.max(1, scores.length);
    const overall = avg < 1 ? "zero" : LEVELS[Math.max(0, Math.min(4, Math.round(avg) - 1))];
    actions.setPlacement(overall, detail);
    setStage("result");
  };

  if (stage === "result") {
    const correct = qs.reduce((a, q, i) => a + (answers[i] === q.answer ? 1 : 0), 0);
    const overall = doc.placement?.level ?? "N5";
    const detail = doc.placement?.detail ?? {};
    return (
      <div className="mx-auto max-w-3xl space-y-5">
        <div className="text-center">
          <p className="font-jp text-[11.5px] tracking-[0.3em] text-shu-500">判定</p>
          <h1 className="mt-1 text-[1.8rem] font-extrabold">{t.yourLevel}</h1>
        </div>

        <Card>
          <div className="flex flex-wrap items-center gap-6">
            <Ring value={correct / Math.max(1, qs.length)} size={112} stroke={9} tone="shu">
              <div className="text-center">
                <p className="font-mono text-[1.6rem] font-extrabold leading-none tabnum">{correct}</p>
                <p className="mt-0.5 text-[10px] font-bold text-sumi-400">/ {qs.length}</p>
              </div>
            </Ring>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-bold uppercase tracking-wider text-sumi-400">{t.computedLevel}</p>
              <p className="mt-1 flex items-center gap-3">
                <span className="font-mono text-[2.4rem] font-extrabold leading-none">
                  {overall === "zero" ? t.beginnerWord : overall}
                </span>
                {overall !== "zero" && <LevelBadge level={overall as Level} />}
              </p>
              <p className="mt-2 text-[13px] leading-relaxed text-sumi-600">
                {overall === "zero"
                  ? t.zeroAdvice
                  : t.levelAdvice(LEVEL_LABEL[language][overall as Level])}
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {(["vocab", "kanji", "grammar"] as const).map((k) => {
              const l = detail[k];
              const v = byKind[k];
              const total = v ? Object.values(v.perLevel).reduce((a, r) => a + r.t, 0) : 0;
              const corr = v ? Object.values(v.perLevel).reduce((a, r) => a + r.c, 0) : 0;
              return (
                <div key={k} className="card-flat p-4">
                  <p className="text-[12px] font-bold uppercase tracking-wide text-sumi-400">
                    {k === "vocab" ? t.vocab : k === "kanji" ? t.kanji : t.grammar}
                  </p>
                  <p className="mt-1.5 flex items-center gap-2">
                    <span className="font-mono text-[1.5rem] font-extrabold leading-none">{l ?? "—"}</span>
                    {l && <LevelBadge level={l} size="sm" />}
                  </p>
                  <p className="mt-2 font-mono text-[11.5px] tabnum text-sumi-500">{t.correct2N(corr, total)}</p>
                  <Bar value={corr / Math.max(1, total)} tone="ai" className="mt-2" height={5} />
                </div>
              );
            })}
          </div>

          <div className="mt-6 rounded-2xl border border-ai-100 bg-ai-50/60 p-4">
            <p className="text-[13.5px] font-extrabold text-ai-700">{t.startPoint}</p>
            <ul className="mt-2 space-y-1.5 text-[13px] text-ai-700">
              {(["vocab", "kanji", "grammar"] as const).map((k) => {
                const l = detail[k];
                if (!l) return null;
                return (
                  <li key={k}>
                    {t.startAtLevel(l, k === "vocab" ? t.vocab.toLowerCase() : k === "kanji" ? t.kanji.toLowerCase() : t.grammar.toLowerCase())}{" "}
                    <a href={`#/${k === "vocab" ? "vocab" : k === "kanji" ? "kanji" : "grammar"}?level=${l}`}
                      className="font-bold underline underline-offset-4">
                      {t.startHere}
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <Button onClick={() => navigate(`plan`)}>{t.createPlanBtn}</Button>
            <Button variant="outline" onClick={() => { setStage("intro"); setQs([]); }}>{t.retakeBtn}</Button>
            <Button variant="ghost" onClick={() => navigate("home")}>{t.homeShort}</Button>
          </div>
        </Card>

        <Card>
          <SectionTitle jp="解答" title={t.answerBreakdown} sub={t.answerBreakdownSub} />
          <div className="space-y-4">
            {(["vocab", "kanji", "grammar"] as const).map((k) => (
              <div key={k}>
                <p className="text-[12.5px] font-bold text-sumi-700">{k === "vocab" ? t.vocab : k === "kanji" ? t.kanji : t.grammar}</p>
                <div className="mt-2 grid grid-cols-5 gap-1.5">
                  {LEVELS.map((l) => {
                    const r = byKind[k]?.perLevel[l];
                    const p = r ? r.c / r.t : 0;
                    return (
                      <div key={l} className={cn("rounded-lg px-2 py-2 text-center",
                        !r ? "bg-sumi-900/4" : p >= 0.6 ? "bg-matcha-100" : p >= 0.3 ? "bg-kin-100" : "bg-shu-50")}>
                        <p className="font-mono text-[11px] font-bold">{l}</p>
                        <p className="mt-0.5 font-mono text-[12px] font-extrabold tabnum">{r ? `${r.c}/${r.t}` : "—"}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    );
  }

  if (stage === "run") {
    const q = qs[idx];
    const isCorrect = picked !== null && picked === q.answer;
    return (
      <div className="mx-auto max-w-2xl">
        <div className="mb-4 flex items-center gap-3">
          <span className="font-mono text-[12px] font-bold tabnum text-sumi-500">{idx + 1} / {qs.length}</span>
          <Bar value={idx / qs.length} tone="shu" height={5} />
          <Chip tone="sumi">{TYPE_LABEL[language][q.kind === "vocab" ? "n" : q.kind === "kanji" ? "other" : "exp"]}</Chip>
        </div>

        <Card className="p-6">
          <div className="flex items-center gap-2">
            <LevelBadge level={q.level} size="sm" />
            <Chip tone="ai">{q.kind === "vocab" ? t.vocab : q.kind === "kanji" ? t.kanji : t.grammar}</Chip>
          </div>
          <p className={cn("mt-5 font-jp font-bold", q.prompt.length <= 3 ? "text-[3rem]" : q.prompt.length <= 12 ? "text-[1.8rem]" : "text-[1.2rem]")}>
            {q.prompt}
          </p>
          <div className="mt-6 space-y-2.5">
            {q.options.map((o, i) => (
              <button key={i} onClick={() => picked === null && setPicked(i)}
                disabled={picked !== null}
                className={cn("flex w-full items-center gap-3 rounded-xl border-2 px-4 py-3 text-left text-[14px] font-semibold transition",
                  picked !== null && i === q.answer ? "border-matcha-400 bg-matcha-50"
                    : picked === i ? "border-shu-400 bg-shu-50"
                      : "border-sumi-900/10 bg-white/70 hover:border-ai-400")}>
                <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-lg font-mono text-[12px] font-bold",
                  picked !== null && i === q.answer ? "bg-matcha-500 text-white" : picked === i ? "bg-shu-500 text-white" : "bg-sumi-900/6 text-sumi-500")}>
                  {String.fromCharCode(65 + i)}
                </span>
                {o}
              </button>
            ))}
          </div>

          {picked !== null && (
            <p className={cn("mt-4 rounded-xl px-3.5 py-2.5 text-[12.5px] font-bold",
              isCorrect ? "bg-matcha-50 text-matcha-600" : "bg-shu-50 text-shu-700")}>
              {isCorrect ? `✓ ${t.correct2}` : `✕ ${t.wrong2}`} — {q.explain}
            </p>
          )}

          <div className="mt-5 flex items-center gap-3">
            {picked !== null && (
              <Button size="lg" onClick={() => {
                const next = answers.slice();
                next[idx] = picked;
                setAnswers(next);
                setPicked(null);
                if (idx + 1 >= qs.length) finish();
                else setIdx(idx + 1);
              }}>
                {idx + 1 >= qs.length ? t.showResult : t.nextBtn}
              </Button>
            )}
            {picked === null && <p className="text-[12.5px] text-sumi-400">{t.chooseAnswer2}</p>}
            {picked !== null && idx + 1 < qs.length && (
              <Button variant="ghost" size="sm" className="ml-auto" onClick={() => { const n = answers.slice(); n[idx] = picked; setAnswers(n); setPicked(null); finish(); }}>
                {t.finishShort}
              </Button>
            )}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <p className="font-jp text-[11.5px] tracking-[0.3em] text-shu-500">レベル判定</p>
        <h1 className="mt-1 text-[1.8rem] font-extrabold">{t.placementHero}</h1>
      </div>
      <Card>
        <p className="text-[14px] leading-relaxed text-sumi-700">
          {t.placementIntro}
        </p>
        <ul className="mt-4 space-y-2 text-[13px] text-sumi-600">
          <li>{t.placementB1}</li>
          <li>{t.placementB2}</li>
          <li>{t.placementB3}</li>
        </ul>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button size="lg" onClick={start} disabled={loading}>{loading ? t.preparing : t.startTest}</Button>
          <Button variant="ghost" size="lg" onClick={() => {
            actions.setPlacement("zero", {});
            navigate("kana");
          }}>
            {t.startFromKana}
          </Button>
        </div>
        {loading && <Spinner label={t.genQ2} lang={language} />}
      </Card>
    </div>
  );
}
