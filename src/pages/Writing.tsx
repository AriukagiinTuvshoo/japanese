import { useEffect, useMemo, useState } from "react";
import { cn } from "../utils/cn";
import { href, useQuery } from "../lib/router";
import { useStore } from "../lib/store";
import { loadKanji, loadStrokes } from "../lib/data";
import type { Kanji, Level, StrokeMap } from "../lib/types";
import { LEVEL_LABEL } from "../lib/text";
import { Bar, Button, Card, Empty, Input, LevelBadge, SectionTitle, Spinner, Tabs } from "../components/ui";
import { StrokePad } from "../components/StrokePad";

type Mode = "guided" | "practice" | "free" | "browse";

export default function Writing({ char }: { char?: string }) {
  const { query, set } = useQuery();
  const { doc, actions } = useStore();
  const level = (query.level as Level) || (doc.profile.current === "zero" ? doc.profile.target : doc.profile.current);
  const mode = (query.mode as Mode) || (char ? "practice" : "guided");

  const [items, setItems] = useState<Kanji[] | null>(null);
  const [strokes, setStrokes] = useState<StrokeMap>({});
  const [idx, setIdx] = useState(0);
  const [trace, setTrace] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    setItems(null);
    loadKanji(level).then(setItems);
    loadStrokes(level).then(setStrokes);
  }, [level]);

  const sequence = useMemo(() => {
    if (!items) return [];
    if (mode === "guided") return items.filter((k) => strokes[k.k]).slice(0, 40);
    if (mode === "practice") return items.filter((k) => strokes[k.k]);
    return items.filter((k) => strokes[k.k]);
  }, [items, strokes, mode]);

  const current: Kanji | undefined = char
    ? items?.find((k) => k.k === char)
    : sequence[idx];

  const done = Object.keys(doc.writing).length;
  const avg = useMemo(() => {
    const vals = Object.values(doc.writing).map((w) => w.best);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  }, [doc.writing]);

  const filtered = useMemo(() => {
    const n = q.trim();
    if (!n || !items) return items ?? [];
    return items.filter((k) => k.k === n || k.mn.some((m) => m.includes(n)) || k.en.some((e) => e.toLowerCase().includes(n.toLowerCase())));
  }, [items, q]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-jp text-[11.5px] tracking-[0.3em] text-shu-500">書き取り</p>
          <h1 className="mt-1 text-[1.7rem] font-extrabold leading-tight tracking-tight sm:text-[2rem]">Ханз бичих дасгал</h1>
          <p className="mt-1.5 text-[13.5px] text-sumi-500">
            Зурлагын тоо, дараалал, хэлбэрийг автоматаар үнэлнэ · {done} ханз бичиж үзсэн · дундаж {Math.round(avg)}%
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => set({ mode: "practice" })}>Дасгаллах</Button>
          <Button onClick={() => set({ mode: "guided" })}>Хөтөчтэй сурах</Button>
        </div>
      </div>

      <Tabs value={mode} onChange={(m) => { set({ mode: m }); }} items={[
        { id: "guided", label: "Хөтөчтэй дараалал", icon: "順" },
        { id: "practice", label: "Сонгож дасгаллах", icon: "選" },
        { id: "browse", label: "Бүх ханз", icon: "一" },
      ]} />

      {(mode === "guided" || mode === "practice") && (
        <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
          <Card>
            {!items && <Spinner label="Ханз ачаалж байна…" />}
            {current && (
              <>
                <div className="flex flex-wrap items-center gap-3">
                  <LevelBadge level={current.lvl} />
                  <span className="font-mincho text-[3rem] font-bold leading-none">{current.k}</span>
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-bold">{current.mn.join(", ") || current.en.join(", ")}</p>
                    <p className="mt-0.5 font-jp text-[12px] text-sumi-500">
                      音 {current.on.slice(0, 3).join("・") || "—"} / 訓 {current.kun.slice(0, 3).join("・") || "—"}
                    </p>
                  </div>
                  <div className="ml-auto flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={!!char || idx === 0}>← Өмнөх</Button>
                    <Button size="sm" variant="outline" onClick={() => setIdx((i) => Math.min(sequence.length - 1, i + 1))} disabled={!!char || idx >= sequence.length - 1}>Дараагийн →</Button>
                  </div>
                </div>
                <div className="mt-5">
                  <StrokePad
                    key={current.k}
                    kanji={current.k}
                    paths={strokes[current.k] ?? []}
                    trace={trace}
                    onResult={(r) => actions.recordWriting(current.k, r.score)}
                  />
                </div>
              </>
            )}
            {items && !current && <Empty icon="筆" title="Энэ түвшинд бичих ханз олдсонгүй" />}
          </Card>

          <div className="space-y-5">
            <Card>
              <p className="text-[13px] font-extrabold">Тохиргоо</p>
              <button onClick={() => setTrace((v) => !v)}
                className={cn("mt-3 flex w-full items-center justify-between rounded-xl border px-3.5 py-3 text-left transition",
                  trace ? "border-shu-300 bg-shu-50" : "border-sumi-900/10 bg-white/70")}>
                <span>
                  <span className="block text-[12.5px] font-bold">Хөтөч шугам</span>
                  <span className="block text-[11px] text-sumi-500">Зурлагын хэлбэрийг бүдэг харуулна</span>
                </span>
                <span className={cn("relative h-6 w-10 shrink-0 rounded-full transition", trace ? "bg-shu-500" : "bg-sumi-900/20")}>
                  <span className={cn("absolute top-1 h-4 w-4 rounded-full bg-white transition-all", trace ? "left-5" : "left-1")} />
                </span>
              </button>
              <p className="mt-4 text-[11.5px] leading-relaxed text-sumi-500">
                Оноо: хэлбэр 60% + дараалал 25% + зурлагын тоо 15%. Бүх хөтөч KanjiVG-ийн
                бодит вектор замаас гаргасан.
              </p>
            </Card>

            <Card>
              <p className="text-[13px] font-extrabold">Ахиц</p>
              <div className="mt-3 space-y-3">
                <div>
                  <div className="flex justify-between text-[12.5px] font-bold">
                    <span className="text-sumi-600">Бичсэн ханз</span>
                    <span className="font-mono tabnum">{done} / {items?.length ?? 0}</span>
                  </div>
                  <Bar value={done / Math.max(1, items?.length ?? 1)} tone="shu" className="mt-1.5" />
                </div>
                <div>
                  <div className="flex justify-between text-[12.5px] font-bold">
                    <span className="text-sumi-600">Дундаж оноо</span>
                    <span className="font-mono tabnum">{Math.round(avg)}%</span>
                  </div>
                  <Bar value={avg / 100} tone="matcha" className="mt-1.5" />
                </div>
              </div>
              <div className="mt-4 rounded-xl bg-sumi-900/[0.045] px-3.5 py-3 text-[11.5px] leading-relaxed text-sumi-500">
                Оноо 90%-иас дээш гарвал тухайн ханзыг «эзэмшсэн» гэж үзнэ.
              </div>
            </Card>
          </div>
        </div>
      )}

      {mode === "browse" && (
        <Card>
          <SectionTitle jp="漢字を選ぶ" title="Ханз сонгох" sub={`${LEVEL_LABEL[level]} (${level}) — ${items?.length ?? 0} ханз`} />
          <Input value={q} onChange={setQ} placeholder="Ханз эсвэл утга…" icon="🔎" className="max-w-sm" />
          <div className="mt-4 grid grid-cols-6 gap-1.5 sm:grid-cols-10 lg:grid-cols-14">
            {filtered.slice(0, 280).map((k) => {
              const rec = doc.writing[k.k];
              return (
                <a key={k.k} href={href("write", k.k)}
                  className={cn("grid aspect-square place-items-center rounded-lg font-mincho text-[19px] font-bold transition hover:-translate-y-0.5",
                    rec ? (rec.best >= 90 ? "bg-matcha-100 text-matcha-600" : rec.best >= 70 ? "bg-kin-100 text-kin-600" : "bg-shu-50 text-shu-600")
                      : "bg-white/70 text-sumi-700 hover:bg-shu-50")}>
                  {k.k}
                </a>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
