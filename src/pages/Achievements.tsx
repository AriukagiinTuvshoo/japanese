import { cn } from "../utils/cn";
import { useStore } from "../lib/store";
import { ACHIEVEMENTS, rankOf, RANKS } from "../lib/gamification";
import { dayOffset, todayKey } from "../lib/text";
import { Bar, Card, Chip, Ring, SectionTitle } from "../components/ui";
import { ui } from "../lib/i18n";

export default function Achievements() {
  const { doc, inputs, streak, levelInfo, unlocked } = useStore();
  const language = doc.profile.language ?? "mn";
  const t = ui[language];
  const rank = rankOf(levelInfo.level);
  const unlockedIds = new Set(unlocked.map((u) => u.id));

  const days = Object.entries(doc.activity).filter(([, d]) => d.xp > 0).map(([k]) => k).sort();

  return (
    <div className="space-y-6">
      <div>
        <p className="font-jp text-[11.5px] tracking-[0.3em] text-shu-500">実績</p>
        <h1 className="mt-1 text-[1.7rem] font-extrabold leading-tight tracking-tight sm:text-[2rem]">{t.achievementsTitle}</h1>
        <p className="mt-1.5 text-[13.5px] text-sumi-500">
          {unlocked.length} / {ACHIEVEMENTS.length} {t.unlockedUnit} · {t.level} {levelInfo.level} · {rank.jp} ({language === "en" ? rank.en : rank.mn})
        </p>
      </div>

      <Card className="overflow-hidden bg-sumi-900 p-0 text-washi-50">
        <div className="seigaiha relative p-6">
          <div className="relative flex flex-wrap items-center gap-6">
            <Ring value={levelInfo.pct} size={104} stroke={9} tone="shu" track="rgba(255,255,255,0.1)">
              <div className="text-center">
                <p className="font-mono text-[1.6rem] font-extrabold leading-none tabnum">{levelInfo.level}</p>
                <p className="mt-0.5 text-[9.5px] text-washi-400">{t.levelChip}</p>
              </div>
            </Ring>
            <div className="min-w-0 flex-1">
              <p className="font-mincho text-[2rem] font-bold leading-none">{rank.jp}</p>
              <p className="mt-1.5 text-[13px] text-washi-300">{language === "en" ? rank.en : rank.mn} · {doc.xp.toLocaleString()} {t.pointsUnit2}</p>
              <div className="mt-3 max-w-sm">
                <Bar value={levelInfo.pct} tone="shu" />
                <p className="mt-1.5 text-[11.5px] text-washi-400">
                  {t.nextLevelIn(levelInfo.need - levelInfo.into)}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
              {[
                { l: t.statStreak, v: `${streak}` },
                { l: t.statActiveDays, v: `${days.length}` },
                { l: t.statReviews, v: `${inputs.reviews}` },
                { l: t.statMinutes, v: `${inputs.minutes}` },
              ].map((x) => (
                <div key={x.l} className="rounded-xl border border-white/10 bg-white/[0.05] px-3.5 py-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-washi-400">{x.l}</p>
                  <p className="mt-1 font-mono text-[16px] font-extrabold tabnum">{x.v}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <SectionTitle jp="称号" title={t.ranksTitle} sub={t.ranksSub} />
        <div className="flex flex-wrap gap-2">
          {RANKS.map((r, i) => {
            const lvl = i * 6 + 1;
            const reached = levelInfo.level >= lvl;
            return (
              <div key={r} className={cn("flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5",
                reached ? "border-kin-200 bg-kin-50" : "border-sumi-900/8 bg-white/50 opacity-55")}>
                <span className={cn("grid h-8 w-8 place-items-center rounded-lg font-mincho text-[15px] font-bold",
                  reached ? "bg-kin-500 text-white" : "bg-sumi-900/6 text-sumi-400")}>{r}</span>
                <div>
                  <p className="text-[12.5px] font-bold">{t.rankN(i + 1)}</p>
                  <p className="font-mono text-[10.5px] text-sumi-500">{t.levelNPlus(lvl)}</p>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <SectionTitle jp="バッジ" title={t.badgesTitle} sub={t.badgesSub(ACHIEVEMENTS.length)} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ACHIEVEMENTS.map((a) => {
          const p = a.progress(inputs);
          const got = unlockedIds.has(a.id) || p >= 1;
          const at = doc.achievements[a.id];
          return (
            <div key={a.id} className={cn("card flex items-start gap-3.5 p-4 transition",
              got ? "border-kin-200 bg-kin-50/40" : "opacity-80")}>
              <span className={cn("grid h-12 w-12 shrink-0 place-items-center rounded-xl font-mincho text-[20px] font-bold",
                got ? "bg-kin-500 text-white" : "bg-sumi-900/6 text-sumi-400")}>
                {got ? a.icon : "?"}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-[13.5px] font-extrabold">{language === "en" ? a.titleEn : a.title}</p>
                  {got && <Chip tone="matcha">✓</Chip>}
                </div>
                <p className="mt-0.5 text-[12px] leading-snug text-sumi-500">{language === "en" ? a.descEn : a.desc}</p>
                {!got && (
                  <div className="mt-2">
                    <Bar value={p} tone="kin" height={5} />
                    <p className="mt-1 font-mono text-[10.5px] text-sumi-400">{Math.round(p * 100)}%</p>
                  </div>
                )}
                {got && at && (
                  <p className="mt-1.5 text-[10.5px] text-kin-600">
                    {t.unlockedAt(new Date(at).toLocaleDateString(language === "en" ? "en-US" : "mn-MN"))}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Card>
        <SectionTitle jp="連続記録" title={t.streakRecordTitle} sub={t.streakRecordSub} />
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: 84 }, (_, i) => {
            const k = dayOffset(todayKey(), -(83 - i));
            const d = doc.activity[k];
            const xp = d?.xp ?? 0;
            return (
              <span key={k} title={`${k} · ${xp} ${t.pointsUnit2}`}
                className={cn("h-4 w-4 rounded-[3px]",
                  xp === 0 ? "bg-sumi-900/8" : xp < 40 ? "bg-matcha-200" : xp < 120 ? "bg-matcha-400" : "bg-matcha-600")} />
            );
          })}
        </div>
        <p className="mt-3 text-[12px] text-sumi-500">
          {t.recentWeeks(days.length)}
        </p>
      </Card>
    </div>
  );
}
