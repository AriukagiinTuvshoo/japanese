#!/usr/bin/env python3
"""
JMdict (jamdict SQLite) → «өргөтгөсөн үгийн сан»-ы нэр дэвшигчдийг экспортлох.

OpenJLPT нь JLPT-ийн албан ёсны N5–N1 түвшинтэй 7,811 үг өгдөг. Гэвч
жинхэнэ суралцагчид N1 хүртэл 10,000+ үг хэрэгтэй. Энэ скрипт нь:

  1. JMdict-ийн бүх бичлэгээс зөвхөн «энгийн хэрэглээний» үгсийг шүүнэ
     (Jōyō/JLPT ханзан дахь, нийтлэг POS, архаик/ховор биш)
  2. Тэдгээрийг эрэмбэлэх дохио гаргана:
       · in_examples — JLPT жишээ өгүүлбэрт тохиолдсон эсэх (хамгийн хүчтэй)
       · kanji_freq  — бүрдүүлж буй ханзны давтамжийн зэрэглэл
       · length      — үгийн урт
  3. JSON болгон .cache/sources/jamdict-data/candidates.json-д бичнэ.

Энэ нь «зохиосон» өгөгдөл биш: бичлэг бүр нь JMdict-ийн бодит
ent_seq дугаартай бөгөөд эх сурвалж нь бүртгэгдэнэ.
"""
import json
import os
import re
import sqlite3
import sys
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
CACHE = os.path.join(ROOT, ".cache", "sources")

DB = os.path.join(CACHE, "jamdict-data", "jamdict.db")
KANJI_DATA = os.path.join(CACHE, "kanji-data", "kanji.json")
OPENJLPT = os.path.join(CACHE, "openjlpt", "data", "json")
OUT = os.path.join(CACHE, "jamdict-data", "candidates.json")

# Нийтлэг хэрэглээнд тохирох японы үгсийн хэсэг хэл (POS).
# jamdict нь POS-ыг бүтэн тайлбар хэлбэрээр хадгалдаг тул товч кодыг
# гол хэлхээс (substring) тааруулж гаргана.
POS_MAP = [
    ("noun or participle which takes the aux. verb suru", "vs"),
    ("suru verb - included", "vs-i"),
    ("suru verb - special class", "vs-s"),
    ("Ichidan verb", "v1"),
    ("Kuru verb - special class", "vk"),
    ("Godan verb with 'u' ending", "v5u"),
    ("Godan verb with 'ku' ending", "v5k"),
    ("Godan verb with 'gu' ending", "v5g"),
    ("Godan verb with 'su' ending", "v5s"),
    ("Godan verb with 'tsu' ending", "v5t"),
    ("Godan verb with 'nu' ending", "v5n"),
    ("Godan verb with 'bu' ending", "v5b"),
    ("Godan verb with 'mu' ending", "v5m"),
    ("Godan verb with 'ru' ending", "v5r"),
    ("Godan verb - Iku/Yuku special class", "v5k-s"),
    ("Godan verb", "v5"),
    ("irregular ru verb", "v5r-i"),
    ("irregular nu verb", "vn"),
    ("noun (common) (futsuumeishi)", "n"),
    ("adjectival nouns or quasi-adjectives (keiyodoshi)", "adj-na"),
    ("adjective (keiyoushi) - yoi/ii class", "adj-ix"),
    ("adjective (keiyoushi)", "adj-i"),
    ("nouns which may take the genitive case particle 'no'", "adj-no"),
    ("pre-noun adjectival (rentaishi)", "adj-pn"),
    ("'taru' adjective", "adj-t"),
    ("noun or verb acting prenominally", "adj-f"),
    ("adverb taking the 'to' particle", "adv-to"),
    ("adverb (fukushi)", "adv"),
    ("auxiliary adjective", "aux-adj"),
    ("auxiliary verb", "aux-v"),
    ("auxiliary", "aux"),
    ("conjunction", "conj"),
    ("interjection (kandoushi)", "int"),
    ("counter", "ctr"),
    ("expressions (phrases, clauses, etc.)", "exp"),
    ("pronoun", "pn"),
    ("noun, used as a prefix", "n-pref"),
    ("noun, used as a suffix", "n-suf"),
    ("prefix", "pref"),
    ("suffix", "suf"),
    ("numeric", "num"),
    ("transitive verb", "vt"),
    ("intransitive verb", "vi"),
    ("particle", "prt"),
    ("copula", "cop"),
]
POS_OK = {c for _, c in POS_MAP}

# Хэрэглэгчид хэрэггүй / тохиромжгүй тэмдэглэгээнүүд (архаик, ховор, нэр г.м.).
MISC_BAD = {
    "Internet slang", "abbreviation", "archaism", "children's language",
    "dated term", "derogatory", "full name of a particular person",
    "historical term", "manga slang", "obscure term", "obsolete term",
    "place name", "poetical term", "quotation", "rare", "slang",
    "vulgar expression or word",
    "work of art, literature, music, etc. name",
}
ARCHAIC_POS_HINT = ("archaic", "Nidan verb", "Yodan verb", "'ku' adjective", "'shiku' adjective", "su verb")


def pos_codes(labels):
    """Тайлбар хэлхээнүүдийг JMdict-ийн товч POS код руу хөрвүүлнэ."""
    out = set()
    for lab in labels:
        if any(h in lab for h in ARCHAIC_POS_HINT):
            continue
        for needle, code in POS_MAP:
            if needle in lab:
                out.add(code)
                break
    return out

MISC_CANON = {}  # jamdict нь аль хэдийн бүтэн тайлбар хэлбэрээр хадгалдаг
KANA_RE = re.compile(r"^[\u3041-\u3096\u309d\u309e\u30a1-\u30fa\u30fc\u30fd\u30feー]+$")


def load_allowed_kanji():
    """Jōyō (2136) ∪ JLPT ханз ∪ нийтлэг хэрэглээний ханз."""
    allowed = set()
    kd = json.load(open(KANJI_DATA, encoding="utf8"))
    for ch, info in kd.items():
        grade = info.get("grade")
        freq = info.get("freq")
        if grade is not None and grade <= 8:      # 1–6 = бага/дунд сургууль, 8 = Jōyō нэмэлт
            allowed.add(ch)
        elif info.get("jlpt_new"):
            allowed.add(ch)
        elif freq and freq <= 3000:
            allowed.add(ch)
        elif info.get("wk_level"):
            allowed.add(ch)
    # OpenJLPT-д гарсан бүх ханз
    for lv in ("n5", "n4", "n3", "n2", "n1"):
        p = os.path.join(OPENJLPT, "kanji", f"{lv}.json")
        if os.path.exists(p):
            for k in json.load(open(p, encoding="utf8")):
                if k.get("kanji"):
                    allowed.add(k["kanji"][0])
    return allowed, kd


def load_example_ngrams(max_n=6):
    """JLPT жишээ өгүүлбэрээс 1..max_n урттай n-грамуудыг цуглуулна."""
    grams = set()
    for lv in ("n5", "n4", "n3", "n2", "n1"):
        p = os.path.join(OPENJLPT, "vocab", f"{lv}.json")
        if not os.path.exists(p):
            continue
        for entry in json.load(open(p, encoding="utf8")):
            for ex in entry.get("examples", [])[:1]:
                s = ex.get("ja", "")
                for n in range(1, max_n + 1):
                    for i in range(len(s) - n + 1):
                        grams.add(s[i:i + n])
    return grams, len(grams)


def load_existing_words():
    """OpenJLPT-д аль хэдийн байгаа (word, reading) хосууд."""
    have = set()
    kana_only = set()
    for lv in ("n5", "n4", "n3", "n2", "n1"):
        p = os.path.join(OPENJLPT, "vocab", f"{lv}.json")
        if not os.path.exists(p):
            continue
        for e in json.load(open(p, encoding="utf8")):
            have.add((e["word"], e["reading"]))
            if e["word"] == e["reading"]:
                kana_only.add(e["reading"])
    return have, kana_only


def main():
    if not os.path.exists(DB):
        sys.exit("jamdict.db олдсонгүй — эхлээд `npm run data:fetch` ажиллуулна уу.")

    allowed, kd = load_allowed_kanji()
    have, kana_only = load_existing_words()

    print(f"  зөвшөөрөгдсөн ханз: {len(allowed):,}")
    idx_grams, ngram_count = load_example_ngrams()
    print(f"  жишээ өгүүлбэрийн n-грам: {ngram_count:,}")

    con = sqlite3.connect(DB)
    con.text_factory = str
    cur = con.cursor()

    # --- POS / misc / gloss-ийг sense тус бүрээр цуглуулна -------------------
    pos_by_sense = defaultdict(set)
    for sid, text in cur.execute("SELECT sid, text FROM pos"):
        for code in pos_codes({text}):
            pos_by_sense[sid].add(code)
    misc_by_sense = defaultdict(set)
    for sid, text in cur.execute("SELECT sid, text FROM misc"):
        misc_by_sense[sid].add(text)
    misspelled = defaultdict(set)
    for sid, text in cur.execute("SELECT sid, text FROM SenseInfo"):
        misspelled[sid].add(text)
    misc_by_sense = {k: {MISC_CANON.get(v, v) for v in vs} for k, vs in misc_by_sense.items()}

    gloss_by_sense = defaultdict(list)
    for sid, text in cur.execute(
        "SELECT sid, text FROM SenseGloss WHERE lang='eng' ORDER BY sid, rowid"
    ):
        g = text.strip()
        if g and not g.startswith("(") and len(g) < 60:
            gloss_by_sense[sid].append(g)

    # --- entry → kanji / kana ------------------------------------------------
    kanji_of = defaultdict(list)
    for idseq, text in cur.execute("SELECT idseq, text FROM Kanji ORDER BY idseq, ID"):
        kanji_of[idseq].append(text)
    kana_of = defaultdict(list)
    for idseq, text in cur.execute("SELECT idseq, text FROM Kana ORDER BY idseq, ID"):
        kana_of[idseq].append(text)

    senses_of = defaultdict(list)
    for idseq, sid in cur.execute("SELECT idseq, ID FROM Sense ORDER BY idseq, ID"):
        senses_of[idseq].append(sid)

    print(f"  JMdict бичлэг: {len(kanji_of):,}")

    candidates = []
    for idseq, forms in kanji_of.items():
        sids = senses_of.get(idseq) or []
        if not sids:
            continue

        # Хамгийн тохиромжтой бичлэгийн хэлбэр (хамгийн богино, зөвшөөрөгдсөн ханзтай).
        # Нэг ханзтай үгсийг алгасна — тэдгээр нь ханзны хэсэгт аль хэдийн бий.
        best = None
        for f in forms[:4]:
            if not (2 <= len(f) <= 5):
                continue
            chars = [c for c in f if "\u4e00" <= c <= "\u9fff"]
            if not chars or any(c not in allowed for c in chars):
                continue
            if best is None or len(f) < len(best):
                best = f
        if best is None:
            continue

        kana = next((k for k in kana_of.get(idseq, []) if KANA_RE.match(k) and len(k) <= 8), None)
        if not kana:
            continue

        # sense-үүдийг шүүнэ
        glosses, pos_all = [], set()
        for sid in sids:
            misc = misc_by_sense.get(sid, set()) | misspelled.get(sid, set())
            if misc & MISC_BAD:
                continue
            p = pos_by_sense.get(sid, set())
            if not (p & POS_OK):
                continue
            gs = gloss_by_sense.get(sid) or []
            if not gs:
                continue
            glosses.extend(gs)
            pos_all |= p & POS_OK
            if len(glosses) >= 3:
                break

        glosses = [g for g in dict.fromkeys(glosses)][:3]
        if not glosses:
            continue
        if any(re.search(r"[<>{}|\[\]]", g) for g in glosses):
            continue

        if (best, kana) in have:
            continue
        if best == kana and kana in kana_only:
            continue

        kanji_chars = [c for c in best if c in kd]
        freqs = [kd[c]["freq"] for c in kanji_chars if kd[c].get("freq")]
        jlpt_new = [kd[c]["jlpt_new"] for c in kanji_chars if kd[c].get("jlpt_new")]
        in_ex = best in idx_grams

        # Түвшин: ханзнуудын хамгийн хүнд түвшнээр (provenance: derived).
        if jlpt_new:
            lvl = f"N{max(jlpt_new)}"
        else:
            grades = [kd[c].get("grade") for c in kanji_chars if kd[c].get("grade")]
            g = max(grades) if grades else 8
            lvl = "N5" if g <= 2 else "N4" if g <= 3 else "N3" if g <= 5 else "N2" if g <= 6 else "N1"

        # Оноо: бага байх тусмаа сайн. Жишээ өгүүлбэрт гарсан нь хамгийн хүчтэй дохио.
        score = (
            (0 if in_ex else 1000)
            + (min(freqs) if freqs else 4000) * 0.35
            + len(best) * 12
            + ((sum(freqs) / len(freqs)) if freqs else 4000) * 0.1
        )
        candidates.append({
            "idseq": idseq,
            "w": best,
            "r": kana,
            "en": glosses,
            "pos": sorted(pos_all)[:4],
            "lvl": lvl,
            "isEx": 1 if in_ex else 0,
            "freq": min(freqs) if freqs else None,
            "score": round(score, 2),
        })

    # Нэг үгээс хэд хэдэн бичлэг гарвал хамгийн тохиромжтойг нь үлдээнэ (үг тус бүр 1).
    best_by_word = {}
    for c in sorted(candidates, key=lambda c: c["score"]):
        best_by_word.setdefault(c["w"], c)
    candidates = sorted(best_by_word.values(), key=lambda c: c["score"])
    print(f"  давхардлыг цэвэрлэсний дараа: {len(candidates):,}")

    candidates.sort(key=lambda c: c["score"])
    print(f"  нэр дэвшигч: {len(candidates):,}")

    with open(OUT, "w", encoding="utf8") as fh:
        json.dump(candidates, fh, ensure_ascii=False, separators=(",", ":"))
    print(f"  → {os.path.relpath(OUT, ROOT)} ({os.path.getsize(OUT)/1e6:.1f} MB)")


if __name__ == "__main__":
    main()
