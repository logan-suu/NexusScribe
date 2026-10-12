import test from 'node:test';
import assert from 'node:assert/strict';
import * as e from '../src/domain/engine.js';
import * as r from '../src/domain/author-revision.js';
import {captureRequestSceneIntent,validateRequestSceneIntent} from '../src/domain/request-scene-intent.js';
import {parseBackup,importBackup} from '../src/storage.js';
const provider={id:'fake',isLive:true},copy=structuredClone;
function fresh(){let s=e.createProjectFromConfig({projectId:'scene-test',idea:'修表',outline:[{id:'legacy-outline-1',title:'开门',description:'不是目标',goal:'  约好明天修表  ',exitState:'约定已确认'}]});return e.stageProseDraft(s,{text:'她答应明天回来修表。',context:e.getContext(s),provider},'ch1');}
const d=s=>s.drafts[0],id=s=>d(s).id;
const backup=state=>({format:1,serial:0,state,editing:{},patch:null,providerMode:'server'});
function ready(s=fresh()){s=e.skipMemoryExtraction(s,id(s));return e.beginSemanticReview(e.reviewDraft(s,id(s)),id(s));}
const report={summary:'fake',issues:[],checks:[],factChecks:[],provider:'fake'};
function reviewed(s=ready()){const q=e.createSemanticReviewRequest(s,id(s));return e.attachSemanticReview(s,id(s),report,q.expected,q.sceneIntent);}
function begin(s=fresh()){s=r.setRevisionInstruction(s,id(s),'保留约定，减少重复');return r.beginDraftRevision(s,id(s));}
const proposal=s=>d(s).revisionProposals.at(-1);
const result={text:'她记下了明天修表的约定。',chapterId:'ch1',provider};
function completed(s=begin()){return r.attachDraftRevision(s,id(s),proposal(s).id,result,proposal(s).binding);}
test('capture exact saved fields with canonical chapter identity and independent copies',()=>{
 const s=fresh(),v=captureRequestSceneIntent(s,d(s),e.getContext(s));
 assert.equal(v.chapterId,'ch1');assert.equal(v.chapterIndex,0);assert.equal(v.goal.value,'  约好明天修表  ');assert.equal(v.exitState.value,'约定已确认');assert.equal(v.source,'config.outline[0]');
 v.goal.value='changed';assert.equal(s.config.outline[0].goal,'  约好明天修表  ');
 for(const [value,status] of [[undefined,'missing'],['  ','empty'],[null,'invalid'],[25,'invalid'],['x','present']]) {
  const n=copy(s);if(value===undefined)delete n.config.outline[0].exitState;else n.config.outline[0].exitState=value;
  assert.deepEqual(captureRequestSceneIntent(n,d(n),e.getContext(n)).exitState,{status,value:['present','empty'].includes(status)?value:null});
 }
});
test('review saves only separately captured provenance; forged model snapshot has no authority',()=>{
 const s=ready(),q=e.createSemanticReviewRequest(s,id(s));
 assert.equal(q.input.sceneIntent.goal.value,s.config.outline[0].goal);
 const n=e.attachSemanticReview(s,id(s),{...report,sceneIntent:{forged:true}},q.expected,q.sceneIntent);
 assert.deepEqual(d(n).modelReview.sceneIntent,q.sceneIntent);assert.deepEqual(parseBackup(JSON.stringify(backup(n))).state,n);
 const legacy=e.attachSemanticReview(s,id(s),{...report,sceneIntent:q.sceneIntent},q.expected);assert.equal(Object.hasOwn(d(legacy).modelReview,'sceneIntent'),false);
});
for(const key of ['goal','exitState'])test(`same version ${key} change rejects late review and makes completed review unacceptably stale`,()=>{
 const s=ready(),q=e.createSemanticReviewRequest(s,id(s)),changed=copy(s);changed.config.outline[0][key]+='!';
 assert.equal(changed.version,s.version);assert.throws(()=>e.attachSemanticReview(changed,id(s),report,q.expected,q.sceneIntent),/意图|变化/);
 const n=reviewed(s);n.config.outline[0][key]+='!';assert.throws(()=>e.acceptDraft(n,id(n)),/审查|审阅/);
});
test('review bindings reject wrong target/project/revision/context/candidate, preserve original generation intent',()=>{
 const s=ready(),q=e.createSemanticReviewRequest(s,id(s));
 for(const mutate of [n=>n.projectId+='x',n=>d(n).revision++,n=>d(n).runId+='x',n=>d(n).staging.push({id:'fake',label:'x',sourceQuote:'x',status:'proposed'}),n=>n.chapters[0].revision++,n=>n.version++]){const n=copy(s);mutate(n);assert.throws(()=>e.attachSemanticReview(n,id(s),report,q.expected,q.sceneIntent));}
 const n=reviewed(s);assert.deepEqual(d(n).generationIntent,d(s).generationIntent);
});
test('revision request stores full scene and candidate source, does not accept forged output provenance',()=>{
 const s=begin(),p=proposal(s),input=r.createRevisionInput(s,id(s),p.id),source=r.getRevisionSource(d(s),p);
 assert.deepEqual(input.sceneIntent,source.sceneIntent);assert.equal(input.sceneIntent.goal.value,s.config.outline[0].goal);assert.deepEqual(source.stagingSnapshot,d(s).staging);
 input.sceneIntent.goal.value='mutated';assert.notEqual(r.getRevisionSource(d(s),p).sceneIntent.goal.value,'mutated');
 assert.throws(()=>r.attachDraftRevision(s,id(s),p.id,{...result,sceneIntent:{forged:true}},p.binding));
});
for(const key of ['goal','exitState'])test(`same version ${key} change marks returned revision stale and prevents old proposal adoption`,()=>{
 const s=begin(),p=proposal(s),n=copy(s);n.config.outline[0][key]+='!';
 assert.equal(r.isRevisionCurrent(n,id(n),p.id),false);assert.throws(()=>r.createRevisionInput(n,id(n),p.id));
 const late=r.attachDraftRevision(n,id(n),p.id,result,p.binding);assert.equal(proposal(late).status,'stale');assert.equal(d(late).text,d(s).text);
 const ready=completed(s);ready.config.outline[0][key]+='!';assert.throws(()=>r.adoptDraftRevision(ready,id(ready),p.id,proposal(ready)));
});
test('candidate edits invalidate revision, cancellation rejects late result, old proposal cannot attach new request',()=>{
 const s=begin(),p=proposal(s),n=copy(s);d(n).staging.push({id:'new',label:'new',sourceQuote:'new',status:'proposed'});
 assert.equal(r.isRevisionCurrent(n,id(n),p.id),false);
 const cancelled=r.markRevisionFailure(s,id(s),p.id,'cancelled');assert.throws(()=>r.attachDraftRevision(cancelled,id(s),p.id,result,p.binding));
 const retry=r.beginDraftRevision(cancelled,id(s));assert.throws(()=>r.attachDraftRevision(retry,id(s),proposal(retry).id,result,p.binding));
});
test('historical snapshot validates without current goal backfill, imported active proposals stale',()=>{
 const s=completed();s.config.outline[0].goal='later changed';const parsed=parseBackup(JSON.stringify(backup(s)));assert.deepEqual(parsed.state,s);
 const imported=importBackup(backup(e.createInitialState()),parsed,()=> 'scene-import').state;assert.equal(proposal(imported).status,'stale');assert.equal(d(imported).revisionSnapshots[0].sceneIntent.projectId,'scene-import');assert.equal(d(imported).revisionSnapshots[0].sceneIntent.goal.value,'  约好明天修表  ');
 const legacy=completed();for(const source of d(legacy).revisionSnapshots){delete source.sceneIntent;delete source.stagingSnapshot;}assert.deepEqual(parseBackup(JSON.stringify(backup(legacy))).state,legacy);assert.equal(r.isRevisionCurrent(legacy,id(legacy),proposal(legacy).id),true);assert.equal(Object.hasOwn(r.createRevisionInput(begin(),id(begin()),proposal(begin()).id),'sceneIntent'),true);
});
test('bad local provenance cannot enter backups; archived review source stays checked',()=>{
 for(const mutate of [x=>x.draftId='wrong',x=>x.draftRevision++,x=>x.contextVersion++,x=>x.chapterIndex++,x=>x.goal={status:'present',value:''},x=>x.extra='forged']) {
  const s=reviewed();mutate(d(s).modelReview.sceneIntent);assert.throws(()=>parseBackup(JSON.stringify(backup(s))));
  const n=completed();mutate(d(n).revisionSnapshots[0].sceneIntent);assert.throws(()=>parseBackup(JSON.stringify(backup(n))));
 }
 const s=reviewed(),n=e.editDraft(s,id(s),'她说明天来。');assert.doesNotThrow(()=>parseBackup(JSON.stringify(backup(n))));
});
test('shape limits use safe integers and preserve unsupported fields as invalid without serialization',()=>{
 const s=fresh(),v=captureRequestSceneIntent(s,d(s),e.getContext(s));for(const key of ['chapterIndex','chapterRevision','stateVersion','draftRevision','contextVersion','contextSchemaVersion']){const n=copy(v);n[key]=Number.MAX_SAFE_INTEGER+1;assert.throws(()=>validateRequestSceneIntent(n));}
 s.config.outline[0].goal='x'.repeat(4001);assert.throws(()=>captureRequestSceneIntent(s,d(s),e.getContext(s)));
});
test('unreferenced source provenance and archived binding identities are validated on import',()=>{
 const s=completed();d(s).revisionProposals=[];d(s).revisionSnapshots[0].sceneIntent={forged:'x'};assert.throws(()=>parseBackup(JSON.stringify(backup(s))));
 for(const key of ['projectId','draftId','runId']){const n=e.editDraft(reviewed(),id(reviewed()),'新的正文');d(n).memoryAuthorities[0].binding[key]='foreign';assert.throws(()=>parseBackup(JSON.stringify(backup(n))));}
});
