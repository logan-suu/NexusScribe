import test from 'node:test';
import assert from 'node:assert/strict';
import * as e from '../src/domain/engine.js';
import * as revision from '../src/domain/author-revision.js';
import {parseBackup, importBackup} from '../src/storage.js';
import {readFileSync} from 'node:fs';

const raw='  陆遥拿起未拆封的信。😀\r\n\r\n她把信放回桌面。\t';
const fact='这封信始终未拆封。';
const provider={id:'offline-model-fixture',isLive:true,usage:{totalTokens:17}};
const clone=structuredClone;
const draft=s=>s.drafts.at(-1),id=s=>draft(s).id;
const backup=s=>({format:1,serial:0,state:s,editing:{},patch:null});
function fresh({canon=false,text=raw}={}){
 let s=e.createProjectFromConfig({projectId:'prose-only-tests',chapters:[{text:fact}]});
 if(canon)s=e.commitPatch(s,e.proposeCustomPatch(s,'ch1',{intent:'author_fact',statement:fact}));
 return e.stageProseDraft(s,{text,provider,context:e.getContext(s)},'ch1');
}
const extraction=()=>({staging:[{label:'陆遥拿起未拆封的信',sourceParagraphIndex:0}],reviewNotes:[],provider});
function extracted(s=fresh()){
 s=e.beginMemoryExtraction(s,id(s));return e.attachMemoryExtraction(s,id(s),extraction(),e.createExtractionBinding(s,id(s)));
}
function report(s,status='consistent'){
 return {summary:'离线合成审阅，不证明真实质量',checks:[],issues:[],factChecks:s.facts.map(f=>({factId:f.id,recordVersion:f.recordVersion,status,explanation:'合成判断',sourceQuote:draft(s).text})),provider};
}
function reviewed(s,status='consistent'){
 s=e.reviewDraft(s,id(s));return e.attachSemanticReview(s,id(s),report(s,status),e.createReviewBinding(s,id(s)));
}
function resolve(s){
 const f=s.facts[0];return e.resolveFactReview(s,id(s),{factId:f.id,recordVersion:f.recordVersion,action:'accept_exception',reason:'测试中的明确作者例外',reviewHash:e.hash(JSON.stringify(draft(s).modelReview))},e.createReviewBinding(s,id(s)));
}
function quote(s){
 const row=e.getMemoryReviewGate(s,id(s))[0];return e.decideMemoryCandidate(s,id(s),{candidateId:row.candidateId,action:'keep_quote',reviewHash:row.reviewHash},row.binding);
}

test('explicit model-prose skip preserves origin, exact prose and Canon, without simulating extraction success',()=>{
 const s=fresh({canon:true}),before=clone(s),n=e.skipMemoryExtraction(s,id(s)),d=draft(n);
 assert.deepEqual(s,before);assert.equal(d.extraction.status,'skipped');assert.equal(d.extraction.authority,'explicit_author_decision');
 assert.equal(d.extraction.binding.textSnapshot,raw);assert.equal(d.extraction.attempt,1);assert.equal(d.extraction.provider,undefined);
 assert.equal(d.requiresSemanticReview,true);assert.deepEqual(d.providerInfo,provider);assert.equal(d.manualSource,undefined);
 assert.equal(d.text,raw);assert.deepEqual(d.proseVersions,draft(s).proseVersions);
 for(const key of ['chapters','facts','events','commits'])assert.deepEqual(n[key],s[key]);
 assert.equal(e.hasCurrentExtraction(n,id(n)),true);assert.deepEqual(d.staging,[]);
 assert.deepEqual(parseBackup(JSON.stringify(backup(n))),backup(n));
 assert.throws(()=>e.acceptDraft(n,id(n)),{code:'REVIEW_REQUIRED'});
 assert.throws(()=>e.acceptDraft(e.reviewDraft(n,id(n)),id(n)),{code:'SEMANTIC_REVIEW_REQUIRED'});
});

test('skip archives extracted quote cards, old selections, structure, model review and fact exceptions',()=>{
 const s=quote(resolve(reviewed(extracted(fresh({canon:true})),'contradiction'))),before=clone(draft(s));
 const n=e.skipMemoryExtraction(s,id(s)),d=draft(n),a=d.memoryArchives.at(-1);
 assert.equal(a.reason,'prose_extraction_skipped');assert.deepEqual(a.candidates,before.staging);
 assert.deepEqual(a.extractionSnapshot,before.extraction);assert.deepEqual(a.decisions,before.memoryDecisions);
 assert.deepEqual(a.structuralReview,before.review);assert.deepEqual(a.factDecisions,before.factDecisions);
 assert.ok(a.authorityIds.length);assert.deepEqual(d.memoryDecisionHistory,before.memoryDecisionHistory);
 assert.deepEqual(d.memoryAuthorities,before.memoryAuthorities);assert.equal(d.review,null);assert.equal(d.modelReview,null);
 assert.deepEqual(d.factDecisions,[]);assert.deepEqual(d.memoryDecisions,[]);assert.deepEqual(d.staging,[]);
 assert.throws(()=>e.attachSemanticReview(n,id(n),report(n),e.createReviewBinding(s,id(s))),{code:'STALE_SEMANTIC_REVIEW'});
 assert.throws(()=>e.acceptDraft(e.reviewDraft(n,id(n)),id(n)),{code:'SEMANTIC_REVIEW_REQUIRED'});
 assert.deepEqual(parseBackup(JSON.stringify(backup(n))),backup(n));
});

for(const status of ['contradiction','unknown'])test(`zero memories still blocks unresolved Canon ${status}`,()=>{
 const s=reviewed(e.skipMemoryExtraction(fresh({canon:true}),id(fresh({canon:true}))),status);
 assert.equal(e.getMemoryReviewGate(s,id(s)).length,0);
 assert.throws(()=>e.acceptDraft(s,id(s)),{code:'FACT_DECISION_REQUIRED'});
 const accepted=e.acceptDraft(resolve(s),id(s));assert.equal(draft(accepted).status,'ACCEPTED');assert.deepEqual(accepted.facts,s.facts);
 assert.equal(accepted.commits.at(-1).factDecisions[0].assessment,status);
});

test('a fresh model error after skipping remains a blocking error',()=>{
 let s=e.reviewDraft(e.skipMemoryExtraction(fresh(),id(fresh())),id(fresh()));
 s=e.attachSemanticReview(s,id(s),{...report(s),issues:[{severity:'error',explanation:'合成阻塞问题',sourceQuote:raw}]},e.createReviewBinding(s,id(s)));
 assert.throws(()=>e.acceptDraft(s,id(s)),{code:'SEMANTIC_REVIEW_ERRORS'});
});

for(const status of ['pending','failed','cancelled'])test(`${status} extraction is never an empty successful result; an explicit skip invalidates late results`,()=>{
 let s=e.beginMemoryExtraction(fresh(),id(fresh()));const binding=e.createExtractionBinding(s,id(s));
 if(status!=='pending')s=e.markExtractionFailure(s,id(s),binding,status);
 assert.equal(e.hasCurrentExtraction(s,id(s)),false);assert.equal(draft(s).extraction.status,status);
 assert.throws(()=>e.acceptDraft(e.reviewDraft(s,id(s)),id(s)),{code:'REVIEW_REQUIRED'});
 const n=e.skipMemoryExtraction(s,id(s));assert.equal(draft(n).memoryArchives.at(-1).extractionSnapshot.status,status);
 assert.throws(()=>e.attachMemoryExtraction(n,id(n),extraction(),binding),{code:'STALE_EXTRACTION'});
 assert.deepEqual(e.markExtractionFailure(n,id(n),binding),n);
 assert.equal(draft(e.acceptDraft(reviewed(n),id(n))).status,'ACCEPTED');
});

test('restarting extraction after skip requires a fresh result, selection and fresh review',()=>{
 const s=reviewed(e.skipMemoryExtraction(fresh(),id(fresh()))),n=e.beginMemoryExtraction(s,id(s));
 assert.equal(draft(n).extraction.status,'pending');assert.equal(draft(n).modelReview,null);
 assert.throws(()=>e.acceptDraft(n,id(n)),{code:'REVIEW_REQUIRED'});
 const next=reviewed(e.attachMemoryExtraction(n,id(n),extraction(),e.createExtractionBinding(n,id(n))));
 assert.throws(()=>e.acceptDraft(next,id(next)),{code:'MEMORY_DECISION_REQUIRED'});
 assert.equal(e.acceptDraft(quote(next),id(next)).events.length,1);
});

test('candidate edit revokes skip and exact bound review; no silent inherited opt-out',()=>{
 const s=reviewed(e.skipMemoryExtraction(fresh(),id(fresh()))),n=e.editDraft(s,id(s),raw+'\n补充原文。');
 assert.equal(draft(n).extraction.status,'pending');assert.equal(e.hasCurrentExtraction(n,id(n)),false);
 assert.equal(draft(n).modelReview,null);assert.equal(draft(n).memoryArchives.at(-1).extractionSnapshot.status,'skipped');
 assert.throws(()=>e.acceptDraft(e.reviewDraft(n,id(n)),id(n)),{code:'REVIEW_REQUIRED'});
 assert.equal(draft(e.acceptDraft(reviewed(e.skipMemoryExtraction(n,id(n))),id(n))).text,raw+'\n补充原文。');
});

test('state and source changes block skip until explicit context refresh; refresh revokes old skip',()=>{
 const s=reviewed(e.skipMemoryExtraction(fresh(),id(fresh())));let n=e.saveRevision(s,'ch2','新的规划文字',1);
 assert.throws(()=>e.skipMemoryExtraction(n,id(n)),{code:'STALE_EXTRACTION'});
 n=e.commitPatch(n,e.proposeCustomPatch(n,'ch2',{intent:'local_prose'}));
 assert.throws(()=>e.skipMemoryExtraction(n,id(n)),{code:'STALE_EXTRACTION'});
 n=e.refreshDraftContext(n,id(n));assert.equal(draft(n).extraction.status,'pending');
 assert.throws(()=>e.acceptDraft(e.reviewDraft(n,id(n)),id(n)),{code:'REVIEW_REQUIRED'});
 n=e.skipMemoryExtraction(n,id(n));assert.equal(e.hasCurrentExtraction(n,id(n)),true);
});

test('import keeps original skip evidence but requires new skip and review for pending candidates',()=>{
 const s=reviewed(e.skipMemoryExtraction(fresh(),id(fresh())));
 const n=importBackup(backup(e.createProjectFromConfig({projectId:'target'})),backup(s),()=> 'imported-prose-only').state;
 assert.equal(draft(n).extraction.status,'pending');assert.equal(draft(n).review,null);assert.equal(draft(n).modelReview,null);
 assert.equal(draft(n).memoryArchives.at(-1).extractionSnapshot.status,'skipped');
 assert.deepEqual(n.importOrigin.original.state,s);
 assert.throws(()=>e.acceptDraft(e.reviewDraft(n,id(n)),id(n)),{code:'REVIEW_REQUIRED'});
 assert.equal(draft(e.acceptDraft(reviewed(e.skipMemoryExtraction(n,id(n))),id(n))).status,'ACCEPTED');
});

for(const mutate of [
 d=>delete d.extraction.authority,d=>d.extraction.authority='model',d=>d.extraction.binding=null,
 d=>d.extraction.binding.textSnapshot='other',d=>d.extraction.binding.attempt++,d=>d.extraction.provider=provider,
 d=>d.extraction.stagingHash=e.hash('[]'),d=>d.staging=[{id:'forged',sourceQuote:raw}],d=>d.requiresSemanticReview=false,
])test('invalid or forged skip cannot pass backup validation or acceptance',()=>{
 const s=reviewed(e.skipMemoryExtraction(fresh(),id(fresh())));mutate(draft(s));
 assert.equal(e.hasCurrentExtraction(s,id(s)),false);assert.throws(()=>parseBackup(JSON.stringify(backup(s))));
 assert.throws(()=>e.acceptDraft(s,id(s)));
});

test('final acceptance is explicit, auditable, idempotent and contributes prose rather than fabricated events',()=>{
 const s=reviewed(e.skipMemoryExtraction(fresh(),id(fresh()))),n=e.acceptDraft(s,id(s)),commit=n.commits.at(-1);
 assert.equal(n.chapters[0].text,raw);assert.deepEqual(n.events,[]);assert.deepEqual(n.facts,s.facts);
 assert.deepEqual(commit.acceptance,{protocol:'prose-only-v1',authority:'explicit_author_decision',draftRevision:1,textHash:e.hash(raw),textSnapshot:raw,memoryExtraction:'skipped',extractionAttempt:1,semanticStatus:'model_reviewed_unverified'});
 assert.deepEqual(commit.memoryCandidateIds,[]);assert.deepEqual(commit.memoryDecisions,[]);assert.equal(commit.manualSource,undefined);
 assert.deepEqual(e.acceptDraft(n,id(n)),n);const ctx=e.getContext(n);
 assert.equal(ctx.sources[0].role,'accepted_manuscript');assert.equal(ctx.sources[0].text,raw);assert.deepEqual(ctx.events,[]);
 const next=e.stageProseDraft(n,{text:'第二章的离线候选。',provider,context:ctx},'ch2');
 assert.equal(draft(next).context.sources[0].text,raw);assert.deepEqual(draft(next).context.events,[]);
 assert.deepEqual(parseBackup(JSON.stringify(backup(next))),backup(next));
 const imported=importBackup(backup(e.createProjectFromConfig({projectId:'other'})),backup(n),()=> 'accepted-import').state;
 assert.equal(imported.commits.at(-1).acceptance.textSnapshot,raw);assert.equal(e.getContext(imported).sources[0].role,'accepted_manuscript');
});

test('undo or reopening accepted prose removes accepted context authority while retaining all old evidence',()=>{
 const n=e.acceptDraft(reviewed(e.skipMemoryExtraction(fresh(),id(fresh()))),id(fresh()));
 for(const next of [e.undoCommit(n,n.commits.at(-1).id),e.saveRevision(n,'ch1',raw+'\n新版。',n.chapters[0].revision)]){
  assert.equal(next.chapters[0].status,'DRAFT');assert.notEqual(e.getContext(next).sources[0].role,'accepted_manuscript');
  assert.equal(draft(next).text,raw);assert.deepEqual(draft(next),draft(n));assert.deepEqual(next.events,[]);
  assert.deepEqual(next.commits.find(c=>c.id===n.commits.at(-1).id),n.commits.at(-1));
  assert.deepEqual(parseBackup(JSON.stringify(backup(next))),backup(next));
 }
});

test('historical failed revision can be explicitly author-edited then accepted without altering raw provenance',()=>{
 const path=new URL('../eval/history/author-revision-v1/revised-chapter-2.txt',import.meta.url),outcomePath=new URL('../eval/history/author-revision-v1/outcome.json',import.meta.url);
 const historical=readFileSync(path,'utf8'),outcome=readFileSync(outcomePath,'utf8');
 assert.equal(JSON.parse(outcome).closeRead,'fail');const corrected=historical.replace('许宁没再敲，退后半步','许宁退后半步');assert.notEqual(corrected,historical);
 let s=revision.setRevisionInstruction(fresh(),id(fresh()),'修正动作矛盾，保持原意');s=revision.beginDraftRevision(s,id(s));
 const p=draft(s).revisionProposals.at(-1);s=revision.attachDraftRevision(s,id(s),p.id,{text:historical,chapterId:'ch1',provider},p.binding);
 const proposal=clone(draft(s).revisionProposals.at(-1));s=revision.adoptDraftRevision(s,id(s),p.id,proposal,{text:corrected});
 const adopted=clone(draft(s).revisionProposals.at(-1));s=e.acceptDraft(reviewed(e.skipMemoryExtraction(s,id(s))),id(s));
 assert.equal(draft(s).text,corrected);assert.deepEqual(draft(s).revisionProposals.at(-1),adopted);
 assert.equal(adopted.result.text,historical);assert.equal(adopted.adoption.authority,'explicit_author_edit');
 assert.equal(draft(s).manualSource,undefined);assert.deepEqual(draft(s).providerInfo,provider);assert.deepEqual(s.events,[]);
 assert.equal(readFileSync(path,'utf8'),historical);assert.equal(readFileSync(outcomePath,'utf8'),outcome);
 assert.deepEqual(parseBackup(JSON.stringify(backup(s))),backup(s));
});

test('old combined candidates and terminal prose drafts cannot use the new skip path',()=>{
 const source=e.createProjectFromConfig({projectId:'legacy'}),old=e.stageProviderDraft(source,{text:raw,provider,context:e.getContext(source),staging:[]},'ch1');
 assert.throws(()=>e.skipMemoryExtraction(old,id(old)),{code:'EXTRACTION_NOT_REQUIRED'});
 for(const s of [e.rejectDraft(fresh(),id(fresh())),e.acceptDraft(reviewed(e.skipMemoryExtraction(fresh(),id(fresh()))),id(fresh()))]){
  assert.throws(()=>e.skipMemoryExtraction(s,id(s)),{code:'DRAFT_STATUS'});
 }
});

test('credential-free maintenance replay manifest covers current runtime; historical trial evidence is separate',async()=>{
 const {verifyFrozenManifest}=await import('../scripts/multichapter-eval.mjs');
 const maintenance=await verifyFrozenManifest();
 const historical=JSON.parse(readFileSync(new URL('../eval/history/multichapter-v1/source-manifest.json',import.meta.url),'utf8'));
 assert.notEqual(maintenance.sha256['src/domain/engine.ts'],historical.sha256['src/domain/engine.js']);
 assert.notEqual(maintenance.sha256['src/App.tsx'],historical.sha256['src/App.jsx']);
});
