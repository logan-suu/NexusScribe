import test from 'node:test';
import assert from 'node:assert/strict';
import * as e from '../src/domain/engine.js';
import {MAX_PROSE_LENGTH, segmentProse} from '../src/domain/prose.js';
import {KEY, loadWorkspace, persistWorkspace, parseBackup, importBackup} from '../src/storage.js';

const clone = structuredClone;
const raw = '  阿岚带着😀走过桥。  \r\n\r\n\t\r\n  她拾起信件。\t\n尾声。\r';
const blue = '纸灯是蓝色的。';
const red = '纸灯是红色的。';
const key = state => state.drafts.at(-1).id;
const candidate = state => state.drafts.at(-1);
const backup = state => ({format:1, serial:0, state, editing:{}, patch:null});
const report = (factChecks = []) => ({summary:'离线夹具提供的审查建议，并非语义正确性证明', checks:[], issues:[], factChecks, provider:'manual-review-fixture'});

function classified({text = raw, intent = 'local_prose', projectId = 'manual-chapter', chapterId = 'ch1', canon = false} = {}) {
 let state = e.createProjectFromConfig({projectId, idea:'桥边发现信件', chapters:[{text:chapterId === 'ch1' ? text : blue}, {text:chapterId === 'ch2' ? text : '第二章尚待创作。'}]});
 if (canon) {
  state = e.commitPatch(state, e.proposeCustomPatch(state, 'ch1', {intent:'author_fact', statement:blue}));
  state = reviewed(e.stageManualDraft(state, 'ch1'));
  state = modelReviewed(state, factReport(state, 'consistent'));
  state = e.acceptDraft(state, key(state));
 }
 const patch = e.proposeCustomPatch(state, chapterId, {intent, ...(intent === 'author_fact' ? {statement:text.trim()} : {})});
 return e.commitPatch(state, patch);
}

function manual(options = {}) {
 return e.stageManualDraft(classified(options), options.chapterId ?? 'ch1');
}

function reviewed(state = manual()) {
 return e.reviewDraft(state, key(state));
}

function withCanon() {
 return reviewed(manual({chapterId:'ch2', text:red, canon:true}));
}

function factReport(state, status = 'contradiction') {
 const fact = state.facts[0];
 return report([{factId:fact.id, recordVersion:fact.recordVersion, status, explanation:'离线测试明确指定颜色关系', sourceQuote:candidate(state).text}]);
}

function modelReviewed(state, review = report()) {
 return e.attachSemanticReview(state, key(state), review, e.createReviewBinding(state, key(state)));
}

function resolveFact(state) {
 const fact = state.facts[0];
 return e.resolveFactReview(state, key(state), {
  factId:fact.id, recordVersion:fact.recordVersion, action:'accept_exception',
  reason:'作者明确保留当前正文中的有意差异', reviewHash:e.hash(JSON.stringify(candidate(state).modelReview)),
 }, e.createReviewBinding(state, key(state)));
}

function extracted(state = manual(), entries = [{label:'阿岚拾起信件', sourceParagraphIndex:1}]) {
 state = e.beginMemoryExtraction(state, key(state));
 return e.attachMemoryExtraction(state, key(state), {staging:entries, reviewNotes:[], provider:'manual-extraction-fixture'}, e.createExtractionBinding(state, key(state)));
}

function selectMemory(state, action = 'attest_keep') {
 const row = e.getMemoryReviewGate(state, key(state))[0];
 return e.decideMemoryCandidate(state, key(state), {
  candidateId:row.candidateId, action, reviewHash:row.reviewHash,
  ...(action === 'attest_keep' ? {reason:'作者逐项核对并明确保留原始主张', attestation:{protocol:'quote-grounded-memory-v1', accepted:true, statement:e.MEMORY_ATTESTATION_STATEMENT}} : {}),
 }, row.binding);
}

test('manual preparation copies exact saved prose with explicit source provenance and changes no story state', t => {
 const fetch = t.mock.method(globalThis, 'fetch', () => { throw new Error('Manual preparation must not call a provider'); });
 const state = classified(), before = clone(state), source = state.chapters[0], patch = state.commits.at(-1);
 const next = e.stageManualDraft(state, 'ch1'), draft = candidate(next);
 assert.deepEqual(state, before);
 assert.equal(draft.text, raw);
 assert.equal(draft.textHash, e.hash(raw));
 assert.equal(draft.chapterId, 'ch1');
 assert.equal(draft.status, 'DRAFT');
 assert.deepEqual(draft.manualSource, {
  protocol:'manual-chapter-v1', authority:'explicit_author_selection', projectId:state.projectId,
  chapterId:'ch1', revision:source.revision, textHash:e.hash(raw), textSnapshot:raw, patchId:patch.patchId,
 });
 assert.deepEqual(draft.proseVersions, [{revision:1, text:raw, textHash:e.hash(raw), paragraphs:segmentProse(raw)}]);
 assert.equal(draft.extraction.status, 'skipped');
 assert.equal(e.hasCurrentExtraction(next, draft.id), true);
 assert.equal(draft.requiresSemanticReview, false);
 assert.notEqual(draft.providerInfo?.isLive, true);
 assert.deepEqual(draft.staging, []);
 assert.equal(draft.review, null);
 assert.equal(draft.modelReview, null);
 for (const field of ['chapters', 'facts', 'events', 'knowledge', 'commits', 'version']) assert.deepEqual(next[field], before[field]);
 assert.equal(fetch.mock.callCount(), 0);
});

test('manual preparation requires a custom project, existing target and explicit committed classification', () => {
 assert.throws(() => e.stageManualDraft(e.createInitialState(), 'ch1'));
 const unclassified = e.createProjectFromConfig({projectId:'unclassified', chapters:[{text:raw}]});
 assert.throws(() => e.stageManualDraft(unclassified, 'ch1'));
 assert.throws(() => e.stageManualDraft(classified(), 'missing'));
 const pendingPatch = e.proposeCustomPatch(unclassified, 'ch1', {intent:'local_prose'});
 unclassified.pendingPatches.push(pendingPatch);
 assert.throws(() => e.stageManualDraft(unclassified, 'ch1'));
});

test('a CLEAN flag cannot replace the exact non-undone author-classification commit', () => {
 const state = classified(), last = state.commits.at(-1);
 const missing = clone(state); missing.commits = [];
 assert.throws(() => e.stageManualDraft(missing, 'ch1'));
 const undone = e.undoCommit(state, last.id);
 undone.chapters[0].syncStatus = 'CLEAN';
 undone.chapters[0].syncedRevision = undone.chapters[0].revision;
 assert.throws(() => e.stageManualDraft(undone, 'ch1'));
 const wrongRevision = e.saveRevision(state, 'ch1', '另一份尚未分类的正文。', state.chapters[0].revision);
 wrongRevision.chapters[0].syncStatus = 'CLEAN';
 wrongRevision.chapters[0].syncedRevision = wrongRevision.chapters[0].revision;
 assert.throws(() => e.stageManualDraft(wrongRevision, 'ch1'));
});

test('legacy unmarked classification history stays readable but needs an explicit fresh author classification', () => {
 const legacy = classified(), old = legacy.commits.at(-1);
 delete old.authority;
 delete old.authorInstruction;
 const restored = parseBackup(JSON.stringify(backup(legacy))).state;
 assert.throws(() => e.stageManualDraft(restored, 'ch1'));
 const reclassified = e.commitPatch(restored, e.proposeCustomPatch(restored, 'ch1', {intent:'local_prose'}));
 const staged = e.stageManualDraft(reclassified, 'ch1');
 assert.equal(candidate(staged).text, raw);
 assert.notEqual(candidate(staged).manualSource.patchId, old.patchId);
 assert.deepEqual(staged.chapters, legacy.chapters);
});

test('classification provenance binds exact saved text even when legacy hashes collide', () => {
 const original = classified({text:'😀'}), changed = clone(original);
 assert.equal(e.hash('😀'), e.hash('😁'));
 changed.chapters[0].text = '😁';
 changed.chapters[0].revisions[0].text = '😁';
 changed.chapters[0].revisions[0].paragraphs[0].text = '😁';
 assert.throws(() => e.stageManualDraft(changed, 'ch1'));
 const staged = e.stageManualDraft(original, 'ch1');
 const sourceCommit = staged.commits.find(item => item.patchId === candidate(staged).manualSource.patchId);
 assert.equal(sourceCommit.authorTextHash, e.hash('😀'));
 assert.equal(sourceCommit.authorTextSnapshot, '😀');
});

test('undoing a source classification cannot revive its old candidate through same-text reclassification', () => {
 let state = manual();
 const id = key(state), origin = clone(candidate(state).manualSource), oldCommit = state.commits.find(item => item.patchId === origin.patchId);
 state = e.undoCommit(state, oldCommit.id);
 assert.deepEqual(parseBackup(JSON.stringify(backup(state))), backup(state));
 state = e.commitPatch(state, e.proposeCustomPatch(state, 'ch1', {intent:'local_prose'}));
 assert.equal(state.chapters[0].text, origin.textSnapshot);
 assert.equal(state.chapters[0].revision, origin.revision);
 assert.throws(() => e.refreshDraftContext(state, id), {code:'MANUAL_SOURCE_CHANGED'});
 assert.throws(() => e.skipManualMemoryExtraction(state, id), {code:'MANUAL_SOURCE_CHANGED'});
 assert.throws(() => e.acceptDraft(reviewed(state), id), {code:'REVIEW_REQUIRED'});
 assert.deepEqual(parseBackup(JSON.stringify(backup(state))), backup(state));
 state = e.rejectDraft(state, id);
 state = reviewed(e.stageManualDraft(state, 'ch1'));
 assert.notEqual(candidate(state).manualSource.patchId, origin.patchId);
 assert.deepEqual(state.drafts.find(item => item.id === id).manualSource, origin);
 assert.equal(candidate(e.acceptDraft(state, key(state))).status, 'ACCEPTED');
});

test('pending source or unrelated chapter synchronization blocks preparation without altering saved text', () => {
 for (const chapterId of ['ch1', 'ch2']) {
  const source = classified(), chapter = source.chapters.find(item => item.id === chapterId);
  const state = e.saveRevision(source, chapterId, chapter.text + '\n尚未同步的新段。', chapter.revision), before = clone(state);
  assert.throws(() => e.stageManualDraft(state, 'ch1'), {code:'UNSYNCED_TEXT'});
  assert.deepEqual(state, before);
 }
});

test('manual preparation and acceptance cannot bypass pending patches or unaccepted predecessors', () => {
 const later = classified({chapterId:'ch2', text:red}), before = clone(later);
 assert.throws(() => e.stageManualDraft(later, 'ch2'), {code:'PREVIOUS_CHAPTER'});
 assert.deepEqual(later, before);
 const source = classified();
 source.pendingPatches.push(e.proposeCustomPatch(source, 'ch1', {intent:'local_prose'}));
 assert.throws(() => e.stageManualDraft(source, 'ch1'), {code:'PENDING_PATCH'});
 const staged = reviewed();
 staged.pendingPatches.push(e.proposeCustomPatch(staged, 'ch2', {intent:'local_prose'}));
 assert.throws(() => e.acceptDraft(staged, key(staged)), {code:'REVIEW_REQUIRED'});
});

test('a same-target active manual or generated candidate prevents duplicate manual preparation', () => {
 const source = classified();
 for (const active of [
  e.stageManualDraft(source, 'ch1'),
  e.stageProseDraft(source, {text:'模型候选。', context:e.getContext(source), provider:'offline-fixture'}, 'ch1'),
 ]) {
  for (const state of [active, e.reviewDraft(active, key(active))]) {
   const before = clone(state);
   assert.throws(() => e.stageManualDraft(state, 'ch1'));
   assert.deepEqual(state, before);
  }
  const rejected = e.rejectDraft(active, key(active));
  assert.equal(candidate(e.stageManualDraft(rejected, 'ch1')).status, 'DRAFT');
 }
 const otherTarget = e.stageProseDraft(source, {text:'第二章候选。', context:e.getContext(source), provider:'offline-fixture'}, 'ch2');
 assert.equal(candidate(e.stageManualDraft(otherTarget, 'ch1')).chapterId, 'ch1');
});

test('manual preparation enforces nonempty and full-length prose limits without trimming', () => {
 const boundary = ' ' + '界'.repeat(MAX_PROSE_LENGTH - 2) + ' ';
 assert.equal(candidate(manual({text:boundary})).text, boundary);
 assert.throws(() => manual({text:'界'.repeat(MAX_PROSE_LENGTH + 1)}), {code:'INVALID_TEXT'});
 assert.throws(() => manual({text:' \r\n\t'}), {code:'INVALID_TEXT'});
});

test('zero-memory manual acceptance still needs structural review and preserves every original byte and version', t => {
 const fetch = t.mock.method(globalThis, 'fetch', () => { throw new Error('Zero-memory manual acceptance must not call a provider'); });
 const state = manual(), id = key(state), source = clone(state.chapters[0]), provenance = clone(candidate(state).manualSource);
 assert.throws(() => e.acceptDraft(state, id), {code:'REVIEW_REQUIRED'});
 const checked = e.reviewDraft(state, id);
 assert.equal(candidate(checked).review.passed, true);
 const accepted = e.acceptDraft(checked, id), draft = candidate(accepted), chapter = accepted.chapters[0];
 assert.equal(draft.status, 'ACCEPTED');
 assert.equal(chapter.status, 'ACCEPTED');
 assert.equal(chapter.syncStatus, 'CLEAN');
 assert.equal(chapter.text, raw);
 assert.deepEqual(chapter.revisions.slice(0, -1), source.revisions);
 assert.equal(chapter.revisions.at(-1).text, raw);
 assert.deepEqual(chapter.revisions.at(-1).paragraphs, segmentProse(raw));
 assert.deepEqual(draft.manualSource, provenance);
 assert.deepEqual(draft.proseVersions, candidate(state).proseVersions);
 assert.deepEqual(accepted.commits.at(-1).manualSource, provenance);
 assert.deepEqual(accepted.commits.at(-1).acceptance, {
  protocol:'manual-chapter-v1', authority:'explicit_author_decision', draftRevision:draft.revision,
  textHash:e.hash(raw), textSnapshot:raw, sourceRevision:source.revision,
  memoryExtraction:'skipped', semanticStatus:'not_evaluated',
 });
 assert.equal(accepted.commits.at(-1).kind, 'draft_accept');
 assert.deepEqual(accepted.commits.at(-1).memoryCandidateIds, []);
 assert.deepEqual(accepted.commits.at(-1).memoryDecisions, []);
 assert.deepEqual(accepted.events, []);
 assert.deepEqual(accepted.facts, []);
 assert.deepEqual(e.acceptDraft(accepted, id), accepted);
 assert.equal(fetch.mock.callCount(), 0);
});

test('editing an accepted manual chapter revokes manuscript acceptance until its new saved version is accepted', () => {
 const checked = reviewed(), accepted = e.acceptDraft(checked, key(checked));
 const historical = clone(candidate(accepted)), text = raw + '\n作者新写的结尾。';
 let state = e.saveRevision(accepted, 'ch1', text, accepted.chapters[0].revision);
 assert.equal(state.chapters[0].status, 'DRAFT');
 assert.equal(e.getContext(state).sources[0].role, 'unaccepted_manuscript');
 state = e.commitPatch(state, e.proposeCustomPatch(state, 'ch1', {intent:'local_prose'}));
 assert.equal(state.chapters[0].syncStatus, 'CLEAN');
 assert.equal(state.chapters[0].status, 'DRAFT');
 assert.equal(e.getContext(state).sources[0].role, 'unaccepted_manuscript');
 state = e.commitPatch(state, e.proposeCustomPatch(state, 'ch2', {intent:'local_prose'}));
 assert.throws(() => e.stageManualDraft(state, 'ch2'), {code:'PREVIOUS_CHAPTER'});
 assert.deepEqual(state.drafts.find(item => item.id === historical.id), historical);
 assert.deepEqual(parseBackup(JSON.stringify(backup(state))), backup(state));
 state = reviewed(e.stageManualDraft(state, 'ch1'));
 assert.equal(candidate(state).manualSource.textSnapshot, text);
 state = e.acceptDraft(state, key(state));
 assert.equal(state.chapters[0].status, 'ACCEPTED');
 assert.equal(e.getContext(state).sources[0].role, 'accepted_manuscript');
 assert.equal(e.getContext(state).sources[0].text, text);
 assert.deepEqual(state.drafts.find(item => item.id === historical.id), historical);
 assert.equal(candidate(e.stageManualDraft(state, 'ch2')).chapterId, 'ch2');
});

test('manual acceptance invalidation preserves legacy and latest-generated chapter edit behavior', () => {
 const checked = reviewed(), manualAccepted = e.acceptDraft(checked, key(checked));
 let generated = e.stageProseDraft(manualAccepted, {text:'此后接受的模型正文。', context:e.getContext(manualAccepted), provider:'offline-fixture'}, 'ch1');
 generated = extracted(generated, []);
 generated = e.acceptDraft(reviewed(generated), key(generated));
 assert.equal(generated.commits.at(-1).manualSource, undefined);
 for (const source of [e.createInitialState(), generated]) {
  const changed = e.saveRevision(source, 'ch1', source.chapters[0].text + '\n局部修改。', source.chapters[0].revision);
  assert.equal(changed.chapters[0].status, 'ACCEPTED');
  assert.equal(changed.chapters[0].syncStatus, 'PENDING');
 }
});

test('undoing manual acceptance cannot restore accepted manuscript through classification alone', () => {
 const checked = reviewed(), accepted = e.acceptDraft(checked, key(checked));
 const historical = clone(candidate(accepted)), acceptance = accepted.commits.at(-1);
 let state = e.undoCommit(accepted, acceptance.id);
 assert.equal(state.chapters[0].text, raw);
 assert.equal(state.chapters[0].status, 'DRAFT');
 assert.equal(e.getContext(state).sources[0].role, 'unaccepted_manuscript');
 state = e.commitPatch(state, e.proposeCustomPatch(state, 'ch1', {intent:'local_prose'}));
 assert.equal(state.chapters[0].syncStatus, 'CLEAN');
 assert.equal(state.chapters[0].status, 'DRAFT');
 assert.equal(e.getContext(state).sources[0].role, 'unaccepted_manuscript');
 state = e.commitPatch(state, e.proposeCustomPatch(state, 'ch2', {intent:'local_prose'}));
 assert.throws(() => e.stageManualDraft(state, 'ch2'), {code:'PREVIOUS_CHAPTER'});
 assert.deepEqual(state.drafts.find(item => item.id === historical.id), historical);
 assert.deepEqual(parseBackup(JSON.stringify(backup(state))), backup(state));
 state = reviewed(e.stageManualDraft(state, 'ch1'));
 state = e.acceptDraft(state, key(state));
 assert.equal(e.getContext(state).sources[0].role, 'accepted_manuscript');
 assert.equal(state.chapters[0].text, raw);
 assert.deepEqual(state.drafts.find(item => item.id === historical.id), historical);
 assert.equal(candidate(e.stageManualDraft(state, 'ch2')).chapterId, 'ch2');
});

test('confirmed Canon makes a manual candidate require current model review despite having no memory candidates', () => {
 const state = withCanon(), id = key(state);
 assert.equal(candidate(state).requiresSemanticReview, true);
 assert.deepEqual(candidate(state).staging, []);
 assert.equal(candidate(state).review.passed, true);
 assert.throws(() => e.acceptDraft(state, id), {code:'SEMANTIC_REVIEW_REQUIRED'});
 const reviewedState = modelReviewed(state, factReport(state, 'consistent'));
 assert.equal(candidate(e.acceptDraft(reviewedState, id)).status, 'ACCEPTED');
});

test('author_fact classification of the manual source uses the same confirmed-Canon gate', () => {
 const state = reviewed(manual({text:blue, intent:'author_fact'}));
 assert.equal(state.facts.length, 1);
 assert.equal(candidate(state).requiresSemanticReview, true);
 assert.equal(candidate(state).manualSource.patchId, state.commits.at(-1).patchId);
 assert.throws(() => e.acceptDraft(state, key(state)), {code:'SEMANTIC_REVIEW_REQUIRED'});
});

test('confirmed-Canon manual provenance cannot be downgraded by flipping its review-required flag', () => {
 const source = withCanon(), changed = clone(source);
 candidate(changed).requiresSemanticReview = false;
 assert.equal(e.hasCurrentExtraction(changed, key(changed)), false);
 assert.throws(() => e.acceptDraft(changed, key(changed)));
 assert.throws(() => parseBackup(JSON.stringify(backup(changed))));
});

for (const status of ['contradiction', 'unknown', 'missing']) test(`manual Canon ${status} needs an explicit bound author exception and never mutates Canon`, () => {
 const source = withCanon(), facts = clone(source.facts);
 let state = modelReviewed(source, status === 'missing' ? report() : factReport(source, status));
 const row = e.getFactReviewGate(state, key(state))[0];
 assert.equal(row.status, status === 'missing' ? 'unknown' : status);
 assert.equal(row.blocking, true);
 assert.throws(() => e.acceptDraft(state, key(state)), {code:'FACT_DECISION_REQUIRED'});
 state = resolveFact(state);
 const accepted = e.acceptDraft(state, key(state));
 assert.deepEqual(accepted.facts, facts);
 assert.deepEqual(accepted.events, []);
 assert.equal(accepted.commits.at(-1).factDecisions.length, 1);
 assert.equal(accepted.commits.at(-1).factDecisions[0].authority, 'explicit_author_decision');
});

test('manual author exceptions cannot waive separate blocking model issues or a changed review', () => {
 const source = withCanon(), review = factReport(source);
 review.issues = [{severity:'error', explanation:'正文仍有独立阻塞问题', sourceQuote:red}];
 const blocked = resolveFact(modelReviewed(source, review));
 assert.throws(() => e.acceptDraft(blocked, key(blocked)), {code:'SEMANTIC_REVIEW_ERRORS'});
 const resolved = resolveFact(modelReviewed(source, factReport(source)));
 const rereviewed = modelReviewed(resolved, factReport(resolved));
 assert.deepEqual(candidate(rereviewed).factDecisions, []);
 assert.throws(() => e.acceptDraft(rereviewed, key(rereviewed)), {code:'FACT_DECISION_REQUIRED'});
 const forged = clone(resolved); candidate(forged).modelReview.factChecks[0].status = 'consistent';
 assert.throws(() => e.acceptDraft(forged, key(forged)), {code:'SEMANTIC_REVIEW_REQUIRED'});
});

test('manual extraction is opt-in and extracted memories still need individual explicit selections', () => {
 const state = reviewed(extracted()), id = key(state), row = e.getMemoryReviewGate(state, id)[0];
 assert.equal(candidate(state).extraction.status, 'complete');
 assert.equal(row.resolved, false);
 assert.throws(() => e.acceptDraft(state, id), {code:'MEMORY_DECISION_REQUIRED'});
 const accepted = e.acceptDraft(selectMemory(state), id);
 assert.equal(accepted.events.length, 1);
 assert.equal(accepted.events[0].source.quote, segmentProse(raw)[1].text);
 assert.equal(accepted.events[0].memoryDecision.action, 'attest_keep');
 assert.deepEqual(accepted.commits.at(-1).manualSource, candidate(state).manualSource);
 assert.deepEqual(accepted.facts, []);
});

test('explicitly skipping an extracted manual candidate clears current authorities and retains its audit', () => {
 const state = selectMemory(reviewed(extracted())), id = key(state), before = clone(candidate(state));
 const next = e.skipManualMemoryExtraction(state, id), draft = candidate(next);
 assert.equal(draft.extraction.status, 'skipped');
 assert.equal(e.hasCurrentExtraction(next, id), true);
 assert.deepEqual(draft.staging, []);
 assert.deepEqual(draft.memoryDecisions, []);
 assert.deepEqual(draft.factDecisions, []);
 assert.equal(draft.review, null);
 assert.equal(draft.modelReview, null);
 assert.deepEqual(draft.memoryDecisionHistory, before.memoryDecisionHistory);
 assert.deepEqual(draft.manualSource, before.manualSource);
 assert.deepEqual(draft.proseVersions, before.proseVersions);
 assert.ok(draft.memoryArchives.some(archive => JSON.stringify(archive.candidates) === JSON.stringify(before.staging) && JSON.stringify(archive.decisions) === JSON.stringify(before.memoryDecisions)));
 assert.throws(() => e.acceptDraft(next, id), {code:'REVIEW_REQUIRED'});
 assert.deepEqual(e.acceptDraft(reviewed(next), id).events, []);
 assert.deepEqual(candidate(state), before);
});

test('a fresh explicit skip revokes the previous Canon review and exception binding', () => {
 const source = withCanon(), previous = resolveFact(modelReviewed(source, factReport(source))), id = key(previous);
 const binding = e.createReviewBinding(previous, id), next = e.skipManualMemoryExtraction(previous, id);
 assert.equal(candidate(next).modelReview, null);
 assert.equal(candidate(next).review, null);
 assert.deepEqual(candidate(next).factDecisions, []);
 assert.notEqual(candidate(next).extraction.attempt, candidate(previous).extraction.attempt);
 assert.throws(() => e.attachSemanticReview(next, id, factReport(next), binding), {code:'STALE_SEMANTIC_REVIEW'});
 assert.throws(() => e.acceptDraft(reviewed(next), id), {code:'SEMANTIC_REVIEW_REQUIRED'});
});

test('manual extraction failure stays blocking until explicit skip, and a late result cannot revive it', () => {
 let state = manual();
 state = e.beginMemoryExtraction(state, key(state));
 const id = key(state), binding = e.createExtractionBinding(state, id);
 state = e.markExtractionFailure(state, id, binding);
 assert.equal(candidate(state).extraction.status, 'failed');
 assert.throws(() => e.acceptDraft(reviewed(state), id), {code:'REVIEW_REQUIRED'});
 state = e.skipManualMemoryExtraction(state, id);
 assert.equal(candidate(state).text, raw);
 assert.throws(() => e.attachMemoryExtraction(state, id, {staging:[], reviewNotes:[], provider:'late-fixture'}, binding), {code:'STALE_EXTRACTION'});
 assert.equal(candidate(e.acceptDraft(reviewed(state), id)).status, 'ACCEPTED');
});

test('manual candidate edits are rejected; saved chapter edits require reclassification and a fresh candidate', () => {
 const source = withCanon(), state = resolveFact(modelReviewed(source, factReport(source))), id = key(state), before = clone(candidate(state));
 const binding = e.createReviewBinding(state, id), text = '  纸灯变红了。😀\r\n作者保留的新段。\t';
 assert.throws(() => e.editDraft(state, id, text), {code:'MANUAL_SOURCE_IMMUTABLE'});
 assert.deepEqual(candidate(state), before);
 let next = e.saveRevision(state, 'ch2', text, state.chapters[1].revision);
 assert.equal(candidate(next).text, before.text);
 assert.deepEqual(candidate(next).proseVersions, before.proseVersions);
 assert.deepEqual(candidate(next).manualSource, before.manualSource);
 assert.equal(e.hasCurrentExtraction(next, id), false);
 assert.throws(() => e.attachSemanticReview(next, id, report(), binding), {code:'STALE_SEMANTIC_REVIEW'});
 assert.throws(() => e.acceptDraft(reviewed(next), id), {code:'REVIEW_REQUIRED'});
 assert.throws(() => e.skipManualMemoryExtraction(next, id));
 assert.throws(() => e.refreshDraftContext(next, id));
 assert.deepEqual(parseBackup(JSON.stringify(backup(next))), backup(next));
 next = e.commitPatch(next, e.proposeCustomPatch(next, 'ch2', {intent:'local_prose'}));
 assert.throws(() => e.skipManualMemoryExtraction(next, id), {code:'MANUAL_SOURCE_CHANGED'});
 assert.throws(() => e.refreshDraftContext(next, id), {code:'MANUAL_SOURCE_CHANGED'});
 assert.throws(() => e.acceptDraft(reviewed(next), id), {code:'REVIEW_REQUIRED'});
 assert.throws(() => e.stageManualDraft(next, 'ch2'));
 assert.deepEqual(parseBackup(JSON.stringify(backup(next))), backup(next));
 next = e.rejectDraft(next, id);
 next = reviewed(e.stageManualDraft(next, 'ch2'));
 assert.notEqual(key(next), id);
 assert.equal(candidate(next).text, text);
 assert.equal(candidate(next).manualSource.textSnapshot, text);
 assert.equal(candidate(next).manualSource.revision, next.chapters[1].revision);
 assert.notEqual(candidate(next).manualSource.patchId, before.manualSource.patchId);
 assert.deepEqual(next.drafts.find(item => item.id === id).proseVersions, before.proseVersions);
 assert.throws(() => e.acceptDraft(next, key(next)), {code:'SEMANTIC_REVIEW_REQUIRED'});
 next = resolveFact(modelReviewed(next, factReport(next, 'unknown')));
 assert.equal(e.acceptDraft(next, key(next)).chapters[1].text, text);
});

test('manual skip cannot silently rebind a candidate after source or story context changes', () => {
 const state = reviewed(), id = key(state), chapter = state.chapters[1];
 let next = e.saveRevision(state, 'ch2', chapter.text + '\n新背景。', chapter.revision);
 assert.throws(() => e.skipManualMemoryExtraction(next, id));
 next = e.commitPatch(next, e.proposeCustomPatch(next, 'ch2', {intent:'local_prose'}));
 assert.throws(() => e.skipManualMemoryExtraction(next, id));
 assert.throws(() => e.acceptDraft(next, id), {code:'REVIEW_REQUIRED'});
 next = e.refreshDraftContext(next, id);
 assert.equal(candidate(next).extraction.status, 'pending');
 next = reviewed(e.skipManualMemoryExtraction(next, id));
 assert.equal(e.acceptDraft(next, id).chapters[0].text, raw);
});

test('manual skip is unavailable to generated prose even when provider output claims manual provenance', () => {
 const source = classified(), provenance = candidate(e.stageManualDraft(source, 'ch1')).manualSource;
 for (const live of [false, true]) {
  const state = e.stageProseDraft(source, {text:raw, context:e.getContext(source), provider:{id:'writer-fixture', isLive:live}, manualSource:clone(provenance), extraction:{status:'skipped'}}, 'ch1');
  assert.equal(candidate(state).manualSource, undefined);
  assert.equal(candidate(state).extraction.status, 'pending');
  assert.throws(() => e.skipManualMemoryExtraction(state, key(state)));
  const forged = clone(state); candidate(forged).extraction.status = 'skipped';
  assert.equal(e.hasCurrentExtraction(forged, key(forged)), false);
  assert.throws(() => e.acceptDraft(reviewed(forged), key(forged)), {code:'REVIEW_REQUIRED'});
  assert.throws(() => parseBackup(JSON.stringify(backup(forged))));
 }
});

test('accepted and rejected manual candidates cannot opt out or restart extraction', () => {
 const source = reviewed();
 for (const state of [e.acceptDraft(source, key(source)), e.rejectDraft(source, key(source))]) {
  assert.throws(() => e.skipManualMemoryExtraction(state, key(state)), {code:'DRAFT_STATUS'});
  assert.throws(() => e.beginMemoryExtraction(state, key(state)), {code:'DRAFT_STATUS'});
 }
});

test('manual source tampering and removal cannot authorize acceptance or a valid backup', () => {
 const original = reviewed();
 for (const mutate of [
  draft => { delete draft.manualSource; },
  draft => { draft.manualSource.protocol = 'generated'; },
  draft => { draft.manualSource.authority = 'model'; },
  draft => { draft.manualSource.projectId = 'foreign'; },
  draft => { draft.manualSource.chapterId = 'ch2'; },
  draft => { draft.manualSource.revision++; },
  draft => { draft.manualSource.textHash = 'wrong'; },
  draft => { draft.manualSource.textSnapshot = raw.trim(); },
  draft => { draft.manualSource.patchId = 'missing'; },
 ]) {
  const state = clone(original); mutate(candidate(state));
  assert.throws(() => e.acceptDraft(state, key(state)));
  assert.throws(() => parseBackup(JSON.stringify(backup(state))));
 }
});

test('manual provenance binds exact source text even across a legacy emoji-hash collision', () => {
 const state = reviewed(manual({text:'😀'})), changed = clone(state);
 assert.equal(e.hash('😀'), e.hash('😁'));
 candidate(changed).manualSource.textSnapshot = '😁';
 assert.throws(() => e.acceptDraft(changed, key(changed)));
 assert.throws(() => parseBackup(JSON.stringify(backup(changed))));
});

test('a syntactically valid appended prose version cannot change an imported manual source snapshot', () => {
 const source = manual(), destination = backup(e.createProjectFromConfig({projectId:'forged-manual-target'}));
 const imported = importBackup(destination, backup(source), () => 'original-manual-import').state;
 for (const original of [source, imported]) {
  const forged = clone(original), draft = candidate(forged), originalSource = clone(draft.manualSource);
  const text = '伪造的第二版手写候选。😀\r\n没有保存或作者分类的新正文。';
  draft.revision = 2;
  draft.text = text;
  draft.textHash = e.hash(text);
  draft.proseVersions.push({revision:2, text, textHash:e.hash(text), paragraphs:segmentProse(text)});
  draft.extraction = {status:'pending', attempt:draft.extraction.attempt + 1, binding:null};
  draft.review = null;
  draft.modelReview = null;
  draft.factDecisions = [];
  draft.status = 'DRAFT';
  assert.equal(draft.proseVersions.length, draft.revision);
  assert.equal(draft.proseVersions.at(-1).textHash, draft.textHash);
  assert.deepEqual(draft.proseVersions.at(-1).paragraphs, segmentProse(draft.text));
  assert.deepEqual(draft.manualSource, originalSource);
  assert.equal(forged.chapters[0].text, originalSource.textSnapshot);
  assert.throws(() => parseBackup(JSON.stringify(backup(forged))));
  assert.throws(() => importBackup(destination, backup(forged), () => 'forged-manual-import'));
  assert.throws(() => e.skipManualMemoryExtraction(forged, draft.id), {code:'INVALID_MANUAL_SOURCE'});
  const checked = e.reviewDraft(forged, draft.id);
  assert.equal(candidate(checked).review.passed, false);
  assert.throws(() => e.acceptDraft(checked, draft.id), {code:'REVIEW_REQUIRED'});
  candidate(checked).review.passed = true;
  assert.throws(() => e.acceptDraft(checked, draft.id), {code:'REVIEW_REQUIRED'});
 }
});

test('removing manualSource cannot downgrade a reserved manual provider into a generic nonlive candidate', () => {
 const destination = backup(e.createProjectFromConfig({projectId:'removed-origin-target'}));
 for (const source of [reviewed(), withCanon()]) {
  for (const status of ['pending', 'complete']) {
   for (const marker of ['both', 'provider', 'providerInfo']) {
    const forged = clone(source), draft = candidate(forged), binding = clone(draft.extraction.binding);
    delete draft.manualSource;
    draft.requiresSemanticReview = false;
    if (marker === 'provider') draft.providerInfo.id = 'generic-offline-fixture';
    if (marker === 'providerInfo') draft.provider = 'generic-offline-fixture';
    draft.extraction = status === 'pending'
     ? {status:'pending', attempt:binding.attempt, binding:null}
     : {status:'complete', attempt:binding.attempt, binding, provider:'forged-empty-extractor', reviewNotes:[], stagingHash:e.hash(JSON.stringify([]))};
    draft.modelReview = null;
    draft.factDecisions = [];
    assert.deepEqual(draft.staging, []);
    assert.equal(draft.providerInfo.isLive, false);
    assert.throws(() => parseBackup(JSON.stringify(backup(forged))));
    assert.throws(() => importBackup(destination, backup(forged), () => 'removed-origin-import'));
    assert.throws(() => e.skipManualMemoryExtraction(forged, draft.id));
    const checked = e.reviewDraft(forged, draft.id);
    assert.equal(candidate(checked).review.passed, false);
    assert.ok(candidate(checked).review.issues.some(issue => issue.ruleId === 'MANUAL_SOURCE'));
    assert.throws(() => e.acceptDraft(checked, draft.id), {code:'REVIEW_REQUIRED'});
    candidate(checked).review.passed = true;
    assert.throws(() => e.acceptDraft(checked, draft.id), {code:'REVIEW_REQUIRED'});
   }
  }
 }
});

test('skipped extraction requires explicit authority and every exact current binding field', () => {
 const original = reviewed();
 const mutations = [
  draft => { delete draft.extraction.authority; },
  draft => { draft.extraction.authority = 'provider'; },
  draft => { draft.extraction.binding = null; },
  draft => { draft.extraction.attempt++; },
  draft => { draft.extraction.provider = 'forged-success'; },
 ];
 for (const field of Object.keys(candidate(original).extraction.binding)) {
  mutations.push(draft => { delete draft.extraction.binding[field]; });
 }
 mutations.push(draft => { draft.extraction.binding.unexpected = true; });
 for (const mutate of mutations) {
  const state = clone(original); mutate(candidate(state));
  assert.equal(e.hasCurrentExtraction(state, key(state)), false);
  assert.throws(() => e.acceptDraft(state, key(state)), {code:'REVIEW_REQUIRED'});
  assert.throws(() => parseBackup(JSON.stringify(backup(state))));
 }
});

test('manual skipped, pending, failed, extracted, source-edited, accepted and rejected states round-trip exactly', () => {
 const skipped = manual(), pending = e.beginMemoryExtraction(skipped, key(skipped));
 const failed = e.markExtractionFailure(pending, key(pending), e.createExtractionBinding(pending, key(pending)));
 const checked = reviewed(skipped);
 const edited = e.saveRevision(checked, 'ch1', '修改后的正文。', checked.chapters[0].revision);
 for (const state of [skipped, pending, failed, extracted(skipped), edited, checked, e.acceptDraft(checked, key(checked)), e.rejectDraft(checked, key(checked))]) {
  assert.deepEqual(parseBackup(JSON.stringify(backup(state))), backup(state));
 }
});

test('saving and reloading a reviewed manual candidate retains exact source and current zero-memory authority', t => {
 const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage'), map = new Map();
 Object.defineProperty(globalThis, 'localStorage', {configurable:true, value:{
  getItem:name => map.get(name) ?? null,
  setItem:(name, value) => map.set(name, String(value)),
  removeItem:name => map.delete(name),
 }});
 t.after(() => previous ? Object.defineProperty(globalThis, 'localStorage', previous) : delete globalThis.localStorage);
 const source = backup(reviewed()), saved = persistWorkspace(source, 0), loaded = loadWorkspace();
 assert.deepEqual(loaded, saved);
 assert.equal(map.get(KEY), JSON.stringify(saved));
 assert.deepEqual(candidate(loaded.state).manualSource, candidate(source.state).manualSource);
 assert.equal(e.acceptDraft(loaded.state, key(loaded.state)).chapters[0].text, raw);
});

test('import preserves manual source audit but revokes pending skip and review until explicit current-project choice', () => {
 const source = backup(reviewed()), before = clone(source), current = backup(e.createProjectFromConfig({projectId:'import-target'}));
 const imported = importBackup(current, source, () => 'manual-import'), draft = candidate(imported.state);
 assert.deepEqual(source, before);
 assert.deepEqual(imported.state.importOrigin.original.state, before.state);
 assert.deepEqual(draft.manualSource, {...candidate(before.state).manualSource, projectId:'manual-import'});
 assert.deepEqual(draft.proseVersions, candidate(before.state).proseVersions);
 assert.equal(draft.extraction.status, 'pending');
 assert.equal(draft.extraction.binding, null);
 assert.equal(draft.review, null);
 assert.equal(draft.modelReview, null);
 assert.deepEqual(draft.staging, []);
 assert.deepEqual(draft.memoryDecisions, []);
 assert.equal(e.hasCurrentExtraction(imported.state, draft.id), false);
 assert.throws(() => e.acceptDraft(reviewed(imported.state), draft.id), {code:'REVIEW_REQUIRED'});
 assert.deepEqual(parseBackup(JSON.stringify(imported)), imported);
 const currentChoice = reviewed(e.skipManualMemoryExtraction(imported.state, draft.id));
 const accepted = e.acceptDraft(currentChoice, draft.id);
 assert.equal(accepted.chapters[0].text, raw);
 assert.deepEqual(accepted.events, []);
});

test('an imported manual Canon exception is historical until a current-project skip, review and author decision', () => {
 const source = withCanon(), decided = resolveFact(modelReviewed(source, factReport(source)));
 const imported = importBackup(backup(e.createProjectFromConfig({projectId:'canon-import-target'})), backup(decided), () => 'manual-canon-import').state;
 assert.deepEqual(imported.importOrigin.original.state, decided);
 assert.deepEqual(candidate(imported).factDecisions, []);
 assert.equal(candidate(imported).modelReview, null);
 let next = reviewed(e.skipManualMemoryExtraction(imported, key(imported)));
 assert.throws(() => e.acceptDraft(next, key(next)), {code:'SEMANTIC_REVIEW_REQUIRED'});
 next = modelReviewed(next, factReport(next));
 assert.throws(() => e.acceptDraft(next, key(next)), {code:'FACT_DECISION_REQUIRED'});
 next = resolveFact(next);
 assert.equal(candidate(e.acceptDraft(next, key(next))).status, 'ACCEPTED');
});

test('opt-in manual memory selection retains exact provenance and accepted-memory context through import', () => {
 const decided = selectMemory(reviewed(extracted())), accepted = e.acceptDraft(decided, key(decided));
 const imported = importBackup(backup(e.createProjectFromConfig({projectId:'memory-import-target'})), backup(accepted), () => 'manual-memory-import').state;
 assert.equal(imported.events.length, 1);
 assert.deepEqual(candidate(imported).manualSource, {...candidate(accepted).manualSource, projectId:'manual-memory-import'});
 assert.equal(imported.commits.at(-1).acceptance.memoryExtraction, 'complete');
 const context = e.getContext(imported);
 assert.equal(context.events.length, 1);
 assert.equal(context.events[0].memoryDecision.action, 'attest_keep');
 assert.equal(context.sources[0].text.slice(context.events[0].source.start, context.events[0].source.end), segmentProse(raw)[1].text);
 assert.deepEqual(parseBackup(JSON.stringify(backup(imported))), backup(imported));
});

test('accepted manual chapter survives import and enters next-chapter manuscript context without invented memories', () => {
 const checked = reviewed(), source = e.acceptDraft(checked, key(checked));
 const imported = importBackup(backup(e.createProjectFromConfig({projectId:'other-project'})), backup(source), () => 'accepted-manual-import').state;
 for (const state of [source, parseBackup(JSON.stringify(backup(source))).state, imported]) {
  assert.equal(candidate(state).status, 'ACCEPTED');
  assert.equal(candidate(state).manualSource.textSnapshot, raw);
  assert.equal(candidate(state).manualSource.projectId, state.projectId);
  const context = e.getContext(state), first = context.sources.find(item => item.chapterId === 'ch1');
  assert.equal(first.role, 'accepted_manuscript');
  assert.equal(first.channel, 'original_text');
  assert.equal(first.text, raw);
  assert.deepEqual(context.events, []);
  assert.deepEqual(context.knowledge, []);
  assert.deepEqual(context.facts, []);
  assert.equal(context.memoryContext.included, 0);
  const next = e.stageProseDraft(state, {text:'她沿着河岸继续前行。', context, provider:'next-chapter-fixture'}, 'ch2');
  assert.equal(candidate(next).context.sources[0].text, raw);
  assert.deepEqual(candidate(next).context.events, []);
  assert.deepEqual(parseBackup(JSON.stringify(backup(next))), backup(next));
 }
 assert.deepEqual(imported.importOrigin.original.state, source);
});
