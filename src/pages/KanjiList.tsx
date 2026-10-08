import { useEffect, useMemo, useState } from "react";
import { cn } from "../utils/cn";
import { href, useQuery } from "../lib/router";
import { useStore } from "../lib/store";
import { loadKanji, loadStrokes } from "../lib/data";
import type { Kanji, Level, StrokeMap } from "../lib/types";
import { LEVEL_LABEL, MQ_LABEL } from "../lib/text";
import { cardStage } from "../lib/srs";
import { Button, Card, Empty, Input, LevelBadge, Pager, Select, Spinner, Tabs } from "../components/ui";
import { KanjiStudy } from "../components/KanjiStudy";

const PER_PAGE = 84;

export default function KanjiList() {
  const { query, set } = useQuery();
  const { doc } = useStore();
  const level = (query.level as Level) || (doc.profile.current === "zero" ? doc.profile.target : doc.profile.current);
  const tab = (query.tab as string) || "browse";

  const [items, setItems] = useState<Kanji[] | null>(null);
  const [strokes, setStrokes] = useState<StrokeMap | null>(null);
  const [q, setQ] = useState("");
  const [rad, setRad] = useState<string>("all");
  const [sort, setSort] = useState<"freq" | "stroke" | "grade" | "level">("freq");
  const [page, setPage] = useState(1);

  useEffect(() => {
    setItems(null);
    loadKanji(level).then(setItems);
    loadStrokes(level).then(setStrokes);
    setPage(1);
  }, [level]);

  const radicals = useMemo(() => {
    if (!items) return [];
    const m = new Map<string, number>();
    for (const k of items) if (k.rad) m.set(k.rad, (m.get(k.rad) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 24);
  }, [items]);

  const filtered = useMemo(() => {
    if (!items) return [];
    let out = items;
    const n = q.trim().toLowerCase();
    if (n) out = out.filter((k) => k.k === n || k.on.some((r) => r.includes(n)) || k.kun.some((r) => r.includes(n)) ||
      k.en.some((e) => e.toLowerCase().includes(n)) || k.mn.some((m) => m.toLowerCase().includes(n)));
    if (rad !== "all") out = out.filter((k) => k.rad === rad);
    if (sort === "stroke") out = out.slice().sort((a, b) => (a.s ?? 99) - (b.s ?? 99));
    else if (sort === "grade") out = out.slice().sort((a, b) => (a.g ?? 99) - (b.g ?? 99));
    else if (sort === "level") out = out.slice().sort((a, b) => (b.f ?? 9999) - (a.f ?? 9999));
    return out;
  }, [items, q, rad, sort]);

  const pages = Math.ceil(filtered.length / PER_PAGE);
  const pageItems = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const learned = items?.filter((k) => doc.srs[k.k]).length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-jp text-[11.5px] tracking-[0.3em] text-shu-500">漢字帳</p>
          <h1 className="mt-1 text-[1.7rem] font-extrabold leading-tight tracking-tight sm:text-[2rem]">Ханз</h1>
          <p className="mt-1.5 text-[13.5px] text-sumi-500">
            {LEVEL_LABEL[level]} ({level}) · {items ? `${items.length} ханз` : "…"} · {learned} судалсан
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => set({ tab: "write" })}>筆 Бичих дасгал</Button>
          <Button onClick={() => set({ tab: "study" })}>学 Суралцах</Button>
        </div>
      </div>

      <Tabs value={tab} onChange={(t) => set({ tab: t })}
        items={[
          { id: "browse", label: "Жагсаалт", icon: "一", badge: filtered.length || undefined },
          { id: "study", label: "Суралцах сесс", icon: "学" },
          { id: "write", label: "Бичих дасгал", icon: "筆" },
        ]} />

      {tab === "study" && <KanjiStudy level={level} items={items ?? []} strokes={strokes ?? {}} />}
      {tab === "write" && (
        <Card>
          <p className="text-[13.5px] font-extrabold">Бичих дасгал</p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-sumi-500">
            Аль нэг ханзыг сонгоод бичиж эхлээрэй. Бичих дасгалын хуудас нь зурлагын тоо,
            дараалал, хэлбэрийг үнэлж оноо өгнө.
          </p>
          <div className="mt-4 grid grid-cols-6 gap-1.5 sm:grid-cols-12">
            {(items ?? []).slice(0, 96).map((k) => (
              <a key={k.k} href={href("write", k.k)}
                className="grid aspect-square place-items-center rounded-lg bg-white/70 font-mincho text-[19px] font-bold transition hover:-translate-y-0.5 hover:bg-shu-50">
                {k.k}
              </a>
            ))}
          </div>
        </Card>
      )}

      {tab === "browse" && (
        <>
          <Card className="p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Input value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Ханз, уншлага, утга…" icon="🔎" className="min-w-[200px] flex-1" />
              <Select value={sort} onChange={setSort}
                options={[{ id: "freq", label: "Давтамжаар" }, { id: "stroke", label: "Зурлагаар" }, { id: "grade", label: "Ангиар" }, { id: "level", label: "Түвшнээр" }]} />
            </div>
            {radicals.length > 0 && (
              <div className="no-scrollbar mt-3 flex gap-1.5 overflow-x-auto">
                <button onClick={() => { setRad("all"); setPage(1); }}
                  className={cn("shrink-0 rounded-lg px-2.5 py-1.5 text-[12px] font-bold transition",
                    rad === "all" ? "bg-sumi-900 text-washi-50" : "bg-sumi-900/5 text-sumi-600")}>
                  Бүх радикал
                </button>
                {radicals.map(([r, c]) => (
                  <button key={r} onClick={() => { setRad(r); setPage(1); }}
                    className={cn("flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-[12px] font-bold transition",
                      rad === r ? "bg-sumi-900 text-washi-50" : "bg-sumi-900/5 text-sumi-600 hover:text-sumi-900")}>
                    <span className="font-mincho text-[14px]">{r}</span>
                    <span className="tabnum opacity-60">{c}</span>
                  </button>
                ))}
              </div>
            )}
          </Card>

          {!items && <Spinner label="Ханз ачаалж байна…" />}
          {items && pageItems.length === 0 && <Empty icon="無" title="Илэрц олдсонгүй" />}

          {pageItems.length > 0 && (
            <div className="grid gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {pageItems.map((k) => <KanjiTile key={k.k} k={k} />)}
            </div>
          )}

          <Pager page={page} pages={pages} onPage={setPage} />
          {pages > 1 && <p className="text-center text-[12px] text-sumi-400">Нийт {filtered.length} ханз · {PER_PAGE} ханз/хуудас</p>}
        </>
      )}
    </div>
  );
}

function KanjiTile({ k }: { k: Kanji }) {
  const { doc } = useStore();
  const card = doc.srs[k.k];
  const stage = cardStage(card);
  const mq = MQ_LABEL[k.mq];
  return (
    <a href={href("kanji", k.k)} className="card-flat group relative flex flex-col p-3.5 transition hover:-translate-y-0.5 hover:border-shu-300">
      <div className="flex items-start justify-between">
        <span className="font-mincho text-[2.6rem] font-bold leading-none text-sumi-900">{k.k}</span>
        <div className="flex flex-col items-end gap-1">
          <LevelBadge level={k.lvl} size="sm" />
          <span className="font-mono text-[10px] text-sumi-400">{k.s}画</span>
        </div>
      </div>
      <p className="mt-2.5 line-clamp-1 text-[12.5px] font-bold text-sumi-800">{k.mn.join(", ") || k.en.join(", ")}</p>
      <p className="mt-1 line-clamp-1 font-jp text-[11px] text-sumi-400">
        {k.on.slice(0, 2).join("・")}{k.kun.length ? ` / ${k.kun.slice(0, 2).join("・")}` : ""}
      </p>
      <div className="mt-2.5 flex items-center gap-1.5">
        <span className={cn("h-1.5 w-1.5 rounded-full",
          stage.tone === "matcha" ? "bg-matcha-500" : stage.tone === "ai" ? "bg-ai-500" : stage.tone === "kin" ? "bg-kin-400" : "bg-sumi-300")} />
        <span className="text-[10.5px] font-bold text-sumi-500">{stage.mn}</span>
        {mq.tone !== "matcha" && <span className="ml-auto text-[10px] text-sumi-300" title={mq.text}>◐</span>}
      </div>
    </a>
  );
}
