import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAgentService } from '../server/provider.js';
import { approvedConfig, protocol, ARTIFACT_NAMES, FROZEN_PATHS, proseStats, safeUsage, aggregateUsage,
  blockingOutput, createEvalController, buildSeedWorkspace, generationInput, offlineOptions, offlineTransport, createFileSaver } from '../scripts/multichapter-eval.mjs';
import { buildMultichapterFixture } from '../eval/multichapter-fixtures.mjs';

// No sockets, browser launch, process credentials or real upstream calls in this suite.
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
function setup(extra = {}) {
  const saved = {}, checkpoints = [], network = [], gaps = [], options = offlineOptions();
  const c = createEvalController({ ...options,
    sleep: async ms => { gaps.push(ms); await options.sleep(ms); },
    save: async (name, value) => { saved[name] = structuredClone(value); checkpoints.push({ name, value: structuredClone(value) }); },
    fetchImpl: async (url, request) => { network.push({ url, body: JSON.parse(request.body) }); return offlineTransport(url, request); }, ...extra });
  return { c, saved, checkpoints, network, gaps };
}
const seed = buildSeedWorkspace();
const gen = () => generationInput(seed, 0);
async function invoke(h, action, input) { const receipt = h.c.arm(action, input); const output = await h.c.run(action, input); return { output, receipt: await receipt }; }
async function chapter(h) {
  const prose = (await invoke(h, 'generateProse', gen())).output;
  const common = { text: prose.text, chapterId: 'ch1', context: gen().context };
  const extraction = (await invoke(h, 'extractMemory', common)).output;
  await invoke(h, 'reviewChapter', common);
  return invoke(h, 'auditMemoryCandidate', { label: extraction.staging[0].label, sourceQuote: extraction.staging[0].sourceQuote });
}
function noSecrets(value) { const text = JSON.stringify(value); for (const token of ['PRIVATE_SENTINEL', 'Authorization', 'Bearer ', 'reasoning_content', 'OFFLINE_ONLY_NOT_A_CREDENTIAL']) assert.ok(!text.includes(token), token); }
const envelope = (content, extra = {}) => new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content, reasoning_content: 'PRIVATE_SENTINEL' } }], usage: { prompt_tokens: 12, completion_tokens: 3, total_tokens: 15 }, ...extra }));

test('approval gates reject missing flags and reruns; provider/model/caps are fixed', () => {
  const env = offlineOptions().env;
  for (const flag of ['NEXUS_MULTICHAPTER_APPROVED', 'NEXUS_LIVE_ENABLED', 'NEXUS_OVERAGE_CONFIRMED_OFF']) assert.throws(() => approvedConfig({ ...env, [flag]: 'false' }), /APPROVAL_REQUIRED/);
  assert.throws(() => approvedConfig({ ...env, GITHUB_RUN_ATTEMPT: '2' }), /FIRST_ACTIONS_ATTEMPT_REQUIRED/);
  assert.throws(() => approvedConfig({ ...env, GITHUB_ACTIONS: 'false' }), /FIRST_ACTIONS_ATTEMPT_REQUIRED/);
  const config = approvedConfig({ ...env, NEXUS_API_MODEL: 'other', NEXUS_MAX_CALLS: '999', NEXUS_REASONING_EFFORT: 'high' });
  assert.equal(config.NEXUS_API_MODEL, protocol.model); assert.equal(config.NEXUS_MAX_CALLS, '12'); assert.equal(config.NEXUS_MAX_OUTPUT_TOKENS, '3000'); assert.equal(config.NEXUS_REASONING_EFFORT, undefined);
});
test('fixture seed is synthetic, ungenerated, confirmed and stable; new fact is not preseeded', () => {
  assert.deepEqual(seed, buildSeedWorkspace()); assert.equal(seed.state.facts.length, 2); assert.equal(seed.state.drafts.length, 0); assert.equal(seed.state.events.length, 0);
  assert.ok(seed.state.chapters.every(c => c.status === 'PLANNED'));
  assert.ok(!JSON.stringify(seed).includes(buildMultichapterFixture().addedAuthorFact));
  assert.equal(seed.state.config.chapters, undefined); assert.equal(seed.providerMode, 'server');
});
test('Han count and paragraphs are separate descriptive literary contracts', () => {
  assert.deepEqual(proseStats('中A1。\n\n文！'), { characters: 8, hanCharacters: 2, paragraphs: 2, lengthInRange: false, paragraphsInRange: false });
  assert.equal(proseStats('中'.repeat(350)).lengthInRange, true); assert.equal(proseStats('中'.repeat(501)).lengthInRange, false);
  assert.equal(blockingOutput('generateProse', { text: '短。' }), null);
});
test('twelve guarded mocked calls use order, settings, pre-dispatch evidence, independent outputs and complete telemetry', async () => {
  const h = setup(); for (let i = 0; i < 3; i++) await chapter(h); await h.c.finish();
  assert.equal(h.c.attempts, 12); assert.equal(h.network.length, 12); assert.equal(h.saved['diagnostics.json'].completedStages, 12); assert.equal(h.saved['diagnostics.json'].status, 'complete');
  assert.deepEqual(h.gaps, Array(11).fill(11000)); assert.equal(h.saved['diagnostics.json'].usage.totalTokens.knownSum, 2400);
  for (let i = 0; i < 12; i++) {
    const body = h.network[i].body; assert.equal(body.model, protocol.model); assert.equal(body.max_tokens, 3000); assert.equal(body.temperature, .7); assert.deepEqual(body.thinking, { type: 'disabled' }); assert.equal(body.reasoning_effort, undefined);
    const requestIndex = h.checkpoints.findIndex(x => x.name === `request-${String(i + 1).padStart(2, '0')}.json`);
    const outputIndex = h.checkpoints.findIndex(x => x.name === `completed-${String(i + 1).padStart(2, '0')}.json`);
    assert.ok(requestIndex >= 0 && outputIndex > requestIndex); assert.equal(h.saved[`completed-${String(i + 1).padStart(2, '0')}.json`].action, protocol.actions[i % 4]);
    if (i % 4 === 3) assert.deepEqual(Object.keys(JSON.parse(body.messages[1].content)).sort(), ['label', 'sourceQuote']);
  }
  noSecrets(h.saved); assert.throws(() => h.c.arm('generateProse', gen()));
});
test('unexpected and duplicate stages stop globally before any further sleep or network', async () => {
  const h = setup(); h.c.arm('generateProse', gen()); await assert.rejects(h.c.run('generateProse', { ...gen(), chapterIndex: 1 }));
  assert.equal(h.network.length, 0); assert.equal(h.c.terminal, true); assert.deepEqual(h.gaps, []);
  assert.throws(() => h.c.arm('generateProse', gen())); assert.equal(h.saved['diagnostics.json'].status, 'stopped');
});
test('truncated prose counts usage but creates no completed stage or retry', async () => {
  let n = 0; const h = setup({ fetchImpl: async () => { n++; return envelope('cut', { choices: [{ finish_reason: 'length', message: { content: 'cut' } }] }); } });
  h.c.arm('generateProse', gen()); await assert.rejects(h.c.run('generateProse', gen()));
  assert.equal(n, 1); assert.equal(h.saved['completed-01.json'], undefined); assert.equal(h.saved['diagnostics.json'].usage.totalTokens.knownSum, 15); assert.deepEqual(h.gaps, []); noSecrets(h.saved);
});
test('malformed extraction preserves earlier prose and counts failed response usage', async () => {
  let n = 0; const h = setup({ fetchImpl: async (url, request) => { n++; return n === 1 ? offlineTransport(url, request) : envelope('{bad'); } });
  const prose = (await invoke(h, 'generateProse', gen())).output, input = { text: prose.text, chapterId: 'ch1', context: gen().context };
  h.c.arm('extractMemory', input); await assert.rejects(h.c.run('extractMemory', input));
  assert.equal(n, 2); assert.ok(h.saved['completed-01.json']); assert.equal(h.saved['completed-02.json'], undefined); assert.equal(h.saved['diagnostics.json'].usage.totalTokens.knownSum, 215); noSecrets(h.saved);
});
test('unsupported first-candidate audit is preserved then stops with no fifth request or extra sleep', async () => {
  const h = setup({ fetchImpl: async (url, request) => {
    const input = JSON.parse(JSON.parse(request.body).messages[1].content);
    return input.label ? envelope(JSON.stringify({ status: 'unsupported', explanation: '固定失败' })) : offlineTransport(url, request);
  } });
  const result = await chapter(h); assert.equal(result.receipt.ok, false); assert.equal(h.c.attempts, 4); assert.equal(h.c.completed.length, 4);
  assert.equal(h.saved['completed-04.json'].output.status, 'unsupported'); assert.equal(h.saved['diagnostics.json'].validationReason, 'UNSUPPORTED_AUDIT');
  assert.deepEqual(h.gaps, [11000, 11000, 11000]); assert.throws(() => h.c.arm('generateProse', gen()));
});
test('blocking whole review stops before independent audit and preserves review output', async () => {
  const h = setup({ fetchImpl: async (url, request) => {
    const wire = JSON.parse(JSON.parse(request.body).messages[1].content);
    if (wire.action !== 'reviewChapter') return offlineTransport(url, request);
    return envelope(JSON.stringify({ summary: '固定阻塞', issues: [{ severity: 'error', explanation: '测试', sourceQuote: wire.input.text.slice(0, 5) }], checks: [], factChecks: wire.input.context.facts.map(f => ({ factId: f.id, recordVersion: f.recordVersion, status: 'unknown', explanation: '测试不确定', sourceQuote: '' })) }));
  } });
  const prose = (await invoke(h, 'generateProse', gen())).output, input = { text: prose.text, chapterId: 'ch1', context: gen().context };
  await invoke(h, 'extractMemory', input); const result = await invoke(h, 'reviewChapter', input);
  assert.equal(result.receipt.ok, false); assert.equal(h.c.attempts, 3); assert.equal(h.saved['completed-03.json'].output.issues.length, 1); assert.equal(h.saved['diagnostics.json'].validationReason, 'BLOCKING_REVIEW');
});
test('missing usage remains unknown, never zero', () => {
  assert.deepEqual(safeUsage({ usage: { prompt_tokens: 2, completion_tokens: -1, total_tokens: '2' } }), { promptTokens: 2 });
  assert.deepEqual(aggregateUsage([{ usage: {} }]).totalTokens, { knownSum: null, reportedCalls: 0, missingCalls: 1, complete: false });
});
test('delayed preparation that times out cannot dispatch', async () => {
  let release, entered; const barrier = new Promise(r => { release = r; }), enteredPromise = new Promise(r => { entered = r; }); let network = 0;
  const saved = {}, h = setup({ serviceFactory: config => createAgentService({ ...config, timeoutMs: 5 }),
    save: async (name, value) => { if (name === 'request-01.json') { entered(); await barrier; } saved[name] = structuredClone(value); },
    fetchImpl: async () => { network++; return envelope('不应调用'); } });
  h.c.arm('generateProse', gen()); const pending = h.c.run('generateProse', gen()); const caught = pending.catch(e => e);
  await enteredPromise; await sleep(15); release(); assert.ok(await caught instanceof Error);
  assert.equal(network, 0); assert.equal(h.c.attempts, 0); assert.equal(saved['diagnostics.json'].status, 'stopped'); assert.equal(saved['diagnostics.json'].completedStages, 0);
});
test('external stop during delayed output persistence prevents success append and later dispatch', async () => {
  let release, entered; const barrier = new Promise(r => { release = r; }), enteredPromise = new Promise(r => { entered = r; }); const saved = {};
  const h = setup({ save: async (name, value) => { if (name === 'completed-01.json') { entered(); await barrier; } saved[name] = structuredClone(value); } });
  h.c.arm('generateProse', gen()); const pending = h.c.run('generateProse', gen()).catch(e => e); await enteredPromise;
  const stopping = h.c.stop(Object.assign(Error('fixed cancellation'), { code: 'REQUEST_CANCELLED' })); release(); await stopping; assert.ok(await pending instanceof Error);
  assert.equal(h.c.completed.length, 0); assert.equal(saved['diagnostics.json'].completedStages, 0); assert.equal(saved['diagnostics.json'].status, 'stopped'); assert.equal(h.c.attempts, 1);
  assert.throws(() => h.c.arm('extractMemory', {}));
});
test('late response after service timeout cannot overwrite stopped diagnostics or save output', async () => {
  let release; const response = new Promise(r => { release = r; });
  const h = setup({ serviceFactory: config => createAgentService({ ...config, timeoutMs: 5 }), fetchImpl: () => response });
  h.c.arm('generateProse', gen()); await assert.rejects(h.c.run('generateProse', gen()));
  const before = structuredClone(h.saved['diagnostics.json']); release(envelope('迟到')); await sleep(15);
  assert.deepEqual(h.saved['diagnostics.json'], before); assert.equal(h.saved['completed-01.json'], undefined); assert.equal(h.c.attempts, 1);
  assert.equal(before.usage.totalTokens.missingCalls, 1);
});
test('never-resolving checkpoint times out, aborts its writer and permits terminal diagnostics', async () => {
  const saved = {}; let aborted = false, network = 0;
  const h = setup({ checkpointTimeoutMs: 5, save: async (name, value, { signal }) => {
    if (name === 'request-01.json') { signal.addEventListener('abort', () => { aborted = true; }); return new Promise(() => {}); }
    saved[name] = structuredClone(value);
  }, fetchImpl: async () => { network++; return envelope('不应调用'); } });
  h.c.arm('generateProse', gen()); await assert.rejects(h.c.run('generateProse', gen()));
  assert.equal(aborted, true); assert.equal(network, 0); assert.equal(h.c.attempts, 0); assert.equal(saved['diagnostics.json'].status, 'stopped'); assert.equal(saved['diagnostics.json'].code, 'EVIDENCE_PERSISTENCE_FAILED');
});
test('atomic file saver rejects aborted late writes and immutable checkpoint reuse', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'nexus-multichapter-save-'));
  try {
    const save = createFileSaver(directory), abort = new AbortController(); abort.abort();
    await save('diagnostics.json', { status: 'stopped', diagnosticRevision: 2 });
    await assert.rejects(save('diagnostics.json', { status: 'running', diagnosticRevision: 1 }, { signal: abort.signal }));
    assert.equal(JSON.parse(await readFile(join(directory, 'diagnostics.json'), 'utf8')).status, 'stopped');
    await save('completed-01.json', { synthetic: true }); await assert.rejects(save('completed-01.json', { synthetic: false }));
    assert.equal(JSON.parse(await readFile(join(directory, 'completed-01.json'), 'utf8')).synthetic, true);
    assert.deepEqual((await readdir(directory)).sort(), ['completed-01.json', 'diagnostics.json']);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
test('second transport attempt in one stage is blocked independently before dispatch', async () => {
  let count = 0;
  const h = setup({ serviceFactory: config => createAgentService({ ...config, fetchImpl: async (url, options) => { await config.fetchImpl(url, options); return config.fetchImpl(url, options); } }),
    fetchImpl: async (url, options) => { count++; return offlineTransport(url, options); } });
  h.c.arm('generateProse', gen()); await assert.rejects(h.c.run('generateProse', gen()));
  assert.equal(count, 1); assert.equal(h.c.attempts, 1); assert.equal(h.saved['diagnostics.json'].validationReason, 'REQUEST_COUNT'); assert.equal(h.saved['completed-01.json'], undefined);
});
test('allowlist and freeze cover effective UI, context, protocol and workflow; no old evidence edits', async () => {
  for (const path of ['src/main.tsx', 'src/App.tsx', 'src/styles.css', 'src/domain/engine.ts', 'src/domain/memory-review.ts', 'src/domain/fact-review.ts', 'src/domain/prose.ts', 'src/storage.ts', 'src/authoring/index.ts', 'src/authoring/wizard.css', 'server/provider.ts', 'server/index.ts', 'package-lock.json', '.github/workflows/live-smoke.yml']) assert.ok(FROZEN_PATHS.includes(path), path);
  assert.equal(new Set(FROZEN_PATHS).size, FROZEN_PATHS.length); assert.equal(new Set(ARTIFACT_NAMES).size, ARTIFACT_NAMES.length);
  assert.ok(!ARTIFACT_NAMES.some(x => x.includes('*') || x.includes('/') || /raw|headers/i.test(x)));
  const source = await readFile(new URL('../scripts/multichapter-eval.mjs', import.meta.url), 'utf8');
  assert.ok(source.includes('--offline-smoke')); assert.ok(source.includes('HOSTED_CI_ONLY')); assert.ok(source.includes('60000'));
});
