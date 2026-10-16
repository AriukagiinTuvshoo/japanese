import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "../utils/cn";
import {
  compareKanji, makeUserStroke, parseKanji, scaleFor, VERDICT_MN,
  type CompareResult, type Stroke, type UserStroke,
} from "../lib/stroke";
import { Bar, Button, Chip } from "./ui";
import { useStore } from "../lib/store";

type Tool = "pen" | "erase";

/**
 * Ханз бичих дасгалын талбар.
 * KanjiVG-ийн вектор замыг хөтөч болгон харуулж, хэрэглэгчийн зурсныг
 * зурлагын тоо, дараалал, хэлбэрээр үнэлнэ.
 */
export function StrokePad({
  kanji, paths, size = 320, onResult, trace: initialTrace = true,
}: {
  kanji: string;
  paths: string[];
  size?: number;
  onResult?: (r: CompareResult) => void;
  trace?: boolean;
}) {
  const target: Stroke[] = useMemo(() => parseKanji(paths), [paths]);
  const [userStrokes, setUserStrokes] = useState<UserStroke[]>([]);
  const [live, setLive] = useState<[number, number][]>([]);
  const [result, setResult] = useState<CompareResult | null>(null);
  const [tool, setTool] = useState<Tool>("pen");
  const [trace, setTrace] = useState(initialTrace);
  const [hint, setHint] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  const t = useMemo(() => scaleFor(size), [size]);

  /* ── зурлагыг дахин зурах ── */
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = size * dpr;
    c.height = size * dpr;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);

    // KanjiVG-ийн координатын систем рүү шилжих transform
    const enter = () => {
      ctx.save();
      ctx.translate(t.ox, t.oy);
      ctx.scale(t.k, t.k);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
    };
    const leave = () => ctx.restore();

    // 1) Хөтөч шугам
    if (trace) {
      enter();
      ctx.strokeStyle = "rgba(28,27,24,0.14)";
      ctx.lineWidth = 6 / t.k;
      for (const s of target) ctx.stroke(new Path2D(s.d));
      leave();
    }

    // 2) Дараагийн зурлагын зөвлөмж
    if (hint > 0 && hint <= target.length) {
      enter();
      ctx.strokeStyle = "rgba(204,70,48,0.5)";
      ctx.lineWidth = 5 / t.k;
      ctx.setLineDash([5 / t.k, 4 / t.k]);
      ctx.stroke(new Path2D(target[hint - 1].d));
      leave();
    }

    // 3) Хэрэглэгчийн бичсэн шугамууд
    ctx.save();
    ctx.strokeStyle = "#1c1b18";
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const s of userStrokes) {
      ctx.beginPath();
      s.pts.forEach((p, i) => {
        const [x, y] = [t.ox + p[0] * t.k, t.oy + p[1] * t.k];
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }
    if (live.length > 1) {
      ctx.strokeStyle = "#2f5385";
      ctx.beginPath();
      live.forEach((p, i) => {
        const [x, y] = [t.ox + p[0] * t.k, t.oy + p[1] * t.k];
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }
    ctx.restore();

    // 4) Зурлагын эхлэлийн цэгүүд
    ctx.save();
    target.forEach((s, i) => {
      const [x, y] = [t.ox + s.s[0] * t.k, t.oy + s.s[1] * t.k];
      ctx.fillStyle = i === hint - 1 ? "rgba(204,70,48,0.75)" : "rgba(28,27,24,0.18)";
      ctx.beginPath();
      ctx.arc(x, y, i === hint - 1 ? 4.5 : 2.6, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }, [size, t, target, userStrokes, live, trace, hint]);

  /* ── pointer ── */
  const pos = useCallback((e: React.PointerEvent<HTMLCanvasElement>): [number, number] => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * size;
    const y = ((e.clientY - r.top) / r.height) * size;
    return [(x - t.ox) / t.k, (y - t.oy) / t.k];
  }, [size, t]);

  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    if (tool === "erase") {
      setUserStrokes((s) => s.slice(0, -1));
      setResult(null);
      return;
    }
    drawing.current = true;
    setResult(null);
    setLive([pos(e)]);
  };

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    setLive((l) => (l.length > 90 ? l : [...l, pos(e)]));
  };

  const up = () => {
    if (!drawing.current) return;
    drawing.current = false;
    const l = live;
    setLive([]);
    const s = makeUserStroke(l);
    if (s) setUserStrokes((prev) => [...prev, s]);
  };

  const resetPad = () => {
    setUserStrokes([]);
    setLive([]);
    setResult(null);
    setHint(0);
  };

  const check = () => {
    const r = compareKanji(target, userStrokes);
    setResult(r);
    onResult?.(r);
  };

  const tone = result ? VERDICT_MN[result.verdict].tone : "sumi";

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
      <div className="mx-auto shrink-0 sm:mx-0">
        <div className="relative rounded-2xl border border-sumi-900/12 bg-white p-1.5 shadow-sm">
          <div className="grid-paper relative overflow-hidden rounded-xl" style={{ width: size, height: size }}>
            <canvas
              ref={canvasRef}
              style={{ width: size, height: size, touchAction: "none" }}
              className="absolute inset-0 cursor-crosshair"
              onPointerDown={down}
              onPointerMove={move}
              onPointerUp={up}
              onPointerCancel={up}
              onPointerLeave={up}
            />
            {userStrokes.length === 0 && live.length === 0 && (
              <span
                className="pointer-events-none absolute inset-0 grid select-none place-items-center font-mincho font-bold text-sumi-900/[0.07]"
                style={{ fontSize: size * 0.58 }}
              >
                {kanji}
              </span>
            )}
          </div>
          <span className="pointer-events-none absolute bottom-3 left-4 font-mono text-[10px] font-bold text-sumi-300">
            {kanji} · {target.length} зурлага
          </span>
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <Button size="sm" variant={tool === "pen" ? "dark" : "outline"} onClick={() => setTool("pen")}>✏️ Үзэг</Button>
          <Button size="sm" variant={tool === "erase" ? "dark" : "outline"} onClick={() => { setTool("erase"); setUserStrokes((s) => s.slice(0, -1)); setResult(null); }}>⌫ Буцаах</Button>
          <Button size="sm" variant="outline" onClick={() => setTrace((v) => !v)}>{trace ? "🙈 Хөтөч нуух" : "👁 Хөтөч харуулах"}</Button>
          <Button size="sm" variant="ghost" onClick={resetPad}>↺ Арилгах</Button>
        </div>
      </div>

      <div className="w-full min-w-0 flex-1 space-y-3">
        <div className="card-flat p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[13px] font-bold text-sumi-700">Бичих явц</p>
            <Chip tone={userStrokes.length >= target.length ? "matcha" : "kin"}>
              {userStrokes.length} / {target.length} зурлага
            </Chip>
          </div>
          <Bar
            value={Math.min(1, userStrokes.length / Math.max(1, target.length))}
            tone={userStrokes.length >= target.length ? "matcha" : "kin"}
            className="mt-2.5"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" onClick={check} disabled={userStrokes.length === 0}>✓ Шалгах</Button>
            <Button size="sm" variant="outline" onClick={() => setHint((h) => Math.min(target.length, h + 1))} disabled={hint >= target.length}>
              💡 Дараагийн зурлага
            </Button>
          </div>
        </div>

        {result && (
          <div className={cn("animate-pop rounded-2xl border p-4", `border-${tone}-200 bg-${tone}-50`)}>
            <div className="flex items-baseline justify-between">
              <p className={cn("text-[15px] font-extrabold", `text-${tone}-700`)}>{VERDICT_MN[result.verdict].text}</p>
              <p className="font-mono text-[1.6rem] font-extrabold tabnum leading-none text-sumi-900">{result.score}%</p>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {[
                { l: "Зурлага", v: `${result.strokeCount.user}/${result.strokeCount.expected}` },
                { l: "Дараалал", v: `${result.orderScore}%` },
                { l: "Хэлбэр", v: `${result.shapeScore}%` },
              ].map((x) => (
                <div key={x.l} className="rounded-xl bg-white/80 px-3 py-2">
                  <p className="text-[10.5px] font-bold uppercase tracking-wide text-sumi-400">{x.l}</p>
                  <p className="mt-0.5 font-mono text-[14px] font-extrabold tabnum">{x.v}</p>
                </div>
              ))}
            </div>
            {(result.missing.length > 0 || result.extra.length > 0) && (
              <p className="mt-3 text-[12px] font-bold text-sumi-600">
                {result.missing.length > 0 && <>Дутуу {result.missing.length} зурлага. </>}
                {result.extra.length > 0 && <>Илүү/буруу {result.extra.length}. </>}
                {result.matches.length > 0 && <>Зөв таарсан {result.matches.length}.</>}
              </p>
            )}
          </div>
        )}

        <p className="rounded-xl bg-white/50 px-3.5 py-2.5 text-[11.5px] leading-relaxed text-sumi-500">
          Хөтөч шугам нь <strong>KanjiVG</strong> (CC-BY-SA 3.0) сангаас — Японы сургуулийн
          стандарт бичих дарааллаар. Хэрэглэгчийн бичсэн шугамыг зурлагын байрлал,
          чиглэл, урт, дарааллаар харьцуулж оноолно.
        </p>
      </div>
    </div>
  );
}

/** SRS-д ханз/үг нэмэх товч. */
export function AddToSrs({ id, asNew = true }: { id: string; asNew?: boolean }) {
  const { doc, actions } = useStore();
  const has = !!doc.srs[id];
  return (
    <Button size="sm" variant={has ? "soft" : "outline"} onClick={() => actions.grade(id, 2, { isNew: !has && asNew })}>
      {has ? "✓ SRS-д бий" : "+ SRS-д нэмэх"}
    </Button>
  );
}
