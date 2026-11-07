# Kanjitaro gap audit — Nihongo Dōjō

Огноо: 2026-11-01 · Branch: `freebuff/role-…-87d45292-…` · HEAD: `055c89c`
Аудит нь зөвхөн уншиж шалгасан — production код өөрчлөгдөөгүй, commit/push/deploy хийгээгүй.

## 1. Боломжийн матриц (20)

| # | Боломж | Төлөв | Бодит нотолгоо (файл) | Дутуу |
|---|---|---|---|---|
| 1 | Daily study dashboard | **PARTIAL / BROKEN хэсэгтэй** | `src/pages/Home.tsx`: `mission[]` 6 зорилт, `late` bar, resume, heatmap | `grammar` ба `reading` нь **бүх цагийн** `doc.grammarDone.length` / `doc.readingDone.length`-ыг «өнөөдрийн» гэж тоолно → зорилт шууд 100% болно. `nextLesson`/`nextReading` нь `useMemo` дотор `Math.random()` → render бүрд өөр |
| 2 | Kanji flashcards | EXISTS (2 төлөвт хувилбар дутуу) | `KanjiStudy.tsx`, `Session.tsx` (flip → reveal → 4 зэрэглэл, TTS, жишээ) | «Мэднэ / мэдэхгүй» 2 товчтой горим байхгүй; зөвхөн 4-grade SRS |
| 3 | Vocabulary flashcards | EXISTS | `SessionSetup` (direction jp-mn/mn-jp/listen/read, тоо, onlyDue) + `Session` | Тохиргоо (direction/count/onlyDue) хадгалагддаггүй |
| 4 | New / Learning / Known төлөв | PARTIAL | `Vocabulary.tsx` state шүүлт (new/learning/review/mastered) + `cardStage()`; `KanjiList`-д зөвхөн цэг | Ханзны жагсаалтад төлөвийн шүүлт байхгүй; нэршил admin/UI-д жигд бус |
| 5 | Weak spots quiz | PARTIAL | `Quiz.tsx` `start("weak")` → `buildQuiz` `weakKinds`; `Review.tsx` `mode=weak` (SRS) | `Quiz`/`Home` нь `doc.quizzes`-оос өөрөө тооцно; шалгалтын хэсгүүд ордоггүй (`stats.weakestAreas` орсон ч холбогдоогүй) |
| 6 | Today's mistakes quiz | PARTIAL | `Mistakes.tsx` (level/kind шүүлт, огноотой), `quiz?mode=mistakes` | «Өнөөдрийн» шүүлт байхгүй; цаг хугацааны бүс тооцохгүй |
| 7 | Kanji explorer | EXISTS | `KanjiList.tsx`: хайлт (ханз/он/кун/en/mn), радикал шүүлт, эрэмбэ (freq/stroke/grade/level), pager, `KanjiDetail` + `StrokePad` + `WordNetwork` | Төлөвийн шүүлт, bookmark |
| 8 | Vocabulary explorer | EXISTS | `Vocabulary.tsx`: хайлт (jp/kana/romaji/en/mn), pos/topic/state шүүлт, эрэмбэ, pager, `WordDetail` | 「Суралцаж байгаа」 гэх мэт төлөвийн нэршил i18n-д жигд бус |
| 9 | JLPT level filters | EXISTS | Бүх list/detail хуудсанд `Select` + `LevelSwitcher` (`Shell.tsx`) | — |
| 10 | Bookmark / favorites | PARTIAL | `Vocabulary.tsx:240`, `WordDetail.tsx:85`, `Review` `fav` tab | `KanjiDetail`-д bookmark байхгүй (grep: `toggleFavorite` зөвхөн 2 файлд) |
| 11 | TTS & audio | EXISTS | `ui.tsx` `speak()`/`SpeakButton` (`speechSynthesis`), `profile.rate`, `Session` listen горим | Бичлэгтэй аудио байхгүй (зөвхөн төхөөрөмжийн TTS) |
| 12 | Quiz customization | PARTIAL | `Quiz.tsx` level + count (10/15/20/30/50) + 13 горим | Сонголт `useState` — reload-д алга; mode бүрийн тохиргоо, хүндрэлийн түвшин байхгүй |
| 13 | Daily goal | EXISTS | `profile.dailyGoal` (5–300, `AccountModal:201`), Home `scale = goal/30`, header bar | Зорилт нь `min`-д тулгуурласан боловч mission нь тоо (үг/карт) — хоёр нэгж холилдсон |
| 14 | Learning history | PARTIAL | `Progress.tsx` 28 хоногийн хүснэгт + шалгалтын түүх; `reviewHistory` (Home график) | Quiz session-уудыг жагсааж үзэх хуудас байхгүй |
| 15 | Answer history | PARTIAL | `doc.mistakes` (алдсан, `at`, `count`) + `doc.quizzes` (агрегат) | Зөв хариултын түүх хадгалагддаггүй; асуулт тус бүрийн лог байхгүй |
| 16 | Theme & dark mode | **MISSING (талбар нь үхмэл)** | `doc.ts:58` `theme: "light" \| "sepia"`, `storage.ts:108` normalize | CSS-д `data-theme`/sepia дүрэм байхгүй, тохиргооны UI байхгүй → хадгалагддаг ч харагдах өөрчлөлтгүй |
| 17 | Font customization | MISSING | `index.css:11-12` `--font-jp`, `--font-mincho`; `index.html` Google Fonts | Зөвхөн furigana toggle; фонт солих боломжгүй |
| 18 | Offline / PWA | MISSING | `public/` = зөвхөн `data/`; `index.html`-д manifest/SW байхгүй | Manifest, service worker, cache, install |
| 19 | Backup / restore | EXISTS | `AccountModal:267` export, `:356` import; `storage.decodeDoc` шалгалт + `pre-import` нөөц | — (Phase 1A-д хатуужсан) |
| 20 | Mongolian support | PARTIAL | `i18n.ts` mn/en бүрэн, EN блокт кирилл хориг (validator); reading 8 эх MN тайлбартай | Контент: MN curated **0**, draft 5,382; ханз MN draft 1,040; дүрмийн MN жишээ **0/1,526** |

### Дүгнэлт
- **EXISTS (7):** 3, 7, 8, 9, 11, 13, 19
- **PARTIAL (10):** 1, 2, 4, 5, 6, 10, 12, 14, 15, 20
- **MISSING (3):** 16, 17, 18
- **BROKEN:** 1 (2 зорилтын тоолуур), 16 (талбар хадгалагдаж, нөлөөгүй)
- **NEEDS_VERIFICATION:** байхгүй (бүгд кодын мөрөөр батлагдсан)

## 2. Kanjitaro-оос авах санаа (хуулбарлахгүй)

1. **Нэг карт = нэг шийдвэр**: «мэднэ/мэдэхгүй» 2 товч → манай SRS-ийн Good/Again руу буулгах.
2. **Төлөвийн шүүлт нэг дор**: New / Learning / Known гэсэн 3 шошгыг хайлт, explorer, статистик бүгдэд ижил нэрээр.
3. **Суралцах самбар**: өнөөдрийн үлдсэн тоог нэг харцаар + «үргэлжлүүлэх» товч (манайд байгаа, зөвхөн тоолуурыг засах).
4. **Explorer-ийн нягт жагсаалт**: tile + шүүлт + pager (манайд байгаа; kanji дээр төлөвийн шүүлт нэмэх).
5. **Learning log**: огноо/түвшин/төрлөөр шүүх боломжтой нэг лог (манайд өгөгдөл бий, дэлгэц дутуу).
6. **Theme/font**: хэрэглэгчийн харааны тав тух (манайд талбар бий, хэрэгжүүлээгүй).

## 3. Давхардсан боломж (дахин бүү хий)

| Давхардал | Байршил | Нэгтгэх шийдэл |
|---|---|---|
| Flashcards 2 удаа | `Session.tsx` (Review/Vocabulary) ба `KanjiStudy.tsx` | `Session`-ийг нэг цөм болгож, `KanjiStudy` зөвхөн item сонголт хийнэ (аль хэдийн тэгж байгаа) — шинэ component нэмэхгүй |
| «Сул тал» 3 газар | `Home.tsx` `weak` memo, `Quiz.tsx` `weakKinds`, `Progress.tsx` | Бүгд `stats.weakestAreas()` руу шилжинэ |
| Өдрийн тоо 2 газар | `Home` mission, `Progress` days | `stats.dayAccuracy()` + нэг `mission` тооцоолуур |
| Offer давхарлалт | `Vocabulary` «learn» tab ба `Review` | Хоёулаа `SessionSetup`-ыг дуудна — нэгийг нь л өргөтгөнө |

## 4. Missing / Partial — ажлын жагсаалт

**Missing:** dark mode + theme хэрэгжилт; фонт солих; PWA/offline; асуулт тус бүрийн түүх (сонголтоор).
**Partial:** 2-төлөвт flashcard; ханзны төлөвийн шүүлт; kanji bookmark; өнөөдрийн алдаа; quiz тохиргоо хадгалах; learning log дэлгэц; MN контент (curated 0).

## 5. Архитектурын санал

1. **Нэг эх сурвалж** хэвээр: `doc.srs` (картын төлөв), `doc.activity` (өдөр), `doc.quizzes`, `doc.mistakes`, `doc.exams`. Шинэ collection нээхгүй.
2. **`stats.ts` = цорын ганц агрегатор.** `Home`, `Quiz`, `Progress` дахь дотоод `useMemo` тооцоог устгаж, `weakestAreas()` / `dayAccuracy()` / `kindAccuracy()`-оос авна.
3. **Flashcard = `Session`-ийн горим**, шинэ grading зам биш: «мэднэ» → `schedule(card, 2)`, «мэдэхгүй» → `schedule(card, 0)`. XP/activity нэг л удаа (`grade()`).
4. **Тохиргоог `profile`-д хадгална** (`quiz: {count, mode, level}`, `theme`, `font`) → `SCHEMA_VERSION` 5, `storage.ts` migration + backup. Талбар нэмэх нь merge-д аюулгүй (profile нь `updatedAt`-аар ялна).
5. **Theme:** `<html data-theme="light|sepia|dark">` + `index.css` CSS хувьсагчид (`--color-sumi-*`, `--color-washi-*`). Одоогийн Tailwind утгуудыг шууд солихгүй — хувьсагчаар дамжуулна.
6. **PWA:** `manifest.webmanifest` + SW (app shell + `/data/index/meta.json`), schema bump үед cache version.
7. **History:** `doc.quizzes`-ийг жагсаалт болгон харуулна; асуулт тус бүрийн лог хэрэгтэй бол зөвхөн алдсан id-г `mistakes`-д (аль хэдийн бий) хадгална — doc хэмжээг өсгөхгүй.

## 6. Phase 2.1–2.5 нарийвчилсан төлөвлөгөө

### Phase 2.1 — Flashcards (2 төлөв) + SRS
- `Session`-д `grading: "srs" | "binary"` (default srs); binary үед 2 товч + `Z`/`X` товчлуур.
- «Мэднэ» → Good (2), «мэдэхгүй» → Again (0); preview label-уудыг хэвээр харуулна.
- Тохиргоо (direction/count/onlyDue/grading) → `profile.flashcard`.
- **Тест:** binary→`schedule(2)`/`schedule(0)`; Again нь 10 мин + lapse дүрэм хэвээр; XP нэг удаа; тохиргоо reload-д хадгалагдана; migration v4→v5.

### Phase 2.2 — Quiz dashboard + customization
- `Quiz` нүүр: горим бүрийн сүүлийн нарийвчлал (`stats.kindAccuracy`) бүхий карт.
- `profile.quiz {count, mode, level}` хадгалах; «Сүүлийн тохиргоогоор эхлэх».
- **Тест:** dashboard тоо = `kindAccuracy` гаралт; тохиргоо round-trip; хоосон түүхэд 0 биш «—».

### Phase 2.3 — Kanji & Vocabulary Explorer
- Ханзны жагсаалтад New/Learning/Known шүүлт (`cardStage`).
- `KanjiDetail` bookmark (`toggleFavorite`), «суралцсан/эзэмшсэн» chip.
- Нэг `ExplorerFilters` компонент (хоёр хуудас дахин бичихгүй).
- **Тест:** шүүлтийн тоо = `cardStage` тархалт; bookmark хоёр таб дээр merge; хоосон үр дүнгийн төлөв.

### Phase 2.4 — Weak spots / Today's mistakes / Learning log
- `Home`/`Quiz`/`Progress` → `stats.weakestAreas(doc.quizzes, doc.exams)`.
- `Mistakes`-д «Өнөөдөр / 7 хоног / Бүгд» шүүлт (`todayKey`).
- Шинэ `LearningLog` дэлгэц: quiz/exam/reading оролдлого, огноо/түвшин/төрөл шүүлт.
- **Тест:** exam хэсэг weak жагсаалтад орно; өдрийн хязгаар (00:00) зөв; лог эрэмбэ буурахаар.

### Phase 2.5 — Appearance & accessibility
- `theme`: light / sepia / **dark** (`data-theme`), `font`: sans / serif.
- Focus-visible, `prefers-reduced-motion`, contrast ≥ 4.5:1.
- **Тест:** migration үл мэдэгдэх theme-ыг татгалзана; сонголт merge-д ялна; theme reload-д хадгалагдана.

## 7. Хамаарал ба эрсдэл

| Эрсдэл | Нөлөө | Бууруулах |
|---|---|---|
| `doc` хэмжээ өсөх | localStorage ~5MB, quota | Шинэ collection нэмэхгүй; `answers` лог хийхгүй |
| Migration алдаа | Хэрэглэгчийн өгөгдөл | `storage.ts` migration + `backup:v<n>` + тест |
| Theme-ийн өнгөний зөрчил | Харагдах чанар | CSS хувьсагч, Tailwind класс шууд солихгүй |
| PWA cache хуучирах | Schema зөрчил | Cache version = `SCHEMA_VERSION` |
| Ханзны MN контент 0 | Сургалтын чанар | `mq: draft` хэвээр, curated-ыг хүний хяналтаар |
| Dashboard тоолуур | Буруу сэтгэгдэл | 1-р ээлжид засах (өнөөдрийн лог) |

**Хамаарал:** 2.2 → 2.4 (нэгдсэн статистик); 2.5 → PWA (theme-ийг SW cache-д); Phase 3 (унших) → 2.4 (reading log).

## 8. Эхний milestone (2.1)-ийн хүлээн авах шалгуур

1. `npm test` — шинэ тестүүд ногоон (binary grading, XP нэг удаа, тохиргоо round-trip, migration v5).
2. `npm run typecheck`, `npm run build`, `npm run test:smoke` — ногоон.
3. `npm run data:validate` — 0 алдаа, 0 анхааруулга.
4. Гараар: 10 картын сесс, «мэднэ» → +Review, «мэдэхгүй» → +10 мин; хуудас reload хийсний дараа тохиргоо хэвээр.
5. Хуучин `nd:doc:*` (v4) өгөгдөл нээгдэж, `backup:v4` үүссэн байна.
6. Playwright E2E **хараахан байхгүй** — энэ milestone-д гараар шалгана (тусад нь тэмдэглэнэ).
