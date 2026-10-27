/**
 * Жижиг мэдэгдлийн автобус (toast).
 * React-аас гадна (жишээ нь localStorage бичих алдаа) дуудагдана.
 * Ижил текстийг богино хугацаанд давхар харуулахгүй — quota алдаа
 * 350 мс тутам давтагдахаас сэргийлнэ.
 */

export type NoticeKind = "info" | "success" | "error";

export interface Notice {
  id: number;
  kind: NoticeKind;
  text: string;
}

type Listener = (n: Notice) => void;

const listeners = new Set<Listener>();
const lastShown = new Map<string, number>();
let seq = 1;

export function notify(kind: NoticeKind, text: string, dedupeMs = 8000): void {
  if (!text) return;
  const now = Date.now();
  const prev = lastShown.get(text) ?? 0;
  if (now - prev < dedupeMs) return;
  lastShown.set(text, now);
  const notice: Notice = { id: seq++, kind, text };
  for (const l of listeners) l(notice);
}

export function subscribeNotices(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
