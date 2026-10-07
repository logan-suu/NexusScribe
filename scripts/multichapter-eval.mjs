/** Credential-free maintenance replay of the retired live journey. Optional model judgments are mocked; quote selection does not depend on them. Never retries or dispatches on import. */
import { createHash, randomUUID } from 'node:crypto';
import { readFile, mkdir, writeFile, unlink } from 'node:fs/promises';
import { renameSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import http from 'node:http';
import { performance } from 'node:perf_hooks';
import { createAgentService, SAFE_VALIDATION_REASONS } from '../server/provider.js';
import { createHandler } from '../server/index.js';
import { createProjectFromConfig, proposeCustomPatch, commitPatch, getContext, getFactReviewGate } from '../src/domain/engine.js';
import { segmentProse } from '../src/domain/prose.js';
import { parseBackup, KEY } from '../src/storage.js';
import { buildMultichapterFixture } from '../eval/multichapter-fixtures.mjs';

export const protocol = Object.freeze({ id: 'multichapter-v1', version: 1,
  endpoint: 'https://opencode.ai/zen/go/v1/chat/completions', model: 'deepseek-v4.1-flash',
  maxCalls: 12, maxTokens: 3000, maxOutputTokens: 36000, temperature: 0.7, thinking: 'disabled', minimumGapMs: 11000,
  chapters: 3, targetHan: Object.freeze([350, 500]), targetParagraphs: Object.freeze([4, 7]),
  actions: Object.freeze(['generateProse', 'extractMemory', 'reviewChapter', 'auditMemoryCandidate']) });
export const FROZEN_PATHS = Object.freeze([
  'eval/MULTICHAPTER-PROTOCOL.md', 'eval/multichapter-fixtures.mjs', 'scripts/multichapter-eval.mjs',
  'tests/multichapter-eval.test.js', 'server/provider.js', 'server/provider-transport.js', 'server/index.js', 'src/App.jsx',
  'src/domain/engine.js', 'src/domain/memory-review.js', 'src/domain/fact-review.js', 'src/domain/prose.js',
  'src/storage.js', 'src/adapters/provider.js', 'src/authoring/live-provider.js',
  'src/components/DraftPanel.jsx', 'src/components/SceneIntent.jsx', 'src/domain/scene-intent.js',
  'src/components/ProviderPanel.jsx', 'src/components/Editor.jsx',
  'src/components/PatchPanel.jsx', 'src/components/Sidebar.jsx', 'src/hooks/useModelTask.js',
  'src/components/ProjectWizard.jsx', 'src/components/Inspector.jsx', 'src/components/HistoryView.jsx',
  'src/components/ModelTaskStatus.jsx', 'src/main.jsx', 'src/styles.css', 'src/authoring/index.js',
  'src/authoring/wizard.css', 'index.html', 'vite.config.js', 'package.json', 'package-lock.json', '.github/workflows/live-smoke.yml'
]);
export const ARTIFACT_NAMES = Object.freeze(['inputs.json', 'diagnostics.json', 'final-workspace.json',
  'author-fact-checkpoint.json', 'chapter-1.png', 'chapter-2.png', 'chapter-3.png', 'stopped.png',
  ...Array.from({ length: 12 }, (_, i) => `request-${String(i + 1).padStart(2, '0')}.json`),
  ...Array.from({ length: 12 }, (_, i) => `completed-${String(i + 1).padStart(2, '0')}.json`)]);
const digest = value => createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value)).digest('hex');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const codes = new Set(['PROTOCOL_RETIRED', 'MULTICHAPTER_PROTOCOL_ERROR', 'EVIDENCE_PERSISTENCE_FAILED', 'UI_JOURNEY_FAILED', 'SEMANTIC_BLOCK', 'REQUEST_CANCELLED', 'NOT_CONFIGURED', 'INVALID_INPUT', 'INVALID_MODEL_OUTPUT', 'UPSTREAM_ERROR', 'UPSTREAM_TIMEOUT', 'OUTPUT_TRUNCATED', 'CALL_LIMIT', 'RATE_LIMIT', 'CONCURRENT_LIMIT']);
const reasons = new Set(['FROZEN_MANIFEST', 'REQUEST_ORDER', 'REQUEST_COUNT', 'REQUEST_LIMIT', 'REQUEST_SETTINGS', 'INPUT_MISMATCH', 'RESPONSE_BODY', 'RESPONSE_SIZE', 'RESPONSE_ENVELOPE', 'STAGE_NOT_ARMED', 'UI_STATE', 'FACT_PROPAGATION', 'MEMORY_PROPAGATION', 'PROSE_RETENTION', 'EMPTY_EXTRACTION', 'UNSUPPORTED_AUDIT', 'BLOCKING_REVIEW']);
const problem = reason => Object.assign(Error('Synthetic multichapter protocol stopped'), { code: 'MULTICHAPTER_PROTOCOL_ERROR', validationReason: reason });
const fail = reason => { throw problem(reason); };
const safeError = e => ({ code: codes.has(e?.code) ? e.code : 'UI_JOURNEY_FAILED', ...((reasons.has(e?.validationReason) || SAFE_VALIDATION_REASONS.includes(e?.validationReason)) ? { validationReason: e.validationReason } : {}) });
export function approvedConfig(env) {
  if (env.NEXUS_MULTICHAPTER_APPROVED !== 'true' || env.NEXUS_LIVE_ENABLED !== 'true' || env.NEXUS_OVERAGE_CONFIRMED_OFF !== 'true') throw Error('APPROVAL_REQUIRED');
  if (env.GITHUB_ACTIONS !== 'true' || env.GITHUB_RUN_ATTEMPT !== '1') throw Error('FIRST_ACTIONS_ATTEMPT_REQUIRED');
  return { ...env, NEXUS_API_BASE_URL: 'https://opencode.ai/zen/go/v1', NEXUS_API_MODEL: protocol.model,
    NEXUS_THINKING_MODE: 'disabled', NEXUS_REASONING_EFFORT: undefined, NEXUS_MAX_CALLS: '12', NEXUS_MAX_OUTPUT_TOKENS: '3000' };
}
export async function verifyFrozenManifest() {
  try {
    const manifest = JSON.parse(await readFile(new URL('../eval/multichapter-manifest.json', import.meta.url), 'utf8'));
    if (manifest.protocol !== protocol.id || manifest.version !== protocol.version || !object(manifest.sha256) || !equal(Object.keys(manifest.sha256).sort(), [...FROZEN_PATHS].sort())) fail('FROZEN_MANIFEST');
    for (const path of FROZEN_PATHS) if (!/^[a-f0-9]{64}$/.test(manifest.sha256[path]) || digest(await readFile(new URL('../' + path, import.meta.url))) !== manifest.sha256[path]) fail('FROZEN_MANIFEST');
    return manifest;
  } catch { fail('FROZEN_MANIFEST'); }
}
export function proseStats(text) {
  return { characters: [...text].length, hanCharacters: (text.match(/\p{Script=Han}/gu) || []).length, paragraphs: segmentProse(text).length,
    lengthInRange: (text.match(/\p{Script=Han}/gu) || []).length >= 350 && (text.match(/\p{Script=Han}/gu) || []).length <= 500,
    paragraphsInRange: segmentProse(text).length >= 4 && segmentProse(text).length <= 7 };
}
export function safeUsage(data) {
  return Object.fromEntries(Object.entries({ promptTokens: data?.usage?.prompt_tokens, completionTokens: data?.usage?.completion_tokens,
    totalTokens: data?.usage?.total_tokens, reasoningTokens: data?.usage?.completion_tokens_details?.reasoning_tokens })
    .filter(([, v]) => Number.isSafeInteger(v) && v >= 0 && v <= 1e9));
}
export function aggregateUsage(calls) {
  return Object.fromEntries(['promptTokens', 'completionTokens', 'totalTokens', 'reasoningTokens'].map(key => {
    const known = calls.filter(c => Object.hasOwn(c.usage, key));
    return [key, { knownSum: known.length ? known.reduce((s, c) => s + c.usage[key], 0) : null,
      reportedCalls: known.length, missingCalls: calls.length - known.length, complete: calls.length > 0 && known.length === calls.length }];
  }));
}
export function blockingOutput(action, out) {
  if (action === 'extractMemory' && !out.staging.length) return 'EMPTY_EXTRACTION';
  if (action === 'auditMemoryCandidate' && out.status !== 'supported') return 'UNSUPPORTED_AUDIT';
  if (action === 'reviewChapter' && (out.issues.some(x => x.severity === 'error') || out.factChecks.some(x => ['contradiction', 'unknown'].includes(x.status)))) return 'BLOCKING_REVIEW';
  return null;
}
async function captureResponse(response, record, signal) {
  record.httpStatus = Number.isInteger(response.status) ? response.status : null;
  const reader = response.body?.getReader(); if (!reader) { if (!response.ok) return response; fail('RESPONSE_BODY'); }
  const chunks = []; let size = 0;
  const onAbort = () => { void reader.cancel().catch(() => {}); };
  signal?.addEventListener('abort', onAbort, { once: true });
  try { for (;;) {
    if (signal?.aborted) throw Object.assign(Error('cancelled'), { code: 'REQUEST_CANCELLED' });
    const part = await reader.read(); if (signal?.aborted) throw Object.assign(Error('cancelled'), { code: 'REQUEST_CANCELLED' });
    if (part.done) break; size += part.value.byteLength; if (size > 128 * 1024) fail('RESPONSE_SIZE'); chunks.push(part.value);
  } } finally { signal?.removeEventListener('abort', onAbort); await reader.cancel().catch(() => {}); }
  const bytes = Buffer.concat(chunks); record.responseBytes = size;
  let data; try { data = JSON.parse(bytes.toString('utf8')); } catch { record.finishReason = 'unknown'; }
  if (data) {
    record.usage = safeUsage(data); const choice = data.choices?.[0];
    record.finishReason = ['stop', 'length', 'content_filter', 'tool_calls'].includes(choice?.finish_reason) ? choice.finish_reason : 'unknown';
    record.finalContentPresent = typeof choice?.message?.content === 'string' && !!choice.message.content.trim();
    if (response.ok && (data.error || !Array.isArray(data.choices) || data.choices.length !== 1 || choice?.message?.refusal || choice?.message?.tool_calls?.length || !['stop', 'length'].includes(choice?.finish_reason))) fail('RESPONSE_ENVELOPE');
  }
  return new Response(bytes, { status: response.status });
}

/** Testable guarded service. Only a freshly armed visible-UI stage may dispatch. */
export function createEvalController({ env, save, fetchImpl = globalThis.fetch, sleep = delay, now = () => performance.now(), serviceFactory = createAgentService, checkpointTimeoutMs = 5000 } = {}) {
  const config = approvedConfig(env); if (typeof save !== 'function') throw Object.assign(Error('persistence required'), { code: 'EVIDENCE_PERSISTENCE_FAILED' });
  const started = now(), calls = [], completed = []; let current = null, terminal = false, terminalError = null, attempts = 0, writes = Promise.resolve(), revision = 0;
  const elapsed = start => Math.max(0, now() - start);
  const diagnostics = status => ({ protocol, executionMode: env.NEXUS_EVAL_OFFLINE === 'true' ? 'offline_mock' : 'live', status, attempts, requestsPrepared: calls.length, completedStages: completed.length,
    attemptAccountingComplete: status !== 'running',
    accountingNote: 'A prepared running checkpoint may already have dispatched. Hard-interrupted calls remain uncertain; missing usage is never zero. Counts describe observed local dispatch, not independent billing.',
    ...(typeof env.GITHUB_SHA === 'string' && /^[a-f\d]{40}$/i.test(env.GITHUB_SHA) ? { sourceCommit: env.GITHUB_SHA } : {}),
    ...(typeof env.GITHUB_RUN_ID === 'string' && /^\d+$/.test(env.GITHUB_RUN_ID) ? { runId: env.GITHUB_RUN_ID } : {}),
    ...(terminalError ? safeError(terminalError) : {}), workflowElapsedMs: elapsed(started), usage: aggregateUsage(calls.filter(c => c.dispatched)), calls });
  async function checkpoint(name, value) {
    if (!ARTIFACT_NAMES.includes(name) || name.endsWith('.png')) fail('REQUEST_SETTINGS');
    const copy = structuredClone(value); if (name === 'diagnostics.json') copy.diagnosticRevision = ++revision;
    const persist = async () => {
      if (terminal && name === 'diagnostics.json' && copy.status === 'running') return;
      const cancellation = new AbortController(); let timer;
      try {
        await Promise.race([Promise.resolve().then(() => save(name, copy, { signal: cancellation.signal })),
          new Promise((_, reject) => { timer = setTimeout(() => { cancellation.abort(); reject(Error('write timeout')); }, checkpointTimeoutMs); })]);
      } catch { cancellation.abort(); throw Object.assign(Error('evidence persistence failed'), { code: 'EVIDENCE_PERSISTENCE_FAILED' }); }
      finally { clearTimeout(timer); }
    };
    const pending = writes.catch(() => {}).then(persist); writes = pending; await pending;
  }
  async function stop(error) {
    if (terminal) return;
    terminal = true; terminalError = error;
    current?.resolveReceipt({ ok: false, error: safeError(error) });
    await checkpoint('diagnostics.json', diagnostics('stopped'));
  }
  const service = serviceFactory({ env: config, now, fetchImpl: async (url, options) => {
    try {
    if (terminal || !current || current.requestCount++) fail('REQUEST_COUNT');
    if (attempts >= protocol.maxCalls) fail('REQUEST_LIMIT');
    let body; try { body = JSON.parse(options.body); } catch { fail('REQUEST_SETTINGS'); }
    const keys = Object.keys(body).sort();
    if (!equal(keys, ['max_tokens', 'messages', 'model', 'thinking'].sort()) || url !== protocol.endpoint || options.method !== 'POST' || options.redirect !== 'error' || body.model !== protocol.model || body.max_tokens !== 3000 || !equal(body.thinking, { type: 'disabled' }) || !Array.isArray(body.messages) || body.messages.length !== 2 || body.messages[0].role !== 'system' || body.messages[1].role !== 'user') fail('REQUEST_SETTINGS');
    let actual; try { actual = JSON.parse(body.messages[1].content); } catch { fail('INPUT_MISMATCH'); }
    const expected = current.action === 'auditMemoryCandidate' ? current.input : { action: current.action, input: current.action === 'extractMemory' ? { chapterId: current.input.chapterId, context: current.input.context, paragraphs: segmentProse(current.input.text) } : current.action === 'generateProse' ? { ...current.input, chapterId: current.input.project.outline[current.input.chapterIndex].id } : current.input };
    if (!equal(actual, expected)) fail('INPUT_MISMATCH');
    body.temperature = protocol.temperature; const serialized = JSON.stringify(body);
    const record = { sequence: calls.length + 1, action: current.action, chapter: current.chapter, requestSha256: digest(serialized), inputBytes: Buffer.byteLength(serialized), dispatched: false, status: 'prepared', usage: {} };
    calls.push(record); current.record = record;
    await checkpoint(`request-${String(record.sequence).padStart(2, '0')}.json`, { sequence: record.sequence, action: current.action, chapter: current.chapter, input: current.input, requestSha256: record.requestSha256 });
    await checkpoint('diagnostics.json', diagnostics('running'));
    if (terminal || options.signal?.aborted) throw Object.assign(Error('cancelled'), { code: 'REQUEST_CANCELLED' });
    attempts++; record.dispatched = true; record.status = 'attempted'; const start = now();
    try {
      const response = await fetchImpl(url, { ...options, body: serialized });
      if (terminal || options.signal?.aborted) { void response.body?.cancel().catch(() => {}); throw Object.assign(Error('cancelled'), { code: 'REQUEST_CANCELLED' }); }
      const received = structuredClone(record);
      try { const captured = await captureResponse(response, received, options.signal); if (!terminal) Object.assign(record, received, { status: captured.ok ? 'response_received' : 'http_error' }); return captured; }
      catch (error) { if (!terminal) Object.assign(record, received); throw error; }
    } catch (error) { if (!terminal) Object.assign(record, safeError(error), { status: 'transport_failed' }); throw error; }
    finally { if (!terminal) { record.transportElapsedMs = elapsed(start); await checkpoint('diagnostics.json', diagnostics('running')); } }
    } catch (error) { if (current && !terminal) current.transportError = error; throw error; }
  } });
  return {
    status: () => service.status(), checkpoint, stop, diagnostics: () => diagnostics(terminal ? terminalError ? 'stopped' : 'complete' : 'running'),
    get terminal() { return terminal; }, get error() { return terminalError; }, get attempts() { return attempts; }, get completed() { return structuredClone(completed); },
    arm(action, input) {
      if (terminal || current || action !== protocol.actions[completed.length % 4] || completed.length >= 12) fail('REQUEST_ORDER');
      let resolveReceipt; const receipt = new Promise(resolve => { resolveReceipt = resolve; });
      current = { action, input: structuredClone(input), chapter: Math.floor(completed.length / 4) + 1, requestCount: 0, resolveReceipt };
      return receipt;
    },
    async run(action, input, options = {}) {
      const stage = current;
      try {
        if (terminal || !stage) fail('STAGE_NOT_ARMED');
        if (stage.running || action !== stage.action || !equal(input, stage.input)) fail('INPUT_MISMATCH');
        stage.running = true;
        if (attempts) { if (terminal) fail('REQUEST_ORDER'); await sleep(protocol.minimumGapMs); }
        if (terminal || options.signal?.aborted) throw Object.assign(Error('cancelled'), { code: 'REQUEST_CANCELLED' });
        const start = now(), result = await service.run(action, input, options);
        if (terminal || options.signal?.aborted) throw Object.assign(Error('cancelled'), { code: 'REQUEST_CANCELLED' });
        if (stage.requestCount !== 1) fail('REQUEST_COUNT');
        const { provider, ...output } = result;
        const entry = { sequence: attempts, chapter: stage.chapter, action, output, outputSha256: digest(output), serviceElapsedMs: elapsed(start), ...(action === 'generateProse' ? { stats: proseStats(output.text) } : {}) };
        await checkpoint(`completed-${String(attempts).padStart(2, '0')}.json`, entry);
        if (terminal || options.signal?.aborted) throw Object.assign(Error('cancelled'), { code: 'REQUEST_CANCELLED' });
        completed.push(entry); stage.record.status = 'validated';
        const blocking = blockingOutput(action, output);
        if (blocking) { stage.record.status = 'semantic_block'; await stop(Object.assign(problem(blocking), { code: 'SEMANTIC_BLOCK' })); }
        else {
          await checkpoint('diagnostics.json', diagnostics('running'));
          if (terminal || options.signal?.aborted) throw Object.assign(Error('cancelled'), { code: 'REQUEST_CANCELLED' });
        }
        stage.resolveReceipt({ ok: !blocking, output, ...(blocking ? { error: safeError(terminalError) } : {}) });
        current = null; return result;
      } catch (error) {
        const cause = stage?.transportError || error;
        await stop(cause).catch(() => {}); stage?.resolveReceipt({ ok: false, error: safeError(cause) }); current = null; throw cause;
      }
    },
    async finish() { if (terminal || current || completed.length !== 12 || attempts !== 12) fail('REQUEST_COUNT'); terminal = true; await checkpoint('diagnostics.json', diagnostics('complete')); }
  };
}

export function buildSeedWorkspace() {
  const fixture = buildMultichapterFixture();
  const config = { ...fixture.project, chapters: fixture.project.outline.map((entry, index) => ({ title: `第${['一', '二', '三'][index]}章 ${entry.title}`, ...(index === 0 ? { text: fixture.firstChapterReference } : {}) })) };
  let state = createProjectFromConfig(config);
  for (const statement of fixture.initialFacts) state = commitPatch(state, proposeCustomPatch(state, 'ch1', { intent: 'author_fact', statement }));
  // The config carries the fixed contract; reference and later accepted text live in sources.
  delete state.config.chapters;
  return parseBackup(JSON.stringify({ format: 1, serial: 0, state, editing: {}, patch: null, providerMode: 'server' }));
}
export function generationInput(workspace, index) {
  const state = workspace.state;
  return { project: { ...state.config, outline: state.chapters.map((ch, i) => ({ ...state.config.outline[i], id: ch.id, title: state.config.outline[i].title || ch.title, goal: state.config.outline[i].goal || '沿已有线索推进，保持角色知识边界' })) }, chapterIndex: index, context: getContext(state) };
}
export function verifyContinuityInput(workspace, index, retained) {
  const context = getContext(workspace.state), fixture = buildMultichapterFixture();
  for (let i = 0; i < index; i++) {
    const source = context.sources.find(s => s.chapterId === `ch${i + 1}`);
    const expected = retained[i].text + (i === 0 ? '\n\n' + fixture.addedAuthorFact : '');
    if (!source || source.text !== expected || source.role !== 'accepted_manuscript') fail('PROSE_RETENTION');
  }
  if (index > 0 && !context.facts.some(f => f.label === fixture.addedAuthorFact && f.authority === 'explicit_author_decision' && f.status === 'confirmed')) fail('FACT_PROPAGATION');
  if (index > 0 && context.events.some(e => e.id === retained[0].eventId)) fail('MEMORY_PROPAGATION');
  if (index > 0 && !(context.memoryContext?.staleSource >= 1)) fail('MEMORY_PROPAGATION');
  if (index === 2 && !context.events.some(e => e.id === retained[1].eventId && e.source.chapterId === 'ch2' && e.label === retained[1].label)) fail('MEMORY_PROPAGATION');
  return context;
}

export async function browserJourney({ page, controller, screenshot, baseURL = 'http://127.0.0.1:5173' }) {
  const seed = buildSeedWorkspace(), fixture = buildMultichapterFixture(), retained = [];
  await page.addInitScript(({ key, workspace }) => { if (localStorage.getItem(key) === null) localStorage.setItem(key, JSON.stringify(workspace)); }, { key: KEY, workspace: seed });
  await page.goto(baseURL); await page.getByRole('button', { name: '生成当前章', exact: true }).waitFor();
  const readWorkspace = async () => parseBackup(await page.evaluate(key => localStorage.getItem(key), KEY));
  const waitState = predicate => page.waitForFunction(({ key, source }) => { const w = JSON.parse(localStorage.getItem(key)); return new Function('w', `return (${source})(w)`)(w); }, { key: KEY, source: predicate.toString() }, { timeout: 10000 });
  // Only fixed internal predicates execute; all state changes below are visible UI actions.
  async function perform(action, input, button, ready) {
    const receipt = controller.arm(action, input);
    let timer; const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(problem('UI_STATE')), 60000); });
    const outcome = await Promise.race([(async () => { await page.getByRole('button', { name: button, exact: typeof button === 'string' }).click(); return receipt; })(), timeout]).finally(() => clearTimeout(timer));
    if (!outcome.ok) throw Object.assign(problem(outcome.error?.validationReason || 'UI_STATE'), { code: outcome.error?.code || 'UI_JOURNEY_FAILED' });
    await waitState(ready); return outcome.output;
  }
  async function mode(which) {
    await page.getByRole('button', { name: '模型运行方式', exact: true }).click();
    if (which === 'server') { await page.getByRole('button', { name: '检查服务连接', exact: true }).click(); await page.getByRole('button', { name: '使用真实模型', exact: true }).click(); }
    else await page.getByRole('button', { name: '使用离线模板', exact: true }).click();
  }
  for (let index = 0; index < 3; index++) {
    if (controller.terminal) fail('REQUEST_ORDER');
    await page.getByRole('navigation', { name: '章节', exact: true }).getByRole('button').nth(index).click();
    let workspace = await readWorkspace(); verifyContinuityInput(workspace, index, retained);
    const prose = await perform('generateProse', generationInput(workspace, index), '生成当前章', w => w.state.drafts.at(-1)?.requiresExtraction && w.state.drafts.at(-1)?.extraction?.status === 'pending');
    workspace = await readWorkspace(); let draft = workspace.state.drafts.at(-1);
    if (draft.text !== prose.text || !draft.proseVersions.some(v => v.text === prose.text)) fail('PROSE_RETENTION');
    const extraction = await perform('extractMemory', { text: draft.text, chapterId: draft.chapterId, context: getContext(workspace.state) }, '提取候选记忆', w => w.state.drafts.at(-1)?.extraction?.status === 'complete');
    workspace = await readWorkspace(); draft = workspace.state.drafts.at(-1);
    await perform('reviewChapter', { text: draft.text, chapterId: draft.chapterId, context: getContext(workspace.state) }, '审查候选稿', w => !!w.state.drafts.at(-1)?.modelReview);
    workspace = await readWorkspace(); draft = workspace.state.drafts.at(-1);
    if (getFactReviewGate(workspace.state, draft.id).some(x => x.blocking && !x.resolved) || draft.modelReview.issues.some(x => x.severity === 'error')) fail('BLOCKING_REVIEW');
    const first = draft.staging[0]; if (!first || extraction.staging.length !== draft.staging.length) fail('EMPTY_EXTRACTION');
    await perform('auditMemoryCandidate', { label: first.label, sourceQuote: first.sourceQuote }, /^独立核对候选记忆 1：/, w => w.state.drafts.at(-1)?.memorySupport?.attempts?.at(-1)?.state === 'complete');
    await page.getByRole('button', { name: /^保留原文摘录候选记忆 1：/ }).click();
    for (let i = 1; i < draft.staging.length; i++) await page.getByRole('button', { name: new RegExp(`^拒绝候选记忆 ${i + 1}：`) }).click();
    await page.getByRole('button', { name: '接受此版本', exact: true }).click();
    await page.getByRole('button', { name: '确认接受正文与所选记忆', exact: true }).click();
    await waitState(w => w.state.drafts.at(-1)?.status === 'ACCEPTED');
    workspace = await readWorkspace(); draft = workspace.state.drafts.at(-1);
    const ownEvents = workspace.state.events.filter(e => e.draftId === draft.id);
    if (ownEvents.length !== 1 || ownEvents[0].originalLabel !== first.label || ownEvents[0].source.quote !== first.sourceQuote || ownEvents[0].memoryKind !== 'textual_excerpt' || draft.text !== prose.text || draft.acceptedMemoryDecisions.filter(d => d.action === 'keep_quote').length !== 1) fail('UI_STATE');
    retained.push({ text: prose.text, eventId: ownEvents[0].id, label: ownEvents[0].label, rejectedLabels: draft.staging.slice(1).map(c => c.label) });
    await screenshot(`chapter-${index + 1}.png`);
    if (index === 0) {
      const before = controller.attempts;
      await mode('template'); await page.getByLabel('章节正文', { exact: true }).fill(prose.text + '\n\n' + fixture.addedAuthorFact);
      await page.getByRole('button', { name: '保存并分析', exact: true }).click();
      await page.getByRole('dialog', { name: '确认改文类型', exact: true }).locator('textarea').fill(fixture.addedAuthorFact);
      await page.getByRole('button', { name: '按这条设定准备补丁', exact: true }).click();
      await page.getByRole('button', { name: '确认并提交状态', exact: true }).click();
      workspace = await readWorkspace(); verifyContinuityInput(workspace, 1, retained);
      if (controller.attempts !== before || !workspace.state.events.some(e => e.id === retained[0].eventId) || !workspace.state.chapters[0].revisions.some(r => r.text === prose.text)) fail('UI_STATE');
      await controller.checkpoint('author-fact-checkpoint.json', { workspace, callsUsed: controller.attempts, context: getContext(workspace.state) });
      await mode('server');
    }
  }
  const workspace = await readWorkspace(); await controller.checkpoint('final-workspace.json', { workspace, retained, verification: { acceptedChapters: 3, selectedEvents: 3, calls: controller.attempts } });
  await controller.finish(); return controller.diagnostics();
}

export async function runMultichapterEval({ env = process.env, fetchImpl = globalThis.fetch, sleep = delay, now = () => performance.now(), save, screenshot, createBrowser, manifestVerifier = verifyFrozenManifest } = {}) {
  approvedConfig(env); const manifest = await manifestVerifier(), seed = buildSeedWorkspace();
  const controller = createEvalController({ env, fetchImpl, sleep, now, save });
  await controller.checkpoint('inputs.json', { protocol, executionMode: env.NEXUS_EVAL_OFFLINE === 'true' ? 'offline_mock' : 'live', fixture: buildMultichapterFixture(), seedWorkspace: seed, freeze: manifest });
  let api, vite, browser, page;
  try {
    api = http.createServer(createHandler(controller));
    await new Promise((done, reject) => { api.once('error', reject); api.listen(8787, '127.0.0.1', done); });
    const { createServer } = await import('vite'); vite = await createServer({ server: { host: '127.0.0.1', port: 5173, strictPort: true } }); await vite.listen();
    browser = createBrowser ? await createBrowser() : await (await import('@playwright/test')).chromium.launch({ headless: true });
    page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }); page.setDefaultTimeout(15000);
    return await browserJourney({ page, controller, screenshot: async name => { if (!ARTIFACT_NAMES.includes(name) || !name.endsWith('.png')) fail('REQUEST_SETTINGS'); await screenshot(name, await page.screenshot({ fullPage: true })); } });
  } catch (error) {
    await controller.stop(error).catch(() => {});
    if (page) {
      try { const raw = await page.evaluate(key => localStorage.getItem(key), KEY); const workspace = parseBackup(raw); if (workspace.state.projectId === seed.state.projectId) await controller.checkpoint('final-workspace.json', { workspace, stopped: true }); } catch {}
      try { await screenshot('stopped.png', await page.screenshot({ fullPage: true })); } catch {}
    }
    throw Object.assign(Error('Multichapter evaluation stopped; no automatic retry'), safeError(error));
  } finally { await browser?.close().catch(() => {}); await vite?.close().catch(() => {}); if (api?.listening) await new Promise(done => api.close(done)); }
}

/** Fixed fake upstream for the hosted-CI browser preflight. Never delegates to fetch. */
export async function offlineTransport(_url, options) {
  const message = JSON.parse(JSON.parse(options.body).messages[1].content), action = message.action || 'auditMemoryCandidate', input = message.input || message;
  let output;
  if (action === 'generateProse') {
    const n = input.chapterIndex + 1;
    output = `许宁把第${n}张记录纸放在桌上。她把右耳朝向门口，左耳仍然听不见。阿青站在檐下，没有查看那只信封。这是合成离线浏览器测试正文，不是模型文学输出。\n\n阿青把一只空木盒推到桌边。许宁将纸屑收进盒子，记下明早还要来核对的约定。两人没有打开柜门，也没有查明寄信人的身份。\n\n寄存室的铜铃已经损坏，不能发出声音。许宁伸手敲了敲门板，等管理员回应。管理员只让他们保管好纸屑，说旧记录明天才能查。\n\n许宁带上木盒，阿青替她扶住门。两人站在檐下商量次日上午的分工。雨水顺着旧屋檐落下，他们没有提前得到明天的记录，也没有把猜测当成答案。`;
  } else if (action === 'extractMemory') output = { staging: input.paragraphs.slice(0, 2).map(p => ({ label: p.text.split('。')[0] + '。', sourceParagraphIndex: p.index })), reviewNotes: ['固定合成测试输出，不代表模型质量'] };
  else if (action === 'reviewChapter') output = { summary: '固定合成测试审阅，不代表真实判断', issues: [], checks: ['离线结构流'], factChecks: input.context.facts.filter(f => f.status === 'confirmed' && f.authority === 'explicit_author_decision').map(f => ({ factId: f.id, recordVersion: f.recordVersion, status: 'not_applicable', explanation: '仅用于离线结构测试', sourceQuote: '' })) };
  else if (action === 'auditMemoryCandidate') output = { status: 'supported', explanation: '固定合成离线支持判断，不是模型证据' };
  else fail('REQUEST_ORDER');
  return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: typeof output === 'string' ? output : JSON.stringify(output) } }], usage: { prompt_tokens: 100, completion_tokens: 100, total_tokens: 200 } }));
}
export function offlineOptions() {
  let time = 0;
  return { env: { NEXUS_MULTICHAPTER_APPROVED: 'true', NEXUS_LIVE_ENABLED: 'true', NEXUS_OVERAGE_CONFIRMED_OFF: 'true', NEXUS_API_KEY: 'OFFLINE_ONLY_NOT_A_CREDENTIAL', GITHUB_ACTIONS: 'true', GITHUB_RUN_ATTEMPT: '1', NEXUS_EVAL_OFFLINE: 'true' },
    fetchImpl: offlineTransport, now: () => time, sleep: async ms => { time += ms; } };
}

/** Abort-aware atomic saver; temporary files are never in the artifact allowlist. */
export function createFileSaver(out) {
  const latest = new Map(), written = new Set(); let sequence = 0;
  return async (name, value, { signal } = {}) => {
    if (!ARTIFACT_NAMES.includes(name) || name.endsWith('.png')) fail('REQUEST_SETTINGS');
    const mutable = ['diagnostics.json', 'final-workspace.json'].includes(name);
    if (!mutable && written.has(name)) fail('REQUEST_SETTINGS');
    const id = ++sequence, path = resolve(out, name), temporary = resolve(out, `.${name}.${randomUUID()}.tmp`);
    latest.set(name, id);
    try {
      await writeFile(temporary, JSON.stringify(value, null, 2) + '\n', { flag: 'wx', signal });
      if (signal?.aborted || latest.get(name) !== id) throw Object.assign(Error('cancelled write'), { code: 'EVIDENCE_PERSISTENCE_FAILED' });
      // Synchronous atomic rename leaves no asynchronous gap after the last signal/revision check.
      renameSync(temporary, path); written.add(name);
    } catch (error) { await unlink(temporary).catch(() => {}); throw error; }
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const offline = process.argv[2] === '--offline-smoke';
    // This one-shot live protocol has concluded. Keep only credential-free CI replay active.
    if (!offline) throw Object.assign(Error('COMPLETED_PROTOCOL_REQUIRES_NEW_APPROVAL'), {code:'PROTOCOL_RETIRED'});
    if (offline && process.env.GITHUB_ACTIONS !== 'true') throw Error('HOSTED_CI_ONLY');
    if (!offline) approvedConfig(process.env); await verifyFrozenManifest();
    const out = resolve(process.argv[offline ? 3 : 2] || (offline ? 'multichapter-offline-evidence' : 'multichapter-evidence')); await mkdir(out, { recursive: false });
    const save = createFileSaver(out);
    const screenshot = async (name, bytes) => { if (!ARTIFACT_NAMES.includes(name) || !name.endsWith('.png')) fail('REQUEST_SETTINGS'); await writeFile(resolve(out, name), bytes, { flag: 'wx' }); };
    const result = await runMultichapterEval({ ...(offline ? offlineOptions() : {}), save, screenshot }); console.log(JSON.stringify({ executionMode: result.executionMode, status: result.status, attempts: result.attempts }));
  } catch (error) { console.error(JSON.stringify(safeError(error))); process.exitCode = 1; }
}
