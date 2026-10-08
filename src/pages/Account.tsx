import { useState } from "react";
import { useStore } from "../lib/store";
import { Card, PageHeader, Tabs } from "../components/ui";
import { AuthForm, Profile, Settings, SyncPanel } from "../components/AccountModal";

type Tab = "account" | "settings" | "sync";

export default function Account() {
  const { account, serverAvailable } = useStore();
  const [tab, setTab] = useState<Tab>("account");

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        jp="人 · アカウント"
        title="Аккаунт"
        sub="Ахиц, тохиргоо, SRS хуваарь бүгд таны аккаунтад холбогдоно. Нэг аккаунтаар лаптоп, утас, таблет дээр ижил ахицаа үргэлжлүүлнэ."
      />
      <Card className="p-0">
        <div className="border-b border-sumi-900/10 px-5 py-3">
          <Tabs
            value={tab}
            onChange={setTab}
            items={[
              { id: "account", label: account ? "Профайл" : "Нэвтрэх · Бүртгүүлэх", icon: "人" },
              { id: "settings", label: "Сурах тохиргоо", icon: "設" },
              { id: "sync", label: "Синхрон · нөөц", icon: "雲" },
            ]}
          />
        </div>
        <div className="px-5 py-6 sm:px-7">
          {!serverAvailable && tab !== "settings" && (
            <p className="mb-5 rounded-xl bg-kin-50 px-4 py-3 text-[12.5px] font-semibold text-kin-600">
              Сервер одоогоор холбогдоогүй байна. Ахиц таны төхөөрөмжид локалаар хадгалагдаж байгаа бөгөөд сервер холбогдмогц синхрончлогдоно.
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
