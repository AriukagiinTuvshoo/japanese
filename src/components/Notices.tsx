import { useEffect, useState } from "react";
import { subscribeNotices, type Notice } from "../lib/notice";
import { cn } from "../utils/cn";

const TONE: Record<Notice["kind"], string> = {
  error: "border-shu-200 bg-shu-50 text-shu-700",
  success: "border-matcha-200 bg-matcha-50 text-matcha-600",
  info: "border-ai-200 bg-ai-50 text-ai-700",
};

/** Доод таб дээрээс дээш гарч, 8 секундын дараа өөрөө алга болно. */
export default function Notices() {
  const [items, setItems] = useState<Notice[]>([]);

  useEffect(() => {
    const off = subscribeNotices((n) => {
      setItems((prev) => [...prev.slice(-2), n]);
      window.setTimeout(() => setItems((prev) => prev.filter((x) => x.id !== n.id)), 8000);
    });
    return off;
  }, []);

  if (!items.length) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-[70] flex flex-col gap-2 lg:bottom-6 lg:left-auto lg:right-6 lg:w-[380px]"
      aria-live="polite"
      aria-atomic="false"
    >
      {items.map((n) => (
        <div
          key={n.id}
          role={n.kind === "error" ? "alert" : "status"}
          className={cn(
            "pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 text-[13px] font-semibold shadow-lg animate-pop",
            TONE[n.kind],
          )}
        >
          <span className="mt-0.5 text-[15px] leading-none" aria-hidden="true">
            {n.kind === "error" ? "⚠" : n.kind === "success" ? "✓" : "ℹ"}
          </span>
          <span className="flex-1 leading-snug">{n.text}</span>
          <button
            onClick={() => setItems((prev) => prev.filter((x) => x.id !== n.id))}
            className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-current/70 hover:bg-black/5"
            aria-label="✕"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
