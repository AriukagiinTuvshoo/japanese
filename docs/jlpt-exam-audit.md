# JLPT Exam System Audit — Nihongo Dōjō

Огноо: 2026-11-04 · Салбар: `freebuff/…-87d45292` · Commit: `4e6c58c` дээр эхэлсэн
Стек: React 19 + Vite 7 + TypeScript 5.9 (SPA), Vercel static hosting, өгөгдөл `public/data/*.json`.

---

## 1. Тойм

Аудит нь **бодит кодыг** уншиж, бодит browser дээр давтан шалгаж хийгдсэн. Гурван том
асуудал батлагдсан:

1. **Бичих дасгал бүхэлдээ унадаг** (P0) — нэг зурлага татахад React component crash
   болж хуудас хоосордог.
2. **Backend огт байхгүй** (P1) — `src/lib/api.ts` бүх `/api/*` руу дууддаг ч сервер
   байхгүй: account, sync, admin, health бүгд `500`. `package.json`-ы `npm run server`
   скрипт байхгүй `server/index.mjs`-ыг заадаг байв.
3. **AI интеграц байхгүй** (P1) — Gemini, түлхүүрийн удирдлага, валидаци, UI бүгд дутуу.

---

## 2. Батлагдсан алдаанууд

### P0 — Бичих дасгал: StrokePad crash

| | |
|---|---|
| Файл | `src/components/StrokePad.tsx:119`, `src/lib/stroke.ts` |
| Илрэх | `#/write?level=N5` (мөн `#/kanji/日` → «Бичих дасгал») |
| Шинж тэмдэг | Эхний зурлага татмагц хуудас бүхэлдээ хоосорч, «reports an error» |
| Console | `TypeError: Cannot read properties of null (reading 'getBoundingClientRect')` |

**Давтах:** хуудсыг нээж, талбар дээр нэг шугам тат.

**Үндэс шалтгаан:** цэгийг React-ийн state updater **дотор** бодож байв:

```ts
setLive((l) => (l.length > 90 ? l : [...l, pos(e)]));   // pos(e) → e.currentTarget
```

React 19 updater-ыг render үед (handler буцасны дараа) дуудна. Тэр үед
`e.currentTarget` нь `null` болсон байдаг тул `getBoundingClientRect()` шидэж,
component бүхэлдээ unmount хийсэн.

**Засвар:** цэгийг handler дотор синхрон бодож, `liveRef`-д хадгална; updater зөвхөн
өмнө бодсон массивыг авна. `setPointerCapture` нь дэмжигдэхгүй орчинд try/catch.

**Тест:** `src/lib/stroke.test.ts` (17 тест) — хоосон талбар, 1 зурлага, олон зурлага,
буруу ханз, дараалал, илүү зурлага, NFKC нормчлол, зурлагын өгөгдөлгүй ханз.

### P1 — Хоосон талбар 15% оноо авдаг байв

`compareKanji()` хоосон зурлагын жагсаалтад `orderScore = 60` оноодог байсан тул
юу ч зураагүй ч 15% гарч, «0%» гэх шударга үр дүнгийн оронд төөрөгдүүлдэг.
Засвар: таарсан зурлага 0 бол дарааллын оноо 0.

### P1 — Backend бүхэлдээ дутуу

- `src/lib/api.ts` нь `/api/health`, `/api/auth/*`, `/api/sync*`, `/api/admin/*` гэж дууддаг.
- Репод `server/`, `api/` хавтас байхгүй → Vite dev дээр бүх дуудлага `500`,
  production (Vercel) дээр мөн `404/500`.
- AccountModal, Admin, sync тэдгээр endpoint-уудгүйгээр ажиллахгүй.

**Хийсэн:** AI-д шаардлагатай **хамгийн бага** серверийн давхарга нэмэв —
`api/exam/generate.ts` (Vercel function) + `server/index.mjs` (локал dev, ижил handler).
`/api/health` одоо ажиллана.

**Хийгээгүй (мэдэгдэж байгаа):** auth / sync / admin endpoint-ууд хараахан байхгүй.
Энэ нь тусад нь шийдэх шийдвэр (DB, session, нууц үг) шаарддаг тул энэ ажлын хүрээнд
зохиомол «ажиллаж байгаа мэт» сервер хийгээгүй.

### P1 — AI интеграц байхгүй

`package.json`-д SDK, `GEMINI_API_KEY`, prompt, схем, валидаци, UI — бүгд байхгүй.
Одоо: `@google/genai@2.32.0`, model `gemini-3.8-flash` (GA, 2026-09; `gemini-3.7-flash`
deprecated болж 3.8 руу автоматаар чиглэдэг), сервер талд л түлхүүр.

### P2 — Агуулгын хязгаарлалт (код биш, өгөгдөл)

- N1 ханзны монгол утга **0/1646**; N1 үг 600/3690, N5 715/1074, N4 630/1080.
- Сонсголын бодит аудио байхгүй (`content/listening.json` хоосон) — TTS.
- Уншлагын эх нийт 8.
- Жишээ өгүүлбэрийн орчуулга 0/13,718 (үг), 0/1,526 (дүрэм).

### P3 — Инженерийн цоорхой

- `lint` скрипт байхгүй; Playwright/E2E байхгүй (browser шалгалт гараар).
- Rate limit нь serverless instance тус бүрийн санах ойд — олон instance үед
  нийт хязгаар батлагдахгүй (production-д Redis/KV хэрэгтэй).

---

## 3. AI асуултын урсгал (хэрэгжсэн)

```
Browser (AiExamPanel)
  → POST /api/exam/generate  { level, section, count, avoid[], focus[] }
      · same-origin шалгалт (CSRF)
      · IP rate limit: 8 хүсэлт / 10 минут
      · body ≤ 8 KB, count ≤ 20, level/section whitelist
  → server/generate.ts
      · Gemini 3.8 Flash + responseSchema (JSON)
      · timeout 22с, дээд тал 2 оролдлого
  → src/lib/aiExam.ts (ижил валидатор клиент/сервер дээр)
      · 4 сонголт, давхардалгүй, зөв хариулт сонголт дотор
      · япон текст заавал, placeholder хориотой, тайлбар ≥15 тэмдэгт
      · ижил асуулт багцад давтахгүй
      · sourceType ҮРГЭЛЖ "ai_generated" (AI «албан ёсны» гэж шошголохыг хориглоно)
  → QuizRunner (reveal=true, тайлбартай дасгал)
```

Чанарын төлөв: `validated` / `needs_review` (жишээ нь тайлбар зөв хариултыг дурдаагүй) /
`rejected` (хэрэглэгчид харагдахгүй). `pending_validation` нь schema-д бэлэн.

**Хязгаарлалт (шударга):** валидаци нь бүтцийн түвшнийх — утга зүйн алдаа,
хоёр сонголт хоёулаа зөв байх боломж, JLPT түвшний нарийвчлалыг 100% батлах
боломжгүй. Тиймээс UI дээр «AI үүсгэсэн — албан ёсны JLPT асуулт БИШ» гэж
тогтмол харуулна.

---

## 4. Верификацийн төлөвлөгөө ба үр дүн

| Шалгалт | Үр дүн |
|---|---|
| `npm test` | 222 passed / 14 файл |
| `npm run typecheck` | exit 0 (server, api орсон) |
| `npm run build` | exit 0 |
| `npm run test:smoke` | pass |
| `npm run test:routes` | pass |
| `npm run data:validate` | OK, 0 анхааруулга |
| API: `/api/health` | 200 `{ok:true, ai:missing}` |
| API: key байхгүй | 503 + монгол мессеж (key задруулахгүй) |
| API: буруу body | 400 |
| API: GET | 405 |
| API: өөр Origin | 403 |
| API: rate limit | 8 → 429 |
| Browser: бичих | зурлага бүртгэгдэж, crash байхгүй, «Шалгах» хүртэл оноо гарахгүй |
| Browser: AI панель | 503 үед тохиргооны мессеж; stub хариултаар 4 сонголттой AI дасгал ачаалсан |
| Gemini live дуудлага | **шалгагдаагүй** — `GEMINI_API_KEY` байхгүй |

---

## 5. Deployment

Орчны хувьсагч (Vercel → Project → Settings → Environment Variables):

| Нэр | Заавал | Тайлбар |
|---|---|---|
| `GEMINI_API_KEY` | тийм (AI-д) | Google AI Studio-гийн түлхүүр. Client bundle-д ХЭЗЭЭ Ч орохгүй. |
| `GEMINI_MODEL` | үгүй | Анхдагч `gemini-3.8-flash`. |

Локал: `.env` файлд `GEMINI_API_KEY=...` (`.env.example`-ыг хуулна), дараа нь
`npm run server` (порт 8787) + `npm run dev` (Vite `/api`-г proxy хийнэ).

Түлхүүргүй үед AI панель 503 мессеж харуулна — энэ нь алдаа биш, хүлээгдэж буй төлөв.

**Зардлын тэмдэглэл:** Gemini 3.8 Flash нь free tier-тэй (тухайн үед үнэгүй, гэхдээ
free tier-ийн өгөгдөл бүтээгдэхүүн сайжруулахад ашиглагдана), paid tier нь
орох/гарах token-оор тооцогдоно. Google AI Pro захиалгад багтсан гэж **батлагдаагүй** тул
тийм мэдэгдэл хийхгүй. Хязгаар: 1 хүсэлт ≤ 20 асуулт, IP тутам 8/10 мин.
