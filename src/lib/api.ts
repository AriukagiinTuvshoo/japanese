/**
 * Backend-тай холбогдох нимгэн клиент.
 * ------------------------------------------------------------------
 * Апп нь бүрэн офлайн ажиллана: сервер байхгүй үед бүх ахиц локал
 * хадгалагдаж, сүлжээ сэргэхэд автоматаар синхрончлогдоно.
 *
 * Хөгжүүлэлтэд Vite dev сервер `/api`-г Node backend рүү прокси хийнэ
 * (vite.config.ts). Тиймээс хөтөч зөвхөн өөрийн origin-той харилцана.
 */

export interface Account {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  targets?: { level?: string; dailyGoal?: number };
}

export interface SyncDoc {
  rev: number;
  updatedAt: string;
  doc: unknown;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

let token: string | null = null;
export const setToken = (t: string | null) => { token = t; };

interface ApiEnv {
  DEV?: boolean;
  VITE_API_URL?: string;
}

/**
 * API-ийн суурь хаяг, эсвэл `null` — backend огт тохируулаагүй.
 * · `VITE_API_URL` байвал түүнийг ашиглана (production-д ч).
 * · dev дээр Vite `/api`-г прокси хийдэг тул "" (same-origin).
 * · static host (GitHub Pages) дээр backend байхгүй → `null`: хэзээ ч
 *   дуудалт хийхгүй, тиймээс консолд 500/404 шуугиан гарахгүй.
 */
export function apiBase(env: ApiEnv = import.meta.env as unknown as ApiEnv): string | null {
  const explicit = env.VITE_API_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  if (env.DEV) return "";
  return null;
}

/**
 * Бүтэлгүйтсэн health шалгалтын дараах хүлээлт: 30с → 60с → 120с … дээд тал 10 мин.
 * Сервер байхгүй үед 60 секунд тутам давтахгүй.
 */
export function backoffMs(failures: number): number {
  const n = Number.isFinite(failures) ? Math.max(0, Math.min(Math.floor(failures), 6)) : 0;
  return Math.min(30_000 * 2 ** n, 600_000);
}

async function req<T>(path: string, init: RequestInit = {}, timeoutMs = 12_000): Promise<T> {
  const base = apiBase();
  if (base === null) throw new ApiError(0, "no-backend");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${base}/api${path}`, {
      ...init,
      signal: ctrl.signal,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init.headers ?? {}),
      },
    });
    const text = await res.text();
    const body = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    if (!res.ok) throw new ApiError(res.status, (body.error as string) ?? `HTTP ${res.status}`);
    return body as T;
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  health: () => req<{ ok: boolean; version: string }>("/health"),

  register: (email: string, password: string, name: string) =>
    req<{ token: string; account: Account }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, name }),
    }),

  login: (email: string, password: string) =>
    req<{ token: string; account: Account }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  me: () => req<{ account: Account }>("/auth/me"),

  logout: () => req<{ ok: boolean }>("/auth/logout", { method: "POST" }),

  updateProfile: (patch: Partial<Account>) =>
    req<{ account: Account }>("/auth/profile", { method: "PATCH", body: JSON.stringify(patch) }),

  getSync: () => req<SyncDoc>("/sync"),

  putSync: (doc: unknown, rev: number) =>
    req<{ rev: number; updatedAt: string }>("/sync", {
      method: "PUT",
      body: JSON.stringify({ doc, rev }),
    }),

  /** Ахицыг төхөөрөмж хооронд гараар шилжүүлэх код үүсгэнэ. */
  makePairCode: () => req<{ code: string; expiresAt: number }>("/sync/pair", { method: "POST" }),
  redeemPairCode: (code: string) =>
    req<{ token: string; account: Account }>("/sync/pair/redeem", {
      method: "POST",
      body: JSON.stringify({ code }),
    }),

  /* ── Админ CMS ── */
  adminOverview: () => req<AdminOverview>("/admin/overview"),
  adminQueue: (kind?: string) => req<{ items: QueueItem[] }>(`/admin/queue${kind ? `?kind=${kind}` : ""}`),
  adminReview: (id: string, action: "approve" | "reject", patch?: { mn?: string }) =>
    req<{ ok: boolean }>(`/admin/queue/${id}`, { method: "POST", body: JSON.stringify({ action, ...patch }) }),
  adminImport: (payload: { kind: string; entries: unknown[]; note?: string }) =>
    req<{ added: number; skipped: number }>("/admin/import", { method: "POST", body: JSON.stringify(payload) }),
};

export interface AdminOverview {
  accounts: number;
  activeToday: number;
  reviewsToday: number;
  content: { vocab: number; kanji: number; grammar: number; listening: number; reading: number };
  queue: { pending: number; approved: number; rejected: number };
  top: { word: string; mn: string; misses: number }[];
  errors: string[];
  serverVersion: string;
  uptimeSec: number;
}

export interface QueueItem {
  id: string;
  kind: "vocab" | "kanji" | "grammar" | "listening" | "reading";
  ref: string;
  level: string;
  en: string;
  mn: string;
  status: "pending_review" | "approved" | "rejected";
  origin: "auto" | "derived" | "ai" | "human";
  note?: string;
  updatedAt: string;
}
