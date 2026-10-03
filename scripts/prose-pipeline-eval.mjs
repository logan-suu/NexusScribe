/** Opt-in synthetic architecture pilot. No retries, paid judge calls, or raw provider logs. */
import {pathToFileURL} from 'node:url';
import {createHash, randomInt} from 'node:crypto';
import {mkdir, writeFile, rename} from 'node:fs/promises';
import {performance} from 'node:perf_hooks';
import {createAgentService, SAFE_VALIDATION_REASONS} from '../server/provider.js';
import {fixtures, buildPair} from '../eval/writing-quality-fixtures.mjs';
import {segmentProse} from '../src/domain/prose.js';

export const protocol = Object.freeze({
  id: 'prose-pipeline-v1', version: 1, model: 'deepseek-v4.1-flash', temperature: 0.7,
  maxTokens: 3000, maxCalls: 9, thinking: 'disabled', minimumGapMs: 11000,
  target: '450–600 Chinese characters', seed: null,
  arms: {legacy: ['generateChapter'], proseFirst: ['generateProse', 'extractMemory']},
  fixtureOrder: ['mystery', 'warm-fantasy', 'slice-of-life'],
});
export const ARTIFACT_NAMES = Object.freeze([
  'inputs.json', 'diagnostics.json', 'blind-pairs.json', 'unblinding.json',
  ...Array.from({length: protocol.maxCalls}, (_, i) => `completed-${String(i + 1).padStart(2, '0')}.json`),
]);
const digest = x => createHash('sha256').update(x).digest('hex');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const stages = ['generateChapter', 'generateProse', 'extractMemory'];
const safeCodes = new Set(['NOT_CONFIGURED', 'INVALID_INPUT', 'INVALID_MODEL_OUTPUT', 'UPSTREAM_ERROR', 'UPSTREAM_TIMEOUT', 'OUTPUT_TRUNCATED', 'CALL_LIMIT', 'RATE_LIMIT', 'CONCURRENT_LIMIT', 'REQUEST_CANCELLED', 'EVAL_PROTOCOL_ERROR']);
const evalReasons = new Set(['REQUEST_LIMIT', 'STAGE_REQUEST_COUNT', 'REQUEST_SETTINGS', 'LEGACY_RESULT_SHAPE', 'PROSE_RESULT_SHAPE', 'EXTRACTION_RESULT_SHAPE', 'RESPONSE_SIZE', 'RESPONSE_BODY', 'BLINDING_CHOICE', 'FIXTURE_SET']);
const usageKeys = ['promptTokens', 'completionTokens', 'totalTokens', 'reasoningTokens'];
const object = x => !!x && typeof x === 'object' && !Array.isArray(x);
const string = (x, max = 30000) => typeof x === 'string' && !!x.trim() && x.length <= max;
const fail = reason => {const error = Error('Pipeline evaluation protocol rejected'); error.code = 'EVAL_PROTOCOL_ERROR'; error.validationReason = reason; throw error;};
const safeError = error => ({
  code: safeCodes.has(error?.code) ? error.code : 'EVAL_STOPPED',
  ...((SAFE_VALIDATION_REASONS.includes(error?.validationReason) || evalReasons.has(error?.validationReason)) ? {validationReason: error.validationReason} : {}),
});

export function approvedConfig(env) {
  if (env.NEXUS_PROSE_PIPELINE_APPROVED !== 'true' || env.NEXUS_LIVE_ENABLED !== 'true' || env.NEXUS_OVERAGE_CONFIRMED_OFF !== 'true') throw Error('APPROVAL_REQUIRED');
  if (env.GITHUB_ACTIONS !== 'true' || env.GITHUB_RUN_ATTEMPT !== '1') throw Error('FIRST_ACTIONS_ATTEMPT_REQUIRED');
  return {...env, NEXUS_API_BASE_URL: 'https://opencode.ai/zen/go/v1', NEXUS_API_MODEL: protocol.model,
    NEXUS_THINKING_MODE: 'disabled', NEXUS_REASONING_EFFORT: undefined,
    NEXUS_MAX_CALLS: String(protocol.maxCalls), NEXUS_MAX_OUTPUT_TOKENS: String(protocol.maxTokens)};
}

export function buildInputs() {
  if (fixtures.length !== 3 || fixtures.some((f, i) => f.id !== protocol.fixtureOrder[i])) fail('FIXTURE_SET');
  // Both generation arms use the structured input, not the old plain-brief ablation.
  return fixtures.map(fixture => ({fixture: fixture.id, input: buildPair(fixture).nexus}));
}

export function safeUsage(data) {
  const values = {promptTokens: data?.usage?.prompt_tokens, completionTokens: data?.usage?.completion_tokens,
    totalTokens: data?.usage?.total_tokens, reasoningTokens: data?.usage?.completion_tokens_details?.reasoning_tokens};
  return Object.fromEntries(Object.entries(values).filter(([, value]) => Number.isSafeInteger(value) && value >= 0 && value <= 1e9));
}

/** Descriptive sums of reported counts only. Unknown values are never imputed as zero. */
export function aggregateUsage(calls) {
  return Object.fromEntries(usageKeys.map(key => {
    const known = calls.filter(call => Object.hasOwn(call.usage, key));
    return [key, {knownSum: known.length ? known.reduce((sum, call) => sum + call.usage[key], 0) : null,
      reportedCalls: known.length, missingCalls: calls.length - known.length, complete: known.length === calls.length && calls.length > 0}];
  }));
}

function stats(text) {
  const sentences = text.split(/[。！？]/u).map(x => x.trim()).filter(Boolean);
  return {characters: [...text].length, hanCharacters: (text.match(/\p{Script=Han}/gu) || []).length,
    paragraphs: segmentProse(text).length, repeatedExactSentences: sentences.filter((x, i) => sentences.indexOf(x) !== i).length};
}

async function inspectResponse(response, record) {
  record.httpStatus = Number.isInteger(response.status) ? response.status : null;
  const reader = response.body?.getReader();
  if (!reader) {
    // An empty HTTP error body is valid transport evidence, never a fabricated response.
    if (!response.ok) return response;
    fail('RESPONSE_BODY');
  }
  const chunks = []; let size = 0;
  try {
    for (;;) {
      const {done, value} = await reader.read(); if (done) break;
      size += value.byteLength; if (size > 128 * 1024) fail('RESPONSE_SIZE'); chunks.push(value);
    }
  } finally {await reader.cancel().catch(() => {});}
  const bytes = Buffer.concat(chunks);
  record.responseBytes = size;
  try {
    const data = JSON.parse(bytes.toString('utf8'));
    record.usage = safeUsage(data);
    const finish = data?.choices?.[0]?.finish_reason;
    record.finishReason = ['stop', 'length', 'content_filter', 'tool_calls'].includes(finish) ? finish : 'unknown';
    const content = data?.choices?.[0]?.message?.content;
    record.finalContentPresent = typeof content === 'string' && !!content.trim();
  } catch {record.finishReason = 'unknown';}
  // Raw body exists transiently only; never return it in an artifact or log it.
  return new Response(bytes, {status: response.status});
}

function projectOutput(action, result, input) {
  const errorReason = action === 'generateChapter' ? 'LEGACY_RESULT_SHAPE' : action === 'generateProse' ? 'PROSE_RESULT_SHAPE' : 'EXTRACTION_RESULT_SHAPE';
  if (!object(result)) fail(errorReason);
  const output = {};
  if (action !== 'extractMemory') {
    if (!string(result.text) || result.chapterId !== input.chapterId) fail(errorReason);
    output.text = result.text; output.chapterId = result.chapterId;
  }
  if (action !== 'generateProse') {
    if (!Array.isArray(result.staging) || result.staging.length > 30 || !Array.isArray(result.reviewNotes) || result.reviewNotes.length > 30 || result.reviewNotes.some(note => !string(note, 2000))) fail(errorReason);
    const text = action === 'extractMemory' ? input.text : result.text;
    output.staging = result.staging.map(event => {
      if (!object(event) || !string(event.label, 1000) || !string(event.sourceQuote, action === 'extractMemory' ? 30000 : 4000) || !text.includes(event.sourceQuote)) fail(errorReason);
      const entry = {label: event.label, sourceQuote: event.sourceQuote};
      if (Object.hasOwn(event, 'sourceParagraphIndex')) {
        if (!Number.isInteger(event.sourceParagraphIndex) || event.sourceParagraphIndex < 0 || (action === 'extractMemory' ? segmentProse(text)[event.sourceParagraphIndex]?.text : text.split('\n')[event.sourceParagraphIndex]) !== event.sourceQuote) fail(errorReason);
        entry.sourceParagraphIndex = event.sourceParagraphIndex;
      }
      if (action === 'extractMemory') {
        const paragraph = segmentProse(text)[event.sourceParagraphIndex];
        if (!paragraph || event.sourceStart !== paragraph.start || event.sourceEnd !== paragraph.end || text.slice(event.sourceStart, event.sourceEnd) !== event.sourceQuote) fail(errorReason);
        entry.sourceStart = event.sourceStart; entry.sourceEnd = event.sourceEnd;
      }
      return entry;
    });
    output.reviewNotes = [...result.reviewNotes];
  }
  return output;
}

export async function runProsePipelineEval({env = process.env, fetchImpl = globalThis.fetch, sleep = wait,
  choose = randomInt, now = () => performance.now(), serviceFactory = createAgentService,
  log = console.log, save = async () => {}} = {}) {
  const config = approvedConfig(env), inputs = buildInputs();
  const started = now(), calls = [], phases = [], completedPairs = [], mapping = [];
  let attempts = 0, current = null, completedPhases = 0, terminal = false;
  const requestStarts = new Map();
  let diagnosticWrites = Promise.resolve(), diagnosticRevision = 0;
  const elapsed = start => Math.max(0, now() - start);
  const safeSave = async (name, data) => {
    if (!ARTIFACT_NAMES.includes(name)) fail('REQUEST_SETTINGS');
    const snapshot = structuredClone(data);
    if (name !== 'diagnostics.json') return save(name, snapshot);
    snapshot.diagnosticRevision = ++diagnosticRevision;
    // The injected persistence may be asynchronous. Never let an older write
    // finish after the terminal record; recover the queue after a failed write.
    const pending = diagnosticWrites.catch(() => {}).then(() => {
      if (terminal && snapshot.status === 'running') return;
      return save(name, snapshot);
    });
    diagnosticWrites = pending;
    await pending;
  };
  const diagnostics = (status, error) => ({protocol, status, attempts, requestsPrepared: calls.length, attemptAccountingComplete: status !== 'running', completedPhases, completedPairs: completedPairs.length,
    ...(typeof env.GITHUB_SHA === 'string' && /^[a-f\d]{40}$/i.test(env.GITHUB_SHA) ? {sourceCommit: env.GITHUB_SHA} : {}),
    ...(typeof env.GITHUB_RUN_ID === 'string' && /^\d+$/.test(env.GITHUB_RUN_ID) ? {runId: env.GITHUB_RUN_ID} : {}),
    ...(error ? safeError(error) : {}),
    workflowElapsedMs: elapsed(started),
    timingNote: 'Monotonic milliseconds. Stage service latency includes in-service telemetry writes and excludes throttle and output checkpoints; workflow elapsed includes both. No billing or cost inference.',
    usage: aggregateUsage(calls.filter(call => call.dispatched)),
    byStage: Object.fromEntries(stages.map(stage => {
      const records = calls.filter(call => call.stage === stage && call.dispatched), runs = phases.filter(phase => phase.stage === stage);
      return [stage, {phaseInvocations: runs.length, attemptedRequests: records.length,
        successfulPhases: runs.filter(phase => phase.status === 'complete').length,
        measuredServiceMs: runs.reduce((sum, phase) => sum + (phase.serviceElapsedMs ?? 0), 0),
        measuredRequestMs: records.reduce((sum, call) => sum + (call.requestElapsedMs ?? 0), 0), usage: aggregateUsage(records)}];
    })),
    byArm: Object.fromEntries(['legacy', 'proseFirst'].map(arm => {
      const records = calls.filter(call => call.arm === arm && call.dispatched), runs = phases.filter(phase => phase.arm === arm);
      return [arm, {attemptedRequests: records.length, measuredServiceMs: runs.reduce((sum, phase) => sum + (phase.serviceElapsedMs ?? 0), 0), usage: aggregateUsage(records)}];
    })),
    byFixture: inputs.map(({fixture}) => ({fixture, arms: Object.fromEntries(['legacy', 'proseFirst'].map(arm => {
      const runs = phases.filter(phase => phase.fixture === fixture && phase.arm === arm);
      const generation = runs.find(phase => phase.stage === (arm === 'legacy' ? 'generateChapter' : 'generateProse'));
      const extraction = runs.find(phase => phase.stage === 'extractMemory');
      const proseAvailable = generation?.checkpointSaved === true;
      const memoryAvailable = proseAvailable && (arm === 'legacy' || extraction?.checkpointSaved === true);
      return [arm, {proseAvailable, memoryAvailable,
        firstProseServiceMs: proseAvailable ? generation.serviceElapsedMs : null,
        completePipelineServiceMs: memoryAvailable ? runs.reduce((sum, phase) => sum + phase.serviceElapsedMs, 0) : null}];
    }))})),
    phases, calls});

  // Immutable input is persisted before any provider request. A failed input write makes zero calls.
  await safeSave('inputs.json', {protocol, inputs, informationParity: 'Both generation arms receive identical input; extraction receives the resulting prose, the same chapterId and context.'});
  const service = serviceFactory({env: config, now, fetchImpl: async (url, options) => {
    if (!current || current.requestCount !== 0) fail('STAGE_REQUEST_COUNT');
    if (attempts >= protocol.maxCalls) fail('REQUEST_LIMIT');
    let body; try {body = JSON.parse(options.body);} catch {fail('REQUEST_SETTINGS');}
    if (url !== 'https://opencode.ai/zen/go/v1/chat/completions' || options.method !== 'POST' || options.redirect !== 'error' || body.model !== protocol.model || body.max_tokens !== protocol.maxTokens || body.thinking?.type !== 'disabled' || Object.hasOwn(body, 'reasoning_effort')) fail('REQUEST_SETTINGS');
    body.temperature = protocol.temperature;
    const serialized = JSON.stringify(body);
    // Persist the prepared intent first. A failed write is not an outbound attempt.
    current.requestCount++;
    const record = {sequence: attempts + 1, fixture: current.fixture, arm: current.arm, stage: current.stage,
      requestSha256: digest(serialized), inputBytes: Buffer.byteLength(serialized), inputCharacters: [...serialized].length,
      status: 'prepared', dispatched: false, requestElapsedMs: null, usage: {}};
    calls.push(record);
    await safeSave('diagnostics.json', diagnostics('running'));
    // A service timeout can win while the prepared-intent write is pending.
    // Recheck after that await: even an already-aborted fetch is an extra call.
    if (terminal || options.signal?.aborted) throw Object.assign(Error('Evaluation stopped before dispatch'), {code: 'REQUEST_CANCELLED'});
    const requestStarted = now(); requestStarts.set(record.sequence, requestStarted);
    attempts++; record.dispatched = true; record.status = 'attempted';
    try {
      const upstream = await fetchImpl(url, {...options, body: serialized});
      // A transport that ignores cancellation must not overwrite the terminal timeout record later.
      if (terminal) return upstream;
      const response = await inspectResponse(upstream, record);
      record.status = response.ok ? 'response_received' : 'http_error'; return response;
    } catch (error) {
      if (!terminal) {record.status = 'transport_failed'; Object.assign(record, safeError(error));} throw error;
    } finally {
      if (!terminal) {record.requestElapsedMs = elapsed(requestStarted); await safeSave('diagnostics.json', diagnostics('running'));}
    }
  }});

  async function runPhase(fixture, arm, stage, input) {
    if (attempts) await sleep(protocol.minimumGapMs);
    const phaseStarted = now();
    const phase = {fixture, arm, stage, requestCount: 0, status: 'running', serviceElapsedMs: null, checkpointSaved: false};
    phases.push(phase); current = phase;
    try {
      const result = await service.run(stage, structuredClone(input));
      phase.serviceElapsedMs = elapsed(phaseStarted);
      if (phase.requestCount !== 1) fail('STAGE_REQUEST_COUNT');
      const output = projectOutput(stage, result, input), call = calls.at(-1);
      phase.status = 'complete'; call.status = 'validated'; completedPhases++;
      if (output.text) {call.output = stats(output.text); call.outputSha256 = digest(output.text);}
      else {call.stagingCount = output.staging.length; call.reviewNotesCount = output.reviewNotes.length;}
      // Save prose before extraction starts; an extraction failure cannot delete or replace it.
      await safeSave(`completed-${String(call.sequence).padStart(2, '0')}.json`, {fixture, arm, stage, sequence: call.sequence,
        ...output, ...(output.text ? {output: call.output, outputSha256: call.outputSha256} : {inputProseSha256: digest(input.text)})});
      phase.checkpointSaved = true;
      await safeSave('diagnostics.json', diagnostics('running'));
      log(`prose-pipeline completed ${completedPhases}/9`);
      return output;
    } catch (error) {
      phase.serviceElapsedMs ??= elapsed(phaseStarted); phase.status = 'failed'; Object.assign(phase, safeError(error));
      if (phase.requestCount) {
        const call = calls.at(-1);
        if (call.status === 'response_received') call.status = 'validation_failed';
        if (call.requestElapsedMs === null && requestStarts.has(call.sequence)) {
          call.requestElapsedMs = elapsed(requestStarts.get(call.sequence)); call.status = 'interrupted'; Object.assign(call, safeError(error));
        }
      }
      throw error;
    } finally {current = null;}
  }

  try {
    for (let i = 0; i < inputs.length; i++) {
      const {fixture: id, input} = inputs[i], fixture = fixtures[i], outputs = {};
      for (const arm of i % 2 === 0 ? ['legacy', 'proseFirst'] : ['proseFirst', 'legacy']) {
        if (arm === 'legacy') outputs.legacy = await runPhase(id, arm, 'generateChapter', input);
        else {
          outputs.proseFirst = await runPhase(id, arm, 'generateProse', input);
          await runPhase(id, arm, 'extractMemory', {text: outputs.proseFirst.text, chapterId: input.chapterId, context: input.context});
        }
      }
      const choice = choose(2); if (choice !== 0 && choice !== 1) fail('BLINDING_CHOICE');
      const first = choice === 0 ? 'legacy' : 'proseFirst', second = first === 'legacy' ? 'proseFirst' : 'legacy';
      completedPairs.push({id, brief: {title: fixture.title, prior: fixture.prior, scene: fixture.scene, goal: fixture.goal,
        voice: fixture.voice, constraints: fixture.constraints, length: protocol.target}, A: outputs[first].text, B: outputs[second].text});
      mapping.push({id, A: first, B: second});
    }
    // No partial blind corpus: all three pairs and all nine validated stages must succeed.
    if (attempts !== protocol.maxCalls || completedPhases !== protocol.maxCalls || completedPairs.length !== 3) fail('STAGE_REQUEST_COUNT');
    await safeSave('unblinding.json', {mapping});
    await safeSave('blind-pairs.json', {notice: 'Exploratory synthetic architecture pilot. Lock prose judgments before seeing mapping, memory outputs or diagnostics. Not a statistical benchmark.', pairs: completedPairs});
    terminal = true;
    await safeSave('diagnostics.json', diagnostics('complete'));
    return {status: 'complete', attempts, completedPhases, pairs: completedPairs};
  } catch (error) {
    terminal = true;
    await safeSave('diagnostics.json', diagnostics('stopped', error));
    log(`prose-pipeline stopped ${attempts}/9 ${safeError(error).code}`);
    throw Error('Prose pipeline evaluation stopped; no automatic retry');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const directory = 'prose-pipeline-evidence';
  try {
    approvedConfig(process.env);
    // Refuse an existing run directory: reruns cannot overwrite or cherry-pick evidence.
    await mkdir(directory);
    await runProsePipelineEval({save: async (name, data) => {
      if (!ARTIFACT_NAMES.includes(name)) fail('REQUEST_SETTINGS');
      if (name === 'diagnostics.json') {
        await writeFile(`${directory}/.diagnostics.tmp`, JSON.stringify(data, null, 2) + '\n');
        await rename(`${directory}/.diagnostics.tmp`, `${directory}/${name}`);
      } else await writeFile(`${directory}/${name}`, JSON.stringify(data, null, 2) + '\n', {flag: 'wx'});
    }});
  } catch {process.exitCode = 1;}
}
