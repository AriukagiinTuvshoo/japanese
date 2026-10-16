export type Level = "N5" | "N4" | "N3" | "N2" | "N1";
export const LEVELS: Level[] = ["N5", "N4", "N3", "N2", "N1"];

export type Tone = "matcha" | "ai" | "kin" | "shu" | "murasaki";

export interface ExamSection {
  name: string;
  jp: string;
  max: number;
  min: number;
}

export interface LevelMeta {
  id: Level;
  name: string;
  nameEn: string;
  jp: string;
  tone: Tone;
  kanji: number;
  vocab: number;
  hours: [number, number];
  desc: string;
  descEn: string;
  can: string[];
  canEn: string[];
  passTotal: number;
  sections: ExamSection[];
  minutes: number[];
  minuteLabels: string[];
  minuteLabelsEn: string[];
  mockMinutes: number;
  focus: { label: string; pct: number }[];
  focusEn: { label: string; pct: number }[];
}

/*
 * Тэнцэх оноо, хэсгийн босго, шалгалтын хугацааг JLPT-ийн албан ёсны
 * мэдээлэл (jlpt.jp) дээр үндэслэв. Ханз/үгийн тоо, цагийн тооцоо нь
 * өргөн хэрэглэгддэг ойролцоо баримжаа (ханзгүй орны суралцагчид).
 */
export const LEVEL_META: Record<Level, LevelMeta> = {
  N5: {
    id: "N5",
    name: "Суурь",
    nameEn: "Foundation",
    jp: "入門",
    tone: "matcha",
    kanji: 100,
    vocab: 800,
    hours: [325, 500],
    desc: "Хирагана, катакана, үндсэн ханзаар бичсэн энгийн өгүүлбэр, өдөр тутмын хэллэгийг ойлгоно.",
    descEn: "Understands simple sentences and everyday expressions written in hiragana, katakana and basic kanji.",
    can: [
      "Хирагана, катакана бүрэн уншина",
      "Өөрийгөө танилцуулж, цаг, үнэ асууна",
      "Удаан, тод ярианаас хэрэгтэй мэдээллээ сонсож авна",
    ],
    canEn: [
      "Reads hiragana and katakana fluently",
      "Introduces themselves and asks about time and prices",
      "Picks up essential information from slow, clear speech",
    ],
    passTotal: 80,
    sections: [
      { name: "Хэлний мэдлэг + Уншлага", jp: "言語知識・読解", max: 120, min: 38 },
      { name: "Сонсгол", jp: "聴解", max: 60, min: 19 },
    ],
    minutes: [20, 40, 30],
    minuteLabels: ["Үг", "Дүрэм · Уншлага", "Сонсгол"],
    minuteLabelsEn: ["Vocab", "Grammar · Reading", "Listening"],
    mockMinutes: 20,
    focus: [
      { label: "Кана · Үг", pct: 35 },
      { label: "Ханз", pct: 15 },
      { label: "Дүрэм", pct: 25 },
      { label: "Сонсгол", pct: 15 },
      { label: "Уншлага", pct: 10 },
    ],
    focusEn: [
      { label: "Kana · Vocab", pct: 35 },
      { label: "Kanji", pct: 15 },
      { label: "Grammar", pct: 25 },
      { label: "Listening", pct: 15 },
      { label: "Reading", pct: 10 },
    ],
  },
  N4: {
    id: "N4",
    name: "Анхан",
    nameEn: "Elementary",
    jp: "初級",
    tone: "ai",
    kanji: 300,
    vocab: 1500,
    hours: [575, 1000],
    desc: "Өдөр тутмын сэдвээр бичсэн богино эхийг уншиж, ахуйн ярилцлагыг ерөнхийд нь ойлгоно.",
    descEn: "Reads short texts on everyday topics and understands the gist of daily conversations.",
    can: [
      "Өнгөрсөн үйл явдал, туршлагаа ярина",
      "Зөвшөөрөл, хориг, зөвлөгөө илэрхийлнэ",
      "Ахуйн богино захидал, зар ойлгоно",
    ],
    canEn: [
      "Talks about past events and experiences",
      "Expresses permission, prohibition and advice",
      "Understands short everyday letters and notices",
    ],
    passTotal: 90,
    sections: [
      { name: "Хэлний мэдлэг + Уншлага", jp: "言語知識・読解", max: 120, min: 38 },
      { name: "Сонсгол", jp: "聴解", max: 60, min: 19 },
    ],
    minutes: [25, 55, 35],
    minuteLabels: ["Үг", "Дүрэм · Уншлага", "Сонсгол"],
    minuteLabelsEn: ["Vocab", "Grammar · Reading", "Listening"],
    mockMinutes: 25,
    focus: [
      { label: "Үг", pct: 30 },
      { label: "Ханз", pct: 20 },
      { label: "Дүрэм", pct: 25 },
      { label: "Сонсгол", pct: 15 },
      { label: "Уншлага", pct: 10 },
    ],
    focusEn: [
      { label: "Vocab", pct: 30 },
      { label: "Kanji", pct: 20 },
      { label: "Grammar", pct: 25 },
      { label: "Listening", pct: 15 },
      { label: "Reading", pct: 10 },
    ],
  },
  N3: {
    id: "N3",
    name: "Дунд",
    nameEn: "Intermediate",
    jp: "中級",
    tone: "kin",
    kanji: 650,
    vocab: 3750,
    hours: [950, 1700],
    desc: "Өдөр тутмын нөхцөлд хэрэглэгдэх япон хэлийг тодорхой хэмжээнд ойлгоно. Сонины гарчиг, энгийн нийтлэл уншина.",
    descEn: "Understands Japanese used in everyday situations to a reasonable degree; reads newspaper headlines and simple articles.",
    can: [
      "Сонины гарчгаас гол санааг барина",
      "Хэвийн хурдтай ярианы агуулгыг ойлгоно",
      "Шалтгаан, үр дагавар, санал бодлоо тайлбарлана",
    ],
    canEn: [
      "Grabs the main idea from newspaper headlines",
      "Follows naturally paced conversations",
      "Explains reasons, consequences and opinions",
    ],
    passTotal: 95,
    sections: [
      { name: "Хэлний мэдлэг", jp: "言語知識", max: 60, min: 19 },
      { name: "Уншлага", jp: "読解", max: 60, min: 19 },
      { name: "Сонсгол", jp: "聴解", max: 60, min: 19 },
    ],
    minutes: [30, 70, 40],
    minuteLabels: ["Үг", "Дүрэм · Уншлага", "Сонсгол"],
    minuteLabelsEn: ["Vocab", "Grammar · Reading", "Listening"],
    mockMinutes: 30,
    focus: [
      { label: "Үг", pct: 25 },
      { label: "Ханз", pct: 20 },
      { label: "Дүрэм", pct: 20 },
      { label: "Сонсгол", pct: 15 },
      { label: "Уншлага", pct: 20 },
    ],
    focusEn: [
      { label: "Vocab", pct: 25 },
      { label: "Kanji", pct: 20 },
      { label: "Grammar", pct: 20 },
      { label: "Listening", pct: 15 },
      { label: "Reading", pct: 20 },
    ],
  },
  N2: {
    id: "N2",
    name: "Дунд-ахисан",
    nameEn: "Upper intermediate",
    jp: "中上級",
    tone: "shu",
    kanji: 1000,
    vocab: 6000,
    hours: [1600, 2600],
    desc: "Сонин, сэтгүүлийн нийтлэл, тайлбар, шүүмжийг уншиж, мэдээ, ярилцлагын урсгалыг ойлгоно. Японы ихэнх компанид шаарддаг түвшин.",
    descEn: "Reads newspaper and magazine articles, commentary and critique; follows the flow of news and conversations. The level most Japanese companies require.",
    can: [
      "Нийтлэлийн логик бүтэц, зохиогчийн байр суурийг ойлгоно",
      "Ажлын хурал, мэдээг ерөнхийд нь ойлгоно",
      "Албан ба албан бус хэв маягийг ялгаж хэрэглэнэ",
    ],
    canEn: [
      "Understands an article's logic and the author's stance",
      "Follows work meetings and news in general terms",
      "Distinguishes and uses formal vs casual style",
    ],
    passTotal: 90,
    sections: [
      { name: "Хэлний мэдлэг", jp: "言語知識", max: 60, min: 19 },
      { name: "Уншлага", jp: "読解", max: 60, min: 19 },
      { name: "Сонсгол", jp: "聴解", max: 60, min: 19 },
    ],
    minutes: [105, 50],
    minuteLabels: ["Хэлний мэдлэг · Уншлага", "Сонсгол"],
    minuteLabelsEn: ["Language · Reading", "Listening"],
    mockMinutes: 35,
    focus: [
      { label: "Үг", pct: 20 },
      { label: "Ханз", pct: 20 },
      { label: "Дүрэм", pct: 15 },
      { label: "Сонсгол", pct: 20 },
      { label: "Уншлага", pct: 25 },
    ],
    focusEn: [
      { label: "Vocab", pct: 20 },
      { label: "Kanji", pct: 20 },
      { label: "Grammar", pct: 15 },
      { label: "Listening", pct: 20 },
      { label: "Reading", pct: 25 },
    ],
  },
  N1: {
    id: "N1",
    name: "Ахисан",
    nameEn: "Advanced",
    jp: "上級",
    tone: "murasaki",
    kanji: 2000,
    vocab: 10000,
    hours: [3000, 4800],
    desc: "Олон төрлийн нөхцөлд хэрэглэгдэх япон хэлийг ойлгоно. Логикийн хувьд нарийн, хийсвэр эх, редакцийн нийтлэлийг уншина.",
    descEn: "Understands Japanese across a wide range of contexts; reads abstract, logically complex texts and editorials.",
    can: [
      "Хийсвэр, шүүмжлэлт эхийн бүтэц, далд санааг ойлгоно",
      "Лекц, мэтгэлцээн, мэдээг бүрэн дагана",
      "Нарийн нюанс, хүндэтгэлийн хэлийг чөлөөтэй хэрэглэнэ",
    ],
    canEn: [
      "Grasp the structure and subtext of abstract, critical texts",
      "Follow lectures, debates and news in full",
      "Use nuanced and honorific language with ease",
    ],
    passTotal: 100,
    sections: [
      { name: "Хэлний мэдлэг", jp: "言語知識", max: 60, min: 19 },
      { name: "Уншлага", jp: "読解", max: 60, min: 19 },
      { name: "Сонсгол", jp: "聴解", max: 60, min: 19 },
    ],
    minutes: [110, 55],
    minuteLabels: ["Хэлний мэдлэг · Уншлага", "Сонсгол"],
    minuteLabelsEn: ["Language · Reading", "Listening"],
    mockMinutes: 40,
    focus: [
      { label: "Үг", pct: 15 },
      { label: "Ханз", pct: 20 },
      { label: "Дүрэм", pct: 15 },
      { label: "Сонсгол", pct: 20 },
      { label: "Уншлага", pct: 30 },
    ],
    focusEn: [
      { label: "Vocab", pct: 15 },
      { label: "Kanji", pct: 20 },
      { label: "Grammar", pct: 15 },
      { label: "Listening", pct: 20 },
      { label: "Reading", pct: 30 },
    ],
  },
};

/** Тэгээс тухайн түвшин хүртэлх хуримтлагдсан цагийн дундаж */
export const CUM_HOURS: Record<Level | "zero", number> = {
  zero: 0,
  N5: 410,
  N4: 790,
  N3: 1325,
  N2: 2100,
  N1: 3900,
};

/** JLPT нь жил бүр 7 ба 12-р сарын эхний ням гарагт болдог */
export function nextJlptDates(from = new Date(), count = 3): Date[] {
  const out: Date[] = [];
  let y = from.getFullYear();
  while (out.length < count) {
    for (const m of [6, 11]) {
      const d = new Date(y, m, 1);
      while (d.getDay() !== 0) d.setDate(d.getDate() + 1);
      if (d.getTime() > from.getTime()) out.push(d);
      if (out.length >= count) break;
    }
    y++;
  }
  return out;
}

export function daysUntil(d: Date, from = new Date()) {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
  const b = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.max(0, Math.round((b - a) / 864e5));
}

export function fmtDate(d: Date) {
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}
