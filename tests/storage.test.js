import test from 'node:test';
import assert from 'node:assert/strict';
import {createInitialState, generateDraft, proposePatch, createProjectFromConfig, saveRevision, commitPatch, reviewDraft, acceptDraft, getMemoryReviewGate, decideMemoryCandidate,MEMORY_ATTESTATION_STATEMENT, NEVER_MET, HAS_MET} from '../src/domain/engine.js';
import {KEY, BACKUP_KEY, QUARANTINE_KEY, loadWorkspace, persistWorkspace, recoverWorkspace, parseBackup, importBackup} from '../src/storage.js';

const clone = value => structuredClone(value);
const project = (id = 'source') => ({state:createInitialState(id), editing:{ch1:'尚未保存的正文'}, patch:null});
const workspace = (id = 'source', serial = 7) => ({format:1, serial, ...project(id), archived:[project(`${id}-archived`)]});
function storage(t, values = {}, failKey) {
 const map = new Map(Object.entries(values)), writes = [];
 const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
 const api = {
  getItem:key => map.has(key) ? map.get(key) : null,
  setItem(key, value) { writes.push([key, String(value)]); if (key === failKey) throw new Error('QuotaExceededError'); map.set(key, String(value)); },
  removeItem:key => map.delete(key),
 };
 Object.defineProperty(globalThis, 'localStorage', {configurable:true, value:api});
 t.after(() => previous ? Object.defineProperty(globalThis, 'localStorage', previous) : delete globalThis.localStorage);
 return {map,writes};
}

test('empty and healthy startup never write or replace saved data', t => {
 const store=storage(t);
 const empty=loadWorkspace();
 assert.equal(empty.format,1); assert.equal(empty.serial,0); assert.ok(empty.state.chapters.length);
 const saved=workspace(); store.map.set(KEY,JSON.stringify(saved));
 assert.deepEqual(loadWorkspace(),saved);
 assert.deepEqual(store.writes,[]);
});

test('corrupt primary loads backup in blocked recovery mode without startup writes', t => {
 const saved=workspace(), raw='{broken original';
 const store=storage(t,{[KEY]:raw,[BACKUP_KEY]:JSON.stringify(saved)});
 const loaded=loadWorkspace();
 assert.deepEqual(loaded.state,saved.state); assert.deepEqual(loaded.editing,saved.editing);
 assert.deepEqual(loaded.archived,saved.archived);
 assert.equal(loaded.recovery.blocked,true); assert.equal(loaded.recovery.primaryRaw,raw);
 assert.equal(store.map.get(KEY),raw); assert.deepEqual(store.writes,[]);
 assert.throws(()=>persistWorkspace(loaded,loaded.serial));
 assert.deepEqual(store.writes,[]);
});

test('normal save backs up exact prior valid primary before incrementing serial', t => {
 const previous=workspace(), raw=JSON.stringify(previous,null,2), store=storage(t,{[KEY]:raw});
 const next=clone(previous); next.editing.ch1='new editing';
 const saved=persistWorkspace(next,previous.serial);
 assert.equal(saved.serial,previous.serial+1);
 assert.deepEqual(store.writes.map(([key])=>key),[BACKUP_KEY,KEY]);
 assert.equal(store.map.get(BACKUP_KEY),raw);
 assert.deepEqual(JSON.parse(store.map.get(KEY)),saved);
 assert.equal(previous.serial,7);
});

test('stale serial and corrupt primary cannot overwrite either saved copy', t => {
 const current=workspace(), raw=JSON.stringify(current), backup=JSON.stringify(workspace('prior',6));
 const store=storage(t,{[KEY]:raw,[BACKUP_KEY]:backup});
 assert.throws(()=>persistWorkspace(workspace('other'),current.serial-1));
 assert.deepEqual(store.writes,[]); assert.equal(store.map.get(KEY),raw);
 store.map.set(KEY,'invalid JSON');
 assert.throws(()=>persistWorkspace(current,current.serial));
 assert.deepEqual(store.writes,[]); assert.equal(store.map.get(KEY),'invalid JSON');
 assert.equal(store.map.get(BACKUP_KEY),backup);
});

for (const failure of ['backup','primary']) test(`${failure} write failure throws and preserves current primary`, t => {
 const original=workspace(), raw=JSON.stringify(original);
 const store=storage(t,{[KEY]:raw},failure==='backup'?BACKUP_KEY:KEY);
 assert.throws(()=>persistWorkspace({...original,editing:{ch1:'new'}},original.serial),/Quota/);
 assert.equal(store.map.get(KEY),raw);
 if(failure==='backup') assert.deepEqual(store.writes.map(([key])=>key),[BACKUP_KEY]);
});

test('explicit recovery quarantines original first and preserves supplied unsaved edits', t => {
 const original=workspace(), raw='{"partially":"written"';
 const store=storage(t,{[KEY]:raw,[BACKUP_KEY]:JSON.stringify(original)});
 const loaded=loadWorkspace(); loaded.editing.ch1='recovery-time unsaved editing';
 const recovered=recoverWorkspace(loaded);
 assert.deepEqual(store.writes.map(([key])=>key),[QUARANTINE_KEY,KEY]);
 assert.equal(store.map.get(QUARANTINE_KEY),raw);
 const persisted=JSON.parse(store.map.get(KEY));
 assert.equal(persisted.editing.ch1,loaded.editing.ch1);
 assert.deepEqual(persisted.archived,original.archived);
 assert.ok(!persisted.recovery); assert.ok(!recovered.recovery);
 assert.deepEqual(recovered,persisted);
});

test('recovery rejects another window changing the raw primary', t => {
 const store=storage(t,{[KEY]:'bad',[BACKUP_KEY]:JSON.stringify(workspace())});
 const loaded=loadWorkspace(), newer=JSON.stringify(workspace('other',20));
 store.map.set(KEY,newer);
 assert.throws(()=>recoverWorkspace(loaded));
 assert.equal(store.map.get(KEY),newer); assert.deepEqual(store.writes,[]);
});

for (const failure of ['quarantine','primary']) test(`failed recovery ${failure} write leaves corrupt primary untouched`, t => {
 const raw='bad';
 const store=storage(t,{[KEY]:raw,[BACKUP_KEY]:JSON.stringify(workspace())},failure==='quarantine'?QUARANTINE_KEY:KEY);
 assert.throws(()=>recoverWorkspace(loadWorkspace()),/Quota/);
 assert.equal(store.map.get(KEY),raw);
 if(failure==='quarantine') assert.deepEqual(store.writes.map(([key])=>key),[QUARANTINE_KEY]);
 else assert.equal(store.map.get(QUARANTINE_KEY),raw);
});

test('backup parsing round-trips active and archived project state and editing', () => {
 const original=workspace();
 assert.deepEqual(parseBackup(JSON.stringify(original)),original);
});

const invalidCases = [
 ['future file format', w=>{w.format=2;}],
 ['future active state schema', w=>{w.state.schemaVersion=2;}],
 ['future archived state schema', w=>{w.archived[0].state.schemaVersion=2;}],
 ['missing chapter list', w=>{delete w.state.chapters;}],
 ['missing archived chapter list', w=>{delete w.archived[0].state.chapters;}],
 ['duplicate project ID', w=>{w.archived[0].state.projectId=w.state.projectId;}],
 ['duplicate chapter ID', w=>{w.state.chapters.push(clone(w.state.chapters[0]));}],
 ['negative serial', w=>{w.serial=-1;}],
 ['array editing', w=>{w.editing=[];}],
];
for(const [label, mutate] of invalidCases) test(`backup parser rejects ${label}`,()=>{
 const value=workspace(); mutate(value); assert.throws(()=>parseBackup(JSON.stringify(value)));
});

test('backup parser rejects malformed, oversized and prototype-poisoning JSON',()=>{
 assert.throws(()=>parseBackup('{bad'));
 assert.throws(()=>parseBackup(' '.repeat(2*1024*1024+1)));
 // UTF-8 bytes, not UTF-16 string length, are the size limit.
 const large=workspace(); large.editing.ch1='界'.repeat(750000);
 assert.throws(()=>parseBackup(JSON.stringify(large)));
 for(const key of ['__proto__','constructor','prototype']) {
  const value=workspace(); value.state.config=JSON.parse(`{"${key}":{"polluted":true}}`);
  assert.throws(()=>parseBackup(JSON.stringify(value)));
 }
 assert.equal({}.polluted,undefined);
});

test('import clones all projects into new namespaces and keeps source/current work untouched', t => {
 const store=storage(t), current=workspace('current',22), source=workspace();
 source.state=generateDraft(source.state);
 const draft=source.state.drafts[0];
 draft.status='IN_REVIEW'; draft.review={projectId:source.state.projectId}; draft.modelReview={binding:{projectId:source.state.projectId}}; draft.factDecisions=[{binding:{projectId:source.state.projectId}}];
 source.patch=proposePatch(source.state,'ch1');
 source.state.pendingPatches=[clone(source.patch)];
 source.state.config={outline:[],projectId:source.state.projectId,nested:{projectId:source.state.projectId}};
 const currentBefore=clone(current), sourceBefore=clone(source); let n=0;
 const imported=importBackup(current,parseBackup(JSON.stringify(source)),()=>`imported-${++n}`);
 assert.equal(imported.state.projectId,'imported-1');
 const all=[{state:imported.state,editing:imported.editing,patch:imported.patch},...imported.archived];
 assert.equal(new Set(all.map(p=>p.state.projectId)).size,4);
 assert.ok(all.some(p=>p.state.projectId==='imported-2'));
 for(const old of [{state:current.state,editing:current.editing,patch:current.patch},...current.archived]) assert.deepEqual(all.find(p=>p.state.projectId===old.state.projectId),old);
 assert.deepEqual(imported.editing,source.editing); assert.equal(imported.patch,null);
 assert.deepEqual(imported.state.pendingPatches,[]);
 assert.equal(imported.state.config.projectId,'imported-1'); assert.equal(imported.state.config.nested.projectId,'imported-1');
 const nextDraft=imported.state.drafts[0];
 assert.equal(nextDraft.projectId,'imported-1'); assert.equal(nextDraft.review,null); assert.equal(nextDraft.modelReview,null); assert.deepEqual(nextDraft.factDecisions,[]);
 assert.deepEqual(imported.state.importOrigin.original,{state:sourceBefore.state,editing:sourceBefore.editing,patch:sourceBefore.patch});
 assert.deepEqual(current,currentBefore); assert.deepEqual(source,sourceBefore); assert.deepEqual(store.writes,[]);
});

test('unreadable primary and backup stay untouched in a blocked temporary workspace',t=>{
 const store=storage(t,{[KEY]:'bad primary',[BACKUP_KEY]:'bad backup'});
 const loaded=loadWorkspace();
 assert.equal(loaded.recovery.blocked,true); assert.equal(loaded.recovery.primaryRaw,'bad primary');
 assert.equal(store.map.get(KEY),'bad primary'); assert.equal(store.map.get(BACKUP_KEY),'bad backup');
 assert.deepEqual(store.writes,[]);
});

test('missing primary with an existing backup requires explicit recovery',t=>{
 const saved=workspace(), store=storage(t,{[BACKUP_KEY]:JSON.stringify(saved)});
 const loaded=loadWorkspace();
 assert.equal(loaded.recovery.blocked,true); assert.equal(loaded.recovery.primaryRaw,null);
 assert.deepEqual(loaded.state,saved.state); assert.deepEqual(store.writes,[]);
 assert.throws(()=>persistWorkspace(loaded,loaded.serial));
 const recovered=recoverWorkspace(loaded);
 assert.deepEqual(store.writes.map(([key])=>key),[KEY]);
 assert.deepEqual(JSON.parse(store.map.get(KEY)),recovered);
});

test('recovery does not overwrite evidence from an earlier corruption',t=>{
 const store=storage(t,{[KEY]:'new corruption',[BACKUP_KEY]:JSON.stringify(workspace()),[QUARANTINE_KEY]:'earlier corruption'});
 assert.throws(()=>recoverWorkspace(loadWorkspace()));
 assert.equal(store.map.get(KEY),'new corruption'); assert.equal(store.map.get(QUARANTINE_KEY),'earlier corruption'); assert.deepEqual(store.writes,[]);
});

test('import rejects generated namespace collisions without mutating current or input',t=>{
 const store=storage(t), current=workspace('current'), source=workspace(), before=clone(current), original=clone(source);
 assert.throws(()=>importBackup(current,source,()=>current.state.projectId));
 assert.throws(()=>importBackup(current,source,()=> 'same-new-id'));
 assert.deepEqual(current,before); assert.deepEqual(source,original); assert.deepEqual(store.writes,[]);
});

const malformedCases=[
 ['null chapter ID',w=>{w.state.chapters[0].id=null;}],
 ['missing fact ID',w=>{delete w.state.facts[0].id;}],
 ['null model review issue',w=>{w.state=generateDraft(w.state);w.state.drafts[0].modelReview={issues:[null]};}],
 ['null structural review error',w=>{w.state=generateDraft(w.state);w.state.drafts[0].review={errors:[null]};}],
 ['object-valued displayed review summary',w=>{w.state=generateDraft(w.state);w.state.drafts[0].modelReview={summary:{text:'bad'},issues:[]};}],
 ['object-valued historical version',w=>{w.state.commits=[{id:'commit-test',version:{value:2},summary:'bad'}];}],
 ['null patch operation',w=>{w.patch=proposePatch(w.state,'ch1');w.patch.operations=[null];}],
];
for(const [label,mutate] of malformedCases) test(`backup parser safely rejects ${label}`,()=>{
 const value=workspace();mutate(value);assert.throws(()=>parseBackup(JSON.stringify(value)));
});


test('backup parser accepts engine-created custom projects with optional outline omitted',()=>{
 const value=workspace(); value.state=createProjectFromConfig({projectId:'minimal-custom',title:'Minimal',idea:'A story'});
 assert.deepEqual(parseBackup(JSON.stringify(value)),value);
});


test('backup validation preserves real revision, canon-commit, review and accepted-draft history',()=>{
 const value=workspace();
 let state=value.state;
 state=saveRevision(state,'ch2',state.chapters[1].text.replace(NEVER_MET,HAS_MET),1);
 state=commitPatch(state,proposePatch(state,'ch2'));
 state=generateDraft(state); state=reviewDraft(state,state.drafts[0].id);
 for(const row of getMemoryReviewGate(state,state.drafts[0].id))state=decideMemoryCandidate(state,state.drafts[0].id,{candidateId:row.candidateId,action:'attest_keep',attestation:{protocol:'quote-grounded-memory-v1',accepted:true,statement:MEMORY_ATTESTATION_STATEMENT},reason:'测试作者确认原始候选',reviewHash:row.reviewHash},row.binding);
 state=acceptDraft(state,state.drafts[0].id); value.state=state;
 const raw=JSON.stringify(value); assert.deepEqual(parseBackup(raw),JSON.parse(raw));
});

test('legacy string structural-review errors remain valid backup content',()=>{
 const value=workspace(); value.state=generateDraft(value.state);
 value.state.drafts[0].review={errors:['结构检查未通过'],issues:[]};
 assert.deepEqual(parseBackup(JSON.stringify(value)),value);
});

test('custom evidence requires an ID before Inspector renders it',()=>{
 const w=workspace();w.state.mode='custom';w.state.evidence=[{label:'fictional evidence'}];assert.throws(()=>parseBackup(JSON.stringify(w)));
});
test('patch object questions cannot become React children',()=>{
 const w=workspace();w.patch={operations:[],questions:[{text:'bad child'}],intents:[]};assert.throws(()=>parseBackup(JSON.stringify(w)));
});
test('historical version objects and custom idea objects are rejected',()=>{
 const w=workspace();w.state.mode='custom';w.state.commits=[{id:'c1',version:{bad:true}}];assert.throws(()=>parseBackup(JSON.stringify(w)));
 const x=workspace();x.state.mode='custom';x.state.config={idea:{bad:true}};assert.throws(()=>parseBackup(JSON.stringify(x)));
});
test('historical fallback kind/type cannot be object children',()=>{
 for(const key of ['kind','type']){const w=workspace();w.state.mode='custom';w.state.commits=[{id:'c1',[key]:{bad:true}}];assert.throws(()=>parseBackup(JSON.stringify(w)));}
});
test('serialized runtime recovery metadata cannot spoof recovery or render objects',()=>{
 const w=workspace();w.recovery={blocked:true,message:{bad:'child'},primaryRaw:'untrusted'};assert.equal(parseBackup(JSON.stringify(w)).recovery,undefined);
});
