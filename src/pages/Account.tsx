import { useState } from "react";
import { useStore } from "../lib/store";
import { Card, PageHeader, Tabs } from "../components/ui";
import { AuthForm, Profile, Settings, SyncPanel } from "../components/AccountModal";
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
        sub={t.accountPageSub}
      />
      <Card className="p-0">
        <div className="border-b border-sumi-900/10 px-5 py-3">
          <Tabs
            value={tab}
            onChange={setTab}
            items={[
              { id: "account", label: account ? t.profileTab : t.loginSignupTab, icon: "人" },
              { id: "settings", label: t.studySettingsTab, icon: "設" },
              { id: "sync", label: t.syncTab, icon: "雲" },
            ]}
          />
        </div>
        <div className="px-5 py-6 sm:px-7">
          {!serverAvailable && tab !== "settings" && (
            <p className="mb-5 rounded-xl bg-kin-50 px-4 py-3 text-[12.5px] font-semibold text-kin-600">
              {t.serverOfflineNote}
            </p>
          )}
          {tab === "account" && (account ? <Profile account={account} /> : <AuthForm />)}
          {tab === "settings" && <Settings />}
          {tab === "sync" && <SyncPanel />}
        </div>
      </Card>
    </div>
  );
}
