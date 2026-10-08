import fs from 'node:fs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validMn, topicsFor, auditCoverage } from './validate-coverage.mjs';
const read = p => JSON.parse(readFileSync(p, 'utf8'));
assert.equal(validMn('love'), false);
assert.equal(validMn('Орчуулга хүлээгдэж байна'), false);
assert.equal(validMn('хайр'), true);
const taxonomy = read('content/categories/taxonomy.json');
assert.ok(topicsFor({id:'test',en:['loving mother'],t:'n'},'vocab',taxonomy,{vocab:{}}).includes('relationships'));
assert.ok(!topicsFor({id:'test',en:['stage'],t:'n'},'vocab',taxonomy,{vocab:{}}).includes('time'));
assert.deepEqual(topicsFor({id:'test',en:['xyz'],t:'n'},'vocab',taxonomy,{vocab:{}}), []);
const report = auditCoverage();
assert.deepEqual(report.totals, read('content/coverage-report.json').totals, 'Refresh coverage report after data changes');
console.log('Coverage regression checks passed (does not assert release completeness).');

for (const lv of ['N5','N4','N3']) for (const field of ['missingMeanings','missingExamples','missingForms']) assert.equal(report.byLevel[lv].grammar[field],0,`${lv} grammar ${field}`);
assert.equal(report.byLevel.N5.vocab.missingMeanings,0);
assert.equal(report.byLevel.N5.vocab.unclassified,0);
assert.equal(report.byLevel.N5.kanji.unclassified,0);
assert.equal(report.byLevel.N3.grammar.missingMeanings,0);

for (const lv of ["N2","N1"]) for (const field of ["missingMeanings","missingForms"]) assert.equal(report.byLevel[lv].grammar[field],0);

// Legacy exemption is exact-content only; it cannot excuse new derived text.
const legacyPath = 'public/data/vocab/n4.json';
const originalLegacyData = fs.readFileSync(legacyPath, 'utf8');
try {
  const entries = JSON.parse(originalLegacyData);
  const legacyEntry = entries.find(e => e.mn?.length && !e.mn_provenance);
  assert.ok(legacyEntry);
  legacyEntry.mn = ['шинээр өөрчилсөн утга'];
  fs.writeFileSync(legacyPath, JSON.stringify(entries));
  assert.ok(auditCoverage().totals.missingProvenance > 0, 'Changed legacy text must require new provenance');
} finally { fs.writeFileSync(legacyPath, originalLegacyData); }
assert.equal(report.legacyUnreviewed, 6503);

for (const lv of ["N3","N2"]) assert.equal(report.byLevel[lv].vocab.missingMeanings,0);
