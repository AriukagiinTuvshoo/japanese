import { Component, type ErrorInfo, type ReactNode } from "react";
import { ui } from "../lib/i18n";
import { docKey } from "../lib/storage";

interface Props {
  children: ReactNode;
  language: "mn" | "en";
  /** Фаталын дараа route солиход boundary-г шинэчилнэ. */
  resetKey?: string;
}

interface State {
  error: Error | null;
}

function currentUid(): string {
  try {
    return localStorage.getItem("nd:session") ?? "local";
  } catch {
    return "local";
  }
}

function exportData(): void {
  try {
    const raw = localStorage.getItem(docKey(currentUid())) ?? "{}";
    const blob = new Blob([raw], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `nihongo-dojo-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  } catch {
    /* экспорт хийх боломжгүй — хэрэглэгч дахин ачаалж болно */
  }
}

function resetData(): void {
  try {
    localStorage.removeItem(docKey(currentUid()));
  } catch {
    /* private mode */
  }
  location.reload();
}

/**
 * Route бүрийг ороох boundary: нэг хуудасны алдаа бүх аппыг цайруулахгүй.
 * Хэрэглэгчид дата экспортлох, дахин ачаалах, эхнээс эхлэх сонголт өгнө.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Локал лог — гадаад телеметр байхгүй (privacy-first).
    console.error("[route-error]", error, info.componentStack);
  }

  componentDidUpdate(prev: Props): void {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    const t = ui[this.props.language];
    return (
      <div className="mx-auto max-w-xl py-16">
        <div className="card p-6">
          <p className="font-jp text-[12px] tracking-[0.28em] text-shu-500">error</p>
          <h1 className="mt-2 text-[1.35rem] font-extrabold">{t.errTitle}</h1>
          <p className="mt-2 text-[13.5px] leading-relaxed text-sumi-600">{t.errSub}</p>

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              onClick={() => location.reload()}
              className="rounded-xl bg-shu-500 px-4 py-2.5 text-[13px] font-bold text-white"
            >
              {t.errReload}
            </button>
            <button
              onClick={exportData}
              className="rounded-xl border border-sumi-900/15 bg-white px-4 py-2.5 text-[13px] font-bold text-sumi-700"
            >
              {t.errExport}
            </button>
            <button
              onClick={() => {
                if (confirm(t.errResetConfirm)) resetData();
              }}
              className="rounded-xl border border-shu-200 bg-shu-50 px-4 py-2.5 text-[13px] font-bold text-shu-700"
            >
              {t.errReset}
            </button>
          </div>

          <details className="mt-5">
            <summary className="cursor-pointer text-[12px] font-bold text-sumi-500">{t.errDetail}</summary>
            <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-sumi-900/5 p-3 font-mono text-[11px] leading-relaxed text-sumi-600">
              {String(error?.stack ?? error?.message ?? error)}
            </pre>
          </details>
        </div>
      </div>
    );
  }
}
