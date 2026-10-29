# Nihongo Dōjō 道

Монгол хэл дээрх япон хэлний **JLPT N5 → N1** сургалтын платформ: кана, SRS үгийн сан, ханз (зураасны дараалал), дүрэм, түвшин тогтоох тест, жишиг шалгалт, хувийн төлөвлөгөө.

- Бүрэн **офлайн** ажиллана (PWA) — утсанд "Install" хийж болно
- Ахиц локал хадгалагдана; сервер байвал синк хийнэ (талбар бүрийн merge дүрэм: `docs/SYNC.md`)
- **Уншлага / Сонсгол** одоогоор агуулгын улмаас default OFF флагаар нуусан — `docs/FEATURE_GAPS.md`

## Ажиллуулах
```bash
npm ci
npm run dev          # http://localhost:5173
npm run build        # typecheck + production build
npm test             # vitest (unit + property тестүүд)
npm run test:routes  # маршрут баталгаажуулалт
npm run data:validate
npm run test:e2e     # Playwright: офлайн/шинэчлэл/guest merge/import (e2e/README.md)
```

## Нийтлэх (GitHub Pages)
1. GitHub → Settings → Pages → Source: **GitHub Actions**
2. `main` руу push хийхэд `.github/workflows/deploy.yml` автоматаар build + deploy хийнэ
3. Сайт: `https://<username>.github.io/japanese/`

Өөр домэйн/root дээр байрлуулбал `BASE_PATH=/ npm run build`.

## Лиценз ба attribution

Контент нь дараах нээлттэй эх сурвалжаас бүрдэнэ (дэлгэрэнгүйг апп дотор **About** хуудаснаас үзнэ үү):

| Эх сурвалж | Лиценз | Юунд |
|---|---|---|
| [JMdict](https://www.edrdg.org/jmdict/j_jmdict.html) | CC BY-SA 4.0 | үгийн утга, уншлага |
| [KANJIDIC2](https://www.edrdg.org/wiki/index.php/KANJIDIC_Project) | CC BY-SA 4.0 | ханзны утга, уншлага, радикал |
| [KanjiVG](https://kanjivg.tagaini.net/) | CC BY-SA 3.0 | зураасны дараалал |
| [Tatoeba](https://tatoeba.org) | CC BY 2.0 FR | жишээ өгүүлбэр |
| [OpenJLPT](https://github.com/evanclan/OpenJLPT) | CC BY-SA 4.0 | JLPT түвшний жагсаалт |
| [JLPT lists — J. Waller](https://www.tanos.co.uk/jlpt/) | CC BY | нэмэлт жагсаалт |

Фонт: Manrope, Noto Sans JP, Noto Serif JP, JetBrains Mono — бүгд **SIL OFL 1.1**, локал
woff2 болгож тасласан (`npm run fonts:build`, дэлгэрэнгүй: `src/assets/fonts/README.md`).

### Монгол орчуулгын төлөв

Монгол орчуулга нь англи утгаас **машин тусламжтайгаар** гаргасан бөгөөд хүн хянаагүй.
Тиймээс `content policy` дахь төлөв нь `auto` / `draft` бөгөөд `curated` (хүн баталгаажуулсан)
нь **0** байна. "Орчуулга 100%" гэдэг нь "бөглөгдсөн" гэсэн үг, "чанар батлагдсан" гэсэн үг биш.
`npm run data:validate` нь meta.json дахь эдгээр тоог өгөгдөлтэй тулгаж шалгана.
