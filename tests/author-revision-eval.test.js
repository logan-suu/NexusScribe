import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, mkdir, copyFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { segmentProse } from '../src/domain/prose.js';
import { protocol, SOURCE_HASHES, FROZEN_PATHS, CLOSE_READ_ITEMS, digest, verifyFrozenManifest,
  loadFrozenTrial, buildRevisionInput, buildFollowupInput, proseStats, proseChecks,
  validateCloseReadRecord, assessStage, main } from '../scripts/run-author-revision-eval.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// Mechanical fixtures intentionally make no claim of literary quality or actual close reading.
const candidate = ['甲'.repeat(100), '乙'.repeat(100), '丙'.repeat(100), '丁'.repeat(100)].join('\n\n');
const closeRead = (text = candidate) => ({ protocol: protocol.id, reviewerType: 'assistant',
  reviewer: 'Offline test fixture only', nonBlind: true, fullCandidateRead: true, textSha256: digest(text), locked: true,
  items: CLOSE_READ_ITEMS.map(id => ({ id, status: 'pass', explanation: 'Mechanical attestation fixture; no actual quality judgment.',
    evidence: [{ start: 0, end: 2, quote: text.slice(0, 2) }] })) });
const review = trial => ({ summary: 'Offline fixture, not a judgment of quality.', issues: [], checks: [],
  factChecks: trial.context.facts.map(f => ({ factId: f.id, recordVersion: f.recordVersion,
    status: 'not_applicable', explanation: 'Test fixture omits this fact.', sourceQuote: '' })) });
const extraction = (text = candidate) => {
  const p = segmentProse(text)[0];
  return { staging: [{ label: 'Unverified test proposal.', sourceParagraphIndex: p.index, sourceQuote: p.text, sourceStart: p.start, sourceEnd: p.end }], reviewNotes: [] };
};

test('frozen retained target and exact accepted source context reproduce original identity', async () => {
  const trial = await loadFrozenTrial();
  assert.equal(digest(trial.text), SOURCE_HASHES.text);
  assert.deepEqual(proseStats(trial.text), { characters: 833, hanCharacters: 691, paragraphs: 8 });
  assert.equal(digest(trial.context), SOURCE_HASHES.context);
  assert.equal(digest(trial.context.sources[0].text), SOURCE_HASHES.acceptedPriorText);
  assert.equal(trial.context.sources[0].role, 'accepted_manuscript');
  assert.equal(trial.context.sources[0].revisionId, 'ch1-r3');
  assert.equal(trial.context.facts.length, 3); assert.equal(trial.context.events.length, 0);
});
test('one revision input has only exact production fields and never promotes draft or proposals', async () => {
  const trial = await loadFrozenTrial(), before = JSON.stringify(trial);
  const input = buildRevisionInput(trial);
  assert.deepEqual(Object.keys(input), ['text', 'instruction', 'chapterId', 'context']);
  assert.equal(input.chapterId, 'ch2'); assert.equal(input.text, trial.text);
  assert.deepEqual(input.context, trial.context);
  assert.equal(input.context.sources[1].role, 'planned_content');
  input.context.sources[0].text = 'mutated returned copy';
  assert.equal(JSON.stringify(trial), before);
});
test('input text, original context, instruction and target mutation fail closed', async () => {
  const trial = await loadFrozenTrial();
  for (const mutate of [x => { x.text += ' '; }, x => { x.context.events.push({ label: 'fabricated accepted memory' }); },
    x => { x.instruction += '多写一些'; }, x => { x.chapterId = 'ch3'; }]) {
    const changed = structuredClone(trial); mutate(changed);
    assert.throws(() => buildRevisionInput(changed), /INPUT_MISMATCH/);
  }
});
test('Han counts and physical-line paragraphs use inclusive preregistered bounds', () => {
  assert.deepEqual(proseStats('中A1。\r\n\n文！'), { characters: 9, hanCharacters: 2, paragraphs: 2 });
  const text = count => ['中'.repeat(count - 3), '文', '书', '写'].join('\n');
  for (const n of [350, 500]) assert.equal(proseChecks(text(n)).status, 'pass');
  for (const n of [349, 501]) assert.equal(proseChecks(text(n)).status, 'fail');
  for (const n of [3, 8]) assert.equal(proseChecks(Array(n).fill('中'.repeat(Math.floor(420 / n))).join('\n')).status, 'fail');
  assert.equal(proseChecks(null).status, 'fail');
  assert.equal(proseChecks('```text\n' + candidate + '\n```').stopReason, 'PROSE_NO_CODE_FENCES');
  assert.equal(proseChecks(JSON.stringify({text:candidate})).stopReason, 'PROSE_NOT_JSON_WRAPPED');
  assert.equal(proseChecks(candidate).semanticStatus, 'not_evaluated');
});
test('retained long prose is kept as a failing objective example, not silently shortened', async () => {
  const trial = await loadFrozenTrial();
  const result = assessStage('reviseProse', { text: trial.text, chapterId: 'ch2' }, { trial });
  assert.equal(result.status, 'fail'); assert.equal(result.stopReason, 'HAN_350_500');
  assert.equal(result.stats.paragraphs, 8); assert.equal(digest(trial.text), SOURCE_HASHES.text);
});
test('objective pass waits for actual recorded close read, never author acceptance', async () => {
  const trial = await loadFrozenTrial();
  const result = assessStage('reviseProse', { text: candidate, chapterId: 'ch2', provider: { isLive: false } }, { trial });
  assert.equal(result.status, 'pass'); assert.equal(result.nextStage, 'await_close_read');
  assert.equal(result.semanticStatus, 'not_evaluated');
  assert.throws(() => buildFollowupInput('extractMemory', candidate, trial), /CLOSE_READ_NOT_PASSED/);
});
test('close-read gate requires each locked, exact-text-bound item and quoted span', () => {
  assert.equal(validateCloseReadRecord(closeRead(), candidate).status, 'pass');
  for (const malformed of [undefined, null, {}, {items: {}}, {...closeRead(), items: [null]}, {...closeRead(), items: 'bad'}])
    assert.equal(validateCloseReadRecord(malformed, candidate).status, 'fail');
  assert.equal(validateCloseReadRecord(closeRead(), undefined).status, 'fail');
  for (const mutate of [x => { x.items.pop(); }, x => { x.items[0].status = 'uncertain'; },
    x => { x.items[0].status = 'fail'; }, x => { x.items[0].evidence[0].quote = '假的'; },
    x => { x.textSha256 = 'f'.repeat(64); }, x => { x.locked = false; },
    x => { x.fullCandidateRead = false; }, x => { x.items[1].id = x.items[0].id; },
    x => { x.items[0].explanation = ''; }, x => { x.items[0].evidence = []; }]) {
    const record = closeRead(); mutate(record); assert.equal(validateCloseReadRecord(record, candidate).status, 'fail');
  }
  assert.equal(validateCloseReadRecord(closeRead(), candidate).semanticStatus, 'reader_attestation_only');
});
test('each followup consumes exact revised text and original context, with no instruction or memory feedback', async () => {
  const trial = await loadFrozenTrial();
  for (const action of ['extractMemory', 'reviewChapter']) {
    const input = buildFollowupInput(action, candidate, trial, closeRead());
    assert.deepEqual(Object.keys(input), ['text', 'chapterId', 'context']);
    assert.equal(input.text, candidate); assert.equal(digest(input.context), SOURCE_HASHES.context);
    assert.equal(input.context.events.length, 0);
  }
  assert.throws(() => buildFollowupInput('auditMemoryCandidate', candidate, trial, closeRead()), /REQUEST_ORDER/);
  assert.throws(() => buildFollowupInput('extractMemory', candidate + '改', trial, closeRead()), /CLOSE_READ_NOT_PASSED/);
});
test('invalid stage1 target or prose schema fails before a later-stage input can be built', async () => {
  const trial = await loadFrozenTrial();
  for (const output of [{ text: candidate, chapterId: 'wrong' }, { text: candidate, chapterId: 'ch2', extra: true }, { text: '', chapterId: 'ch2' }]) {
    assert.equal(assessStage('reviseProse', output, { trial }).status, 'fail');
  }
});
test('extraction binds exact saved UTF-16 paragraphs and never certifies entailment', async () => {
  const trial = await loadFrozenTrial(), args = { trial, text: candidate, closeRead: closeRead() };
  const good = assessStage('extractMemory', extraction(), args);
  assert.equal(good.status, 'pass'); assert.equal(good.authorAccepted, false);
  assert.equal(good.semanticStatus, 'not_independently_verified');
  const empty = { staging: [], reviewNotes: [] };
  assert.equal(assessStage('extractMemory', empty, args).stopReason, 'EXTRACTION_NONEMPTY');
  for (const change of [x => { x.staging[0].sourceStart++; }, x => { x.staging[0].sourceQuote = 'invented'; }, x => { x.staging[0].sourceParagraphIndex = 99; }]) {
    const out = extraction(); change(out); assert.equal(assessStage('extractMemory', out, args).status, 'fail');
  }
});
test('whole review requires complete fact coverage and stops errors, unknowns and contradictions', async () => {
  const trial = await loadFrozenTrial(), args = { trial, text: candidate, closeRead: closeRead() };
  assert.equal(assessStage('reviewChapter', review(trial), args).status, 'pass');
  const missing = review(trial); missing.factChecks.pop();
  assert.equal(assessStage('reviewChapter', missing, args).stopReason, 'COMPLETE_FACT_COVERAGE');
  for (const status of ['unknown', 'contradiction']) {
    const out = review(trial); out.factChecks[0].status = status; out.factChecks[0].sourceQuote = candidate.slice(0, 2);
    assert.equal(assessStage('reviewChapter', out, args).status, 'fail');
  }
  for (const severity of ['error', 'warning']) {
    const out = review(trial); out.issues = [{ severity, explanation: 'Test only.', sourceQuote: candidate.slice(0, 2) }];
    assert.equal(assessStage('reviewChapter', out, args).status, severity === 'error' ? 'fail' : 'pass');
  }
});
test('stage assessment does not mutate source, response, close-read record or accept state', async () => {
  const trial = await loadFrozenTrial(), record = closeRead(), out = review(trial);
  const before = JSON.stringify([trial, record, out]);
  assessStage('reviewChapter', out, { trial, text: candidate, closeRead: record });
  assert.equal(JSON.stringify([trial, record, out]), before);
  assert.throws(() => assessStage('auditMemoryCandidate', {}, { trial }), /REQUEST_ORDER/);
});
test('frozen manifest rejects altered files before any dispatch exists', async () => {
  const directory = await mkdtemp(resolve(tmpdir(), 'nexus-author-revision-'));
  try {
    for (const path of [...FROZEN_PATHS, 'eval/author-revision-manifest.json']) {
      await mkdir(dirname(resolve(directory, path)), { recursive: true });
      await copyFile(resolve(root, path), resolve(directory, path));
    }
    assert.equal((await verifyFrozenManifest({ root: directory })).protocol, protocol.id);
    await writeFile(resolve(directory, 'eval/history/multichapter-v1/completed-05.json'), '{}');
    await assert.rejects(verifyFrozenManifest({ root: directory }), /FROZEN_SOURCE_MISMATCH/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
test('CLI and public main remain credential-free read-only preflight; live/restart flags reject', async () => {
  for (const args of [['--live'], ['--offline', '--live'], ['--resume'], ['evidence-dir']])
    await assert.rejects(main(args), /OFFLINE_ONLY_NO_DISPATCH/);
  const result = await main(['--offline']); assert.equal(result.liveCalls, 0); assert.equal(result.mode, 'offline_preparation_only'); assert.equal(result.liveRetired, true); assert.equal(result.historicalLiveAttempts, 1); assert.equal(result.additionalLiveAllowance, 0); assert.equal(result.nextStage, 'none_retired');
  const source = await readFile(resolve(root, 'scripts/run-author-revision-eval.mjs'), 'utf8');
  assert.doesNotMatch(source, /\bfetch\s*\(|createAgentService\s*\(|process\.env|writeFile\s*\(/);
  const cli = spawnSync(process.execPath, ['scripts/run-author-revision-eval.mjs', '--offline'], { cwd: root, encoding: 'utf8', env: {} });
  assert.equal(cli.status, 0, cli.stderr); assert.equal(JSON.parse(cli.stdout).liveCalls, 0);
});
