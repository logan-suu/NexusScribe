import {test, expect} from '@playwright/test';
import * as engine from '../src/domain/engine.js';

// Fictional manuscripts and synthetic provider replies only. API routes are
// intercepted, and non-local traffic is blocked. Workflow evidence is not proof
// of prose quality, semantic correctness, or provider performance.
const KEY = 'nexusscribe.demo.v1';
const MANUAL = '  陆遥把未拆封的信放在窗边。雨声盖住了楼下的脚步。\n\n她只记下信封上的日期，没有猜寄信人是谁。\n';
const REVISED = MANUAL.replace('窗边', '桌角');
const NEXT = '第二天，陆遥带着那封未拆的信去找守门人。她先问昨夜谁来过，没有打开信封。';
const FACT = '陆遥从未见过寄信人。';
const CONFLICT = '陆遥认出寄信人的脸，说：“我们昨天见过。”';
const provider = {id:'manual-chapter-browser-mock', isLive:true};
const buttons = {classify:'作者分类保存 · 不调用模型', prepare:'准备手写稿 · 不提取记忆', skip:'不提取记忆 · 仅保留正文', accept:'接受此版本', confirm:'确认接受正文与所选记忆'};
const button = (page, name) => page.getByRole('button', {name, exact:true});
const stored = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), KEY);
const state = async page => (await stored(page)).state;
const draft = async page => (await state(page)).drafts.at(-1);
const article = page => page.locator('article.draft');
const workspace = (state, providerMode = 'server', extra = {}) => ({format:1, serial:0, state, editing:{}, patch:null, providerMode, ...extra});
function project() {
  return engine.createProjectFromConfig({projectId:'manual-chapter-browser', title:'窗边的信', protagonist:'陆遥', idea:'从一封未拆的信开始寻找来处', outline:[{title:'窗边的信'}, {title:'守门人'}, {title:'旧登记簿'}], chapters:[{title:'第一章 窗边的信'}, {title:'第二章 守门人'}, {title:'第三章 旧登记簿'}]});
}
function classified(text = MANUAL, initial = project()) {
  const s = engine.saveRevision(initial, 'ch1', text, initial.chapters[0].revision);
  return engine.commitPatch(s, engine.proposeCustomPatch(s, 'ch1', {intent:'local_prose'}));
}
function prepared(initial = classified(), review = false) {
  const s = engine.stageManualDraft(initial, 'ch1');
  return review ? engine.reviewDraft(s, s.drafts.at(-1).id) : s;
}
function canonProject() {
  let s = engine.saveRevision(project(), 'ch1', FACT, 1);
  s = engine.commitPatch(s, engine.proposeCustomPatch(s, 'ch1', {intent:'author_fact', statement:FACT}));
  return classified(CONFLICT, s);
}
async function boot(page, context, initial = project(), mode = 'server', extra = {}) {
  const requests = [], errors = [];
  let response = () => null;
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() !== 'error') return;
    if (/Failed to load resource: the server responded with a status of 503/.test(message.text()) && message.location().url.endsWith('/api/agent')) return;
    errors.push(message.text());
  });
  await context.route('**/*', route => ['localhost','127.0.0.1'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort('blockedbyclient'));
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url()).pathname;
    const call = {url, ...(route.request().postData() ? route.request().postDataJSON() : {})};
    requests.push(call);
    if (url === '/api/status') return route.fulfill({json:{configured:true, liveEnabled:true, callsUsed:requests.length-1, maxCalls:30}});
    const output = response(call);
    if (!output) return route.fulfill({status:503, json:{error:{message:'合成失败；没有真实模型调用'}}});
    return route.fulfill({json:{output:{...output, provider}}});
  });
  await page.addInitScript(({key, data}) => {if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(data));}, {key:KEY, data:workspace(initial, mode, extra)});
  await page.goto('/');
  await expect(page).toHaveTitle('NexusScribe · 雾港来信');
  await expect(page.getByRole('heading', {level:1})).toHaveText('第一章 窗边的信');
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  await expect(page.getByLabel('章节正文')).toBeVisible();
  return {requests, errors, respond:fn => {response = fn;}};
}
async function classify(page, text) {
  if (text !== undefined) await page.getByLabel('章节正文').fill(text);
  await button(page, buttons.classify).click();
  await expect(page.getByRole('dialog', {name:'确认改文类型'})).toBeVisible();
  await button(page, '仅局部表达，不更新设定').click();
}
async function review(page) {
  await button(page, '审查候选稿').click();
  await expect.poll(async () => (await draft(page)).review?.passed).toBe(true);
}
async function accept(page) {
  await button(page, buttons.accept).click();
  await expect(page.getByRole('dialog', {name:'确认接受候选稿与已选记忆'})).toBeVisible();
  await button(page, buttons.confirm).click();
  await expect.poll(async () => (await state(page)).chapters[0].status).toBe('ACCEPTED');
}
async function acceptanceBlocked(page) {
  const before = await state(page);
  if (await button(page, buttons.accept).isEnabled()) await button(page, buttons.accept).click();
  await expect(page.getByRole('dialog', {name:'确认接受候选稿与已选记忆'})).toHaveCount(0);
  expect(await state(page)).toEqual(before);
}
async function downloadBackup(page) {
  const downloaded = page.waitForEvent('download');
  await button(page, '导出项目备份').click();
  const stream = await (await downloaded).createReadStream();
  let raw = '';
  for await (const chunk of stream) raw += chunk;
  return JSON.parse(raw);
}
async function upload(page, backup) {
  await page.getByLabel('导入备份', {exact:true}).setInputFiles({name:'manual-chapter-backup.json', mimeType:'application/json', buffer:Buffer.from(JSON.stringify(backup))});
  await expect(page.getByRole('dialog', {name:'备份导入预览'})).toBeVisible();
  await button(page, '确认作为新项目导入').click();
  await expect(page.getByRole('dialog', {name:'备份导入预览'})).toHaveCount(0);
}
async function capture(page, info, label) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  const path = info.outputPath(`${label}.png`);
  await page.screenshot({path, fullPage:true, animations:'disabled'});
  await info.attach(label, {path, contentType:'image/png'});
}

test('manual chapter accepts exact author text with no requests, survives export/import and feeds next chapter', async ({page, context}, info) => {
  const mock = await boot(page, context);
  await classify(page, MANUAL);
  await button(page, '确认并提交状态').click();
  const source = (await state(page)).chapters[0];
  await button(page, buttons.prepare).click();
  const initial = await draft(page);
  expect(initial.text).toBe(MANUAL);
  expect(initial.manualSource).toEqual(expect.objectContaining({revision:source.revision, textSnapshot:MANUAL}));
  expect(initial.extraction.status).toBe('skipped');
  expect(initial.staging).toEqual([]);
  expect(initial.modelReview).toBeNull();
  await acceptanceBlocked(page);
  await expect(button(page, '编辑此稿')).toHaveCount(0);
  expect(await article(page).locator('.draft-prose').textContent()).toBe(MANUAL);
  await review(page);
  expect((await draft(page)).review.semanticStatus).toBe('not_evaluated');
  const before = await stored(page);
  await button(page, buttons.accept).click();
  const dialog = page.getByRole('dialog', {name:'确认接受候选稿与已选记忆'});
  await expect(dialog).toContainText('第一章 窗边的信');
  await expect(dialog).toContainText(`正文 r${source.revision}`);
  await expect(dialog).toContainText('候选 r1');
  await expect(dialog).toContainText(/未.*(模型|语义)|语义.*未/);
  expect(await stored(page)).toEqual(before);
  await capture(page, info, 'manual-zero-memory-confirmation');
  await button(page, '返回核对').click();
  expect(await stored(page)).toEqual(before);
  await accept(page);
  const accepted = await state(page);
  expect(accepted.chapters[0].text).toBe(MANUAL);
  expect(accepted.chapters[0].revision).toBe(source.revision+1);
  expect(accepted.chapters[0].revisions.find(r => r.revision === source.revision).text).toBe(MANUAL);
  expect(accepted.drafts[0].proseVersions.map(r => r.text)).toEqual([MANUAL]);
  expect(accepted.events).toEqual([]);
  expect(mock.requests).toEqual([]);
  await capture(page, info, 'manual-accepted-exact-author-chapter');
  await page.reload();
  await expect(page.getByLabel('章节正文')).toHaveValue(MANUAL);
  const backup = await downloadBackup(page);
  expect(backup.state).toEqual(accepted);
  await upload(page, backup);
  const imported = await state(page);
  expect(imported.projectId).not.toBe(accepted.projectId);
  expect(imported.importOrigin.original.state).toEqual(accepted);
  expect(imported.chapters[0].status).toBe('ACCEPTED');
  expect(imported.chapters[0].revisions).toEqual(accepted.chapters[0].revisions);
  expect(imported.events).toEqual([]);
  expect(mock.requests).toEqual([]);
  mock.respond(call => call.action === 'generateProse' ? {text:NEXT, chapterId:'ch2'} : null);
  await page.getByRole('navigation', {name:'章节'}).getByRole('button').nth(1).click();
  await button(page, '生成当前章').click();
  await expect(article(page).locator('.draft-prose')).toHaveText(NEXT);
  expect(mock.requests).toHaveLength(1);
  expect(mock.requests[0].action).toBe('generateProse');
  expect(mock.requests[0].input.chapterIndex).toBe(1);
  expect(mock.requests[0].input.context.events).toEqual([]);
  expect(mock.requests[0].input.context.sources.find(source => source.chapterId === 'ch1')).toEqual(expect.objectContaining({text:MANUAL, role:'accepted_manuscript'}));
  await capture(page, info, 'manual-accepted-next-chapter-context');
  expect(mock.errors).toEqual([]);
});

test('manual preparation rejects pending edits and same-text patch, then requires fresh source after edits', async ({page, context}, info) => {
  const mock = await boot(page, context, classified());
  await page.getByLabel('章节正文').fill(REVISED);
  await button(page, buttons.prepare).click();
  expect((await state(page)).drafts).toEqual([]);
  await expect(page.getByLabel('章节正文')).toHaveValue(REVISED);
  await page.getByLabel('章节正文').fill(MANUAL);
  await classify(page);
  expect((await state(page)).chapters[0].syncStatus).toBe('CLEAN');
  expect((await stored(page)).patch).not.toBeNull();
  await button(page, buttons.prepare).click();
  expect((await state(page)).drafts).toEqual([]);
  await button(page, '关闭影响预览').click();
  await button(page, buttons.prepare).click();
  await review(page);
  const old = await draft(page);
  await classify(page, REVISED);
  await button(page, '确认并提交状态').click();
  // The saved source changed, so its earlier explicit skip no longer applies.
  // Retained review history must not let this obsolete snapshot be reviewed or accepted.
  await expect(button(page, '审查候选稿')).toBeDisabled();
  const staleState = await state(page);
  expect(staleState.drafts.at(-1).review).toEqual(old.review);
  expect(staleState.drafts.at(-1).modelReview).toBeNull();
  expect(engine.hasCurrentExtraction(staleState, staleState.drafts.at(-1).id)).toBe(false);
  expect(() => engine.acceptDraft(staleState, staleState.drafts.at(-1).id)).toThrow(/重新审查|变化|过期/);
  await acceptanceBlocked(page);
  expect((await draft(page)).text).toBe(MANUAL);
  await expect(button(page, '编辑此稿')).toHaveCount(0);
  await button(page, '拒绝此稿').click();
  await button(page, buttons.prepare).click();
  expect((await draft(page)).text).toBe(REVISED);
  expect((await state(page)).drafts[0].status).toBe('REJECTED');
  expect((await state(page)).drafts[0].proseVersions).toEqual(old.proseVersions);
  expect(mock.requests).toEqual([]);
  await capture(page, info, 'manual-stale-source-reprepared');
  expect(mock.errors).toEqual([]);
});

for (const change of ['editing','selection','storage-health']) test(`manual acceptance blocks stale ${change} confirmation`, async ({page, context}) => {
  const mock = await boot(page, context, prepared(classified(), true));
  await button(page, buttons.accept).click();
  // Simulate a queued UI change or cross-tab event after the modal was opened.
  // Final confirmation must revalidate; modal focus alone is not a data guard.
  if (change === 'editing') await page.getByLabel('章节正文').fill(REVISED);
  if (change === 'selection') await page.getByRole('navigation', {name:'章节'}).getByRole('button').nth(1).dispatchEvent('click');
  if (change === 'storage-health') await page.evaluate(key => window.dispatchEvent(new StorageEvent('storage', {key, storageArea:localStorage, oldValue:localStorage.getItem(key), newValue:localStorage.getItem(key)})), KEY);
  const before = await state(page);
  await button(page, buttons.confirm).click();
  expect(await state(page)).toEqual(before);
  expect((await state(page)).chapters[0].status).not.toBe('ACCEPTED');
  expect(mock.requests).toEqual([]);
  expect(mock.errors).toEqual([]);
});

test('manual confirmation storage failure retains exact source and requires renewed acceptance', async ({page, context}, info) => {
  const mock = await boot(page, context, prepared(classified(), true));
  await button(page, buttons.accept).click();
  const before = await stored(page);
  await page.evaluate(() => {window.manualOriginalSet = Storage.prototype.setItem; Storage.prototype.setItem = function() {throw new DOMException('manual synthetic quota failure', 'QuotaExceededError');};});
  await button(page, buttons.confirm).click();
  expect(await stored(page)).toEqual(before);
  await expect(page.getByRole('alert')).toContainText('尚未安全保存');
  await expect(page.getByLabel('章节正文')).toHaveValue(MANUAL);
  await capture(page, info, 'manual-acceptance-storage-failure');
  await button(page, '返回核对').click();
  await page.evaluate(() => {Storage.prototype.setItem = window.manualOriginalSet;});
  await button(page, '重试保存').click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect((await state(page)).chapters[0].status).not.toBe('ACCEPTED');
  await accept(page);
  await page.reload();
  expect((await state(page)).chapters[0].text).toBe(MANUAL);
  expect(mock.requests).toEqual([]);
  expect(mock.errors).toEqual([]);
});

test('pending import resets manual skip and review; failed optional extraction can be explicitly skipped', async ({page, context}, info) => {
  const initial = prepared(classified(), true);
  const mock = await boot(page, context, initial);
  const backup = await downloadBackup(page);
  await upload(page, backup);
  const imported = await state(page);
  expect(imported.projectId).not.toBe(initial.projectId);
  expect(imported.importOrigin.original.state).toEqual(initial);
  expect(imported.drafts[0].text).toBe(MANUAL);
  expect(imported.drafts[0].extraction.status).toBe('pending');
  expect(imported.drafts[0].review).toBeNull();
  expect(imported.drafts[0].modelReview).toBeNull();
  expect(imported.drafts[0].staging).toEqual([]);
  await acceptanceBlocked(page);
  expect(mock.requests).toEqual([]);
  await button(page, buttons.skip).click();
  expect((await draft(page)).extraction.status).toBe('skipped');
  await review(page);
  expect(mock.requests).toEqual([]);
  await button(page, '提取候选记忆').click();
  await expect(page.getByLabel('候选记忆提取状态')).toContainText('提取未完成');
  expect((await draft(page)).review).toBeNull();
  expect((await draft(page)).text).toBe(MANUAL);
  await acceptanceBlocked(page);
  expect(mock.requests.map(call => call.action)).toEqual(['extractMemory']);
  await button(page, buttons.skip).click();
  expect((await draft(page)).extraction.status).toBe('skipped');
  expect((await draft(page)).staging).toEqual([]);
  await review(page);
  await accept(page);
  expect((await state(page)).events).toEqual([]);
  expect(mock.requests).toHaveLength(1, 'No automatic extraction retry or review call');
  await capture(page, info, 'manual-import-failure-explicit-skip');
  expect(mock.errors).toEqual([]);
});

test('manual Canon path blocks offline review and preserves known conflict gate on explicit server review', async ({page, context}, info) => {
  const mock = await boot(page, context, prepared(canonProject()), 'template');
  const canon = (await state(page)).facts;
  await button(page, '审查候选稿').click();
  await acceptanceBlocked(page);
  await expect(button(page, '提取候选记忆')).toBeDisabled();
  expect((await draft(page)).modelReview).toBeNull();
  expect(mock.requests).toEqual([]);
  await button(page, '模型运行方式').click();
  await button(page, '检查服务连接').click();
  await button(page, '使用真实模型').click();
  expect(mock.requests.map(call => call.url)).toEqual(['/api/status']);
  mock.respond(call => call.action === 'reviewChapter' ? {summary:'合成已知设定冲突，仅测试门禁', issues:[], checks:[], factChecks:[{factId:canon[0].id, recordVersion:canon[0].recordVersion, status:'contradiction', explanation:'原设定与手写候选冲突', sourceQuote:CONFLICT}]} : null);
  await button(page, '审查候选稿').click();
  await expect(page.getByLabel('已确认设定逐条审阅')).toContainText('冲突');
  await acceptanceBlocked(page);
  expect(mock.requests.map(call => call.action).filter(Boolean)).toEqual(['reviewChapter']);
  expect(mock.requests[1].input.context.facts).toEqual(canon);
  expect(mock.requests[1].input.text).toBe(CONFLICT);
  await capture(page, info, 'manual-canon-conflict-blocked');
  await button(page, '审阅并决定此项例外').click();
  await expect(button(page, '确认接受此项例外，保留原设定')).toBeDisabled();
  await page.getByLabel('作者决定理由').fill('这是角色声称见过，不修改原设定');
  await button(page, '确认接受此项例外，保留原设定').click();
  await accept(page);
  expect((await state(page)).facts).toEqual(canon);
  expect((await state(page)).events).toEqual([]);
  expect(mock.requests).toHaveLength(2);
  expect(mock.errors).toEqual([]);
});

test('editing an accepted manual chapter requires fresh acceptance before next chapter generation', async ({page, context}, info) => {
  const pending = prepared(classified(), true);
  const accepted = engine.acceptDraft(pending, pending.drafts[0].id);
  const mock = await boot(page, context, accepted);
  await classify(page, REVISED);
  await button(page, '确认并提交状态').click();
  const changed = await state(page);
  expect(changed.chapters[0].status).toBe('DRAFT');
  expect(changed.chapters[0].syncStatus).toBe('CLEAN');
  expect(changed.chapters[0].revisions.some(version => version.text === MANUAL)).toBe(true);
  expect(changed.drafts[0].text).toBe(MANUAL);
  expect(changed.drafts[0].status).toBe('ACCEPTED');
  expect(engine.getContext(changed).sources.find(source => source.chapterId === 'ch1').role).toBe('unaccepted_manuscript');
  await page.getByRole('navigation', {name:'章节'}).getByRole('button').nth(1).click();
  await button(page, '生成当前章').click();
  await expect(page.getByRole('status')).toContainText('请先审阅并接受前一章');
  expect(mock.requests).toEqual([]);
  await page.getByRole('navigation', {name:'章节'}).getByRole('button').nth(0).click();
  await button(page, buttons.prepare).click();
  expect((await draft(page)).text).toBe(REVISED);
  await review(page);
  await accept(page);
  expect((await state(page)).chapters[0].text).toBe(REVISED);
  expect(mock.requests).toEqual([]);
  mock.respond(call => call.action === 'generateProse' ? {text:NEXT, chapterId:'ch2'} : null);
  await page.getByRole('navigation', {name:'章节'}).getByRole('button').nth(1).click();
  await button(page, '生成当前章').click();
  await expect(article(page).locator('.draft-prose')).toHaveText(NEXT);
  expect(mock.requests).toHaveLength(1);
  expect(mock.requests[0].input.context.sources.find(source => source.chapterId === 'ch1')).toEqual(expect.objectContaining({text:REVISED, role:'accepted_manuscript'}));
  expect(mock.requests[0].input.context.events).toEqual([]);
  await capture(page, info, 'manual-revised-accepted-source-next-chapter');
  expect(mock.errors).toEqual([]);
});
