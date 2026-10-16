#!/usr/bin/env python3
"""Reading quality batch 1 (2026-10-10): +15 original AI-assisted texts (3/level),
mixed real-use genres (ad, message, email, instruction, article), 2 comprehension
questions each. Also registers provenance on ALL reading lessons:
  status: pending_review (NOT human-reviewed), source: original-ai-assisted.
Idempotent: re-running skips ids already present.
"""
import json, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
PATH = ROOT / "content" / "reading.json"

L = []  # lessons

# ───────────────────────── N5 ─────────────────────────
L.append({
    "id": "read-n5-31", "level": "N5", "minutes": 2,
    "title": "Зуны баярын зар", "titleEn": "Summer festival flyer",
    "titleJp": "夏まつりのチラシ", "titleJpFuri": "{夏|なつ}まつりのチラシ",
    "topic": "Зар · Баяр", "topicEn": "Advertisement · Festival",
    "body": [
        "{今|いま}{日|ひ}の{夜|よる}{七|しち}{時|じ}から、{公園|こうえん}で{夏|なつ}まつりがあります。",
        "{踊|おど}りと{花火|はなび}があります。{入|い}り{口|くち}は{無料|むりょう}です。",
        "{雨|あめ}の{日|ひ}は{来|こ}ないでください。",
    ],
    "bodyMn": [
        "Өнөөдөр орой 7 цагаас цэцэрлэгт хүрээлэнд зуны баяр болно.",
        "Бүжиг, галын наадам байна. Үнэгүй.",
        "Бороотой өдөр ирэхгүй байна уу.",
    ],
    "bodyEn": [
        "Tonight from 7 p.m., there is a summer festival at the park.",
        "There will be dancing and fireworks. Admission is free.",
        "Please do not come on rainy days.",
    ],
    "glossary": [
        {"w": "今", "r": "いま", "mn": "одоо", "meaningEn": "now"},
        {"w": "夜", "r": "よる", "mn": "орой", "meaningEn": "evening"},
        {"w": "公園", "r": "こうえん", "mn": "цэцэрлэгт хүрээлэн", "meaningEn": "park"},
        {"w": "花火", "r": "はなび", "mn": "галын наадам", "meaningEn": "fireworks"},
        {"w": "無料", "r": "むりょう", "mn": "үнэгүй", "meaningEn": "free of charge"},
    ],
    "questions": [
        {"q": "夏まつりはいつですか。", "mn": "Зуны баяр хэзээ вэ?",
         "promptEn": "When is the summer festival?",
         "opts": ["Өнөөдөр орой 7 цагаас", "Маргааш өглөө", "Ирэх долоо хоног", "Бороотой өдөр"],
         "optsEn": ["Tonight from 7 p.m.", "Tomorrow morning", "Next week", "On a rainy day"],
         "a": 0,
         "why": "“今{日|ひ}の{夜|よる}七{時|じ}から” гэж зард бичсэн.",
         "whyEn": "The flyer says “tonight from 7 p.m.”"},
        {"q": "{入|い}り{口|くち}は{有料|ゆうりょう}ですか。", "mn": "Ороход мөнгө төлдөг үү?",
         "promptEn": "Is there an admission fee?",
         "opts": ["Үгүй, үнэгүй", "Тийм, төлдөг", "Зөвхөн хүүхдэд үнэгүй", "Мэдэхгүй"],
         "optsEn": ["No, it is free", "Yes, you pay", "Only free for children", "Unknown"],
         "a": 0,
         "why": "“{入|い}り{口|くち}は{無料|むりょう}です” гэсэн байна.",
         "whyEn": "The text says admission is free."},
    ],
})
L.append({
    "id": "read-n5-32", "level": "N5", "minutes": 1,
    "title": "Найзын мессеж", "titleEn": "A message from a friend",
    "titleJp": "友だちからのメッセージ", "titleJpFuri": "{友|とも}だちからのメッセージ",
    "topic": "Мессеж · Нөхөрлөл", "topicEn": "Message · Friendship",
    "body": [
        "{明|あ}した{映画|えいが}を{見|み}に{行|い}きませんか。",
        "{昼|ひる}の{一時|いちじ}に{駅|えき}で{会|あ}いましょう。",
        "{好|す}きな{映画|えいが}を{教|おし}えてください。",
    ],
    "bodyMn": [
        "Маргааш кино үзэх үү?",
        "Өдөр 1 цагт өртөөнд уулзая.",
        "Дуртай киногоо хэлээрэй.",
    ],
    "bodyEn": [
        "Shall we go see a movie tomorrow?",
        "Let's meet at the station at 1 p.m.",
        "Please tell me your favorite movie.",
    ],
    "glossary": [
        {"w": "明", "r": "あ", "mn": "маргааш (明日-ийн эх)", "meaningEn": "tomorrow (start of 明日)"},
        {"w": "映画", "r": "えいが", "mn": "кино", "meaningEn": "movie"},
        {"w": "駅", "r": "えき", "mn": "өртөө", "meaningEn": "station"},
        {"w": "教", "r": "おし", "mn": "зааж өгөх (教える-ийн эх)", "meaningEn": "to teach (start of 教える)"},
    ],
    "questions": [
        {"q": "{明|あ}した{何時|なんじ}に{会|あ}いますか。", "mn": "Маргааш хэдэн цагт уулзах вэ?",
         "promptEn": "What time will they meet tomorrow?",
         "opts": ["Өдөр 1 цагт", "Өглөө 8 цагт", "Орой 7 цагт", "Шөнө 12 цагт"],
         "optsEn": ["At 1 p.m.", "At 8 a.m.", "At 7 p.m.", "At midnight"],
         "a": 0,
         "why": "“{昼|ひる}の{一時|いちじ}に{駅|えき}で{会|あ}いましょう” гэж бичсэн.",
         "whyEn": "The message says to meet at the station at 1 p.m."},
        {"q": "{明|あ}した{何|なに}をしますか。", "mn": "Маргааш юу хийх вэ?",
         "promptEn": "What will they do tomorrow?",
         "opts": ["Кино үзнэ", "Ажиллана", "Ном уншина", "Гэртээ амарна"],
         "optsEn": ["See a movie", "Work", "Read a book", "Rest at home"],
         "a": 0,
         "why": "“{映画|えいが}を{見|み}に{行|い}きませんか” гэж санал болгосон.",
         "whyEn": "The friend suggests going to see a movie."},
    ],
})
L.append({
    "id": "read-n5-33", "level": "N5", "minutes": 2,
    "title": "Өртөөний заавар", "titleEn": "Station directions",
    "titleJp": "駅の案内", "titleJpFuri": "{駅|えき}の{案内|あんない}",
    "topic": "Заавар · Зам", "topicEn": "Instructions · Directions",
    "body": [
        "{出口|でぐち}を{出|で}て、{右|みぎ}に{行|い}ってください。",
        "{銀行|ぎんこう}の{前|まえ}を{左|ひだり}に{曲|ま}がります。",
        "{図書館|としょかん}は{右|みぎ}の{方|ほう}です。",
    ],
    "bodyMn": [
        "Гараас гарч баруун тийш явна уу.",
        "Банкны өмнүүр зүүн тийш эргэнэ.",
        "Номын сан баруун талд байна.",
    ],
    "bodyEn": [
        "Go out of the exit and turn right.",
        "Turn left in front of the bank.",
        "The library is on the right.",
    ],
    "glossary": [
        {"w": "出口", "r": "でぐち", "mn": "гарах гарц", "meaningEn": "exit"},
        {"w": "銀行", "r": "ぎんこう", "mn": "банк", "meaningEn": "bank"},
        {"w": "図書館", "r": "としょかん", "mn": "номын сан", "meaningEn": "library"},
        {"w": "曲", "r": "ま", "mn": "эргэх (曲がる-ийн эх)", "meaningEn": "to turn (start of 曲がる)"},
    ],
    "questions": [
        {"q": "{出口|でぐち}の{後|あと}は{何|なに}をしますか。", "mn": "Гараас гарсны дараа юу хийх вэ?",
         "promptEn": "What should you do after exiting?",
         "opts": ["Баруун тийш явах", "Зүүн тийш явах", "Шууд цааш явах", "Буцаж орох"],
         "optsEn": ["Go right", "Go left", "Go straight", "Go back inside"],
         "a": 0,
         "why": "“{出口|でぐち}を{出|で}て、{右|みぎ}に{行|い}ってください” гэж заасан.",
         "whyEn": "The directions say to go right after the exit."},
        {"q": "{図書館|としょかん}は{何時|なんじ}ですか。", "mn": "Номын сан хэдэн цаг вэ?",
         "promptEn": "Where is the library?",
         "opts": ["Баруун талд", "Зүүн талд", "Урд талд", "Хойд талд"],
         "optsEn": ["On the right", "On the left", "In front", "Behind"],
         "a": 0,
         "why": "“{図書館|としょかん}は{右|みぎ}の{方|ほう}です” гэж бичсэн.",
         "whyEn": "The text says the library is on the right."},
    ],
})

# ───────────────────────── N4 ─────────────────────────
L.append({
    "id": "read-n4-31", "level": "N4", "minutes": 2,
    "title": "Багшаас ирсэн и-мэйл", "titleEn": "Email from a teacher",
    "titleJp": "先生からのメール", "titleJpFuri": "{先生|せんせい}からのメール",
    "topic": "И-мэйл · Сургууль", "topicEn": "Email · School",
    "body": [
        "{来週|らいしゅう}の{水曜日|すいようび}に{試験|しけん}があります。",
        "{教科書|きょうかしょ}の{五十|ごじゅう}ページから{八十|はちじゅう}ページまで{勉強|べんきょう}してください。",
        "{質問|しつもん}が{有|あ}ったら、メールで{聞|き}いてください。",
    ],
    "bodyMn": [
        "Ирэх лхагва гарагт шалгалт болно.",
        "Сурах бичгийн 50–80-р хуудсыг үзээрэй.",
        "Асуулт байвал и-мэйлээр асууна уу.",
    ],
    "bodyEn": [
        "There will be an exam next Wednesday.",
        "Please study pages 50 to 80 of the textbook.",
        "If you have questions, please ask by email.",
    ],
    "glossary": [
        {"w": "来週", "r": "らいしゅう", "mn": "ирэх долоо хоног", "meaningEn": "next week"},
        {"w": "試験", "r": "しけん", "mn": "шалгалт", "meaningEn": "exam"},
        {"w": "教科書", "r": "きょうかしょ", "mn": "сурах бичиг", "meaningEn": "textbook"},
        {"w": "勉強", "r": "べんきょう", "mn": "суралцах", "meaningEn": "to study"},
    ],
    "questions": [
        {"q": "{試験|しけん}は{何曜日|なんようび}ですか。", "mn": "Шалгалт ямар гарагт вэ?",
         "promptEn": "On which day is the exam?",
         "opts": ["Лхагва гараг", "Даваа гараг", "Баасан гараг", "Ням гараг"],
         "optsEn": ["Wednesday", "Monday", "Friday", "Sunday"],
         "a": 0,
         "why": "“{来週|らいしゅう}の{水曜日|すいようび}に{試験|しけん}があります” гэсэн.",
         "whyEn": "The email says the exam is next Wednesday."},
        {"q": "{何|なに}を{勉強|べんきょう}しますか。", "mn": "Юу үзэх вэ?",
         "promptEn": "What should students study?",
         "opts": ["Сурах бичгийн 50–80-р хуудас", "Сурах бичгийн эхэн хэсэг", "Зөвхөн шинэ үгс", "Юу ч үзэхгүй"],
         "optsEn": ["Pages 50–80 of the textbook", "The beginning of the textbook", "Only new words", "Nothing"],
         "a": 0,
         "why": "“{教科書|きょうかしょ}の{五十|ごじゅう}ページから{八十|はちじゅう}ページまで” гэж өгсөн.",
         "whyEn": "The email assigns pages 50 through 80."},
    ],
})
L.append({
    "id": "read-n4-32", "level": "N4", "minutes": 2,
    "title": "Ажлын зар", "titleEn": "Part-time job ad",
    "titleJp": "アルバイトの募集", "titleJpFuri": "アルバイトの{募集|ぼしゅう}",
    "topic": "Зар · Ажил", "topicEn": "Advertisement · Work",
    "body": [
        "{食堂|しょくどう}で{働|はたら}く{人|ひと}を{募集|ぼしゅう}します。",
        "{週|しゅう}に{三日|みっか}から、{一時間|いちじかん}{四百|よんひゃく}{円|えん}です。",
        "{経験|けいけん}は{要|い}りません。{電話|でんわ}で{連絡|れんらく}してください。",
    ],
    "bodyMn": [
        "Хоолны газарт ажиллах хүн авна.",
        "Долоо хоногт 3-аас дээш өдөр, цагт 400 иен.",
        "Туршлага шаардахгүй. Утсаар холбогдоно уу.",
    ],
    "bodyEn": [
        "We are hiring people to work at the cafeteria.",
        "Three or more days a week, 400 yen per hour.",
        "No experience needed. Please contact us by phone.",
    ],
    "glossary": [
        {"w": "食堂", "r": "しょくどう", "mn": "хоолны газар", "meaningEn": "cafeteria"},
        {"w": "募集", "r": "ぼしゅう", "mn": "ажилд авах", "meaningEn": "recruitment"},
        {"w": "経験", "r": "けいけん", "mn": "туршлага", "meaningEn": "experience"},
        {"w": "連絡", "r": "れんらく", "mn": "холбогдох", "meaningEn": "to contact"},
    ],
    "questions": [
        {"q": "{時給|じきゅう}は{何円|なんえん}ですか。", "mn": "Цалин хэдэн иен вэ?",
         "promptEn": "How much is the hourly wage?",
         "opts": ["400 иен", "300 иен", "500 иен", "1000 иен"],
         "optsEn": ["400 yen", "300 yen", "500 yen", "1000 yen"],
         "a": 0,
         "why": "“{一|いっ}{時|じ}間{四百|よんひゃく}{円|えん}です” гэж бичсэн.",
         "whyEn": "The ad says 400 yen per hour."},
        {"q": "{経験|けいけん}は{必要|ひつよう}ですか。", "mn": "Туршлага шаардлагатай юу?",
         "promptEn": "Is work experience required?",
         "opts": ["Шаардахгүй", "Шаардлагатай", "Зөвхөн туршлагатай хүн", "Мэдээлэлгүй"],
         "optsEn": ["No", "Yes", "Only experienced people", "Not stated"],
         "a": 0,
         "why": "“{経験|けいけん}は{要|い}りません” гэсэн байна.",
         "whyEn": "The ad states that no experience is needed."},
    ],
})
L.append({
    "id": "read-n4-33", "level": "N4", "minutes": 2,
    "title": "Гэрийн мессеж", "titleEn": "Family message",
    "titleJp": "家族からのメッセージ", "titleJpFuri": "{家族|かぞく}からのメッセージ",
    "topic": "Мессеж · Гэр бүл", "topicEn": "Message · Family",
    "body": [
        "{今日|きょう}の{晩|ばん}ごはんはカレーです。",
        "{牛乳|ぎゅうにゅう}を{買|か}って{来|き}てください。",
        "{帰|かえ}りが{遅|おそ}くなる{時|とき}は{知|し}らせてください。",
    ],
    "bodyMn": [
        "Өнөөдрийн оройн хоол карри.",
        "Сүү авчирч өгөөрэй.",
        "Оройтож байвал мэдэгдээрэй.",
    ],
    "bodyEn": [
        "Tonight's dinner is curry.",
        "Please buy milk on your way home.",
        "If you will be late, please let me know.",
    ],
    "glossary": [
        {"w": "晩", "r": "ばん", "mn": "орой", "meaningEn": "evening"},
        {"w": "牛乳", "r": "ぎゅうにゅう", "mn": "сүү", "meaningEn": "milk"},
        {"w": "帰", "r": "かえ", "mn": "гэртээ харих (帰る-ийн эх)", "meaningEn": "to return (start of 帰る)"},
        {"w": "知", "r": "し", "mn": "мэдэгдэх (知らせる-ийн эх)", "meaningEn": "to notify (start of 知らせる)"},
    ],
    "questions": [
        {"q": "{何|なに}を{買|か}って{来|き}ますか。", "mn": "Юу авчрах вэ?",
         "promptEn": "What should be bought?",
         "opts": ["Сүү", "Карри", "Талх", "Өндөг"],
         "optsEn": ["Milk", "Curry", "Bread", "Eggs"],
         "a": 0,
         "why": "“{牛乳|ぎゅうにゅう}を{買|か}って{来|き}てください” гэж гуйсан.",
         "whyEn": "The message asks to buy milk."},
        {"q": "{帰|かえ}りが{遅|おそ}くなる{時|とき}は{何|なに}をしますか。", "mn": "Оройтвол юу хийх вэ?",
         "promptEn": "What should you do if you will be late?",
         "opts": ["Мэдэгдэх", "Юу ч хийхгүй", "Шууд унтах", "Хоол авчрах"],
         "optsEn": ["Let them know", "Do nothing", "Go straight to sleep", "Bring food"],
         "a": 0,
         "why": "“{知|し}らせてください” гэж захисан.",
         "whyEn": "The message says to notify the family."},
    ],
})

# ───────────────────────── N3 ─────────────────────────
L.append({
    "id": "read-n3-31", "level": "N3", "minutes": 3,
    "title": "Эмийн тайлбар", "titleEn": "Medicine instructions",
    "titleJp": "薬の説明", "titleJpFuri": "{薬|くすり}の{説明|せつめい}",
    "topic": "Заавар · Эрүүл мэнд", "topicEn": "Instructions · Health",
    "body": [
        "この{薬|くすり}は{食後|しょくご}に{一|いっ}{回|かい}{二|に}{錠|じょう}を{飲|の}んでください。",
        "{水|みず}と{一緒|いっしょ}に{飲|の}んでください。お{茶|ちゃ}では{飲|の}まないでください。",
        "{熱|ねつ}が{続|つづ}く{時|とき}は、{飲|の}むのを{止|や}めて{医者|いしゃ}に{相談|そうだん}してください。",
    ],
    "bodyMn": [
        "Энэ эмийг хоолны дараа удаа тутамд 2 ширхэг ууна.",
        "Устай хамт ууна. Цайтай бүү уу.",
        "Халуурсаар байвал уухаа больж эмчтэй зөвлөөрэй.",
    ],
    "bodyEn": [
        "Take two pills of this medicine each time after meals.",
        "Take it with water. Do not take it with tea.",
        "If the fever continues, stop taking it and consult a doctor.",
    ],
    "glossary": [
        {"w": "薬", "r": "くすり", "mn": "эм", "meaningEn": "medicine"},
        {"w": "食後", "r": "しょくご", "mn": "хоолны дараа", "meaningEn": "after a meal"},
        {"w": "錠", "r": "じょう", "mn": "ширхэг (эм)", "meaningEn": "pill (counter)"},
        {"w": "医者", "r": "いしゃ", "mn": "эмч", "meaningEn": "doctor"},
        {"w": "相談", "r": "そうだん", "mn": "зөвлөлдөх", "meaningEn": "to consult"},
    ],
    "questions": [
        {"q": "{一|いっ}{回|かい}に{何|なん}{錠|じょう}{飲|の}みますか。", "mn": "Нэг удаа хэдэн ширхэг уух вэ?",
         "promptEn": "How many pills should be taken at one time?",
         "opts": ["2 ширхэг", "1 ширхэг", "3 ширхэг", "4 ширхэг"],
         "optsEn": ["Two pills", "One pill", "Three pills", "Four pills"],
         "a": 0,
         "why": "“{一|いっ}{回|かい}{二|に}{錠|じょう}を{飲|の}んでください” гэсэн.",
         "whyEn": "The label says to take two pills each time."},
        {"q": "お{茶|ちゃ}で{薬|くすり}を{飲|の}めますか。", "mn": "Цайтай эм ууж болох уу?",
         "promptEn": "Can the medicine be taken with tea?",
         "opts": ["Болохгүй", "Болно", "Зөвхөн өглөө болно", "Эмчээс асуух хэрэгтэй"],
         "optsEn": ["No", "Yes", "Only in the morning", "Ask a doctor first"],
         "a": 0,
         "why": "“お{茶|ちゃ}では{飲|の}まないでください” гэж хориглосон.",
         "whyEn": "The instructions say not to take it with tea."},
    ],
})
L.append({
    "id": "read-n3-32", "level": "N3", "minutes": 3,
    "title": "Хотын мэдээ", "titleEn": "City news",
    "titleJp": "市のニュース", "titleJpFuri": "{市|し}のニュース",
    "topic": "Нийтлэл · Нийтийн тээвэр", "topicEn": "Article · Public transport",
    "body": [
        "{来月|らいげつ}から、{市内|しない}のバスの{料金|りょうきん}が{少|すこ}し{高|たか}くなります。",
        "{一|いっ}{回|かい}の{切符|きっぷ}は{百|ひゃく}{八十|はちじゅう}{円|えん}から{二百|にひゃく}{円|えん}になります。",
        "{市役所|しやくしょ}は、{電車|でんしゃ}やバスを{使|つか}う{人|ひと}が{多|おお}い{理由|りゆう}だと{言|い}っています。",
    ],
    "bodyMn": [
        "Ирэх сараас хот доторх автобусны тариф бага зэрэг нэмэгдэнэ.",
        "Нэг удаагийн тасалбар 180 иенээс 200 иен болно.",
        "Захирагчийн газар галт тэрэг, автобус хэрэглэгч олон байгааг шалтгаан гэж тайлбарлажээ.",
    ],
    "bodyEn": [
        "From next month, city bus fares will rise slightly.",
        "A single ticket will go from 180 yen to 200 yen.",
        "The city office says the reason is that more people use trains and buses.",
    ],
    "glossary": [
        {"w": "来月", "r": "らいげつ", "mn": "ирэх сар", "meaningEn": "next month"},
        {"w": "料金", "r": "りょうきん", "mn": "тариф, төлбөр", "meaningEn": "fee"},
        {"w": "切符", "r": "きっぷ", "mn": "тасалбар", "meaningEn": "ticket"},
        {"w": "市役所", "r": "しやくしょ", "mn": "захирагчийн газар", "meaningEn": "city office"},
        {"w": "理由", "r": "りゆう", "mn": "шалтгаан", "meaningEn": "reason"},
    ],
    "questions": [
        {"q": "{来月|らいげつ}から{切符|きっぷ}は{何円|なんえん}になりますか。", "mn": "Ирэх сараас тасалбар хэдэн иен болох вэ?",
         "promptEn": "How much will a ticket cost from next month?",
         "opts": ["200 иен", "180 иен", "150 иен", "250 иен"],
         "optsEn": ["200 yen", "180 yen", "150 yen", "250 yen"],
         "a": 0,
         "why": "“{百|ひゃく}八十{円|えん}から{二百|にひゃく}{円|えん}になります” гэсэн.",
         "whyEn": "The article says the fare rises from 180 to 200 yen."},
        {"q": "{料金|りょうきん}が{高|たか}くなる{理由|りゆう}は{何|なん}ですか。", "mn": "Үнэ өсөх шалтгаан юу вэ?",
         "promptEn": "Why will the fare increase?",
         "opts": ["Нийтийн тээвэр хэрэглэгч олшсоор", "Шатахууны үнэ", "Шинэ автобус", "Мэдээлэлгүй"],
         "optsEn": ["More people use public transport", "Fuel prices", "New buses", "Not stated"],
         "a": 0,
         "why": "“{電車|でんしゃ}やバスを{使|つか}う{人|ひと}が{多|おお}い{理由|りゆう}だと{言|い}っています” гэж тайлбарласан.",
         "whyEn": "The city office cites the growing number of train and bus users."},
    ],
})
L.append({
    "id": "read-n3-33", "level": "N3", "minutes": 3,
    "title": "Компанийн и-мэйл", "titleEn": "Company email",
    "titleJp": "会社からのメール", "titleJpFuri": "{会社|かいしゃ}からのメール",
    "topic": "И-мэйл · Ажил", "topicEn": "Email · Work",
    "body": [
        "{来週|らいしゅう}の{月曜日|げつようび}に、{新|あたら}しい{商品|しょうひん}の{会議|かいぎ}があります。",
        "{資料|しりょう}を{今日|きょう}の{午後|ごご}{五時|ごじ}までにメールで{送|おく}ってください。",
        "{会議|かいぎ}に{出|で}られない{人|ひと}は、{前|まえ}の{日|ひ}に{連絡|れんらく}してください。",
    ],
    "bodyMn": [
        "Ирэх даваа гарагт шинэ бүтээгдэхүүний хурал болно.",
        "Материалыг өнөөдөр орой 5 цагаас өмнө и-мэйлээр илгээнэ үү.",
        "Хуралд оролцохгүй хүн өмнөх өдөр нь мэдэгдэнэ үү.",
    ],
    "bodyEn": [
        "There will be a meeting about the new product next Monday.",
        "Please send the materials by email before 5 p.m. today.",
        "Those who cannot attend should report the day before.",
    ],
    "glossary": [
        {"w": "商品", "r": "しょうひん", "mn": "бүтээгдэхүүн", "meaningEn": "product"},
        {"w": "会議", "r": "かいぎ", "mn": "хурал", "meaningEn": "meeting"},
        {"w": "資料", "r": "しりょう", "mn": "материал", "meaningEn": "materials"},
        {"w": "送", "r": "おく", "mn": "илгээх (送る-ийн эх)", "meaningEn": "to send (start of 送る)"},
    ],
    "questions": [
        {"q": "{資料|しりょう}は{何時|なんじ}までに{送|おく}りますか。", "mn": "Материалыг хэдэн цагаас өмнө илгээх вэ?",
         "promptEn": "By what time must the materials be sent?",
         "opts": ["Өнөөдөр орой 5 цаг", "Ирэх даваа гараг", "Маргааш өглөө", "Хурлын дараа"],
         "optsEn": ["By 5 p.m. today", "Next Monday", "Tomorrow morning", "After the meeting"],
         "a": 0,
         "why": "“{今日|きょう}の{午後|ごご}{五時|ごじ}までに” гэж хугацаа өгсөн.",
         "whyEn": "The email sets the deadline at 5 p.m. today."},
        {"q": "{会議|かいぎ}に{出|で}られない{時|とき}は{何|なに}をしますか。", "mn": "Хуралд оролцохгүй бол юу хийх вэ?",
         "promptEn": "What should you do if you cannot attend the meeting?",
         "opts": ["Өмнөх өдөр нь мэдэгдэх", "Юу ч хийхгүй", "Хурлын дараа ярих", "И-мэйл устгах"],
         "optsEn": ["Report the day before", "Do nothing", "Talk after the meeting", "Delete the email"],
         "a": 0,
         "why": "“{前|まえ}の{日|ひ}に{連絡|れんらく}してください” гэж заасан.",
         "whyEn": "The email says to report the day before."},
    ],
})

# ───────────────────────── N2 ─────────────────────────
L.append({
    "id": "read-n2-31", "level": "N2", "minutes": 4,
    "title": "Цахилгааны төлбөрийн мэдээ", "titleEn": "News on electricity bills",
    "titleJp": "電気代のニュース", "titleJpFuri": "{電気|でんき}{代|だい}のニュース",
    "topic": "Нийтлэл · Эдийн засаг", "topicEn": "Article · Economy",
    "body": [
        "{今年|ことし}の{冬|ふゆ}から、{電気|でんき}の{料金|りょうきん}が{平均|へいきん}で{五|ご}パーセントほどうちが{上|あ}がる{見込|みこ}みです。",
        "{会社|かいしゃ}は、{燃料|ねんりょう}の{価格|かかく}が{高|たか}くなったことが{理由|りゆう}だと{説明|せつめい}しています。",
        "{政府|せいふ}は、{家計|かけい}への{影響|えいきょう}を{考|かんが}えて、{一部|いちぶ}の{家庭|かてい}に{支援|しえん}を{検討|けんとう}しています。",
    ],
    "bodyMn": [
        "Энэ өвлийн эхнээс цахилгааны төлбөр дунджаар 5 орчим хувиар нэмэгдэх төлөвтэй.",
        "Компани түлшний үнэ өссөнийг шалтгаан гэж тайлбарлажээ.",
        "Засгийн газар айл өрхөд үзүүлэх нөлөөллийг харгалзан зарим өрхөд дэмжлэг үзүүлэхийг хэлэлцэж байна.",
    ],
    "bodyEn": [
        "From this winter, electricity bills are expected to rise by about 5% on average.",
        "The company explains that higher fuel prices are the reason.",
        "The government is considering support for some households, taking the impact on family budgets into account.",
    ],
    "glossary": [
        {"w": "電気代", "r": "でんきだい", "mn": "цахилгааны төлбөр", "meaningEn": "electricity bill"},
        {"w": "平均", "r": "へいきん", "mn": "дундаж", "meaningEn": "average"},
        {"w": "燃料", "r": "ねんりょう", "mn": "түлш", "meaningEn": "fuel"},
        {"w": "家計", "r": "かけい", "mn": "өрхийн санхүү", "meaningEn": "household budget"},
        {"w": "支援", "r": "しえん", "mn": "дэмжлэг", "meaningEn": "support"},
    ],
    "questions": [
        {"q": "{電気|でんき}{代|だい}は{今年|ことし}の{冬|ふゆ}から{何|なん}{パーセント}くらい{上|あ}がりますか。", "mn": "Энэ өвлөөс цахилгааны төлбөр хэдэн хувиар өсөх вэ?",
         "promptEn": "By about how much will electricity bills rise from this winter?",
         "opts": ["Ойролцоогоор 5 хувь", "Ойролцоогоор 15 хувь", "Ойролцоогоор 50 хувь", "Буурах төлөвтэй"],
         "optsEn": ["About 5%", "About 15%", "About 50%", "Expected to fall"],
         "a": 0,
         "why": "“{平均|へいきん}で{五|ご}パーセントほどうちが{上|あ}がる{見込|みこ}みです” гэсэн.",
         "whyEn": "The article says bills are expected to rise by about 5%."},
        {"q": "{政府|せいふ}は{何|なに}を{検討|けんとう}していますか。", "mn": "Засгийн газар юуг хэлэлцэж байна вэ?",
         "promptEn": "What is the government considering?",
         "opts": ["Зарим өрхөд дэмжлэг үзүүлэх", "Цахилгааны үнийг бууруулах", "Компанийг торгох", "Шинэ татвар нэмэх"],
         "optsEn": ["Support for some households", "Lowering electricity prices", "Fining the company", "Adding a new tax"],
         "a": 0,
         "why": "“{一部|いちぶ}の{家庭|かてい}に{支援|しえん}を{検討|けんとう}しています” гэсэн.",
         "whyEn": "The government is considering support for some households."},
    ],
})
L.append({
    "id": "read-n2-32", "level": "N2", "minutes": 3,
    "title": "Хурлын урилга", "titleEn": "Meeting invitation",
    "titleJp": "会議のご案内", "titleJpFuri": "{会議|かいぎ}のご{案内|あんない}",
    "topic": "И-мэйл · Ажил", "topicEn": "Email · Work",
    "body": [
        "{来月|らいげつ}{十日|とおか}に、{取引先|とりひきさき}との{打|う}ち{合|あ}わせを{開|ひら}きます。",
        "{場所|ばしょ}は{本社|ほんしゃ}の{三|さん}{階|かい}の{会議室|かいぎしつ}で、{午後|ごご}{一時|いちじ}から{始|はじ}まります。",
        "{議事録|ぎじろく}は{後|あと}でメールに{添付|てんぷ}しますので、{確認|かくにん}の{上|うえ}、{金曜日|きんようび}までに{返事|へんじ}を{願|ねが}います。",
    ],
    "bodyMn": [
        "Ирэх сарын 10-нд харилцагч талтай уулзалт зохион байгуулна.",
        "Газар нь төв оффисын 3-р давхрын хурлын танхим, өдөр 1 цагаас эхэлнэ.",
        "Хурлын тэмдэглэлийг дараа нь и-мэйлээр хавсаргах тул шалгаад баасан гарагаас өмнө хариу өгнө үү.",
    ],
    "bodyEn": [
        "On the 10th of next month we will hold a meeting with our business partner.",
        "It will be in the third-floor meeting room of the head office, starting at 1 p.m.",
        "I will attach the minutes by email later, so please check them and reply by Friday.",
    ],
    "glossary": [
        {"w": "取引先", "r": "とりひきさき", "mn": "харилцагч байгууллага", "meaningEn": "business partner"},
        {"w": "会議室", "r": "かいぎしつ", "mn": "хурлын танхим", "meaningEn": "meeting room"},
        {"w": "議事録", "r": "ぎじろく", "mn": "хурлын тэмдэглэл", "meaningEn": "minutes (of a meeting)"},
        {"w": "添付", "r": "てんぷ", "mn": "хавсаргах", "meaningEn": "to attach"},
        {"w": "返事", "r": "へんじ", "mn": "хариу", "meaningEn": "reply"},
    ],
    "questions": [
        {"q": "{打|う}ち{合|あ}わせは{何時|なんじ}からですか。", "mn": "Уулзалт хэдэн цагаас эхлэх вэ?",
         "promptEn": "What time does the meeting start?",
         "opts": ["Өдөр 1 цагаас", "Өглөө 9 цагаас", "Орой 6 цагаас", "Хэдэн цаг нь тодорхойгүй"],
         "optsEn": ["From 1 p.m.", "From 9 a.m.", "From 6 p.m.", "Time not specified"],
         "a": 0,
         "why": "“{午後|ごご}{一時|いちじ}から{始|はじ}まります” гэсэн.",
         "whyEn": "The invitation says it starts at 1 p.m."},
        {"q": "{返事|へんじ}は{何曜日|なんようび}までに{送|おく}りますか。", "mn": "Хариуг ямар гарагаас өмнө илгээх вэ?",
         "promptEn": "By which day must the reply be sent?",
         "opts": ["Баасан гараг", "Даваа гараг", "Лхагва гараг", "Ням гараг"],
         "optsEn": ["Friday", "Monday", "Wednesday", "Sunday"],
         "a": 0,
         "why": "“{金曜日|きんようび}までに{返事|へんじ}を{願|ねが}います” гэж гуйсан.",
         "whyEn": "The email asks for a reply by Friday."},
    ],
})
L.append({
    "id": "read-n2-33", "level": "N2", "minutes": 3,
    "title": "Тэтгэлэгийн зар", "titleEn": "Scholarship announcement",
    "titleJp": "奨学金の募集", "titleJpFuri": "{奨学金|しょうがくきん}の{募集|ぼしゅう}",
    "topic": "Зар · Боловсрол", "topicEn": "Advertisement · Education",
    "body": [
        "{市|し}は、{高校|こうこう}に{通|かよ}う{生徒|せいと}に{対|たい}して、{奨学金|しょうがくきん}の{申|もう}し{込|こ}みを{受|う}け{付|つ}けます。",
        "{家計|かけい}が{厳|きび}しい{家庭|かてい}の{子|こ}どもを{優先|ゆうせん}し、{月|つき}に{三万|さんまん}{円|えん}を{支給|しきゅう}します。",
        "{申|もう}し{込|こ}み{締|し}め{切|き}りは{四月|しがつ}{末|まつ}で、{必要|ひつよう}な{書類|しょるい}は{市役所|しやくしょ}の{窓口|まどぐち}でもらえます。",
    ],
    "bodyMn": [
        "Хот ахлах сургуульд суралцагчдад тэтгэлэгт хамрагдах өргөдөл хүлээн авна.",
        "Санхүүгийн хүнд айл өрхийн хүүхдүүдийг тэргүүлэн үзэж, сард 30 мянган иен олгоно.",
        "Өргөдлийн хугацаа дөрөвдүгээр сарын эцэс, шаардлагатай бичиг баримтыг захиргааны цонхоор авч болно.",
    ],
    "bodyEn": [
        "The city is accepting scholarship applications from high school students.",
        "Children from financially struggling households are given priority, and 30,000 yen per month is provided.",
        "The application deadline is the end of April, and the necessary documents are available at the city office counter.",
    ],
    "glossary": [
        {"w": "奨学金", "r": "しょうがくきん", "mn": "тэтгэлэг", "meaningEn": "scholarship"},
        {"w": "生徒", "r": "せいと", "mn": "суралцагч (ахлах)", "meaningEn": "student (secondary)"},
        {"w": "支給", "r": "しきゅう", "mn": "олгох (мөнгө)", "meaningEn": "payment (of funds)"},
        {"w": "書類", "r": "しょるい", "mn": "бичиг баримт", "meaningEn": "documents"},
        {"w": "窓口", "r": "まどぐち", "mn": "үйлчилгээний цонх", "meaningEn": "service counter"},
    ],
    "questions": [
        {"q": "{月|つき}に{何|なん}{円|えん}{支給|しきゅう}しますか。", "mn": "Сард хэдэн иен олгох вэ?",
         "promptEn": "How much is provided per month?",
         "opts": ["30 мянган иен", "3 мянган иен", "100 мянган иен", "50 мянган иен"],
         "optsEn": ["30,000 yen", "3,000 yen", "100,000 yen", "50,000 yen"],
         "a": 0,
         "why": "“{月|つき}に{三万|さんまん}{円|えん}を{支給|しきゅう}します” гэсэн.",
         "whyEn": "The announcement states 30,000 yen per month."},
        {"q": "{申|もう}し{込|こ}み{締|し}め{切|き}りは{何時|なん}ですか。", "mn": "Өргөдлийн хугацаа хэзээ вэ?",
         "promptEn": "When is the application deadline?",
         "opts": ["Дөрөвдүгээр сарын эцэс", "Гуравдугаар сарын эх", "Нэгдүгээр сарын дунд", "Арванхоёрдугаар сар"],
         "optsEn": ["End of April", "Beginning of March", "Mid-January", "December"],
         "a": 0,
         "why": "“{申|もう}し{込|こ}み{締|し}め{切|き}りは{四月|しがつ}{末|まつ}” гэж заасан.",
         "whyEn": "The deadline is the end of April."},
    ],
})

# ───────────────────────── N1 ─────────────────────────
L.append({
    "id": "read-n1-31", "level": "N1", "minutes": 5,
    "title": "Уншлагын тухай багана", "titleEn": "Column on reading",
    "titleJp": "読書についてのコラム", "titleJpFuri": "{読書|どくしょ}についてのコラム",
    "topic": "Нийтлэл · Соёл", "topicEn": "Article · Culture",
    "body": [
        "{情報|じょうほう}が{溢|あふ}れる{現代|げんだい}において、じっくりと{本|ほん}を{読|よ}む{時間|じかん}を{確保|かくほ}するのは{容易|ようい}なことではない。",
        "{多|おお}くの{人|ひと}は、{短|みじか}い{記事|きじ}や{動画|どうが}で{情報|じょうほう}を{得|え}る{習慣|しゅうかん}が{身|み}についてしまった。",
        "しかしながら、{長|なが}い{文章|ぶんしょう}に{集中|しゅうちゅう}する{力|ちから}は、{他|ほか}では{得|え}がたい{思考|しこう}の{深|ふか}さを{育|そだ}てると{言|い}える。",
        "{読書|どくしょ}の{価値|かち}は、{単|たん}に{知識|ちしき}を{増|ふ}やすだけではなく、{自分|じぶん}の{考|かんが}えを{客観的|きゃっかんてき}に{見|み}る{目|め}を{養|やしな}う{点|てん}にある。",
    ],
    "bodyMn": [
        "Мэдээлэл дүүрэн өнөө үед номыг тайван унших цаг гаргах нь амар биш.",
        "Олон хүн богино нийтлэл, бичлэгээр мэдээлэл авах дадалд орчихжээ.",
        "Гэвч урт текстэд төвлөрөх чадвар нь өөр хаанаас олдохгүй бодлын гүнзгийрлийг төлөвшүүлдэг.",
        "Уншлагын үнэ цэн нь зөвхөн мэдлэг нэмэхэд бус, өөрийн бодлыг объектив харах харааг хөгжүүлэхэд оршдог.",
    ],
    "bodyEn": [
        "In the modern age of information overload, securing time to read books carefully is no easy task.",
        "Many people have grown used to getting information from short articles and videos.",
        "Yet the ability to concentrate on long texts fosters a depth of thinking hard to gain elsewhere.",
        "The value of reading lies not only in increasing knowledge but in cultivating an eye that views one's own thinking objectively.",
    ],
    "glossary": [
        {"w": "情報", "r": "じょうほう", "mn": "мэдээлэл", "meaningEn": "information"},
        {"w": "確保", "r": "かくほ", "mn": "баталгаажуулах, гаргаж авах", "meaningEn": "to secure"},
        {"w": "習慣", "r": "しゅうかん", "mn": "дадал", "meaningEn": "habit"},
        {"w": "思考", "r": "しこう", "mn": "бодлого, бодох үйл", "meaningEn": "thinking"},
        {"w": "客観", "r": "きゃっかん", "mn": "объектив", "meaningEn": "objectivity"},
    ],
    "questions": [
        {"q": "この{文章|ぶんしょう}の{筆者|ひっしゃ}は、{読書|どくしょ}の{価値|かち}を{何|なに}にあると{考|かんが}えていますか。", "mn": "Зохиогч уншлагын үнэ цэнийг юунд оршино гэж үзэж байна вэ?",
         "promptEn": "According to the author, where does the value of reading lie?",
         "opts": ["Мэдлэг нэмэхэд л бус, объектив харах харааг хөгжүүлэхэд", "Чөлөөт цагийг зугаатай өнгөрөөхөд", "Богино мэдээлэл хурдан авахад", "Хэлний шалгалтад бэлдэхэд"],
         "optsEn": ["Not just in gaining knowledge but in cultivating an objective view", "In passing free time pleasantly", "In getting short information quickly", "In preparing for language tests"],
         "a": 0,
         "why": "Сүүлийн мөрөнд “{単|たん}に{知識|ちしき}を{増|ふ}やすだけではなく…{客観的|きゃっかんてき}に{見|み}る{目|め}を{養|やしな}う{点|てん}にある” гэж дүгнэсэн.",
         "whyEn": "The final line states the value lies beyond mere knowledge, in cultivating an objective eye."},
        {"q": "{筆者|ひっしゃ}によると、{現代|げんだい}の{多|おお}くの{人|ひと}は{何|なに}に{問題|もんだい}がありますか。", "mn": "Зохиогчийн үзэж байгаагаар орчин үеийн олон хүнд ямар асуудал байна вэ?",
         "promptEn": "According to the author, what is the issue with many modern people?",
         "opts": ["Богино мэдээлэлд дассан байдал", "Ном худалдаж авах мөнгөгүй байдал", "Гадаад хэл сурах цаггүй байдал", "Номын санд явах зам хол байдал"],
         "optsEn": ["Habituation to short information", "Lack of money to buy books", "No time to study foreign languages", "Libraries being too far away"],
         "a": 0,
         "why": "Хоёр дахь мөрөнд богино нийтлэл, бичлэгээр мэдээлэл авах дадалд орсныг дурджээ.",
         "whyEn": "The second line notes the habit of consuming short articles and videos."},
    ],
})
L.append({
    "id": "read-n1-32", "level": "N1", "minutes": 4,
    "title": "Өргөдлийн гарын авлага", "titleEn": "Application guide",
    "titleJp": "申請の手引き", "titleJpFuri": "{申請|しんせい}の{手引|てび}き",
    "topic": "Заавар · Ажил", "topicEn": "Instructions · Administration",
    "body": [
        "この{制度|せいど}の{利用|りよう}を{希望|きぼう}する{方|かた}は、{必要|ひつよう}な{書類|しょるい}を{揃|そろ}えた{上|うえ}、{受付|うけつけ}{期間内|きかんない}に{提出|ていしゅつ}してください。",
        "{申請書|しんせいしょ}は{本文|ほんぶん}の{末尾|まつび}に{添付|てんぷ}されておりますので、{印刷|いんさつ}の{上|うえ}、{記入|きにゅう}してください。",
        "{虚偽|きょぎ}の{記載|きさい}が{判明|はんめい}した{場合|ばあい}は、{受|う}け{入|い}れられた{後|あと}でも{取消|とりけし}となることがあります。",
        "{不明|ふめい}な{点|てん}がございましたら、{担当|たんとう}までお{問|と}い{合|あ}わせください。",
    ],
    "bodyMn": [
        "Энэ хөтөлбөрийг ашиглахыг хүсэгч нь шаардлагатай бичиг баримтыг бүрдүүлэн, хүлээн авах хугацаанд ирүүлнэ үү.",
        "Өргөдлийн маягтыг бичгийн төгсгөлд хавсаргасан тул хэвлэж бөглөнө үү.",
        "Худал мэдээлэл илэрсэн тохиолдолд хүлээн авсны дараа ч цуцлагдах магадлалтай.",
        "Тодорхойгүй зүйл байвал хариуцах албатай холбогдоно уу.",
    ],
    "bodyEn": [
        "Those who wish to use this system should prepare the required documents and submit them within the acceptance period.",
        "The application form is attached at the end of this document; please print and complete it.",
        "If any false statements are found, the application may be revoked even after acceptance.",
        "If anything is unclear, please contact the department in charge.",
    ],
    "glossary": [
        {"w": "申請", "r": "しんせい", "mn": "өргөдөл гаргах", "meaningEn": "application"},
        {"w": "必要", "r": "ひつよう", "mn": "шаардлагатай", "meaningEn": "necessary"},
        {"w": "提出", "r": "ていしゅつ", "mn": "ирүүлэх", "meaningEn": "to submit"},
        {"w": "虚偽", "r": "きょぎ", "mn": "худал, зохиомол", "meaningEn": "falsehood"},
        {"w": "取消", "r": "とりけし", "mn": "цуцлах", "meaningEn": "revocation"},
    ],
    "questions": [
        {"q": "{虚偽|きょぎ}の{記載|きさい}が{判明|はんめい}した{場合|ばあい}は、{何|なに}になることがありますか。", "mn": "Худал мэдээлэл илэрвэл яах вэ?",
         "promptEn": "What may happen if false information is found?",
         "opts": ["Хүлээн авсны дараа ч цуцлагдах", "Ямар ч нөлөөгүй", "Төлбөр нэмэгдэх", "Хугацаа сунгагдах"],
         "optsEn": ["It may be revoked even after acceptance", "Nothing happens", "The fee increases", "The deadline is extended"],
         "a": 0,
         "why": "“{受|う}け{入|い}れられた{後|あと}でも{取消|とりけし}となることがあります” гэж анхааруулсан.",
         "whyEn": "The guide warns of revocation even after acceptance."},
        {"q": "{申請書|しんせいしょ}は{何処|どこ}にありますか。", "mn": "Өргөдлийн маягт хаана байна вэ?",
         "promptEn": "Where is the application form?",
         "opts": ["Бичгийн төгсгөлд хавсаргасан", "Вэбсайтын нүүр хуудас", "Захиргааны цонхонд", "И-мэйлээр илгээнэ"],
         "optsEn": ["Attached at the end of the document", "On the website homepage", "At the service counter", "Sent by email"],
         "a": 0,
         "why": "“{申請書|しんせいしょ}は{本文|ほんぶん}の{末尾|まつび}に{添付|てんぷ}されております” гэсэн.",
         "whyEn": "The form is attached at the end of the text."},
    ],
})
L.append({
    "id": "read-n1-33", "level": "N1", "minutes": 4,
    "title": "Харилцагчид илгээх саналын захиа", "titleEn": "Proposal email to a client",
    "titleJp": "取引先への提案メール", "titleJpFuri": "{取引先|とりひきさき}への{提案|ていあん}メール",
    "topic": "И-мэйл · Бизнес", "topicEn": "Email · Business",
    "body": [
        "{平素|へいそ}より{格別|かくべつ}のお{引|ひ}き{立|た}てを{賜|たまわ}り、{誠|まこと}に{有難|ありが}うございます。",
        "このたび、{貴社|きしゃ}の{業務|ぎょうむ}{効率化|こうりつか}に{資|し}すると{考|かんが}えられる{新|あたら}しい{案|あん}を{考案|こうあん}いたしましたので、ご{提案|ていあん}{申|もう}し{上|あ}げます。",
        "つきましては、{来週|らいしゅう}の{貴社|きしゃ}の{都合|つごう}のよろしい{日時|にちじ}に、{詳細|しょうさい}をご{説明|せつめい}する{機会|きかい}を{賜|たまわ}れましたら{幸|さいわ}いです。",
        "{多忙|たぼう}の{折|おり}とは{存|ぞん}じますが、{何卒|なにとぞ}{高配|こうはい}の{程|ほど}よろしく{願|ねが}い{申|もう}し{上|あ}げます。",
    ],
    "bodyMn": [
        "Тогтмол үнэт хамтын ажиллагаандаа чин сэтгэлээс талархаж байна.",
        "Энэ удаа танай компанийн үйл ажиллагааны үр ашгийг дээшлүүлэхэд тустай гэж үзсэн шинэ санааг боловсруулсан тул танилцуулж байна.",
        "Ирэх долоо хоногт танд тохиромжтой цагт дэлгэрэнгүй танилцуулах боломж олдвол баяртай байх болно.",
        "Завгүй үед гэдгийг ойлгож байгаа ч, хүндэтгэн үзэж хандана уу.",
    ],
    "bodyEn": [
        "We sincerely appreciate your continued, exceptional support.",
        "We have developed a new proposal that we believe will contribute to the efficiency of your operations, and we would like to present it.",
        "If we could have the opportunity to explain the details at your convenience next week, we would be grateful.",
        "We understand you are busy, and we appreciate your kind consideration.",
    ],
    "glossary": [
        {"w": "貴社", "r": "きしゃ", "mn": "танай компани (хүндэтгэл)", "meaningEn": "your company (honorific)"},
        {"w": "効率", "r": "こうりつ", "mn": "үр ашиг", "meaningEn": "efficiency"},
        {"w": "提案", "r": "ていあん", "mn": "санал", "meaningEn": "proposal"},
        {"w": "都合", "r": "つごう", "mn": "боломж, тохиромж", "meaningEn": "convenience"},
        {"w": "詳細", "r": "しょうさい", "mn": "дэлгэрэнгүй", "meaningEn": "details"},
    ],
    "questions": [
        {"q": "この{メール|めーる}の{主|おも}な{目的|もくてき}は{何|なん}ですか。", "mn": "Энэ захианы үндсэн зорилго юу вэ?",
         "promptEn": "What is the main purpose of this email?",
         "opts": ["Шинэ санал танилцуулах цаг хүсэх", "Төлбөр төлөхийг сануулах", "Гэрээг цуцлах", "Ажилтныг магтах"],
         "optsEn": ["To request time to present a new proposal", "To remind about payment", "To cancel a contract", "To praise an employee"],
         "a": 0,
         "why": "“{詳細|しょうさい}をご{説明|せつめい}する{機会|きかい}を{賜|たまわ}れましたら{幸|さいわ}いです” гэж уулзах цаг гуйжээ.",
         "whyEn": "The writer asks for an opportunity to explain the proposal in detail."},
        {"q": "この{文|ぶん}で{使|つか}われている{表現|ひょうげん}は、{主|おも}に{何|なん}の{場面|ばめん}で{使|つか}われますか。", "mn": "Энд хэрэглэсэн илэрхийлэл ямар нөхцөлд ихэвчлэн хэрэглэгддэг вэ?",
         "promptEn": "In what kind of situation is the style of this text mainly used?",
         "opts": ["Албан ёсны бизнесийн захиа", "Найзуудын чат", "Өдөр тутмын тэмдэглэл", "Ярианы хэлний шалгалт"],
         "optsEn": ["Formal business correspondence", "Chat between friends", "Daily notes", "Spoken-language exam"],
         "a": 0,
         "why": "“{平素|へいそ}より…{賜|たまわ}り” “{何卒|なにとぞ}{高配|こうはい}の{程|ほど}” зэрэг хэв маяг нь албан ёсны бизнес захианы онцлог юм.",
         "whyEn": "Expressions like 賜り and 何卒…の程よろしく are typical of formal business letters."},
    ],
})


def main():
    import re
    strip_ruby = lambda s: re.sub(r"\{([^|{}]+)\}", r"\1", re.sub(r"\{([^|{}]+)\|[^{}]+\}", r"\1", s))
    data = json.loads(PATH.read_text(encoding="utf-8"))
    existing = {x["id"] for x in data}
    added = 0
    for lesson in L:
        if lesson["id"] in existing:
            continue
        # Question prompt/explanation fields render as plain text — keep them ruby-free.
        for q in lesson.get("questions", []):
            q["q"] = strip_ruby(q["q"])
            q["why"] = strip_ruby(q["why"])
        data.append(lesson)
        added += 1
    # Register provenance on ALL reading lessons (honest: AI-assisted, not human-reviewed).
    for x in data:
        x.setdefault("status", "pending_review")
        x.setdefault("source", "original-ai-assisted")
    PATH.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")

    total = len(data)
    reviewed = sum(1 for x in data if x.get("status") == "reviewed")
    pending = sum(1 for x in data if x.get("status") == "pending_review")
    per_level = {}
    for lvl in ["N5", "N4", "N3", "N2", "N1"]:
        per_level[lvl] = sum(1 for x in data if x["level"] == lvl)
    questions = sum(len(x.get("questions", [])) for x in data)
    print(f"added {added} lessons")
    print(f"total={total} reviewed={reviewed} pending_review={pending} questions={questions}")
    print(f"per_level={per_level}")


if __name__ == "__main__":
    main()
