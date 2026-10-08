/** XP, түвшин, цуваа (streak), амжилтууд. */

export interface Achievement {
  id: string;
  title: string;
  desc: string;
  icon: string;
  tone: "shu" | "ai" | "matcha" | "kin" | "murasaki";
  /** Одоогийн явцаас 0..1 буцаана. */
  progress: (s: AchievementInput) => number;
  /** Шаардлагатай утга (текстээр). */
  target?: (s: AchievementInput) => string;
}

export interface AchievementInput {
  vocabLearned: number;   // үг SRS-д орсон
  mastered: number;       // эзэмшсэн карт
  kanjiStudied: number;   // судалсан ханз
  reviews: number;        // нийт давталт
  streak: number;
  days: number;           // нийт идэвхтэй өдөр
  minutes: number;        // нийт минут
  grammarDone: number;
  readingDone: number;
  listeningDone: number;
  writingDone: number;
  exams: number;
  examsPassed: number;
  level: string;
  kanaBest: number;       // кана тестийн % 
  xp: number;
}

const pct = (n: number, total: number) => Math.max(0, Math.min(1, n / total));

export const ACHIEVEMENTS: Achievement[] = [
  { id: "first-steps", title: "Эхний алхам", desc: "Анхны 10 үгээ сур", icon: "一", tone: "shu", progress: (s) => pct(s.vocabLearned, 10), target: () => "10 үг" },
  { id: "hundred-words", title: "100 үг", desc: "100 үг SRS-д оруул", icon: "百", tone: "shu", progress: (s) => pct(s.vocabLearned, 100), target: () => "100 үг" },
  { id: "thousand-words", title: "1000 үг", desc: "Мянган үгээ давт", icon: "千", tone: "kin", progress: (s) => pct(s.vocabLearned, 1000), target: () => "1000 үг" },
  { id: "vocab-tenk", title: "10,000 үг бүрэн", desc: "Бүх үгийн санг нээ", icon: "萬", tone: "kin", progress: (s) => pct(s.vocabLearned, 10000), target: () => "10,000 үг" },
  { id: "streak-7", title: "7 өдрийн цуваа", desc: "Долоо хоног тасралтгүй суралц", icon: "七", tone: "matcha", progress: (s) => pct(s.streak, 7), target: () => "7 өдөр" },
  { id: "streak-30", title: "30 өдрийн цуваа", desc: "Сар тасралтгүй суралц", icon: "三", tone: "matcha", progress: (s) => pct(s.streak, 30), target: () => "30 өдөр" },
  { id: "streak-100", title: "100 өдрийн цуваа", desc: "Зуун өдөр тасралтгүй", icon: "百", tone: "kin", progress: (s) => pct(s.streak, 100), target: () => "100 өдөр" },
  { id: "kanji-100", title: "100 ханз", desc: "Зуун ханз судал", icon: "漢", tone: "ai", progress: (s) => pct(s.kanjiStudied, 100), target: () => "100 ханз" },
  { id: "kanji-500", title: "500 ханз", desc: "Таван зуун ханз", icon: "字", tone: "ai", progress: (s) => pct(s.kanjiStudied, 500), target: () => "500 ханз" },
  { id: "kanji-2500", title: "2,500 ханз", desc: "Бүх ханзны санг эзэмш", icon: "鬱", tone: "murasaki", progress: (s) => pct(s.kanjiStudied, 2500), target: () => "2500 ханз" },
  { id: "reviews-1000", title: "1000 давталт", desc: "Мянган давталт хий", icon: "復", tone: "ai", progress: (s) => pct(s.reviews, 1000), target: () => "1000 давталт" },
  { id: "reviews-10000", title: "10,000 давталт", desc: "Арван мянган давталт", icon: "習", tone: "murasaki", progress: (s) => pct(s.reviews, 10000), target: () => "10,000 давталт" },
  { id: "mastered-100", title: "100 эзэмшсэн", desc: "100 үгийг бүрэн цээжлэ", icon: "得", tone: "matcha", progress: (s) => pct(s.mastered, 100), target: () => "100 карт" },
  { id: "kana-perfect", title: "Кана төгс", desc: "Кана тестэд 100% ав", icon: "あ", tone: "shu", progress: (s) => pct(s.kanaBest, 100), target: () => "100%" },
  { id: "grammar-50", title: "50 дүрэм", desc: "50 дүрмийг эзэмш", icon: "文", tone: "kin", progress: (s) => pct(s.grammarDone, 50), target: () => "50 дүрэм" },
  { id: "reading-10", title: "Уншигч", desc: "10 уншлагын хичээл дуусга", icon: "読", tone: "ai", progress: (s) => pct(s.readingDone, 10), target: () => "10 хичээл" },
  { id: "listening-10", title: "Сонсогч", desc: "10 сонсголын хичээл дуусга", icon: "聴", tone: "murasaki", progress: (s) => pct(s.listeningDone, 10), target: () => "10 хичээл" },
  { id: "writing-100", title: "Бичигч", desc: "100 ханзыг гараар бич", icon: "筆", tone: "shu", progress: (s) => pct(s.writingDone, 100), target: () => "100 ханз" },
  { id: "exam-first", title: "Анхны шалгалт", desc: "Нэг жишиг шалгалт өг", icon: "試", tone: "shu", progress: (s) => pct(s.exams, 1), target: () => "1 шалгалт" },
  { id: "exam-n3", title: "N3 тэнцэв", desc: "N3 жишиг шалгалтад тэнц", icon: "三", tone: "matcha", progress: (s) => pct(s.examsPassed, 1), target: () => "1 тэнцэлт" },
  { id: "hours-50", title: "50 цаг", desc: "50 цаг суралц", icon: "時", tone: "ai", progress: (s) => pct(s.minutes, 3000), target: () => "3000 мин" },
  { id: "xp-10000", title: "10,000 XP", desc: "Арван мянган XP цуглуул", icon: "功", tone: "kin", progress: (s) => pct(s.xp, 10000), target: () => "10,000 XP" },
];

/** XP → түвшин. */
export function xpLevel(xp: number) {
  const level = Math.max(1, Math.floor((-1 + Math.sqrt(1 + (8 * xp) / 50)) / 2) + 1);
  const need = (n: number) => 50 * n * (n - 1);
  const cur = need(level);
  const next = need(level + 1);
  return {
    level,
    into: xp - cur,
    need: next - cur,
    pct: Math.max(0, Math.min(1, (xp - cur) / Math.max(1, next - cur))),
  };
}

export const RANKS = ["入門", "初級", "中級", "上級", "達人", "名人", "師範"] as const;
export const RANK_MN = ["Эхлэгч", "Суралцагч", "Дунд", "Ахисан", "Сайн", "Мастер", "Багш"] as const;

export function rankOf(level: number) {
  const i = Math.min(RANKS.length - 1, Math.floor((level - 1) / 6));
  return { jp: RANKS[i], mn: RANK_MN[i] };
}

/** XP-ийг ажил тус бүрээр тооцно. */
export const XP = {
  reviewAgain: 1,
  reviewHard: 2,
  reviewGood: 3,
  reviewEasy: 2,
  newCard: 2,
  quizCorrect: 4,
  quizWrong: 0,
  readingDone: 25,
  listeningDone: 25,
  grammarDone: 12,
  writing: 6,
  examQuestion: 1,
  examPass: 120,
  placement: 20,
  minute: 1,
};
