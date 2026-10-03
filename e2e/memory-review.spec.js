import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import * as engine from '../src/domain/engine.js';

// Browser tests consume retained fictional prose; all semantic judgments here are mocks.
const retainedProse=JSON.parse(readFileSync(new URL('../eval/history/prose-pipeline-v1/completed-02.json',import.meta.url),'utf8'));
const retainedExtraction=JSON.parse(readFileSync(new URL('../eval/history/prose-pipeline-v1/completed-03.json',import.meta.url),'utf8'));
const provider={id:'browser-mock',isLive:true},KEY='nexusscribe.demo.v1';
const text='阿澄把木钥匙放在桌上。\n她第二天才打开北门。\n远处的铜铃响了一声。';
const entries=[{label:'阿澄把木钥匙放在桌上，然后打开北门。',sourceParagraphIndex:0},{label:'她当天打开北门并找到了失踪的朋友。',sourceParagraphIndex:1},{label:'远处的铜铃响了一声。',sourceParagraphIndex:2}];
function fixture({prose=text,staging=entries,statuses=['unsupported',null,'supported'],projectId='memory-browser'}={}){
 let s=engine.createProjectFromConfig({projectId,title:'逐条记忆审阅'});s=engine.stageProseDraft(s,{text:prose,provider,context:engine.getContext(s)},'ch1');const id=s.drafts[0].id;s=engine.beginMemoryExtraction(s,id);s=engine.attachMemoryExtraction(s,id,{staging,provider,reviewNotes:[]},engine.createExtractionBinding(s,id));s=engine.reviewDraft(s,id);s=engine.attachSemanticReview(s,id,{summary:'合成测试审阅，非语义精度证据',issues:[],checks:[],factChecks:[],memoryChecks:engine.createMemoryReviewInput(s,id).flatMap((item,i)=>statuses[i]?[{candidateId:item.candidateId,status:statuses[i],explanation:statuses[i]==='supported'?'完整原文支持该标签':'标签包含所引段落未支持的另一项主张'}]:[]),provider},engine.createReviewBinding(s,id));return s;
}
const workspace=state=>({format:1,serial:0,state,editing:{},patch:null,providerMode:'server'});
const candidate=(page,n)=>page.getByRole('article',{name:new RegExp(`^候选记忆 ${n}：`)});
const control=(page,action,n)=>page.getByRole('button',{name:new RegExp(`^${action}候选记忆 ${n}：`)});
const state=page=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)).state,KEY);
async function mount(page,s=fixture()){await page.addInitScript(({key,data})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(data))},{key:KEY,data:workspace(s)});await page.goto('/');await expect(page).toHaveTitle('NexusScribe · 雾港来信');await expect(page.getByLabel('候选记忆逐条选择')).toBeVisible();await expect(page.locator('vite-error-overlay')).toHaveCount(0)}
function health(page){const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});return errors}
async function evidence(page,testInfo,label){expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);const path=testInfo.outputPath(`${label}.png`);await page.screenshot({path,fullPage:true,animations:'disabled'});await testInfo.attach(label,{path,contentType:'image/png'})}
async function accept(page){await page.getByRole('button',{name:'接受此版本'}).click();await expect(page.getByRole('dialog',{name:'确认接受候选稿与已选记忆'})).toBeVisible();expect((await state(page)).drafts[0].status).not.toBe('ACCEPTED');await page.getByRole('button',{name:'确认接受正文与所选记忆'}).click();expect((await state(page)).drafts[0].status).toBe('ACCEPTED')}
test.beforeEach(async({page,context})=>{await context.route('**/*',async route=>{const url=new URL(route.request().url());if(['127.0.0.1','localhost'].includes(url.hostname))await route.continue();else await route.abort('blockedbyclient')});await page.route('**/api/**',route=>route.fulfill({status:503,json:{error:{message:'未配置外部模型，禁止真实请求'}}}))});

test('retained cross-paragraph label is blocked; reject it and keep the separately supported reply',async({page},testInfo)=>{
 const errors=health(page),original=retainedExtraction.staging[1],reply=retainedExtraction.staging[2];await mount(page,fixture({prose:retainedProse.text,staging:[original,reply],statuses:['unsupported','supported']}));
 await expect(candidate(page,1).getByLabel('完整候选原文引用')).toHaveText(original.sourceQuote);await expect(candidate(page,1)).toContainText(original.label);await expect(control(page,'保留',1)).toBeDisabled();await expect(page.getByRole('button',{name:'接受此版本'})).toBeDisabled();await evidence(page,testInfo,'retained-label-full-evidence');
 await control(page,'拒绝',1).click();await control(page,'保留',2).click();await expect(page.getByLabel('候选记忆选择汇总')).toContainText('已选 1 / 2');await accept(page);const s=await state(page);expect(s.events).toHaveLength(1);expect(s.events[0].label).toBe(reply.label);expect(s.events[0].source.quote).toBe(reply.sourceQuote);expect(s.chapters[0].text).toBe(retainedProse.text);expect(s.drafts[0].staging).toHaveLength(2);await page.reload();await expect(page.getByText('作者已拒绝 · 不会提交')).toBeVisible();expect(errors).toEqual([]);
});

test('multiclaim and missing judgments require explicit choices; rejecting all still accepts prose',async({page},testInfo)=>{
 const errors=health(page);await mount(page);await expect(control(page,'保留',1)).toBeDisabled();await expect(control(page,'保留',2)).toBeDisabled();await expect(candidate(page,2)).toContainText('未知 / 未判断');await control(page,'拒绝',1).click();await control(page,'拒绝',2).click();await expect(page.getByRole('button',{name:'接受此版本'})).toBeDisabled();await control(page,'拒绝',3).click();await page.getByRole('button',{name:'接受此版本'}).click();const dialog=page.getByRole('dialog',{name:'确认接受候选稿与已选记忆'});await expect(dialog).toContainText('提交 0 条候选记忆');await expect(dialog.getByRole('button',{name:'返回核对'})).toBeFocused();await evidence(page,testInfo,'reject-all-confirmation');await dialog.getByRole('button',{name:'返回核对'}).click();expect((await state(page)).events).toHaveLength(0);await accept(page);expect((await state(page)).events).toHaveLength(0);expect((await state(page)).chapters[0].text).toBe(text);expect(errors).toEqual([]);
});

test('author override requires a reason, traps focus, supports Escape, and remains visibly unverified',async({page},testInfo)=>{
 const errors=health(page);await mount(page);await control(page,'例外保留',1).click();const dialog=page.getByRole('dialog',{name:'确认候选记忆例外保留'});await expect(dialog).toContainText('不是已验证事实');await expect(dialog.getByLabel('完整候选原文引用')).toHaveText(text.split('\n')[0]);await expect(dialog.getByLabel('例外保留理由')).toBeFocused();await expect(dialog.getByRole('button',{name:'确认作者例外保留'})).toBeDisabled();await dialog.getByLabel('例外保留理由').fill('   ');await expect(dialog.getByRole('button',{name:'确认作者例外保留'})).toBeDisabled();await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(control(page,'例外保留',1)).toBeFocused();expect((await state(page)).drafts[0].memoryDecisions).toHaveLength(0);
 await control(page,'例外保留',1).click();await dialog.getByLabel('例外保留理由').fill('作者结合下一段明确保留，知晓单段引用不足');await dialog.getByRole('button',{name:'确认作者例外保留'}).focus();await page.keyboard.press('Tab');await expect(dialog.getByRole('button',{name:'关闭确认候选记忆例外保留'})).toBeFocused();await page.keyboard.press('Shift+Tab');await expect(dialog.getByRole('button',{name:'确认作者例外保留'})).toBeFocused();await evidence(page,testInfo,'override-full-evidence-and-reason');await dialog.getByRole('button',{name:'确认作者例外保留'}).click();await expect(candidate(page,1)).toContainText('未经模型验证');await control(page,'拒绝',2).click();await control(page,'拒绝',3).click();await accept(page);const s=await state(page);expect(s.events).toHaveLength(1);expect(s.drafts[0].memoryDecisions[0].action).toBe('override_keep');expect(errors).toEqual([]);
});

for(const mutation of ['edit','rereview','import'])test(`an open override cannot authorize state after ${mutation}`,async({page},testInfo)=>{
 const errors=health(page);await mount(page);await control(page,'例外保留',1).click();await page.getByLabel('例外保留理由').fill('仅对打开时的版本有效');
 // Deliberately trigger background controls to simulate an external state transition while a dialog remains open.
 if(mutation==='edit'){await page.getByRole('button',{name:'编辑此稿'}).evaluate(el=>el.click());await page.getByLabel('编辑候选稿').evaluate((el,value)=>{Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}))},text+'\n追加版本');await page.getByRole('button',{name:'保存候选稿修改'}).evaluate(el=>el.click());}
 if(mutation==='rereview'){let release,request;const pending=new Promise(resolve=>{release=resolve});await page.route('**/api/agent',async route=>{request=route.request().postDataJSON();await pending;await route.fulfill({json:{output:{summary:'重新审阅',issues:[],checks:[],factChecks:[],memoryChecks:[],provider}}})});await page.getByRole('button',{name:'审查候选稿'}).evaluate(el=>el.click());await expect.poll(()=>request?.action).toBe('reviewChapter');expect(request.input.memoryCandidates).toHaveLength(3);await expect(page.getByRole('button',{name:'确认作者例外保留'})).toBeDisabled();await expect(control(page,'拒绝',1)).toBeDisabled();release();await expect(page.getByLabel('模型任务状态')).toContainText('结果已返回');}
 if(mutation==='import'){await page.getByLabel('导入备份').setInputFiles({name:'fictional-import.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(workspace(fixture({projectId:'import-source'}))))});await page.getByRole('button',{name:'确认作为新项目导入'}).click();expect((await state(page)).projectId).not.toBe('memory-browser');}
 await page.getByRole('button',{name:'确认作者例外保留'}).click();await expect(page.getByRole('status')).toContainText(/变化|过期|重新|找不到|审查/);const s=await state(page);expect(s.drafts[0].memoryDecisions).toHaveLength(0);expect(s.events).toHaveLength(0);await evidence(page,testInfo,`stale-override-${mutation}`);expect(errors).toEqual([]);
});

test('successful empty extraction is distinct from a failed extraction',async({page},testInfo)=>{
 const errors=health(page);await mount(page,fixture({staging:[],statuses:[]}));await expect(page.getByLabel('无候选记忆')).toContainText('提取成功 · 返回 0 条');await accept(page);expect((await state(page)).events).toHaveLength(0);await evidence(page,testInfo,'empty-extraction-accepted');expect(errors).toEqual([]);
});


test('failed extraction keeps prose and cannot be mistaken for successful zero-memory output',async({page},testInfo)=>{
 const errors=health(page);let failed=fixture({staging:[],statuses:[]});const id=failed.drafts[0].id;failed=engine.beginMemoryExtraction(failed,id);failed=engine.markExtractionFailure(failed,id,engine.createExtractionBinding(failed,id));await mount(page,failed);await expect(page.getByLabel('候选记忆提取状态')).toContainText('提取未完成');await expect(page.getByLabel('无候选记忆')).toHaveCount(0);await expect(page.getByRole('button',{name:'接受此版本'})).toBeDisabled();expect((await state(page)).drafts[0].text).toBe(text);await evidence(page,testInfo,'extraction-failed');expect(errors).toEqual([]);
});


for(const extraction of ['failed','populated'])test(`rejecting ${extraction} extraction shows archived cancellation, never successful empty output`,async({page},testInfo)=>{
 const errors=health(page);let initial=fixture(extraction==='failed'?{staging:[],statuses:[]}:{});const id=initial.drafts[0].id;
 if(extraction==='failed'){initial=engine.beginMemoryExtraction(initial,id);initial=engine.markExtractionFailure(initial,id,engine.createExtractionBinding(initial,id))}
 await mount(page,initial);if(extraction==='populated')await control(page,'拒绝',1).click();const prior=(await state(page)).drafts[0];await page.getByRole('button',{name:'拒绝此稿'}).click();
 await expect(page.getByLabel('候选记忆提取状态')).toContainText('候选稿已拒绝');await expect(page.getByLabel('候选记忆提取状态')).toContainText('提取已取消');await expect(page.getByLabel('候选记忆已归档')).toBeVisible();await expect(page.getByLabel('无候选记忆')).toHaveCount(0);await expect(page.getByLabel('候选记忆提取状态')).not.toContainText('已提取');
 const s=await state(page),draft=s.drafts[0],archive=draft.memoryArchives.findLast(entry=>entry.reason==='draft_rejected');expect(draft.status).toBe('REJECTED');expect(draft.extraction.status).toBe('cancelled');expect(draft.staging).toHaveLength(0);expect(s.events).toHaveLength(0);expect(draft.proseVersions).toEqual(prior.proseVersions);expect(archive.candidates).toEqual(prior.staging);expect(archive.extractionSnapshot.status).toBe(prior.extraction.status);expect(archive.decisions).toEqual(prior.memoryDecisions);
 await page.reload();await expect(page.getByLabel('候选记忆提取状态')).toContainText('候选稿已拒绝');await expect(page.getByLabel('无候选记忆')).toHaveCount(0);await evidence(page,testInfo,`rejected-${extraction}-archive`);expect(errors).toEqual([]);
});


test('offline same-text structural rereview invalidates an open override before any decision exists',async({page},testInfo)=>{
 const errors=health(page);let initial=engine.createProjectFromConfig({projectId:'offline-rereview-browser'});initial=engine.stageProviderDraft(initial,{text,provider:{id:'offline-template',isLive:false},context:engine.getContext(initial),staging:[{label:entries[0].label,sourceQuote:text.split('\n')[0]}]},'ch1');initial=engine.reviewDraft(initial,initial.drafts[0].id);let requests=0;page.on('request',request=>{if(new URL(request.url()).pathname==='/api/agent')requests++});await mount(page,initial);const prior=(await state(page)).drafts[0];expect(prior.memoryDecisions).toHaveLength(0);expect(prior.modelReview).toBeNull();await control(page,'例外保留',1).click();await page.getByLabel('例外保留理由').fill('只同意打开窗口时的离线审阅');await page.getByRole('button',{name:'审查候选稿'}).evaluate(el=>el.click());await expect.poll(async()=>(await state(page)).drafts[0].memoryReviewEpoch).toBeGreaterThan(prior.memoryReviewEpoch);
 const current=(await state(page)).drafts[0];expect(current.text).toBe(prior.text);expect(current.revision).toBe(prior.revision);expect(current.memoryDecisions).toHaveLength(0);expect(current.modelReview).toBeNull();await page.getByRole('button',{name:'确认作者例外保留'}).click();await expect(page.getByRole('status')).toContainText(/变化|过期|重新/);expect((await state(page)).drafts[0].memoryDecisions).toHaveLength(0);expect((await state(page)).events).toHaveLength(0);expect(requests).toBe(0);await evidence(page,testInfo,'offline-rereview-stale-override');expect(errors).toEqual([]);
});
