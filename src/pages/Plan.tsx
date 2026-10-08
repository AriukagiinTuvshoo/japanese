import { useEffect, useMemo, useState } from "react";
import { cn } from "../utils/cn";
import { href, navigate } from "../lib/router";
import { useStore } from "../lib/store";
import { loadFullData, CURRICULUM, LISTENING, READING } from "../lib/data";
import type { Level } from "../lib/types";
import { LEVELS } from "../lib/types";
import { LEVEL_LABEL, todayKey } from "../lib/text";
import { LEVEL_META } from "../data/levels";
import { Bar, Button, Card, Chip, LevelBadge, ProgressRow, SectionTitle, Select, Spinner } from "../components/ui";

export default function Plan() {
  const { doc, actions } = useStore();
  const [level, setLevel] = useState<Level>(doc.profile.target);
  const [days, setDays] = useState(120);
  const [goal, setGoal] = useState(doc.profile.dailyGoal);
  const [counts, setCounts] = useState<{ vocab: number; kanji: number; grammar: number } | null>(null);

  useEffect(() => {
    loadFullData().then((d) => setCounts({
      vocab: d.vocabByLevel[level].length,
      kanji: d.kanjiByLevel[level].length,
      grammar: d.grammarByLevel[level].length,
    }));
  }, [level]);

  const cur = doc.curriculum;
  const plan = CURRICULUM[level];
  const meta = LEVEL_META[level];

  const daily = useMemo(() => {
    if (!counts) return null;
    return {
      vocab: Math.ceil(counts.vocab / days),
      kanji: Math.ceil(counts.kanji / days),
      grammar: Math.ceil(counts.grammar / days),
      reading: Math.max(1, Math.round(READING.length / Math.max(1, Math.floor(days / 14)))),
      listening: Math.max(1, Math.round(LISTENING.length / Math.max(1, Math.floor(days / 14)))),
    };
  }, [counts, days]);

  const curDay = cur ? Math.min(cur.days, Math.floor((Date.now() - cur.startedAt) / 86_400_000) + 1) : 0;
  const curDone = cur ? Object.keys(cur.done).length : 0;
  const behind = cur ? Math.max(0, curDay - curDone) : 0;

  const schedule = useMemo(() => {
    if (!cur || !counts) return [];
    const out: { day: number; vocab: number; kanji: number; grammar: number; reading: number; listening: number; done: boolean }[] = [];
    const v = Math.ceil(counts.vocab / cur.days);
    const k = Math.ceil(counts.kanji / cur.days);
    const g = Math.ceil(counts.grammar / cur.days);
    for (let d = 1; d <= Math.min(cur.days, curDay + 6); d++) {
      out.push({
        day: d,
        vocab: v, kanji: k,
        grammar: g * 2,
        reading: d % 3 === 0 ? 1 : 0,
        listening: d % 2 === 0 ? 1 : 0,
        done: !!cur.done[d],
      });
    }
    return out.slice(-8);
  }, [cur, counts, curDay]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-jp text-[11.5px] tracking-[0.3em] text-shu-500">学習計画</p>
          <h1 className="mt-1 text-[1.7rem] font-extrabold leading-tight tracking-tight sm:text-[2rem]">Миний төлөвлөгөө</h1>
          <p className="mt-1.5 text-[13.5px] text-sumi-500">
            Түвшин, хугацааг сонгоход өдөр бүрийн ажлыг автоматаар хуваарилж, хоцролтыг нөхөж тохируулна.
          </p>
        </div>
      </div>

      {cur && plan ? (
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <Chip tone="shu">Идэвхтэй төлөвлөгөө</Chip>
              <h2 className="mt-2.5 text-[1.35rem] font-extrabold">{cur.level} — {cur.days} өдөр</h2>
              <p className="mt-1 text-[13px] text-sumi-500">
                Эхэлсэн: {new Date(cur.startedAt).toLocaleDateString("mn-MN")} · {curDone}/{cur.days} өдөр дууссан
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => navigate(`mock?level=${cur.level}`)}>試 Жишиг шалгалт</Button>
              <Button variant="danger" size="sm" onClick={() => { if (confirm("Төлөвлөгөөг устгах уу?")) actions.startCurriculum(cur.level, 0); }}>
                Дахин эхлүүлэх
              </Button>
            </div>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <div className="card-flat px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-sumi-400">Одоогийн өдөр</p>
              <p className="mt-1 font-mono text-[1.5rem] font-extrabold tabnum leading-none">{curDay}</p>
            </div>
            <div className="card-flat px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-sumi-400">Хоцролт</p>
              <p className={cn("mt-1 font-mono text-[1.5rem] font-extrabold tabnum leading-none", behind > 0 && "text-shu-600")}>
                {behind > 0 ? `${behind} өдөр` : "—"}
              </p>
            </div>
            <div className="card-flat px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-sumi-400">Тохируулсан цаг</p>
              <p className="mt-1 font-mono text-[1.5rem] font-extrabold tabnum leading-none">
                {Math.min(180, (daily?.vocab ?? 20) + 20 + behind * 12)} мин
              </p>
            </div>
          </div>

          <Bar value={curDone / Math.max(1, cur.days)} tone="shu" className="mt-5" height={8} />

          {behind > 0 && (
            <p className="mt-3 rounded-xl bg-shu-50 px-4 py-3 text-[12.5px] font-bold text-shu-700">
              ⚠️ Та {behind} өдөр хоцорсон байна. Өдрийн ажлыг {Math.round((1 + behind * 0.25) * 100)}% хүртэл нэмэгдүүлж,
              гүйцэх боломжтой.
            </p>
          )}

          <SectionTitle jp="今週の予定" title="Ойрын өдрүүд" />
          <div className="space-y-2">
            {schedule.map((s) => (
              <div key={s.day} className={cn("flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3",
                s.done ? "border-matcha-200 bg-matcha-50/50" : s.day === curDay ? "border-shu-300 bg-shu-50/50" : "border-sumi-900/8 bg-white/60")}>
                <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg font-mono text-[12px] font-bold",
                  s.done ? "bg-matcha-500 text-white" : s.day === curDay ? "bg-shu-500 text-white" : "bg-sumi-900/6 text-sumi-600")}>
                  {s.done ? "✓" : s.day}
                </span>
                <div className="flex flex-wrap gap-x-3.5 gap-y-1 text-[12.5px] text-sumi-600">
                  <span>語 {s.vocab} үг</span>
                  <span>漢 {s.kanji} ханз</span>
                  <span>文 {s.grammar} дүрэм</span>
                  {s.reading > 0 && <span>読 {s.reading} уншлага</span>}
                  {s.listening > 0 && <span>聴 {s.listening} сонсгол</span>}
                </div>
                <div className="ml-auto flex gap-2">
                  {s.day === curDay && !s.done && (
                    <Button size="sm" onClick={() => {
                      actions.completeCurriculumDay(s.day, { vocab: s.vocab, kanji: s.kanji, grammar: s.grammar });
                      navigate(`vocab?level=${cur.level}&tab=learn`);
                    }}>
                      Өнөөдрийн ажлыг эхлэх
                    </Button>
                  )}
                  {s.done && <Chip tone="matcha">дууссан</Chip>}
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : (
        <Card>
          <SectionTitle jp="計画を作る" title="Шинэ төлөвлөгөө үүсгэх"
            sub="Систем нь тухайн түвшний бүх контентыг өдрүүдэд жигд хуваарилна." />

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <p className="text-[12.5px] font-bold text-sumi-700">Зорилтот түвшин</p>
              <div className="mt-2 grid grid-cols-5 gap-2">
                {LEVELS.map((l) => (
                  <button key={l} onClick={() => setLevel(l)}
                    className={cn("rounded-xl border py-2.5 text-center transition",
                      level === l ? "border-shu-500 bg-shu-50 text-shu-700" : "border-sumi-900/10 bg-white/70 text-sumi-700 hover:border-sumi-900/25")}>
                    <span className="block font-mono text-[14px] font-extrabold">{l}</span>
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[12px] text-sumi-500">{LEVEL_LABEL[level]} · {meta.desc.slice(0, 60)}…</p>
            </div>

            <div className="space-y-4">
              <label className="block">
                <span className="text-[12.5px] font-bold text-sumi-700">Хугацаа: <span className="font-mono tabnum">{days}</span> өдөр (~{Math.round(days / 30)} сар)</span>
                <input type="range" min={30} max={365} step={15} value={days} onChange={(e) => setDays(Number(e.target.value))} className="mt-2 w-full" />
              </label>
              <label className="block">
                <span className="text-[12.5px] font-bold text-sumi-700">Өдрийн чөлөөт цаг: <span className="font-mono tabnum">{goal}</span> мин</span>
                <input type="range" min={15} max={180} step={15} value={goal} onChange={(e) => setGoal(Number(e.target.value))} className="mt-2 w-full" />
              </label>
            </div>
          </div>

          {!counts && <Spinner label="Контентын хэмжээг тооцоолж байна…" />}

          {counts && daily && (
            <div className="mt-6">
              <p className="text-[13px] font-extrabold">Өдөр тутмын төлөвлөгөө (тооцоолсон)</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  { l: "Үгийн сан", v: daily.vocab, t: counts.vocab, tone: "shu" as const },
                  { l: "Ханз", v: daily.kanji, t: counts.kanji, tone: "ai" as const },
                  { l: "Дүрэм", v: daily.grammar, t: counts.grammar, tone: "murasaki" as const },
                  { l: "Уншлага", v: daily.reading, t: READING.length, tone: "matcha" as const },
                  { l: "Сонсгол", v: daily.listening, t: LISTENING.length, tone: "kin" as const },
                ].map((x) => (
                  <div key={x.l} className="card-flat px-4 py-3">
                    <ProgressRow label={x.l} value={x.v} max={Math.max(x.v, 1)} tone={x.tone} hint={`нийт ${x.t}`} />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6 rounded-2xl border border-sumi-900/10 bg-white/60 p-4">
            <p className="text-[13px] font-extrabold">Тооцоолсон цаг</p>
            <p className="mt-1 text-[12.5px] text-sumi-600">
              ALP-ийн судалгаагаар {level} түвшинд хүрэхэд <strong>{meta.hours[0]}–{meta.hours[1]} цаг</strong> шаардлагатай.
              Та өдөрт {goal} минут зарцуулбал{" "}
              <strong>{Math.ceil((meta.hours[0] * 60) / Math.max(15, goal))}–{Math.ceil((meta.hours[1] * 60) / Math.max(15, goal))} өдөр</strong> болно —
              энэ нь таны сонгосон {days} өдрөөс{" "}
              {days < Math.ceil((meta.hours[0] * 60) / Math.max(15, goal)) ? <span className="font-bold text-shu-600">бага</span> : <span className="font-bold text-matcha-600">их</span>} байна.
            </p>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <Button size="lg" onClick={() => {
              actions.patchProfile({ target: level, dailyGoal: goal });
              actions.startCurriculum(level, days);
              navigate("home");
            }}>
              ✓ Төлөвлөгөө эхлүүлэх
            </Button>
            <Button variant="outline" size="lg" onClick={() => navigate(`mock?level=${level}`)}>Эхлээд түвшин тогтоох</Button>
          </div>
        </Card>
      )}

      <Card>
        <SectionTitle jp="目標" title="Зорилтот түвшний шаардлага" />
        <div className="grid gap-3 sm:grid-cols-5">
          {LEVELS.map((l) => {
            const m = LEVEL_META[l];
            const on = l === level;
            return (
              <div key={l} className={cn("card-flat p-4", on && "border-shu-300 bg-shu-50/40")}>
                <div className="flex items-center justify-between">
                  <LevelBadge level={l} size="sm" />
                  <span className="text-[10.5px] text-sumi-400">{m.hours[0]}+ цаг</span>
                </div>
                <p className="mt-2.5 text-[12px] font-bold text-sumi-700">{m.kanji} ханз</p>
                <p className="text-[12px] font-bold text-sumi-700">{m.vocab.toLocaleString()} үг</p>
                <p className="mt-2 text-[11px] leading-snug text-sumi-400">{m.name}</p>
              </div>
            );
          })}
        </div>
        <p className="mt-4 rounded-xl bg-sumi-900/[0.04] px-3.5 py-3 text-[11.5px] leading-relaxed text-sumi-500">
          Эх сурвалж: jlpt.jp (албан босго), ALP-ийн цаг тооцооны судалгаа. Ханзны тоо нь
          Jōyō ба нийтлэг хэрэглээний ханзны бодит хэмжээнд тулгуурлана.
        </p>
      </Card>

      {doc.exams.length > 0 && (
        <Card>
          <SectionTitle jp="試験日" title="Шалгалтын огноо"
            sub={doc.profile.examDate ? `${doc.profile.examDate} хүртэл ${Math.max(0, Math.ceil((new Date(doc.profile.examDate).getTime() - Date.now()) / 86400000))} хоног` : "Огноо тохируулаагүй"} />
          <Select value={doc.profile.target} onChange={(v) => actions.patchProfile({ target: v })}
            options={LEVELS.map((l) => ({ id: l, label: `${l} — ${LEVEL_LABEL[l]}` }))} />
          <p className="mt-3 text-[12px] text-sumi-500">
            Огноог <a href={href("account")} className="font-bold text-ai-600 underline underline-offset-4">аккаунтын тохиргоо</a> хэсэгт оруулна.
            Өнөөдөр: {todayKey()}
          </p>
        </Card>
      )}
    </div>
  );
}
