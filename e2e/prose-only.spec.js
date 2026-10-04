// Browser plugin not available. Hosted Playwright runs desktop/mobile Chromium.
// Only local mocked API endpoints are allowed; this tests workflow, not model quality.
import {test, expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import * as engine from '../src/domain/engine.js';
import * as revisions from '../src/domain/author-revision.js';
import {KEY, parseBackup} from '../src/storage.js';

const PROSE = '  陆遥展开信纸。🙂\n\n她把信放在窗边。\n';
const FACT = '陆遥从未读过那封信。';
const NEXT = '第二天，陆遥在窗边停住，先去找守门人。';
const provider = {id:'prose-only-offline-mock', isLive:true, model:'synthetic'};
const names = {skip:'不提取记忆 · 仅保留正文', dialog:'确认不提取候选记忆', confirm:'确认不提取记忆', back:'返回核对', review:'审查候选稿', accept:'接受此版本', final:'确认接受正文与所选记忆'};
const workspace = (state, providerMode = 'server') => ({format:1, serial:0, state, editing:{}, patch:null, providerMode});
const report = (s, status = 'consistent') => ({summary:'离线合成审阅，不证明语义或文学质量', issues:[], checks:[], factChecks:s.facts.filter(f => f.status === 'confirmed').map(f => ({factId:f.id, recordVersion:f.recordVersion, status, explanation:'离线门禁测试', sourceQuote:s.drafts[0].text.split('\n')[0]})), provider});
function base({reviewed = false, text = PROSE, canon = true} = {}) {
  let s = engine.createProjectFromConfig({projectId:'prose-only-browser', title:'窗边的信', protagonist:'陆遥', chapters:[{title:'第一章 窗边的信'}, {title:'第二章 守门人'}, {title:'第三章 旧登记簿'}]});
  if (canon) {
    s = engine.saveRevision(s, 'ch1', FACT, s.chapters[0].revision);
    s = engine.commitPatch(s, engine.proposeCustomPatch(s, 'ch1', {intent:'author_fact', statement:FACT}));
  }
  s = engine.stageProseDraft(s, {text, chapterId:'ch1', provider, context:engine.getContext(s)}, 'ch1');
  if (!reviewed) return s;
  const id = s.drafts[0].id;
  s = engine.beginMemoryExtraction(s, id);
  s = engine.attachMemoryExtraction(s, id, {staging:[{label:'陆遥展开信纸', sourceParagraphIndex:0}], reviewNotes:[], provider}, engine.createExtractionBinding(s, id));
  s = engine.reviewDraft(s, id);
  s = engine.attachSemanticReview(s, id, report(s, 'contradiction'), engine.createReviewBinding(s, id));
  const fact = s.facts[0];
  s = engine.resolveFactReview(s, id, {factId:fact.id, recordVersion:fact.recordVersion, action:'accept_exception', reason:'仅旧版的合成例外', reviewHash:engine.hash(JSON.stringify(s.drafts[0].modelReview))}, engine.createReviewBinding(s, id));
  const memory = engine.getMemoryReviewGate(s, id)[0];
  return engine.decideMemoryCandidate(s, id, {candidateId:memory.candidateId, action:'keep_quote', reviewHash:memory.reviewHash}, memory.binding);
}
const historyRoot = new URL('../eval/history/author-revision-v1/', import.meta.url);
const trialNames = ['raw-01.bin','revised-chapter-2.txt','close-read.json','outcome.json'];
const trialBytes = Object.fromEntries(trialNames.map(name => [name, readFileSync(new URL(name, historyRoot))]));
const historical = trialBytes['revised-chapter-2.txt'].toString('utf8');
const contradiction = '许宁没再敲，退后半步，用指节在铁门下半部敲了三下。';
const corrected = historical.replace(contradiction, '许宁退后半步，用指节在铁门下半部敲了三下。');
function historicalProposal() {
  // The ch1 wrapper is synthetic; the retained trial remains a failed chapter-2 run.
  let s = base({canon:false});
  const id = s.drafts[0].id;
  s = revisions.setRevisionInstruction(s, id, '离线回放历史输出，仅测试作者编辑与正文接受流程');
  s = revisions.beginDraftRevision(s, id);
  const p = s.drafts[0].revisionProposals[0];
  return revisions.attachDraftRevision(s, id, p.id, {text:historical, chapterId:'ch1', provider}, p.binding);
}
const button = (page, name) => page.getByRole('button', {name, exact:true});
const stored = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), KEY);
const state = async page => (await stored(page)).state;
const draft = async page => (await state(page)).drafts[0];
const output = value => ({status:200, json:{output:{...value, provider}}});
const skipDialog = page => page.getByRole('dialog', {name:names.dialog});
function deferred() {let resolve; const promise = new Promise(done => {resolve = done;}); return {promise, resolve};}
async function boot(page, context, initial = base()) {
  const calls = [], errors = [], external = [];
  let responder = () => {throw Error('Unexpected automatic provider request');};
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() !== 'error') return;
    if (/Failed to load resource: the server responded with a status of 502/.test(message.text()) && message.location().url.endsWith('/api/agent')) return;
    errors.push(message.text());
  });
  await context.route('**/*', route => {
    if (['127.0.0.1','localhost'].includes(new URL(route.request().url()).hostname)) return route.continue();
    external.push(route.request().url()); return route.abort('blockedbyclient');
  });
  await page.route('**/api/**', async route => {
    const request = route.request(), url = new URL(request.url());
    if (!['127.0.0.1','localhost'].includes(url.hostname)) {external.push(request.url()); return route.abort('blockedbyclient');}
    expect(url.pathname).toBe('/api/agent');
    expect(request.method()).toBe('POST');
    const call = {url:url.pathname, method:request.method(), ...request.postDataJSON()};
    calls.push(call);
    const answer = await responder(call);
    try {await route.fulfill(answer);} catch (error) {if (!/closed|handled|Invalid InterceptionId/i.test(error.message)) throw error;}
  });
  await page.addInitScript(({key, data}) => {if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(data));}, {key:KEY, data:workspace(initial)});
  await page.goto('/');
  await expect(page).toHaveURL('http://127.0.0.1:5173/');
  await expect(page).toHaveTitle('NexusScribe · 雾港来信');
  await expect(page.getByLabel('章节正文')).toBeVisible();
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  return {calls, errors, external, respond:fn => {responder = fn;}};
}
function noUnexpected(mock) {expect(mock.errors).toEqual([]); expect(mock.external).toEqual([]);}
async function skip(page) {await button(page, names.skip).click(); await button(page, names.confirm).click();}
async function accept(page) {await button(page, names.accept).click(); await button(page, names.final).click();}
async function capture(page, info, locator, name) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth+1)).toBe(true);
  await locator.scrollIntoViewIfNeeded();
  const path = info.outputPath(name+'.png');
  await locator.screenshot({path, animations:'disabled'});
  await info.attach(name, {path, contentType:'image/png'});
}
async function upload(page, backup) {
  await page.getByLabel('导入备份', {exact:true}).setInputFiles({name:'prose-only.json', mimeType:'application/json', buffer:Buffer.from(JSON.stringify(backup))});
  await expect(page.getByRole('dialog', {name:'备份导入预览'})).toBeVisible();
  await button(page, '确认作为新项目导入').click();
  await expect(page.getByRole('dialog', {name:'备份导入预览'})).toHaveCount(0);
}
async function download(page) {
  const downloaded = page.waitForEvent('download');
  await button(page, '导出项目备份').click();
  const stream = await (await downloaded).createReadStream(); let raw = '';
  for await (const chunk of stream) raw += chunk;
  return parseBackup(raw);
}
async function queuedEditorChange(page, value) {
  // Simulate an already queued editor update behind the modal; do not click
  // through the backdrop, which would test impossible pointer interaction.
  await page.getByLabel('章节正文').evaluate((element, value) => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(element, value);
    element.dispatchEvent(new Event('input', {bubbles:true}));
  }, value);
}
async function expectFreshReview(page) {
  const d = await draft(page);
  expect(d.review).toBeNull(); expect(d.modelReview).toBeNull();
  expect(d.factDecisions).toEqual([]); expect(d.memoryDecisions).toEqual([]);
  const before = await stored(page);
  if (await button(page, names.accept).isEnabled()) await button(page, names.accept).click();
  await expect(page.getByRole('dialog', {name:'确认接受候选稿与已选记忆'})).toHaveCount(0);
  expect(await stored(page)).toEqual(before);
  await expect(button(page, names.review)).toBeEnabled();
  const s = await state(page);
  expect(() => engine.acceptDraft(s, d.id)).toThrow(/重新审查/);
}

test('historical failed revision can be author edited and accepted as prose only after fresh review', async ({page, context}, info) => {
  expect(historical).toContain(contradiction);
  expect(JSON.parse(trialBytes['outcome.json']).closeRead).toBe('fail');
  const mock = await boot(page, context, historicalProposal());
  const raw = structuredClone((await draft(page)).revisionProposals[0]);
  await button(page, '核对并采用改稿建议').click();
  await page.getByLabel('待采用正文', {exact:true}).fill(corrected);
  await button(page, '确认采用并使旧审阅失效').click();
  expect((await draft(page)).revisionProposals[0].adoption.authority).toBe('explicit_author_edit');
  expect((await draft(page)).extraction.status).toBe('pending');
  const before = await stored(page);
  await button(page, names.skip).click();
  await expect(skipDialog(page)).toContainText(`候选 r${before.state.drafts[0].revision}`);
  await expect(skipDialog(page)).toContainText(engine.hash(corrected));
  await expect(skipDialog(page)).toContainText('0 条候选记忆');
  await expect(skipDialog(page)).toContainText('尚未完成');
  await expect(skipDialog(page)).toContainText('不表示全流程 0 次调用');
  await expect(skipDialog(page)).toContainText('后续章节上下文');
  await expect(button(page, names.back)).toBeFocused();
  expect(await stored(page)).toEqual(before);
  await capture(page, info, skipDialog(page), 'prose-only-zero-memory-confirmation');
  await button(page, names.confirm).click();
  expect(mock.calls).toEqual([]);
  expect((await draft(page)).extraction.status).toBe('skipped');
  expect((await draft(page)).requiresSemanticReview).toBe(true);
  expect((await draft(page)).providerInfo.isLive).toBe(true);
  await expectFreshReview(page);
  mock.respond(call => {expect(call.action).toBe('reviewChapter'); expect(call.input.text).toBe(corrected); return output(report(before.state));});
  await button(page, names.review).click();
  await expect.poll(async () => Boolean((await draft(page)).modelReview)).toBe(true);
  await button(page, names.accept).click();
  await expect(page.getByRole('dialog', {name:'确认接受候选稿与已选记忆'})).toContainText('0');
  await button(page, names.back).click();
  expect((await state(page)).chapters[0].status).not.toBe('ACCEPTED');
  await accept(page);
  const accepted = await state(page), d = accepted.drafts[0];
  expect(accepted.chapters[0].text).toBe(corrected);
  expect(accepted.chapters[0].status).toBe('ACCEPTED');
  expect(accepted.events).toEqual([]);
  expect(accepted.commits.at(-1).acceptance).toEqual({protocol:'prose-only-v1', authority:'explicit_author_decision', draftRevision:d.revision, textHash:engine.hash(corrected), textSnapshot:corrected, memoryExtraction:'skipped', extractionAttempt:d.extraction.attempt, semanticStatus:'model_reviewed_unverified'});
  expect(d.revisionProposals[0].result).toEqual(raw.result);
  expect(d.revisionProposals[0].binding).toEqual(raw.binding);
  expect(d.revisionProposals[0].result.text).toContain(contradiction);
  expect(d.proseVersions.map(v => v.text)).toEqual([PROSE, corrected]);
  expect((await download(page)).state).toEqual(accepted);
  await capture(page, info, page.getByLabel('章节正文'), 'prose-only-accepted-author-edit');
  await page.reload();
  await expect(page.getByLabel('章节正文')).toHaveValue(corrected);
  mock.respond(call => {expect(call.action).toBe('generateProse'); return output({text:NEXT, chapterId:'ch2'});});
  await page.getByRole('navigation', {name:'章节'}).getByRole('button').nth(1).click();
  await button(page, '生成当前章').click();
  await expect.poll(async () => (await state(page)).drafts.at(-1).text).toBe(NEXT);
  expect(mock.calls.map(call => call.action)).toEqual(['reviewChapter','generateProse']);
  expect(mock.calls[1].input.context.events).toEqual([]);
  expect(mock.calls[1].input.context.sources.find(source => source.chapterId === 'ch1')).toMatchObject({text:corrected, role:'accepted_manuscript'});
  for (const name of trialNames) expect(readFileSync(new URL(name, historyRoot))).toEqual(trialBytes[name]);
  noUnexpected(mock);
});

for (const dismissal of ['return','escape','close','reload']) test(`${dismissal} leaves skip uncommitted; reopening needs fresh confirmation`, async ({page, context}) => {
  const mock = await boot(page, context), before = await stored(page);
  await button(page, names.skip).click();
  if (dismissal === 'return') await button(page, names.back).click();
  if (dismissal === 'escape') await page.keyboard.press('Escape');
  if (dismissal === 'close') await button(page, '关闭'+names.dialog).click();
  if (dismissal === 'reload') await page.reload();
  await expect(skipDialog(page)).toHaveCount(0);
  expect(await stored(page)).toEqual(before);
  if (dismissal !== 'reload') await expect(button(page, names.skip)).toBeFocused();
  await skip(page);
  expect((await draft(page)).extraction.status).toBe('skipped');
  expect(mock.calls).toEqual([]); noUnexpected(mock);
});

test('skipping extracted candidates archives exact old quotes and revokes Canon exceptions', async ({page, context}, info) => {
  const initial = base({reviewed:true}), old = structuredClone(initial.drafts[0]);
  const mock = await boot(page, context, initial);
  await button(page, names.skip).click();
  await expect(skipDialog(page)).toContainText('1 条候选记忆');
  await expect(skipDialog(page)).toContainText('已完成');
  await capture(page, info, skipDialog(page), 'prose-only-existing-quote-confirmation');
  await button(page, names.confirm).click();
  await expectFreshReview(page);
  const d = await draft(page), archived = d.memoryArchives.find(a => a.reason === 'prose_extraction_skipped');
  expect(archived.candidates).toEqual(old.staging);
  expect(archived.decisions).toEqual(old.memoryDecisions);
  expect(archived.textSnapshot).toBe(old.text);
  expect(archived.extractionSnapshot).toEqual(old.extraction);
  expect(d.memoryAuthorities.slice(0, old.memoryAuthorities.length)).toEqual(old.memoryAuthorities);
  expect((await state(page)).facts).toEqual(initial.facts);
  expect(mock.calls).toEqual([]);
  mock.respond(call => {expect(call.action).toBe('reviewChapter'); return output(report(initial, 'contradiction'));});
  await button(page, names.review).click();
  await expect.poll(async () => Boolean((await draft(page)).modelReview)).toBe(true);
  const next = await state(page);
  expect(engine.getFactReviewGate(next, d.id)[0].resolved).toBe(false);
  expect(() => engine.acceptDraft(next, d.id)).toThrow(/冲突|逐条/);
  expect(next.events).toEqual([]);
  expect(mock.calls).toHaveLength(1); noUnexpected(mock);
});

for (const ending of ['failed','cancelled']) test(`${ending} extraction requires explicit skip and ignores late output`, async ({page, context}) => {
  const mock = await boot(page, context), gate = deferred();
  mock.respond(call => {expect(call.action).toBe('extractMemory'); return gate.promise;});
  await button(page, '提取候选记忆').click();
  await expect.poll(() => mock.calls.length).toBe(1);
  await expect(button(page, names.skip)).toBeDisabled();
  await expect(skipDialog(page)).toHaveCount(0);
  if (ending === 'cancelled') await button(page, '取消请求').click();
  else gate.resolve({status:502, json:{error:{message:'合成提取失败'}}});
  await expect.poll(async () => (await draft(page)).extraction.status).toBe(ending);
  await expect(button(page, names.accept)).toBeDisabled();
  await button(page, names.skip).click();
  await expect(skipDialog(page)).toContainText(ending === 'failed' ? '失败' : '已取消');
  await button(page, names.confirm).click();
  if (ending === 'cancelled') gate.resolve(output({staging:[{label:'迟到的旧候选', sourceParagraphIndex:0}], reviewNotes:[]}));
  await expectFreshReview(page);
  expect((await draft(page)).extraction.status).toBe('skipped');
  expect((await draft(page)).staging).toEqual([]);
  expect(mock.calls).toHaveLength(1); noUnexpected(mock);
});

for (const changed of ['editing','selection','storage-event','cross-tab']) test(`${changed} during confirmation cannot authorize skip`, async ({page, context}) => {
  const mock = await boot(page, context);
  await button(page, names.skip).click();
  if (changed === 'editing') await queuedEditorChange(page, FACT+'未提交的新句。');
  if (changed === 'selection') await page.getByRole('navigation', {name:'章节'}).getByRole('button').nth(1).evaluate(element => element.click());
  if (changed === 'storage-event') await page.evaluate(key => dispatchEvent(new StorageEvent('storage', {key, storageArea:localStorage, oldValue:localStorage.getItem(key), newValue:localStorage.getItem(key)})), KEY);
  if (changed === 'cross-tab') await page.evaluate(key => {const value = JSON.parse(localStorage.getItem(key)); value.serial++; value.state.title = '另一窗口'; localStorage.setItem(key, JSON.stringify(value));}, KEY);
  const before = await stored(page);
  // Save-health changes may disable confirm before its handler is reached.
  if (await button(page, names.confirm).isEnabled()) await button(page, names.confirm).click();
  expect(await stored(page)).toEqual(before);
  expect((await draft(page)).extraction.status).toBe('pending');
  expect(mock.calls).toEqual([]); noUnexpected(mock);
});

test('unsaved candidate editor blocks skip and a saved later edit revokes its binding', async ({page, context}) => {
  const mock = await boot(page, context);
  await button(page, '编辑此稿').click();
  await page.getByLabel('编辑候选稿', {exact:true}).fill(PROSE+'尚未保存');
  if (await button(page, names.skip).isEnabled()) await button(page, names.skip).click();
  await expect(skipDialog(page)).toHaveCount(0);
  await button(page, '取消候选稿修改').click();
  await skip(page);
  await button(page, '编辑此稿').click();
  await page.getByLabel('编辑候选稿', {exact:true}).fill(PROSE+'新版本');
  await button(page, '保存候选稿修改').click();
  expect((await draft(page)).extraction.status).toBe('pending');
  await expect(button(page, names.review)).toBeDisabled();
  expect(mock.calls).toEqual([]); noUnexpected(mock);
});

for (const errorName of ['QuotaExceededError','SecurityError']) test(`${errorName} does not commit skip; retry-save cannot replay confirmation`, async ({page, context}, info) => {
  const mock = await boot(page, context);
  await button(page, names.skip).click();
  const before = await stored(page);
  await page.evaluate(({key, name}) => {
    window.proseOriginalSet = Storage.prototype.setItem;
    Storage.prototype.setItem = function(k, value) {if (k === key) throw new DOMException('synthetic skip persistence failure', name); return window.proseOriginalSet.call(this, k, value);};
  }, {key:KEY, name:errorName});
  await button(page, names.confirm).click();
  await expect(page.getByRole('alert')).toContainText('尚未安全保存');
  expect(await stored(page)).toEqual(before);
  await page.evaluate(() => {Storage.prototype.setItem = window.proseOriginalSet;});
  // Dismiss before retrying the banner; reopening remains a new explicit choice.
  await button(page, names.back).click();
  await capture(page, info, page.getByRole('alert'), 'prose-only-storage-'+errorName);
  await button(page, '重试保存').click();
  expect((await draft(page)).extraction.status).toBe('pending');
  await skip(page);
  expect((await draft(page)).extraction.status).toBe('skipped');
  expect(mock.calls).toEqual([]); noUnexpected(mock);
});

test('backup import retains prior evidence but removes skip authority until chosen again', async ({page, context}) => {
  const mock = await boot(page, context);
  await skip(page);
  const backup = await stored(page);
  await upload(page, backup);
  const imported = await state(page);
  expect(imported.projectId).not.toBe(backup.state.projectId);
  expect(imported.importOrigin.original.state).toEqual(backup.state);
  expect(imported.drafts[0].extraction.status).toBe('pending');
  await expect(button(page, names.accept)).toBeDisabled();
  await skip(page);
  expect((await draft(page)).extraction.status).toBe('skipped');
  expect(mock.calls).toEqual([]); noUnexpected(mock);
});

test('zero new memories preserves previously accepted excerpts and prose context', async ({page, context}) => {
  let initial = base({canon:false}); const firstId = initial.drafts[0].id;
  initial = engine.beginMemoryExtraction(initial, firstId);
  initial = engine.attachMemoryExtraction(initial, firstId, {staging:[{label:'陆遥展开信纸', sourceParagraphIndex:0}], reviewNotes:[], provider}, engine.createExtractionBinding(initial, firstId));
  initial = engine.reviewDraft(initial, firstId);
  initial = engine.attachSemanticReview(initial, firstId, report(initial), engine.createReviewBinding(initial, firstId));
  const quote = engine.getMemoryReviewGate(initial, firstId)[0];
  initial = engine.decideMemoryCandidate(initial, firstId, {candidateId:quote.candidateId, action:'keep_quote', reviewHash:quote.reviewHash}, quote.binding);
  initial = engine.acceptDraft(initial, firstId);
  const earlierEvents = structuredClone(initial.events);
  initial = engine.stageProseDraft(initial, {text:NEXT, chapterId:'ch2', provider, context:engine.getContext(initial)}, 'ch2');
  const mock = await boot(page, context, initial);
  await skip(page);
  mock.respond(call => {expect(call.action).toBe('reviewChapter'); return output({summary:'合成第二章审阅', issues:[], checks:[], factChecks:[]});});
  await button(page, names.review).click();
  await expect.poll(async () => Boolean((await state(page)).drafts.at(-1).modelReview)).toBe(true);
  await accept(page);
  const accepted = await state(page);
  expect(accepted.events).toEqual(earlierEvents);
  expect(accepted.chapters[1].text).toBe(NEXT);
  expect(engine.getContext(accepted).events).toHaveLength(1);
  expect(engine.getContext(accepted).sources.find(source => source.chapterId === 'ch2').role).toBe('accepted_manuscript');
  expect(mock.calls.map(call => call.action)).toEqual(['reviewChapter']); noUnexpected(mock);
});

test('stale source context blocks skip until author explicitly refreshes context', async ({page, context}) => {
  let initial = base();
  initial = engine.saveRevision(initial, 'ch1', FACT+'作者添加了钟楼的位置。', initial.chapters[0].revision);
  initial = engine.commitPatch(initial, engine.proposeCustomPatch(initial, 'ch1', {intent:'local_prose'}));
  const mock = await boot(page, context, initial), before = await stored(page);
  await button(page, names.skip).click();
  await expect(skipDialog(page)).toHaveCount(0);
  expect(await stored(page)).toEqual(before);
  await button(page, '更新参考上下文').click();
  await button(page, '确认更新参考上下文').click();
  await skip(page);
  expect((await draft(page)).extraction.status).toBe('skipped');
  expect((await draft(page)).text).toBe(PROSE);
  expect(mock.calls).toEqual([]); noUnexpected(mock);
});

test('same-text pending classification blocks skip until the author dismisses it', async ({page, context}) => {
  const mock = await boot(page, context);
  await button(page, '作者分类保存 · 不调用模型').click();
  await button(page, '仅局部表达，不更新设定').click();
  const before = await stored(page);
  expect(before.patch).toBeTruthy();
  await button(page, names.skip).click();
  await expect(skipDialog(page)).toHaveCount(0);
  expect(await stored(page)).toEqual(before);
  await button(page, '关闭影响预览').click();
  await skip(page);
  expect((await draft(page)).extraction.status).toBe('skipped');
  expect(mock.calls).toEqual([]); noUnexpected(mock);
});
