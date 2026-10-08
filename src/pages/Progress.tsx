import { useEffect, useMemo, useState } from "react";
import { cn } from "../utils/cn";
import { href, navigate } from "../lib/router";
import { useStore, longestStreak } from "../lib/store";
import { loadFullData } from "../lib/data";
import { LEVELS } from "../lib/types";
import { dayOffset, todayKey, LEVEL_LABEL } from "../lib/text";
import { cardStage, memoryStats, retrievability } from "../lib/srs";
import { QUIZ_MODES } from "../lib/study";
import { Bar, Button, Card, Chip, LevelBadge, Ring, SectionTitle, Spinner, Stat, Tabs } from "../components/ui";

export default function Progress() {
  const { doc, streak, levelInfo } = useStore();
  const [tab, setTab] = useState<"overview" | "levels" | "history" | "weak">("overview");
  const [meta, setMeta] = useState<Awaited<ReturnType<typeof loadFullData>> | null>(null);

  useEffect(() => { loadFullData().then(setMeta); }, []);

  const mem = useMemo(() => memoryStats(doc.srs), [doc.srs]);
  const best = useMemo(() => longestStreak(doc.activity), [doc.activity]);

  const perLevel = useMemo(() => {
    if (!meta) return [];
    return LEVELS.map((l) => {
      const vocab = meta.vocabByLevel[l];
      const kanji = meta.kanjiByLevel[l];
      const grammar = meta.grammarByLevel[l];
      const vSeen = vocab.filter((v) => doc.srs[v.id]?.n).length;
      const vMastered = vocab.filter((v) => (doc.srs[v.id]?.st ?? 0) >= 21).length;
      const kSeen = kanji.filter((k) => doc.srs[k.k]?.n).length;
      const gDone = grammar.filter((g) => doc.grammarDone.includes(g.id)).length;
      return {
        level: l, vocab: vocab.length, vSeen, vMastered,
        kanji: kanji.length, kSeen, kMastered: kanji.filter((k) => (doc.srs[k.k]?.st ?? 0) >= 21).length,
        grammar: grammar.length, gDone,
        score: (vMastered / Math.max(1, vocab.length)) * 0.5 + (kanji.filter((k) => (doc.srs[k.k]?.st ?? 0) >= 21).length / Math.max(1, kanji.length)) * 0.3 + (gDone / Math.max(1, grammar.length)) * 0.2,
      };
    });
  }, [meta, doc.srs, doc.grammarDone]);

  const weakKinds = useMemo(() => {
    const m = new Map<string, { c: number; t: number }>();
    for (const q of doc.quizzes) {
      const cur = m.get(q.kind) ?? { c: 0, t: 0 };
      cur.c += q.correct; cur.t += q.total; m.set(q.kind, cur);
    }
    return [...m.entries()].map(([k, v]) => ({ kind: k, pct: v.c / Math.max(1, v.t), total: v.t })).sort((a, b) => a.pct - b.pct);
  }, [doc.quizzes]);

  const weakWords = useMemo(() => {
    if (!meta) return [];
    return Object.entries(doc.srs)
      .filter(([, c]) => c.l >= 2 || (c.st < 3 && c.n >= 3))
      .sort((a, b) => b[1].l - a[1].l || a[1].st - b[1].st)
      .slice(0, 24)
      .map(([id, c]) => {
        const v = meta.byId.get(id);
        const k = meta.kanjiByChar.get(id);
        return { id, card: c, word: v?.w ?? k?.k ?? id, mn: v?.mn?.[0] ?? v?.en[0] ?? k?.mn?.[0] ?? k?.en[0] ?? "", kind: v ? "vocab" : "kanji" };
      });
  }, [meta, doc.srs]);

  const days = useMemo(() => {
    const out: { key: string; xp: number; min: number; reviews: number; correct: number; total: number }[] = [];
    for (let i = 27; i >= 0; i--) {
      const k = dayOffset(todayKey(), -i);
      const d = doc.activity[k];
      out.push({ key: k, xp: d?.xp ?? 0, min: d?.min ?? 0, reviews: d?.reviews ?? 0, correct: d?.correct ?? 0, total: d?.total ?? 0 });
    }
    return out;
  }, [doc.activity]);

  if (!meta) return <Spinner label="Ахицыг тооцоолж байна…" />;

  const totalVocab = meta.vocab.length;
  const studiedVocab = Object.values(doc.srs).filter((c) => c.n > 0).length;

  return (
    <div className="space-y-6">
      <div>
        <p className="font-jp text-[11.5px] tracking-[0.3em] text-shu-500">成績</p>
        <h1 className="mt-1 text-[1.7rem] font-extrabold leading-tight tracking-tight sm:text-[2rem]">Ахиц · шинжилгээ</h1>
        <p className="mt-1.5 text-[13.5px] text-sumi-500">
          Бүх тоо таны бодит үйлдлээс бодогдоно — хиймэл өсгөсөн үзүүлэлт байхгүй.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Идэвхтэй цуваа" value={`${streak} өдөр`} sub={`дээд: ${best} өдөр`} icon="🔥" tone="shu" />
        <Stat label="Судалсан үг" value={studiedVocab.toLocaleString()} sub={`/ ${totalVocab.toLocaleString()} (${Math.round((studiedVocab / totalVocab) * 100)}%)`} icon="語" tone="ai" />
        <Stat label="Нийт давталт" value={mem.reviews.toLocaleString()} sub={`${mem.lapses} мартсан`} icon="復" tone="matcha" />
        <Stat label="Цуглуулсан XP" value={doc.xp.toLocaleString()} sub={`Lv.${levelInfo.level} · ${levelInfo.into}/${levelInfo.need}`} icon="功" tone="kin" />
      </div>

      <Tabs value={tab} onChange={setTab} items={[
        { id: "overview", label: "Ерөнхий", icon: "要" },
        { id: "levels", label: "Түвшин тус бүр", icon: "階" },
        { id: "weak", label: "Сул тал", icon: "弱", badge: weakWords.length || undefined },
        { id: "history", label: "Түүх", icon: "記" },
      ]} />

      {tab === "overview" && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <SectionTitle jp="記憶" title="Санах ойн шинжилгээ" />
            <div className="flex flex-wrap items-center gap-6">
              <Ring value={mem.retention} size={110} stroke={9} tone={mem.retention > 0.8 ? "matcha" : "kin"}>
                <div className="text-center">
                  <p className="font-mono text-[1.5rem] font-extrabold leading-none tabnum">{Math.round(mem.retention * 100)}%</p>
                  <p className="mt-0.5 text-[9.5px] font-bold text-sumi-400">сэргээх</p>
                </div>
              </Ring>
              <div className="min-w-0 flex-1 space-y-3">
                {[
                  { l: "Нарийвчлал", v: mem.accuracy, tone: "matcha" as const },
                  { l: "Мартах хурд", v: mem.forgettingRate, tone: "shu" as const },
                  { l: "Итгэлтэй байдал", v: mem.confidence, tone: "ai" as const },
                ].map((x) => (
                  <div key={x.l}>
                    <div className="flex justify-between text-[12.5px] font-bold">
                      <span className="text-sumi-600">{x.l}</span>
                      <span className="font-mono tabnum">{Math.round(x.v * 100)}%</span>
                    </div>
                    <Bar value={x.v} tone={x.tone} className="mt-1.5" height={6} />
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5 grid grid-cols-4 gap-2">
              {[
                { l: "Шинэ", v: Object.values(doc.srs).filter((c) => c.ph === "new").length, t: "sumi" },
                { l: "Суралцаж", v: mem.learning, t: "kin" },
                { l: "Давталт", v: Object.values(doc.srs).filter((c) => c.ph === "review" && c.st < 21).length, t: "ai" },
                { l: "Эзэмшсэн", v: mem.mastered, t: "matcha" },
              ].map((x) => (
                <div key={x.l} className="card-flat px-3 py-2.5 text-center">
                  <p className="text-[10.5px] font-bold text-sumi-400">{x.l}</p>
                  <p className={cn("mt-1 font-mono text-[16px] font-extrabold tabnum",
                    x.t === "matcha" ? "text-matcha-600" : x.t === "ai" ? "text-ai-600" : x.t === "kin" ? "text-kin-600" : "text-sumi-600")}>
                    {x.v.toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <SectionTitle jp="学習時間" title="30 хоногийн идэвх"
              sub={`Нийт ${Math.round(Object.values(doc.activity).reduce((a, d) => a + d.min, 0) / 60)} цаг · ${Object.values(doc.activity).filter((d) => d.xp > 0).length} идэвхтэй өдөр`} />
            <div className="flex h-32 items-end gap-1">
              {days.map((d) => {
                const max = Math.max(30, ...days.map((x) => x.min));
                return (
                  <div key={d.key} className="group relative flex-1" title={`${d.key} · ${d.min} мин · ${d.xp} XP`}>
                    <div className={cn("w-full rounded-t transition-all", d.min > 0 ? "bg-shu-500" : "bg-sumi-900/8")}
                      style={{ height: `${Math.max(3, (d.min / max) * 100)}%` }} />
                  </div>
                );
              })}
            </div>
            <div className="mt-3 flex justify-between text-[11px] text-sumi-400">
              <span>30 хоногийн өмнө</span>
              <span>Өнөөдөр</span>
            </div>

            <div className="mt-5 space-y-3 border-t border-sumi-900/8 pt-4">
              {[
                { l: "Долоо хоногт", v: days.slice(-7).reduce((a, d) => a + d.min, 0), t: "Энэ долоо хоногийн минут" },
                { l: "Дундаж/өдөр", v: Math.round(days.filter((d) => d.min > 0).reduce((a, d) => a + d.min, 0) / Math.max(1, days.filter((d) => d.min > 0).length)), t: "Идэвхтэй өдрийн дундаж" },
              ].map((x) => (
                <div key={x.l} className="flex items-center justify-between">
                  <span className="text-[12.5px] text-sumi-600">{x.t}</span>
                  <span className="font-mono text-[13px] font-bold tabnum">{x.v} мин</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {tab === "levels" && (
        <Card>
          <SectionTitle jp="レベル別" title="Түвшин тус бүрийн эзэмшил"
            sub="Эзэмшсэн гэдэг нь SRS-д 21+ хоногийн тогтвортой байдал, 3+ дараалсан зөв хариулттай карт." />
          <div className="space-y-5">
            {perLevel.map((p) => (
              <div key={p.level}>
                <div className="flex flex-wrap items-center gap-3">
                  <LevelBadge level={p.level} />
                  <span className="text-[13.5px] font-extrabold">{LEVEL_LABEL[p.level]}</span>
                  <span className="font-mono text-[12.5px] tabnum text-sumi-500">{Math.round(p.score * 100)}% бэлэн</span>
                  {p.score >= 0.6 && <Chip tone="matcha">эзэмшсэн</Chip>}
                  <div className="ml-auto flex gap-2">
                    <a href={href("vocab", { level: p.level } as never)} className="text-[12px] font-bold text-ai-600 underline underline-offset-4">Үг →</a>
                  </div>
                </div>
                <Bar value={p.score} tone={p.score >= 0.6 ? "matcha" : p.score >= 0.3 ? "kin" : "shu"} className="mt-2.5" height={8} />
                <div className="mt-3 grid grid-cols-3 gap-3 text-[12px]">
                  {[
                    { l: "Үгийн сан", v: `${p.vMastered}/${p.vocab}`, seen: p.vSeen },
                    { l: "Ханз", v: `${p.kMastered}/${p.kanji}`, seen: p.kSeen },
                    { l: "Дүрэм", v: `${p.gDone}/${p.grammar}`, seen: p.gDone },
                  ].map((x) => (
                    <div key={x.l} className="rounded-xl bg-sumi-900/[0.04] px-3 py-2.5">
                      <p className="text-[10.5px] font-bold uppercase tracking-wide text-sumi-400">{x.l}</p>
                      <p className="mt-0.5 font-mono text-[13px] font-extrabold tabnum">{x.v}</p>
                      <p className="mt-0.5 text-[10.5px] text-sumi-400">{x.seen} харсан</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {tab === "weak" && (
        <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
          <Card>
            <SectionTitle jp="弱点" title="Хамгийн төвөгтэй үгс/ханз" sub="Олон удаа мартсан эсвэл тогтвортой байдал нь бага." />
            {weakWords.length === 0 ? (
              <p className="text-[13px] text-sumi-500">Одоогоор сул карт алга. Илүү их дасгал хийснээр энд харагдана.</p>
            ) : (
              <ul className="divide-y divide-sumi-900/8">
                {weakWords.map((w) => {
                  const st = cardStage(w.card);
                  return (
                    <li key={w.id} className="flex flex-wrap items-center gap-3 py-3">
                      <a href={href(w.kind === "vocab" ? "vocab" : "kanji", w.id)} className="min-w-0 flex-1">
                        <span className="font-jp text-[16px] font-bold">{w.word}</span>
                        <span className="ml-2.5 text-[12.5px] text-sumi-600">{w.mn}</span>
                      </a>
                      <Chip tone={w.card.l > 2 ? "shu" : "kin"}>{w.card.l} мартсан</Chip>
                      <span className="font-mono text-[11.5px] tabnum text-sumi-400">{st.mn}</span>
                      <span className="font-mono text-[11.5px] tabnum text-sumi-400">{Math.round(retrievability(w.card) * 100)}%</span>
                    </li>
                  );
                })}
              </ul>
            )}
            {weakWords.length > 0 && (
              <Button className="mt-4" onClick={() => navigate("review?mode=weak")}>♻ Сул картуудаа давтах</Button>
            )}
          </Card>

          <Card>
            <SectionTitle jp="分野別" title="Дасгалын төрлөөр" />
            {weakKinds.length === 0 ? (
              <p className="text-[13px] text-sumi-500">Дасгал хийж эхлэхэд энд шинжилгээ гарна.</p>
            ) : (
              <div className="space-y-3.5">
                {weakKinds.map((w) => {
                  const meta2 = QUIZ_MODES.find((q) => q.id === w.kind);
                  return (
                    <div key={w.kind}>
                      <div className="flex items-baseline justify-between">
                        <span className="text-[13px] font-bold text-sumi-700">{meta2?.label ?? w.kind}</span>
                        <span className="font-mono text-[12px] font-bold tabnum text-sumi-500">
                          {Math.round(w.pct * 100)}% · {w.total}
                        </span>
                      </div>
                      <Bar value={w.pct} tone={w.pct >= 0.7 ? "matcha" : w.pct >= 0.5 ? "kin" : "shu"} className="mt-1.5" height={6} />
                    </div>
                  );
                })}
              </div>
            )}
            <div className="mt-5 space-y-2 border-t border-sumi-900/8 pt-4">
              <a href={href("quiz")} className="block text-[12.5px] font-bold text-ai-600 underline underline-offset-4">Сул төрлөөр дасгал хийх →</a>
              <a href={href("mistakes")} className="block text-[12.5px] font-bold text-ai-600 underline underline-offset-4">Алдааны дэвтэр ({doc.mistakes.length}) →</a>
            </div>
          </Card>
        </div>
      )}

      {tab === "history" && (
        <div className="space-y-5">
          <Card>
            <SectionTitle jp="最近の学習" title="Сүүлийн 28 хоног" />
            <div className="overflow-x-auto">
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="border-b border-sumi-900/10 text-left text-[11px] uppercase tracking-wide text-sumi-400">
                    <th className="py-2">Огноо</th>
                    <th className="py-2 text-right">XP</th>
                    <th className="py-2 text-right">Минут</th>
                    <th className="py-2 text-right">Шинэ</th>
                    <th className="py-2 text-right">Давталт</th>
                    <th className="py-2 text-right">Нарийвчлал</th>
                  </tr>
                </thead>
                <tbody>
                  {days.filter((d) => d.xp > 0).reverse().map((d) => (
                    <tr key={d.key} className="border-b border-sumi-900/6">
                      <td className="py-2 font-mono">{d.key}</td>
                      <td className="py-2 text-right font-mono tabnum">{d.xp}</td>
                      <td className="py-2 text-right font-mono tabnum">{d.min}</td>
                      <td className="py-2 text-right font-mono tabnum">{doc.activity[d.key]?.newCards ?? 0}</td>
                      <td className="py-2 text-right font-mono tabnum">{d.reviews}</td>
                      <td className="py-2 text-right font-mono tabnum">
                        {d.total ? `${Math.round((d.correct / d.total) * 100)}%` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <SectionTitle jp="模擬試験履歴" title="Шалгалтын түүх" />
            {doc.exams.length === 0 ? (
              <p className="text-[13px] text-sumi-500">Одоогоор шалгалт өгөөгүй байна.</p>
            ) : (
              <div className="space-y-2.5">
                {doc.exams.map((e) => (
                  <div key={e.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-sumi-900/8 bg-white/60 px-4 py-3">
                    <LevelBadge level={e.level} size="sm" />
                    <span className="font-mono text-[13px] font-bold tabnum">{e.total}/{e.max}</span>
                    <Chip tone={e.passed ? "matcha" : "shu"}>{e.passed ? "тэнцсэн" : "тэнцээгүй"}</Chip>
                    <span className="text-[11.5px] text-sumi-400">{new Date(e.at).toLocaleDateString("mn-MN")}</span>
                    <Bar value={e.total / e.max} tone={e.passed ? "matcha" : "shu"} className="ml-auto w-32" height={5} />
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
