import {test,expect} from '@playwright/test';
import {createProjectFromConfig} from '../src/domain/engine.js';
const KEY='nexusscribe.demo.v1';
const saved=page=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),KEY);
// Every provider response is fictional; all external traffic is blocked. The fetch
// shim ignores AbortSignal to prove stale-result guards even if cancellation loses a race.
async function boot(page,context,expected503=false){
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 page.on('console',message=>{if(!['warning','error'].includes(message.type()))return;const text=message.text();if(expected503&&/^Failed to load resource: the server responded with a status of 503 \(Service Unavailable\)$/.test(text)&&message.location().url.endsWith('/api/agent'))return;errors.push(text)});
 await context.route('**/*',route=>['127.0.0.1','localhost'].includes(new URL(route.request().url()).hostname)?route.continue():route.abort());
 await page.route('**/api/**',route=>route.fulfill({json:{configured:true,model:'fictional-test',callsUsed:0,maxCalls:10}}));
 const state=createProjectFromConfig({projectId:'test-A',title:'虚构灯塔',idea:'虚构的灯塔来信'});
 const other=createProjectFromConfig({projectId:'test-B',title:'虚构雨港',idea:'虚构的雨港钟声'});
 await page.addInitScript(({KEY,state,other})=>{
  if(!localStorage.getItem(KEY))localStorage.setItem(KEY,JSON.stringify({format:1,serial:0,state,editing:{},patch:null,providerMode:'server',archived:[{state:other,editing:{},patch:null}]}));
  const fetch=window.fetch;window.fetch=(url,options={})=>fetch(url,{...options,signal:undefined});
 },{KEY,state,other});
 const calls=[];await page.route('**/api/agent',route=>new Promise(resolve=>calls.push({route,resolve})));
 await page.goto('/');await expect(page).toHaveTitle('NexusScribe · 雾港来信');expect(new URL(page.url()).hostname).toBe('127.0.0.1');
 await page.getByRole('navigation',{name:'章节'}).getByRole('button').first().click();
 await expect(page.getByRole('heading',{level:1})).toBeVisible();await expect(page.locator('vite-error-overlay')).toHaveCount(0);
 return {calls,errors};
}
async function release(call,text='虚构候选正文',usage){await call.route.fulfill({json:{output:{text,chapterId:'ch1',staging:[],provider:{id:'fictional-test',isLive:true,...(usage?{usage}:{})}}}});call.resolve()}
async function capture(page,info,name){await page.getByLabel('模型任务状态').scrollIntoViewIfNeeded();const path=info.outputPath(name+'.png');await page.screenshot({path,animations:'disabled'});await info.attach(name,{path,contentType:'image/png'});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)}

test('duplicate click, cancel, new request, ignored-abort late result, exact usage',async({page,context},info)=>{
 const {calls,errors}=await boot(page,context);const generate=page.getByRole('button',{name:'生成当前章'});
 await generate.dblclick();await expect.poll(()=>calls.length).toBe(1);
 await expect(page.getByLabel('模型任务状态')).toContainText('输入 tokens：未知');await capture(page,info,'waiting');
 await page.getByRole('button',{name:'取消请求'}).click();await expect(page.getByLabel('模型任务状态')).toContainText('迟到结果不会采用');await capture(page,info,'cancelled');
 await generate.click();await expect.poll(()=>calls.length).toBe(2);await release(calls[0],'迟到旧稿');await expect(page.getByRole('button',{name:'取消请求'})).toBeVisible();expect((await saved(page)).state.drafts).toHaveLength(0);
 await release(calls[1],'第二次的虚构正文',{promptTokens:12,completionTokens:7,totalTokens:19});await expect(page.getByLabel('模型任务状态')).toContainText('总计 tokens：19');await expect(page.getByLabel('模型任务状态')).toContainText('推理 tokens：未知');expect((await saved(page)).state.drafts[0].text).toBe('第二次的虚构正文');await capture(page,info,'success-usage');expect(calls).toHaveLength(2);expect(errors).toEqual([]);
});
test('switching projects rejects the late generation',async({page,context})=>{
 const {calls,errors}=await boot(page,context);await page.getByRole('button',{name:'生成当前章'}).click();await expect.poll(()=>calls.length).toBe(1);await page.getByLabel('切换项目').selectOption('test-B');await release(calls[0]);await expect(page.getByLabel('模型任务状态')).toContainText('不会采用');const data=await saved(page);expect(data.state.projectId).toBe('test-B');expect(data.state.drafts).toHaveLength(0);expect(data.archived.find(p=>p.state.projectId==='test-A').state.drafts).toHaveLength(0);expect(errors).toEqual([]);
});
test('author edits during a request remain intact when result arrives',async({page,context})=>{
 const {calls,errors}=await boot(page,context);await page.getByRole('button',{name:'生成当前章'}).click();await expect.poll(()=>calls.length).toBe(1);await page.getByLabel('章节正文').fill('作者的虚构编辑不会丢失');const before=await saved(page);await release(calls[0]);await expect(page.getByLabel('模型任务状态')).toContainText('返回结果未采用');expect((await saved(page)).editing).toEqual(before.editing);expect((await saved(page)).state).toEqual(before.state);await expect(page.getByLabel('章节正文')).toHaveValue('作者的虚构编辑不会丢失');expect(errors).toEqual([]);
});
test('failure preserves all story data without retry; reload does not restart',async({page,context},info)=>{
 const {calls,errors}=await boot(page,context,true);await page.getByRole('button',{name:'生成当前章'}).click();await expect.poll(()=>calls.length).toBe(1);await page.getByLabel('章节正文').fill('失败时也保留的虚构正文');const before=await saved(page);await calls[0].route.fulfill({status:503,json:{error:{message:'虚构测试失败'}}});calls[0].resolve();await expect(page.getByLabel('模型任务状态')).toContainText('手动重试');expect(await saved(page)).toEqual(before);await capture(page,info,'failure');expect(calls).toHaveLength(1);await page.reload();await page.getByRole('navigation',{name:'章节'}).getByRole('button').first().click();await expect(page.getByLabel('章节正文')).toHaveValue('失败时也保留的虚构正文');await expect(page.getByRole('button',{name:'取消请求'})).toHaveCount(0);expect(calls).toHaveLength(1);await page.getByLabel('章节正文').fill(before.state.chapters[0].text);await page.getByRole('button',{name:'生成当前章'}).click();await expect.poll(()=>calls.length).toBe(2);await release(calls[1],'手动重试后的虚构候选稿');await expect(page.getByLabel('模型任务状态')).toContainText('结果已返回');expect((await saved(page)).state.drafts).toHaveLength(1);expect(calls).toHaveLength(2);expect(errors).toEqual([]);
});
test('wizard close and reopen ignores old interview results',async({page,context})=>{
 const {calls,errors}=await boot(page,context);await page.getByRole('button',{name:'新建故事'}).click();await page.getByLabel(/你的故事灵感/).fill('虚构灯塔在雨中发来消息');await page.getByRole('button',{name:'聊聊这个故事'}).click();await expect.poll(()=>calls.length).toBe(1);await page.getByRole('button',{name:'关闭新建故事'}).click();await calls[0].route.fulfill({json:{output:{questions:[{key:'tone',title:'迟到的虚构问题'}]}}});calls[0].resolve();await page.getByRole('button',{name:'新建故事'}).click();await expect(page.getByLabel(/你的故事灵感/)).toHaveValue('');await expect(page.getByText('迟到的虚构问题')).toHaveCount(0);expect(calls).toHaveLength(1);expect(errors).toEqual([]);
});
