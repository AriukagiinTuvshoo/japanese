import { useEffect, useState } from "react";
import { loadMeta } from "../lib/data";
import type { DataMeta } from "../lib/types";
import { Card, ErrorBox, PageHeader, SectionTitle, Spinner, Stat } from "../components/ui";
import { useStore } from "../lib/store";
import { ui } from "../lib/i18n";

export default function About() {
  const { doc } = useStore();
  const language = doc.profile.language ?? "mn";
  const t = ui[language];
  const [meta, setMeta] = useState<DataMeta | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    loadMeta().then(setMeta).catch(setError);
  }, []);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        jp="about"
        title={t.aboutTitle}
        sub={t.aboutSub}
      />

      <Card>
        <SectionTitle jp="方針" title={t.principles} />
        <ul className="space-y-2.5 text-[14px] leading-relaxed text-sumi-700">
          <li>{t.principle1}</li>
          <li>{t.principle2}</li>
          <li>{t.principle3}</li>
          <li>{t.principle4}</li>
        </ul>
      </Card>

      <Card>
        <SectionTitle jp="資料" title={t.dataSources} sub={t.dataSourcesSub} />
        {error ? <ErrorBox error={error} /> : !meta ? <Spinner /> : (
          <>
            <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label={t.wordSg} value={meta.counts.vocab.toLocaleString()} />
              <Stat label={t.kanji} value={meta.counts.kanji.toLocaleString()} />
              <Stat label={t.grammar} value={meta.counts.grammar.toLocaleString()} />
              <Stat label={t.versionRow} value={meta.version} sub={new Date(meta.builtAt).toLocaleDateString(language === "en" ? "en-US" : "mn-MN")} />
            </div>
            <ul className="divide-y divide-sumi-900/8">
              {meta.sources.map((s) => (
                <li key={s.id} className="py-3">
                  <a href={s.url} target="_blank" rel="noreferrer" className="text-[14px] font-bold text-ai-700 underline-offset-4 hover:underline">
                    {s.name}
                  </a>
                  <p className="mt-0.5 text-[12.5px] text-sumi-500">{t.licenseLabel} {s.license}</p>
                  {language === "mn" && s.note && <p className="mt-0.5 text-[12.5px] text-sumi-500">{s.note}</p>}
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>
    </div>
  );
}
