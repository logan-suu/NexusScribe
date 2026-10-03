import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {runProsePipelineEval, approvedConfig, buildInputs, aggregateUsage, protocol, ARTIFACT_NAMES} from '../scripts/prose-pipeline-eval.mjs';
import {fixtures, buildPair} from '../eval/writing-quality-fixtures.mjs';
import {createAgentService} from '../server/provider.js';
import {segmentProse} from '../src/domain/prose.js';

const env = {NEXUS_PROSE_PIPELINE_APPROVED: 'true', NEXUS_LIVE_ENABLED: 'true', NEXUS_OVERAGE_CONFIRMED_OFF: 'true',
  NEXUS_API_KEY: 'SYNTHETIC_TEST_KEY', GITHUB_ACTIONS: 'true', GITHUB_RUN_ATTEMPT: '1', GITHUB_SHA: 'a'.repeat(40), GITHUB_RUN_ID: '1234'};
const prose = '她把白线穿过鞋带，停了一下。\n“明天再补牢。”她说。';
const wireOutput = (stage, input) => stage === 'extractMemory' ? {staging: [{label: '她用白线修补鞋带', sourceParagraphIndex: 0}], reviewNotes: []}
  : {paragraphs: prose.split('\n'), chapterId: input.chapterId, ...(stage === 'generateChapter' ? {staging: [], reviewNotes: []} : {})};
const response = (output, {finish = 'stop', usage = {prompt_tokens: 100, completion_tokens: 10, total_tokens: 110}} = {}) => new Response(JSON.stringify({choices: [{finish_reason: finish,
  message: {content: JSON.stringify(output), reasoning_content: 'PRIVATE_REASONING_SENTINEL'}}], usage: {...usage, private: 'PRIVATE_USAGE_SENTINEL'}, private: 'PRIVATE_RESPONSE_SENTINEL'}));
const providerError = (code, validationReason) => Object.assign(Error('PRIVATE_ERROR_TEXT_SENTINEL'), {code, validationReason, stack: 'PRIVATE_STACK_SENTINEL'});

/** Fake service deliberately uses the same bounded transport as production, without any live call. */
function fakeService({fetchImpl, env}, {before, after, repeat = false, advance = () => {}} = {}) {
  return {run: async (stage, input) => {
    await before?.(stage, input);
    const request = {method: 'POST', redirect: 'error', headers: {Authorization: `Bearer ${env.NEXUS_API_KEY}`},
      body: JSON.stringify({model: env.NEXUS_API_MODEL, max_tokens: Number(env.NEXUS_MAX_OUTPUT_TOKENS), thinking: {type: env.NEXUS_THINKING_MODE},
        messages: [{role: 'system', content: `unchanged production ${stage} schema`}, {role: 'user', content: JSON.stringify({action: stage, input})}]})};
    const res = await fetchImpl(env.NEXUS_API_BASE_URL + '/chat/completions', request);
    if (repeat) await fetchImpl(env.NEXUS_API_BASE_URL + '/chat/completions', request);
    if (!res.ok) throw providerError('UPSTREAM_ERROR');
    const envelope = await res.json();
    advance(5);
    if (envelope.choices?.[0]?.finish_reason === 'length') throw providerError('OUTPUT_TRUNCATED');
    let wire; try {wire = JSON.parse(envelope.choices[0].message.content);} catch {throw providerError('INVALID_MODEL_OUTPUT', 'INVALID_JSON');}
    let output;
    if (stage === 'extractMemory') {
      output = {...wire, staging: wire.staging?.map(event => {
        const paragraph = segmentProse(input.text)[event.sourceParagraphIndex];
        const sourceQuote = paragraph.text;
        const sourceStart = paragraph.start;
        return {...event, sourceQuote, sourceStart, sourceEnd: sourceStart + sourceQuote.length};
      })};
    } else output = {...wire, text: wire.paragraphs?.join('\n')};
    output.provider = {private: 'PRIVATE_PROVIDER_SENTINEL'};
    return after ? after(stage, input, output) : output;
  }};
}

function setup(overrides = {}) {
  const saved = {}, requests = [], invocations = [], logs = [], sleeps = [], order = [];
  let time = 0;
  const advance = ms => {time += ms;};
  const options = {env, now: () => time, choose: () => 1, log: x => logs.push(x),
    sleep: async ms => {sleeps.push(ms); advance(ms);},
    save: async (name, data) => {saved[name] = structuredClone(data); order.push(`save:${name}`);},
    serviceFactory: config => fakeService(config, {advance, before: (stage, input) => {invocations.push({stage, input: structuredClone(input)}); order.push(`run:${stage}`);}}),
    fetchImpl: async (url, options) => {
      const body = JSON.parse(options.body), {action, input} = JSON.parse(body.messages[1].content);
      requests.push({url, options, body, action, input}); advance(7);
      return response(wireOutput(action, input));
    }, ...overrides};
  return {saved, requests, invocations, logs, sleeps, order, advance, options, run: () => runProsePipelineEval(options)};
}

const assertNoPrivate = value => {
  const json = JSON.stringify(value);
  for (const forbidden of ['PRIVATE_', env.NEXUS_API_KEY, 'Authorization', 'reasoning_content', 'Bearer ']) assert.equal(json.includes(forbidden), false, forbidden);
};

test('nine-call pipeline uses locked requests, equal story inputs and distinct complete phases', async () => {
  const h = setup(); const result = await h.run();
  assert.equal(result.attempts, 9); assert.equal(result.completedPhases, 9); assert.equal(result.pairs.length, 3);
  assert.equal(h.requests.length, 9); assert.deepEqual(h.sleeps, Array(8).fill(11000));
  const sequence = ['generateChapter', 'generateProse', 'extractMemory', 'generateProse', 'extractMemory', 'generateChapter', 'generateChapter', 'generateProse', 'extractMemory'];
  assert.deepEqual(h.invocations.map(x => x.stage), sequence);
  for (const request of h.requests) {
    assert.equal(request.url, 'https://opencode.ai/zen/go/v1/chat/completions');
    assert.equal(request.options.redirect, 'error'); assert.equal(request.body.model, 'deepseek-v4.1-flash');
    assert.equal(request.body.max_tokens, 3000); assert.equal(request.body.temperature, 0.7);
    assert.deepEqual(request.body.thinking, {type: 'disabled'}); assert.equal('reasoning_effort' in request.body, false);
    assert.equal(request.options.body.includes(env.NEXUS_API_KEY), false);
    assert.equal(request.body.messages[0].content.includes('staging MUST be []'), false);
  }
  for (const {input} of buildInputs()) {
    const records = h.invocations.filter(call => (call.input.project?.projectId ?? call.input.context.projectId) === input.project.projectId);
    assert.deepEqual(records.find(call => call.stage === 'generateChapter').input, input);
    assert.deepEqual(records.find(call => call.stage === 'generateProse').input, input);
    assert.deepEqual(records.find(call => call.stage === 'extractMemory').input, {text: prose, chapterId: input.chapterId, context: input.context});
  }
  const d = h.saved['diagnostics.json'];
  assert.equal(d.status, 'complete'); assert.equal(d.sourceCommit, env.GITHUB_SHA); assert.equal(d.runId, '1234');
  assert.equal(d.calls.length, 9); assert.equal(d.completedPairs, 3); assert.equal(d.completedPhases, 9);
  assert.deepEqual(d.calls.map(call => call.sequence), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.ok(d.calls.every(call => call.status === 'validated' && call.inputBytes > 0 && call.requestSha256.length === 64));
  assert.deepEqual(Object.keys(h.saved).sort(), [...ARTIFACT_NAMES].sort()); assertNoPrivate(h.saved); assertNoPrivate(h.logs);
  assert.deepEqual(h.saved['unblinding.json'].mapping.map(x => x.A), Array(3).fill('proseFirst'));
  assert.equal(JSON.stringify(h.saved['blind-pairs.json']).includes('proseFirst'), false);
  assert.equal(JSON.stringify(h.saved['blind-pairs.json']).includes('legacy'), false);
});

test('every approval, Actions and first-run gate is required before any call', async () => {
  for (const key of ['NEXUS_PROSE_PIPELINE_APPROVED', 'NEXUS_LIVE_ENABLED', 'NEXUS_OVERAGE_CONFIRMED_OFF', 'GITHUB_ACTIONS', 'GITHUB_RUN_ATTEMPT']) {
    for (const value of [undefined, 'false', '2']) {
      const h = setup({env: {...env, [key]: value}}); await assert.rejects(h.run()); assert.equal(h.requests.length, 0); assert.deepEqual(h.saved, {});
    }
  }
  const c = approvedConfig({...env, NEXUS_MAX_CALLS: '300', NEXUS_MAX_OUTPUT_TOKENS: '50000', NEXUS_API_BASE_URL: 'https://other.example', NEXUS_API_MODEL: 'other', NEXUS_REASONING_EFFORT: 'low'});
  assert.equal(c.NEXUS_MAX_CALLS, '9'); assert.equal(c.NEXUS_MAX_OUTPUT_TOKENS, '3000'); assert.equal(c.NEXUS_API_BASE_URL, 'https://opencode.ai/zen/go/v1');
  assert.equal(c.NEXUS_API_MODEL, protocol.model); assert.equal(c.NEXUS_REASONING_EFFORT, undefined);
});

test('a retrying service is stopped before its second network request', async () => {
  const h = setup({serviceFactory: config => fakeService(config, {repeat: true})}); await assert.rejects(h.run());
  assert.equal(h.requests.length, 1); assert.equal(h.saved['diagnostics.json'].attempts, 1);
  assert.equal(h.saved['diagnostics.json'].validationReason, 'STAGE_REQUEST_COUNT'); assert.equal(h.saved['completed-01.json'], undefined);
});

test('a fake successful service cannot complete a phase without its single accounted request', async () => {
  const h = setup({serviceFactory: () => ({run: async () => ({text: prose, chapterId: 'chapter-2', staging: [], reviewNotes: []})})});
  await assert.rejects(h.run()); assert.equal(h.requests.length, 0); assert.equal(h.saved['diagnostics.json'].attempts, 0);
  assert.equal(h.saved['diagnostics.json'].validationReason, 'STAGE_REQUEST_COUNT'); assert.equal(h.saved['blind-pairs.json'], undefined);
});

test('first provider, protocol, invalid, oversized or truncated response stops and never retries', async () => {
  const responses = [() => new Response('PRIVATE_HTTP_ERROR', {status: 429}), () => new Response('PRIVATE_BAD_JSON'),
    () => new Response('x'.repeat(128 * 1024 + 1)), () => response({}, {finish: 'length'}),
    () => {throw Error('PRIVATE_NETWORK_ERROR');}, () => response({chapterId: 'wrong', paragraphs: [prose], staging: [], reviewNotes: []})];
  for (const make of responses) {
    let calls = 0; const h = setup({fetchImpl: async () => {calls++; return make();}}); await assert.rejects(h.run());
    assert.equal(calls, 1); assert.equal(h.saved['diagnostics.json'].status, 'stopped'); assert.equal(h.saved['diagnostics.json'].attempts, 1);
    assert.equal(h.saved['blind-pairs.json'], undefined); assert.equal(h.saved['unblinding.json'], undefined); assert.equal(h.saved['completed-01.json'], undefined);
    assertNoPrivate(h.saved); assertNoPrivate(h.logs);
  }
});

test('prose is checkpointed before extraction and remains intact when extraction fails', async () => {
  const h = setup(); const originalFetch = h.options.fetchImpl;
  h.options.fetchImpl = async (...args) => {
    const {action} = JSON.parse(JSON.parse(args[1].body).messages[1].content);
    if (action === 'extractMemory') {
      assert.equal(h.saved['completed-02.json'].text, prose);
      assert.equal(h.saved['completed-02.json'].stage, 'generateProse');
      throw Error('PRIVATE_EXTRACTOR_FAILURE');
    }
    return originalFetch(...args);
  };
  await assert.rejects(h.run());
  assert.equal(h.saved['diagnostics.json'].attempts, 3); assert.equal(h.saved['diagnostics.json'].completedPhases, 2);
  assert.equal(h.saved['diagnostics.json'].completedPairs, 0); assert.equal(h.saved['completed-02.json'].text, prose);
  assert.equal(h.saved['completed-03.json'], undefined); assert.equal(h.saved['blind-pairs.json'], undefined);
  assert.equal(h.saved['diagnostics.json'].byFixture[0].arms.proseFirst.proseAvailable, true);
  assert.equal(h.saved['diagnostics.json'].byFixture[0].arms.proseFirst.memoryAvailable, false);
  assert.equal(h.saved['diagnostics.json'].byFixture[0].arms.proseFirst.completePipelineServiceMs, null);
  assert.ok(h.order.indexOf('save:completed-02.json') < h.order.indexOf('run:extractMemory'));
  assertNoPrivate(h.saved);
});

test('a later failure preserves completed pairs and earlier prose without fabricating a full corpus', async () => {
  const h = setup(); const originalFetch = h.options.fetchImpl; let calls = 0;
  h.options.fetchImpl = async (...args) => ++calls === 5 ? new Response('PRIVATE_ERROR', {status: 500}) : originalFetch(...args);
  await assert.rejects(h.run());
  assert.equal(calls, 5); assert.equal(h.saved['diagnostics.json'].completedPairs, 1); assert.equal(h.saved['diagnostics.json'].completedPhases, 4);
  assert.equal(h.saved['completed-04.json'].stage, 'generateProse'); assert.equal(h.saved['completed-05.json'], undefined);
  assert.equal(h.saved['blind-pairs.json'], undefined); assert.equal(h.saved['unblinding.json'], undefined); assertNoPrivate(h.saved);
});

test('each possible failed phase stops at that request; only nine successful phases complete corpus', async () => {
  for (let failing = 1; failing <= 9; failing++) {
    const h = setup(); const originalFetch = h.options.fetchImpl; let calls = 0;
    h.options.fetchImpl = async (...args) => ++calls === failing ? new Response('PRIVATE_FAILURE', {status: 503}) : originalFetch(...args);
    await assert.rejects(h.run()); const d = h.saved['diagnostics.json'];
    assert.equal(calls, failing); assert.equal(d.attempts, failing); assert.equal(d.completedPhases, failing - 1);
    assert.equal(d.completedPairs, Math.floor((failing - 1) / 3)); assert.equal(h.saved['blind-pairs.json'], undefined);
    assert.equal(Object.keys(h.saved).filter(name => name.startsWith('completed-')).length, failing - 1);
  }
});

test('invalid results preserve envelope usage and no invalid prose or error detail', async () => {
  const h = setup({fetchImpl: async () => response({chapterId: 'PRIVATE_WRONG_ID', paragraphs: ['PRIVATE_INVALID_PROSE'], staging: [], reviewNotes: []},
    {usage: {prompt_tokens: 1819, completion_tokens: 365, total_tokens: 2184, completion_tokens_details: {reasoning_tokens: 3, private: 'PRIVATE_DETAIL'}}})});
  await assert.rejects(h.run()); const d = h.saved['diagnostics.json'];
  assert.deepEqual(d.calls[0].usage, {promptTokens: 1819, completionTokens: 365, totalTokens: 2184, reasoningTokens: 3});
  assert.equal(d.usage.totalTokens.knownSum, 2184); assert.equal(d.calls[0].status, 'validation_failed'); assertNoPrivate(h.saved);
});

test('HTTP-error usage is counted when safely reported; missing and unsafe usage is unknown', async () => {
  const h = setup({fetchImpl: async () => new Response(JSON.stringify({error: 'PRIVATE_ERROR', usage: {prompt_tokens: 10, completion_tokens: -1, total_tokens: 'PRIVATE_VALUE'}}), {status: 429})});
  await assert.rejects(h.run()); const d = h.saved['diagnostics.json'];
  assert.equal(d.usage.promptTokens.knownSum, 10); assert.equal(d.usage.promptTokens.complete, true);
  assert.deepEqual(d.usage.totalTokens, {knownSum: null, reportedCalls: 0, missingCalls: 1, complete: false});
  assertNoPrivate(h.saved);
  assert.deepEqual(aggregateUsage([{usage: {totalTokens: 3}}, {usage: {}}]).totalTokens,
    {knownSum: 3, reportedCalls: 1, missingCalls: 1, complete: false});
});

test('monotonic timing separates request, stage, arm and total workflow including throttle', async () => {
  const h = setup(); await h.run(); const d = h.saved['diagnostics.json'];
  assert.equal(d.workflowElapsedMs, 88108); assert.ok(d.calls.every(call => call.requestElapsedMs === 7));
  assert.ok(d.phases.every(phase => phase.serviceElapsedMs === 12));
  for (const stage of ['generateChapter', 'generateProse', 'extractMemory']) {
    assert.equal(d.byStage[stage].attemptedRequests, 3); assert.equal(d.byStage[stage].measuredServiceMs, 36);
    assert.equal(d.byStage[stage].measuredRequestMs, 21); assert.equal(d.byStage[stage].usage.totalTokens.knownSum, 330);
  }
  assert.equal(d.byArm.legacy.attemptedRequests, 3); assert.equal(d.byArm.proseFirst.attemptedRequests, 6);
  assert.equal(d.byArm.legacy.measuredServiceMs, 36); assert.equal(d.byArm.proseFirst.measuredServiceMs, 72);
  assert.equal(d.byArm.proseFirst.usage.totalTokens.knownSum, 660); assert.equal(d.usage.totalTokens.knownSum, 990);
  assert.equal(d.usage.reasoningTokens.knownSum, null); assert.equal(d.usage.reasoningTokens.missingCalls, 9);
});

test('failed request latency and its attempt are counted in stage and workflow totals', async () => {
  const h = setup(); h.options.fetchImpl = async () => {h.advance(17); throw providerError('UPSTREAM_TIMEOUT');};
  await assert.rejects(h.run()); const d = h.saved['diagnostics.json'];
  assert.equal(d.workflowElapsedMs, 17); assert.equal(d.calls[0].requestElapsedMs, 17);
  assert.equal(d.phases[0].serviceElapsedMs, 17); assert.equal(d.byStage.generateChapter.attemptedRequests, 1);
  assert.equal(d.byStage.generateChapter.measuredServiceMs, 17); assert.equal(d.usage.totalTokens.missingCalls, 1);
});

test('evidence binding rejects changed extraction spans without damaging the saved prose', async () => {
  const h = setup({serviceFactory: config => fakeService(config, {after: (stage, input, output) => stage === 'extractMemory'
    ? {...output, staging: output.staging.map(event => ({...event, sourceStart: 1}))} : output})});
  await assert.rejects(h.run()); assert.equal(h.saved['diagnostics.json'].attempts, 3);
  assert.equal(h.saved['diagnostics.json'].validationReason, 'EXTRACTION_RESULT_SHAPE');
  assert.equal(h.saved['completed-02.json'].text, prose); assert.equal(h.saved['completed-03.json'], undefined);
});

test('input snapshots are identical structured inputs and immune to service mutation', async () => {
  const originals = buildInputs(); const h = setup({serviceFactory: config => fakeService(config, {before: (stage, input) => {
    if (stage === 'generateChapter') input.context.sources[0].text = 'MUTATED_TEST_ONLY';
  }})});
  await h.run(); assert.deepEqual(h.saved['inputs.json'].inputs, originals);
  for (let i = 0; i < fixtures.length; i++) assert.deepEqual(originals[i].input, buildPair(fixtures[i]).nexus);
});

test('input or output persistence failure stops safely without another request', async () => {
  let requests = 0;
  await assert.rejects(runProsePipelineEval({env, fetchImpl: async () => {requests++;}, save: async () => {throw Error('PRIVATE_STORAGE_ERROR');}}));
  assert.equal(requests, 0);
  const h = setup(); const save = h.options.save;
  h.options.save = async (name, data) => {if (name === 'completed-02.json') throw Error('PRIVATE_STORAGE_ERROR'); return save(name, data);};
  await assert.rejects(h.run()); assert.equal(h.requests.length, 2); assert.equal(h.saved['diagnostics.json'].status, 'stopped');
  assert.equal(h.saved['blind-pairs.json'], undefined); assertNoPrivate(h.saved);
});

test('frozen protocol, fixtures, harness and tests match separate manifest', async () => {
  const manifest = JSON.parse(await readFile(new URL('../eval/prose-pipeline-manifest.json', import.meta.url)));
  assert.equal(manifest.protocol, protocol.id);
  for (const [path, hash] of Object.entries(manifest.sha256)) assert.equal(createHash('sha256').update(await readFile(new URL('../' + path, import.meta.url))).digest('hex'), hash, path);
});

test('new workflow scope is opt-in, no-rerun, credentials-isolated and artifact-allowlisted', async () => {
  const workflow = await readFile(new URL('../.github/workflows/live-smoke.yml', import.meta.url), 'utf8');
  assert.match(workflow, /default: review-probe/); assert.match(workflow, /prose-pipeline' && github.run_attempt == 1/);
  assert.match(workflow, /options: \[journey, review-probe, generation-probe, quality-pilot, prose-pipeline, memory-support, isolated-memory-support\]/);
  const blocks = workflow.split(/\n      - name:/).slice(1);
  for (const block of blocks) {
    if (block.includes('scripts/prose-pipeline-eval.mjs')) {
      assert.match(block, /if: inputs.test_scope == 'prose-pipeline' && github.run_attempt == 1/);
      assert.match(block, /NEXUS_API_KEY: \$\{\{ secrets.NEXUS_API_KEY \}\}/);
      assert.match(block, /NEXUS_PROSE_PIPELINE_APPROVED: 'true'/); assert.match(block, /NEXUS_OVERAGE_CONFIRMED_OFF: 'true'/);
    }
    if (/run: (?:npm ci|node --test)/.test(block)) assert.equal(block.includes('NEXUS_API_KEY'), false);
    if (block.includes('scripts/writing-quality-eval.mjs')) assert.match(block, /if: inputs.test_scope == 'quality-pilot'/);
    if (block.includes('name: synthetic-prose-pipeline-pilot')) {
      const paths = [...block.matchAll(/^\s+prose-pipeline-evidence\/(.+)$/gm)].map(match => match[1]);
      assert.deepEqual(paths.sort(), [...ARTIFACT_NAMES].sort()); assert.equal(block.includes('*'), false);
      assert.match(block, /if: always\(\) && inputs.test_scope == 'prose-pipeline'/); assert.match(block, /retention-days: 7/);
    }
  }
});


test('production runtime completes the actual plain-prose architecture with fake transport and exact source IDs', async () => {
  const candidate = '  第一个段落。\r\n\r\n第二个段落。\n\n';
  const h = setup({serviceFactory: createAgentService});
  const requests = [];
  h.options.fetchImpl = async (url, options) => {
    const request = JSON.parse(options.body), {action, input} = JSON.parse(request.messages[1].content);
    requests.push({action, input}); h.advance(7);
    let content;
    if (action === 'generateProse') content = candidate;
    else if (action === 'extractMemory') {
      assert.equal(input.chapterId, 'chapter-2');
      assert.deepEqual(input.context.sources.map(source => source.chapterId), ['ch1', 'ch2', 'ch3']);
      assert.deepEqual(input.paragraphs, segmentProse(candidate));
      content = JSON.stringify({staging: [{label: '第二段描写', sourceParagraphIndex: 1}], reviewNotes: []});
    } else content = JSON.stringify(wireOutput(action, input));
    return new Response(JSON.stringify({choices: [{finish_reason: 'stop', message: {content}}], usage: {prompt_tokens: 20, completion_tokens: 5, total_tokens: 25}}));
  };
  const result = await h.run(); assert.equal(result.attempts, 9); assert.equal(requests.length, 9);
  assert.equal(h.saved['completed-02.json'].text, candidate);
  assert.deepEqual(h.saved['completed-03.json'].staging[0], {label: '第二段描写', sourceQuote: '第二个段落。', sourceParagraphIndex: 1,
    sourceStart: segmentProse(candidate)[1].start, sourceEnd: segmentProse(candidate)[1].end});
  assert.equal(h.saved['diagnostics.json'].usage.totalTokens.knownSum, 225);
});


test('late transport after timeout cannot regress final diagnostics or create a checkpoint', async () => {
  let release;
  const h = setup({serviceFactory: config => createAgentService({...config, timeoutMs: 5})});
  h.options.fetchImpl = async () => {h.advance(5); return new Promise(resolve => {release = resolve;});};
  await assert.rejects(h.run());
  const d = h.saved['diagnostics.json'];
  assert.equal(d.status, 'stopped'); assert.equal(d.code, 'UPSTREAM_TIMEOUT'); assert.equal(d.attempts, 1);
  assert.equal(d.calls[0].requestElapsedMs, 5); assert.equal(d.calls[0].status, 'interrupted');
  release(response(wireOutput('generateChapter', {chapterId: 'chapter-2'})));
  await new Promise(resolve => setTimeout(resolve, 5));
  assert.deepEqual(h.saved['diagnostics.json'], d); assert.equal(h.saved['completed-01.json'], undefined);
});

test('a pre-dispatch diagnostic write failure counts no outbound attempt', async () => {
  const h = setup(); const save = h.options.save; let writes = 0;
  h.options.save = async (name, data) => {
    if (name === 'diagnostics.json' && ++writes === 1) throw Error('PRIVATE_STORAGE_ERROR');
    return save(name, data);
  };
  await assert.rejects(h.run()); const d = h.saved['diagnostics.json'];
  assert.equal(h.requests.length, 0); assert.equal(d.attempts, 0); assert.equal(d.calls[0].dispatched, false);
  assert.equal(d.usage.totalTokens.missingCalls, 0); assert.equal(d.byStage.generateChapter.attemptedRequests, 0);
});


test('deferred preparation save cannot dispatch after timeout or overwrite terminal diagnostics', {timeout: 1000}, async () => {
  let releaseSave, enterSave, activeWrites = 0, maximumWrites = 0;
  const entered = new Promise(resolve => {enterSave = resolve;});
  const blocked = new Promise(resolve => {releaseSave = resolve;});
  const h = setup({serviceFactory: config => createAgentService({...config, timeoutMs: 5})});
  const save = h.options.save, completedWrites = [];
  let blockedOnce = false;
  h.options.save = async (name, data) => {
    if (name !== 'diagnostics.json') return save(name, data);
    activeWrites++; maximumWrites = Math.max(maximumWrites, activeWrites);
    try {
      if (!blockedOnce) {blockedOnce = true; enterSave(); await blocked;}
      await save(name, data); completedWrites.push({status: data.status, revision: data.diagnosticRevision});
    } finally {activeWrites--;}
  };
  const stopped = assert.rejects(h.run(), /no automatic retry/);
  try {
    await entered;
    await new Promise(resolve => setTimeout(resolve, 20));
    assert.equal(h.requests.length, 0);
  } finally {releaseSave();}
  await stopped;
  // Let any abandoned service-operation continuation finish before checking.
  await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(h.requests.length, 0); assert.equal(maximumWrites, 1);
  assert.deepEqual(completedWrites.map(write => write.status), ['running', 'stopped']);
  assert.ok(completedWrites[1].revision > completedWrites[0].revision);
  const d = h.saved['diagnostics.json'];
  assert.equal(d.status, 'stopped'); assert.equal(d.code, 'UPSTREAM_TIMEOUT'); assert.equal(d.attempts, 0);
  assert.equal(d.calls[0].dispatched, false); assert.equal(d.attemptAccountingComplete, true);
  assert.equal(h.saved['completed-01.json'], undefined); assert.equal(h.saved['blind-pairs.json'], undefined);
});
