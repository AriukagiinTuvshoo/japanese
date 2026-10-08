import type { Vocab } from "./types";

export type Language = "mn" | "en";
export const MN_PENDING = "Орчуулга хүлээгдэж байна";

export const ui = {
  mn: {
    language: "Хэл", home: "Нүүр самбар", plan: "Миний төлөвлөгөө", progress: "Ахиц · шинжилгээ",
    vocab: "Үгийн сан", kanji: "Ханз", writing: "Бичих дасгал", grammar: "Дүрэм", kana: "Хирагана · Катакана",
    reading: "Уншлага", listening: "Сонсгол · YouTube", review: "Давталт (SRS)", quiz: "Шалгалтын дасгал",
    mock: "Жишиг JLPT", placement: "Түвшин тогтоох", dictionary: "Толь бичиг", achievements: "Амжилт",
    account: "Аккаунт · синхрон", sources: "Эх сурвалж", admin: "Контент удирдлага", start: "Эхлэл",
    library: "Сан", skills: "Чадвар", practice: "Дасгал", tools: "Хэрэгсэл", guest: "Зочин", settings: "Тохиргоо",
    today: "Өнөөдөр", days: "өдөр", points: "оноо", search: "Хайлт — япон, ромажи, монгол…",
  },
  en: {
    language: "Language", home: "Dashboard", plan: "My plan", progress: "Progress & analytics",
    vocab: "Vocabulary", kanji: "Kanji", writing: "Writing practice", grammar: "Grammar", kana: "Hiragana & Katakana",
    reading: "Reading", listening: "Listening · YouTube", review: "Review (SRS)", quiz: "Practice tests",
    mock: "JLPT mock exam", placement: "Placement test", dictionary: "Dictionary", achievements: "Achievements",
    account: "Account & sync", sources: "Sources", admin: "Content management", start: "Start",
    library: "Library", skills: "Skills", practice: "Practice", tools: "Tools", guest: "Guest", settings: "Settings",
    today: "Today", days: "days", points: "points", search: "Search — Japanese, romaji, English…",
  },
} as const;

export function vocabMeaning(v: Vocab, language: Language): string {
  if (language === "en") return v.en.join("; ");
  return v.mn?.length ? v.mn.join(", ") : MN_PENDING;
}

export type VocabTopic = "daily" | "people" | "places" | "time" | "food" | "nature" | "body" | "learning" | "work" | "actions" | "descriptions" | "other";

const TOPIC_RULES: [VocabTopic, RegExp][] = [
  ["time", /time|day|week|month|year|hour|minute|morning|evening|today|tomorrow|yesterday|season|age/],
  ["people", /person|people|man|woman|child|family|mother|father|friend|teacher|student|name/],
  ["places", /place|city|country|station|school|hospital|shop|store|house|room|building|road|street/],
  ["food", /food|eat|drink|rice|meat|fish|fruit|vegetable|tea|coffee|meal|restaurant|taste/],
  ["nature", /weather|rain|snow|wind|sky|sea|river|mountain|tree|flower|animal|bird|sun|moon/],
  ["body", /body|head|face|eye|ear|mouth|hand|foot|heart|health|ill|medicine/],
  ["learning", /study|learn|school|exam|book|read|write|word|language|question|answer/],
  ["work", /work|job|company|office|business|money|buy|sell|price/],
  ["actions", /\b(to |do|make|go|come|see|hear|speak|take|give|use|walk|run|move|open|close)/],
  ["descriptions", /adjective|beautiful|large|small|good|bad|new|old|hot|cold|easy|difficult|strong|weak/],
  ["daily", /clothes|wear|sleep|wake|bath|clean|cook|home|everyday|daily/],
];

export function vocabTopic(v: Vocab): VocabTopic {
  const text = v.en.join(" ").toLowerCase();
  return TOPIC_RULES.find(([, rule]) => rule.test(text))?.[0] ?? (v.t === "v" ? "actions" : v.t === "adj" || v.t === "i" || v.t === "na" ? "descriptions" : "other");
}

export const topicLabel: Record<Language, Record<VocabTopic, string>> = {
  mn: { daily: "Өдөр тутам", people: "Хүмүүс", places: "Газар", time: "Цаг хугацаа", food: "Хоол", nature: "Байгаль", body: "Бие · эрүүл мэнд", learning: "Суралцах", work: "Ажил · худалдаа", actions: "Үйлдэл", descriptions: "Шинж чанар", other: "Бусад" },
  en: { daily: "Daily life", people: "People", places: "Places", time: "Time", food: "Food", nature: "Nature", body: "Body & health", learning: "Learning", work: "Work & commerce", actions: "Actions", descriptions: "Descriptions", other: "Other" },
};
