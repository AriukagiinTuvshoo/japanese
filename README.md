# Nihongo Dōjō 道

Монгол хэл дээрх япон хэлний **JLPT N5 → N1** сургалтын платформ: кана, SRS үгийн сан, ханз (зураасны дараалал), дүрэм, уншлага, сонсгол, түвшин тогтоох тест, жишиг шалгалт, хувийн төлөвлөгөө.

- Бүрэн **офлайн** ажиллана (PWA) — утсанд "Install" хийж болно
- Ахиц локал хадгалагдана; сервер байвал синк хийнэ

## Ажиллуулах
```bash
npm ci
npm run dev          # http://localhost:5173
npm run build        # typecheck + production build
npm run test:routes
npm run data:validate
```

## Нийтлэх (GitHub Pages)
1. GitHub → Settings → Pages → Source: **GitHub Actions**
2. `main` руу push хийхэд `.github/workflows/deploy.yml` автоматаар build + deploy хийнэ
3. Сайт: `https://<username>.github.io/japanese/`

Өөр домэйн/root дээр байрлуулбал `BASE_PATH=/ npm run build`.
