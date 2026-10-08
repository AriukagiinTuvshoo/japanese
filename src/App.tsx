import { Suspense, lazy, useEffect } from "react";
import Shell from "./components/Shell";
import { StoreProvider } from "./lib/store";
import { useRoute } from "./lib/router";
import { routeArg, routeLevel } from "./lib/routes";
import { useStore } from "./lib/store";
import { Spinner } from "./components/ui";
import { ui } from "./lib/i18n";

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
      case "reading": return arg ? <ReadingDetail id={arg} /> : <ReadingList />;
      case "listening": return arg ? <ListeningDetail id={arg} /> : <ListeningList />;
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

  return <Shell><Suspense fallback={<Spinner />}>{page}</Suspense></Shell>;
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
    </StoreProvider>
  );
}
