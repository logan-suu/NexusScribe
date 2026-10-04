import test from 'node:test';
import assert from 'node:assert/strict';
import * as e from '../src/domain/engine.js';
import * as r from '../src/domain/author-revision.js';
import {parseBackup,importBackup} from '../src/storage.js';
const BEFORE='  陆遥把纸盒放在桌上。\n\n她没有打开它。😀';
const AFTER='陆遥打开纸盒，才看见纸屑。\n她约好明早九点回来。';
const provider={id:'revision-fixture',isLive:true,model:'cheap-fixture'};
const copy=x=>structuredClone(x);
function fresh(){let s=e.createProjectFromConfig({projectId:'author-revision',idea:'信件',tone:'克制'});return e.stageProseDraft(s,{text:BEFORE,chapterId:'ch1',context:e.getContext(s),provider},'ch1');}
const id=s=>s.drafts[0].id;
const last=s=>s.drafts[0].revisionProposals.at(-1);
function begin(s=fresh()){s=r.setRevisionInstruction(s,id(s),'压缩并修复盒子可见性，保留约定');return r.beginDraftRevision(s,id(s));}
function completed(s=begin(),text=AFTER){return r.attachDraftRevision(s,id(s),last(s).id,{text,chapterId:'ch1',provider},last(s).binding);}
const backup=state=>({format:1,serial:0,state,editing:{},patch:null,providerMode:'server'});
test('counts explicitly use Han codepoints, all codepoints and nonblank physical lines',()=>{
 assert.deepEqual(r.proseCounts(' 汉A😀\r\n\n 𠀀\t'),{han:2,characters:10,paragraphs:2});
 assert.deepEqual(r.proseCounts(' \n\t'),{han:0,characters:3,paragraphs:0});
});
test('one request makes a separate immutable bound proposal without altering manuscript or memory',()=>{
 const original=fresh(),s=begin(original),p=last(s),input=r.createRevisionInput(s,id(s),p.id),n=completed(s);
 assert.equal(r.getRevisionSource(s.drafts[0],p).textSnapshot,BEFORE);assert.deepEqual(input,{text:BEFORE,instruction:s.drafts[0].revisionInstruction,chapterId:'ch1',context:e.getContext(s)});
 input.context.constitution.tone='tampered';assert.notEqual(r.getRevisionSource(s.drafts[0],p).contextSnapshot.constitution.tone,'tampered');
 assert.equal(n.drafts[0].text,BEFORE);assert.deepEqual(n.chapters,original.chapters);assert.deepEqual(n.facts,original.facts);assert.deepEqual(n.events,original.events);assert.deepEqual(n.drafts[0].proseVersions,original.drafts[0].proseVersions);
 assert.equal(last(n).status,'proposed');assert.equal(last(n).result.text,AFTER);assert.deepEqual(last(n).afterCounts,r.proseCounts(AFTER));assert.equal(r.isRevisionCurrent(n,id(n),p.id),true);
 assert.throws(()=>r.beginDraftRevision(s,id(s)),/已有改稿请求/);
});
test('adoption preserves original/proposal and invalidates extraction, structural/model reviews and choices',()=>{
 let s=fresh();s=e.beginMemoryExtraction(s,id(s));s=e.attachMemoryExtraction(s,id(s),{staging:[{label:'她没有打开盒子',sourceParagraphIndex:1}],reviewNotes:[],provider},e.createExtractionBinding(s,id(s)));s=e.reviewDraft(s,id(s));s=e.attachSemanticReview(s,id(s),{summary:'合成建议',checks:[],issues:[],factChecks:[],provider:'fixture'},e.createReviewBinding(s,id(s)));
 const item=e.getMemoryReviewGate(s,id(s))[0];s=e.decideMemoryCandidate(s,id(s),{candidateId:item.candidateId,action:'keep_quote',reviewHash:item.reviewHash},item.binding);
 const old=copy(s);s=completed(begin(s));const p=copy(last(s)),n=r.adoptDraftRevision(s,id(s),p.id,p),d=n.drafts[0];
 assert.equal(d.text,AFTER);assert.equal(d.revision,2);assert.equal(d.proseVersions[0].text,BEFORE);assert.equal(r.getRevisionSource(n.drafts[0],last(n)).textSnapshot,BEFORE);assert.equal(last(n).status,'adopted');assert.equal(last(n).adoptedRevision,2);
 assert.equal(d.extraction.status,'pending');assert.deepEqual(d.staging,[]);assert.equal(d.review,null);assert.equal(d.modelReview,null);assert.deepEqual(d.factDecisions,[]);assert.deepEqual(d.memoryDecisions,[]);assert.ok(d.memoryArchives.length>old.drafts[0].memoryArchives.length);
 assert.deepEqual(n.chapters,old.chapters);assert.deepEqual(n.events,old.events);assert.deepEqual(n.facts,old.facts);assert.throws(()=>e.acceptDraft(n,id(n)),/重新审查/);assert.doesNotThrow(()=>parseBackup(JSON.stringify(backup(n))));
 assert.throws(()=>r.adoptDraftRevision(n,id(n),p.id,p));
});
test('discard and same-text adoption retain every paid result without marking chapter accepted',()=>{
 const s=completed(),p=last(s),n=r.discardDraftRevision(s,id(s),p.id);assert.equal(n.drafts[0].text,BEFORE);assert.equal(last(n).status,'discarded');assert.deepEqual(last(n).result,p.result);
 const same=completed(begin(),BEFORE),adopted=r.adoptDraftRevision(same,id(same),last(same).id,last(same));assert.equal(adopted.drafts[0].revision,2);assert.equal(adopted.chapters[0].status,'PLANNED');
});
for(const [label,change] of [
 ['instruction',s=>r.setRevisionInstruction(s,id(s),'保留更多细节')],
 ['instruction changed back',s=>r.setRevisionInstruction(r.setRevisionInstruction(s,id(s),'新意见'),id(s),s.drafts[0].revisionInstruction)],
 ['draft text',s=>e.editDraft(s,id(s),BEFORE+'后续')],
 ['context',s=>{s=copy(s);s.config.tone='轻快';return s;}],
 ['source chapter',s=>e.saveRevision(s,'ch2','changed',1)],
 ['story version',s=>{s=copy(s);s.version++;return s;}],
 ['rejected',s=>e.rejectDraft(s,id(s))]
])test(`${label} cannot adopt old advice and retains late result only as stale`,()=>{
 const s=begin(),p=last(s),changed=change(s),late=r.attachDraftRevision(changed,id(s),p.id,{text:AFTER,chapterId:'ch1',provider},p.binding);
 assert.equal(last(late).status,'stale');assert.equal(last(late).result.text,AFTER);assert.equal(r.isRevisionCurrent(late,id(late),p.id),false);assert.throws(()=>r.adoptDraftRevision(late,id(late),p.id,last(late)));
 const ready=completed(s),altered=change(ready);assert.throws(()=>r.adoptDraftRevision(altered,id(altered),p.id,last(ready)));
});
test('workspace-only staleness can retain paid result without adoption authority',()=>{const s=begin(),n=r.attachDraftRevision(s,id(s),last(s).id,{text:AFTER,chapterId:'ch1',provider},last(s).binding,{stale:true});assert.equal(last(n).status,'stale');});
for(const status of ['failed','cancelled'])test(`${status} cannot revive or replace request`,()=>{const s=begin(),p=last(s),n=r.markRevisionFailure(s,id(s),p.id,status);assert.equal(n.drafts[0].text,BEFORE);assert.throws(()=>r.attachDraftRevision(n,id(n),p.id,{text:AFTER,chapterId:'ch1',provider},p.binding));const newer=r.beginDraftRevision(n,id(n));assert.notEqual(last(newer).id,p.id);assert.throws(()=>r.attachDraftRevision(newer,id(newer),p.id,{text:AFTER,chapterId:'ch1',provider},p.binding));});
test('wrong request binding and malformed/overlong responses do not modify source',()=>{
 const s=begin(),p=last(s);for(const report of [null,{text:' ',chapterId:'ch1',provider},{text:'字'.repeat(30001),chapterId:'ch1',provider},{text:AFTER,chapterId:'ch2',provider},{text:AFTER,chapterId:'ch1',provider:{id:'fake',isLive:false}},{text:AFTER,chapterId:'ch1',provider,staging:[]}])assert.throws(()=>r.attachDraftRevision(s,id(s),p.id,report,p.binding));
 assert.throws(()=>r.attachDraftRevision(s,id(s),p.id,{text:AFTER,chapterId:'ch1',provider},{...p.binding,instruction:'tampered'}));assert.equal(s.drafts[0].text,BEFORE);
});
test('empty and excessive instructions blocked; template/manual/accepted drafts cannot request revisions',()=>{
 for(const value of [null,{},'a'.repeat(4001)])assert.throws(()=>r.setRevisionInstruction(fresh(),id(fresh()),value));
 const blank=r.setRevisionInstruction(fresh(),id(fresh()),' ');assert.throws(()=>r.beginDraftRevision(blank,id(blank)));
 for(const change of [d=>d.status='ACCEPTED',d=>d.status='REJECTED',d=>d.providerInfo.isLive=false,d=>d.manualSource={},d=>d.provider='author-manuscript']){const s=fresh();change(s.drafts[0]);assert.throws(()=>r.setRevisionInstruction(s,id(s),'压缩'));}
});
test('reload preserves proposal and exact provenance; import removes pending adoption authority',()=>{
 const s=completed(),parsed=parseBackup(JSON.stringify(backup(s)));assert.deepEqual(parsed.state,s);assert.equal(r.isRevisionCurrent(parsed.state,id(s),last(s).id),true);
 const imported=importBackup(backup(e.createInitialState()),parsed,()=> 'imported-author-revision').state;assert.equal(last(imported).status,'stale');assert.equal(last(imported).result.text,AFTER);assert.equal(r.isRevisionCurrent(imported,id(imported),last(imported).id),false);assert.throws(()=>r.adoptDraftRevision(imported,id(imported),last(imported).id,last(imported)));
 const adopted=r.adoptDraftRevision(s,id(s),last(s).id,last(s));assert.doesNotThrow(()=>importBackup(backup(e.createInitialState()),backup(adopted),()=> 'imported-adopted'));
});
for(const [label,change] of [
 ['result',p=>p.result.text='tamper'],['counts',p=>p.beforeCounts.han++],['original text',p=>p.binding.textSnapshot='different'],['chapter',p=>p.binding.chapterId='ch2'],['instruction counter',p=>p.binding.instructionVersion=999],['status',p=>p.status='accepted'],['snapshot',p=>p.resultSnapshot.provider.id='different']
])test(`backup rejects malformed revision ${label}`,()=>{const s=completed();change(last(s));assert.throws(()=>parseBackup(JSON.stringify(backup(s))));});

test('stored revision history cannot be relabeled as offline or manual-origin metadata',()=>{
 for(const mutate of [d=>{d.providerInfo.isLive=false;d.requiresSemanticReview=false},d=>{d.provider='author-manuscript'},d=>{d.manualSource=null}]){const s=completed();mutate(s.drafts[0]);assert.throws(()=>parseBackup(JSON.stringify(backup(s))));assert.throws(()=>r.validateDraftRevisions(s.drafts[0]));}
});

test('repeated cancelled/failed requests share exact source snapshots and remain under bounded backup growth',()=>{
 const large='长'.repeat(4000);let s=e.createProjectFromConfig({projectId:'large-revisions',chapters:[{text:large},{text:large},{text:large}]});s=e.stageProseDraft(s,{text:large,chapterId:'ch1',context:e.getContext(s),provider},'ch1');s=r.setRevisionInstruction(s,id(s),'保留内容并精简');
 const beforeBytes=Buffer.byteLength(JSON.stringify(backup(s)));
 for(let i=0;i<80;i++){s=r.beginDraftRevision(s,id(s));s=r.markRevisionFailure(s,id(s),last(s).id,i%2?'failed':'cancelled');}
 assert.equal(s.drafts[0].revisionSnapshots.length,1);assert.equal(s.drafts[0].revisionProposals.length,80);assert.ok(s.drafts[0].revisionProposals.every(p=>p.binding.snapshotId==='revision-source-1'&&!Object.hasOwn(p.binding,'textSnapshot')&&!Object.hasOwn(p.binding,'contextSnapshot')));
 const bytes=Buffer.byteLength(JSON.stringify(backup(s)));assert.ok(bytes-beforeBytes<110000,`${bytes-beforeBytes} incremental bytes`);assert.doesNotThrow(()=>parseBackup(JSON.stringify(backup(s))));
 const current=r.getRevisionCurrency(s,id(s));assert.equal(Object.values(current).filter(Boolean).length,0);
 const next=completed(r.beginDraftRevision(s,id(s)),large+'新');assert.equal(next.drafts[0].revisionSnapshots.length,1);assert.equal(r.getRevisionCurrency(next,id(next))[last(next).id],true);
});
test('terminal proposals retain exact results once and shared sources survive reload/import',()=>{
 let s=completed(),p=last(s);s=r.discardDraftRevision(s,id(s),p.id);assert.equal(last(s).result.text,AFTER);assert.equal(last(s).resultSnapshot,null);
 assert.deepEqual(r.getRevisionSource(s.drafts[0],last(s)).textSnapshot,BEFORE);assert.doesNotThrow(()=>parseBackup(JSON.stringify(backup(s))));
 const imported=importBackup(backup(e.createInitialState()),backup(s),()=> 'compact-import').state;assert.equal(r.getRevisionSource(imported.drafts[0],last(imported)).textSnapshot,BEFORE);
 for(const mutate of [d=>d.revisionSnapshots.pop(),d=>d.revisionSnapshots.push(copy(d.revisionSnapshots[0])),d=>d.revisionSnapshots[0].textSnapshot='wrong',d=>d.revisionProposals[0].binding.snapshotId='missing']){const t=copy(s);mutate(t.drafts[0]);assert.throws(()=>parseBackup(JSON.stringify(backup(t))));}
});
test('one-pass currency matches individual gates across mixed terminal and active history',()=>{
 let s=completed();s=r.discardDraftRevision(s,id(s),last(s).id);s=completed(r.beginDraftRevision(s,id(s)));s=r.setRevisionInstruction(s,id(s),'另一条意见');s=completed(r.beginDraftRevision(s,id(s)));
 const values=r.getRevisionCurrency(s,id(s));assert.deepEqual(Object.values(values),[false,false,true]);
 for(const p of s.drafts[0].revisionProposals)assert.equal(r.isRevisionCurrent(s,id(s),p.id),values[p.id]);
});

test('author may edit only the adoption buffer; raw model provenance and historical version remain exact',()=>{
 const s=completed(),p=copy(last(s)),finalText='  作者确认要保留的新措辞。🙂\n\n这仍未经过语义验证。\n';
 const bounds={hanMin:100,hanMax:200,paragraphsMin:1,paragraphsMax:1};
 const n=r.adoptDraftRevision(s,id(s),p.id,p,{text:finalText,lengthBounds:bounds});
 assert.equal(s.drafts[0].text,BEFORE);assert.deepEqual(last(s),p);
 assert.equal(n.drafts[0].text,finalText);assert.equal(r.getRevisionAdoptedText(n.drafts[0],last(n)),finalText);
 assert.deepEqual(last(n).result,p.result);assert.deepEqual(last(n).beforeCounts,p.beforeCounts);assert.deepEqual(last(n).afterCounts,p.afterCounts);
 assert.deepEqual(last(n).adoption,{authority:'explicit_author_edit',textHash:e.hash(finalText),counts:r.proseCounts(finalText),lengthBounds:bounds});
 assert.equal(n.drafts[0].proseVersions.length,2);assert.deepEqual(n.chapters,s.chapters);assert.deepEqual(n.facts,s.facts);assert.deepEqual(n.events,s.events);
 assert.equal(n.drafts[0].extraction.status,'pending');assert.throws(()=>e.acceptDraft(n,id(n)));
 assert.equal(r.revisionLengthWarnings(finalText,bounds).length,2,'Length warnings do not block explicit author adoption');
 const parsed=parseBackup(JSON.stringify(backup(n)));assert.deepEqual(parsed.state,n);
 const imported=importBackup(backup(e.createInitialState()),parsed,()=> 'edited-import').state;
 assert.equal(r.getRevisionAdoptedText(imported.drafts[0],last(imported)),finalText);assert.deepEqual(last(imported).adoption,last(n).adoption);
 assert.deepEqual(imported.importOrigin.original.state,n);
 const changed=e.editDraft(n,id(n),finalText+'后来再次编辑。');
 assert.equal(r.getRevisionAdoptedText(changed.drafts[0],last(changed)),finalText,'Adoption points to its version, not current text');
 assert.doesNotThrow(()=>parseBackup(JSON.stringify(backup(changed))));
});
test('unchanged and legacy adoption remain readable without author-edit attribution',()=>{
 const s=completed(),p=last(s),n=r.adoptDraftRevision(s,id(s),p.id,p);
 assert.equal(last(n).adoption.authority,'explicit_model_adoption');
 const legacy=copy(n);delete last(legacy).adoption;
 assert.doesNotThrow(()=>parseBackup(JSON.stringify(backup(legacy))));
 assert.equal(r.getRevisionAdoptedText(legacy.drafts[0],last(legacy)),AFTER);
});
test('adoption rejects blank, overlong, malformed edits and altered/stale expected proposal',()=>{
 const s=completed(),p=copy(last(s));
 for(const options of [null,[],{text:''},{text:' \n'},{text:12},{text:'长'.repeat(30001)},{text:AFTER,authority:'explicit_author_edit'},{lengthBounds:null},{lengthBounds:{hanMin:'2'}},{lengthBounds:{hanMin:3,hanMax:2}}])assert.throws(()=>r.adoptDraftRevision(s,id(s),p.id,p,options));
 assert.throws(()=>r.adoptDraftRevision(s,id(s),p.id,{...p,status:'discarded'},{text:'作者编辑'}));
 const stale=r.setRevisionInstruction(s,id(s),'新意见');assert.throws(()=>r.adoptDraftRevision(stale,id(s),p.id,p,{text:'作者编辑'}));
 assert.equal(s.drafts[0].revision,1);assert.deepEqual(last(s),p);
});
test('only explicit integer bounds produce deterministic advisory warnings',()=>{
 assert.deepEqual(r.parseRevisionLengthBounds({hanMin:'',hanMax:'002',paragraphsMin:'0'}),{hanMax:2,paragraphsMin:0});
 assert.deepEqual(r.revisionLengthWarnings('汉A😀\n\n 𠀀'),[]);
 assert.deepEqual(r.revisionLengthWarnings('汉A😀\n\n 𠀀',{hanMin:3,paragraphsMax:1}),['汉字 2 低于作者下限 3','段数 2 高于作者上限 1']);
 assert.deepEqual(r.revisionLengthWarnings('汉A😀\n\n 𠀀',{hanMax:1,paragraphsMin:3}),['汉字 2 高于作者上限 1','段数 2 低于作者下限 3']);
 assert.deepEqual(r.revisionLengthWarnings('汉\n字',{hanMin:2,hanMax:2,paragraphsMin:2,paragraphsMax:2}),[]);
 for(const bad of [null,[],{unknown:1},{hanMin:-1},{hanMin:1.5},{hanMin:NaN},{hanMin:Infinity},{hanMin:Number.MAX_SAFE_INTEGER+1},{hanMin:'1e2'},{hanMin:'2.0'},{hanMin:' '},{hanMin:true},{paragraphsMin:3,paragraphsMax:2}])assert.throws(()=>r.parseRevisionLengthBounds(bad));
 assert.deepEqual(r.parseRevisionLengthBounds(),{});
});
for(const [label,change] of [
 ['authority',p=>p.adoption.authority='explicit_model_adoption'],['counts',p=>p.adoption.counts.han++],['hash',p=>p.adoption.textHash='changed'],['version',p=>p.adoptedRevision=1],['limit',p=>p.adoption.lengthBounds.hanMin=-1],['relabelled model',p=>{p.result.text='作者新正文';p.afterCounts=r.proseCounts(p.result.text)}],['removed authorship',p=>delete p.adoption]
])test(`edited adoption backup rejects inconsistent ${label}`,()=>{
 const s=completed(),n=r.adoptDraftRevision(s,id(s),last(s).id,last(s),{text:'作者新正文'});change(last(n));assert.throws(()=>parseBackup(JSON.stringify(backup(n))));
});
test('pending and discarded proposals cannot claim adoption provenance',()=>{
 const s=completed();last(s).adoption={authority:'explicit_author_edit',textHash:e.hash(AFTER),counts:r.proseCounts(AFTER),lengthBounds:{}};
 assert.throws(()=>parseBackup(JSON.stringify(backup(s))));
});
