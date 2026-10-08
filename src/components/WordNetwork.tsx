import { useEffect, useMemo, useState } from "react";
import { cn } from "../utils/cn";
import { href } from "../lib/router";
import { loadFullData } from "../lib/data";
import type { Kanji, Level, Vocab } from "../lib/types";
import { Card, Chip, LevelBadge, SectionTitle, Spinner, SpeakButton } from "./ui";

/**
 * ҮГИЙН СҮЛЖЭЭ — үгийг ганцаар биш, ханзнаас нь холбож сурах.
 * Нэг ханзыг төвд тавьж, түүнийг агуулсан үгс болон бусад ханзнуудыг
 * холбоосоор харуулна.
 */
export function WordNetwork({ level }: { level: Level }) {
  const [data, setData] = useState<Awaited<ReturnType<typeof loadFullData>> | null>(null);
  const [center, setCenter] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    loadFullData().then((d) => {
      setData(d);
      // Түвшинд хамгийн олон үг бүрдүүлдэг ханзыг төв болгоно
      const counts = new Map<string, number>();
      for (const v of d.vocabByLevel[level]) {
        for (const ch of v.kd) counts.set(ch, (counts.get(ch) ?? 0) + 1);
      }
      const best = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
      setCenter(best[Math.floor(Math.random() * Math.min(6, best.length))]?.[0] ?? "日");
    });
  }, [level]);

  const model = useMemo(() => {
    if (!data || !center) return null;
    const words = (data.wordsByKanji.get(center) ?? []).slice(0, 12);
    const neighbours = new Map<string, number>();
    for (const w of words) {
      for (const ch of w.kd) {
        if (ch === center) continue;
        neighbours.set(ch, (neighbours.get(ch) ?? 0) + 1);
      }
    }
    const ring = [...neighbours.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([ch]) => ch);
    return { words, ring, kanji: data.kanjiByChar.get(center) };
  }, [data, center]);

  const suggestions = useMemo(() => {
    if (!data) return [];
    const needle = query.trim();
    if (!needle) {
      const counts = new Map<string, number>();
      for (const v of data.vocabByLevel[level]) for (const ch of v.kd) counts.set(ch, (counts.get(ch) ?? 0) + 1);
      return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 24).map(([c]) => c);
    }
    return [...data.kanjiByChar.keys()].filter((c) => c === needle || (data.kanjiByChar.get(c)?.mn ?? []).some((m) => m.includes(needle)) || (data.kanjiByChar.get(c)?.en ?? []).some((m) => m.toLowerCase().includes(needle.toLowerCase()))).slice(0, 24);
  }, [data, query, level]);

  if (!data) return <Spinner label="Сүлжээ бүрдүүлж байна…" />;

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
      <Card className="p-0">
        <div className="border-b border-sumi-900/8 px-5 py-4">
          <SectionTitle jp="単語ネットワーク" title="Үгийн сүлжээ" sub="Ханз → үг → өөр ханз. Холбоосоор явж сур." />
        </div>
        {model && (
          <div className="grid-paper relative overflow-hidden p-4">
            <svg viewBox="0 0 720 380" className="w-full">
              {/* холбоос */}
              {model.ring.map((ch, i) => {
                const a = (i / model.ring.length) * Math.PI * 2 - Math.PI / 2;
                const x = 360 + Math.cos(a) * 240;
                const y = 190 + Math.sin(a) * 145;
                return <line key={ch} x1={360} y1={190} x2={x} y2={y} stroke="rgba(28,27,24,0.14)" strokeWidth={1.5} strokeDasharray="4 4" />;
              })}
              {model.words.map((w, i) => {
                const a = (i / model.words.length) * Math.PI * 2 + 0.3;
                const x = 360 + Math.cos(a) * 120;
                const y = 190 + Math.sin(a) * 78;
                return <line key={w.w} x1={360} y1={190} x2={x} y2={y} stroke="rgba(204,70,48,0.22)" strokeWidth={1.5} />;
              })}

              {/* төв ханз */}
              <circle cx={360} cy={190} r={54} fill="#1c1b18" />
              <text x={360} y={190} textAnchor="middle" dominantBaseline="central" fill="#fcfaf5" fontSize={46} fontWeight={700}>
                {center}
              </text>
              <text x={360} y={256} textAnchor="middle" fill="#78736a" fontSize={12} fontWeight={700}>
                {model.kanji?.mn?.[0] ?? model.kanji?.en?.[0] ?? ""}
              </text>

              {/* холбогдох ханзнууд */}
              {model.ring.map((ch, i) => {
                const a = (i / model.ring.length) * Math.PI * 2 - Math.PI / 2;
                const x = 360 + Math.cos(a) * 240;
                const y = 190 + Math.sin(a) * 145;
                const k = data.kanjiByChar.get(ch);
                return (
                  <a key={ch} href={href("kanji", ch)}>
                    <circle cx={x} cy={y} r={30} fill="#fff" stroke="rgba(28,27,24,0.14)" />
                    <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fill="#1c1b18" fontSize={24} fontWeight={700}>{ch}</text>
                    <text x={x} y={y + 44} textAnchor="middle" fill="#78736a" fontSize={10.5} fontWeight={700}>
                      {(k?.mn?.[0] ?? k?.en?.[0] ?? "").slice(0, 14)}
                    </text>
                  </a>
                );
              })}

              {/* үгс */}
              {model.words.map((w, i) => {
                const a = (i / model.words.length) * Math.PI * 2 + 0.3;
                const x = 360 + Math.cos(a) * 120;
                const y = 190 + Math.sin(a) * 78;
                return (
                  <a key={w.w} href={href("vocab", w.id)}>
                    <rect x={x - 34} y={y - 13} width={68} height={26} rx={7} fill="#fff" stroke="rgba(204,70,48,0.3)" />
                    <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fill="#ac3622" fontSize={13} fontWeight={700}>{w.w}</text>
                  </a>
                );
              })}
            </svg>
          </div>
        )}

        {model && (
          <div className="border-t border-sumi-900/8 p-5">
            <p className="text-[12.5px] font-bold text-sumi-700">
              <span className="font-jp text-[16px]">{center}</span> агуулсан үгс ({model.words.length})
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {model.words.map((w) => (
                <a key={w.id} href={href("vocab", w.id)} className="card-flat flex items-center gap-3 px-3 py-2.5 transition hover:border-shu-300">
                  <span className="font-jp text-[15px] font-bold">{w.w}</span>
                  <span className="min-w-0 flex-1 truncate text-[12.5px] text-sumi-600">{w.mn?.join(", ") ?? w.en.join("; ")}</span>
                  <LevelBadge level={w.lvl} size="sm" />
                </a>
              ))}
            </div>
          </div>
        )}
      </Card>

      <Card>
        <p className="text-[13px] font-extrabold">Ханз сонгох</p>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ханз эсвэл утга…"
          className="mt-2.5 h-10 w-full rounded-xl border border-sumi-900/12 bg-white px-3 text-[13px] font-semibold outline-none focus:border-shu-400"
        />
        <div className="mt-3 grid grid-cols-6 gap-1.5">
          {suggestions.map((c) => (
            <button
              key={c}
              onClick={() => setCenter(c)}
              className={cn("grid aspect-square place-items-center rounded-lg font-mincho text-[17px] font-bold transition",
                c === center ? "bg-shu-500 text-white" : "bg-white/70 text-sumi-700 hover:bg-white")}
            >
              {c}
            </button>
          ))}
        </div>
        {model?.kanji && center && (
          <div className="mt-5 border-t border-sumi-900/8 pt-4">
            <div className="flex items-center gap-3">
              <span className="font-mincho text-[2.4rem] font-bold leading-none">{center}</span>
              <div className="min-w-0">
                <p className="text-[13px] font-bold">{model.kanji.mn.join(", ") || model.kanji.en.join(", ")}</p>
                <p className="mt-0.5 text-[11.5px] text-sumi-500">{model.kanji.s} зурлага · {model.kanji.lvl}</p>
              </div>
              <SpeakButton text={center} className="ml-auto" />
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {model.kanji.on.slice(0, 3).map((r) => <Chip key={`on${r}`} tone="shu">音 {r}</Chip>)}
              {model.kanji.kun.slice(0, 3).map((r) => <Chip key={`kun${r}`} tone="ai">訓 {r}</Chip>)}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <a href={href("kanji", center)} className="text-[12.5px] font-bold text-ai-600 underline underline-offset-4">Ханзны дэлгэрэнгүй →</a>
              <a href={href("write", center)} className="text-[12.5px] font-bold text-shu-600 underline underline-offset-4">Бичиж дадлагажих →</a>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

export type { Vocab, Kanji };
