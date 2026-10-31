/**
 * Жижиг мэдэгдлийн автобус (toast).
 * React-аас гадна (жишээ нь localStorage бичих алдаа) дуудагдана.
 * Ижил текстийг богино хугацаанд давхар харуулахгүй — quota алдаа
 * 350 мс тутам давтагдахаас сэргийлнэ.
 */

export type NoticeKind = "info" | "success" | "error";

export interface NoticeAction {
  label: string;
  run: () => void;
}

export interface Notice {
  id: number;
  kind: NoticeKind;
  text: string;
  action?: NoticeAction;
  /** 0 = өөрөө арилахгүй (үйлдэл хүлээж байна). */
  ttlMs?: number;
}

export interface NotifyOptions {
  action?: NoticeAction;
  ttlMs?: number;
  dedupeMs?: number;
}

type Listener = (n: Notice) => void;

const listeners = new Set<Listener>();
const lastShown = new Map<string, number>();
let seq = 1;

/**
 * Анхны ачаалалтад `notify()` нь React-ийн effect-ээс ӨМНӨ дуудагдана
 * (жишээ нь `readDoc()` — storage-аас гэмтсэн баримт сэргээсэн мэдэгдэл
 * `useState` initializer дотор). Тухайн үед сонсогч **байхгүй** тул
 * мэдэгдэл алга болж байв (B8 e2e 03 илрүүлсэн). Товчхон дараалалд
 * хадгалж, анхны сонсогч нэгтгэхэд цэгнэнэ.
 */
const backlog: Notice[] = [];
const BACKLOG_MAX = 5;

export function notify(kind: NoticeKind, text: string, opts: NotifyOptions = {}): void {
  if (!text) return;
  const now = Date.now();
  const dedupeMs = opts.dedupeMs ?? 8000;
  const prev = lastShown.get(text) ?? 0;
  if (now - prev < dedupeMs) return;
  lastShown.set(text, now);
  const notice: Notice = { id: seq++, kind, text, action: opts.action, ttlMs: opts.ttlMs ?? (opts.action ? 0 : 8000) };
  if (!listeners.size) {
    backlog.push(notice);
    if (backlog.length > BACKLOG_MAX) backlog.shift();
    return;
  }
  for (const l of listeners) l(notice);
}

export function subscribeNotices(fn: Listener): () => void {
  listeners.add(fn);
  if (backlog.length) {
    // Хуучин дарааллыг (хуучин сонсогч руу явсан ч болов) цэгнэнэ.
    for (const n of backlog.splice(0)) fn(n);
  }
  return () => {
    listeners.delete(fn);
  };
}
