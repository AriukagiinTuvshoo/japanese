import { useEffect, useState } from "react";
import { loadMeta } from "../lib/data";
import type { DataMeta } from "../lib/types";
import { Card, ErrorBox, PageHeader, SectionTitle, Spinner, Stat } from "../components/ui";

export default function About() {
  const [meta, setMeta] = useState<DataMeta | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    loadMeta().then(setMeta).catch(setError);
  }, []);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        jp="about"
        title="Тухай"
        sub="Nihongo Dōjō нь JLPT-д бэлдэх монгол хэлний сургалтын платформ. Өгөгдөл нь нээлттэй эх сурвалжаас, лиценз, гаралтын мэдээлэлтэй хамт бүртгэгдсэн."
      />

      <Card>
        <SectionTitle jp="方針" title="Зарчим" />
        <ul className="space-y-2.5 text-[14px] leading-relaxed text-sumi-700">
          <li>· Үг, ханз, дүрмийн өгөгдөл нь эх сурвалжтай. AI нь JLPT-ийн мэдээллийн эх сурвалж биш.</li>
          <li>· AI-аар гаргасан бүх агуулга <b>pending_review</b> төлөвтэй орж, хүний баталгаажуулалтаар л нийтлэгдэнэ.</li>
          <li>· Видео хичээлүүд зөвхөн зөвшөөрөгдсөн YouTube embed-ээр харагдана. Видеог татаж, хуулж, дахин нийтлэхгүй.</li>
          <li>· Шалгалтын оноо нь албан ёсны JLPT оноо биш, <b>“тооцоолсон дадлагын оноо”</b> гэж тэмдэглэгдэнэ.</li>
        </ul>
      </Card>

      <Card>
        <SectionTitle jp="資料" title="Өгөгдлийн эх сурвалж" sub="Дараах эх сурвалжуудаас бодит өгөгдөл ачаалагдсан. Лицензийн нөхцөлийг доор харна уу." />
        {error ? <ErrorBox error={error} /> : !meta ? <Spinner /> : (
          <>
            <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Үг" value={meta.counts.vocab.toLocaleString()} />
              <Stat label="Ханз" value={meta.counts.kanji.toLocaleString()} />
              <Stat label="Дүрэм" value={meta.counts.grammar.toLocaleString()} />
              <Stat label="Версия" value={meta.version} sub={new Date(meta.builtAt).toLocaleDateString("mn-MN")} />
            </div>
            <ul className="divide-y divide-sumi-900/8">
              {meta.sources.map((s) => (
                <li key={s.id} className="py-3">
                  <a href={s.url} target="_blank" rel="noreferrer" className="text-[14px] font-bold text-ai-700 underline-offset-4 hover:underline">
                    {s.name}
                  </a>
                  <p className="mt-0.5 text-[12.5px] text-sumi-500">Лиценз: {s.license}</p>
                  {s.note && <p className="mt-0.5 text-[12.5px] text-sumi-500">{s.note}</p>}
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>
    </div>
  );
}
