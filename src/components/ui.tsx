/** Дахин хэрэглэгдэх UI элементүүд. */
import {
  useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type ReactNode,
} from "react";
import { useStore } from "../lib/store";
import { cn } from "../utils/cn";
import { href } from "../lib/router";
import type { Level } from "../lib/types";
import { parseFurigana } from "../lib/text";

/* ─────────────── Товчлуур ─────────────── */
type Variant = "primary" | "ghost" | "outline" | "soft" | "danger" | "dark";
type Size = "sm" | "md" | "lg" | "icon";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-shu-500 text-washi-50 hover:bg-shu-600 active:bg-shu-700 shadow-sm",
  dark: "bg-sumi-900 text-washi-50 hover:bg-sumi-800",
  ghost: "text-sumi-700 hover:bg-sumi-900/6",
  outline: "border border-sumi-900/15 bg-white/70 text-sumi-800 hover:border-sumi-900/30 hover:bg-white",
  soft: "bg-sumi-900/6 text-sumi-800 hover:bg-sumi-900/10",
  danger: "bg-shu-50 text-shu-700 hover:bg-shu-100",
};
const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-[12.5px] rounded-lg gap-1.5",
  md: "h-10 px-4 text-[13.5px] rounded-xl gap-2",
  lg: "h-12 px-6 text-[15px] rounded-xl gap-2",
  icon: "h-9 w-9 rounded-lg justify-center",
};

export function Button({
  variant = "primary", size = "md", className, children, ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button
      {...rest}
      className={cn(
        "inline-flex select-none items-center justify-center font-bold transition-all duration-150",
        "disabled:cursor-not-allowed disabled:opacity-40",
        VARIANTS[variant], SIZES[size], className,
      )}
    >
      {children}
    </button>
  );
}

export function LinkButton({
  to, variant = "ghost", size = "md", className, children,
}: { to: string; variant?: Variant; size?: Size; className?: string; children: ReactNode }) {
  return (
    <a href={href(to)} className={cn("inline-flex select-none items-center justify-center font-bold transition-all", VARIANTS[variant], SIZES[size], className)}>
      {children}
    </a>
  );
}

/* ─────────────── Карт, гарчиг ─────────────── */
export function Card({ className, children, as: As = "div" }: { className?: string; children: ReactNode; as?: "div" | "section" | "article" }) {
  return <As className={cn("card p-5", className)}>{children}</As>;
}

export function SectionTitle({
  jp, title, sub, right,
}: { jp?: string; title: string; sub?: string; right?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {jp && <p className="font-jp text-[11px] font-medium tracking-[0.28em] text-sumi-400">{jp}</p>}
        <h2 className="mt-0.5 break-words text-[1.3rem] font-extrabold tracking-tight text-sumi-900">{title}</h2>
        {sub && <p className="mt-1 text-[13px] leading-relaxed text-sumi-500">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

export function PageHeader({
  jp, title, sub, actions, children,
}: { jp?: string; title: string; sub?: string; actions?: ReactNode; children?: ReactNode }) {
  return (
    <header className="mb-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          {jp && <p className="font-jp text-[11.5px] font-medium tracking-[0.3em] text-shu-500">{jp}</p>}
          <h1 className="mt-1 text-[1.7rem] font-extrabold leading-tight tracking-tight text-sumi-900 sm:text-[2rem]">{title}</h1>
          {sub && <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-sumi-500">{sub}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </header>
  );
}

/* ─────────────── Chip / Badge ─────────────── */
export type Tone = "shu" | "ai" | "matcha" | "kin" | "murasaki" | "sumi";

const TONES: Record<Tone, string> = {
  shu: "bg-shu-50 text-shu-700 border-shu-100",
  ai: "bg-ai-50 text-ai-700 border-ai-100",
  matcha: "bg-matcha-50 text-matcha-600 border-matcha-100",
  kin: "bg-kin-50 text-kin-600 border-kin-100",
  murasaki: "bg-murasaki-50 text-murasaki-600 border-murasaki-100",
  sumi: "bg-sumi-900/5 text-sumi-600 border-sumi-900/10",
};

export function Chip({
  tone = "sumi", children, className, title,
}: { tone?: Tone; children: ReactNode; className?: string; title?: string }) {
  return (
    <span title={title} className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold leading-none", TONES[tone], className)}>
      {children}
    </span>
  );
}

export const LEVEL_TONE: Record<Level, Tone> = { N5: "matcha", N4: "ai", N3: "kin", N2: "murasaki", N1: "shu" };

export function LevelBadge({ level, className, size = "md" }: { level: Level; className?: string; size?: "sm" | "md" }) {
  const t = LEVEL_TONE[level];
  return (
    <span className={cn(
      "inline-grid place-items-center rounded-md border font-mono font-extrabold leading-none",
      size === "sm" ? "h-5 min-w-[26px] px-1 text-[10px]" : "h-7 min-w-[34px] px-1.5 text-[12.5px]",
      TONES[t], className,
    )}>
      {level}
    </span>
  );
}

export function Badge({ children, tone = "sumi" }: { children: ReactNode; tone?: Tone }) {
  return <span className={cn("rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide", TONES[tone])}>{children}</span>;
}

/* ─────────────── Явц ─────────────── */
export function Bar({ value, tone = "shu", className, height = 8 }: { value: number; tone?: Tone; className?: string; height?: number }) {
  const colors: Record<Tone, string> = {
    shu: "bg-shu-500", ai: "bg-ai-500", matcha: "bg-matcha-500",
    kin: "bg-kin-400", murasaki: "bg-murasaki-500", sumi: "bg-sumi-500",
  };
  return (
    <div className={cn("w-full overflow-hidden rounded-full bg-sumi-900/8", className)} style={{ height }}>
      <div
        className={cn("h-full rounded-full transition-[width] duration-500", colors[tone])}
        style={{ width: `${Math.max(0, Math.min(100, value * 100))}%` }}
      />
    </div>
  );
}

export function Ring({
  value, size = 64, stroke = 6, tone = "shu", children, track,
}: { value: number; size?: number; stroke?: number; tone?: Tone; children?: ReactNode; track?: string }) {
  const colors: Record<Tone, string> = {
    shu: "#cc4630", ai: "#2f5385", matcha: "#688c45", kin: "#b88a2d", murasaki: "#6f4b89", sumi: "#78736a",
  };
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track ?? "rgba(28,27,24,0.10)"} strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={colors[tone]} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v)}
          style={{ transition: "stroke-dashoffset 600ms cubic-bezier(0.22,1,0.36,1)" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}

/* ─────────────── Ruby (фуригана) ─────────────── */
export function Furigana({
  text, show = true, className,
}: { text: string; show?: boolean; className?: string }) {
  const parts = parseFurigana(text);
  if (!show) return <span className={cn("font-jp", className)}>{text.replace(/\{([^|{}]+)\|([^}]+)\}/g, "$1")}</span>;
  return (
    <span className={cn("font-jp", className)}>
      {parts.map((p, i) =>
        p.ruby ? (
          <ruby key={i}>{p.base}<rt>{p.ruby}</rt></ruby>
        ) : (
          <span key={i}>{p.base}</span>
        ),
      )}
    </span>
  );
}

/* ─────────────── Модал ─────────────── */
export function Modal({
  children, onClose, title, wide, footer, lang = "mn",
}: { children: ReactNode; onClose?: () => void; title?: string; wide?: boolean; footer?: ReactNode; lang?: "mn" | "en" }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", k);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", k);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[70] grid place-items-end bg-sumi-950/55 backdrop-blur-[3px] sm:place-items-center sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "washi flex max-h-[94vh] w-full animate-pop flex-col overflow-hidden rounded-t-3xl border border-sumi-900/10 shadow-2xl sm:rounded-3xl",
          wide ? "sm:max-w-3xl" : "sm:max-w-lg",
        )}
      >
        {title && (
          <div className="flex shrink-0 items-center justify-between border-b border-sumi-900/10 px-6 py-4">
            <h2 className="text-[1.15rem] font-extrabold">{title}</h2>
            {onClose && (
              <button onClick={onClose} aria-label={lang === "en" ? "Close" : "Хаах"} className="grid h-8 w-8 place-items-center rounded-lg bg-sumi-900/6 text-sumi-600 hover:bg-sumi-900/10">✕</button>
            )}
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        {footer && <div className="shrink-0 border-t border-sumi-900/10 bg-white/50 px-6 py-4">{footer}</div>}
      </div>
    </div>
  );
}

/* ─────────────── Таб ─────────────── */
export function Tabs<T extends string>({
  value, onChange, items, className, size = "md",
}: { value: T; onChange: (v: T) => void; items: { id: T; label: string; badge?: number | string; icon?: string }[]; className?: string; size?: "sm" | "md" }) {
  return (
    <div className={cn("no-scrollbar flex gap-1 overflow-x-auto rounded-xl bg-sumi-900/5 p-1", className)}>
      {items.map((it) => (
        <button
          key={it.id}
          onClick={() => onChange(it.id)}
          className={cn(
            "relative flex shrink-0 items-center gap-1.5 rounded-lg font-bold transition-all",
            size === "sm" ? "px-2.5 py-1.5 text-[12px]" : "px-3.5 py-2 text-[13px]",
            value === it.id ? "bg-white text-sumi-900 shadow-sm" : "text-sumi-500 hover:text-sumi-800",
          )}
        >
          {it.icon && <span className="font-jp text-[13px]">{it.icon}</span>}
          {it.label}
          {it.badge !== undefined && it.badge !== 0 && (
            <span className="rounded-full bg-shu-500 px-1.5 py-px font-mono text-[10px] font-bold text-white tabnum">{it.badge}</span>
          )}
        </button>
      ))}
    </div>
  );
}

/* ─────────────── Хоосон төлөв / ачаалж байна ─────────────── */
export function Empty({ icon = "空", title, sub, action }: { icon?: string; title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="grid place-items-center rounded-2xl border border-dashed border-sumi-900/15 bg-white/40 px-6 py-14 text-center">
      <span className="font-mincho text-[2.6rem] font-bold text-sumi-900/15">{icon}</span>
      <p className="mt-3 text-[15px] font-extrabold text-sumi-800">{title}</p>
      {sub && <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-sumi-500">{sub}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Spinner({ label, lang }: { label?: string; lang?: "mn" | "en" }) {
  const { doc } = useStore();
  lang ??= doc.profile.language ?? "mn";
  return (
    <div className="flex items-center justify-center gap-3 py-14 text-sumi-500">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-sumi-900/15 border-t-shu-500" />
      <span className="text-[13px] font-bold">{label ?? (lang === "en" ? "Loading…" : "Ачаалж байна…")}</span>
    </div>
  );
}

export function ErrorBox({ error, retry, lang }: { error: unknown; retry?: () => void; lang?: "mn" | "en" }) {
  const { doc } = useStore();
  lang ??= doc.profile.language ?? "mn";
  return (
    <div className="rounded-2xl border border-shu-100 bg-shu-50/60 p-5">
      <p className="text-[14px] font-extrabold text-shu-700">{lang === "en" ? "Failed to load" : "Ачаалахад алдаа гарлаа"}</p>
      <p className="mt-1 font-mono text-[12px] text-shu-600">{String((error as Error)?.message ?? error)}</p>
      {retry && <Button variant="outline" size="sm" className="mt-3" onClick={retry}>{lang === "en" ? "Try again" : "Дахин оролдох"}</Button>}
    </div>
  );
}

/* ─────────────── Статистик хайрцаг ─────────────── */
export function Stat({
  label, value, sub, tone = "sumi", icon,
}: { label: string; value: ReactNode; sub?: string; tone?: Tone; icon?: string }) {
  return (
    <div className="card-flat px-4 py-3.5">
      <div className="flex items-center gap-2">
        {icon && <span className={cn("font-jp text-[13px] font-bold", `text-${tone}-600`)}>{icon}</span>}
        <p className="text-[11.5px] font-bold uppercase tracking-wider text-sumi-400">{label}</p>
      </div>
      <p className="mt-1.5 text-[1.35rem] font-extrabold tabnum leading-none text-sumi-900">{value}</p>
      {sub && <p className="mt-1 text-[11.5px] text-sumi-500">{sub}</p>}
    </div>
  );
}

/* ─────────────── Хайлтын оролт ─────────────── */
export function Input({
  value, onChange, placeholder, className, autoFocus, onKeyDown, type = "text", icon,
}: {
  value: string; onChange: (v: string) => void; placeholder?: string; className?: string;
  autoFocus?: boolean; onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void; type?: string; icon?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      {icon && <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[15px] text-sumi-400">{icon}</span>}
      <input
        type={type}
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className={cn(
          "h-11 w-full rounded-xl border border-sumi-900/12 bg-white/80 font-semibold text-sumi-900 outline-none transition",
          "placeholder:font-medium placeholder:text-sumi-400 focus:border-shu-400 focus:bg-white focus:ring-4 focus:ring-shu-500/10",
          icon ? "pl-10 pr-3.5" : "px-3.5",
        )}
      />
    </div>
  );
}

export function Select<T extends string>({
  value, onChange, options, className,
}: { value: T; onChange: (v: T) => void; options: { id: T; label: string }[]; className?: string }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className={cn("h-10 rounded-xl border border-sumi-900/12 bg-white/80 px-3 text-[13px] font-bold text-sumi-800 outline-none focus:border-shu-400", className)}
    >
      {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
    </select>
  );
}

/* ─────────────── Хуудаслалт ─────────────── */
export function Pager({
  page, pages, onPage,
}: { page: number; pages: number; onPage: (p: number) => void }) {
  if (pages <= 1) return null;
  const list: (number | "…")[] = [];
  const push = (n: number | "…") => { if (list[list.length - 1] !== n) list.push(n); };
  for (let i = 1; i <= pages; i++) {
    if (i === 1 || i === pages || Math.abs(i - page) <= 1) push(i);
    else push("…");
  }
  return (
    <div className="flex items-center justify-center gap-1.5 pt-6">
      <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => onPage(page - 1)}>←</Button>
      {list.map((it, i) =>
        it === "…" ? (
          <span key={`e${i}`} className="px-1 text-sumi-400">…</span>
        ) : (
          <button
            key={it}
            onClick={() => onPage(it)}
            className={cn(
              "h-8 min-w-8 rounded-lg px-2 text-[12.5px] font-bold tabnum transition",
              it === page ? "bg-sumi-900 text-washi-50" : "bg-white/70 text-sumi-600 hover:bg-white",
            )}
          >
            {it}
          </button>
        ),
      )}
      <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => onPage(page + 1)}>→</Button>
    </div>
  );
}

/* ─────────────── Аудио товч ─────────────── */
export function SpeakButton({
  text, rate = 1, className, label, lang,
}: { text: string; rate?: number; className?: string; label?: string; lang?: "mn" | "en" }) {
  const { doc } = useStore();
  const language = lang ?? doc.profile.language ?? "mn";
  const [on, setOn] = useState(false);
  return (
    <button
      onMouseDown={() => setOn(true)}
      onMouseUp={() => setOn(false)}
      onMouseLeave={() => setOn(false)}
      onClick={(e) => {
        e.stopPropagation();
        speak(text, rate);
      }}
      title={language === "en" ? "Listen" : "Сонсох"}
      aria-label={language === "en" ? `Listen to ${text}` : `${text} дуудлагыг сонсох`}
      className={cn(
        "grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-sumi-900/10 bg-white/80 text-[14px] transition",
        "hover:border-ai-400 hover:text-ai-600",
        on && "scale-95 bg-ai-50",
        className,
      )}
    >
      {label ?? "🔊"}
    </button>
  );
}

let voices: SpeechSynthesisVoice[] = [];
function loadVoices() {
  voices = window.speechSynthesis?.getVoices?.() ?? [];
}
if (typeof window !== "undefined" && "speechSynthesis" in window) {
  loadVoices();
  window.speechSynthesis.addEventListener?.("voiceschanged", loadVoices);
}

export function speak(text: string, rate = 1) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const clean = text.replace(/\{([^|{}]+)\|([^}]+)\}/g, "$1");
  const u = new SpeechSynthesisUtterance(clean);
  u.lang = "ja-JP";
  u.rate = rate;
  const ja = voices.filter((v) => v.lang.startsWith("ja"));
  if (ja[0]) u.voice = ja[0];
  window.speechSynthesis.speak(u);
}

/** Хэсэгчилсэн прогресс мөр (тоо + шугам). */
export function ProgressRow({
  label, value, max, tone = "shu", hint,
}: { label: string; value: number; max: number; tone?: Tone; hint?: string }) {
  const pct = max ? value / max : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[13px] font-bold text-sumi-700">{label}</span>
        <span className="font-mono text-[12px] font-bold tabnum text-sumi-500">
          {value}/{max}{hint ? ` · ${hint}` : ""}
        </span>
      </div>
      <Bar value={pct} tone={tone} className="mt-2" height={7} />
    </div>
  );
}

/** Харагдах үед lazy ачаалах. */
export function useLazy<T>(load: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const tick = useRef(0);
  const id = useId();

  useEffect(() => {
    const me = ++tick.current;
    setLoading(true);
    setError(null);
    load()
      .then((d) => { if (me === tick.current) { setData(d); setLoading(false); } })
      .catch((e) => { if (me === tick.current) { setError(e); setLoading(false); } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const retry = () => {
    const me = ++tick.current;
    setLoading(true);
    setError(null);
    load()
      .then((d) => { if (me === tick.current) { setData(d); setLoading(false); } })
      .catch((e) => { if (me === tick.current) { setError(e); setLoading(false); } });
  };

  return { data, error, loading, retry, key: id };
}
