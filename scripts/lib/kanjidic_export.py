#!/usr/bin/env python3
"""
KANJIDIC2 (jamdict SQLite) → ханз бүрийн классик (Канги-214) зурлагын тоо.

Эх сурвалж: jamdict_data багцийн доторх KANJIDIC2 —
    character  (13,108 мөр: literal, stroke_count, grade, freq, jlpt)
    radical    (cid, rad_type, value)  ← value = Кангийн зурлагын дугаар

Зорилго: `public/data/kanji/*.json`-д 390 ханзны `rad` талбар хоосон байсан
(OpenJLPT-ийн жагсаалтад байхгүй тул тэндээс зураг авч чадахгүй). KANJIDIC2-ийн
`classical` зураг нь 214 Кангийн зурлагийн дугаар бөгөөд Unicode-ийн
"KANGXI RADICALS" блок (U+2F00 + n − 1) рүү `NFKC` нормализаци хийвэл бүтэн
хэлбэрийн ханз болдог — жишээ нь 118 → ⽵ → 竹.

Баталгаа: манай одоогийн өгөгдөлд OpenJLPT-аас ирсэн 2,383 зурагтай энэ
нэгтгэлийг (Кангийн дугаар → ханз) харьцуулахад **2,381 (99.9%)** тохирч,
зөрүүтэй 2 нь сан толь бүрд зурлагаа өөрөө тэмдэглэсэн тохиолдол ( 曽, 巣 ).

Гаралт (build-data.mjs ушина):
    {
      "_meta": { source, license, rule, generatedAt, ... },
      "radicals": { "菱": 140, "柏": 75, ... }
    }

Дугаар байхгүй эсвэл 1–214-ийн хязгаарас гадуур бол тухайн ханзийг
алгасана — **таамаглахгүй**, дутуу хэсэг нь тайлан (needs-review) үлдэнэ.

Ажиллуулах:  python3 scripts/lib/kanjidic_export.py
"""
import json
import os
import sqlite3
import sys
from datetime import datetime, timezone

# Windows консол cp932 үед кирилл/япон мөр алдаа өгдөг тул UTF-8 болгоно.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
CACHE = os.path.join(ROOT, ".cache", "sources")

DB = os.path.join(CACHE, "jamdict-data", "jamdict.db")
OUT = os.path.join(CACHE, "jamdict-data", "kanji-radicals.json")

SOURCE = "KANJIDIC2 (via jamdict_data)"
LICENSE = "CC BY-SA 3.0 (EDRDG)"
URL = "https://www.edrdg.org/"
RULE = "rad_type='classical' value (Кангийн дугаар 1–214) → String.fromCodePoint(0x2F00+n-1).normalize('NFKC')"


def main() -> int:
    if not os.path.exists(DB):
        print(f"✗ {DB} олдсонгүй — эхлээд `npm run data:fetch` ажиллуулна уу")
        return 1

    db = sqlite3.connect(DB)
    rows = db.execute(
        "SELECT c.literal, r.value FROM character c "
        "JOIN radical r ON r.cid = c.ID "
        "WHERE r.rad_type = 'classical'"
    ).fetchall()
    db.close()

    radicals = {}
    skipped = 0
    for literal, value in rows:
        if not literal or len(literal) != 1:
            continue
        try:
            n = int(str(value).strip())
        except (TypeError, ValueError):
            skipped += 1
            continue
        if not 1 <= n <= 214:
            skipped += 1
            continue
        # хэд хэдэн classical мөр байвал анхныхыг хадгална
        radicals.setdefault(literal, n)

    payload = {
        "_meta": {
            "source": SOURCE,
            "license": LICENSE,
            "homepage": URL,
            "rule": RULE,
            "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "count": len(radicals),
            "skipped": skipped,
        },
        "radicals": dict(sorted(radicals.items())),
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, separators=(",", ":"))

    print(f"✓ kanji-radicals.json: {len(radicals)} ханз (алгассан {skipped}) → {os.path.relpath(OUT, ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
