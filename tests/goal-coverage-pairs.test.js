import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateEvidenceReference, statuses, dimensions} from '../eval/scene-goal-review.mjs';
const read = path => JSON.parse(readFileSync(new URL(`../eval/${path}`, import.meta.url),'utf8'));
const sources=read('goal-coverage-pairs.json');
const annotations=read('goal-coverage-annotations.json');
// Test-local packet integrity, intentionally not a reusable semantic evaluator.
function check(packet) {
  assert.equal(packet.formatVersion,1);
  assert.equal(packet.kind,'manual-editorial-calibration');
  assert.equal(packet.providerCalls,0);
  assert.equal(packet.semanticQuality,'not_evaluated');
  assert.equal(packet.records.length,sources.cases.length);
  assert.equal(new Set(packet.records.map(r=>r.caseId)).size,12);
  for(const [i,record] of packet.records.entries()) {
    assert.equal(record.caseId,sources.cases[i].id);
    assert.equal(record.reviewScope,'complete synthetic candidate / 完整合成正文');
    for(const field of ['input','candidate']) {
      assert.equal(record[field].path,'eval/goal-coverage-pairs.json');
      assert.equal(record[field].pointer,`/cases/${i}/${field}`);
      assert.equal(record[field].start,0);
      assert.equal(record[field].end,sources.cases[i][field].length);
      assert.equal(record[field].quote,sources.cases[i][field]);
      validateEvidenceReference(record[field]);
    }
    assert.ok(record.judgments.length>0);
    assert.equal(new Set(record.judgments.map(j=>j.dimension)).size,record.judgments.length);
    for(const j of record.judgments){assert.ok(dimensions.includes(j.dimension));assert.ok(statuses.includes(j.status));assert.ok(j.reasoning.trim());}
  }
  return 'not_evaluated';
}
test('twelve synthetic input–candidate pairs bind full text and stable source IDs',()=>{
 assert.equal(sources.formatVersion,1);assert.equal(sources.origin,'synthetic-editorial-pairs');assert.equal(sources.providerCalls,0);
 assert.deepEqual(sources.cases.map(c=>c.id),Array.from({length:12},(_,i)=>`GC-${String(i+1).padStart(2,'0')}`));
 for(const c of sources.cases){assert.equal(c.origin,'synthetic');assert.ok(c.premiseChange.trim());assert.ok(['goal','boundary'].includes(c.editorialRole));}
 assert.equal(check(annotations),'not_evaluated');
});
test('changed-premise pairs explicitly preserve the same departure and separate goal from boundary',()=>{
 assert.equal(sources.cases[0].candidate,sources.cases[3].candidate);
 assert.equal(sources.cases[0].candidate,sources.cases[4].candidate);
 assert.notEqual(sources.cases[0].input,sources.cases[3].input);
 assert.deepEqual(annotations.records[11].judgments.map(j=>[j.dimension,j.status]),[['goalfulfillment','fulfilled'],['boundaries','contradicted']]);
});
test('corrupt hashes, pointers, spans, case identities and empty reasons fail integrity',()=>{
 for(const mutate of [p=>p.records[0].input.sha256='0'.repeat(64),p=>p.records[0].candidate.pointer='/cases/1/candidate',p=>p.records[0].candidate.end--,p=>p.records[0].caseId='GC-02',p=>p.records[0].judgments[0].reasoning=' ']){
  const p=structuredClone(annotations);mutate(p);assert.throws(()=>check(p));
 }
});
test('a deliberately wrong semantic label still passes: tests do not certify judgments',()=>{
 const p=structuredClone(annotations);p.records[0].judgments[0].status='fulfilled';
 assert.equal(check(p),'not_evaluated');
});
