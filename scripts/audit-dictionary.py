#!/usr/bin/env python3
"""Extract review evidence, never apply source corrections or translations.
Usage: python scripts/audit-dictionary.py DATABASE JAMDICT_DATA_1.5_TAR_GZ
Obtain the pinned artifact from the URL in the report. Keep both inputs in .cache.
The dictionary is an externally retrieved EDRDG-derived redistribution, NOT
an independent modern dictionary or proof that its older glosses are correct.
"""
import hashlib
import json
from pathlib import Path
import sqlite3
import sys
import tarfile

ARTIFACT = 'https://files.pythonhosted.org/packages/97/a5/075928aed2b3b70459fc1db396397dfa6714d266c143c51af9b648551a4e/jamdict_data-1.5.tar.gz'
SHA256 = 'a4247dd9bb3148ab17c1b32fc56d7a7f1c35293b0d6ff2838c811f896d13f415'
db, archive = map(Path, sys.argv[1:])
assert hashlib.sha256(archive.read_bytes()).hexdigest() == SHA256
with tarfile.open(archive) as tar:
    pkg = tar.extractfile('jamdict_data-1.5/PKG-INFO').read().decode()
    assert 'Version: 1.5' in pkg and 'Compiled date: 17 Apr 2021' in pkg
    assert 'All dictionaries in this package are licensed under CC BY-SA 3.0.' in pkg
    license_text = tar.extractfile('jamdict_data-1.5/jamdict_data/LICENSE.md').read().decode()
    xz = tar.extractfile('jamdict_data-1.5/jamdict_data/jamdict.db.xz')
    import lzma
    unpacked = hashlib.sha256()
    with lzma.open(xz) as source:
        for block in iter(lambda: source.read(1024 * 1024), b''):
            unpacked.update(block)
actual = hashlib.sha256()
with db.open('rb') as source:
    for block in iter(lambda: source.read(1024 * 1024), b''):
        actual.update(block)
assert actual.hexdigest() == unpacked.hexdigest(), 'DB must match pinned archive'
c = sqlite3.connect(f'{db.resolve().as_uri()}?mode=ro', uri=True)

def values(table, column, key, value):
    return [r[0] for r in c.execute(f'SELECT {column} FROM {table} WHERE {key}=?', (value,))]

conflicts = json.loads(Path('content/mn/source-conflict-audit-2026-10-08.json').read_text())['records']
records = {}
for kind in ['vocab', 'kanji']:
    for level in ['n5', 'n4', 'n3', 'n2', 'n1']:
        for entry in json.loads(Path(f'public/data/{kind}/{level}.json').read_text()):
            key = entry['id'] if kind == 'vocab' else entry['k']
            conflict = next((r for r in conflicts if (r['kind'], r['level'], r['key']) == (kind, level, key)), None)
            if entry['mn'] and not conflict:
                continue
            fields = ['w', 'r', 'en'] if kind == 'vocab' else ['k', 'on', 'kun', 'en']
            record = {'kind': kind, 'level': level, 'key': key,
                      'expected': {f: entry[f] for f in fields},
                      'missingMeaning': not bool(entry['mn']),
                      'existingWarning': entry.get('source_issue'),
                      'evidenceSource': 'jamdict-data-1.5', 'artifactUrl': ARTIFACT,
                      'dictionaryLicense': 'CC-BY-SA-3.0',
                      'decision': 'blocked; no active fields changed; independent source/semantic review required'}
            if kind == 'vocab':
                ids = values('Kanji', 'idseq', 'text', entry['w']) + values('Kana', 'idseq', 'text', entry['w'])
                candidates = []
                for seq in sorted(set(ids)):
                    kanji = values('Kanji', 'text', 'idseq', seq)
                    kana = values('Kana', 'text', 'idseq', seq)
                    if entry['r'] not in kana:
                        continue
                    senses = []
                    for sid in values('Sense', 'ID', 'idseq', seq):
                        senses.append({'snapshotSenseId': sid,
                            'englishGlosses': [r[0] for r in c.execute('SELECT text FROM SenseGloss WHERE sid=? AND lang="eng"', (sid,))],
                            **{t: values(t, 'text', 'sid', sid) for t in ['stagk', 'stagr', 'pos', 'misc', 'field', 'dialect', 'SenseInfo']}})
                    candidates.append({'entrySeq': seq, 'spellings': kanji, 'readings': kana,
                        'spellingInfo': [{'text': text, 'info': values('KJI', 'text', 'kid', kid)} for kid, text in c.execute('SELECT ID,text FROM Kanji WHERE idseq=?', (seq,))],
                        'readingInfo': [{'text': text, 'nokanji': bool(nokanji), 'restrictions': values('KNR', 'text', 'kid', kid), 'info': values('KNI', 'text', 'kid', kid)} for kid, text, nokanji in c.execute('SELECT ID,text,nokanji FROM Kana WHERE idseq=?', (seq,))],
                        'senses': senses})
                record['exactHeadwordReadingCandidates'] = candidates
                record['lookupStatus'] = 'exact spelling/reading found' if candidates else 'no exact spelling/reading match'
            else:
                english = [r[0] for r in c.execute('SELECT m.value FROM meaning m JOIN rm_group g ON m.gid=g.ID JOIN character ch ON g.cid=ch.ID WHERE ch.literal=? AND m.m_lang=""', (key,))]
                readings = [list(r) for r in c.execute('SELECT r.r_type,r.value FROM reading r JOIN rm_group g ON r.gid=g.ID JOIN character ch ON g.cid=ch.ID WHERE ch.literal=?', (key,))]
                record['kanjidic2'] = {'literal': key, 'englishGlosses': english, 'readings': readings}
                record['lookupStatus'] = 'literal with English glosses found' if english else 'no literal/gloss match'
            records[f'{kind}/{level}/{key}'] = record

assessments = {
 'e05bb17edd': 'Snapshot entry 1222540 explicitly includes aroma as a second sense; previous categorical mismatch warning is challenged, not confirmed. Modern sense/register and suitability of the example remain unreviewed.',
 '2e8753951c': 'Snapshot entry 1403390 includes 悪い spelling and にくい reading with hateful/abominable/poor-looking. Earlier mismatch claim is challenged; separate entry 2772730 has different senses. No automatic respelling.',
 '64e8f7eda0': 'Snapshot entry 1468010 lists quantity/calorific value of heat and enthusiasm, not temperature. Source correction still required; retained English not overwritten.',
 'ed2719ab9d': 'Snapshot has separate exact ファン entries 1108540 (fan) and 2844127 (fun). Earlier blanket rejection of fun is challenged; sense selection and examples still require review.',
 '0101791a03': 'Snapshot entry 1110340 explicitly lists foam and form as separate senses. Earlier warning is challenged. Examples contain longer words (ユニフォーム/リフォーム), not evidence for all senses.',
 'j2076920': 'Exact entry 2076920 includes you (derogatory, male term) and I/me/oneself (male term). Preserve てめえ reading; self-reference versus second-person teaching/register remains unreviewed.',
 'j2727400': 'Exact entry 2727400 includes シーサン and boy with honorific/respectful tag but no dialect tag. Does not establish dialect attribution; no substitution with せんせい.',
 'j1448900': 'Exact entry 1448900 includes 中身 alongside 当て身/当身 and あてみ with martial-arts glosses. Earlier categorical spelling-conflict warning is challenged. Variant usage remains unreviewed.',
 '聴': 'KANJIDIC2 snapshot repeats listen/headstrong/naughty. Repetition within shared source lineage is not independent justification for modern teaching senses.',
 '博': 'KANJIDIC2 snapshot repeats Dr./command/esteem; does not disambiguate command or independently justify its Mongolian rendering.',
 'j2599040': 'Exact sequence repeats vice-/sub- for 分屯. Same artifact is used by source pipeline; repetition is NOT independent verification of this suspect entry.',
 'j1684450': 'Exact sequence repeats countersuit for 応訴. Same artifact is used by source pipeline; repetition is NOT independent verification of this suspect gloss.',
 'j2618190': 'Exact sequence repeats worthiness as an opponent or challenge for 弾き応え. Same artifact is used by source pipeline; repetition is NOT independent verification of this suspect gloss.',
}
for record in records.values():
    record['assessment'] = assessments.get(record['key'], 'Exact external snapshot extract only. Match/nonmatch and repeated historical glosses do not certify modern meaning, reading, source correctness or a Mongolian translation. Remains withheld for independent review.')
assert sum(r['missingMeaning'] for r in records.values()) == 62
assert sum(bool(r['existingWarning']) for r in records.values()) == 10
report = {'checkedAt': '2026-10-09', 'author': 'Arena coding assistant',
    'method': 'Read-only exact headword+reading or literal lookup; English senses, restrictions and tags extracted from pinned SQLite. Original records retained. No independent human approval.',
    'source': {'id': 'jamdict-data-1.5', 'packageVersion': '1.5', 'compiledDateAsDeclared': '2021-04-17',
        'artifactUrl': ARTIFACT, 'artifactSha256': SHA256, 'databaseSha256': actual.hexdigest(),
        'packageUrl': 'https://pypi.org/project/jamdict-data/1.5/',
        'dictionaryOwner': 'James William Breen and the Electronic Dictionary Research and Development Group',
        'dictionaryLicense': 'CC-BY-SA-3.0', 'packageLicense': 'MIT',
        'licenseUrl': 'https://www.edrdg.org/edrdg/licence.html', 'databaseMetadata': dict(c.execute('SELECT * FROM meta'))},
    'limitations': ['Package compile date is not a known JMdict lexical snapshot date; metadata has no jmdict.date.',
        'KANJIDIC2 metadata reports April 2008; package compiled in 2021. Not current authoritative-direct validation.',
        'The repository fetch-sources.mjs uses this exact version for JMdict. External retrieval is genuine, but not independent corroboration of its suspect entries.',
        'Ten existing warnings retained, including claims challenged by this snapshot; evidence requires adjudication, not silent correction.',
        '62 meanings still withheld. Current upstream direct asset download was blocked; no modern independent source or human review acquired.'],
    'counts': {'missingMeaningsAudited': 62, 'sourceWarningsAudited': 10, 'uniqueRecords': len(records), 'activeCorrections': 0},
    'records': list(records.values())}
Path('docs/audits/2026-10-09-dictionary-evidence.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
Path('docs/licenses').mkdir(exist_ok=True)
Path('docs/licenses/jamdict-data-1.5-dictionaries.md').write_text(license_text)
print(json.dumps(report['counts']))
