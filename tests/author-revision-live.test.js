import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, mkdir, writeFile, stat, readdir, rm, open } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { segmentProse } from '../src/domain/prose.js';
import { protocol, CLOSE_READ_ITEMS, SOURCE_HASHES, digest, loadFrozenTrial } from '../scripts/run-author-revision-eval.mjs';
import { STAGES, approvedConfig, validateRunHistory, verifyPriorFiles, validateExtractionGate, loadRunHistory, createDiskEvidence, runStage } from '../scripts/run-author-revision-live.mjs';

// These fixtures test guards only; repetitive prose and fabricated attestations
// are deliberately not literary-quality claims, author approval, or a close read.
const candidate = ['甲'.repeat(100), '乙'.repeat(100), '丙'.repeat(100), '丁'.repeat(100)].join('\n\n');
const closeReadRecord = (text = candidate) => ({
  protocol: protocol.id, reviewerType: 'assistant', reviewer: 'Offline guard fixture only',
  nonBlind: true, fullCandidateRead: true, textSha256: digest(text), locked: true,
  items: CLOSE_READ_ITEMS.map(id => ({ id, status: 'pass',
    explanation: 'Mechanical fixture only; this is not an actual literary assessment.',
    evidence: [{ start: 0, end: 2, quote: text.slice(0, 2) }] })),
});
const extraction = () => ({ staging: [{ label: 'Unaccepted mechanical proposal.', sourceParagraphIndex: 0 }], reviewNotes: ['Keep this test note.'] });
const review = trial => ({ summary: 'Mechanical review fixture only.', issues: [], checks: [],
  factChecks: trial.context.facts.map(f => ({ factId: f.id, recordVersion: f.recordVersion,
    status: 'not_applicable', explanation: 'Fixture prose omits this fact.', sourceQuote: '' })),
});
const envelope = (content, fields = {}) => JSON.stringify({ id: 'fake-provider-response',
  choices: [{ finish_reason: 'stop', message: { content }, ...fields }],
  usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 },
});

const trial = await loadFrozenTrial();
const SHA = 'a'.repeat(40);
const runId = stage => String(101 + STAGES.indexOf(stage));
const environment = stage => ({
  NEXUS_AUTHOR_REVISION_APPROVED: 'true', NEXUS_LIVE_ENABLED: 'true', NEXUS_OVERAGE_CONFIRMED_OFF: 'true',
  NEXUS_API_KEY: 'PRIVATE_FAKE_TEST_KEY', GITHUB_ACTIONS: 'true', GITHUB_RUN_ATTEMPT: '1',
  GITHUB_RUN_ID: runId(stage), GITHUB_SHA: SHA, GITHUB_REPOSITORY: 'fixture/repository',
  NEXUS_CI_RUN_ID: '90', ...(stage !== 'revise' ? { NEXUS_PRIOR_RUN_ID: String(Number(runId(stage)) - 1) } : {}),
});
const history = stage => STAGES.slice(0, STAGES.indexOf(stage) + 1).map(s => ({
  id: Number(runId(s)), display_title: `${protocol.id}/${s}`, head_sha: SHA, run_attempt: 1,
  event: 'workflow_dispatch', path: '.github/workflows/author-revision-trial.yml',
  status: s === stage ? 'in_progress' : 'completed', conclusion: s === stage ? null : 'success',
}));
const ci = () => ({ id: 90, path: '.github/workflows/ci.yml', head_sha: SHA, status: 'completed', conclusion: 'success' });
const toBytes = value => Buffer.isBuffer(value) ? Buffer.from(value) : Buffer.from(typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n');
const fromBytes = value => JSON.parse(Buffer.from(value).toString('utf8'));
const continuationGate = output => ({ protocol: protocol.id, reviewerType: 'assistant', reviewer: 'Offline continuation fixture',
  nonBlind: true, locked: true, status: 'pass', outputSha256: digest(output), scope: 'continuation_only_not_fact_verification',
  explanation: 'Mechanical continuation fixture only, not support certification.',
  evidence: [{ candidateIndex: 0, label: output.staging[0].label, sourceQuote: output.staging[0].sourceQuote }],
});
const copyFiles = files => Object.fromEntries(Object.entries(files).map(([name, bytes]) => [name, Buffer.from(bytes)]));
function memoryEvidence({ before = () => {} } = {}) {
  const stored = new Map(), open = new Set(), events = [];
  return { events,
    async write(name, value) {
      await before('write', name, value);
      assert.ok(!stored.has(name), `Evidence must not overwrite ${name}`);
      stored.set(name, toBytes(value)); events.push({ operation: 'write', name, bytes: toBytes(value) });
    },
    async startRaw(name) {
      await before('startRaw', name);
      assert.ok(!stored.has(name), `Raw evidence must not overwrite ${name}`);
      stored.set(name, Buffer.alloc(0)); open.add(name); events.push({ operation: 'startRaw', name });
    },
    async appendRaw(name, chunk) {
      await before('appendRaw', name, chunk);
      assert.ok(open.has(name), 'Cannot append to a closed raw artifact');
      stored.set(name, Buffer.concat([stored.get(name), Buffer.from(chunk)]));
      events.push({ operation: 'appendRaw', name, bytes: Buffer.from(chunk) });
    },
    async endRaw(name) {
      await before('endRaw', name);
      open.delete(name); events.push({ operation: 'endRaw', name });
      return stored.has(name) ? Buffer.from(stored.get(name)) : undefined;
    },
    async files() { return Object.fromEntries([...stored].map(([name, bytes]) => [name, Buffer.from(bytes)])); },
  };
}
function setup({ stage = 'revise', priorFiles = {}, closeRead = closeReadRecord(), io = memoryEvidence(),
  env = environment(stage), runs = history(stage), ciRun = ci(), raw, fetchImpl, trial: frozen = trial, extractionGate } = {}) {
  const calls = [], gaps = [];
  const responseRaw = raw ?? envelope(stage === 'revise' ? candidate : JSON.stringify(stage === 'extract' ? extraction() : review(frozen)));
  const options = { stage, env, trial: frozen, runs, ciRun, priorFiles, closeRead, io,
    extractionGate: extractionGate === undefined && stage === 'review' && priorFiles['completed-02.json'] ? continuationGate(fromBytes(priorFiles['completed-02.json']).output) : extractionGate,
    sleep: async ms => { gaps.push(ms); }, now: () => 1000,
    fetchImpl: async (url, request) => {
      calls.push({ url, request, priorWrites: [...io.events] });
      return fetchImpl ? fetchImpl(url, request) : new Response(responseRaw, { status: 200 });
    },
  };
  return { calls, gaps, io, options, raw: responseRaw, run: () => runStage(options), files: () => io.files() };
}
async function through(stage = 'revise', options = {}) {
  let files = {}, result, harness;
  for (const current of STAGES.slice(0, STAGES.indexOf(stage) + 1)) {
    harness = setup({ stage: current, priorFiles: files, ...(current === stage ? options : {}) });
    result = await harness.run(); files = await harness.files();
  }
  return { files, result, harness };
}
const artifactText = files => Object.values(files).map(bytes => bytes.toString('utf8')).join('\n');

test('fixed config requires explicit approval and the first GitHub Actions attempt', () => {
  assert.deepEqual(STAGES, ['revise', 'extract', 'review']);
  const configured = approvedConfig({ ...environment('revise'), NEXUS_API_MODEL: 'unapproved',
    NEXUS_API_BASE_URL: 'https://invalid.example', NEXUS_MAX_CALLS: '999', NEXUS_MAX_OUTPUT_TOKENS: '9999',
    NEXUS_THINKING_MODE: 'enabled', NEXUS_REASONING_EFFORT: 'high' });
  assert.equal(configured.NEXUS_API_MODEL, protocol.model);
  assert.equal(configured.NEXUS_API_BASE_URL, 'https://opencode.ai/zen/go/v1');
  assert.equal(configured.NEXUS_MAX_CALLS, '1'); assert.equal(configured.NEXUS_MAX_OUTPUT_TOKENS, '3000');
  assert.equal(configured.NEXUS_THINKING_MODE, 'disabled'); assert.equal(configured.NEXUS_REASONING_EFFORT, undefined);
  for (const key of ['NEXUS_AUTHOR_REVISION_APPROVED', 'NEXUS_LIVE_ENABLED', 'NEXUS_OVERAGE_CONFIRMED_OFF'])
    assert.throws(() => approvedConfig({ ...environment('revise'), [key]: 'false' }), /APPROVAL_REQUIRED/);
  for (const changed of [{ GITHUB_ACTIONS: 'false' }, { GITHUB_RUN_ATTEMPT: '2' }, { GITHUB_RUN_ATTEMPT: undefined }])
    assert.throws(() => approvedConfig({ ...environment('revise'), ...changed }), /FIRST_ACTIONS_ATTEMPT_REQUIRED/);
  for (const changed of [{ GITHUB_RUN_ID: 'invalid' }, { NEXUS_CI_RUN_ID: '' }, { GITHUB_SHA: 'bad' }, { GITHUB_REPOSITORY: 'ambiguous' }])
    assert.throws(() => approvedConfig({ ...environment('revise'), ...changed }), /HISTORY_INVALID/);
});

test('three sequential fake stages preserve frozen inputs, exact prose, all proposals, and unaccepted state', async () => {
  const before = JSON.stringify(trial), all = [], gaps = [];
  let files = {}, finalLedger;
  for (const stage of STAGES) {
    const h = setup({ stage, priorFiles: files }); finalLedger = await h.run();
    assert.equal(h.calls.length, 1); all.push(h.calls[0]); gaps.push(...h.gaps);
    files = await h.files();
    assert.equal(finalLedger.attempts, STAGES.indexOf(stage) + 1);
    assert.equal(finalLedger.status, stage === 'revise' ? 'awaiting_close_read' : stage === 'extract' ? 'awaiting_review' : 'complete_unaccepted');
    assert.equal(fromBytes(files['completed-01.json']).output.text, candidate);
    assert.equal(fromBytes(files[`intent-0${STAGES.indexOf(stage) + 1}.json`]).input.text, stage === 'revise' ? trial.text : candidate);
  }
  assert.deepEqual(gaps, [11000, 11000]);
  assert.equal(finalLedger.stages.length, 3); assert.equal(finalLedger.status, 'complete_unaccepted');
  assert.equal(JSON.stringify(trial), before);
  assert.equal(digest(trial.text), SOURCE_HASHES.text); assert.equal(digest(trial.context), SOURCE_HASHES.context);
  for (const [index, { url, request }] of all.entries()) {
    const body = JSON.parse(request.body), wire = JSON.parse(body.messages[1].content);
    assert.equal(url, protocol.endpoint); assert.equal(body.model, protocol.model); assert.equal(body.max_tokens, 3000);
    assert.equal(body.temperature, 0.7); assert.deepEqual(body.thinking, { type: 'disabled' });
    assert.equal(Object.hasOwn(body, 'reasoning_effort'), false); assert.equal(request.redirect, 'error');
    assert.equal(wire.action, protocol.actions[index]); assert.deepEqual(wire.input.context, trial.context);
    assert.deepEqual(Object.keys(wire.input), index === 0 ? ['text', 'instruction', 'chapterId', 'context'] : index === 1 ? ['chapterId', 'context', 'paragraphs'] : ['text', 'chapterId', 'context']);
    if (index === 0) { assert.equal(wire.input.text, trial.text); assert.equal(wire.input.instruction, trial.instruction); }
    if (index === 1) assert.deepEqual(wire.input.paragraphs, segmentProse(candidate));
    if (index === 2) assert.equal(wire.input.text, candidate);
    assert.ok(!('staging' in wire.input)); assert.equal(wire.input.chapterId, 'ch2');
  }
  const canonical = fromBytes(files['completed-02.json']).output;
  assert.equal(canonical.staging.length, 1); assert.deepEqual(canonical.reviewNotes, extraction().reviewNotes);
  assert.deepEqual(canonical.staging[0], { ...extraction().staging[0], sourceQuote: segmentProse(candidate)[0].text,
    sourceStart: segmentProse(candidate)[0].start, sourceEnd: segmentProse(candidate)[0].end });
  assert.doesNotMatch(artifactText(files), /PRIVATE_FAKE_TEST_KEY|Authorization|Bearer /);
  for (const stage of [1, 2, 3]) assert.equal(fromBytes(files[`ledger-0${stage}.json`]).stages.length, stage);
});

test('raw bytes are durably written before normalized output and invalid objective prose is retained', async () => {
  const h = setup({ raw: envelope(trial.text) }), result = await h.run(), files = await h.files();
  assert.equal(h.calls.length, 1); assert.equal(result.attempts, 1); assert.equal(result.status, 'stopped');
  assert.equal(result.stages[0].assessment.stopReason, 'HAN_350_500');
  assert.equal(files['raw-01.bin'].toString('utf8'), h.raw);
  assert.equal(fromBytes(files['completed-01.json']).output.text, trial.text);
  const lastRaw = h.io.events.findLastIndex(e => e.operation === 'appendRaw');
  const normalized = h.io.events.findIndex(e => e.name === 'completed-01.json');
  assert.ok(lastRaw >= 0 && normalized > lastRaw);
  const next = setup({ stage: 'extract', priorFiles: files });
  await assert.rejects(next.run(), /PRIOR_EVIDENCE_INVALID/); assert.equal(next.calls.length, 0);
});

test('missing, failing, uncertain, unlocked, and wrong-text close reads stop before call two', async () => {
  const { files } = await through();
  const bad = [null, {}, { ...closeReadRecord(), locked: false }, { ...closeReadRecord(), textSha256: 'f'.repeat(64) }];
  for (const status of ['fail', 'uncertain']) { const gate = closeReadRecord(); gate.items[0].status = status; bad.push(gate); }
  const missingEvidence = closeReadRecord(); missingEvidence.items[0].evidence = []; bad.push(missingEvidence);
  for (const record of bad) {
    const h = setup({ stage: 'extract', priorFiles: files, closeRead: record });
    await assert.rejects(h.run(), /GATE_FAILED/); assert.equal(h.calls.length, 0);
    const evidence = await h.files();
    assert.deepEqual(fromBytes(evidence['close-read-attempt-02.json']), record);
    assert.equal(fromBytes(evidence['blocked-stage.json']).code, 'GATE_FAILED');
  }
});

test('malformed, truncated, refused, filtered, and unexpected reasoning responses retain raw evidence without retry', async () => {
  const reasoning = JSON.parse(envelope(candidate)); reasoning.choices[0].message.reasoning_content = 'UNTRUSTED_REASONING';
  const refusal = JSON.parse(envelope(candidate)); refusal.choices[0].message.refusal = 'refused';
  const tool = JSON.parse(envelope(candidate)); tool.choices[0].message.tool_calls = [{ function: { name: 'do_not_execute' } }];
  const multiple = JSON.parse(envelope(candidate)); multiple.choices.push(structuredClone(multiple.choices[0]));
  for (const raw of ['{incomplete upstream JSON', envelope(candidate, { finish_reason: 'length' }),
    envelope(candidate, { finish_reason: 'content_filter' }), JSON.stringify(reasoning), JSON.stringify(refusal), JSON.stringify(tool), JSON.stringify(multiple)]) {
    const h = setup({ raw }), result = await h.run(), files = await h.files();
    assert.equal(result.status, 'stopped'); assert.equal(result.attempts, 1); assert.equal(h.calls.length, 1);
    assert.equal(files['raw-01.bin'].toString('utf8'), raw); assert.equal(files['completed-01.json'], undefined);
    assert.equal(result.stages[0].rawSha256, digest(raw)); assert.equal(result.stages[0].rawComplete, true);
  }
});

test('a broken response stream preserves received bytes and consumes its uncertain attempt', async () => {
  let reads = 0;
  const partial = Buffer.from('{"choices":[{"message":{"content":"PARTIAL');
  const h = setup({ fetchImpl: async () => ({ ok: true, status: 200, body: { getReader: () => ({
    read: async () => { if (reads++ === 0) return { done: false, value: partial }; throw Error('stream interrupted'); },
    cancel: async () => {},
  }) } }) });
  const result = await h.run(), files = await h.files();
  assert.equal(h.calls.length, 1); assert.equal(result.attempts, 1); assert.equal(result.status, 'stopped');
  assert.equal(files['raw-01.bin'].toString('utf8'), partial.toString('utf8'));
  assert.equal(result.stages[0].rawComplete, false); assert.equal(files['completed-01.json'], undefined);
  const next = setup({ stage: 'extract', priorFiles: files });
  await assert.rejects(next.run(), /PRIOR_EVIDENCE_INVALID/); assert.equal(next.calls.length, 0);
});

test('uncertain fetch failure consumes its stage and a repeated dispatch is denied', async () => {
  const h = setup({ fetchImpl: async () => { throw Error('uncertain network delivery'); } });
  const result = await h.run();
  assert.equal(h.calls.length, 1); assert.equal(result.attempts, 1); assert.equal(result.status, 'stopped');
  assert.equal(result.stages[0].dispatched, true); assert.equal(result.stages[0].rawComplete, false);
  const rerun = setup({ env: { ...environment('revise'), GITHUB_RUN_ATTEMPT: '2' } });
  await assert.rejects(rerun.run(), /FIRST_ACTIONS_ATTEMPT_REQUIRED/); assert.equal(rerun.calls.length, 0);
  const replay = setup({ runs: [...history('revise'), { ...history('revise')[0], id: 200 }] });
  await assert.rejects(replay.run(), /STAGE_CONSUMED/); assert.equal(replay.calls.length, 0);
});

test('second-stage empty or invalid extraction retains raw evidence and forbids call three', async () => {
  const { files } = await through();
  for (const output of [{ staging: [], reviewNotes: [] }, { staging: [{ label: 'Invalid source.', sourceParagraphIndex: 99 }], reviewNotes: [] },
    { staging: [{ label: 'Extra injected quote.', sourceParagraphIndex: 0, sourceQuote: 'invented' }], reviewNotes: [] }]) {
    const raw = envelope(JSON.stringify(output)), h = setup({ stage: 'extract', priorFiles: files, raw });
    const result = await h.run(), nextFiles = await h.files();
    assert.equal(result.status, 'stopped'); assert.equal(result.attempts, 2); assert.equal(h.calls.length, 1);
    assert.equal(nextFiles['raw-02.bin'].toString('utf8'), raw);
    assert.equal(nextFiles['completed-01.json'].toString('utf8'), files['completed-01.json'].toString('utf8'));
    const next = setup({ stage: 'review', priorFiles: nextFiles, extractionGate: null });
    await assert.rejects(next.run(), /PRIOR_EVIDENCE_INVALID/); assert.equal(next.calls.length, 0);
  }
});

test('third-stage review errors, unknowns, contradictions, omissions, and duplicate versions never become acceptance', async () => {
  const { files } = await through('extract');
  const variants = [];
  for (const status of ['unknown', 'contradiction']) { const out = review(trial); out.factChecks[0].status = status; variants.push(out); }
  const issue = review(trial); issue.issues.push({ severity: 'error', explanation: 'Blocking test issue.', sourceQuote: candidate.slice(0, 2) }); variants.push(issue);
  const missing = review(trial); missing.factChecks.pop(); variants.push(missing);
  const duplicate = review(trial); duplicate.factChecks[1] = { ...duplicate.factChecks[0] }; variants.push(duplicate);
  const stale = review(trial); stale.factChecks[0].recordVersion++; variants.push(stale);
  for (const output of variants) {
    const raw = envelope(JSON.stringify(output)), h = setup({ stage: 'review', priorFiles: files, raw });
    const result = await h.run(), evidence = await h.files();
    assert.equal(h.calls.length, 1); assert.equal(result.attempts, 3); assert.equal(result.status, 'stopped');
    assert.equal(evidence['raw-03.bin'].toString('utf8'), raw); assert.notEqual(result.status, 'complete_unaccepted');
  }
  const warning = review(trial); warning.issues.push({ severity: 'warning', explanation: 'Retain this warning.', sourceQuote: candidate.slice(0, 2) });
  const h = setup({ stage: 'review', priorFiles: files, raw: envelope(JSON.stringify(warning)) });
  assert.equal((await h.run()).status, 'complete_unaccepted');
  assert.deepEqual(fromBytes((await h.files())['completed-03.json']).output.issues, warning.issues);
});

test('history and exact-SHA CI gates reject wrong source, cancelled predecessors, non-first attempts, and call four', async () => {
  const { files, result: priorLedger } = await through('extract');
  const base = { stage: 'review', env: environment('review'), runs: history('review'), priorLedger, ciRun: ci() };
  assert.equal(validateRunHistory(base), true);
  for (const mutate of [
    args => { args.runs.push({ ...args.runs[2], id: 104 }); },
    args => { args.runs.push({ ...args.runs[2], id: 104, display_title: `${protocol.id}/fourth` }); },
    args => { args.runs[0].head_sha = 'b'.repeat(40); },
    args => { args.runs[1].conclusion = 'cancelled'; },
    args => { args.runs[1].run_attempt = 2; },
    args => { args.runs[1].id = 700; },
    args => { args.runs[2].status = 'completed'; args.runs[2].conclusion = 'success'; },
    args => { args.runs[2].event = 'push'; },
    args => { args.runs[2].path = '.github/workflows/other.yml'; },
    args => { args.runs[2].id = args.runs[1].id; },
    args => { args.ciRun.head_sha = 'b'.repeat(40); },
    args => { args.ciRun.conclusion = 'failure'; },
    args => { args.ciRun.id = 89; },
    args => { args.ciRun.path = '.github/workflows/other.yml'; },
    args => { args.ciRun.status = 'in_progress'; },
  ]) {
    const args = structuredClone(base); mutate(args); assert.throws(() => validateRunHistory(args));
    const h = setup({ ...args, priorFiles: files }); await assert.rejects(h.run()); assert.equal(h.calls.length, 0);
  }
  assert.throws(() => validateRunHistory({ ...base, stage: 'fourth' }), /INVALID_STAGE/);
});

test('cumulative artifacts reject missing, changed, extra, stopped, wrong-source, and mismatched predecessor evidence', async () => {
  const { files } = await through('extract'), env = environment('review');
  assert.equal(verifyPriorFiles(files, 'review', env, trial).attempts, 2);
  for (const name of Object.keys(files)) {
    const corrupt = copyFiles(files); corrupt[name] = Buffer.concat([corrupt[name], Buffer.from('tampered')]);
    assert.throws(() => verifyPriorFiles(corrupt, 'review', env, trial), /PRIOR_EVIDENCE_INVALID/, name);
    const missing = copyFiles(files); delete missing[name];
    assert.throws(() => verifyPriorFiles(missing, 'review', env, trial), /PRIOR_EVIDENCE_INVALID/, name);
  }
  const extra = copyFiles(files); extra['unlisted.json'] = Buffer.from('{}');
  assert.throws(() => verifyPriorFiles(extra, 'review', env, trial), /PRIOR_EVIDENCE_INVALID/);
  for (const changed of [{ GITHUB_SHA: 'b'.repeat(40) }, { NEXUS_PRIOR_RUN_ID: '999' }, { NEXUS_CI_RUN_ID: '91' }])
    assert.throws(() => verifyPriorFiles(files, 'review', { ...env, ...changed }, trial), /PRIOR_EVIDENCE_INVALID/);
  const wrongTrial = structuredClone(trial); wrongTrial.manifest.instruction += 'changed';
  assert.throws(() => verifyPriorFiles(files, 'review', env, wrongTrial), /PRIOR_EVIDENCE_INVALID/);
  assert.throws(() => verifyPriorFiles(files, 'revise', environment('revise'), trial), /PRIOR_EVIDENCE_INVALID/);
});

test('review must use the identical locked close read already persisted before extraction', async () => {
  const { files } = await through('extract'), modified = closeReadRecord(); modified.reviewer = 'Different reviewer';
  const h = setup({ stage: 'review', priorFiles: files, closeRead: modified });
  await assert.rejects(h.run(), /GATE_FAILED/); assert.equal(h.calls.length, 0);
});

test('source, context, instruction, and chapter mutations fail before the first network entry', async () => {
  for (const mutate of [t => { t.text += '改'; }, t => { t.context.events.push({ label: 'invented context' }); },
    t => { t.instruction += 'different'; }, t => { t.chapterId = 'ch3'; }]) {
    const frozen = structuredClone(trial); mutate(frozen); const h = setup({ trial: frozen });
    await assert.rejects(h.run(), /INPUT_MISMATCH/); assert.equal(h.calls.length, 0);
  }
});

test('pre-dispatch evidence failures cannot produce a provider request', async () => {
  for (const deniedName of ['intent-01.json', 'request-01.json', 'raw-01.bin', 'dispatch-01.json']) {
    const io = memoryEvidence({ before: async (_method, name) => { if (name === deniedName) throw Error('synthetic evidence failure'); } });
    const h = setup({ io });
    try { const result = await h.run(); assert.equal(result.status, 'stopped'); assert.equal(result.attempts, 0); }
    catch (error) { assert.match(error.message, /synthetic evidence failure|EVIDENCE_FAILED/); }
    assert.equal(h.calls.length, 0, deniedName);
  }
});

test('the live module stays inert on import and explicitly exports no acceptance or extra-stage action', async () => {
  const source = await readFile(new URL('../scripts/run-author-revision-live.mjs', import.meta.url), 'utf8');
  assert.match(source, /import\.meta\.url\s*===\s*pathToFileURL/);
  assert.doesNotMatch(source, /auditMemoryCandidate|acceptChapter|commitFact|acceptMemory/);
});

test('every attempt has a durable cumulative dispatch intent before entering fake transport', async () => {
  let files = {};
  for (const [index, stage] of STAGES.entries()) {
    const h = setup({ stage, priorFiles: files }), result = await h.run();
    assert.notEqual(result.status, 'stopped');
    const dispatch = h.calls[0].priorWrites.find(e => e.name === `dispatch-0${index + 1}.json`);
    assert.ok(dispatch, 'Cumulative attempted/uncertain intent must predate transport entry');
    const saved = fromBytes(dispatch.bytes);
    assert.equal(saved.attemptedOrUncertain, true); assert.equal(saved.cumulativeAttempts, index + 1);
    assert.equal(saved.priorAttempts, index); assert.equal(saved.requestSha256, digest(h.calls[0].request.body));
    assert.equal(saved.sourceSha, SHA); assert.equal(saved.runId, runId(stage));
    files = await h.files();
  }
});

test('review continuation requires a fresh pass bound to the exact extraction and retains rejected records', async () => {
  const { files } = await through('extract'), output = fromBytes(files['completed-02.json']).output;
  const good = continuationGate(output);
  assert.equal(validateExtractionGate(good, output), true);
  const records = [null, {}];
  for (const change of [r => { r.status = 'fail'; }, r => { r.status = 'uncertain'; }, r => { r.locked = false; },
    r => { r.outputSha256 = 'f'.repeat(64); }, r => { r.scope = 'facts_accepted'; }, r => { r.explanation = ''; },
    r => { r.evidence = []; }, r => { r.evidence[0].candidateIndex = 99; }, r => { r.evidence[0].sourceQuote += 'changed'; },
    r => { r.evidence[0].label = 'changed'; }]) { const record = structuredClone(good); change(record); records.push(record); }
  for (const record of records) {
    assert.equal(Boolean(validateExtractionGate(record, output)), false);
    const h = setup({ stage: 'review', priorFiles: files, extractionGate: record });
    await assert.rejects(h.run(), /GATE_FAILED/); assert.equal(h.calls.length, 0);
    const evidence = await h.files();
    assert.deepEqual(fromBytes(evidence['extraction-gate.json']), record);
    assert.equal(fromBytes(evidence['blocked-stage.json']).gate, 'extraction_continuation');
  }
});

test('credential-like echoes split across chunks are withheld and never enter artifact publication', async () => {
  const env = environment('revise'), raw = envelope(`Do not publish ${env.NEXUS_API_KEY}`);
  const split = raw.indexOf(env.NEXUS_API_KEY) + 5, parts = [raw.slice(0, split), raw.slice(split)];
  let index = 0;
  const h = setup({ env, fetchImpl: async () => ({ ok: true, status: 200, body: { getReader: () => ({
    read: async () => index < parts.length ? { done: false, value: Buffer.from(parts[index++]) } : { done: true },
    cancel: async () => {},
  }) } }) });
  const result = await h.run(), files = await h.files();
  assert.equal(result.status, 'stopped'); assert.equal(result.stages[0].error, 'SECRET_ECHO');
  assert.equal(result.stages[0].secretEchoWithheld, true); assert.equal(result.stages[0].rawComplete, false);
  assert.equal(h.calls.length, 1); assert.ok(!artifactText(files).includes(env.NEXUS_API_KEY));
  assert.equal(files['completed-01.json'], undefined);
});

test('history retrieval fetches every page and fails closed on incomplete, unstable, or unavailable history', async () => {
  const env = { ...environment('revise'), GH_TOKEN: 'PRIVATE_FAKE_GITHUB_TOKEN' }, calls = [];
  const pages = [
    { total_count: 3, workflow_runs: [{ id: 1 }, { id: 2 }] },
    { total_count: 3, workflow_runs: [{ id: 3 }] },
  ];
  const runs = await loadRunHistory(env, async (url, options) => {
    calls.push({ url, options }); return new Response(JSON.stringify(pages[calls.length - 1]));
  });
  assert.deepEqual(runs.map(r => r.id), [1, 2, 3]); assert.equal(calls.length, 2);
  assert.match(calls[0].url, /\/actions\/workflows\/author-revision-trial\.yml\/runs\?per_page=100&page=1$/);
  assert.match(calls[1].url, /page=2$/); assert.ok(calls.every(c => c.options.redirect === 'error' && c.options.method === 'GET'));
  const empty = await loadRunHistory(env, async () => new Response(JSON.stringify({ total_count: 0, workflow_runs: [] })));
  assert.deepEqual(empty, []);
  for (const responses of [
    [{ total_count: 3, workflow_runs: [{ id: 1 }] }, { total_count: 4, workflow_runs: [{ id: 2 }] }],
    [{ total_count: 3, workflow_runs: [{ id: 1 }] }, { total_count: 3, workflow_runs: [] }],
    [{ total_count: 0, workflow_runs: [{ id: 1 }] }], [{ total_count: -1, workflow_runs: [] }],
    [{ total_count: '3', workflow_runs: [] }], [{ total_count: 3, workflow_runs: {} }],
  ]) {
    let index = 0;
    await assert.rejects(loadRunHistory(env, async () => new Response(JSON.stringify(responses[index++]))), /HISTORY_INVALID/);
  }
  for (const status of [403, 404, 429, 500]) {
    let count = 0;
    await assert.rejects(loadRunHistory(env, async () => { count++; return new Response('{}', { status }); }), /HISTORY_INVALID/);
    assert.equal(count, 1, 'No automatic retry after an HTTP history failure');
  }
  let callsWithoutToken = 0;
  await assert.rejects(loadRunHistory(environment('revise'), async () => { callsWithoutToken++; return new Response('{}'); }), /HISTORY_INVALID/);
  assert.equal(callsWithoutToken, 0);
});

test('workflow is explicit-only, serialized, immutable-artifact preserving, and tests before secret injection', async () => {
  const workflow = await readFile(new URL('../.github/workflows/author-revision-trial.yml', import.meta.url), 'utf8');
  assert.match(workflow, /run-name: author-revision-v1\/\$\{\{ inputs\.stage \}\}/);
  assert.match(workflow, /workflow_dispatch:/); assert.doesNotMatch(workflow, /^\s*(?:push|pull_request|schedule|workflow_run):/m);
  assert.match(workflow, /default: false/); assert.match(workflow, /options: \[revise, extract, review\]/);
  assert.match(workflow, /inputs\.approve_trial == true && github\.run_attempt == 1/);
  assert.match(workflow, /group: author-revision-v1-lifetime/); assert.match(workflow, /cancel-in-progress: false/);
  assert.match(workflow, /persist-credentials: false/); assert.match(workflow, /overwrite: false/); assert.match(workflow, /if: always\(\)/);
  const guardsAt = workflow.indexOf('node --test tests/author-revision-eval.test.js tests/author-revision-live.test.js');
  assert.ok(guardsAt > 0 && guardsAt < workflow.indexOf('NEXUS_API_KEY:'), 'Credential-free guard tests precede secret injection');
  const uses = [...workflow.matchAll(/uses: ([^\s]+)/g)].map(m => m[1]);
  assert.ok(uses.length >= 4); assert.ok(uses.every(action => /^[^@]+@[a-f0-9]{40}$/.test(action)), 'Actions must use exact commit pins');
  assert.match(workflow, /run-id: \$\{\{ inputs\.prior_run_id \}\}/);
  assert.match(workflow, /NEXUS_EXTRACTION_GATE_JSON: \$\{\{ inputs\.extraction_gate_json \}\}/);
  assert.doesNotMatch(workflow, /continue-on-error:\s*true|actions:\s*write|contents:\s*write/);
  const { files } = await through('review');
  for (const name of Object.keys(files)) assert.ok(workflow.includes(`author-revision-evidence/${name}`), `Upload allowlist must retain cumulative ${name}`);
  assert.ok(!workflow.includes('author-revision-evidence/**'), 'Artifact publication is an explicit allowlist');
});

test('timeout retains partial safe bytes and late transport completion cannot modify final evidence', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let resolveLateRead, reachedRead;
  const waiting = new Promise(resolve => { reachedRead = resolve; });
  const late = new Promise(resolve => { resolveLateRead = resolve; });
  const prefix = Buffer.from('{"choices":[{"message":{"content":"safe partial response');
  let reads = 0;
  const h = setup({ fetchImpl: async () => ({ ok: true, status: 200, body: { getReader: () => ({
    read: async () => { if (reads++ === 0) return { done: false, value: prefix }; reachedRead(); return late; },
    cancel: async () => {},
  }) } }) });
  const pending = h.run(); await waiting; t.mock.timers.tick(30001);
  const result = await pending, files = await h.files(), before = artifactText(files), events = h.io.events.length;
  assert.equal(result.status, 'stopped'); assert.equal(result.attempts, 1); assert.equal(h.calls.length, 1);
  assert.equal(result.stages[0].error, 'UPSTREAM_TIMEOUT'); assert.equal(result.stages[0].rawComplete, false);
  assert.equal(files['raw-01.bin'].toString('utf8'), prefix.toString('utf8'));
  resolveLateRead({ done: false, value: Buffer.from('LATE_BYTES_MUST_NOT_APPEAR') });
  for (let i = 0; i < 20; i++) await Promise.resolve();
  assert.equal(artifactText(await h.files()), before); assert.equal(h.io.events.length, events);
});

test('missing or invalid provider usage remains explicitly unknown and cumulative totals are partial', async () => {
  const metrics = ['promptTokens', 'completionTokens', 'totalTokens', 'reasoningTokens'];
  for (const usage of [undefined, { prompt_tokens: -1, completion_tokens: 2.5, total_tokens: '120', completion_tokens_details: { reasoning_tokens: -1 } }]) {
    const data = JSON.parse(envelope(candidate));
    if (usage === undefined) delete data.usage; else data.usage = usage;
    const h = setup({ raw: JSON.stringify(data) }), ledger = await h.run();
    assert.equal(ledger.status, 'awaiting_close_read'); assert.deepEqual(ledger.stages[0].usage, {});
    assert.deepEqual(ledger.stages[0].missingUsageFields, metrics);
    for (const metric of metrics) assert.deepEqual(ledger.usage[metric], { knownSum: null, reportedCalls: 0, missingCalls: 1, complete: false });
    const next = setup({ stage: 'extract', priorFiles: await h.files() }), cumulative = await next.run();
    assert.deepEqual(cumulative.usage.promptTokens, { knownSum: 100, reportedCalls: 1, missingCalls: 1, complete: false });
    assert.deepEqual(cumulative.usage.reasoningTokens, { knownSum: null, reportedCalls: 0, missingCalls: 2, complete: false });
  }
  const data = JSON.parse(envelope(candidate));
  data.usage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, completion_tokens_details: { reasoning_tokens: 0 } };
  const h = setup({ raw: JSON.stringify(data) }), ledger = await h.run();
  assert.deepEqual(ledger.stages[0].missingUsageFields, []);
  for (const metric of metrics) assert.deepEqual(ledger.usage[metric], { knownSum: 0, reportedCalls: 1, missingCalls: 0, complete: true });
});

const unicodeEscape = (text, uppercase = false, mixed = false) => [...text].map((char, index) => {
  if (mixed && index % 2 === 0) return char;
  const hex = char.charCodeAt(0).toString(16).padStart(4, '0');
  return '\\u' + (uppercase ? hex.toUpperCase() : hex);
}).join('');
const decodeJsonEscapes = value => value.replace(/\\u([0-9a-f]{4})|\\(["\\/bfnrt])/gi, (_whole, hex, simple) =>
  hex ? String.fromCharCode(parseInt(hex, 16)) : ({ '"': '"', '\\': '\\', '/': '/', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' }[simple]));
function assertNoEncodedSecret(files, secret) {
  for (const [name, bytes] of Object.entries(files)) {
    let text = bytes.toString('utf8');
    for (let depth = 0; depth < 12; depth++) {
      assert.ok(!text.includes(secret), `No decoded credential in ${name}, escape depth ${depth}`);
      const decoded = decodeJsonEscapes(text);
      if (decoded === text) break;
      text = decoded;
    }
  }
}
function chunkedResponse(parts, { interrupted = false } = {}) {
  let index = 0;
  return { ok: true, status: 200, body: { getReader: () => ({
    read: async () => {
      if (index < parts.length) return { done: false, value: Buffer.from(parts[index++]) };
      if (interrupted) throw Error('Synthetic incomplete upstream stream');
      return { done: true };
    }, cancel: async () => {},
  }) } };
}

test('Unicode-escaped, mixed, nested, and chunk-split credentials cannot enter raw or normalized evidence', async () => {
  const env = environment('revise'), key = env.NEXUS_API_KEY;
  const variants = [unicodeEscape(key), unicodeEscape(key, true), unicodeEscape(key, false, true),
    unicodeEscape(key, true, true), unicodeEscape(key).replaceAll('\\', '\\\\'), unicodeEscape(key).replaceAll('\\', '\\u005c')];
  for (const encoded of variants) {
    const raw = envelope(candidate + key).replace(key, encoded);
    for (const split of [false, true]) {
      const parts = split ? Array.from({ length: Math.ceil(raw.length / 7) }, (_, index) => raw.slice(index * 7, index * 7 + 7)) : [raw];
      const h = setup({ env, fetchImpl: async () => chunkedResponse(parts) }), result = await h.run(), files = await h.files();
      assert.equal(result.status, 'stopped'); assert.equal(result.attempts, 1); assert.equal(h.calls.length, 1);
      assert.equal(result.stages[0].error, 'SECRET_ECHO'); assert.equal(result.stages[0].secretEchoWithheld, true);
      assert.equal(result.stages[0].rawComplete, false); assert.equal(files['completed-01.json'], undefined);
      assertNoEncodedSecret(files, key);
      assert.ok(!artifactText(files).includes(encoded), 'Encoded credential itself must not be published');
    }
  }
});

test('malformed and interrupted envelopes cannot leak complete or partial escaped credential strings', async () => {
  const env = environment('revise'), key = env.NEXUS_API_KEY, encoded = unicodeEscape(key);
  const valid = envelope(candidate + key).replace(key, encoded);
  const keyAt = valid.indexOf(encoded);
  const malformed = valid.slice(0, keyAt + encoded.length);
  for (const parts of [[malformed], [malformed.slice(0, keyAt + 3), malformed.slice(keyAt + 3)], ['not-json:"' + unicodeEscape(key, true, true)]]) {
    for (const interrupted of [false, true]) {
      const h = setup({ env, fetchImpl: async () => chunkedResponse(parts, { interrupted }) });
      const result = await h.run(), files = await h.files();
      assert.equal(result.status, 'stopped'); assert.equal(h.calls.length, 1); assert.equal(result.stages[0].error, 'SECRET_ECHO');
      assert.equal(files['completed-01.json'], undefined); assertNoEncodedSecret(files, key);
      assert.ok(!artifactText(files).includes(encoded));
    }
  }
  const partialEncoded = encoded.slice(0, 8 * 6 + 3), partial = valid.slice(0, keyAt) + partialEncoded;
  const h = setup({ env, fetchImpl: async () => chunkedResponse([partial], { interrupted: true }) });
  const result = await h.run(), files = await h.files();
  assert.equal(result.status, 'stopped'); assert.equal(h.calls.length, 1);
  assert.equal(files['completed-01.json'], undefined); assertNoEncodedSecret(files, key);
  assert.ok(!artifactText(files).includes(partialEncoded), 'Unfinished possible credential escape suffix must stay withheld');
});

async function inEvidenceDirectory(callback) {
  const root = await mkdtemp(join(tmpdir(), 'nexus-author-disk-'));
  try { return await callback(root, join(root, 'evidence')); }
  finally { await rm(root, { recursive: true, force: true }); }
}

test('disk evidence requires a fresh directory and exclusive safe filenames', async () => {
  await inEvidenceDirectory(async (root, dir) => {
    const io = await createDiskEvidence(dir);
    await assert.rejects(createDiskEvidence(dir), error => error.code === 'EEXIST');
    for (const name of ['../escape.json', '/tmp/escape.json', 'nested/file.json', '.hidden.json', 'UPPER.json', 'file.txt']) {
      await assert.rejects(io.write(name, 'forbidden'), /EVIDENCE_FAILED/);
      await assert.rejects(io.startRaw(name), /EVIDENCE_FAILED/);
    }
    assert.deepEqual(await readdir(dir), []); assert.deepEqual(await readdir(root), ['evidence']);
    await io.write('single.json', { retained: true });
    await assert.rejects(io.write('single.json', { replaced: true }), /EVIDENCE_FAILED/);
    await assert.rejects(io.startRaw('single.json'), /EVIDENCE_FAILED/);
    await writeFile(join(dir, 'competing.json'), 'original competing bytes', { mode: 0o600 });
    await assert.rejects(io.write('competing.json', {}), error => error.code === 'EEXIST');
    await assert.rejects(io.startRaw('competing.json'), error => error.code === 'EEXIST');
    assert.equal(await readFile(join(dir, 'competing.json'), 'utf8'), 'original competing bytes');
    assert.equal((await io.files())['competing.json'], undefined);
  });
});

test('disk evidence retains exact JSON and binary chunks with private modes and isolated inventory snapshots', async () => {
  await inEvidenceDirectory(async (_root, dir) => {
    const io = await createDiskEvidence(dir), object = { text: '中文\nexact', nested: { count: 2 } };
    await io.write('object.json', object); await io.write('string.json', 'exact string, no added newline');
    await io.write('buffer.json', Buffer.from([0, 1, 2, 255]));
    const raw = Buffer.from('一段正文\u0000end🙂', 'utf8');
    await io.startRaw('raw-01.bin');
    await assert.rejects(io.startRaw('raw-01.bin'), /EVIDENCE_FAILED/);
    await io.appendRaw('raw-01.bin', raw.subarray(0, 2));
    await io.appendRaw('raw-01.bin', Buffer.alloc(0));
    await io.appendRaw('raw-01.bin', raw.subarray(2, 9));
    await io.appendRaw('raw-01.bin', raw.subarray(9));
    assert.deepEqual(await io.endRaw('raw-01.bin'), raw); assert.deepEqual(await io.endRaw('raw-01.bin'), raw);
    await assert.rejects(io.appendRaw('raw-01.bin', Buffer.from('late')), /EVIDENCE_FAILED/);
    assert.equal(await readFile(join(dir, 'object.json'), 'utf8'), JSON.stringify(object, null, 2) + '\n');
    assert.equal(await readFile(join(dir, 'string.json'), 'utf8'), 'exact string, no added newline');
    assert.deepEqual(await readFile(join(dir, 'buffer.json')), Buffer.from([0, 1, 2, 255]));
    assert.deepEqual(await readFile(join(dir, 'raw-01.bin')), raw);
    const inventory = await io.files();
    for (const [name, bytes] of Object.entries(inventory)) {
      assert.deepEqual(await readFile(join(dir, name)), bytes); assert.equal((await stat(join(dir, name))).mode & 0o777, 0o600);
    }
    inventory['raw-01.bin'].fill(0);
    assert.deepEqual((await io.files())['raw-01.bin'], raw); assert.deepEqual(await readFile(join(dir, 'raw-01.bin')), raw);
  });
});

test('disk raw appends retry short filesystem writes without losing or duplicating bytes', async t => {
  await inEvidenceDirectory(async (root, dir) => {
    const probe = await open(join(root, 'probe'), 'wx', 0o600), prototype = Object.getPrototypeOf(probe), original = prototype.write;
    await probe.close(); let writes = 0;
    t.mock.method(prototype, 'write', async function(buffer, offset = 0, length = buffer.length - offset, position = null) {
      writes++; return Reflect.apply(original, this, [buffer, offset, Math.min(2, length), position]);
    });
    const io = await createDiskEvidence(dir), bytes = Buffer.from('Short writes must retain every UTF-8 byte: 中文🙂.');
    await io.startRaw('raw-01.bin'); await io.appendRaw('raw-01.bin', bytes);
    assert.deepEqual(await io.endRaw('raw-01.bin'), bytes);
    assert.deepEqual(await readFile(join(dir, 'raw-01.bin')), bytes);
    assert.ok(writes >= Math.ceil(bytes.length / 2), 'The implementation must loop until all bytes are written');
  });
});

test('a fake stage using real disk evidence persists dispatch intent before transport and hashes actual file bytes', async () => {
  await inEvidenceDirectory(async (_root, dir) => {
    const io = await createDiskEvidence(dir); let calls = 0;
    const ledger = await runStage({ ...setup().options, io, fetchImpl: async (_url, options) => {
      calls++; const saved = JSON.parse(await readFile(join(dir, 'dispatch-01.json'), 'utf8'));
      assert.equal(saved.attemptedOrUncertain, true); assert.equal(saved.cumulativeAttempts, 1);
      assert.equal(saved.requestSha256, digest(options.body));
      assert.equal((await stat(join(dir, 'dispatch-01.json'))).mode & 0o777, 0o600);
      return new Response(envelope(candidate));
    } });
    assert.equal(calls, 1); assert.equal(ledger.status, 'awaiting_close_read');
    const files = await io.files(), index = JSON.parse(await readFile(join(dir, 'index-01.json'), 'utf8'));
    assert.deepEqual(Object.keys(index.sha256).sort(), Object.keys(files).filter(name => name !== 'index-01.json').sort());
    for (const [name, hash] of Object.entries(index.sha256)) assert.equal(digest(await readFile(join(dir, name))), hash, name);
    assert.equal((await readFile(join(dir, 'raw-01.bin'))).toString('utf8'), envelope(candidate));
    const next = setup({ stage: 'extract', priorFiles: files }); assert.equal((await next.run()).status, 'awaiting_review');
  });
});

test('a partially persisted raw append failure is terminal and cannot duplicate bytes through a retry', async () => {
  const io = memoryEvidence(), append = io.appendRaw.bind(io); let attempts = 0;
  io.appendRaw = async (name, chunk) => {
    attempts++; await append(name, chunk.subarray(0, 17)); throw Error('Synthetic failure after writing a raw prefix');
  };
  const h = setup({ io }), ledger = await h.run(), files = await h.files();
  assert.equal(h.calls.length, 1); assert.equal(attempts, 1, 'Terminal cleanup must not repeat a failed raw append');
  assert.equal(ledger.status, 'stopped'); assert.equal(ledger.stages[0].rawComplete, false);
  assert.equal(ledger.stages[0].rawBytes, 17); assert.equal(ledger.stages[0].error, 'EVIDENCE_FAILED');
  assert.deepEqual(files['raw-01.bin'], Buffer.from(h.raw).subarray(0, 17));
  assert.equal(files['completed-01.json'], undefined);
});
