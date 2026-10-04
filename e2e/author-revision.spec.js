// Hosted desktop/mobile browser coverage. Every API endpoint is synthetic and
// nonlocal traffic is blocked. No paid model call or literary-quality claim.
import {test, expect} from '@playwright/test';
import * as engine from '../src/domain/engine.js';
import {getRevisionSource} from '../src/domain/author-revision.js';
import {KEY, parseBackup} from '../src/storage.js';

const BEFORE = '  陆遥展开信纸。🙂\n\n“别去钟楼。”她轻声读出这句话。\n';
const AFTER = '  陆遥展开信纸。\n\n纸上只有一句：“别去钟楼。”\n她把信压在杯底。🙂\n';
const INSTRUCTION = '保留警告与人物视角，删去解释，用动作结束。';
const FACT = '陆遥从未读过那封信。';
const provider = {id:'author-revision-browser-mock', isLive:true, model:'synthetic-revision', usage:{totalTokens:17}};
const BUDGET = {configured:true, liveEnabled:true, callsUsed:3, maxCalls:10};
const names = {request:'按意见生成改稿建议 · 1 次模型请求', adopt:'核对并采用改稿建议', confirm:'确认采用并使旧审阅失效', discard:'放弃此改稿建议'};
const button = (page, name) => page.getByRole('button', {name, exact:true});
const stored = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), KEY);
const state = async page => (await stored(page)).state;
const draft = async page => (await state(page)).drafts[0];
const proposal = async page => (await draft(page)).revisionProposals.at(-1);
const workspace = (state, providerMode = 'server') => ({format:1, serial:0, state, editing:{}, patch:null, providerMode});
const output = text => ({status:200, json:{output:{text, chapterId:'ch1', provider}}});
function base({reviewed = false} = {}) {
  let s = engine.createProjectFromConfig({projectId:'author-revision-browser', title:'钟楼来信', protagonist:'陆遥'});
  s = engine.saveRevision(s, 'ch1', FACT, s.chapters[0].revision);
  s = engine.commitPatch(s, engine.proposeCustomPatch(s, 'ch1', {intent:'author_fact', statement:FACT}));
  s = engine.stageProseDraft(s, {text:BEFORE, chapterId:'ch1', provider, context:engine.getContext(s)}, 'ch1');
  if (!reviewed) return s;
  const id = s.drafts[0].id;
  s = engine.beginMemoryExtraction(s, id);
  s = engine.attachMemoryExtraction(s, id, {staging:[{label:'陆遥展开信纸', sourceParagraphIndex:0}], reviewNotes:[], provider}, engine.createExtractionBinding(s, id));
  s = engine.reviewDraft(s, id);
  const fact = s.facts[0];
  s = engine.attachSemanticReview(s, id, {summary:'合成旧审阅，仅用于失效检查', issues:[], checks:[], factChecks:[{factId:fact.id, recordVersion:fact.recordVersion, status:'contradiction', explanation:'合成冲突', sourceQuote:BEFORE.split('\n')[0]}], provider}, engine.createReviewBinding(s, id));
  s = engine.resolveFactReview(s, id, {factId:fact.id, recordVersion:fact.recordVersion, action:'accept_exception', reason:'仅此候选的合成例外', reviewHash:engine.hash(JSON.stringify(s.drafts[0].modelReview))}, engine.createReviewBinding(s, id));
  const memory = engine.getMemoryReviewGate(s, id)[0];
  return engine.decideMemoryCandidate(s, id, {candidateId:memory.candidateId, action:'keep_quote', reviewHash:memory.reviewHash}, memory.binding);
}
function deferred() {let resolve; const promise = new Promise(done => {resolve = done;}); return {promise, resolve};}
async function boot(page, context, initial = base(), mode = 'server') {
  const calls = [], errors = [], external = [];
  let responder = call => call.url === '/api/status' ? {json:BUDGET} : output(AFTER);
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() !== 'error') return;
    if (/Failed to load resource: the server responded with a status of (502|503)/.test(message.text()) && message.location().url.endsWith('/api/agent')) return;
    errors.push(message.text());
  });
  await context.route('**/*', route => {
    const host = new URL(route.request().url()).hostname;
    if (['127.0.0.1','localhost'].includes(host)) return route.continue();
    external.push(route.request().url());
    return route.abort('blockedbyclient');
  });
  await page.route('**/api/**', async route => {
    const request = route.request();
    const call = {url:new URL(request.url()).pathname, method:request.method(), ...(request.postData() ? request.postDataJSON() : {})};
    calls.push(call);
    expect(['/api/status','/api/agent']).toContain(call.url);
    expect(call.method).toBe(call.url === '/api/status' ? 'GET' : 'POST');
    if (call.url === '/api/agent') expect(call.action).toBe('reviseProse');
    const answer = await responder(call);
    // A cancelled request may already have disconnected from this local route.
    try {await route.fulfill(answer);} catch (error) {if (!/closed|handled|Invalid InterceptionId/i.test(error.message)) throw error;}
  });
  await page.addInitScript(({key, data}) => {if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(data));}, {key:KEY, data:workspace(initial, mode)});
  await page.goto('/');
  await expect(page.getByLabel('章节正文')).toBeVisible();
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  return {calls, errors, external, paid:() => calls.filter(call => call.method === 'POST'), respond:fn => {responder = fn;}};
}
async function request(page) {
  await page.getByLabel('改稿意见', {exact:true}).fill(INSTRUCTION);
  await button(page, names.request).click();
  await expect.poll(async () => (await proposal(page)).status).toBe('proposed');
}
async function upload(page, backup) {
  await page.getByLabel('导入备份', {exact:true}).setInputFiles({name:'author-revision-backup.json', mimeType:'application/json', buffer:Buffer.from(JSON.stringify(backup))});
  await expect(page.getByRole('dialog', {name:'备份导入预览'})).toBeVisible();
  await button(page, '确认作为新项目导入').click();
  await expect(page.getByRole('dialog', {name:'备份导入预览'})).toHaveCount(0);
}
async function downloadCurrent(page) {
  const downloaded = page.waitForEvent('download');
  await button(page, '导出当前内容（含暂存编辑）').click();
  const stream = await (await downloaded).createReadStream();
  let raw = '';
  for await (const chunk of stream) raw += chunk;
  return parseBackup(raw);
}
async function capture(page, info, locator, name) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await locator.scrollIntoViewIfNeeded();
  const path = info.outputPath(name+'.png');
  await locator.screenshot({path, animations:'disabled'});
  await info.attach(name, {path, contentType:'image/png'});
}
function noUnexpected(mock) {expect(mock.errors).toEqual([]); expect(mock.external).toEqual([]);}

// These compact screenshots are emitted by both desktop and mobile projects.
test('explicit revision preserves exact original, compares counts, then adopts only after confirmation', async ({page, context}, info) => {
  const initial = base({reviewed:true}), original = structuredClone(initial.drafts[0]);
  const mock = await boot(page, context, initial);
  expect(mock.calls).toEqual([]);
  await expect(button(page, names.request)).toBeDisabled();
  await request(page);
  const advice = await proposal(page);
  expect((await draft(page)).revisionSnapshots).toHaveLength(1);
  expect(advice.binding).not.toHaveProperty('textSnapshot');
  expect(advice.binding).not.toHaveProperty('contextSnapshot');
  expect(getRevisionSource(await draft(page), advice)).toEqual({id:advice.binding.snapshotId, textSnapshot:BEFORE, contextSnapshot:engine.getContext(initial)});
  expect(mock.calls.map(call => [call.url, call.method])).toEqual([['/api/status','GET'], ['/api/agent','POST']]);
  expect(mock.paid()[0].action).toBe('reviseProse');
  expect(mock.paid()[0].input).toEqual({text:BEFORE, instruction:INSTRUCTION, chapterId:'ch1', context:engine.getContext(initial)});
  expect(await page.getByLabel('改稿前正文', {exact:true}).textContent()).toBe(BEFORE);
  expect(await page.getByLabel('改稿建议正文', {exact:true}).textContent()).toBe(AFTER);
  expect(advice.beforeCounts).toEqual({han:18, characters:29, paragraphs:2});
  expect(advice.afterCounts).toEqual({han:23, characters:36, paragraphs:3});
  await expect(page.getByRole('heading', {name:'改稿前 · 18 汉字 · 29 字符 · 2 段'})).toBeVisible();
  await expect(page.getByRole('heading', {name:'改稿建议 · 23 汉字 · 36 字符 · 3 段'})).toBeVisible();
  expect((await draft(page)).text).toBe(BEFORE);
  expect((await draft(page)).modelReview).toEqual(original.modelReview);
  expect((await draft(page)).memoryDecisions).toEqual(original.memoryDecisions);
  expect((await draft(page)).factDecisions).toEqual(original.factDecisions);
  await capture(page, info, page.locator('.revision-proposal'), 'author-revision-compact-comparison');
  const beforeConfirm = await stored(page);
  await button(page, names.adopt).click();
  const dialog = page.getByRole('dialog', {name:'确认采用改稿建议'});
  await expect(dialog).toContainText('旧提取、整章审阅、设定例外与记忆选择全部失效');
  await expect(button(page, '返回比较')).toBeFocused();
  expect(await stored(page)).toEqual(beforeConfirm);
  await capture(page, info, dialog, 'author-revision-adoption-confirmation');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(button(page, names.adopt)).toBeFocused();
  expect(await stored(page)).toEqual(beforeConfirm);
  await button(page, names.adopt).click();
  await button(page, names.confirm).click();
  await expect(dialog).toHaveCount(0);
  const next = await draft(page), nextState = await state(page);
  expect(next.text).toBe(AFTER);
  expect(next.status).toBe('DRAFT');
  expect(next.revision).toBe(original.revision+1);
  expect(next.proseVersions.map(version => version.text)).toEqual([BEFORE, AFTER]);
  expect(next.extraction.status).toBe('pending');
  for (const key of ['review','modelReview']) expect(next[key]).toBeNull();
  for (const key of ['staging','factDecisions','memoryDecisions']) expect(next[key]).toEqual([]);
  expect(next.revisionProposals[0]).toEqual({...advice, status:'adopted', adoptedRevision:next.revision, resultSnapshot:null});
  expect(next.memoryArchives.some(archive => archive.reason === 'draft_edited' && archive.decisions.length === 1)).toBe(true);
  expect(nextState.chapters).toEqual(initial.chapters);
  expect(nextState.facts).toEqual(initial.facts);
  expect(nextState.events).toEqual([]);
  expect(mock.paid()).toHaveLength(1);
  await page.reload();
  expect((await draft(page)).text).toBe(AFTER);
  expect((await proposal(page)).result).toEqual(advice.result);
  expect(mock.calls).toHaveLength(2);
  noUnexpected(mock);
});

test('discard preserves original prose, reviews and author choices without another request', async ({page, context}) => {
  const initial = base({reviewed:true});
  const mock = await boot(page, context, initial);
  await request(page);
  await button(page, names.discard).click();
  const next = await draft(page);
  expect((await proposal(page)).status).toBe('discarded');
  expect((await proposal(page)).resultSnapshot).toBeNull();
  for (const key of ['text','revision','proseVersions','review','modelReview','extraction','memoryDecisions','factDecisions']) expect(next[key]).toEqual(initial.drafts[0][key]);
  expect(await page.getByLabel('改稿建议正文', {exact:true}).textContent()).toBe(AFTER);
  expect(mock.paid()).toHaveLength(1);
  noUnexpected(mock);
});

for (const [label, status] of [
  ['missing',{configured:true, liveEnabled:true}], ['exhausted',{...BUDGET,callsUsed:10}],
  ['invalid',{...BUDGET,maxCalls:31}], ['disabled',{...BUDGET,liveEnabled:false}],
  ['unconfigured',{...BUDGET,configured:false}],
  ['failed-status',{error:{message:'Synthetic budget read failure'}}],
  ['malformed-status',{...BUDGET,configured:'true'}]
]) test(`${label} budget fails closed without a paid request`, async ({page, context}) => {
  const mock = await boot(page, context);
  mock.respond(() => ({json:status}));
  await page.getByLabel('改稿意见', {exact:true}).fill(INSTRUCTION);
  const beforePreflight = await stored(page);
  for (let attempt = 0; attempt < 2; attempt++) {
    await button(page, names.request).click();
    await expect(page.getByLabel('模型任务状态')).toContainText('请求失败');
    expect((await draft(page)).revisionProposals).toEqual([]);
    expect((await draft(page)).revisionSnapshots).toEqual([]);
    expect(await stored(page)).toEqual(beforePreflight);
  }
  expect(mock.calls).toHaveLength(2);
  expect(mock.paid()).toEqual([]);
  expect((await draft(page)).text).toBe(BEFORE);
  noUnexpected(mock);
});

test('double-click dispatches once; cancellation cannot replay a late result into a new request', async ({page, context}) => {
  const mock = await boot(page, context), first = deferred(), second = deferred();
  mock.respond(call => call.method === 'GET' ? {json:BUDGET} : mock.paid().length === 1 ? first.promise : second.promise);
  await page.getByLabel('改稿意见', {exact:true}).fill(INSTRUCTION);
  // Synchronous events exercise the ref guard before a disabled re-render.
  await button(page, names.request).evaluate(element => {element.click(); element.click();});
  await expect.poll(() => mock.paid().length).toBe(1);
  await expect(button(page, names.request)).toBeDisabled();
  await button(page, '取消请求').click();
  expect((await proposal(page)).status).toBe('cancelled');
  await button(page, names.request).click();
  await expect.poll(() => mock.paid().length).toBe(2);
  first.resolve(output('旧的迟到结果绝不能被下一次请求采用'));
  expect((await proposal(page)).status).toBe('requesting');
  second.resolve(output(AFTER));
  await expect.poll(async () => (await proposal(page)).status).toBe('proposed');
  const proposals = (await draft(page)).revisionProposals;
  expect(proposals[0].result).toBeNull();
  expect(proposals[1].result.text).toBe(AFTER);
  expect((await draft(page)).revisionSnapshots).toHaveLength(1);
  expect(proposals[0].binding.snapshotId).toBe(proposals[1].binding.snapshotId);
  expect(getRevisionSource(await draft(page), proposals[1]).textSnapshot).toBe(BEFORE);
  expect((await draft(page)).text).toBe(BEFORE);
  expect(mock.calls).toHaveLength(4);
  noUnexpected(mock);
});

for (const interruption of ['cancel','edit','cross-tab']) test(`${interruption} during budget preflight prevents paid dispatch`, async ({page, context}) => {
  const mock = await boot(page, context), gate = deferred();
  mock.respond(call => call.method === 'GET' ? gate.promise : output(AFTER));
  await page.getByLabel('改稿意见', {exact:true}).fill(INSTRUCTION);
  await button(page, names.request).click();
  await expect.poll(() => mock.calls.length).toBe(1);
  expect((await draft(page)).revisionProposals).toEqual([]);
  expect((await draft(page)).revisionSnapshots).toEqual([]);
  if (interruption === 'cancel') await button(page, '取消请求').click();
  if (interruption === 'edit') await page.getByLabel('章节正文').fill(FACT+'未保存修改');
  if (interruption === 'cross-tab') await page.evaluate(key => {const saved = JSON.parse(localStorage.getItem(key)); saved.serial++; saved.state.title = '另一窗口版本'; localStorage.setItem(key, JSON.stringify(saved));}, KEY);
  gate.resolve({json:BUDGET});
  await expect(page.getByLabel('模型任务状态')).not.toContainText('等待结果与格式校验');
  expect(mock.paid()).toEqual([]);
  expect((await draft(page)).revisionProposals).toEqual([]);
  expect((await draft(page)).revisionSnapshots).toEqual([]);
  expect((await draft(page)).text).toBe(BEFORE);
  if (interruption === 'cross-tab') await expect(page.getByRole('alert')).toContainText('另一窗口');
  noUnexpected(mock);
});

test('request persistence failure after valid preflight prevents paid dispatch and history allocation', async ({page, context}) => {
  const mock = await boot(page, context), gate = deferred();
  mock.respond(call => call.method === 'GET' ? gate.promise : output(AFTER));
  await page.getByLabel('改稿意见', {exact:true}).fill(INSTRUCTION);
  const before = await stored(page);
  await button(page, names.request).click();
  await expect.poll(() => mock.calls.length).toBe(1);
  await page.evaluate(key => {window.revisionOriginalSet = Storage.prototype.setItem; Storage.prototype.setItem = function(k, value) {if (k === key) throw new DOMException('synthetic pre-dispatch quota failure', 'QuotaExceededError'); return window.revisionOriginalSet.call(this, k, value);};}, KEY);
  gate.resolve({json:BUDGET});
  await expect(page.getByRole('alert')).toContainText('尚未安全保存');
  expect(await stored(page)).toEqual(before);
  expect((await draft(page)).revisionProposals).toEqual([]);
  expect((await draft(page)).revisionSnapshots).toEqual([]);
  expect(mock.paid()).toEqual([]);
  await page.evaluate(() => {Storage.prototype.setItem = window.revisionOriginalSet;});
  await button(page, '重试保存').click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect((await draft(page)).revisionProposals).toEqual([]);
  expect((await draft(page)).revisionSnapshots).toEqual([]);
  expect(mock.calls).toHaveLength(1);
  noUnexpected(mock);
});

for (const change of ['instruction','source','confirmation']) test(`${change} change makes old advice unusable`, async ({page, context}) => {
  const mock = await boot(page, context);
  await request(page);
  if (change === 'instruction') await page.getByLabel('改稿意见', {exact:true}).fill(INSTRUCTION+'不增加新人物。');
  if (change === 'source') {
    await button(page, '编辑此稿').click();
    await page.getByLabel('编辑候选稿', {exact:true}).fill(BEFORE+'作者的新句子。');
    await button(page, '保存候选稿修改').click();
  }
  if (change === 'confirmation') {
    await button(page, names.adopt).click();
    // A queued editor change behind a modal must still be checked at confirmation.
    await page.getByLabel('章节正文').evaluate((element, value) => {Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(element, value); element.dispatchEvent(new Event('input', {bubbles:true}));}, FACT+'未保存修改');
    const before = await stored(page);
    await button(page, names.confirm).click();
    expect(await stored(page)).toEqual(before);
    expect((await draft(page)).text).toBe(BEFORE);
    await button(page, '返回比较').click();
  } else await expect(button(page, names.adopt)).toBeDisabled();
  expect((await proposal(page)).result.text).toBe(AFTER);
  expect(mock.paid()).toHaveLength(1);
  noUnexpected(mock);
});

test('paid response after a workspace edit is retained as stale comparison only', async ({page, context}) => {
  const mock = await boot(page, context), gate = deferred();
  mock.respond(call => call.method === 'GET' ? {json:BUDGET} : gate.promise);
  await page.getByLabel('改稿意见', {exact:true}).fill(INSTRUCTION);
  await button(page, names.request).click();
  await expect.poll(() => mock.paid().length).toBe(1);
  await page.getByLabel('章节正文').fill(FACT+'工作区新修改');
  gate.resolve(output(AFTER));
  await expect.poll(async () => (await proposal(page)).status).toBe('stale');
  await expect(button(page, names.adopt)).toBeDisabled();
  expect(await page.getByLabel('改稿建议正文', {exact:true}).textContent()).toBe(AFTER);
  expect((await draft(page)).text).toBe(BEFORE);
  expect(mock.paid()).toHaveLength(1);
  noUnexpected(mock);
});

for (const errorName of ['QuotaExceededError','SecurityError']) test(`${errorName} retains paid output for export and retry-save without another request`, async ({page, context}, info) => {
  const mock = await boot(page, context), gate = deferred();
  mock.respond(call => call.method === 'GET' ? {json:BUDGET} : gate.promise);
  await page.getByLabel('改稿意见', {exact:true}).fill(INSTRUCTION);
  await button(page, names.request).click();
  await expect.poll(() => mock.paid().length).toBe(1);
  await page.evaluate(({key, name}) => {window.revisionOriginalSet = Storage.prototype.setItem; Storage.prototype.setItem = function(k, value) {if (k === key) throw new DOMException('synthetic paid revision save failure', name); return window.revisionOriginalSet.call(this, k, value);};}, {key:KEY,name:errorName});
  gate.resolve(output(AFTER));
  await expect(page.getByRole('alert')).toContainText('尚未安全保存');
  expect(await page.getByLabel('改稿建议正文', {exact:true}).textContent()).toBe(AFTER);
  expect((await proposal(page)).result).toBeNull();
  await expect(button(page, names.adopt)).toBeDisabled();
  const backup = await downloadCurrent(page);
  expect(backup.state.drafts[0].revisionProposals.at(-1).result.text).toBe(AFTER);
  expect(backup.state.drafts[0].text).toBe(BEFORE);
  await capture(page, info, page.getByRole('alert'), 'author-revision-paid-result-recovery-'+errorName);
  await page.evaluate(() => {Storage.prototype.setItem = window.revisionOriginalSet;});
  await button(page, '重试保存').click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect((await proposal(page)).result.text).toBe(AFTER);
  expect(mock.calls).toHaveLength(2);
  noUnexpected(mock);
});

test('reload preserves completed advice but requires a new confirmation; import revokes its authority', async ({page, context}) => {
  const mock = await boot(page, context);
  await request(page);
  const backup = await stored(page);
  await button(page, names.adopt).click();
  await page.reload();
  await expect(page.getByRole('dialog', {name:'确认采用改稿建议'})).toHaveCount(0);
  expect((await draft(page)).text).toBe(BEFORE);
  expect((await proposal(page)).result.text).toBe(AFTER);
  await button(page, names.adopt).click();
  expect((await draft(page)).text).toBe(BEFORE);
  await button(page, '返回比较').click();
  await upload(page, backup);
  const imported = await state(page);
  expect(imported.projectId).not.toBe(backup.state.projectId);
  expect(imported.importOrigin.original.state).toEqual(backup.state);
  expect(imported.drafts[0].text).toBe(BEFORE);
  expect((await proposal(page)).status).toBe('stale');
  await expect(button(page, names.adopt)).toBeDisabled();
  expect(mock.calls).toHaveLength(2);
  noUnexpected(mock);
});

test('reloaded interrupted paid request needs explicit local cancellation before a new attempt', async ({page, context}) => {
  const mock = await boot(page, context), gate = deferred();
  mock.respond(call => call.method === 'GET' ? {json:BUDGET} : mock.paid().length === 1 ? gate.promise : output(AFTER));
  await page.getByLabel('改稿意见', {exact:true}).fill(INSTRUCTION);
  await button(page, names.request).click();
  await expect.poll(() => mock.paid().length).toBe(1);
  expect((await proposal(page)).status).toBe('requesting');
  await page.reload();
  gate.resolve(output('重载前的迟到结果不得恢复授权'));
  await button(page, '取消中断的改稿请求').click();
  expect((await proposal(page)).status).toBe('cancelled');
  expect(mock.calls).toHaveLength(2);
  await request(page);
  expect((await draft(page)).revisionProposals).toHaveLength(2);
  expect((await draft(page)).revisionProposals[0].result).toBeNull();
  expect((await draft(page)).revisionSnapshots).toHaveLength(1);
  expect(mock.paid()).toHaveLength(2);
  noUnexpected(mock);
});

for (const failure of ['upstream','malformed']) test(`${failure} response preserves original with no auto retry`, async ({page, context}) => {
  const mock = await boot(page, context);
  mock.respond(call => call.method === 'GET' ? {json:BUDGET} : failure === 'upstream' ? {status:502,json:{error:{message:'Synthetic upstream failure'}}} : {json:{output:{text:AFTER,chapterId:'ch2',provider}}});
  await page.getByLabel('改稿意见', {exact:true}).fill(INSTRUCTION);
  await button(page, names.request).click();
  await expect.poll(async () => (await proposal(page)).status).toBe('failed');
  expect((await draft(page)).text).toBe(BEFORE);
  expect((await proposal(page)).result).toBeNull();
  expect(mock.calls).toHaveLength(2);
  noUnexpected(mock);
});

for (const kind of ['manual','accepted','template']) test(`${kind} draft cannot make a paid author revision request`, async ({page, context}) => {
  let initial = base();
  if (kind === 'manual') {
    initial = engine.createProjectFromConfig({projectId:'manual-revision-browser'});
    initial = engine.saveRevision(initial, 'ch1', BEFORE, initial.chapters[0].revision);
    initial = engine.commitPatch(initial, engine.proposeCustomPatch(initial, 'ch1', {intent:'local_prose'}));
    initial = engine.stageManualDraft(initial, 'ch1');
  }
  if (kind === 'accepted') {initial = base({reviewed:true}); initial = engine.acceptDraft(initial, initial.drafts[0].id);}
  const mock = await boot(page, context, initial, kind === 'template' ? 'template' : 'server');
  if (kind === 'template') {await page.getByLabel('改稿意见', {exact:true}).fill(INSTRUCTION); await expect(button(page, names.request)).toBeDisabled();}
  else {await expect(page.getByLabel('改稿意见', {exact:true})).toHaveCount(0); await expect(button(page, names.request)).toHaveCount(0);}
  expect(mock.calls).toEqual([]);
  noUnexpected(mock);
});
