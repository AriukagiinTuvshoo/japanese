import { Suspense, lazy, useEffect } from "react";
import Shell from "./components/Shell";
import { StoreProvider } from "./lib/store";
import { useRoute } from "./lib/router";
import { routeArg, routeLevel } from "./lib/routes";
import { useStore } from "./lib/store";
import { Spinner } from "./components/ui";
import { ui } from "./lib/i18n";
import type { Language } from "./lib/i18n";
import ErrorBoundary from "./components/ErrorBoundary";
import Notices from "./components/Notices";
import GuestMergeDialog from "./components/GuestMergeDialog";
import ImportPreviewModal from "./components/ImportPreviewModal";
import { featureEnabled } from "./lib/features";
import { READING, LISTENING } from "./lib/data";

const Home = lazy(() => import("./pages/Home"));
const Vocabulary = lazy(() => import("./pages/Vocabulary"));
const WordDetail = lazy(() => import("./pages/WordDetail"));
const Review = lazy(() => import("./pages/Review"));
const KanjiList = lazy(() => import("./pages/KanjiList"));
const KanjiDetail = lazy(() => import("./pages/KanjiDetail"));
const Writing = lazy(() => import("./pages/Writing"));
const GrammarList = lazy(() => import("./pages/GrammarList"));
const GrammarDetail = lazy(() => import("./pages/GrammarDetail"));
const ReadingList = lazy(() => import("./pages/ReadingList"));
const ReadingDetail = lazy(() => import("./pages/ReadingDetail"));
const ListeningList = lazy(() => import("./pages/ListeningList"));
const ListeningDetail = lazy(() => import("./pages/ListeningDetail"));
const Quiz = lazy(() => import("./pages/Quiz"));
const MockExam = lazy(() => import("./pages/MockExam"));
const Placement = lazy(() => import("./pages/Placement"));
const Dictionary = lazy(() => import("./pages/Dictionary"));
const Plan = lazy(() => import("./pages/Plan"));
const Progress = lazy(() => import("./pages/Progress"));
const Achievements = lazy(() => import("./pages/Achievements"));
const Account = lazy(() => import("./pages/Account"));
const Kana = lazy(() => import("./pages/Kana"));
const Mistakes = lazy(() => import("./pages/Mistakes"));
const About = lazy(() => import("./pages/About"));
const Admin = lazy(() => import("./pages/Admin"));

function Router() {
  const route = useRoute();
  const { doc } = useStore();
  const language = doc.profile.language ?? "mn";
  const t = ui[language];
  // `#/<name>/<arg>` — аргумент нь params[0] (href() ийн гаргадаг хэлбэр).
  const arg = routeArg(route);
  const level = routeLevel(route);

  const page = (() => {
    switch (route.name) {
      case "home": return <Home />;
      case "vocab": return arg ? <WordDetail id={arg} /> : <Vocabulary />;
      case "review": return <Review />;
      case "kanji": return arg ? <KanjiDetail char={arg} /> : <KanjiList />;
      case "write": return <Writing char={arg} />;
      case "grammar": return arg ? <GrammarDetail id={arg} level={level} /> : <GrammarList />;
      case "reading":
        return !featureEnabled("reading")
          ? <ComingSoon name={t.reading} count={READING.length} language={language} />
          : arg ? <ReadingDetail id={arg} /> : <ReadingList />;
      case "listening":
        return !featureEnabled("listening")
          ? <ComingSoon name={t.listening} count={LISTENING.length} language={language} />
          : arg ? <ListeningDetail id={arg} /> : <ListeningList />;
      case "quiz": return <Quiz />;
      case "mock":
      case "exam": return <MockExam />;
      case "placement": return <Placement />;
      case "dict": return <Dictionary q={route.query.q} />;
      case "plan": return <Plan />;
      case "progress": return <Progress />;
      case "achievements": return <Achievements />;
      case "account": return <Account />;
      case "kana": return <Kana />;
      case "mistakes": return <Mistakes />;
      case "about": return <About />;
      case "admin": return <Admin tab={arg ?? "overview"} />;
      default: return <NotFound name={route.name} />;
    }
  })();

  return (
    <Shell>
      {/* Нэг хуудасны алдаа бүх аппыг цайруулахгүй; route солиход boundary шинэчлэгдэнэ. */}
      <ErrorBoundary language={language} resetKey={`${route.name}:${arg ?? ""}`}>
        <Suspense fallback={<Spinner />}>{page}</Suspense>
      </ErrorBoundary>
    </Shell>
  );
}

/**
 * B6: уншлага/сонсгол **өгөгдөлгүй** тул навигациас нуулагдсан боловч
 * гүнзгий холбоос дээр чин шударга хуудас үзүүлнэ — хоосон буюу хуучирсан
 * контентийг “бэлэн” гэж хуурахгүй. Сонголтуудыг одоо ашиглах зүйлээр
 * орлуулна (давталт, дасгал, жишиг шалгалт, толь).
 */
function ComingSoon({ name, count, language }: { name: string; count: number; language: Language }) {
  const t = ui[language];
  const alts = [
    { to: "review", k: "復", label: t.review },
    { to: "quiz", k: "題", label: t.quiz },
    { to: "mock", k: "試", label: t.mock },
    { to: "dict", k: "辞", label: t.dictionary },
  ];
  return (
    <div className="mx-auto max-w-2xl py-14 text-center">
      <span className="font-mincho text-[4rem] font-bold text-sumi-900/10">近</span>
      <p className="mt-3 font-jp text-[11.5px] tracking-[0.3em] text-shu-500">近日公開</p>
      <h1 className="mt-1 text-[1.55rem] font-extrabold">{t.comingSoonTitle} · {name}</h1>
      <p className="mt-3 text-[13.5px] leading-relaxed text-sumi-600">{t.comingSoonBody(name)}</p>
      <p className="mt-4 rounded-xl bg-kin-50 px-4 py-3 text-[12.5px] leading-relaxed text-kin-700">
        {t.comingSoonEmpty(name, count)}
      </p>
      <p className="mt-6 text-[12.5px] font-bold text-sumi-500">{t.comingSoonAlt}</p>
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        {alts.map((a) => (
          <a key={a.to} href={`#/${a.to}`}
            className="rounded-xl border border-sumi-900/10 bg-white/70 px-4 py-2.5 text-[13px] font-bold text-sumi-700 transition hover:border-shu-400 hover:text-shu-600">
            <span className="font-jp mr-1.5">{a.k}</span>{a.label}
          </a>
        ))}
      </div>
      <a href="#/home" className="mt-6 inline-block rounded-xl bg-shu-500 px-5 py-2.5 text-[13.5px] font-bold text-white">
        {t.homeLink}
      </a>
    </div>
  );
}

function NotFound({ name }: { name: string }) {
  const { doc } = useStore();
  const t = ui[doc.profile.language ?? "mn"];
  return (
    <div className="grid place-items-center py-24 text-center">
      <span className="font-mincho text-[4rem] font-bold text-sumi-900/10">無</span>
      <h1 className="mt-3 text-[1.5rem] font-extrabold">{t.notFound}</h1>
      <p className="mt-1.5 font-mono text-[12.5px] text-sumi-500">#/{name}</p>
      <a href="#/home" className="mt-5 rounded-xl bg-shu-500 px-5 py-2.5 text-[13.5px] font-bold text-white">{t.homeLink}</a>
    </div>
  );
}

export default function App() {
  useEffect(() => {
    // Анхны hash хоосон бол нүүр рүү
    if (!window.location.hash) window.location.hash = "#/home";
  }, []);

  return (
    <StoreProvider>
      <Router />
      <Notices />
      <GuestMergeDialog />
      <ImportPreviewModal />
    </StoreProvider>
  );
}
