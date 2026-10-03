// Deterministic DOM regressions only: no live calls, browser launch, or model-quality claim.
import {JSDOM} from 'jsdom';
import {build} from 'esbuild';
import {mkdir,symlink} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import * as engine from '../src/domain/engine.js';
const out='/tmp/nexusscribe-ui-memory-review';await mkdir(out+'/node_modules',{recursive:true});
for(const name of ['react','react-dom','lucide-react'])try{await symlink(resolve('node_modules',name),out+'/node_modules/'+name)}catch(e){if(e.code!=='EEXIST')throw e}
await build({entryPoints:['src/App.jsx'],bundle:true,packages:'external',format:'esm',outfile:out+'/App.mjs',loader:{'.css':'empty'},jsx:'automatic'});
const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'http://localhost/'});
for(const key of ['window','document','HTMLElement','Element','Node','MutationObserver','localStorage','getComputedStyle'])globalThis[key]=dom.window[key];Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});globalThis.IS_REACT_ACT_ENVIRONMENT=true;dom.window.HTMLElement.prototype.scrollIntoView=function(){};
const React=await import('react'),{render,screen,within,cleanup,waitFor,fireEvent,act}=await import('@testing-library/react'),user=(await import('@testing-library/user-event')).default.setup(),{default:App}=await import(out+'/App.mjs');
const KEY='nexusscribe.demo.v1',provider={id:'mock-memory-review',isLive:true};
// The first label is true only by combining separate paragraphs, but its attached quote is incomplete.
const text='苏澜推开钟楼侧门，发现门缝里夹着一张湿纸条。\n\n她把纸条放进外衣口袋，沿着台阶走向塔顶。\n\n塔顶的铜铃响了一声。';
const entries=[{label:'苏澜发现湿纸条并收进口袋',sourceParagraphIndex:0},{label:'苏澜收好纸条并确认寄件人是父亲',sourceParagraphIndex:1},{label:'铜铃响了一声',sourceParagraphIndex:2}];
function base(items=entries,{review=true,checks=true,projectId='memory-ui',prose=text,statuses=null}={}){
 let s=engine.createProjectFromConfig({projectId,title:'湿纸条'});s=engine.stageProseDraft(s,{text:prose,provider,context:engine.getContext(s)},'ch1');const id=s.drafts[0].id;s=engine.beginMemoryExtraction(s,id);s=engine.attachMemoryExtraction(s,id,{staging:items,reviewNotes:[],provider},engine.createExtractionBinding(s,id));s=engine.reviewDraft(s,id);
 if(review){const memory=engine.createMemoryReviewInput(s,id),memoryChecks=checks?memory.filter((_,i)=>statuses?statuses[i]:i!==1).map((c,i)=>({candidateId:c.candidateId,status:statuses?statuses[i]:i===0?'unsupported':'supported',explanation:i===0?'该引用仅含发现纸条，收进口袋发生在另一段；标签未被所引段落完整支持':'完整引用明确说明铜铃响了一声'})):[];s=engine.attachSemanticReview(s,id,{summary:'合成逐条判断，仍需作者核对',issues:[],checks:[],factChecks:[],memoryChecks,provider},engine.createReviewBinding(s,id))}
 return s;
}
const workspace=s=>({format:1,serial:0,state:s,editing:{},patch:null,providerMode:'server'}),saved=()=>JSON.parse(localStorage.getItem(KEY)).state;
function mount(s=base()){cleanup();localStorage.clear();localStorage.setItem(KEY,JSON.stringify(workspace(s)));render(React.createElement(App))}
function button(action,n){return screen.getByRole('button',{name:new RegExp(`^${action}候选记忆 ${n}：`)})}
function card(n){return screen.getByRole('article',{name:new RegExp(`^候选记忆 ${n}：`)})}
const rejectAll=async()=>{for(const control of screen.getAllByRole('button',{name:/^拒绝候选记忆 /}))await user.click(control)};
async function accept(){await user.click(screen.getByRole('button',{name:'接受此版本'}));assert.notEqual(saved().drafts[0].status,'ACCEPTED');await user.click(screen.getByRole('button',{name:'确认接受正文与所选记忆'}))}
globalThis.fetch=async()=>{throw Error('Unexpected network request in synthetic memory UI test')};

// Reproduce the exact retained mismatch without rewriting its original label or quote.
const retainedText=JSON.parse(readFileSync(new URL('../eval/history/prose-pipeline-v1/completed-02.json',import.meta.url),'utf8')).text;
const retained=JSON.parse(readFileSync(new URL('../eval/history/prose-pipeline-v1/completed-03.json',import.meta.url),'utf8')).staging;
mount(base([retained[1],retained[2]],{prose:retainedText,statuses:['unsupported','supported']}));assert.equal(within(card(1)).getByLabelText('完整候选原文引用').textContent,retained[1].sourceQuote);assert.ok(card(1).textContent.includes(retained[1].label));assert.equal(button('保留',1).disabled,true);await user.click(button('拒绝',1));await user.click(button('保留',2));await accept();assert.equal(saved().events.length,1);assert.equal(saved().events[0].label,retained[2].label);assert.equal(saved().chapters[0].text,retainedText);

mount();assert.equal(within(card(1)).getByLabelText('完整候选原文引用').textContent,text.split('\n\n')[0]);assert.match(card(1).textContent,/原文不支持/);assert.match(card(2).textContent,/未知 \/ 未判断/);assert.equal(button('保留',1).disabled,true);assert.equal(button('保留',2).disabled,true);assert.equal(button('保留',3).disabled,false);assert.equal(screen.getByRole('button',{name:'接受此版本'}).disabled,true);
await user.click(button('拒绝',1));await user.click(button('保留',3));assert.equal(screen.getByRole('button',{name:'接受此版本'}).disabled,true);await user.click(button('拒绝',2));assert.match(screen.getByLabelText('候选记忆选择汇总').textContent,/已选 1 \/ 3.*0 条尚未决定/);await user.click(screen.getByRole('button',{name:'接受此版本'}));assert.match(screen.getByRole('dialog',{name:'确认接受候选稿与已选记忆'}).textContent,/1 \/ 3/);await user.click(screen.getByRole('button',{name:'返回核对'}));assert.equal(saved().events.length,0);await accept();assert.equal(saved().events.length,1);assert.equal(saved().events[0].label,entries[2].label);assert.equal(saved().chapters[0].text,text);assert.equal(saved().drafts[0].staging.length,3);

mount();await rejectAll();await accept();assert.equal(saved().drafts[0].status,'ACCEPTED');assert.equal(saved().events.length,0);assert.equal(saved().chapters[0].text,text);

mount();const opener=button('例外保留',1);await user.click(opener);let dialog=screen.getByRole('dialog',{name:'确认候选记忆例外保留'});assert.match(dialog.textContent,/作者.*例外决定，不是已验证事实/);assert.ok(dialog.textContent.includes(entries[0].label));assert.equal(within(dialog).getByLabelText('完整候选原文引用').textContent,text.split('\n\n')[0]);assert.equal(document.activeElement,within(dialog).getByLabelText('例外保留理由'));assert.equal(within(dialog).getByRole('button',{name:'确认作者例外保留'}).disabled,true);await user.type(within(dialog).getByLabelText('例外保留理由'),'   ');assert.equal(within(dialog).getByRole('button',{name:'确认作者例外保留'}).disabled,true);await user.keyboard('{Escape}');assert.equal(screen.queryByRole('dialog'),null);assert.equal(document.activeElement,opener);assert.equal(saved().drafts[0].memoryDecisions.length,0);
await user.click(opener);await user.type(screen.getByLabelText('例外保留理由'),'作者对照了下一段，明确保留跨段标签');await user.click(screen.getByRole('button',{name:'确认作者例外保留'}));assert.equal(saved().drafts[0].memoryDecisions[0].action,'override_keep');assert.match(card(1).textContent,/未经模型验证/);await user.click(button('拒绝',2));await user.click(button('拒绝',3));await accept();assert.equal(saved().events.length,1);assert.equal(saved().events[0].label,entries[0].label);

// An open override carries its original binding through edits, a same-text rereview, or import.
mount();await user.click(button('例外保留',1));await user.type(screen.getByLabelText('例外保留理由'),'这只适用于旧版本');fireEvent.click(screen.getByRole('button',{name:'编辑此稿'}));fireEvent.change(screen.getByLabelText('编辑候选稿'),{target:{value:text+'\n作者追加段落。'}});fireEvent.click(screen.getByRole('button',{name:'保存候选稿修改'}));await user.click(screen.getByRole('button',{name:'确认作者例外保留'}));assert.match(screen.getByRole('status').textContent,/变化|过期|重新|审查/);assert.equal(saved().drafts[0].memoryDecisions.length,0);assert.equal(saved().events.length,0);

mount();await user.click(button('例外保留',1));await user.type(screen.getByLabelText('例外保留理由'),'旧审阅的决定');let release,request;globalThis.fetch=(url,options)=>{request=JSON.parse(options.body);return new Promise(resolve=>{release=resolve})};fireEvent.click(screen.getByRole('button',{name:'审查候选稿'}));assert.equal(request.action,'reviewChapter');assert.deepEqual(request.input.memoryCandidates,engine.createMemoryReviewInput(base(),base().drafts[0].id));assert.equal(screen.getByRole('button',{name:'确认作者例外保留'}).disabled,true);assert.equal(button('拒绝',1).disabled,true);await act(async()=>release({ok:true,json:async()=>({output:{summary:'新的逐条审阅',issues:[],checks:[],factChecks:[],memoryChecks:[],provider}})}));await user.click(screen.getByRole('button',{name:'确认作者例外保留'}));assert.match(screen.getByRole('status').textContent,/变化|过期|重新/);assert.equal(saved().drafts[0].memoryDecisions.length,0);

mount();await user.click(button('例外保留',1));await user.type(screen.getByLabelText('例外保留理由'),'不可用于导入副本');const imported=workspace(base([], {projectId:'import-source'}));fireEvent.change(screen.getByLabelText('导入备份'),{target:{files:[{size:JSON.stringify(imported).length,text:async()=>JSON.stringify(imported)}]}});await screen.findByRole('dialog',{name:'备份导入预览'});fireEvent.click(screen.getByRole('button',{name:'确认作为新项目导入'}));assert.notEqual(saved().projectId,'memory-ui');await user.click(screen.getByRole('button',{name:'确认作者例外保留'}));assert.match(screen.getByRole('status').textContent,/变化|过期|重新|找不到/);assert.equal(saved().drafts[0].memoryDecisions.length,0);assert.equal(saved().events.length,0);

// Offline same-text structural rereview must also stale an open override before any decision exists.
let offline=engine.createProjectFromConfig({projectId:'offline-rereview'});offline=engine.stageProviderDraft(offline,{text,provider:{id:'offline-template',isLive:false},context:engine.getContext(offline),staging:[{label:entries[0].label,sourceQuote:text.split('\n\n')[0]}]},'ch1');offline=engine.reviewDraft(offline,offline.drafts[0].id);
mount(offline);let offlineRequests=0;globalThis.fetch=async()=>{offlineRequests++;throw Error('Offline structural review must not call a model')};assert.equal(saved().drafts[0].memoryDecisions.length,0);assert.equal(saved().drafts[0].modelReview,null);await user.click(button('例外保留',1));await user.type(screen.getByLabelText('例外保留理由'),'仅确认打开窗口时的离线审阅');const beforeOfflineReview=saved().drafts[0];fireEvent.click(screen.getByRole('button',{name:'审查候选稿'}));const afterOfflineReview=saved().drafts[0];assert.equal(offlineRequests,0);assert.equal(afterOfflineReview.text,beforeOfflineReview.text);assert.equal(afterOfflineReview.revision,beforeOfflineReview.revision);assert.ok(afterOfflineReview.memoryReviewEpoch>beforeOfflineReview.memoryReviewEpoch);assert.equal(afterOfflineReview.memoryDecisions.length,0);assert.equal(afterOfflineReview.modelReview,null);await user.click(screen.getByRole('button',{name:'确认作者例外保留'}));assert.match(screen.getByRole('status').textContent,/变化|过期|重新/);assert.equal(saved().drafts[0].memoryDecisions.length,0);assert.equal(saved().events.length,0);

// A final acceptance confirmation is also bound to the exact author selections and state.
mount();await rejectAll();await user.click(screen.getByRole('button',{name:'接受此版本'}));fireEvent.click(button('保留',3));await user.click(screen.getByRole('button',{name:'确认接受正文与所选记忆'}));assert.match(screen.getByRole('status').textContent,/记忆选择已变化/);assert.notEqual(saved().drafts[0].status,'ACCEPTED');assert.equal(saved().events.length,0);

// Successful empty extraction differs visibly from extraction failure and permits zero-memory acceptance.
mount(base([]));assert.match(screen.getByLabelText('无候选记忆').textContent,/提取成功 · 返回 0 条/);await accept();assert.equal(saved().events.length,0);let failed=engine.beginMemoryExtraction(base([]),base([]).drafts[0].id);failed=engine.markExtractionFailure(failed,failed.drafts[0].id,engine.createExtractionBinding(failed,failed.drafts[0].id));mount(failed);assert.match(screen.getByLabelText('候选记忆提取状态').textContent,/提取未完成/);assert.equal(screen.queryByLabelText('无候选记忆'),null);assert.equal(screen.getByRole('button',{name:'接受此版本'}).disabled,true);

// Rejected failed/populated extractions are archived cancellations, never successful empty results.
for(const original of [failed,base()]){
 mount(original);if(original.drafts[0].staging.length)await user.click(button('拒绝',1));
 const prior=structuredClone(saved().drafts[0]);await user.click(screen.getByRole('button',{name:'拒绝此稿'}));const rejected=saved().drafts[0];
 assert.equal(rejected.status,'REJECTED');assert.equal(rejected.extraction.status,'cancelled');assert.equal(rejected.staging.length,0);assert.equal(saved().events.length,0);assert.deepEqual(rejected.proseVersions,prior.proseVersions);
 assert.match(screen.getByLabelText('候选记忆提取状态').textContent,/候选稿已拒绝.*提取已取消.*归档/);assert.ok(screen.getByLabelText('候选记忆已归档'));assert.equal(screen.queryByLabelText('无候选记忆'),null);assert.doesNotMatch(screen.getByLabelText('候选记忆提取状态').textContent,/已提取|提取成功/);
 const archive=rejected.memoryArchives.findLast(entry=>entry.reason==='draft_rejected');assert.ok(archive);assert.deepEqual(archive.candidates,prior.staging);assert.equal(archive.extractionSnapshot.status,prior.extraction.status);assert.deepEqual(archive.decisions,prior.memoryDecisions);
 cleanup();render(React.createElement(App));assert.equal(screen.queryByLabelText('无候选记忆'),null);assert.match(screen.getByLabelText('候选记忆提取状态').textContent,/候选稿已拒绝/);
}

// Re-extraction drops all decisions; cancellation and a late old response cannot restore them.
mount();await rejectAll();let late;globalThis.fetch=()=>new Promise(resolve=>{late=resolve});await user.click(screen.getByRole('button',{name:'重新提取候选记忆'}));assert.equal(saved().drafts[0].memoryDecisions.length,0);assert.equal(saved().drafts[0].staging.length,0);await user.click(screen.getByRole('button',{name:'取消请求'}));await act(async()=>late({ok:true,json:async()=>({output:{staging:entries,reviewNotes:[],provider}})}));assert.equal(saved().drafts[0].staging.length,0);assert.equal(saved().drafts[0].extraction.status,'cancelled');cleanup();
console.log('PASS synthetic memory UI: exact quotes; cross-paragraph/multi-claim and missing-check blocks; explicit mixed/reject-all/override decisions; final confirmation; focus/Escape; busy guards; stale edit/rereview/import dialogs; empty-vs-failed extraction; re-extraction/cancel race. No browser or live calls.');
