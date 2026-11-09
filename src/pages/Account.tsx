import { useState } from "react";
import { useStore } from "../lib/store";
import { Card, PageHeader, Tabs } from "../components/ui";
import { AuthForm, Profile, Settings, SyncPanel } from "../components/AccountModal";
import { ACCOUNT_BACKEND_AVAILABLE } from "../lib/api";
import { ui } from "../lib/i18n";

type Tab = "account" | "settings" | "sync";

export default function Account() {
  const { doc, account, serverAvailable } = useStore();
  const language = doc.profile.language ?? "mn";
  const t = ui[language];
  const [tab, setTab] = useState<Tab>("account");

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        jp="人 · アカウント"
        title={t.accountPageTitle}
        sub={ACCOUNT_BACKEND_AVAILABLE ? t.accountPageSub : t.localOnlyPageSub}
      />
      <Card className="p-0">
        <div className="border-b border-sumi-900/10 px-5 py-3">
          <Tabs
            value={tab}
            onChange={setTab}
            items={[
              {
                id: "account",
                label: ACCOUNT_BACKEND_AVAILABLE ? (account ? t.profileTab : t.loginSignupTab) : t.localOnlyTab,
                icon: "人",
              },
              { id: "settings", label: t.studySettingsTab, icon: "設" },
              { id: "sync", label: ACCOUNT_BACKEND_AVAILABLE ? t.syncTab : t.fileBackup, icon: "雲" },
            ]}
          />
        </div>
        <div className="px-5 py-6 sm:px-7">
          {ACCOUNT_BACKEND_AVAILABLE && !serverAvailable && tab !== "settings" && (
            <p className="mb-5 rounded-xl bg-kin-50 px-4 py-3 text-[12.5px] font-semibold text-kin-600">
              {t.serverOfflineNote}
            </p>
          )}
          {tab === "account" && (ACCOUNT_BACKEND_AVAILABLE && account ? <Profile account={account} /> : <AuthForm />)}
          {tab === "settings" && <Settings />}
          {tab === "sync" && <SyncPanel />}
        </div>
      </Card>
    </div>
  );
}
