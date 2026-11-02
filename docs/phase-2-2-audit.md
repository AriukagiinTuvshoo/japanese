# Phase 2.2 — QUIZ DASHBOARD AUDIT

Огноо: 2026-11-02
Branch: `freebuff/role-you-are-a-principal-engineer-product-lead-jap-87d45292-7f30-4486-b9e3-0c284d722511`
HEAD: `4a740c1577a77ce3f0034a8cbe7d0c3cc6e0cb20` (Phase 2.1: `0fd1b87`)
Хамрах хүрээ: Quiz Dashboard ба quiz тохиргооны хадгалалт. Энэ баримт нь **зөвхөн аудит** — production код, тест, өгөгдөл өөрчлөгдөөгүй.

---

## 0. Шалгасан файлууд

| Файл | Юу шалгасан |
|---|---|
| `src/pages/Quiz.tsx` (169 мөр) | горим сонголт, тоо, `weakKinds`, `start()` |
| `src/components/QuizRunner.tsx` (412 мөр) | `finish()`, `logQuiz`, mistakes, ResultView |
| `src/pages/MockExam.tsx` (311 мөр) | `QuizRunner` options, `recordExam` |
| `src/pages/Home.tsx` (485 мөр) | `weak` тооцоо, dashboard |
| `src/pages/Progress.tsx` (334 мөр) | `weakKinds`, `perLevel`, history |
| `src/lib/stats.ts` (74 мөр) | `accuracy`, `kindAccuracy`, `examSectionAccuracy`, `weakestAreas` |
| `src/lib/doc.ts` (165 мөр) | `QuizRecord`, `ExamRecord`, `Profile`, `SCHEMA_VERSION` |
| `src/lib/store.tsx` (633 мөр) | `logQuiz`, `recordExam`, `bumpDayInto` |
| `src/lib/storage.ts` (551 мөр) | `normalizeQuizzes`, `mergeDocs` |
| `src/lib/study.ts` | `QUIZ_MODES`, `buildQuiz` (weak/mistakes) |
| `src/lib/gamification.ts` | `XP` тогтмолууд |
| `src/lib/stats.test.ts` | одоогийн 10 тест |

---

## 1. Боломж тус бүрийн дүгнэлт

### 1.1 Quiz төрөл тус бүрийн нарийвчлал — **PARTIAL (өгөгдлийн түлхүүр BROKEN)**

Байгаа: `stats.kindAccuracy(quizzes)` (`stats.ts:44-46`) → Progress-ийн «Сул тал → 分野別» блок (`Progress.tsx:250-266`) `%` ба нийт асуултын тоог харуулна.

Асуудал: `QuizRecord.kind`-д **тогтвортой id биш, тухайн хэлний харуулах шошго** хадгалагдана.

- `QuizRunner.tsx:70-75` — `kind: options.title ?? q?.kind ?? "quiz"`
- `Quiz.tsx:76` — `title: QUIZ_MODES.find(...).label` (mn) эсвэл `labelEn` (en)
- `Progress.tsx:255` — `QUIZ_MODES.find((q) => q.id === w.kind)` → **үргэлж `undefined`**, тул mn шошго англи UI дээр түүхээр хэвээр харагдана.
- Хэл солиход `kind` мөр өөр болж (`"Япон → Монгол"` vs `"Japanese → English"`) нэг горим хоёр тусдаа бүлэг болж хуваагдана.

→ Нарийвчлал ХАРАГДАЖ байна, гэхдээ түлхүүр нь тогтворгүй тул бүлэглэлт, орчуулга, weak холболт бүгд эвдэрхий.

### 1.2 JLPT түвшин тус бүрийн статистик — **MISSING**

- `QuizRecord.level` (`doc.ts:40-48`) бичигддэг (`QuizRunner.tsx:72`) боловч **UI-д хаана ч ашиглагдахгүй** (grep: `.quizzes` → зөвхөн Home/Quiz/Progress-weak/store/storage).
- Progress-ийн «Түвшин» таб (`Progress.tsx:176-215`) зөвхөн SRS/grammar-аас бодно: `vMastered`, `kMastered`, `gDone`. Quiz/шалгалтын нарийвчлал түвшинд хуваагдахгүй.

### 1.3 Quiz тохиргоо хадгалах — **PARTIAL**

- Түвшин, горим нь **URL query**-д (`Quiz.tsx:20-22`, `set({ level })` / `set({ mode })`) → reload-д үлдэнэ, гэхдээ навигацийн төлөв.
- Асуултын тоо нь зөвхөн `useState(15)` (`Quiz.tsx:24`) → **reload/буцахад алга болно**.
- `Profile`-д (`doc.ts:64-83`) quiz-ийн тохиргооны талбар байхгүй; зөвхөн `session` (флашкарт) бий.

### 1.4 Асуултын тоо, горим, чиглэл — **EXISTS**

- Тоо: `Quiz.tsx:95` (10/15/20/30/50), `start()`-д `count`.
- Горим: `QUIZ_MODES` (`study.ts:70-78`) 8 горим + `mixed` / `weak` / `mistakes`.
- Чиглэл нь горим дотор кодлогдсон (`vocab-jp-mn` vs `vocab-mn-jp`), тусад нь тохиргоо байхгүй — энэ нь зөв загвар.

### 1.5 Алдаатай асуултаар дахин дасгал — **EXISTS (боловч хэсэгчилсэн)**

- `Quiz.tsx:127-146` — mistakes карт, `start("mistakes")`.
- `buildQuiz` (`study.ts:376-386`) — `mistakeIds`-ээр шүүж, id-аар нь `vocab`/`kanji`/`grammar` руу буулгана.
- `QuizRunner.tsx:79-98` — алдсаныг `addMistakes`, зөвийг `resolveMistake`.
- Хязгаарлалт: `count = Math.max(5, doc.mistakes.length)` (`Quiz.tsx:44`) — 5-аас доош алдаатай үед 5 асуулт гуйж, боломжит бүх алдааг л өгнө (алдаа биш, гэхдээ тодорхой бус).
- `Mistake.id = refId ?? refKanji ?? q.id` (`QuizRunner.tsx:82`) — grammar/reading асуултад `refId` байхгүй бол `q.id` (асуултын id) болж, дараагийн удаа өөр асуултын id-тай таарахгүй → «дахин дасгал»-д тэр алдаа орно, гэхдээ `resolveMistake` таарахгүй байж болно.

### 1.6 Weak areas статистиктай холбогдсон эсэх — **BROKEN**

Гурван газар гурван өөр дүрмээр бодож, нэг нь ч нөгөөтэйгөө нийцэхгүй:

| Газар | Эх сурвалж | Цонх | Босго |
|---|---|---|---|
| `Home.tsx:46-58` | `doc.quizzes` | сүүлийн 20 | `total >= 5` |
| `Quiz.tsx:30-37` | `doc.quizzes` | сүүлийн 30 | `total >= 8` |
| `Progress.tsx:46` | `stats.weakestAreas` | бүгд + exams | `minQuestions = 3` |

Мөн `Quiz.tsx:30-37`-ийн гаргасан `weakKinds` нь **шошго** (жишээ нь `"Япон → Монгол"`), харин `buildQuiz` (`study.ts:321-323`) **id** хүлээж авна → `realModes` буруу утга авна, `weak` горим бараг үргэлж `["vocab-jp-mn","grammar-mn"]` руу унана. Хэрэглэгчийн бодит сул тал дасгалд орохгүй.

### 1.7 Home Dashboard ижил өгөгдөл ашиглаж байгаа эсэх — **BROKEN (давхардсан тооцоо)**

- Home «Сул тал» картууд нь `stats.ts`-ийг **ашиглахгүй**, өөрөө map/reduce хийнэ (`Home.tsx:46-58`), өөр цонх/босго.
- Үр дүнд: Progress дээр «Уншлага 42%» гэж харагдах зүйл Home дээр огт гарахгүй (эсвэл эсрэгээр) — «зөрчилдсөн статистик» (энэ нь `stats.ts`-ийн толгойн тайлбарт (`stats.ts:1-6`) зайлсхийх гэж бичсэн зүйл).
- Home-ийн `reviewAccuracy` нь SRS-ийн `memoryStats.accuracy` (`Home.tsx:295-297`) — quiz-ийн нарийвчлал биш, зөв.

### 1.8 Quiz дууссан түүх — **MISSING**

- `doc.quizzes` (200 хүртэл бичлэг, `store.tsx:355`) хадгалагддаг ч **ямар ч хуудас жагсаалт болгон харуулахгүй**.
- Progress «Түүх» таб (`Progress.tsx:274-297`) зөвхөн өдрийн хүснэгт + `doc.exams` (жишиг шалгалт) харуулна.
- `Account.tsx` мөн quiz түүх харуулахгүй.

### 1.9 Reload болон tab хоорондын хадгалалт — **PARTIAL**

- `doc` нь `localStorage`-д debounce-тай бичигдэж (`store.tsx:174-190`), `storage` event-ээр merge хийгдэнэ (`store.tsx:209`, `mergeDocs` `storage.ts:494-499`) → quiz **үр дүн** табуудын хооронд нийлнэ.
- Харин quiz **UI тохиргоо** (count) таб/reload хооронд хадгалагдахгүй (`Quiz.tsx:24`).
- `mergeDocs`-ийн quiz түлхүүр нь `${at}|${kind}|${level}|${total}` — `kind` шошгоор солигдвол ижил оролдлого хоёр удаа bүртгэгдэж болно (1.1-тэй холбоотой).

### 1.10 Хуучин хэрэглэгчийн өгөгдөлтэй нийцтэй эсэх — **PARTIAL**

- `normalizeQuizzes` (`storage.ts:230-245`) нь дутуу/хог талбарыг аюулгүй болгоно: `kind` — `str(q.kind, "quiz").slice(0, 40)`, `level` буруу бол бичлэгийг хаяна, `total` сөрөг бол 0. Тестээр хамгаалагдаагүй.
- Гэхдээ хуучин бичлэгийн `kind` нь **шошго** хэвээр үлдэх тул шинэ id-тэй холилдоно (1.1).
- `SCHEMA_VERSION = 4` (`doc.ts:13`) — Phase 2.1-ийн `profile.session` шиг `profile`-д талбар нэмэхэд migration шаардлагагүй (нотолгоо: Phase 2.1-д v4 баримт өөрчлөлтгүй ачаалагдсан).

---

## 2. Давхардал ба алдаа (нэн тэргүүний)

### 2.1 `kind` түлхүүр = орчуулагдсан шошго → бүх бүлэглэл эвдэрдэг
`Quiz.tsx:76` → `QuizRunner.tsx:70-75` → `storage.ts:237` → `Progress.tsx:255`, `Quiz.tsx:31-37`.
**Нөлөө:** weak холболт ажиллахгүй, хэл солиход статистик хуваагдана, бүлгийн нэр орчуулагдахгүй.

### 2.2 Жишиг шалгалтын хэсгүүд quiz болж бүртгэгдэж, XP/accuracy **давхарлана**
- `MockExam.tsx:215-228` (title нь `:221`) — `title: "${bp.title} · ${section.name}"` бүхий `QuizRunner`.
- `QuizRunner.finish` (`:70-77`) **үргэлж** `logQuiz` дуудна → хэсэг бүр `doc.quizzes`-д шалгалтын шошготой бичлэг болно.
- Дараа нь `MockExam.tsx:65-75` → `recordExam` (`store.tsx:359-371`).
- Дүн:
  - XP: `logQuiz` = `correct × 4` (`XP.quizCorrect`, `gamification.ts:94`) **нэмээд** `examQuestion × total` (+`examPass 120`) → N5-ийн 60 асуулттай шалгалтад ойролцоогоор **4×зөв + 60 (+120)** болж хэт өснө.
  - Өдрийн нарийвчлал: `bumpDayInto` хоёр удаа `correct/total` нэмнэ (`store.tsx:356`, `:368`) → шалгалттай өдрийн accuracy давхар жинтэй.
  - `min` мөн давхар нэмэгдэнэ.
- `weakestAreas` (`stats.ts:58-73`) quiz ба exam хэсгийг нэгтгэхдээ **нэг шалгалтыг хоёр удаа** тоолно (шошго ялгаатай тул хоёр мөр болно): «模擬 N5 · Уншлага» ба «Уншлага».

### 2.3 Гурван давхардсан weak тооцоо
§1.6/1.7 — Home, Quiz, Progress. `stats.ts` бий атлаа Home/Quiz түүнийг тойрч гарна.

### 2.4 Accuracy denominator
`kindAccuracy`/`weakestAreas` нь `total`-оор хувааж, `correct > total`-ыг хязгаарлана (`stats.ts:17-21`, `:33`) — зөв. `dayAccuracy` мөн зөв (`:22-26`).
`ResultView.bySection` (`QuizRunner.tsx:246-255`) нь `Math.max(1, v.total)`-оор хуваадаг — асуултгүй хэсэг 0% болно, гэхдээ хэсэг үргэлж ≥1 асуулттай тул практик алдаа биш.
**Буруу denominator олдсонгүй**; асуудал нь denominator биш, **давхар нэмэгдэх** (2.2).

### 2.5 Хуучин/шинэ тохиргооны зөрчил
`profile.session` (флашкарт) шинэ, quiz тохиргоо `useState` — нэг профайлд нэг нь хадгалагдаж нөгөө нь хадгалагдахгүй нь хэрэглэгчид ойлгомжгүй.

### 2.6 Reload үед тохиргоо алдагдах
§1.3 — зөвхөн `count`.

### 2.7 Quiz болон Exam статистик холилдох
§2.2 — бүрэн баталгаажсан.

### 2.8 Бага зэргийн
- `QuizRunner.finish`-д давхар дуудалтын хамгаалалт байхгүй (`:64-100`); «Дуусгах»-ыг хурдан хоёр удаа дарахад хоёр бичлэг/XP үүсэх онолын боломж. Session-д Phase 2.1-д `makeOnce` нэмсэн — энд ижил арга хэрэглэж болно.
- `Mistake.id` grammar/reading-д тогтворгүй (§1.5).

---

## 3. Phase 2.2-д зайлшгүй хийх (must)

1. **`kind`-ийг тогтвортой id болгох** (`vocab-jp-mn`, `kanji-read`, …). Харуулах шошгыг `QUIZ_MODES`-оос гаргана.
2. **Шалгалтын хэсгийг quiz болж бүртгэхээ болих** — `RunnerOptions`-д `log?: boolean` (default `true`), `MockExam` `log: false`. Ингэснээр XP/accuracy давхардал арилна.
3. **Legacy `kind`-ийг normalize-д буулгах** — mn/en шошго → id газрын зураг `normalizeQuizzes`-д (idempotent, schema bump **хэрэггүй**).
4. **Нэг эх сурвалж** — Home болон Quiz-ийн `weakKinds`-ыг `stats.ts`-ийн функцээр солих (шинэ систем биш, байгаа `kindAccuracy`/`weakestAreas`-ийг өргөтгөх).
5. **Quiz тохиргоог профайлд хадгалах** — `profile.quiz = { count }` (Phase 2.1-ийн `profile.session` загвараар; default-оор нөхөгдөнө).
6. **Quiz түүхийн хамгийн бага харагдац** — Progress-ийн «Түүх» табд `doc.quizzes.slice(0, 20)` (огноо, горим, оноо, минут). Шинэ collection биш.

## 4. Дараагийн шатанд үлдээх (later)

- Түвшин тус бүрийн quiz нарийвчлалын бүрэн dashboard (Phase 2.3 «per-level» хамт).
- Quiz тохиргоонд `level`-ыг профайлд хадгалах (одоо URL хангалттай).
- `Mistake.id`-ийг grammar/reading-д тогтвортой болгох (Phase 2.4 mistakes overhaul).
- QuizRunner-ийн `finish`-д `makeOnce` (Phase 2.1-ийн хэв маяг) — зөвхөн баталгаатай давхар дуудалт илэрвэл.
- `mergeDocs`-ийн quiz түлхүүрийг `at|kind|level|total`-аас илүү тогтвортой (жишээ нь `at`+kind) болгох — энэ нь 1-р зүйлээр автоматаар сайжирна.

---

## 5. Хамгийн бага эрсдэлтэй архитектур

```
Quiz.tsx ──(mode id)──▶ QuizRunner.logQuiz({kind: modeId})   ← тогтвортой id
MockExam.tsx ──QuizRunner(log:false)──▶ recordExam(...)      ← нэг л бүртгэл
                                   │
                    doc.quizzes / doc.exams (өөрчлөлтгүй)
                                   │
                         stats.ts (цэвэр функцууд)
                    ├── kindAccuracy      → Progress «分野別», Home «Сул тал»
                    ├── weakestAreas      → Progress, Quiz weakKinds
                    └── (шинэ) quizLevelAccuracy → §1.2 (дараа)
```

- **Шинэ collection байхгүй**, **шинэ SRS/статистикийн систем байхгүй** — зөвхөн одоогийн `doc.quizzes`, `doc.exams`, `stats.ts`.
- `QuizRecord`-ийн **хэлбэр өөрчлөгдөхгүй** (`kind` утгын утга л өөрчлөгдөнө).
- `Profile`-д нэмэх талбар нь default-оор нөхөгдөх тул `SCHEMA_VERSION = 4` хэвээр.

## 6. Өөрчлөх файлууд (Phase 2.2-ын хэрэгжүүлэлтэд)

| Файл | Өөрчлөлт |
|---|---|
| `src/components/QuizRunner.tsx` | `RunnerOptions.log?`, `kind?`; `logQuiz({ kind: options.kind ?? q.kind })`; `log === false` үед алгасах |
| `src/pages/Quiz.tsx` | `kind: m` дамжуулах; `weakKinds`-ыг `stats`-аар; `count`-ыг `profile.quiz.count`-аас |
| `src/pages/MockExam.tsx` | `log: false` |
| `src/pages/Home.tsx` | `weak` тооцоог `stats.kindAccuracy`-аар солих |
| `src/lib/stats.ts` | `quizKindLabel` туслах эсвэл `kindAccuracy`-д шошго буулгах (шинэ тооцоо биш) |
| `src/lib/storage.ts` | `normalizeQuizzes`-д legacy шошго → id; `normalizeProfile`-д `quiz` |
| `src/lib/doc.ts` | `QuizPrefs { count }`, `Profile.quiz`, `DEFAULT_PROFILE.quiz` |
| `src/lib/i18n.ts` | түүхийн гарчиг/шошго (mn/en) |

**Migration:** шинэ `SCHEMA_VERSION` **шаардлагагүй**. `profile.quiz` default-оор нөхөгдөнө (Phase 2.1-ийн батлагдсан зам). Legacy `kind`-ийг `normalizeQuizzes` дотор шууд буулгана — унших бүрт ижил үр дүн (idempotent).

**Failing-first тестүүд (Phase 2.2-ын эхэнд бичих):**

1. `stats.test.ts`: `kindAccuracy([quiz("Япон → Монгол", …), quiz("vocab-jp-mn", …)])` → нэг бүлэг болно.
2. `stats.test.ts`: `weakestAreas` нь шалгалтын хэсгийг **нэг удаа** тоолно (quiz бичлэг давхар байхгүй үед).
3. `storage.test.ts`: legacy `kind: "Ханзны уншлага"` → `"kanji-read"`; дахин normalize хийхэд өөрчлөлтгүй.
4. `storage.test.ts`: `profile`-д `quiz` байхгүй v4 баримт → `{ count: 15 }` авна, `v` 4 хэвээр, backup үүсэхгүй.
5. Шинэ `quiz.test.ts` (цэвэр функц): `quizLogKind(mode)` → id; `log:false` үед `logQuiz` дуудагдахгүй (runner-ыг тусгаарлах боломжгүй бол `buildQuiz`-ийн `realModes` weak-id тест).
6. `study.test.ts`: `buildQuiz({mode:"weak"}, { weakKinds: ["kanji-read"] })` → зөвхөн kanji уншлагын асуулт.

## 7. Regression risk

| Эрсдэл | Түвшин | Хамгаалалт |
|---|---|---|
| Хуучин `kind` шошго → id буулгалт буруу | Дунд | normalize тест + `QUIZ_MODES`-оос генерих map |
| `log:false`-аар шалгалтын XP буурсан мэт санагдах | Бага | `recordExam`-ийн XP хэвээр; өдрийн accuracy нэг л удаа → **зөв** болно |
| Home-ийн weak карт өөрчлөгдөж хэрэглэгчид «өөр» санагдах | Бага | Progress-тай ижил босго (3) — зөрчил арилна |
| `profile.quiz` merge | Бага | `mergeDocs`-д профайлыг аль хэдийн сонгодог; талбар нэмэхэд задардаггүй |
| QuizRunner-ийн бусад дуудагч | Бага | Зөвхөн `Quiz.tsx`, `MockExam.tsx` |

## 8. Acceptance criteria (Phase 2.2)

1. Quiz дуусгасны дараа `doc.quizzes[0].kind` нь `QUIZ_MODES`-ийн id (жишээ нь `vocab-jp-mn`), хэл солиход өөрчлөгдөхгүй.
2. Progress «分野別» болон Home «Сул тал» ижил эх сурвалж, ижил босго ашиглана; нэг горим нэг мөр.
3. Жишиг шалгалт дуусгахад `doc.quizzes`-д **нэмэгдэхгүй**, зөвхөн `doc.exams` +1; өдрийн `correct/total` нэг л удаа нэмэгдэнэ; XP нь `total×1 (+120 pass)`.
4. Сургалтын quiz: XP = `зөв × 4`, `min` нэг удаа.
5. Quiz-ийн асуултын тоо reload/буцаалтын дараа хэвээр (`profile.quiz.count`).
6. Progress «Түүх» табд сүүлийн quiz-ууд (огноо, горим, оноо, минут) харагдана.
7. v4 баримт (quiz бичлэг + legacy шошготой) өөрчлөлтгүй ачаалагдаж, `quizzes` бүрэн хадгалагдана; `v` 4 хэвээр; backup үүсэхгүй; хоёр дахин normalize хийхэд ижил.
8. `npm test`, `typecheck`, `build`, `test:smoke`, `data:validate` бүгд PASS.

---

## 9. Git төлөв (аудитын дараа)

- Branch: `freebuff/role-you-are-a-principal-engineer-product-lead-jap-87d45292-7f30-4486-b9e3-0c284d722511`
- HEAD: `4a740c1577a77ce3f0034a8cbe7d0c3cc6e0cb20`
- Өөрчлөгдсөн файл: `docs/phase-2-2-audit.md` (шинэ, untracked)
- Production код, тест, өгөгдөл: **өөрчлөлтгүй**; commit/push хийгээгүй.
