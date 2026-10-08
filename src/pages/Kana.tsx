import { useEffect, useMemo, useState } from "react";
import { ALL_KANA, KANA_ROWS, type KanaItem } from "../data/kana";
import { useStore } from "../lib/store";
import { Button, Card, Chip, PageHeader, Ring, SectionTitle, SpeakButton, Tabs } from "../components/ui";
import { ui } from "../lib/i18n";

type View = "chart" | "quiz";

function shuffleArr<T>(a: T[]): T[] {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

export default function Kana() {
  const { doc } = useStore();
  const language = doc.profile.language ?? "mn";
  const t = ui[language];
  const [view, setView] = useState<View>("chart");
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        jp="仮名"
        title={t.kana}
        sub={t.kanaSub}
      />
      <div className="mb-6">
        <Tabs<View>
          value={view}
          onChange={setView}
          items={[
            { id: "chart", label: t.chartTab, icon: "表" },
            { id: "quiz", label: t.testTab, icon: "試" },
          ]}
        />
      </div>
      {view === "chart" ? <Chart /> : <KanaQuiz />}
    </div>
  );
}

function Chart() {
  const { doc } = useStore();
  const language = doc.profile.language ?? "mn";
  const t = ui[language];
  const [script, setScript] = useState<"h" | "k">("h");
  const groups: { id: string; label: string; rows: typeof KANA_ROWS }[] = [
    { id: "basic", label: t.basicGroup, rows: KANA_ROWS.filter((r) => r.group === "basic") },
    { id: "dakuten", label: t.dakutenGroup, rows: KANA_ROWS.filter((r) => r.group === "dakuten") },
    { id: "yoon", label: t.yoonGroup, rows: KANA_ROWS.filter((r) => r.group === "yoon") },
  ];
  return (
    <div className="space-y-6">
      <Tabs<"h" | "k">
        value={script}
        onChange={setScript}
        size="sm"
        items={[
          { id: "h", label: `${t.hiraganaRow} · ひらがな` },
          { id: "k", label: `${t.katakanaRow} · カタカナ` },
        ]}
      />
      {groups.map((g) => (
        <Card key={g.id}>
          <SectionTitle title={g.label} />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] border-separate border-spacing-1.5">
              <tbody>
                {g.rows.map((row) => (
                  <tr key={row.id}>
                    {row.cells.map((cell, i) => (
                      <td key={i} className="p-0">
                        {cell ? (
                          <div className="group relative flex h-[76px] flex-col items-center justify-center rounded-xl border border-sumi-900/8 bg-white/70 transition hover:border-shu-200">
                            <span className="font-jp text-[1.7rem] font-semibold leading-none text-sumi-900">
                              {script === "h" ? cell[0] : toKata(cell[0])}
                            </span>
                            <span className="mt-1.5 font-mono text-[11.5px] text-sumi-500">{cell[1]}</span>
                            <SpeakButton text={cell[0]} className="absolute right-1 top-1 opacity-0 transition group-hover:opacity-100" />
                          </div>
                        ) : (
                          <div className="h-[76px]" />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ))}
    </div>
  );
}

const toKata = (s: string) => s.replace(/[\u3041-\u3096]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));

function KanaQuiz() {
  const { doc, actions } = useStore();
  const language = doc.profile.language ?? "mn";
  const t = ui[language];
  const [script, setScript] = useState<"h" | "k" | "both">("both");
  const pool = useMemo<KanaItem[]>(() => ALL_KANA, []);
  const [queue, setQueue] = useState<KanaItem[]>(() => shuffleArr(pool));
  const [idx, setIdx] = useState(0);
  const [kata, setKata] = useState(false);
  const [choice, setChoice] = useState<string | null>(null);
  const [score, setScore] = useState({ ok: 0, total: 0 });
  const [streak, setStreak] = useState(0);

  const cur = queue[idx];
  const options = useMemo(() => {
    if (!cur) return [];
    const others = shuffleArr(pool.filter((p) => p.r !== cur.r)).slice(0, 3);
    return shuffleArr([cur, ...others]);
  }, [cur, pool]);

  const restart = () => {
    setQueue(shuffleArr(pool));
    setIdx(0);
    setChoice(null);
    setScore({ ok: 0, total: 0 });
    setStreak(0);
  };

  // Асуулт бүрт үсгийн хэлбэрийг (хирагана/катакана) сонгоно
  const chooseScript = (mode: typeof script) => setKata(mode === "k" || (mode === "both" && Math.random() < 0.5));
  useEffect(() => { chooseScript(script); }, [idx, script]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!cur) return <Card><p className="py-8 text-center text-sumi-500">{t.noKana}</p></Card>;

  const glyph = kata ? cur.k : cur.h;

  const pick = (o: KanaItem) => {
    if (choice) return;
    const ok = o.r === cur.r;
    setChoice(o.r);
    setScore((s) => ({ ok: s.ok + (ok ? 1 : 0), total: s.total + 1 }));
    setStreak((s) => (ok ? s + 1 : 0));
    if (ok) actions.addXP(2);
  };

  const next = () => {
    setChoice(null);
    setIdx(idx + 1 >= queue.length ? 0 : idx + 1);
    if (idx + 1 >= queue.length) setQueue(shuffleArr(pool));
  };

  const best = Math.max(doc.kanaBest, streak);
  useEffect(() => { if (streak > doc.kanaBest) actions.setKanaBest(streak); }, [streak, doc.kanaBest, actions]);

  const pct = score.total ? score.ok / score.total : 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
      <Card className="p-6 sm:p-8">
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <Tabs<"h" | "k" | "both">
            value={script}
            onChange={(v) => { setScript(v); restart(); }}
            size="sm"
            items={[
              { id: "both", label: t.bothScripts },
              { id: "h", label: t.hiraganaRow },
              { id: "k", label: t.katakanaRow },
            ]}
          />
          <span className="ml-auto font-mono text-[12px] text-sumi-500 tabnum">{idx + 1} / {queue.length}</span>
        </div>
        <div className="grid place-items-center py-6">
          <span className="font-jp text-[6rem] font-semibold leading-none text-sumi-900 sm:text-[7rem]">{glyph}</span>
          <SpeakButton text={cur.h} className="mt-4" />
        </div>
        <p className="mb-3 text-center text-[13px] text-sumi-500">{t.pickKanaReading}</p>
        <div className="grid grid-cols-2 gap-3">
          {options.map((o) => {
            const isAns = choice !== null && o.r === cur.r;
            const isWrong = choice === o.r && o.r !== cur.r;
            return (
              <button
                key={o.h}
                onClick={() => pick(o)}
                disabled={choice !== null}
                className={[
                  "h-14 rounded-xl border font-mono text-[17px] font-bold transition",
                  isAns ? "border-matcha-500 bg-matcha-50 text-matcha-600" :
                  isWrong ? "border-shu-400 bg-shu-50 text-shu-700" :
                  "border-sumi-900/12 bg-white hover:border-ai-300",
                ].join(" ")}
              >
                {o.r}
              </button>
            );
          })}
        </div>
        {choice && (
          <div className="mt-5 flex items-center justify-between gap-3">
            <p className="text-[13.5px] font-semibold text-sumi-700">
              {choice === cur.r ? `${t.correct2}.` : `${t.correctLabel} ${cur.r}`} · {cur.h} / {cur.k}
            </p>
            <Button onClick={next}>{t.nextBtn}</Button>
          </div>
        )}
      </Card>
      <Card className="flex flex-col items-center justify-center gap-4 text-center">
        <Ring value={pct} size={96} stroke={7} tone="ai">
          <span className="font-mono text-[15px] font-bold tabnum">{score.ok}/{score.total}</span>
        </Ring>
        <div className="space-y-1.5">
          <p className="text-[13px] text-sumi-500">{t.currentStreak}: <b className="tabnum text-sumi-900">{streak}</b></p>
          <p className="text-[13px] text-sumi-500">{t.bestScore}: <b className="tabnum text-sumi-900">{best}</b></p>
        </div>
        <Chip tone="sumi">{t.charsN(pool.length)}</Chip>
        <button onClick={restart} className="text-[12.5px] font-bold text-ai-700 underline underline-offset-4">{t.retakeBtn}</button>
      </Card>
    </div>
  );
}
