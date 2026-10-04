// Browser plugin not available. Hosted Playwright validates the actual UI.
// ALL /api/** requests are intercepted; all non-loopback traffic is blocked.
// No live service, secret, provider call, model-quality or billing claim.
import {test, expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
import {createProjectConfig, getInterviewQuestions} from '../src/authoring/index.js';
import * as engine from '../src/domain/engine.js';
import {KEY, parseBackup} from '../src/storage.js';
import {INPUT, MANUAL, GENERATED, REVISION, AUTHOR_EDIT, NEXT, CONFLICT, demoStart, demoCanonBlocked} from '../demo/fictional-project.mjs';

const provider = {id:'offline-acceptance-mock', label:'离线合成回放 · 非真实模型', model:'synthetic-only', isLive:true};
const button = (page, name) => page.getByRole('button', {name, exact:true});
const stored = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), KEY);
const state = async page => (await stored(page)).state;
const draft = async page => (await state(page)).drafts.at(-1);
const review = facts => ({summary:'离线合成审阅，只验证流程门禁，不证明语义正确', issues:[], checks:[], factChecks:facts.map(f=>({factId:f.id, recordVersion:f.recordVersion, status:'contradiction', explanation:'固定合成冲突结果，不是模型判断', sourceQuote:CONFLICT}))});

async function boot(page, context) {
  const actions = [], errors = [], external = [];
  let responder = () => {throw Error('Unexpected synthetic action');};
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', e => {if (e.type()==='error') errors.push(e.text());});
  await context.route('**/*', route => {
    if (['127.0.0.1','localhost'].includes(new URL(route.request().url()).hostname)) return route.continue();
    external.push(route.request().url()); return route.abort('blockedbyclient');
  });
  await page.route('**/api/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    if (path==='/api/status' && request.method()==='GET') return route.fulfill({json:{configured:true, liveEnabled:true, model:'OFFLINE SYNTHETIC REPLAY', callsUsed:actions.length, maxCalls:30}});
    expect(path).toBe('/api/agent'); expect(request.method()).toBe('POST');
    const call = request.postDataJSON(); actions.push(call);
    return route.fulfill({json:{output:{...await responder(call), provider}}});
  });
  await page.goto('/');
  await expect(page).toHaveURL('http://127.0.0.1:5173/');
  await expect(page).toHaveTitle('NexusScribe · 雾港来信');
  await expect(page.getByLabel('章节正文')).toBeVisible();
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  return {actions, errors, external, respond:fn=>{responder=fn;}};
}
async function modelMode(page) {
  await button(page, '模型运行方式').click();
  await button(page, '检查服务连接').click();
  await button(page, '使用真实模型').click();
}
async function upload(page, data) {
  await page.getByLabel('导入备份', {exact:true}).setInputFiles({name:'fictional-demo.json', mimeType:'application/json', buffer:Buffer.from(JSON.stringify(data))});
  await expect(page.getByRole('dialog', {name:'备份导入预览'})).toBeVisible();
  await button(page, '确认作为新项目导入').click();
}
async function exportBackup(page, name='导出项目备份') {
  const download = page.waitForEvent('download');
  await button(page, name).click();
  const stream = await (await download).createReadStream(); let raw='';
  for await (const chunk of stream) raw+=chunk;
  return parseBackup(raw);
}
async function capture(page, info, name, locator) {
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  if (locator) await locator.scrollIntoViewIfNeeded();
  const path=info.outputPath(name+'.png');
  if (locator) await locator.screenshot({path, animations:'disabled'});
  else await page.screenshot({path, fullPage:false, animations:'disabled'});
  await info.attach(name, {path, contentType:'image/png'});
}
async function receipt(info, mock, outcome, extra={}) {
  expect(mock.errors).toEqual([]); expect(mock.external).toEqual([]);
  await writeFile(info.outputPath('acceptance-receipt.json'), JSON.stringify({schema:1, mode:'offline-synthetic-or-author-only', liveProviderCalls:0, syntheticActions:mock.actions.map(c=>c.action), outcome, project:info.project.name, ...extra},null,2)+'\n');
}
async function accept(page) {
  await button(page, '接受此版本').click();
  await button(page, '确认接受正文与所选记忆').click();
  await expect.poll(async()=>(await state(page)).chapters[0].status).toBe('ACCEPTED');
}
async function acceptanceBlocked(page) {
  const before=await stored(page);
  if (await button(page, '接受此版本').isEnabled()) await button(page, '接受此版本').click();
  await expect(page.getByRole('dialog',{name:'确认接受候选稿与已选记忆'})).toHaveCount(0);
  expect(await stored(page)).toEqual(before);
}

test('complete synthetic writing journey keeps author control through next context', async({page,context},info)=>{
  const mock=await boot(page,context);
  mock.respond(call=>{
    switch(call.action) {
      case 'interview': return {questions:getInterviewQuestions(call.input.input), summary:'离线固定访谈，不是真实模型'};
      case 'planStory': {const config=createProjectConfig(call.input.input); return {contract:config.contract,outline:config.outline};}
      case 'generateProse': return {text:mock.actions.filter(c=>c.action==='generateProse').length===1?GENERATED:NEXT, chapterId:call.input.project.outline[call.input.chapterIndex].id};
      case 'reviseProse': expect(call.input.text).toBe(GENERATED); return {text:REVISION,chapterId:call.input.chapterId};
      case 'reviewChapter': expect(call.input.text).toBe(AUTHOR_EDIT); return review([]);
      default: throw Error(`Unplanned action: ${call.action}`);
    }
  });
  await modelMode(page); // A synthetic /api/status reply, never a gateway/provider connection.
  await button(page,'新建故事').click();
  await page.getByLabel(/你的故事灵感/).fill(INPUT.idea);
  await page.getByLabel(/给故事起个名字/).fill(INPUT.title);
  await button(page,'聊聊这个故事').click();
  await page.getByLabel(/谁来经历这个故事/).fill(INPUT.protagonist);
  await page.getByLabel(/你希望读者最后留下什么感觉/).fill(INPUT.tone);
  await page.getByText('补充主角愿望与创作边界（可选）').click();
  await page.getByLabel('主角愿望',{exact:true}).fill(INPUT.goal);
  await page.getByLabel('不希望出现的内容',{exact:true}).fill(INPUT.boundaries);
  await button(page,'查看故事约定').click();
  await capture(page,info,'synthetic-01-story-agreement',page.locator('.ns-wizard'));
  await button(page,'确认约定，开始创作').click();
  await button(page,'生成当前章').click();
  await expect.poll(async()=>(await draft(page))?.text).toBe(GENERATED);
  await acceptanceBlocked(page);
  await page.getByLabel('改稿意见',{exact:true}).fill('先明确拆信，才能看见信纸；保留日期和查问动作。');
  await button(page,'按意见生成改稿建议 · 1 次模型请求').click();
  await expect(page.getByLabel('改稿建议正文',{exact:true})).toHaveText(REVISION);
  await button(page,'核对并采用改稿建议').click();
  await page.getByLabel('待采用正文',{exact:true}).fill(AUTHOR_EDIT);
  await capture(page,info,'synthetic-02-author-edit',page.getByRole('dialog',{name:'确认采用改稿建议'}));
  await button(page,'确认采用并使旧审阅失效').click();
  const changed=await draft(page);
  expect(changed.revisionProposals[0].result.text).toBe(REVISION);
  expect(changed.revisionProposals[0].adoption.authority).toBe('explicit_author_edit');
  expect(changed.text).toBe(AUTHOR_EDIT);
  expect(changed.modelReview).toBeNull();
  await button(page,'不提取记忆 · 仅保留正文').click();
  await capture(page,info,'synthetic-03-explicit-skip',page.getByRole('dialog',{name:'确认不提取候选记忆'}));
  await button(page,'确认不提取记忆').click();
  await acceptanceBlocked(page);
  await button(page,'审查候选稿').click();
  await expect.poll(async()=>Boolean((await draft(page)).modelReview)).toBe(true);
  await accept(page);
  expect((await state(page)).events).toEqual([]);
  expect((await state(page)).chapters[0].text).toBe(AUTHOR_EDIT);
  await capture(page,info,'synthetic-04-accepted-prose',page.getByLabel('章节正文'));
  const backup=await exportBackup(page);
  await writeFile(info.outputPath('accepted-backup.json'),JSON.stringify(backup,null,2)+'\n');
  await page.reload();
  await expect(page.getByLabel('章节正文')).toHaveValue(AUTHOR_EDIT);
  await page.getByRole('navigation',{name:'章节'}).getByRole('button').nth(1).click();
  await button(page,'生成当前章').click();
  await expect.poll(async()=>(await draft(page)).text).toBe(NEXT);
  const last=mock.actions.at(-1);
  expect(last.input.context.sources.find(s=>s.role==='accepted_manuscript').text).toBe(AUTHOR_EDIT);
  expect(last.input.context.events).toEqual([]);
  expect(mock.actions.map(c=>c.action)).toEqual(['interview','planStory','generateProse','reviseProse','reviewChapter','generateProse']);
  await capture(page,info,'synthetic-05-next-context');
  await receipt(info,mock,'author-edited prose accepted; exact prose reaches next chapter; no extraction', {acceptedText:AUTHOR_EDIT,nextContext:last.input.context});
});

test('offline sample import allows zero-call handwritten acceptance and backup roundtrip',async({page,context},info)=>{
  const mock=await boot(page,context);
  await upload(page,demoStart());
  await expect(page.getByLabel('章节正文')).toHaveValue(MANUAL);
  await button(page,'作者分类保存 · 不调用模型').click();
  await button(page,'仅局部表达，不更新设定').click();
  await button(page,'确认并提交状态').click();
  await button(page,'准备手写稿 · 不提取记忆').click();
  await acceptanceBlocked(page);
  await button(page,'审查候选稿').click();
  await button(page,'接受此版本').click();
  await capture(page,info,'author-only-acceptance',page.getByRole('dialog',{name:'确认接受候选稿与已选记忆'}));
  await button(page,'确认接受正文与所选记忆').click();
  const original=(await state(page)).projectId,backup=await exportBackup(page);
  expect(backup.state.chapters[0].status).toBe('ACCEPTED');
  expect(backup.state.drafts.at(-1).modelReview).toBeNull();
  expect(backup.state.events).toEqual([]);
  await writeFile(info.outputPath('accepted-backup.json'),JSON.stringify(backup,null,2)+'\n');
  await upload(page,backup);
  expect((await state(page)).projectId).not.toBe(original);
  await page.reload();
  await expect(page.getByLabel('章节正文')).toHaveValue(MANUAL);
  expect((await state(page)).chapters[0].status).toBe('ACCEPTED');
  expect(engine.getContext(await state(page)).sources.find(s=>s.role==='accepted_manuscript').text).toBe(MANUAL);
  expect(mock.actions).toEqual([]);
  await receipt(info,mock,'manual acceptance, export, import as new project and reload preserved exact text');
});

test('Canon stays blocked offline and after a synthetic contradiction review',async({page,context},info)=>{
  const mock=await boot(page,context);
  await upload(page,demoCanonBlocked());
  const initial=await state(page);
  await button(page,'准备手写稿 · 不提取记忆').click();
  await button(page,'审查候选稿').click();
  await acceptanceBlocked(page);
  expect(mock.actions).toEqual([]);
  mock.respond(call=>{expect(call.action).toBe('reviewChapter');return review(initial.facts);});
  await modelMode(page);
  await button(page,'审查候选稿').click();
  await expect(page.getByLabel('已确认设定逐条审阅')).toContainText('冲突');
  await acceptanceBlocked(page);
  expect((await state(page)).facts).toEqual(initial.facts);
  expect((await state(page)).chapters[0].status).not.toBe('ACCEPTED');
  await capture(page,info,'synthetic-canon-blocked',page.getByLabel('已确认设定逐条审阅'));
  await receipt(info,mock,'Canon unchanged; conflict not accepted or overridden');
});

test('storage failure keeps author edits exportable and recoverable',async({page,context},info)=>{
  const mock=await boot(page,context);
  await upload(page,demoStart());
  await page.evaluate(key=>{window.acceptanceSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===key)throw new DOMException('Synthetic demo quota failure','QuotaExceededError');return window.acceptanceSet.call(this,k,v);};},KEY);
  const edited=MANUAL+'\n\n这是演示中的未保存改文。';
  await page.getByLabel('章节正文').fill(edited);
  await expect(page.getByRole('alert')).toContainText('尚未安全保存');
  await capture(page,info,'synthetic-recovery-unsaved');
  const backup=await exportBackup(page,'导出当前内容（含暂存编辑）');
  expect(Object.values(backup.editing)).toContain(edited);
  await writeFile(info.outputPath('unsaved-recovery-backup.json'),JSON.stringify(backup,null,2)+'\n');
  await page.evaluate(()=>{Storage.prototype.setItem=window.acceptanceSet;});
  await button(page,'重试保存').click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.reload();
  await expect(page.getByLabel('章节正文')).toHaveValue(edited);
  expect(mock.actions).toEqual([]);
  await receipt(info,mock,'quota failure retained edits; exported in-memory backup; deliberate retry and reload recovered them');
});
