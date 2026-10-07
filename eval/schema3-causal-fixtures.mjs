/** Offline future-evaluation scaffolding, never a provider runner or historical replay. */
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as engine from '../src/domain/engine.js';
import {getSceneIntentReference} from '../src/domain/scene-intent.js';
import {parseBackup} from '../src/storage.js';

export const fixtureSetId = 'causal-scenes-schema3-v1';
export const baselineCommit = 'd82fa2f996737d76510c4a1d895ea1a3a13cf144';
export const sourcePaths = Object.freeze([
  'eval/causal-continuity-requests.json',
  'eval/history/multichapter-v1/inputs.json',
  'eval/history/multichapter-v1/completed-01.json',
]);
export const sha256 = value => createHash('sha256').update(value).digest('hex');
const read = path => JSON.parse(readFileSync(new URL('../'+path, import.meta.url), 'utf8'));
const confirmFact = (state, statement) => engine.commitPatch(state,
  engine.proposeCustomPatch(state, 'ch1', {intent:'author_fact', statement}));

// The current domain's offline/template path establishes fixture continuity only.
// No model judgment, author-origin relabeling, selected memory or real acceptance
// is inferred. F2 deliberately retains the historical legacy acceptance semantics.
function acceptRetainedProse(state, text) {
  let next = engine.stageProviderDraft(state, {text, staging:[],
    provider:{id:'offline-retained-fiction-fixture', isLive:false},
    context:engine.getContext(state)}, 'ch1');
  const id = next.drafts.at(-1).id;
  next = engine.reviewDraft(next, id);
  return engine.acceptDraft(next, id);
}

export function buildSchema3FixtureStates() {
  const frozen = read(sourcePaths[0]);
  return frozen.requests.filter(request => request.arm === 'A').map(request => {
    const historicalInput = JSON.parse(request.body.messages[1].content).input;
    let state;
    if (request.fixture === 'F2-physical-transition') {
      // Import the retained, validated PLANNED seed, not an exported context.
      // Its r1 author-fact anchors are intentionally absent from later prose.
      state = parseBackup(JSON.stringify(read(sourcePaths[1]).seedWorkspace)).state;
      state = acceptRetainedProse(state, read(sourcePaths[2]).output.text);
      state = engine.saveRevision(state, 'ch1', historicalInput.context.sources[0].text, 2);
      state = confirmFact(state, historicalInput.context.facts[2].value);
    } else {
      state = engine.createProjectFromConfig(historicalInput.project);
      for (const fact of historicalInput.context.facts) state = confirmFact(state, fact.value);
      state = acceptRetainedProse(state, historicalInput.context.sources[0].text);
    }
    const chapterId = state.chapters[historicalInput.chapterIndex].id;
    return {id:request.fixture, source:request.source, historicalInput, state, chapterId,
      targetHan:request.targetHan, targetParagraphs:request.targetParagraphs,
      focus:request.focus, evaluatorNotes:request.evaluatorNotes,
      sceneIntent:getSceneIntentReference(state, chapterId)};
  });
}

export function describeFixture(fixture, input) {
  const old = fixture.historicalInput;
  return {id:fixture.id, source:fixture.source,
    target:{chapterId:fixture.chapterId, chapterIndex:input.chapterIndex,
      historicalChapterId:old.chapterId, savedOutlineId:fixture.sceneIntent.outlineId},
    targetHan:fixture.targetHan, targetParagraphs:fixture.targetParagraphs,
    focus:fixture.focus, evaluatorNotes:fixture.evaluatorNotes,
    sceneIntent:fixture.sceneIntent,
    comparison:{historicalSchemaVersion:old.context.contextSchemaVersion ?? null,
      historicalStateVersion:old.context.version, currentStateVersion:input.context.version,
      historicalSceneTime:old.context.sceneTime, currentSceneTime:input.context.sceneTime,
      historicalStaleMemories:old.context.memoryContext?.staleSource ?? null,
      currentStaleMemories:input.context.memoryContext.staleSource,
      historicalSourceRevisions:old.context.sources.map(source => source.revision),
      currentSourceRevisions:input.context.sources.map(source => source.revision),
      confirmedFactsPreserved:JSON.stringify(old.context.facts) === JSON.stringify(input.context.facts),
      sourceTextsPreserved:JSON.stringify(old.context.sources.map(source => source.text)) ===
        JSON.stringify(input.context.sources.map(source => source.text))},
    input};
}
