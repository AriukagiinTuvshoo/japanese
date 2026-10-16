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
  unavailable: boolean;
  constructor(status: number, message: string, unavailable = false) {
    super(message);
    this.status = status;
    this.unavailable = unavailable;
  }
}

let token: string | null = null;
export const getToken = () => token;
export const setToken = (t: string | null) => { token = t; };

async function req<T>(path: string, init: RequestInit = {}, timeoutMs = 12_000): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`/api${path}`, {
      ...init,
      signal: ctrl.signal,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init.headers ?? {}),
      },
    });
    const text = await res.text();
    let body: Record<string, unknown> = {};
    if (text.trim()) {
      try {
        const parsed: unknown = JSON.parse(text);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Expected JSON object");
        body = parsed as Record<string, unknown>;
      } catch {
        throw new ApiError(
          res.status,
          "API JSON бус хариу буцаалаа. Байршуулсан API-г шалгаад дахин оролдоно уу. / The API returned a non-JSON response. Check the deployed API and try again.",
          true,
        );
      }
    }
    if (!res.ok) {
      const message = typeof body.error === "string" ? body.error : `API хүсэлт амжилтгүй (HTTP ${res.status}) / API request failed (HTTP ${res.status})`;
      throw new ApiError(res.status, message, [404, 405, 501, 503].includes(res.status));
    }
    return body as T;
  } finally {
    clearTimeout(timer);
  }
}

/** Серверт хүрч чадаж байгаа эсэх. */
export async function ping(): Promise<boolean> {
  try {
    await req<{ ok: boolean }>("/health", {}, 4000);
    return true;
  } catch {
    return false;
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
