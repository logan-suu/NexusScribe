import test from 'node:test';
import assert from 'node:assert/strict';
import * as e from '../src/domain/engine.js';
import {parseBackup,importBackup,MAX_BACKUP_BYTES} from '../src/storage.js';
const clone=structuredClone;
const id=s=>s.drafts[0].id;
const backup=state=>({format:1,serial:0,state,editing:{},patch:null});
function fixture({live=true}={}) {
 let s=e.createProjectFromConfig({projectId:'memory-backup'});
 s=e.stageProseDraft(s,{text:'阿岚收起信。\n她走出房门。',context:e.getContext(s),provider:{id:'writer',isLive:live}},'ch1');s=e.beginMemoryExtraction(s,id(s));
 s=e.attachMemoryExtraction(s,id(s),{staging:[{label:'阿岚保管信件',sourceParagraphIndex:0},{label:'阿岚离开房间',sourceParagraphIndex:1}],reviewNotes:[],provider:'extractor'},e.createExtractionBinding(s,id(s)));
 s=e.reviewDraft(s,id(s));
 s=e.attachSemanticReview(s,id(s),{summary:'保存模型判断',issues:[],checks:[],provider:'reviewer',memoryChecks:s.drafts[0].staging.map(c=>({candidateId:c.id,status:'supported',explanation:'完整主张有原文支持'}))},e.createReviewBinding(s,id(s)));
 for(const [index,action] of [[0,'keep'],[1,'reject']]){const row=e.getMemoryReviewGate(s,id(s))[index];s=e.decideMemoryCandidate(s,id(s),{candidateId:row.candidateId,action,reviewHash:row.reviewHash},row.binding);}
 return s;
}
test('pending, decided, edited, re-extracted, rejected and accepted memory audit round-trips without alteration',()=>{
 const original=fixture(),key=id(original);
 for(const state of [original,e.editDraft(original,key,'新正文。'),e.beginMemoryExtraction(original,key),e.beginSemanticReview(original,key),e.rejectDraft(original,key),e.acceptDraft(original,key)]){
  const w=backup(state);assert.deepEqual(parseBackup(JSON.stringify(w)),w);
 }
 const restored=parseBackup(JSON.stringify(backup(original)));assert.equal(e.acceptDraft(restored.state,key).events.length,1);
});
test('new metadata rejects malformed candidates, decision records and inconsistent active history',()=>{
 const s=fixture();
 for(const mutate of [d=>{d.memoryReviewSchema=2},d=>{d.memoryCandidatesSnapshot[0].label='different'},d=>{d.memoryDecisions={}},d=>{d.memoryDecisionHistory=[]},d=>{d.memoryDecisions[0].action='automatic'},d=>{d.memoryDecisions[0].reason={}},d=>{d.memoryArchives=[{}]},d=>{d.memoryReviewEpoch=-1},d=>{d.memoryDecisionHistory.push(clone(d.memoryDecisionHistory[0]))}]){
  const w=backup(clone(s));mutate(w.state.drafts[0]);assert.throws(()=>parseBackup(JSON.stringify(w)));
 }
});
test('legacy pending records load but cannot use their old review to accept or promote memory',()=>{
 const s=fixture({live:false}),d=s.drafts[0];
 for(const key of Object.keys(d).filter(k=>k.startsWith('memory')))delete d[key];d.modelReview=null;
 delete d.review.textSnapshot;delete d.review.stagingSnapshot;
 const restored=parseBackup(JSON.stringify(backup(s))).state;
 assert.throws(()=>e.acceptDraft(restored,id(restored)),{code:'REVIEW_REQUIRED'});
 let current=e.reviewDraft(restored,id(restored));
 assert.throws(()=>e.acceptDraft(current,id(current)),{code:'MEMORY_DECISION_REQUIRED'});
 for(const row of e.getMemoryReviewGate(current,id(current)))current=e.decideMemoryCandidate(current,id(current),{candidateId:row.candidateId,action:'reject',reviewHash:row.reviewHash},row.binding);
 assert.equal(e.acceptDraft(current,id(current)).events.length,0);
});
test('historic accepted legacy backups remain readable and accepted without retroactive invalidation',()=>{
 let state=e.acceptDraft(fixture(),id(fixture()));const d=state.drafts[0];for(const key of Object.keys(d).filter(k=>k.startsWith('memory')||k==='acceptedMemoryDecisions'))delete d[key];
 delete d.review.textSnapshot;delete d.review.stagingSnapshot;delete d.modelReview.memoryLedger;delete d.modelReview.memoryChecks;
 const restored=parseBackup(JSON.stringify(backup(state))).state;assert.equal(e.acceptDraft(restored,id(restored)).drafts[0].status,'ACCEPTED');assert.equal(restored.events.length,1);
});
test('import invalidates pending candidate/review/decision authority while preserving exact original audit',()=>{
 const source=backup(fixture()),before=clone(source),current=backup(e.createProjectFromConfig({projectId:'current-project'}));
 const imported=importBackup(current,source,()=> 'imported-memory'),d=imported.state.drafts[0];
 assert.deepEqual(imported.state.importOrigin.original.state,before.state);
 assert.deepEqual(d.staging,[]);assert.deepEqual(d.memoryDecisions,[]);assert.equal(d.modelReview,null);assert.equal(d.review,null);assert.equal(d.extraction.status,'pending');assert.equal(d.memoryDecisionHistory.length,2);
 assert.ok(d.memoryArchives.some(a=>a.reason==='backup_imported'&&a.candidates[0].label===before.state.drafts[0].staging[0].label&&a.decisions.length===2));
 assert.throws(()=>e.acceptDraft(imported.state,d.id),{code:'REVIEW_REQUIRED'});
 assert.deepEqual(parseBackup(JSON.stringify(imported)),imported);assert.deepEqual(source,before);
 // Even restoring the old active records cannot authorize imported candidates.
 d.memoryDecisions=clone(before.state.drafts[0].memoryDecisions);assert.throws(()=>e.acceptDraft(imported.state,d.id),{code:'REVIEW_REQUIRED'});
});
test('import keeps accepted event decisions, original unsupported assessment and all original audit',()=>{
 let state=fixture();const row=e.getMemoryReviewGate(state,id(state))[1];state=e.decideMemoryCandidate(state,id(state),{candidateId:row.candidateId,action:'override_keep',reason:'作者明确保留完整候选',reviewHash:row.reviewHash},row.binding);
 state=e.acceptDraft(state,id(state));const source=backup(state),current=backup(e.createProjectFromConfig({projectId:'import-target'})),imported=importBackup(current,source,()=> 'historical-memory');
 assert.equal(imported.state.drafts[0].status,'ACCEPTED');assert.equal(imported.state.events.length,2);assert.equal(imported.state.events[1].memoryDecision.action,'override_keep');assert.equal(imported.state.events[1].memoryDecision.reason,'作者明确保留完整候选');
 assert.deepEqual(imported.state.importOrigin.original.state,state);assert.ok(e.getMemoryReviewGate(imported.state,id(imported.state)).every(row=>row.historical&&row.resolved));assert.deepEqual(parseBackup(JSON.stringify(imported)),imported);
});


function bulkDraft(state,characters,count,chapterId='ch1') {
 const body='阿澄收好木钥匙。'.repeat(Math.ceil(characters/8)).slice(0,characters);
 let s=e.stageProseDraft(state,{text:body,context:e.getContext(state),provider:{id:'offline-fixture',isLive:true}},chapterId),key=s.drafts.at(-1).id;
 s=e.beginMemoryExtraction(s,key);s=e.attachMemoryExtraction(s,key,{staging:Array.from({length:count},(_,i)=>({label:`候选${i}：阿澄收好木钥匙`,sourceParagraphIndex:0})),reviewNotes:[],provider:'offline-fixture'},e.createExtractionBinding(s,key));
 return bulkReview(s,key);
}
function bulkReview(state,key) {
 let s=e.reviewDraft(state,key);s=e.attachSemanticReview(s,key,{summary:'合成离线夹具',issues:[],checks:[],provider:'offline-fixture',memoryChecks:s.drafts.find(d=>d.id===key).staging.map(c=>({candidateId:c.id,status:'supported',explanation:'offline fixture judgment'}))},e.createReviewBinding(s,key));
 for(const row of e.getMemoryReviewGate(s,key)){s=e.decideMemoryCandidate(s,key,{candidateId:row.candidateId,action:'keep',reviewHash:row.reviewHash},row.binding);parseBackup(JSON.stringify(backup(s)));}
 return s;
}
const byteLength=value=>new TextEncoder().encode(JSON.stringify(value)).length;
test('shared immutable authority bounds every decision, accepted audit and imports under unchanged 2MiB cap',()=>{
 for(const [characters,count] of [[450,30],[1500,10],[4000,3],[3000,10]]){
  let s=bulkDraft(e.createProjectFromConfig({projectId:'size-fixture'}),characters,count),d=s.drafts.at(-1);
  assert.equal(d.memoryAuthorities.length,1);assert.equal(d.memoryBindingSnapshots.length,1);assert.equal(new Set(d.memoryDecisions.map(x=>x.authorityId)).size,1);
  assert.ok(d.memoryDecisions.every(x=>!Object.hasOwn(x,'binding')&&!Object.hasOwn(x,'reviewSnapshot')&&!Object.hasOwn(x,'candidateSnapshot')));
  s=e.acceptDraft(s,d.id);assert.ok(byteLength(backup(s))<MAX_BACKUP_BYTES);parseBackup(JSON.stringify(backup(s)));
  assert.ok(s.events.every(event=>event.memoryDecision.authorityId===d.memoryAuthorities[0].id));assert.deepEqual(s.commits.at(-1).memoryAuthorityIds,[d.memoryAuthorities[0].id]);
  const imported=importBackup(backup(e.createProjectFromConfig({projectId:'target'})),backup(s),()=> 'imported');assert.ok(byteLength(imported)<MAX_BACKUP_BYTES);assert.ok(e.getMemoryReviewGate(imported.state,d.id).every(row=>row.resolved));
 }
});
test('two 3000-Han, ten-candidate accepted chapters plus re-review stay saveable with exact retained authority',()=>{
 let s=bulkDraft(e.createProjectFromConfig({projectId:'two-chapter-size'}),3000,10);s=e.acceptDraft(s,s.drafts.at(-1).id);
 s=bulkDraft(s,3000,10,'ch2');const key=s.drafts.at(-1).id,previous=clone(s.drafts.at(-1).memoryAuthorities[0]);s=bulkReview(s,key);
 assert.equal(s.drafts.at(-1).memoryAuthorities.length,2);assert.equal(s.drafts.at(-1).memoryBindingSnapshots.length,1);assert.deepEqual(s.drafts.at(-1).memoryAuthorities[0],previous);
 s=e.acceptDraft(s,key);assert.ok(byteLength(backup(s))<1700000);assert.deepEqual(parseBackup(JSON.stringify(backup(s))),backup(s));const exported=JSON.stringify(backup(s),null,2);assert.ok(new TextEncoder().encode(exported).length<MAX_BACKUP_BYTES);assert.deepEqual(parseBackup(exported),backup(s));assert.equal(s.events.length,20);
});
test('shared snapshot, authority and decision reference tampering fails closed',()=>{
 const original=fixture(),key=id(original);
 for(const mutate of [d=>{d.memoryBindingSnapshots[0].values.textSnapshot+='changed'},d=>{d.memoryBindingSnapshots[0].values.stagingSnapshot[0].label='changed'},d=>{d.memoryBindingSnapshots[0].values.contextSnapshot.constitution.idea='changed'},d=>{d.memoryAuthorities[0].reviewSnapshot.summary='changed'},d=>{d.memoryAuthorities[0].binding.snapshotId='foreign'},d=>{d.memoryDecisions[0].authorityId='foreign'}]){
  const next=clone(original);mutate(next.drafts[0]);assert.throws(()=>e.acceptDraft(next,key));
 }
 for(const mutate of [d=>{d.memoryBindingSnapshots=[]},d=>{d.memoryAuthorities=[]},d=>{d.memoryAuthorities.push(clone(d.memoryAuthorities[0]))},d=>{d.memoryBindingSnapshots.push(clone(d.memoryBindingSnapshots[0]))}]){const next=clone(original);mutate(next.drafts[0]);assert.throws(()=>parseBackup(JSON.stringify(backup(next))));}
});
