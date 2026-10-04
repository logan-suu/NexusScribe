// Hosted desktop/mobile browser coverage. Every API endpoint is synthetic and
// nonlocal traffic is blocked. No paid model call or literary-quality claim.
import {test, expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import * as engine from '../src/domain/engine.js';
import {getRevisionSource, proseCounts} from '../src/domain/author-revision.js';
import {KEY, parseBackup} from '../src/storage.js';

const BEFORE = '  陆遥展开信纸。🙂\n\n“别去钟楼。”她轻声读出这句话。\n';
const AFTER = '  陆遥展开信纸。\n\n纸上只有一句：“别去钟楼。”\n她把信压在杯底。🙂\n';
const EDITED = '  陆遥没有展开信纸。🙂\n\n她把封口未动的信压在杯底。\n';
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
    if (!['127.0.0.1','localhost'].includes(new URL(request.url()).hostname)) {
      external.push(request.url());
      return route.abort('blockedbyclient');
    }
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
  await expect(page).toHaveURL('http://127.0.0.1:5173/');
  await expect(page).toHaveTitle('NexusScribe · 雾港来信');
  await expect(page.getByLabel('章节正文')).toBeVisible();
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  return {calls, errors, external, paid:() => calls.filter(call => call.method === 'POST'), respond:fn => {responder = fn;}};
}
async function request(page, instruction = INSTRUCTION) {
  await page.getByLabel('改稿意见', {exact:true}).fill(instruction);
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
async function downloadText(page, name) {
  const downloaded = page.waitForEvent('download');
  await button(page, name).click();
  const stream = await (await downloaded).createReadStream();
  let raw = '';
  for await (const chunk of stream) raw += chunk;
  return raw;
}
const adoptionDialog = page => page.getByRole('dialog', {name:'确认采用改稿建议'});
const pendingText = page => adoptionDialog(page).getByLabel('待采用正文', {exact:true});
const boundNames = ['汉字下限','汉字上限','段数下限','段数上限'];
async function fillBounds(page, values = {}) {
  for (const name of boundNames) await adoptionDialog(page).getByLabel(name, {exact:true}).fill(values[name] ?? '');
}
function adoptionRecord(text, lengthBounds = {}, authority = text === AFTER ? 'explicit_model_adoption' : 'explicit_author_edit') {
  return {authority, textHash:engine.hash(text), counts:proseCounts(text), lengthBounds};
}
function expectRawProposal(next, raw) {
  for (const key of ['binding','beforeCounts','afterCounts','result']) expect(next[key]).toEqual(raw[key]);
  expect(next.result.provider).toEqual(provider);
}
async function failWorkspaceWrites(page, name) {
  await page.evaluate(({key, name}) => {
    window.revisionOriginalSet = Storage.prototype.setItem;
    Storage.prototype.setItem = function(k, value) {
      if (k === key) throw new DOMException('synthetic edited adoption save failure', name);
      return window.revisionOriginalSet.call(this, k, value);
    };
  }, {key:KEY, name});
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
  expect(next.revisionProposals[0]).toEqual({...advice, status:'adopted', adoptedRevision:next.revision, resultSnapshot:null, adoption:adoptionRecord(AFTER)});
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

test('author edits remain local until confirmation and preserve the exact raw proposal and provider', async ({page, context}, info) => {
  const initial = base({reviewed:true}), original = structuredClone(initial.drafts[0]);
  const mock = await boot(page, context, initial);
  await request(page);
  const raw = await proposal(page), before = await stored(page);
  await button(page, names.adopt).click();
  const dialog = adoptionDialog(page);
  await expect(pendingText(page)).toHaveValue(AFTER);
  await expect(pendingText(page)).toHaveAttribute('maxlength','30000');
  await pendingText(page).fill(EDITED);
  expect(proseCounts(EDITED)).toEqual({han:20, characters:28, paragraphs:2});
  await expect(dialog.getByLabel('待采用正文计数', {exact:true})).toContainText('20 汉字 · 28 字符 · 2 段');
  expect(await dialog.getByLabel('采用窗口模型原文', {exact:true}).textContent()).toBe(AFTER);
  expect(await stored(page)).toEqual(before);
  expect(await page.getByLabel('改稿前正文', {exact:true}).textContent()).toBe(BEFORE);
  expect(await page.getByLabel('改稿建议正文', {exact:true}).textContent()).toBe(AFTER);
  await capture(page, info, dialog, 'author-revision-edited-pending-text');
  await button(page, names.confirm).click();
  await expect(dialog).toHaveCount(0);
  const next = await draft(page), accepted = await proposal(page);
  expect(next.text).toBe(EDITED);
  expect(next.proseVersions.map(version => version.text)).toEqual([BEFORE, EDITED]);
  expect(next.proseVersions.find(version => version.revision === accepted.adoptedRevision).text).toBe(EDITED);
  expect(accepted.adoption).toEqual(adoptionRecord(EDITED));
  expect(accepted.adoption).not.toHaveProperty('text');
  expect(accepted.adoption).not.toHaveProperty('textSnapshot');
  expectRawProposal(accepted, raw);
  await expect(page.getByLabel('采用来源记录', {exact:true})).toContainText('explicit_author_edit');
  expect(await page.getByLabel('已采用版本正文', {exact:true}).textContent()).toBe(EDITED);
  expect(getRevisionSource(next, accepted).textSnapshot).toBe(BEFORE);
  expect(next.status).toBe('DRAFT');
  expect(next.revision).toBe(original.revision+1);
  expect(next.extraction.status).toBe('pending');
  for (const key of ['review','modelReview']) expect(next[key]).toBeNull();
  for (const key of ['staging','factDecisions','memoryDecisions']) expect(next[key]).toEqual([]);
  expect(next.memoryArchives.some(archive => archive.reason === 'draft_edited' && archive.decisions.length === 1)).toBe(true);
  expect((await state(page)).chapters).toEqual(initial.chapters);
  expect((await state(page)).facts).toEqual(initial.facts);
  expect((await state(page)).events).toEqual([]);
  await page.reload();
  expect((await draft(page)).text).toBe(EDITED);
  expect((await proposal(page)).adoption).toEqual(accepted.adoption);
  expectRawProposal(await proposal(page), raw);
  expect(mock.calls).toHaveLength(2);
  noUnexpected(mock);
});

test('offline correction of the historical contradiction is an author edit, not a new model success', async ({page, context}) => {
  const historicalUrl = new URL('../eval/history/author-revision-v1/revised-chapter-2.txt', import.meta.url);
  const outcomeUrl = new URL('../eval/history/author-revision-v1/outcome.json', import.meta.url);
  const historical = readFileSync(historicalUrl, 'utf8'), recordedOutcome = readFileSync(outcomeUrl, 'utf8');
  const contradiction = '许宁没再敲，退后半步，用指节在铁门下半部敲了三下。';
  expect(historical).toContain(contradiction);
  expect(JSON.parse(recordedOutcome).closeRead).toBe('fail');
  const corrected = historical.replace(contradiction, '许宁退后半步，用指节在铁门下半部敲了三下。');
  const mock = await boot(page, context);
  // Replay retained bytes through the synthetic provider. This does not retry the
  // recorded trial, alter its failed outcome, or establish literary quality.
  mock.respond(call => call.method === 'GET' ? {json:BUDGET} : output(historical));
  await request(page);
  const raw = await proposal(page);
  await button(page, names.adopt).click();
  await expect(pendingText(page)).toHaveValue(historical);
  await pendingText(page).fill(corrected);
  await button(page, names.confirm).click();
  const next = await draft(page), accepted = await proposal(page);
  expect(next.text).toBe(corrected);
  expect(next.status).toBe('DRAFT');
  expect(next.modelReview).toBeNull();
  expect(next.extraction.status).toBe('pending');
  expect(accepted.adoption).toEqual(adoptionRecord(corrected, {}, 'explicit_author_edit'));
  expectRawProposal(accepted, raw);
  expect(accepted.result.text).toContain(contradiction);
  expect(next.text).not.toContain('许宁没再敲');
  expect(readFileSync(historicalUrl, 'utf8')).toBe(historical);
  expect(readFileSync(outcomeUrl, 'utf8')).toBe(recordedOutcome);
  expect(mock.calls).toHaveLength(2);
  noUnexpected(mock);
});

for (const dismissal of ['return','escape']) test(`${dismissal} discards pending edits and bounds; reopening starts from the raw model text`, async ({page, context}) => {
  const mock = await boot(page, context);
  await request(page);
  const before = await stored(page);
  await button(page, names.adopt).click();
  await pendingText(page).fill(EDITED);
  await fillBounds(page, {'汉字下限':'10','汉字上限':'50','段数下限':'1','段数上限':'4'});
  expect(await stored(page)).toEqual(before);
  if (dismissal === 'return') await button(page, '返回比较').click();
  else await page.keyboard.press('Escape');
  await expect(adoptionDialog(page)).toHaveCount(0);
  await expect(button(page, names.adopt)).toBeFocused();
  expect(await stored(page)).toEqual(before);
  await button(page, names.adopt).click();
  await expect(pendingText(page)).toHaveValue(AFTER);
  for (const name of boundNames) await expect(adoptionDialog(page).getByLabel(name, {exact:true})).toHaveValue('');
  await expect(adoptionDialog(page)).toContainText('23 汉字 · 36 字符 · 3 段');
  await button(page, names.confirm).click();
  expect((await draft(page)).text).toBe(AFTER);
  expect((await proposal(page)).adoption).toEqual(adoptionRecord(AFTER));
  expect(mock.calls).toHaveLength(2);
  noUnexpected(mock);
});

test('whitespace and oversized edited text cannot be adopted; valid text remains local', async ({page, context}) => {
  const mock = await boot(page, context);
  await request(page);
  const before = await stored(page);
  await button(page, names.adopt).click();
  for (const invalid of ['', ' \n\t  ']) {
    await pendingText(page).fill(invalid);
    await expect(button(page, names.confirm)).toBeDisabled();
    expect(await stored(page)).toEqual(before);
  }
  // Bypass the native maxlength once to exercise state/domain validation too.
  await pendingText(page).evaluate((element, value) => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(element, value);
    element.dispatchEvent(new Event('input', {bubbles:true}));
  }, '字'.repeat(30001));
  await expect(button(page, names.confirm)).toBeDisabled();
  expect(await stored(page)).toEqual(before);
  await pendingText(page).fill('字'.repeat(30000));
  await expect(button(page, names.confirm)).toBeEnabled();
  expect(await stored(page)).toEqual(before);
  await pendingText(page).fill(EDITED);
  await expect(button(page, names.confirm)).toBeEnabled();
  expect(await stored(page)).toEqual(before);
  expect(mock.calls).toHaveLength(2);
  noUnexpected(mock);
});

for (const direction of ['under','over']) test(`${direction} numeric author bounds show advisory warnings but permit explicit adoption`, async ({page, context}, info) => {
  const mock = await boot(page, context);
  await request(page);
  const raw = await proposal(page), before = await stored(page);
  await button(page, names.adopt).click();
  await pendingText(page).fill(EDITED);
  const values = direction === 'under'
    ? {'汉字下限':'30','汉字上限':'50','段数下限':'4','段数上限':'6'}
    : {'汉字下限':'0','汉字上限':'10','段数下限':'0','段数上限':'1'};
  const limits = direction === 'under'
    ? {hanMin:30,hanMax:50,paragraphsMin:4,paragraphsMax:6}
    : {hanMin:0,hanMax:10,paragraphsMin:0,paragraphsMax:1};
  await fillBounds(page, values);
  const warnings = adoptionDialog(page).getByLabel('篇幅提醒', {exact:true});
  await expect(warnings).toContainText(direction === 'under' ? '汉字 20 低于作者下限 30' : '汉字 20 高于作者上限 10');
  await expect(warnings).toContainText(direction === 'under' ? '段数 2 低于作者下限 4' : '段数 2 高于作者上限 1');
  await expect(button(page, names.confirm)).toBeEnabled();
  await pendingText(page).fill(direction === 'under' ? Array(4).fill('字'.repeat(10)).join('\n') : '字字');
  await expect(warnings).toHaveCount(0);
  await pendingText(page).fill(EDITED);
  await expect(warnings).toContainText(direction === 'under' ? '汉字 20 低于作者下限 30' : '汉字 20 高于作者上限 10');
  expect(await stored(page)).toEqual(before);
  await capture(page, info, adoptionDialog(page), 'author-revision-advisory-'+direction);
  await button(page, names.confirm).click();
  expect((await draft(page)).text).toBe(EDITED);
  expect((await proposal(page)).adoption).toEqual(adoptionRecord(EDITED, limits));
  expectRawProposal(await proposal(page), raw);
  expect(mock.calls).toHaveLength(2);
  noUnexpected(mock);
});

test('numeric bounds reject negative, fractional, unsafe and inverted values without inferring freeform instructions', async ({page, context}) => {
  const mock = await boot(page, context);
  await request(page, '压缩到500至800汉字、4至6段；这些自由文字不是数值约束。');
  const before = await stored(page);
  await button(page, names.adopt).click();
  for (const name of boundNames) {
    const field = adoptionDialog(page).getByLabel(name, {exact:true});
    await expect(field).toHaveValue('');
    await expect(field).toHaveAttribute('inputmode','numeric');
    for (const invalid of ['-1','1.5','1e2','abc','9007199254740992']) {
      await field.fill(invalid);
      await expect(button(page, names.confirm)).toBeDisabled();
      expect(await stored(page)).toEqual(before);
    }
    await field.fill('');
    await expect(button(page, names.confirm)).toBeEnabled();
  }
  for (const [min, max] of [['汉字下限','汉字上限'],['段数下限','段数上限']]) {
    await fillBounds(page, {[min]:'5',[max]:'4'});
    await expect(button(page, names.confirm)).toBeDisabled();
    expect(await stored(page)).toEqual(before);
    await fillBounds(page);
  }
  await fillBounds(page, {'汉字下限':'0','段数下限':'0'});
  await expect(button(page, names.confirm)).toBeEnabled();
  await button(page, names.confirm).click();
  expect((await proposal(page)).adoption).toEqual(adoptionRecord(AFTER, {hanMin:0,paragraphsMin:0}));
  expect(mock.calls).toHaveLength(2);
  noUnexpected(mock);
});

for (const errorName of ['QuotaExceededError','SecurityError']) test(`${errorName} keeps edited confirmation buffer and raw evidence for export, retry-save and adoption`, async ({page, context}, info) => {
  const mock = await boot(page, context);
  await request(page);
  const before = await stored(page), raw = await proposal(page);
  await button(page, names.adopt).click();
  await pendingText(page).fill(EDITED);
  await fillBounds(page, {'汉字下限':'10','段数上限':'3'});
  await failWorkspaceWrites(page, errorName);
  await button(page, names.confirm).click();
  await expect(adoptionDialog(page)).toBeVisible();
  await expect(adoptionDialog(page).getByRole('alert')).toContainText('尚未安全保存');
  await expect(pendingText(page)).toHaveValue(EDITED);
  await expect(adoptionDialog(page).getByLabel('汉字下限', {exact:true})).toHaveValue('10');
  expect(await stored(page)).toEqual(before);
  expect((await draft(page)).text).toBe(BEFORE);
  expectRawProposal(await proposal(page), raw);
  expect(await page.getByLabel('改稿建议正文', {exact:true}).textContent()).toBe(AFTER);
  expect(await downloadText(page, '导出待采用正文')).toBe(EDITED);
  await capture(page, info, adoptionDialog(page), 'author-revision-edited-recovery-'+errorName);
  await page.evaluate(() => {Storage.prototype.setItem = window.revisionOriginalSet;});
  await adoptionDialog(page).getByRole('button', {name:'重试保存当前工作区', exact:true}).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(pendingText(page)).toHaveValue(EDITED);
  expect((await draft(page)).text).toBe(BEFORE);
  expect((await proposal(page)).status).toBe('proposed');
  expectRawProposal(await proposal(page), raw);
  expect(mock.calls).toHaveLength(2);
  await button(page, names.confirm).click();
  await expect(adoptionDialog(page)).toHaveCount(0);
  expect((await draft(page)).text).toBe(EDITED);
  expect((await proposal(page)).adoption).toEqual(adoptionRecord(EDITED, {hanMin:10,paragraphsMax:3}));
  expectRawProposal(await proposal(page), raw);
  expect(mock.calls).toHaveLength(2);
  noUnexpected(mock);
});

test('cross-tab workspace change denies edited adoption without overwriting newer durable content', async ({page, context}) => {
  const mock = await boot(page, context);
  await request(page);
  const raw = await proposal(page);
  await button(page, names.adopt).click();
  await pendingText(page).fill(EDITED);
  await page.evaluate(key => {
    const saved = JSON.parse(localStorage.getItem(key));
    saved.serial++;
    saved.state.title = '另一窗口的新版本';
    localStorage.setItem(key, JSON.stringify(saved));
  }, KEY);
  const newer = await stored(page);
  await button(page, names.confirm).click();
  await expect(adoptionDialog(page)).toBeVisible();
  await expect(page.locator('.recovery-banner')).toContainText('另一窗口');
  await expect(pendingText(page)).toHaveValue(EDITED);
  expect(await stored(page)).toEqual(newer);
  expect((await draft(page)).text).toBe(BEFORE);
  expect((await proposal(page)).status).toBe('proposed');
  expectRawProposal(await proposal(page), raw);
  expect(mock.calls).toHaveLength(2);
  await button(page, '返回比较').click();
  await expect(adoptionDialog(page)).toHaveCount(0);
  expect(await stored(page)).toEqual(newer);
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
    await pendingText(page).fill(EDITED);
    // A queued editor change behind a modal must still be checked at confirmation.
    await page.getByLabel('章节正文').evaluate((element, value) => {Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(element, value); element.dispatchEvent(new Event('input', {bubbles:true}));}, FACT+'未保存修改');
    const before = await stored(page);
    await button(page, names.confirm).click();
    expect(await stored(page)).toEqual(before);
    expect((await draft(page)).text).toBe(BEFORE);
    await expect(pendingText(page)).toHaveValue(EDITED);
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
  await pendingText(page).fill(EDITED);
  await fillBounds(page, {'汉字下限':'10','段数上限':'3'});
  expect(await stored(page)).toEqual(backup);
  await page.reload();
  await expect(page.getByRole('dialog', {name:'确认采用改稿建议'})).toHaveCount(0);
  expect((await draft(page)).text).toBe(BEFORE);
  expect((await proposal(page)).result.text).toBe(AFTER);
  await button(page, names.adopt).click();
  await expect(pendingText(page)).toHaveValue(AFTER);
  for (const name of boundNames) await expect(adoptionDialog(page).getByLabel(name, {exact:true})).toHaveValue('');
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
