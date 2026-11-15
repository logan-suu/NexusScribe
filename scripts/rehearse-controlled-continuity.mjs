/** Offline only: exercise the frozen Chapter 2 path with an in-memory response. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile, readdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {createAgentService} from '../server/provider.js';
import {stageProseDraft} from '../src/domain/engine.js';
import {
  approved, buildControlledContinuity, chapterOne, notApproved, renderedProse,
  scope, sourceRuntimeDigest,
} from '../eval/controlled-continuity-fixture.mjs';

const root = new URL('../', import.meta.url);
const fixtureDigest = 'fd956aa1f61e74b59d16d8f319faddc7262e40879a6bdecb8882787ef88bb6c4';
const hash = value => createHash('sha256').update(value).digest('hex');
const read = path => readFile(new URL(path, root));

async function files(directory) {
  const entries = await readdir(new URL(directory, root), {withFileTypes:true});
  const paths = await Promise.all(entries.map(entry => {
    const path = directory + '/' + entry.name;
    if (entry.isDirectory()) return files(path);
    if (!entry.isFile()) throw Error('UNEXPECTED_RUNTIME_FILE');
    return path;
  }));
  return paths.flat();
}

export async function verifyControlledContinuityPins() {
  const paths = [
    ...await files('src'), ...await files('server'),
    '.env.example', 'index.html', 'package.json', 'package-lock.json',
    'tsconfig.json', 'tsconfig.server.json', 'vite.config.js', 'scripts/start-demo.mjs',
  ].sort();
  const hashes = await Promise.all(paths.map(async path => [path, hash(await read(path))]));
  if (hash(JSON.stringify(hashes)) !== sourceRuntimeDigest) throw Error('RUNTIME_PIN_MISMATCH');
  if (hash(await read('eval/controlled-continuity-fixture.mjs')) !== fixtureDigest) {
    throw Error('FIXTURE_PIN_MISMATCH');
  }
  return {fixtureDigest};
}

export async function rehearseControlledContinuity() {
  await verifyControlledContinuityPins();
  const {current, input} = buildControlledContinuity();
  let attempts = 0;
  // Both the service and this underlying fake transport enforce the one-call limit.
  // No user-supplied options, ambient environment, files containing credentials, or real fetch.
  const service = createAgentService({
    env:{
      NEXUS_OVERAGE_CONFIRMED_OFF:'true', NEXUS_LIVE_ENABLED:'true',
      NEXUS_API_BASE_URL:'https://example.test/v1', NEXUS_API_MODEL:scope.model,
      NEXUS_API_KEY:'OFFLINE_ONLY_NOT_A_CREDENTIAL',
      NEXUS_MAX_CALLS:String(scope.maxCalls), NEXUS_MAX_OUTPUT_TOKENS:String(scope.maxOutputTokens),
      NEXUS_THINKING_MODE:scope.thinkingMode,
    },
    timeoutMs:scope.timeoutMs,
    fetchImpl:async (url, options) => {
      if (++attempts !== 1) throw Error('TRANSPORT_CALL_LIMIT');
      assert.equal(String(url), 'https://example.test/v1/chat/completions');
      const request = JSON.parse(options.body);
      assert.equal(request.model, scope.model);
      assert.equal(request.max_tokens, scope.maxOutputTokens);
      assert.deepEqual(request.thinking, {type:'disabled'});
      assert.equal(Object.hasOwn(request, 'reasoning_effort'), false);
      const wire = JSON.parse(request.messages.find(message => message.role === 'user').content);
      assert.equal(wire.action, 'generateProse');
      assert.equal(wire.input.chapterId, 'ch2');
      return new Response(JSON.stringify({choices:[{finish_reason:'stop', message:{content:renderedProse}}]}));
    },
  });
  const proposal = await service.run(scope.action, input);
  const staged = stageProseDraft(current, {...proposal, context:input.context}, 'ch2');
  const candidate = staged.drafts.at(-1);
  assert.equal(proposal.chapterId, 'ch2');
  assert.equal(candidate.text, renderedProse);
  assert.equal(staged.chapters[1].status, 'PLANNED');
  assert.equal(staged.chapters[0].text, chapterOne);
  assert.deepEqual(staged.facts, current.facts);
  assert.deepEqual(staged.events, current.events);
  assert.equal(attempts, 1);

  // Keep the scoring payload separate from diagnostics, in memory only. Its text is
  // the scripted control and must never be counted as independent model evidence.
  const reviewerPacket = {
    candidateId:'A',
    acceptedChapterOne:chapterOne,
    canonAmendment:approved,
    unadoptedIdea:notApproved,
    chapterRequest:{
      goal:input.project.outline[1].goal,
      exitState:input.project.outline[1].exitState,
      boundaries:input.project.boundaries,
      pov:input.project.pov,
      tone:input.project.tone,
    },
    candidateText:candidate.text,
  };
  return {report:{mode:'offline-scripted-control', fakeAttempts:attempts, providerCalls:0,
    staged:true, accepted:false, retained:false, qualityGate:'unverified'}, reviewerPacket};
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length !== 2) throw Error('NO_ARGUMENTS_ALLOWED');
    const {report} = await rehearseControlledContinuity();
    console.log(JSON.stringify(report));
  } catch {
    // Deliberately omit error details, which may quote request or candidate text.
    console.error('Controlled continuity offline rehearsal stopped.');
    process.exitCode = 1;
  }
}
