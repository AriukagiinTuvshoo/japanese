import { useEffect, useRef, useState } from "react";
import { cn } from "../utils/cn";
import { useStore } from "../lib/store";
import { api } from "../lib/api";
import { Button, Chip, Modal, Tabs } from "./ui";
import { fmtDate } from "../lib/text";
import { ui } from "../lib/i18n";

type Tab = "account" | "settings" | "sync";

export function AccountModal({ onClose }: { onClose: () => void }) {
  const { doc, account, syncing, serverAvailable, lastSync, streak, levelInfo } = useStore();
  const language = doc.profile.language ?? "mn";
  const t = ui[language];
  const [tab, setTab] = useState<Tab>(account ? "account" : "account");
  return (
    <Modal onClose={onClose} title={t.accountTitle} wide>
      <div className="border-b border-sumi-900/10 px-6 py-3">
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { id: "account", label: account ? t.profileTab : t.loginTab, icon: "人" },
            { id: "settings", label: t.studySettingsTab, icon: "設" },
            { id: "sync", label: t.syncTab, icon: "雲" },
          ]}
        />
      </div>
      <div className="px-6 py-6">
        {tab === "account" && (account ? <Profile account={account} /> : <AuthForm />)}
        {tab === "settings" && <Settings />}
        {tab === "sync" && <SyncPanel />}
      </div>
      <div className="flex flex-wrap items-center gap-3 border-t border-sumi-900/10 bg-white/50 px-6 py-3 text-[11.5px] text-sumi-500">
        <span className="tabnum">{t.level} {levelInfo.level}</span>
        <span>·</span>
        <span className="tabnum">{doc.xp.toLocaleString()} {t.pointsUnit2}</span>
        <span>·</span>
        <span>{streak} {t.days}</span>
        <span className="ml-auto flex items-center gap-2">
          <Chip tone={serverAvailable ? "matcha" : "sumi"}>
            {serverAvailable ? t.serverConnected : t.offlineMode}
          </Chip>
          {account && (
            <Chip tone={syncing === "error" ? "shu" : syncing === "syncing" ? "kin" : "matcha"}>
              {syncing === "syncing" ? t.syncingNow : syncing === "error" ? t.syncError : lastSync ? t.lastSyncAt(new Date(lastSync).toLocaleTimeString(language === "en" ? "en-US" : "mn-MN", { hour: "2-digit", minute: "2-digit" })) : t.syncReady}
            </Chip>
          )}
        </span>
      </div>
    </Modal>
  );
}

export function Profile({ account }: { account: { email: string; name: string; createdAt: string } }) {
  const { doc, actions, actions: { signOut } } = useStore();
  const language = doc.profile.language ?? "mn";
  const t = ui[language];
  const [name, setName] = useState(doc.profile.name);
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 rounded-2xl border border-sumi-900/10 bg-white/60 p-4">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-sumi-900 font-mincho text-[24px] font-bold text-washi-50">
          {(name || account.email)[0]?.toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[15px] font-extrabold">{name || account.name || t.unnamed}</p>
          <p className="truncate text-[12.5px] text-sumi-500">{account.email}</p>
          <p className="mt-0.5 text-[11.5px] text-sumi-400">{t.registeredAt} {fmtDate(new Date(account.createdAt).getTime(), language)}</p>
        </div>
        <Button variant="outline" size="sm" className="ml-auto" onClick={() => signOut()}>{t.signOut}</Button>
      </div>

      <label className="block">
        <span className="text-[12.5px] font-bold text-sumi-700">{t.displayName}</span>
        <div className="mt-1.5 flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-11 flex-1 rounded-xl border border-sumi-900/15 bg-white px-4 text-[14px] font-semibold outline-none focus:border-shu-500"
          />
          <Button onClick={() => actions.patchProfile({ name: name.trim() })}>{t.save}</Button>
        </div>
      </label>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { l: t.targetLevelLabel, v: doc.profile.target },
          { l: t.currentLevelRow, v: doc.profile.current === "zero" ? t.beginnerWord : doc.profile.current },
          { l: t.dailyGoalRow, v: `${doc.profile.dailyGoal} ${t.minutes}` },
        ].map((x) => (
          <div key={x.l} className="card-flat px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-sumi-400">{x.l}</p>
            <p className="mt-1 font-mono text-[16px] font-extrabold">{x.v}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AuthForm() {
  const { actions, serverAvailable } = useStore();
  const { doc } = useStore();
  const language = doc.profile.language ?? "mn";
  const t = ui[language];
  const [mode, setMode] = useState<"in" | "up">("up");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const submit = async () => {
    setMsg("");
    if (!email.includes("@")) return setMsg(t.emailErr);
    if (password.length < 6) return setMsg(t.pwErr);
    setBusy(true);
    try {
      if (mode === "up") await actions.signUp(email, password, name);
      else await actions.signIn(email, password);
    } catch (e) {
      setMsg(
        (e as Error).message === "email_taken" ? t.emailTaken
          : (e as Error).message === "invalid_credentials" ? t.badCreds
          : serverAvailable ? t.errPrefix((e as Error).message) : t.serverDown,
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      {serverAvailable ? (
        <div className="rounded-2xl border border-ai-100 bg-ai-50/60 p-4">
          <p className="text-[13.5px] font-extrabold text-ai-700">{t.whyAccount}</p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-ai-600">
            {t.whyAccountBody}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-kin-100 bg-kin-50/60 p-4">
          <p className="text-[13.5px] font-extrabold text-kin-600">{t.regDisabled}</p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-kin-600">
            {t.regDisabledBody}
          </p>
        </div>
      )}

      <Tabs
        value={mode}
        onChange={setMode}
        items={[{ id: "up", label: t.signupTab }, { id: "in", label: t.loginTab }]}
      />

      <div className="space-y-3">
        {mode === "up" && (
          <label className="block">
            <span className="text-[12.5px] font-bold text-sumi-700">{t.nameField}</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t.nameField}
              className="mt-1.5 h-11 w-full rounded-xl border border-sumi-900/15 bg-white px-4 text-[14px] font-semibold outline-none focus:border-shu-500" />
          </label>
        )}
        <label className="block">
          <span className="text-[12.5px] font-bold text-sumi-700">{t.emailField}</span>
          <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@mail.mn"
            className="mt-1.5 h-11 w-full rounded-xl border border-sumi-900/15 bg-white px-4 text-[14px] font-semibold outline-none focus:border-shu-500" />
        </label>
        <label className="block">
          <span className="text-[12.5px] font-bold text-sumi-700">{t.pwField}</span>
          <input type="password" autoComplete={mode === "up" ? "new-password" : "current-password"} value={password}
            onChange={(e) => setPassword(e.target.value)} placeholder={t.pwHint}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            className="mt-1.5 h-11 w-full rounded-xl border border-sumi-900/15 bg-white px-4 text-[14px] font-semibold outline-none focus:border-shu-500" />
        </label>
      </div>

      {msg && <p className="rounded-xl bg-shu-50 px-3.5 py-2.5 text-[12.5px] font-bold text-shu-700">{msg}</p>}

      <div className="flex items-center gap-3">
        <Button size="lg" disabled={busy || !serverAvailable} onClick={submit} className="flex-1">
          {busy ? t.wait : mode === "up" ? t.signupTab : t.loginTab}
        </Button>
        <Button variant="ghost" size="lg" onClick={() => actions.guestMode()}>{t.asGuest}</Button>
      </div>

    </div>
  );
}

export function Settings() {
  const { doc, actions } = useStore();
  const language = doc.profile.language ?? "mn";
  const t = ui[language];
  const p = doc.profile;
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-[12.5px] font-bold text-sumi-700">{t.dailyGoalInput}</span>
          <input type="number" min={5} max={300} value={p.dailyGoal}
            onChange={(e) => actions.patchProfile({ dailyGoal: Math.max(5, Number(e.target.value) || 30) })}
            className="mt-1.5 h-11 w-full rounded-xl border border-sumi-900/15 bg-white px-4 text-[14px] font-semibold outline-none focus:border-shu-500" />
        </label>
        <label className="block">
          <span className="text-[12.5px] font-bold text-sumi-700">{t.newCardsInput}</span>
          <input type="number" min={0} max={80} value={p.newPerDay}
            onChange={(e) => actions.patchProfile({ newPerDay: Math.max(0, Number(e.target.value) || 0) })}
            className="mt-1.5 h-11 w-full rounded-xl border border-sumi-900/15 bg-white px-4 text-[14px] font-semibold outline-none focus:border-shu-500" />
        </label>
      </div>

      <div className="space-y-2.5">
        <Toggle label={t.furiganaToggle} sub={t.furiganaSub} on={p.furigana} onChange={(v) => actions.patchProfile({ furigana: v })} />
        <Toggle label={t.romajiToggle} sub={t.romajiSub} on={p.romaji} onChange={(v) => actions.patchProfile({ romaji: v })} />
      </div>

      <label className="block">
        <span className="flex justify-between text-[12.5px] font-bold text-sumi-700">
          {t.speechRate} <span className="font-mono tabnum">{p.rate.toFixed(2)}×</span>
        </span>
        <input type="range" min={0.5} max={1.3} step={0.05} value={p.rate}
          onChange={(e) => actions.patchProfile({ rate: Number(e.target.value) })} className="mt-2 w-full" />
      </label>

      <div className="rounded-2xl border border-sumi-900/10 bg-white/60 p-4">
        <p className="text-[13.5px] font-bold">{t.examDateTitle}</p>
        <p className="mt-1 text-[12px] text-sumi-500">{t.examDateSub}</p>
        <input type="date" value={p.examDate} onChange={(e) => actions.patchProfile({ examDate: e.target.value })}
          className="mt-2.5 h-10 rounded-xl border border-sumi-900/15 bg-white px-3 text-[13px] font-semibold outline-none focus:border-shu-500" />
      </div>
    </div>
  );
}

function Toggle({ label, sub, on, onChange }: { label: string; sub?: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-sumi-900/10 bg-white/60 px-4 py-3">
      <div>
        <p className="text-[13.5px] font-bold">{label}</p>
        {sub && <p className="text-[12px] text-sumi-500">{sub}</p>}
      </div>
      <button
        onClick={() => onChange(!on)}
        aria-pressed={on}
        className={cn("relative h-7 w-12 shrink-0 rounded-full transition-colors", on ? "bg-shu-500" : "bg-sumi-900/20")}
      >
        <span className={cn("absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all", on ? "left-6" : "left-1")} />
      </button>
    </div>
  );
}

export function SyncPanel() {
  const { doc, account, actions, syncing, lastSync, serverAvailable } = useStore();
  const language = doc.profile.language ?? "mn";
  const t = ui[language];
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (!msg) return; const t = setTimeout(() => setMsg(""), 5000); return () => clearTimeout(t); }, [msg]);

  const exportData = () => {
    const blob = new Blob([actions.exportJSON()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `nihongo-dojo-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setMsg(t.backupSaved);
  };

  const makeCode = async () => {
    setBusy(true);
    try {
      const res = await api.makePairCode();
      setCode(res.code);
      setMsg(t.codeCreated);
    } catch {
      setMsg(t.codeFail);
    } finally {
      setBusy(false);
    }
  };

  const redeem = async () => {
    setBusy(true);
    try {
      await actions.redeemCode(code.trim().toUpperCase());
      setMsg(t.linked);
    } catch {
      setMsg(t.codeBad);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-sumi-900/10 bg-white/60 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[13.5px] font-bold">{t.cloudSync}</p>
            <p className="mt-1 text-[12px] text-sumi-500">
              {account
                ? `${t.serverConnected} · ${account.email}`
                : serverAvailable ? t.cloudStatusGuest : t.cloudStatusOffline}
            </p>
          </div>
          <Chip tone={account ? "matcha" : "sumi"}>{account ? t.activeChip : t.offChip}</Chip>
        </div>
        {account && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" disabled={syncing === "syncing"} onClick={() => actions.syncNow()}>
              {syncing === "syncing" ? t.syncingNow : t.syncNowBtn}
            </Button>
            {lastSync && <span className="text-[11.5px] text-sumi-400">{t.lastSyncLabel} {new Date(lastSync).toLocaleString(language === "en" ? "en-US" : "mn-MN")}</span>}
          </div>
        )}
      </div>

      {account && (
        <div className="rounded-2xl border border-ai-100 bg-ai-50/50 p-4">
          <p className="text-[13.5px] font-bold text-ai-700">{t.linkDevice}</p>
          <p className="mt-1 text-[12px] leading-relaxed text-ai-600">
            {t.linkDeviceBody}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" disabled={busy || !serverAvailable} onClick={makeCode}>{t.makeCodeBtn}</Button>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ABC123"
              className="h-8 w-32 rounded-lg border border-sumi-900/15 bg-white px-3 font-mono text-[13px] font-bold tracking-widest outline-none focus:border-shu-500"
            />
            <Button size="sm" disabled={busy || code.length < 4} onClick={redeem}>{t.linkBtn}</Button>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-sumi-900/10 bg-white/60 p-4">
        <p className="text-[13.5px] font-bold">{t.fileBackup}</p>
        <p className="mt-1 text-[12px] text-sumi-500">
          {t.fileBackupBody}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" variant="dark" onClick={exportData}>{t.downloadBtn}</Button>
          <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>{t.restoreBtn}</Button>
          <input ref={fileRef} type="file" accept="application/json" className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const ok = actions.importJSON(await f.text());
              setMsg(ok ? t.restoreOk : t.restoreBad);
            }} />
          <Button size="sm" variant="danger" className="ml-auto"
            onClick={() => { if (window.confirm(t.resetConfirm)) { actions.reset(); setMsg(t.resetDone); } }}>
            {t.resetBtn}
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-[11.5px] text-sumi-400">
          <span className="tabnum">{t.srsCardsRow} {Object.keys(doc.srs).length.toLocaleString()}</span>
          <span className="tabnum">{t.reviewsRow} {Object.values(doc.srs).reduce((a, c) => a + c.n, 0).toLocaleString()}</span>
          <span className="tabnum">{t.mistakesRow} {doc.mistakes.length}</span>
        </div>
      </div>

      {msg && <p className="rounded-xl bg-matcha-50 px-3.5 py-2.5 text-[12.5px] font-bold text-matcha-600">{msg}</p>}
    </div>
  );
}
