import test from 'node:test';
import assert from 'node:assert/strict';
import * as engine from '../src/domain/engine.js';
import {getSceneIntentReference as read} from '../src/domain/scene-intent.js';
import {fixture, GOAL, EXIT, staleFixture, PROSE, provider, manualFixture, templateFixture} from './fixtures/scene-intent.js';

test('scene intent preserves exact saved strings and positional provenance without mutation', () => {
  const state = fixture(), before = structuredClone(state);
  const reference = read(state, 'ch1', state.drafts[0]);
  assert.equal(reference.goal.value, GOAL); assert.equal(reference.exitState.value, EXIT);
  assert.equal(reference.source, 'config.outline[0]'); assert.equal(reference.outlineId, 'chapter-1');
  assert.equal(reference.draft.contextStatus, 'current');
  assert.equal(reference.draft.textHash, engine.hash(PROSE));
  assert.deepEqual(state, before);
  assert.deepEqual(state.events, []); assert.deepEqual(state.facts, []);
});

test('missing, explicit empty, malformed and absent outline values never borrow other intent', () => {
  const state = fixture();
  const empty = read(state, 'ch2');
  assert.deepEqual(empty.goal, {status:'empty', value:''});
  assert.deepEqual(empty.exitState, {status:'empty', value:'\n  '});
  assert.equal(read(state, 'ch3').goal.status, 'missing');
  state.config.outline[0] = {goal:42, exitState:null};
  assert.equal(read(state, 'ch1').goal.status, 'invalid');
  assert.equal(read(state, 'ch1').exitState.status, 'invalid');
  state.config.outline = ['a string is not a goal'];
  assert.equal(read(state, 'ch1').goal.status, 'missing');
  delete state.config.outline;
  assert.equal(read(state, 'ch1').goal.status, 'missing');
});

test('chapter identity must be unique; current chapter and outline order follow actual generator mapping', () => {
  const state = fixture();
  assert.equal(read(state, 'not-a-chapter').source, null);
  state.chapters.reverse();
  assert.equal(read(state, 'ch1').source, 'config.outline[2]');
  assert.equal(read(state, 'ch1').goal.status, 'missing');
  state.config.outline.reverse();
  assert.equal(read(state, 'ch1').goal.value, GOAL);
  state.chapters.push(structuredClone(state.chapters.at(-1)));
  assert.equal(read(state, 'ch1').source, null);
  assert.equal(read(state, 'ch1').goal.status, 'missing');
});

test('plan edits at the same state version change display fingerprint, not stored draft context', () => {
  const state = fixture(), original = read(state, 'ch1', state.drafts[0]);
  const context = structuredClone(state.drafts[0].context);
  state.config.outline[0].exitState = '作者修改后的退出状态';
  const changed = read(state, 'ch1', state.drafts[0]);
  assert.notEqual(changed.intentHash, original.intentHash);
  assert.equal(changed.exitState.value, '作者修改后的退出状态');
  // This says only context currency; no original plan snapshot exists.
  assert.equal(changed.draft.contextStatus, 'current');
  assert.deepEqual(state.drafts[0].context, context);
});

test('context staleness catches schema, source text, revision maps, project and state mismatch', () => {
  const mutations = [
    s => {s.drafts[0].context.contextSchemaVersion = 2;},
    s => {s.drafts[0].context.sources[0].text += 'older source';},
    s => {s.drafts[0].chapterRevisions.ch1++;},
    s => {s.drafts[0].projectId = 'other-project';},
    s => {s.version++;},
    s => {s.chapters[0].syncStatus = 'PENDING';},
  ];
  for (const mutate of mutations) {
    const state = fixture(); mutate(state);
    assert.equal(read(state, 'ch1', state.drafts[0]).draft.contextStatus, 'stale');
  }
  const state = fixture(); delete state.drafts[0].context;
  assert.equal(read(state, 'ch1', state.drafts[0]).draft.contextStatus, 'unavailable');
});

test('explicit context refresh retains prose and displays new binding without upgrading intent', () => {
  let state = staleFixture(); const before = state.drafts[0].text;
  assert.equal(read(state, 'ch1', state.drafts[0]).draft.contextStatus, 'stale');
  state = engine.refreshDraftContext(state, state.drafts[0].id);
  assert.equal(read(state, 'ch1', state.drafts[0]).draft.contextStatus, 'current');
  assert.equal(state.drafts[0].text, before);
  assert.equal(state.drafts[0].review, null);
});

test('candidate revision, historical candidates and chapter switching keep separate bindings', () => {
  let state = fixture();
  state = engine.editDraft(state, state.drafts[0].id, PROSE+'\n作者的新句。');
  assert.equal(read(state, 'ch2', state.drafts[0]).chapterId, 'ch1');
  assert.equal(read(state, 'ch2', state.drafts[0]).draft.revision, 2);
  state = engine.rejectDraft(state, state.drafts[0].id);
  state = engine.stageProseDraft(state, {text:'另一个候选。', provider, context:engine.getContext(state)}, 'ch3');
  const old = read(state, 'ch3', state.drafts[0]), next = read(state, 'ch1', state.drafts[1]);
  assert.equal(old.chapterId, 'ch1'); assert.equal(old.draft.archived, true);
  assert.equal(next.chapterId, 'ch3'); assert.equal(next.goal.status, 'missing');
  state.drafts[1].status = 'ACCEPTED';
  assert.equal(read(state, 'ch3', state.drafts[1]).draft.archived, true);
});

test('demo candidate without a chapterId references ch3 even when the editor selects ch2', () => {
  const state = engine.generateDraft(engine.createInitialState());
  const reference = read(state, 'ch2', state.drafts[0]);
  assert.equal(reference.chapterId, 'ch3'); assert.equal(reference.chapterTitle, state.chapters[2].title);
  assert.equal(reference.goal.status, 'missing'); assert.equal(reference.exitState.status, 'missing');
  assert.equal(reference.draft.contextStatus, 'current');
});

test('manual and template references add no completion detector or acceptance gate', () => {
  for (const base of [manualFixture, templateFixture]) {
    let state = base(), id = state.drafts[0].id;
    const reference = read(state, 'ch1', state.drafts[0]);
    assert.equal(reference.goal.value, GOAL); assert.equal(reference.draft.contextStatus, 'current');
    // Text intentionally does not enact the saved hand-over exitState. Display
    // still introduces no gate; existing explicit local acceptance remains intact.
    if (state.drafts[0].manualSource) state = engine.skipManualMemoryExtraction(state, id);
    state = engine.reviewDraft(state, id);
    state = engine.acceptDraft(state, id);
    assert.equal(state.chapters[0].text, PROSE);
    assert.equal(read(state, 'ch1', state.drafts[0]).draft.archived, true);
    assert.deepEqual(state.events, []);
  }
});
