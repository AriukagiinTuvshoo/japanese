import { useEffect, useMemo, useState } from "react";
import { cn } from "../utils/cn";
import { href, useQuery } from "../lib/router";
import { useStore } from "../lib/store";
import { loadSearchIndex, loadGrammar } from "../lib/data";
import type { Grammar, SearchIndex } from "../lib/types";
import { romajiToKana, toHiragana, toRomaji, TYPE_LABEL } from "../lib/text";
import { Button, Card, Chip, Empty, Furigana, Input, LevelBadge, SpeakButton, Spinner, Tabs } from "../components/ui";

type Dir = "jp-mn" | "mn-jp" | "romaji";
type Kind = "all" | "v" | "k" | "g";

export default function Dictionary({ q: initial }: { q?: string }) {
  const { doc, actions } = useStore();
  const { query, set } = useQuery();
  const [index, setIndex] = useState<SearchIndex | null>(null);
  const [grammar, setGrammar] = useState<Grammar[]>([]);
  const [q, setQ] = useState(initial ?? "");
  const [dir, setDir] = useState<Dir>("jp-mn");
  const [kind, setKind] = useState<Kind>((query.kind as Kind) || "all");

  useEffect(() => {
    loadSearchIndex().then(setIndex);
    Promise.all(["N5", "N4", "N3", "N2", "N1"].map((l) => loadGrammar(l as never))).then((all) => setGrammar(all.flat()));
  }, []);

  useEffect(() => { if (query.q !== undefined && query.q !== q) setQ(query.q); }, [query.q]);

  const results = useMemo(() => {
    if (!index) return null;
    const raw = q.trim();
    if (!raw) return null;
    const lower = raw.toLowerCase();
    const needles = new Set<string>([raw, lower, romajiToKana(lower), toHiragana(raw), toHiragana(romajiToKana(lower))]);
    const match = (text: string, mn: string, en: string, weight: number) => {
      let best = 0;
      for (const n of needles) {
        if (!n) continue;
        if (text === n) best = Math.max(best, 100);
        else if (text.startsWith(n)) best = Math.max(best, 72);
        else if (text.includes(n)) best = Math.max(best, 46);
        else if (mn.includes(n)) best = Math.max(best, 30);
        else if (en.toLowerCase().includes(n)) best = Math.max(best, 18);
      }
      return best * weight;
    };

    const v: { w: string; r: string; mn: string; lvl: string; id: string; s: number }[] = [];
    const k: { w: string; r: string; mn: string; lvl: string; id: string; s: number }[] = [];
    const g: { w: string; r: string; mn: string; lvl: string; id: string; s: number }[] = [];

    for (const [w, r, mn, lvl, tier, id] of index.v) {
      const s = Math.max(
        match(w, mn, w, 1),
        match(r, mn, w, 0.88),
        match(toRomaji(r), mn, w, 0.8),
      ) + (tier === 0 ? 5 : 0);
      if (s > 0) v.push({ w, r, mn, lvl, id, s });
    }
    for (const [ch, on, mn, lvl] of index.k) {
      const s = match(ch, mn, ch, 1) + 6;
      if (s > 6) k.push({ w: ch, r: on, mn, lvl, id: ch, s });
    }
    for (const gr of grammar) {
      const mn = gr.mn ?? (Array.isArray(gr.en) ? gr.en.join("; ") : String(gr.en ?? ""));
      const s2 = match(gr.p.replace(/[〜~]/g, ""), mn, gr.p, 1) + 4;
      if (s2 > 4) g.push({ w: gr.p, r: gr.lvl, mn, lvl: gr.lvl, id: gr.id, s: s2 });
    }

    const sort = (a: { s: number }, b: { s: number }) => b.s - a.s;
    return {
      vocab: v.sort(sort).slice(0, 60),
      kanji: k.sort(sort).slice(0, 40),
      grammar: g.sort(sort).slice(0, 30),
    };
  }, [index, q, grammar]);

  const total = results ? results.vocab.length + results.kanji.length + results.grammar.length : 0;

  return (
    <div className="space-y-6">
      <div>
        <p className="font-jp text-[11.5px] tracking-[0.3em] text-shu-500">辞書</p>
        <h1 className="mt-1 text-[1.7rem] font-extrabold leading-tight tracking-tight sm:text-[2rem]">Толь бичиг</h1>
        <p className="mt-1.5 text-[13.5px] text-sumi-500">
          Хоёр чиглэлт хайлт — япон, ромажи, монгол, англи. {index ? `${index.v.length.toLocaleString()} үг · ${index.k.length.toLocaleString()} ханз · ${grammar.length} дүрэм` : "…"}
        </p>
      </div>

      <Card className="p-5">
        <Tabs value={dir} onChange={setDir} items={[
          { id: "jp-mn", label: "Япон → Монгол", icon: "日" },
          { id: "mn-jp", label: "Монгол → Япон", icon: "蒙" },
          { id: "romaji", label: "Ромажи", icon: "Aa" },
        ]} />

        <Input
          value={q}
          onChange={(v) => { setQ(v); set({ q: v || undefined }); }}
          autoFocus
          placeholder={
            dir === "jp-mn" ? "食べる · たべる · 電車…"
              : dir === "mn-jp" ? "идэх · галт тэрэг · бэлтгэл…"
                : "taberu · densha · kanji…"
          }
          icon="🔎"
          className="mt-4"
        />

        <div className="mt-3 flex flex-wrap gap-1.5">
          {([["all", "Бүгд"], ["v", "Үг"], ["k", "Ханз"], ["g", "Дүрэм"]] as const).map(([id, label]) => (
            <button key={id} onClick={() => { setKind(id); set({ kind: id }); }}
              className={cn("rounded-lg px-2.5 py-1.5 text-[12px] font-bold transition",
                kind === id ? "bg-sumi-900 text-washi-50" : "bg-sumi-900/5 text-sumi-600 hover:text-sumi-900")}>
              {label}
            </button>
          ))}
          {total > 0 && <Chip tone="ai" className="ml-auto">{total} илэрц</Chip>}
        </div>

        <p className="mt-3 text-[11.5px] text-sumi-400">
          Ромажиар ч хайж болно — <span className="font-mono">tabemono</span> гэж бичихэд «食べ物» олдоно.
          Түвшин, утга, уншлага, англи утга бүгдээс хайна.
        </p>
      </Card>

      {!index && <Spinner label="Толь ачаалж байна…" />}
      {index && !q.trim() && <Empty icon="辞" title="Хайлт хийнэ үү" sub="Япон, ромажи, монгол эсвэл англи хэлээр бичээрэй." />}
      {index && q.trim() && total === 0 && <Empty icon="無" title="Илэрц олдсонгүй" sub="Өөр төрлийн бичиглэлээр оролдоно уу." />}

      {results && (
        <>
          {kind !== "k" && kind !== "g" && results.vocab.length > 0 && (
            <Card>
              <p className="text-[12px] font-bold uppercase tracking-[0.2em] text-sumi-400">Үг · {results.vocab.length}</p>
              <ul className="mt-3 divide-y divide-sumi-900/8">
                {results.vocab.map((v) => {
                  const has = !!doc.srs[v.id];
                  return (
                    <li key={v.id} className="flex flex-wrap items-center gap-3 py-3">
                      <a href={href("vocab", v.id)} className="flex min-w-0 flex-1 items-center gap-3">
                        <span className="font-jp text-[17px] font-bold text-sumi-900">{v.w}</span>
                        <span className="shrink-0 font-jp text-[12.5px] text-sumi-500">{v.r}</span>
                        <span className="min-w-0 flex-1 truncate text-[13px] text-sumi-700"
                          style={{ color: v.mn ? undefined : "#9b968c" }}>
                          {v.mn || "орчуулга хүлээж байна"}
                        </span>
                      </a>
                      <LevelBadge level={v.lvl as never} size="sm" />
                      <SpeakButton text={v.w} className="!h-7 !w-7" />
                      <button onClick={() => actions.grade(v.id, 2, { isNew: !has })}
                        className={cn("grid h-7 w-7 place-items-center rounded-lg border text-[13px] transition",
                          has ? "border-matcha-200 bg-matcha-50 text-matcha-600" : "border-sumi-900/10 bg-white/70 text-sumi-400 hover:border-matcha-400")}
                        title={has ? "SRS-д бий" : "SRS-д нэмэх"}>
                        {has ? "✓" : "+"}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}

          {kind !== "v" && kind !== "g" && results.kanji.length > 0 && (
            <Card>
              <p className="text-[12px] font-bold uppercase tracking-[0.2em] text-sumi-400">Ханз · {results.kanji.length}</p>
              <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {results.kanji.map((kk) => (
                  <a key={kk.id} href={href("kanji", kk.id)} className="card-flat flex items-center gap-3 p-3.5 transition hover:-translate-y-0.5 hover:border-shu-300">
                    <span className="font-mincho text-[2.2rem] font-bold leading-none">{kk.w}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-bold text-sumi-800">{kk.mn || "—"}</span>
                      <span className="block truncate font-jp text-[11px] text-sumi-400">{kk.r}</span>
                    </span>
                    <LevelBadge level={kk.lvl as never} size="sm" />
                  </a>
                ))}
              </div>
            </Card>
          )}

          {kind !== "v" && kind !== "k" && results.grammar.length > 0 && (
            <Card>
              <p className="text-[12px] font-bold uppercase tracking-[0.2em] text-sumi-400">Дүрэм · {results.grammar.length}</p>
              <ul className="mt-3 divide-y divide-sumi-900/8">
                {results.grammar.map((gr) => (
                  <li key={gr.id}>
                    <a href={href("grammar", gr.id)} className="flex flex-wrap items-center gap-3 py-3">
                      <span className="font-jp text-[16px] font-bold">{gr.w}</span>
                      <span className="min-w-0 flex-1 truncate text-[13px] text-sumi-700">
                        {gr.mn || <span className="text-sumi-400">тайлбар хүлээж байна</span>}
                      </span>
                      <LevelBadge level={gr.lvl as never} size="sm" />
                    </a>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card>
            <p className="text-[13px] font-extrabold">Уншлага дасгал</p>
            <p className="mt-1 text-[12.5px] text-sumi-500">
              «{q}» гэсэн үг агуулсан жишээ өгүүлбэрүүд:
            </p>
            <ul className="mt-3 space-y-2">
              {results.vocab.slice(0, 3).map((v) => (
                <li key={v.id} className="rounded-xl bg-sumi-900/[0.04] px-3.5 py-3">
                  <Furigana text={v.w} className="text-[15px] font-bold" />
                  <span className="ml-2 text-[13px] text-sumi-600">{v.mn}</span>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}

      <Card className="bg-sumi-900 text-washi-50">
        <div className="flex flex-wrap items-center gap-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/10 font-mincho text-[19px] font-bold">語</span>
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] font-extrabold">Үгийн сүлжээгээр сурах</p>
            <p className="mt-0.5 text-[12.5px] text-washi-300">
              Ханз → үг → холбоотой үг. Нэг ханзаас бүхэл бүлэг үг цээжлэх хамгийн хурдан арга.
            </p>
          </div>
          <Button onClick={() => { window.location.hash = "#/vocab?tab=network"; }}>語 Сүлжээ нээх</Button>
        </div>
      </Card>

      <p className="text-center text-[11.5px] text-sumi-400">
        Толь нь OpenJLPT (CC-BY-SA-4.0) болон JMdict өгөгдөлд суурилна.{" "}
        <a href={href("about")} className="font-bold text-ai-600 underline underline-offset-4">Эх сурвалж →</a>
      </p>
    </div>
  );
}

export { TYPE_LABEL };
