import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {dimensions, statuses, validateEvidenceReference, validateReviewArtifact} from '../eval/scene-goal-review.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const bytes = path => readFileSync(new URL(`../${path}`, import.meta.url));
const read = path => JSON.parse(bytes(path));
const synthetic = read('eval/scene-goal-counterexamples.json');
const retained = read('eval/scene-goal-reviews.json');

test('manual retrospective and synthetic artifacts have valid byte-bound contracts, not semantic scores', () => {
  for (const artifact of [retained, synthetic]) {
    const before = structuredClone(artifact);
    const result = validateReviewArtifact(artifact);
    assert.equal(result.records, artifact.records.length);
    assert.ok(result.obligations >= result.records);
    assert.ok(result.references >= result.obligations * 2);
    assert.equal(result.semanticQuality, 'not_evaluated');
    assert.deepEqual(artifact, before);
  }
  assert.equal(retained.records.length, 6);
  assert.equal(synthetic.records.length, 15);
  assert.deepEqual([...new Set(retained.records.map(row => row.text.path))].sort(),
    [1,2,3,4,5,6].map(n => `eval/history/causal-quality-20261007/raw-prose-0${n}.bin`));
  assert.deepEqual(new Set(retained.records.map(row => row.origin)), new Set(['retained']));
  assert.deepEqual(new Set(synthetic.records.map(row => row.origin)), new Set(['synthetic']));
});

test('synthetic labels pin explicitly authored calibration distinctions; these are not detector predictions', () => {
  const expected = {
    mention:'missing', agreement:'fulfilled', refusal:'contradicted', tentative:'missing', compound_partial:'partial',
    speculation:'fulfilled', fact_upgrade:'contradicted', custody_preserved:'fulfilled',
    custody_gap:'uncertain', custody_contradiction:'contradicted', bell_shell:'fulfilled',
    bell_working:'contradicted', needle_alternative:'fulfilled', needle_overclaim:'contradicted',
    knowledge_gap:'uncertain',
  };
  assert.deepEqual(Object.fromEntries(synthetic.records.map(record =>
    [record.obligations[0].id, record.obligations[0].status])), expected);
  assert.deepEqual(new Set(synthetic.records.map(row => row.obligations[0].status)), new Set(statuses));
  assert.deepEqual(dimensions, ['goalfulfillment','causaltransitions','boundaries','advancement','voiceagency','countssoft']);
});

test('matching quotations do not validate a judgment: even a semantically wrong label passes the contract', () => {
  const changed = structuredClone(synthetic);
  changed.records[0].obligations[0].status = 'fulfilled'; // Deliberately wrong authored judgment.
  assert.equal(validateReviewArtifact(changed).semanticQuality, 'not_evaluated');
  // No lexical or quote-presence algorithm pretends to catch this semantic error.
});

test('retrospective calibration pins agreement ambiguity separately from voice and soft counts', () => {
  const obligation = (id, key) => retained.records.find(row => row.id === id).obligations.find(row => row.id === key);
  assert.equal(obligation('retained-F3-A', 'agree-next-day').status, 'fulfilled');
  assert.equal(obligation('retained-F3-B', 'agree-next-day').status, 'missing');
  assert.equal(obligation('retained-F2-B', 'agree-return').status, 'uncertain');
  assert.equal(obligation('retained-F2-B', 'compatible-greeting').status, 'uncertain');
  assert.equal(obligation('retained-F2-A', 'administrator-knows-number').status, 'uncertain');
  for (const record of retained.records) {
    assert.equal(record.obligations.find(row => row.dimension === 'voiceagency').status, 'fulfilled');
    assert.equal(record.obligations.filter(row => row.dimension === 'countssoft').length, 1);
  }
  assert.match(retained.records.find(row => row.id === 'retained-F2-B').notes.join(' '), /interpretation difference/);
});

test('reject malformed review contracts and broken record/reference bindings', () => {
  const mutations = [
    data => { data.providerCalls = 1; },
    data => { data.kind = 'automatic-acceptance'; },
    data => { data.records = []; },
    data => { data.records[1].id = data.records[0].id; },
    data => { data.records[0].origin = 'generated-from-schema3'; },
    data => { data.records[0].syntheticCaseId = 'not-a-case'; },
    data => { data.records[0].notes = [null]; },
    data => { data.records[0].obligations = []; },
    data => { data.records[0].obligations.push(structuredClone(data.records[0].obligations[0])); },
    data => { data.records[0].obligations[0].status = 'pass'; },
    data => { data.records[0].obligations[0].dimension = 'keyword-match'; },
    data => { data.records[0].obligations[0].reasoning = ' '; },
    data => { data.records[0].obligations[0].requirement = ''; },
    data => { data.records[0].obligations[0].evidence = []; },
    data => { data.records[0].obligations[0].constraint.path = 'eval/schema3-causal-fixtures.json'; },
    data => { data.records[0].obligations[0].evidence[0].sha256 = '0'.repeat(64); },
    data => { data.records[0].obligations[0].evidence[0] = data.records[0].obligations[0].constraint; },
    data => { data.records[0].obligations[0].evidence[0] = data.records[1].obligations[0].evidence[0]; },
    data => { data.records[0].obligations[0].constraint = data.records[1].obligations[0].constraint; },
  ];
  for (const mutate of mutations) {
    const data = structuredClone(synthetic);
    mutate(data);
    assert.throws(() => validateReviewArtifact(data));
  }
  const swapped = structuredClone(retained);
  swapped.records[0].text = swapped.records[1].text;
  assert.throws(() => validateReviewArtifact(swapped), /binding mismatch/);
});

test('reject corrupt hashes, invalid paths, non-string JSON targets, and incorrect UTF-16 spans', () => {
  const original = synthetic.records[0].obligations[0].evidence[0];
  const mutations = [
    ref => { ref.path = '/etc/passwd'; },
    ref => { ref.path = 'eval/../package.json'; },
    ref => { ref.path = 'eval\\scene-goal-synthetic-sources.json'; },
    ref => { ref.sha256 = '0'.repeat(64); },
    ref => { ref.pointer = '/cases/0/unknown'; },
    ref => { ref.pointer = '/cases/0'; },
    ref => { ref.pointer = '/cases/~2/text'; },
    ref => { ref.start = -1; },
    ref => { ref.start = 0.5; },
    ref => { ref.end = ref.start; },
    ref => { ref.end = Number.MAX_SAFE_INTEGER; },
    ref => { ref.quote = 'invented evidence'; },
  ];
  for (const mutate of mutations) {
    const ref = structuredClone(original);
    mutate(ref);
    assert.throws(() => validateEvidenceReference(ref, root));
  }
});

test('schema-3 source remains a separate unchanged missing-exit-state fixture, never historical output provenance', () => {
  const fixture = read('eval/schema3-causal-fixtures.json');
  assert.equal(fixture.providerCalls, 0);
  for (const row of fixture.fixtures) {
    assert.deepEqual(row.sceneIntent.exitState, {status:'missing', value:null});
    for (const chapter of row.input.project.outline) assert.equal(Object.hasOwn(chapter, 'exitState'), false);
  }
  for (const record of retained.records) {
    assert.match(record.source.path, /^eval\/history\/causal-quality-20261007\/candidate-/);
    const packet = read(record.source.path);
    assert.equal(createHash('sha256').update(packet.text).digest('hex'), packet.textSha256);
    const request = JSON.parse(packet.storyInput);
    for (const chapter of request.input.project.outline) assert.equal(Object.hasOwn(chapter, 'exitState'), false);
  }
});

test('pointer escaping, decoded UTF-16 offsets and realpath boundaries are exact', () => {
  const temporary = mkdtempSync(join(tmpdir(), 'scene-goal-contract-'));
  try {
    mkdirSync(join(temporary, 'eval'));
    const content = JSON.stringify({'a/b~c':'😀纸屑'});
    writeFileSync(join(temporary, 'eval/source.json'), content);
    const ref = {path:'eval/source.json', sha256:createHash('sha256').update(content).digest('hex'),
      pointer:'/a~1b~0c', start:2, end:4, quote:'纸屑'};
    assert.equal(validateEvidenceReference(ref, temporary), true);
    assert.throws(() => validateEvidenceReference({...ref,start:1,end:3}, temporary), /quote\/span/);
    const bomText = '\uFEFF纸屑';
    writeFileSync(join(temporary, 'eval/bom.bin'), bomText);
    const bomRef = {path:'eval/bom.bin', sha256:createHash('sha256').update(bomText).digest('hex'),
      pointer:'', start:1, end:3, quote:'纸屑'};
    assert.equal(validateEvidenceReference(bomRef, temporary), true);
    assert.throws(() => validateEvidenceReference({...bomRef,start:0,end:2}, temporary), /quote\/span/);
    const bomJson = '\uFEFF' + content;
    writeFileSync(join(temporary, 'eval/bom.json'), bomJson);
    assert.throws(() => validateEvidenceReference({...ref,path:'eval/bom.json',
      sha256:createHash('sha256').update(bomJson).digest('hex')}, temporary), SyntaxError);
    writeFileSync(join(temporary, 'outside.json'), content);
    const nested = join(temporary, 'nested');
    mkdirSync(join(nested, 'eval'), {recursive:true});
    symlinkSync(join(temporary, 'outside.json'), join(nested, 'eval/source.json'));
    assert.throws(() => validateEvidenceReference(ref, nested), /escapes root/);
  } finally {
    rmSync(temporary, {recursive:true, force:true});
  }
});
