import test from 'node:test';
import assert from 'node:assert/strict';
import * as e from '../src/domain/engine.js';
import * as r from '../src/domain/author-revision.js';
import {captureGenerationIntent as capture, validateGenerationIntentRecord as validate} from '../src/domain/generation-intent.js';
import {parseBackup, importBackup} from '../src/storage.js';

const clone = structuredClone;
const GOAL = '  核对封口日期，\r\n再决定是否交信。🙂  ';
const EXIT = '\t亲手交出未拆封的信；守门人仍不知寄信人。\n';
const TEXT = '陆遥把信按在桌面上。\n她仍没有决定下一步。';
const provider = {id:'generation-intent-offline', isLive:false};
const fresh = () => e.createProjectFromConfig({projectId:'generation-intent-test', title:'封口日期', outline:[{id:'author-outline-id', goal:GOAL, exitState:EXIT}, {goal:'', exitState:'\n  '}, {description:'不得推断为场景目标'}]});
// Same mapping as the app: capture the actual mapped input, including its fallback.
const input = (state, chapterIndex = 0) => ({project:{...state.config, outline:state.chapters.map((chapter,index) => ({...state.config.outline?.[index], id:chapter.id, title:state.config.outline?.[index]?.title || chapter.title, goal:state.config.outline?.[index]?.goal || '沿已有线索推进，保持角色知识边界'}))}, chapterIndex, context:e.getContext(state)});
const request = (state, chapterIndex = 0) => ({text:TEXT, context:e.getContext(state), provider, chapterId:state.chapters[chapterIndex].id});
const stage = (state = fresh(), live = false) => e.stageProseDraft(state, {...request(state), provider:{...provider, isLive:live}}, 'ch1', capture(input(state)));
const draft = state => state.drafts.at(-1);
const backup = state => ({format:1, serial:0, state, editing:{}, patch:null});
const roundtrip = state => parseBackup(JSON.stringify(backup(state))).state;

test('capture records exact mapped strings and canonical identity without changing input', () => {
  const state = fresh(), mapped = input(state), before = clone(mapped), snapshot = capture(mapped);
  assert.deepEqual(mapped, before);
  assert.deepEqual(snapshot, {protocol:'generation-intent-v1', boundary:'app-generation-input', projectId:state.projectId,
    chapterId:'ch1', chapterIndex:0, chapterRevision:1, stateVersion:1, source:'project.outline[0]',
    goal:{status:'present',value:GOAL}, exitState:{status:'present',value:EXIT}});
  assert.equal(snapshot.chapterId, 'ch1', 'Author outline ID is not canonical identity');
  assert.ok(Object.isFrozen(snapshot)); assert.ok(Object.isFrozen(snapshot.goal));
});

test('capture and staged record are isolated from provider input, provider output and caller copies', () => {
  const state = fresh(), mapped = input(state), snapshot = capture(mapped), passed = clone(snapshot);
  mapped.project.outline[0].goal = 'later request mutation'; mapped.context.version++;
  const output = {...request(state), generationIntent:{goal:'provider-forged claim'}};
  const next = e.stageProseDraft(state, output, 'ch1', passed), record = draft(next).generationIntent;
  passed.goal.value = 'later caller mutation'; output.generationIntent.goal = 'later response mutation';
  assert.equal(snapshot.goal.value, GOAL); assert.equal(record.goal.value, GOAL);
  assert.notEqual(record, passed); assert.notEqual(record.goal, passed.goal);
  assert.deepEqual([record.draftId,record.runId,record.draftRevision], [draft(next).id,draft(next).runId,1]);
  assert.ok(Object.isFrozen(record)); assert.equal(validate(next,draft(next)),true);
  assert.deepEqual(state, fresh());
});

test('mapped fallback is captured rather than a saved empty or missing goal', () => {
  const state = fresh();
  for (const index of [1,2]) {
    const mapped = input(state,index), snapshot = capture(mapped);
    assert.deepEqual(snapshot.goal, {status:'present',value:'沿已有线索推进，保持角色知识边界'});
    assert.equal(snapshot.goal.value, mapped.project.outline[index].goal);
  }
  assert.deepEqual(capture(input(state,1)).exitState, {status:'empty',value:'\n  '});
  assert.deepEqual(capture(input(state,2)).exitState, {status:'missing',value:null});
});

test('missing, explicit empty, whitespace, invalid and absent input fields remain distinct', () => {
  const state = fresh(), mapped = input(state);
  for (const [outline, expected] of [
    [{id:'ch1'}, {goal:{status:'missing',value:null},exitState:{status:'missing',value:null}}],
    [{id:'ch1',goal:'',exitState:' \r\n\t'}, {goal:{status:'empty',value:''},exitState:{status:'empty',value:' \r\n\t'}}],
    [{id:'ch1',goal:7,exitState:null}, {goal:{status:'invalid',value:null},exitState:{status:'invalid',value:null}}],
    ['not an intent object', {goal:{status:'missing',value:null},exitState:{status:'missing',value:null}}],
  ]) {
    mapped.project.outline[0] = outline;
    const snapshot = capture(mapped);
    assert.deepEqual({goal:snapshot.goal,exitState:snapshot.exitState}, expected);
  }
  delete mapped.project.outline;
  assert.equal(capture(mapped).goal.status,'missing');
});

test('capture rejects inconsistent identities, invalid index and ambiguous canonical targets', () => {
  for (const change of [
    mapped => {mapped.project.projectId = 'foreign'},
    mapped => {mapped.project.outline[0].id = 'ch2'},
    mapped => {mapped.chapterIndex = -1}, mapped => {mapped.chapterIndex = 9},
    mapped => {mapped.context.sources.push(clone(mapped.context.sources[0]))},
    mapped => {mapped.context.sources[0].chapterIndex = 2},
    mapped => {mapped.context.version = 0},
  ]) {
    const mapped = input(fresh()); change(mapped);
    assert.throws(() => capture(mapped), {code:'INVALID_GENERATION_INTENT'});
  }
});

test('both staging APIs reject foreign project, chapter, version and malformed local snapshots', () => {
  const state = fresh();
  for (const save of [e.stageProviderDraft,e.stageProseDraft]) {
    for (const change of [
      value => {value.projectId = 'foreign'}, value => {value.chapterId = 'ch2'},
      value => {value.chapterIndex = 1}, value => {value.chapterRevision++},
      value => {value.stateVersion++}, value => {value.boundary = 'provider-wire'},
      value => {value.goal.status = 'fulfilled'}, value => {value.exitState = null},
    ]) {
      const snapshot = clone(capture(input(state))); change(snapshot);
      assert.throws(() => save(state,request(state),'ch1',snapshot), {code:'INVALID_GENERATION_INTENT'});
    }
    assert.throws(() => save(state,request(state),'ch1',null), {code:'INVALID_GENERATION_INTENT'});
    const next = save(state,request(state),'ch1',capture(input(state)));
    assert.equal(draft(next).generationIntent.goal.value,GOAL);
  }
});

test('legacy, template and provider-supplied metadata never fabricate local capture', () => {
  const state = fresh(), forged = {...request(state),generationIntent:capture(input(state))};
  for (const save of [e.stageProviderDraft,e.stageProseDraft]) {
    const next = save(state,forged,'ch1');
    assert.equal(Object.hasOwn(draft(next),'generationIntent'),false);
    assert.deepEqual(roundtrip(next),next);
  }
  const template = e.stageProviderDraft(state,{...forged,provider:{id:'deterministic-template',isLive:false}},'ch1');
  assert.equal(Object.hasOwn(draft(template),'generationIntent'),false);
  assert.equal(Object.hasOwn(draft(e.generateDraft(e.createInitialState())),'generationIntent'),false);
});

test('manual origin cannot receive or import a generation snapshot', () => {
  let state = fresh();
  state = e.commitPatch(state,e.proposeCustomPatch(state,'ch1',{intent:'local_prose'}));
  const snapshot = capture(input(state));
  for (const save of [e.stageProviderDraft,e.stageProseDraft]) {
    assert.throws(() => save(state,{...request(state),provider:{id:'author-manuscript',isLive:false}},'ch1',snapshot), {code:'INVALID_GENERATION_INTENT'});
  }
  const manual = e.stageManualDraft(state,'ch1');
  assert.equal(Object.hasOwn(draft(manual),'generationIntent'),false);
  assert.deepEqual(roundtrip(manual),manual);
  draft(manual).generationIntent = {...snapshot,draftId:draft(manual).id,runId:draft(manual).runId,draftRevision:1};
  assert.throws(() => roundtrip(manual), /生成意图来源记录/);
});

test('editing and context refresh retain initial request intent and r1 binding', () => {
  let state = stage(), record = clone(draft(state).generationIntent), key = draft(state).id;
  state = e.editDraft(state,key,TEXT+'\n作者后来另写了一句。');
  state.config.outline[0].goal = 'later outline goal'; state.config.outline[0].exitState = 'later exit';
  state = e.saveRevision(state,'ch2','作者改了来源章节。',1);
  state = e.commitPatch(state,e.proposeCustomPatch(state,'ch2',{intent:'local_prose'}));
  state = e.refreshDraftContext(state,key);
  assert.equal(draft(state).revision,2); assert.equal(draft(state).baseVersion,2);
  assert.equal(draft(state).context.version,2); assert.deepEqual(draft(state).generationIntent,record);
  assert.equal(record.stateVersion,1); assert.equal(record.draftRevision,1);
  assert.equal(draft(state).proseVersions[0].text,TEXT);
  assert.deepEqual(roundtrip(state),state);
  state = e.rejectDraft(state,key);
  assert.deepEqual(draft(state).generationIntent,record); assert.deepEqual(roundtrip(state),state);
});

test('author-requested revision adoption retains initial intent rather than attributing revised prose to it', () => {
  let state = stage(fresh(),true), record = clone(draft(state).generationIntent), key = draft(state).id;
  state = r.setRevisionInstruction(state,key,'作者要求改变最后一句。');
  state = r.beginDraftRevision(state,key);
  let proposal = draft(state).revisionProposals.at(-1);
  state = r.attachDraftRevision(state,key,proposal.id,{text:'作者采用的新正文。',chapterId:'ch1',provider:{...provider,isLive:true}},proposal.binding);
  proposal = draft(state).revisionProposals.at(-1);
  state = r.adoptDraftRevision(state,key,proposal.id,proposal);
  assert.equal(draft(state).revision,2); assert.equal(draft(state).generationIntent.draftRevision,1);
  assert.deepEqual(draft(state).generationIntent,record); assert.deepEqual(roundtrip(state),state);
});

test('provenance grants no review, memory or acceptance authority and survives explicit acceptance', () => {
  let state = stage(), key = draft(state).id, record = clone(draft(state).generationIntent);
  assert.deepEqual(state.events,[]); assert.deepEqual(state.facts,[]); assert.deepEqual(draft(state).staging,[]);
  assert.throws(() => e.acceptDraft(state,key),{code:'REVIEW_REQUIRED'});
  state = e.reviewDraft(state,key);
  assert.equal(draft(state).review.passed,false, 'Captured intent does not skip extraction');
  state = e.skipMemoryExtraction(state,key); state = e.reviewDraft(state,key);
  state = e.acceptDraft(state,key);
  assert.equal(draft(state).status,'ACCEPTED'); assert.deepEqual(draft(state).generationIntent,record);
  assert.equal(state.events.length,0); assert.equal(state.facts.length,0);
  assert.deepEqual(roundtrip(state),state);
});

test('backup rejects malformed provenance on pending and terminal drafts', () => {
  for (const status of ['DRAFT','REJECTED']) for (const change of [
    value => {delete value.protocol}, value => {value.protocol = 'future-version'},
    value => {value.boundary = 'provider-wire'}, value => {value.source = 'config.outline[0]'},
    value => {value.projectId = 'foreign'}, value => {value.chapterId = 'ch2'},
    value => {value.chapterIndex = -1}, value => {value.chapterIndex = 0.5},
    value => {value.chapterRevision = 100}, value => {value.stateVersion = 100},
    value => {value.draftId = 'other'}, value => {value.runId = 'other'},
    value => {value.draftRevision = 2}, value => {value.goal.status = 'empty'},
    value => {value.goal.value = null}, value => {value.exitState = {status:'missing',value:'fabricated'}},
    value => {value.goal = {status:'invalid',value:{nested:true}}},
    value => {value.acceptance = true}, value => {value.goal.extra = 'ignored'},
  ]) {
    let state = stage(); if (status === 'REJECTED') state = e.rejectDraft(state,draft(state).id);
    state = clone(state); change(draft(state).generationIntent);
    assert.throws(() => roundtrip(state));
  }
  for (const malformed of [null,[],true,'text']) {
    const state = stage(); draft(state).generationIntent = malformed;
    assert.throws(() => roundtrip(state));
  }
});

test('import remaps generation project identity while retaining exact original audit and values', () => {
  const original = stage(), expected = clone(draft(original).generationIntent);
  const imported = importBackup(backup(e.createInitialState()),backup(original),() => 'imported-intent').state;
  assert.deepEqual(draft(imported).generationIntent,{...expected,projectId:'imported-intent'});
  assert.deepEqual(imported.importOrigin.original.state.drafts[0].generationIntent,expected);
  assert.equal(validate(imported,draft(imported)),true); assert.deepEqual(roundtrip(imported),imported);
  assert.deepEqual(draft(original).generationIntent,expected);
});
