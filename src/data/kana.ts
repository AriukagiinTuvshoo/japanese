export type KanaGroup = "basic" | "dakuten" | "yoon";

export interface KanaRow {
  id: string;
  label: string;
  group: KanaGroup;
  cells: ([string, string] | null)[];
}

export interface KanaItem {
  h: string;
  k: string;
  r: string;
  row: string;
  group: KanaGroup;
}

export const toKatakana = (s: string) =>
  s.replace(/[\u3041-\u3096]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) + 0x60));

export const toHiraganaChars = (s: string) =>
  s.replace(/[\u30a1-\u30f6]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60));

export const KANA_ROWS: KanaRow[] = [
  { id: "a", label: "あ", group: "basic", cells: [["あ", "a"], ["い", "i"], ["う", "u"], ["え", "e"], ["お", "o"]] },
  { id: "k", label: "か", group: "basic", cells: [["か", "ka"], ["き", "ki"], ["く", "ku"], ["け", "ke"], ["こ", "ko"]] },
  { id: "s", label: "さ", group: "basic", cells: [["さ", "sa"], ["し", "shi"], ["す", "su"], ["せ", "se"], ["そ", "so"]] },
  { id: "t", label: "た", group: "basic", cells: [["た", "ta"], ["ち", "chi"], ["つ", "tsu"], ["て", "te"], ["と", "to"]] },
  { id: "n", label: "な", group: "basic", cells: [["な", "na"], ["に", "ni"], ["ぬ", "nu"], ["ね", "ne"], ["の", "no"]] },
  { id: "h", label: "は", group: "basic", cells: [["は", "ha"], ["ひ", "hi"], ["ふ", "fu"], ["へ", "he"], ["ほ", "ho"]] },
  { id: "m", label: "ま", group: "basic", cells: [["ま", "ma"], ["み", "mi"], ["む", "mu"], ["め", "me"], ["も", "mo"]] },
  { id: "y", label: "や", group: "basic", cells: [["や", "ya"], null, ["ゆ", "yu"], null, ["よ", "yo"]] },
  { id: "r", label: "ら", group: "basic", cells: [["ら", "ra"], ["り", "ri"], ["る", "ru"], ["れ", "re"], ["ろ", "ro"]] },
  { id: "w", label: "わ", group: "basic", cells: [["わ", "wa"], null, null, null, ["を", "wo"]] },
  { id: "nn", label: "ん", group: "basic", cells: [["ん", "n"], null, null, null, null] },

  { id: "g", label: "が", group: "dakuten", cells: [["が", "ga"], ["ぎ", "gi"], ["ぐ", "gu"], ["げ", "ge"], ["ご", "go"]] },
  { id: "z", label: "ざ", group: "dakuten", cells: [["ざ", "za"], ["じ", "ji"], ["ず", "zu"], ["ぜ", "ze"], ["ぞ", "zo"]] },
  { id: "d", label: "だ", group: "dakuten", cells: [["だ", "da"], ["ぢ", "ji"], ["づ", "zu"], ["で", "de"], ["ど", "do"]] },
  { id: "b", label: "ば", group: "dakuten", cells: [["ば", "ba"], ["び", "bi"], ["ぶ", "bu"], ["べ", "be"], ["ぼ", "bo"]] },
  { id: "p", label: "ぱ", group: "dakuten", cells: [["ぱ", "pa"], ["ぴ", "pi"], ["ぷ", "pu"], ["ぺ", "pe"], ["ぽ", "po"]] },

  { id: "ky", label: "きゃ", group: "yoon", cells: [["きゃ", "kya"], ["きゅ", "kyu"], ["きょ", "kyo"]] },
  { id: "sh", label: "しゃ", group: "yoon", cells: [["しゃ", "sha"], ["しゅ", "shu"], ["しょ", "sho"]] },
  { id: "ch", label: "ちゃ", group: "yoon", cells: [["ちゃ", "cha"], ["ちゅ", "chu"], ["ちょ", "cho"]] },
  { id: "ny", label: "にゃ", group: "yoon", cells: [["にゃ", "nya"], ["にゅ", "nyu"], ["にょ", "nyo"]] },
  { id: "hy", label: "ひゃ", group: "yoon", cells: [["ひゃ", "hya"], ["ひゅ", "hyu"], ["ひょ", "hyo"]] },
  { id: "my", label: "みゃ", group: "yoon", cells: [["みゃ", "mya"], ["みゅ", "myu"], ["みょ", "myo"]] },
  { id: "ry", label: "りゃ", group: "yoon", cells: [["りゃ", "rya"], ["りゅ", "ryu"], ["りょ", "ryo"]] },
  { id: "gy", label: "ぎゃ", group: "yoon", cells: [["ぎゃ", "gya"], ["ぎゅ", "gyu"], ["ぎょ", "gyo"]] },
  { id: "j", label: "じゃ", group: "yoon", cells: [["じゃ", "ja"], ["じゅ", "ju"], ["じょ", "jo"]] },
  { id: "by", label: "びゃ", group: "yoon", cells: [["びゃ", "bya"], ["びゅ", "byu"], ["びょ", "byo"]] },
  { id: "py", label: "ぴゃ", group: "yoon", cells: [["ぴゃ", "pya"], ["ぴゅ", "pyu"], ["ぴょ", "pyo"]] },
];

export const ALL_KANA: KanaItem[] = KANA_ROWS.flatMap((row) =>
  row.cells
    .filter((c): c is [string, string] => c !== null)
    .map(([h, r]) => ({ h, k: toKatakana(h), r, row: row.id, group: row.group })),
);

export const KANA_TIPS = [
  { t: "Эхлээд хирагана", d: "Бүх дүрэм, үйл үгийн нөхцөл хираганаар бичигддэг. Катаканаг дараа нь 3–4 хоногт сурна." },
  { t: "Мөрөөр нь", d: "あ мөрөөс эхлээд өдөрт 2 мөр. 5 эгшгийн дараалал (a-i-u-e-o) бүх мөрөнд давтагдана." },
  { t: "Дуудлагаар", d: "Үсэг бүрийг дарж сонсоод чангаар давт. Нүд + чих + ам гурвыг зэрэг ашиглах нь хурдан тогтоодог." },
  { t: "Хурдаар шалга", d: "Нэг үсгийг 1 секундээс бага хугацаанд таньдаг болсон үед л дараагийн шат руу ор." },
];
