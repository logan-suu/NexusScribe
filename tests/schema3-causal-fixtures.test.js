import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import * as engine from '../src/domain/engine.js';
import {getSceneIntentReference} from '../src/domain/scene-intent.js';
import {validateInput} from '../server/provider.js';
import {parseBackup} from '../src/storage.js';
import {buildSchema3FixtureStates, describeFixture, sha256, sourcePaths}
  from '../eval/schema3-causal-fixtures.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const bytes = path => readFileSync(join(root, path));
const fixturePath = 'eval/schema3-causal-fixtures.json';
const artifact = JSON.parse(bytes(fixturePath));
const states = buildSchema3FixtureStates();

test('three future fixtures use current production context and pass current input validation', () => {
  assert.equal(artifact.contextSchemaVersion, 3);
  assert.equal(artifact.providerCalls, 0);
  assert.deepEqual(artifact.fixtures.map(fixture => fixture.id),
    ['F1-replay','F2-physical-transition','F3-unused-domain-transfer']);
  assert.deepEqual(buildSchema3FixtureStates(), states);
  for (const [index, fixture] of states.entries()) {
    const saved = artifact.fixtures[index];
    const before = structuredClone(fixture.state);
    assert.deepEqual(saved.input.context, engine.getContext(fixture.state));
    assert.deepEqual(saved, describeFixture(fixture, saved.input));
    assert.doesNotThrow(() => validateInput('generateProse', saved.input));
    assert.deepEqual(fixture.state, before);
    const workspace = {format:1, serial:0, state:fixture.state, editing:{}, patch:null};
    assert.deepEqual(parseBackup(JSON.stringify(workspace)), workspace);
    assert.equal(saved.input.context.contextSchemaVersion, 3);
    assert.equal(saved.input.context.sceneTime, null);
    assert.equal(saved.input.chapterIndex, 1);
    assert.deepEqual(saved.input.project.outline.map(chapter => chapter.id), ['ch1','ch2','ch3']);
    assert.equal(saved.input.project.outline[saved.input.chapterIndex].id, 'ch2');
    assert.equal(Object.hasOwn(saved.input, 'chapterId'), false); // App input; server adds the ID.
    assert.deepEqual(Object.keys(saved.input).sort(), ['chapterIndex','context','project']);
    assert.deepEqual(saved.input.context.sources.map(source => [source.chapterIndex,source.role,source.channel]),
      [[0,'accepted_manuscript','original_text'],[1,'planned_content','planning_text'],[2,'planned_content','planning_text']]);
  }
});

test('story intent, exact source text and confirmed fictional facts survive without invented fields', () => {
  for (const [index, fixture] of states.entries()) {
    const {input, sceneIntent, comparison} = artifact.fixtures[index];
    const old = fixture.historicalInput;
    assert.deepEqual(input.context.facts, old.context.facts);
    assert.deepEqual(input.context.sources.map(source => source.text), old.context.sources.map(source => source.text));
    assert.deepEqual(input.context.constitution, old.context.constitution);
    assert.deepEqual(input.context.forbiddenReveals, old.context.forbiddenReveals);
    for (const [position, outline] of input.project.outline.entries()) {
      const {id, ...savedIntent} = outline;
      const {id:originalId, ...originalIntent} = old.project.outline[position];
      assert.deepEqual(savedIntent, originalIntent);
      assert.equal(Object.hasOwn(outline, 'exitState'), false);
    }
    assert.deepEqual(sceneIntent.goal, {status:'present', value:old.project.outline[1].goal});
    assert.deepEqual(sceneIntent.exitState, {status:'missing', value:null});
    assert.equal(sceneIntent.source, 'config.outline[1]');
    assert.equal(sceneIntent.draft, null);
    assert.equal(comparison.confirmedFactsPreserved, true);
    assert.equal(comparison.sourceTextsPreserved, true);
    for (const key of ['events','knowledge','obligations','summaries','staging']) assert.deepEqual(input.context[key], []);
    assert.equal(Object.hasOwn(input, 'focus'), false);
    assert.equal(Object.hasOwn(input, 'evaluatorNotes'), false);
  }
  const mutable = structuredClone(states[0].state);
  mutable.config.outline[1].goal = '';
  assert.deepEqual(getSceneIntentReference(mutable, 'ch2').goal, {status:'empty', value:''});
  assert.deepEqual(getSceneIntentReference(mutable, 'ch2').exitState, {status:'missing', value:null});
  delete mutable.config.outline[1].goal;
  assert.deepEqual(getSceneIntentReference(mutable, 'ch2').goal, {status:'missing', value:null});
});

test('F2 retains older author-fact anchors without upgrading them to current-prose evidence', () => {
  const {state} = states[1], {input, comparison} = artifact.fixtures[1];
  assert.equal(state.version, 5);
  assert.deepEqual(input.context.sources.map(source => source.revision), [3,1,1]);
  assert.deepEqual(input.context.facts.map(fact => fact.source.revision), [1,1,3]);
  for (const fact of input.context.facts) {
    const revision = state.chapters[0].revisions.find(item => item.revision === fact.source.revision);
    assert.equal(revision.text.slice(fact.source.start, fact.source.end), fact.source.quote);
    assert.equal(fact.authority, 'explicit_author_decision');
    assert.equal(fact.status, 'confirmed');
  }
  for (const fact of input.context.facts.slice(0,2)) assert.equal(input.context.sources[0].text.includes(fact.source.quote), false);
  assert.equal(input.context.facts[2].source.start, 697);
  assert.equal(input.context.facts[2].source.end, 715);
  assert.equal(comparison.historicalStaleMemories, 1);
  assert.equal(comparison.currentStaleMemories, 0);
  assert.equal(input.context.memoryContext.included, 0);
  assert.match(input.context.memoryContext.policy, /textual_presence|textual presence/);
  assert.match(input.context.memoryContext.policy, /later accepted chapters constrain future continuity/);
});

test('acceptance scaffolding has real domain commits but no invented model review or memory', () => {
  for (const [index, {state}] of states.entries()) {
    const accepted = state.drafts.at(-1);
    assert.equal(accepted.status, 'ACCEPTED');
    assert.equal(accepted.provider, 'offline-retained-fiction-fixture');
    assert.equal(accepted.providerInfo.isLive, false);
    assert.equal(accepted.review.semanticStatus, 'not_evaluated');
    assert.equal(accepted.modelReview, null);
    assert.equal(accepted.manualSource, undefined);
    assert.deepEqual(accepted.staging, []);
    assert.equal(state.commits.filter(commit => commit.kind === 'draft_accept').length, 1);
    if (index !== 1) {
      assert.equal(state.version, 4);
      assert.equal(state.chapters[0].revision, 2);
      assert.equal(state.chapters[0].revisions[0].text, state.chapters[0].text);
    }
    let changed = engine.saveRevision(state, 'ch1', state.chapters[0].text+'\n尚未分类的编辑。', state.chapters[0].revision);
    assert.equal(engine.getContext(changed).sources[0].role, 'unaccepted_manuscript');
    assert.equal(engine.getContext(changed).sources[1].role, 'planned_content');
    assert.deepEqual(engine.getContext(changed).facts, state.facts);
  }
});

test('source hashes bind the frozen inputs and actual production implementation', () => {
  assert.equal(artifact.sha256[sourcePaths[0]], '5701b71bf86b7db9675095872606234b324a0e6e39930f6484000a45dff3fe73');
  for (const path of [...sourcePaths, 'src/App.jsx','src/domain/engine.js','src/domain/scene-intent.js'])
    assert.equal(typeof artifact.sha256[path], 'string');
  for (const [path, digest] of Object.entries(artifact.sha256)) assert.equal(sha256(bytes(path)), digest, path);
  assert.deepEqual(Object.keys(artifact.validationOnlySha256), ['server/provider.js','server/provider-transport.js']);
  for (const [path, digest] of Object.entries(artifact.validationOnlySha256)) {
    assert.equal(sha256(bytes(path)), digest, path);
    assert.equal(Object.hasOwn(artifact.sha256, path), false);
  }
});

function protectedHashes() {
  const result = {};
  function walk(path) {
    for (const entry of readdirSync(join(root, path), {withFileTypes:true})) {
      const child = path+'/'+entry.name;
      if (entry.isDirectory()) walk(child); else result[child] = sha256(bytes(child));
    }
  }
  for (const path of ['eval','src','server','scripts','.github']) walk(path);
  return result;
}

test('real App export is byte-reproducible with poisoned network and live flags, preserving archives', () => {
  const before = protectedHashes();
  const code = `
    import http from 'node:http'; import https from 'node:https';
    import net from 'node:net'; import tls from 'node:tls';
    const denied = () => { throw Error('NETWORK_FORBIDDEN_IN_FIXTURE_EXPORT'); };
    http.request = http.get = https.request = https.get = net.connect = net.createConnection = tls.connect = globalThis.fetch = denied;
    const {exportSchema3Fixtures, serializeFixtures} = await import('./scripts/export-schema3-causal-fixtures.mjs');
    const {readFileSync} = await import('node:fs'); const {default:assert} = await import('node:assert/strict');
    const first = serializeFixtures(await exportSchema3Fixtures());
    assert.equal(first, readFileSync('${fixturePath}', 'utf8'));
    assert.equal(serializeFixtures(await exportSchema3Fixtures()), first);
    assert.equal(globalThis.fetch, denied);
  `;
  const env = {PATH:process.env.PATH, NEXUS_LIVE_ENABLED:'true',
    NEXUS_OVERAGE_CONFIRMED_OFF:'true', NEXUS_CAUSAL_APPROVED:'true',
    NEXUS_API_KEY:'OFFLINE_TEST_NOT_A_CREDENTIAL', GITHUB_ACTIONS:'true'};
  const run = spawnSync(process.execPath, ['--input-type=module','-e',code],
    {cwd:root, env, encoding:'utf8', timeout:30000});
  assert.equal(run.status, 0, run.stderr);
  for (const flag of ['--live','--run','--approved']) {
    const rejected = spawnSync(process.execPath, ['scripts/export-schema3-causal-fixtures.mjs',flag],
      {cwd:root, env, encoding:'utf8', timeout:5000});
    assert.equal(rejected.status, 1);
    assert.match(rejected.stderr, /no live mode/);
  }
  assert.deepEqual(protectedHashes(), before);
});
