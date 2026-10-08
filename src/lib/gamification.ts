/** XP, түвшин, цуваа (streak), амжилтууд. */

export interface Achievement {
  id: string;
  title: string;
  titleEn: string;
  desc: string;
  descEn: string;
  icon: string;
  tone: "shu" | "ai" | "matcha" | "kin" | "murasaki";
  /** Одоогийн явцаас 0..1 буцаана. */
  progress: (s: AchievementInput) => number;
  /** Шаардлагатай утга (текстээр, хэлээр). */
  target?: (s: AchievementInput, lang?: string) => string;
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
  { id: "first-steps", title: "Эхний алхам", titleEn: "First steps", desc: "Анхны 10 үгээ сур", descEn: "Learn your first 10 words", icon: "一", tone: "shu", progress: (s) => pct(s.vocabLearned, 10), target: (_s: AchievementInput, lang?: string) => lang === "en" ? "10 words" : "10 үг" },
  { id: "hundred-words", title: "100 үг", titleEn: "100 words", desc: "100 үг SRS-д оруул", descEn: "Add 100 words to SRS", icon: "百", tone: "shu", progress: (s) => pct(s.vocabLearned, 100), target: (_s: AchievementInput, lang?: string) => lang === "en" ? "100 words" : "100 үг" },
  { id: "thousand-words", title: "1000 үг", titleEn: "1,000 words", desc: "Мянган үгээ давт", descEn: "Review a thousand words", icon: "千", tone: "kin", progress: (s) => pct(s.vocabLearned, 1000), target: (_s: AchievementInput, lang?: string) => lang === "en" ? "1,000 words" : "1000 үг" },
  { id: "vocab-tenk", title: "10,000 үг бүрэн", titleEn: "10,000 words", desc: "Бүх үгийн санг нээ", descEn: "Unlock the whole vocabulary", icon: "萬", tone: "kin", progress: (s) => pct(s.vocabLearned, 10000), target: (_s: AchievementInput, lang?: string) => lang === "en" ? "10,000 words" : "10,000 үг" },
  { id: "streak-7", title: "7 өдрийн цуваа", titleEn: "7-day streak", desc: "Долоо хоног тасралтгүй суралц", descEn: "Study every day for a week", icon: "七", tone: "matcha", progress: (s) => pct(s.streak, 7), target: (_s: AchievementInput, lang?: string) => lang === "en" ? "7 days" : "7 өдөр" },
  { id: "streak-30", title: "30 өдрийн цуваа", titleEn: "30-day streak", desc: "Сар тасралтгүй суралц", descEn: "Study every day for a month", icon: "三", tone: "matcha", progress: (s) => pct(s.streak, 30), target: (_s: AchievementInput, lang?: string) => lang === "en" ? "30 days" : "30 өдөр" },
  { id: "streak-100", title: "100 өдрийн цуваа", titleEn: "100-day streak", desc: "Зуун өдөр тасралтгүй", descEn: "One hundred days without a break", icon: "百", tone: "kin", progress: (s) => pct(s.streak, 100), target: (_s: AchievementInput, lang?: string) => lang === "en" ? "100 days" : "100 өдөр" },
  { id: "kanji-100", title: "100 ханз", titleEn: "100 kanji", desc: "Зуун ханз судал", descEn: "Study a hundred kanji", icon: "漢", tone: "ai", progress: (s) => pct(s.kanjiStudied, 100), target: (_s: AchievementInput, lang?: string) => lang === "en" ? "100 kanji" : "100 ханз" },
  { id: "kanji-500", title: "500 ханз", titleEn: "500 kanji", desc: "Таван зуун ханз", descEn: "Study five hundred kanji", icon: "字", tone: "ai", progress: (s) => pct(s.kanjiStudied, 500), target: (_s: AchievementInput, lang?: string) => lang === "en" ? "500 kanji" : "500 ханз" },
  { id: "kanji-2500", title: "2,500 ханз", titleEn: "2,500 kanji", desc: "Бүх ханзны санг эзэмш", descEn: "Conquer the whole kanji set", icon: "鬱", tone: "murasaki", progress: (s) => pct(s.kanjiStudied, 2500), target: (_s: AchievementInput, lang?: string) => lang === "en" ? "2,500 kanji" : "2500 ханз" },
  { id: "reviews-1000", title: "1000 давталт", titleEn: "1,000 reviews", desc: "Мянган давталт хий", descEn: "Do a thousand reviews", icon: "復", tone: "ai", progress: (s) => pct(s.reviews, 1000), target: (_s: AchievementInput, lang?: string) => lang === "en" ? "1,000 reviews" : "1000 давталт" },
  { id: "reviews-10000", title: "10,000 давталт", titleEn: "10,000 reviews", desc: "Арван мянган давталт", descEn: "Ten thousand reviews", icon: "習", tone: "murasaki", progress: (s) => pct(s.reviews, 10000), target: (_s: AchievementInput, lang?: string) => lang === "en" ? "10,000 reviews" : "10,000 давталт" },
  { id: "mastered-100", title: "100 эзэмшсэн", titleEn: "100 mastered", desc: "100 үгийг бүрэн цээжлэ", descEn: "Fully memorize 100 words", icon: "得", tone: "matcha", progress: (s) => pct(s.mastered, 100), target: (_s: AchievementInput, lang?: string) => lang === "en" ? "100 cards" : "100 карт" },
  { id: "kana-perfect", title: "Кана төгс", titleEn: "Kana perfect", desc: "Кана тестэд 100% ав", descEn: "Score 100% on the kana test", icon: "あ", tone: "shu", progress: (s) => pct(s.kanaBest, 100), target: (_s: AchievementInput, lang?: string) => lang === "en" ? "100%" : "100%" },
  { id: "grammar-50", title: "50 дүрэм", titleEn: "50 patterns", desc: "50 дүрмийг эзэмш", descEn: "Master 50 grammar patterns", icon: "文", tone: "kin", progress: (s) => pct(s.grammarDone, 50), target: (_s: AchievementInput, lang?: string) => lang === "en" ? "50 patterns" : "50 дүрэм" },
  { id: "reading-10", title: "Уншигч", titleEn: "Reader", desc: "10 уншлагын хичээл дуусга", descEn: "Finish 10 reading lessons", icon: "読", tone: "ai", progress: (s) => pct(s.readingDone, 10), target: (_s: AchievementInput, lang?: string) => lang === "en" ? "10 lessons" : "10 хичээл" },
  { id: "listening-10", title: "Сонсогч", titleEn: "Listener", desc: "10 сонсголын хичээл дуусга", descEn: "Finish 10 listening lessons", icon: "聴", tone: "murasaki", progress: (s) => pct(s.listeningDone, 10), target: (_s: AchievementInput, lang?: string) => lang === "en" ? "10 lessons" : "10 хичээл" },
  { id: "writing-100", title: "Бичигч", titleEn: "Writer", desc: "100 ханзыг гараар бич", descEn: "Write 100 kanji by hand", icon: "筆", tone: "shu", progress: (s) => pct(s.writingDone, 100), target: (_s: AchievementInput, lang?: string) => lang === "en" ? "100 kanji" : "100 ханз" },
  { id: "exam-first", title: "Анхны шалгалт", titleEn: "First exam", desc: "Нэг жишиг шалгалт өг", descEn: "Take one mock exam", icon: "試", tone: "shu", progress: (s) => pct(s.exams, 1), target: (_s: AchievementInput, lang?: string) => lang === "en" ? "1 exam" : "1 шалгалт" },
  { id: "exam-n3", title: "N3 тэнцэв", titleEn: "N3 pass", desc: "N3 жишиг шалгалтад тэнц", descEn: "Pass an N3 mock exam", icon: "三", tone: "matcha", progress: (s) => pct(s.examsPassed, 1), target: (_s: AchievementInput, lang?: string) => lang === "en" ? "1 pass" : "1 тэнцэлт" },
  { id: "hours-50", title: "50 цаг", titleEn: "50 hours", desc: "50 цаг суралц", descEn: "Study for 50 hours", icon: "時", tone: "ai", progress: (s) => pct(s.minutes, 3000), target: (_s: AchievementInput, lang?: string) => lang === "en" ? "3,000 min" : "3000 мин" },
  { id: "xp-10000", title: "10,000 XP", titleEn: "10,000 XP", desc: "Арван мянган XP цуглуул", descEn: "Collect ten thousand XP", icon: "功", tone: "kin", progress: (s) => pct(s.xp, 10000), target: (_s: AchievementInput, lang?: string) => lang === "en" ? "10,000 XP" : "10,000 XP" },
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

export const RANK_EN = ["Novice", "Learner", "Intermediate", "Advanced", "Expert", "Master", "Sensei"] as const;

export function rankOf(level: number) {
  const i = Math.min(RANKS.length - 1, Math.floor((level - 1) / 6));
  return { jp: RANKS[i], mn: RANK_MN[i], en: RANK_EN[i] };
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
