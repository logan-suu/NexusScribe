import {test, expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import * as engine from '../src/domain/engine.js';
import {segmentProse} from '../src/domain/prose.js';

// The first chapter replays retained model prose verbatim. Chapters 2–3 and ALL
// provider judgments are synthetic: this suite proves workflow, not prose or
// semantic quality. No provider request is allowed to leave the browser.
const retained = JSON.parse(readFileSync(new URL('../eval/history/prose-pipeline-v1/completed-02.json', import.meta.url), 'utf8'));
const retainedExtraction = JSON.parse(readFileSync(new URL('../eval/history/prose-pipeline-v1/completed-03.json', import.meta.url), 'utf8'));
const KEY = 'nexusscribe.demo.v1';
const provider = {id:'multichapter-mock', isLive:true};
const unsupported = retainedExtraction.staging[1];
const kept = retainedExtraction.staging[8];
const second = '第二天，程岚带着装纸屑的空表壳找到管理员。管理员说：“昨夜没有开过门。”\n\n程岚把押金条压在登记簿旁，请他核对昨晚的记录。阿陶站在门外，没有看见表壳里的纸屑。\n\n管理员翻到空白的一页，没有回答。';
const revisedSecond = second.replace('昨夜没有开过门', '昨夜开过一次南门');
const third = '程岚沿登记簿指向的南门走去，把空表壳留在自己口袋里。她没有告诉阿陶管理员改了口。\n\n南门内侧压着一条湿纸带。程岚没有把它和表壳里的纸屑拼在一起，只先记下纸带的位置。\n\n门外响起脚步声。她关上登记簿，等那人先开口。';
const state = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)).state, KEY);
const workspace = s => ({format:1, serial:0, state:s, editing:{}, patch:null, providerMode:'server'});
const article = page => page.locator('article.draft');
const candidate = (page, n) => page.getByRole('article', {name:new RegExp(`^候选记忆 ${n}：`)});
const choice = (page, action, n) => page.getByRole('button', {name:new RegExp(`^${action}候选记忆 ${n}：`)});

function project() {
  return engine.createProjectFromConfig({
    projectId:'multichapter-story', title:'雨夜寄存室', protagonist:'程岚',
    idea:'修表师沿纸屑寻找匿名来信的来处', pov:'第三人称限知，只跟随程岚',
    tone:'克制、带一点干涩幽默', goal:'沿证据推进，不提前揭晓寄信人',
    boundaries:'阿陶不能无来源知道信封内容；寄信人保持未知',
    outline:[{title:'雨夜寄存室',goal:'保存纸屑，决定问管理员'}, {title:'次日登记簿',goal:'核对管理员说法'}, {title:'南门纸带',goal:'沿登记簿寻找证据'}],
    chapters:[{title:'第一章 雨夜寄存室'}, {title:'第二章 次日登记簿'}, {title:'第三章 南门纸带'}],
  });
}

function extraction(text, chapterId) {
  if (chapterId === 'ch1') return {staging:[unsupported, kept], reviewNotes:['合成重放；语义判断不是质量证据']};
  const index = chapterId === 'ch2' ? 0 : 1;
  const paragraph = segmentProse(text)[index];
  const label = chapterId === 'ch2' ? (text.includes('昨夜开过一次南门') ? '管理员说昨夜开过一次南门' : '管理员说昨夜没有开过门') : '程岚记下南门内侧湿纸带的位置';
  return {staging:[{label, sourceParagraphIndex:index, sourceQuote:paragraph.text, sourceStart:paragraph.start, sourceEnd:paragraph.end}], reviewNotes:[]};
}

const review = {summary:'合成整章审阅：未报告阻塞；不构成语义质量证据', issues:[], checks:[], factChecks:[], provider};

async function boot(page, context, initial = project()) {
  const errors = [], calls = [], delayed = [];
  let failExtraction = false, delayExtraction = false, delayReview = false;
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() !== 'error') return;
    if (/Failed to load resource: the server responded with a status of 503/.test(message.text()) && message.location().url.endsWith('/api/agent')) return;
    errors.push(message.text());
  });
  await context.route('**/*', route => ['localhost','127.0.0.1'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort('blockedbyclient'));
  await page.route('**/api/**', route => route.fulfill({status:503, json:{error:{message:'Unexpected endpoint; no live provider permitted'}}}));
  await page.route('**/api/status', route => route.fulfill({json:{configured:true, liveEnabled:true, callsUsed:calls.length, maxCalls:30}}));
  await page.route('**/api/agent', async route => {
    const request = route.request().postDataJSON();
    calls.push(request);
    const {action, input} = request;
    let output;
    if (action === 'generateProse') output = {text:[retained.text, second, third][input.chapterIndex], chapterId:input.project.outline[input.chapterIndex].id};
    else if (action === 'extractMemory') {
      output = extraction(input.text, input.chapterId);
      if (failExtraction) {failExtraction = false; await route.fulfill({status:503, json:{error:{message:'合成提取失败；无真实调用'}}}); return;}
      if (delayExtraction) {delayExtraction = false; await new Promise(resolve => delayed.push(resolve));}
    } else if (action === 'reviewChapter') {
      expect(input).not.toHaveProperty('memoryCandidates');
      output = review;
      if (delayReview) {delayReview = false; await new Promise(resolve => delayed.push(resolve));}
    } else if (action === 'auditMemoryCandidate') {
      expect(Object.keys(input).sort()).toEqual(['label','sourceQuote']);
      output = {status:input.label === unsupported.label ? 'unsupported' : 'supported', explanation:'合成单条判断，仅测试隔离权限与作者选择'};
    } else if (action === 'interpretRevision') output = {summary:'作者修改原文，仍需明确分类', suggestedFacts:[], operations:[], questions:[]};
    else throw Error(`Unexpected mock action: ${action}`);
    await route.fulfill({json:{output:{...output, provider}}});
  });
  await page.addInitScript(({key, data}) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(data));
    // Deliberately ignore transport abort; stale/cancelled callbacks must remain inert.
    const original = window.fetch;
    window.fetch = (url, options = {}) => original(url, {...options, signal:undefined});
  }, {key:KEY, data:workspace(initial)});
  await page.goto('/');
  await expect(page).toHaveTitle('NexusScribe · 雾港来信');
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  return {calls, errors, failNextExtraction:() => {failExtraction = true;}, delayNextExtraction:() => {delayExtraction = true;}, delayNextReview:() => {delayReview = true;}, delayed};
}

async function chapter(page, index) {
  await page.getByRole('navigation', {name:'章节'}).getByRole('button').nth(index).click();
  await expect(page.getByRole('heading', {level:1})).toHaveText(['第一章 雨夜寄存室','第二章 次日登记簿','第三章 南门纸带'][index]);
}
async function generate(page, text) {
  await page.getByRole('button', {name:'生成当前章'}).click();
  await expect(article(page).first().locator('.draft-prose')).toHaveText(text);
}
async function extract(page) {
  await page.getByRole('button', {name:'提取候选记忆', exact:true}).click();
  await expect(page.getByRole('button', {name:'审查候选稿'})).toBeEnabled();
}
async function reviewCurrent(page) {
  await page.getByRole('button', {name:'审查候选稿'}).click();
  await expect(article(page).getByText(review.summary, {exact:true})).toBeVisible();
}
async function audit(page, n, status = 'supported') {
  await choice(page, '独立核对', n).click();
  await expect(candidate(page, n).getByLabel(`独立核对状态 ${n}`)).toContainText('独立核对已完成');
  await expect(choice(page, '保留', n))[status === 'supported' ? 'toBeEnabled' : 'toBeDisabled']();
  if (status === 'supported') {await expect(candidate(page, n).getByLabel('模型记忆判断风险')).toBeVisible(); await expect(candidate(page, n)).toContainText('模型判断：原文支持（可能误判）');}
}
async function accept(page, chapterIndex, selectedCount) {
  const before = await state(page);
  await page.getByRole('button', {name:'接受此版本'}).click();
  const dialog = page.getByRole('dialog', {name:'确认接受候选稿与已选记忆'});
  await expect(dialog).toContainText(`已选的 ${selectedCount}`);
  await expect(dialog).toContainText(['第一章 雨夜寄存室','第二章 次日登记簿','第三章 南门纸带'][chapterIndex]);
  expect((await state(page)).events).toEqual(before.events);
  await dialog.getByRole('button', {name:'确认接受正文与所选记忆'}).click();
  await expect.poll(async () => (await state(page)).chapters[chapterIndex].status).toBe('ACCEPTED');
}
async function capture(page, info, label) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  const path = info.outputPath(`${label}.png`);
  await page.screenshot({path, fullPage:true, animations:'disabled'});
  await info.attach(label, {path, contentType:'image/png'});
}

test('three-chapter prose-first journey keeps memory current, explicit, and chapter-scoped', async ({page, context}, info) => {
  const mock = await boot(page, context);
  await chapter(page, 1);
  await page.getByRole('button', {name:'生成当前章'}).click();
  await expect(page.getByRole('status')).toContainText('请先审阅并接受前一章');
  expect(mock.calls).toHaveLength(0);
  await chapter(page, 0);
  await generate(page, retained.text);
  mock.failNextExtraction();
  await page.getByRole('button', {name:'提取候选记忆', exact:true}).click();
  await expect(page.getByLabel('候选记忆提取状态')).toContainText('提取未完成');
  expect((await state(page)).drafts[0].text).toBe(retained.text);
  expect((await state(page)).events).toEqual([]);
  await page.reload();
  await expect(page.getByRole('heading', {level:1})).toHaveText('第一章 雨夜寄存室');
  expect(mock.calls).toHaveLength(2);
  mock.delayNextExtraction();
  await page.getByRole('button', {name:'提取候选记忆', exact:true}).click();
  await expect.poll(() => mock.delayed.length).toBe(1);
  await page.getByRole('button', {name:'取消请求'}).click();
  await expect(page.getByLabel('候选记忆提取状态')).toContainText('提取已取消');
  await extract(page);
  const currentAttempt = (await state(page)).drafts[0].extraction.attempt;
  mock.delayed[0]();
  await reviewCurrent(page);
  expect((await state(page)).drafts[0].extraction.attempt).toBe(currentAttempt);
  await expect(choice(page, '保留', 1)).toBeDisabled();
  await expect(choice(page, '保留', 2)).toBeDisabled();
  await audit(page, 1, 'unsupported');
  await choice(page, '拒绝', 1).click();
  await audit(page, 2);
  await choice(page, '保留', 2).click();
  expect((await state(page)).events).toEqual([]);
  await capture(page, info, '01-retained-evidence-explicit-selection');
  await accept(page, 0, 1);
  const acceptedFirst = await state(page);
  expect(acceptedFirst.events.map(event => event.label)).toEqual([kept.label]);
  expect(acceptedFirst.events[0].source.quote).toBe(kept.sourceQuote);

  await chapter(page, 1);
  await expect(article(page)).toHaveCount(0);
  await generate(page, second);
  const secondRequest = mock.calls.filter(call => call.action === 'generateProse').at(-1);
  expect(secondRequest.input.context.events.map(event => event.label)).toEqual([kept.label]);
  expect(secondRequest.input.context.sources.find(source => source.chapterId === 'ch1').text).toBe(retained.text);
  await expect(article(page)).toHaveCount(1);
  await extract(page);
  await reviewCurrent(page);
  await audit(page, 1);
  await choice(page, '保留', 1).click();
  const beforeEdit = (await state(page)).drafts.at(-1);
  await page.getByRole('button', {name:'编辑此稿'}).click();
  await page.getByLabel('编辑候选稿').fill(revisedSecond);
  await page.getByRole('button', {name:'保存候选稿修改'}).click();
  const edited = (await state(page)).drafts.at(-1);
  expect(edited.proseVersions.map(version => version.text)).toEqual([second, revisedSecond]);
  expect(edited.staging).toEqual([]);
  expect(edited.memoryDecisions).toEqual([]);
  expect(edited.modelReview).toBeNull();
  expect(edited.memoryArchives.some(archive => archive.candidates.some(item => item.id === beforeEdit.staging[0].id))).toBe(true);
  await expect(page.getByRole('button', {name:'接受此版本'})).toBeDisabled();
  await extract(page);
  await reviewCurrent(page);
  await audit(page, 1);
  await choice(page, '保留', 1).click();
  await capture(page, info, '02-author-revision-new-evidence');
  await accept(page, 1, 1);
  expect((await state(page)).events.map(event => event.label)).toEqual([kept.label, '管理员说昨夜开过一次南门']);

  await chapter(page, 2);
  await expect(article(page)).toHaveCount(0);
  await generate(page, third);
  const thirdRequest = mock.calls.filter(call => call.action === 'generateProse').at(-1);
  expect(thirdRequest.input.context.events.map(event => event.label)).toEqual([kept.label, '管理员说昨夜开过一次南门']);
  expect(JSON.stringify(thirdRequest.input.context)).not.toContain('管理员说昨夜没有开过门');
  await extract(page);
  await reviewCurrent(page);
  await audit(page, 1);
  await choice(page, '保留', 1).click();
  await accept(page, 2, 1);
  await page.reload();
  const complete = await state(page);
  expect(complete.chapters.map(item => item.status)).toEqual(['ACCEPTED','ACCEPTED','ACCEPTED']);
  expect(complete.chapters.map(item => item.text)).toEqual([retained.text, revisedSecond, third]);
  expect(complete.events).toHaveLength(3);
  expect(complete.drafts).toHaveLength(3);
  await expect(page.getByRole('heading', {level:1})).toHaveText('第三章 南门纸带');
  await expect(article(page)).toHaveCount(1);
  await capture(page, info, '03-three-chapters-reloaded');
  for (let index = 0; index < 3; index++) {await chapter(page, index); await expect(article(page)).toHaveCount(1); await expect(article(page).locator('.draft-prose')).toHaveText(complete.chapters[index].text);}
  expect(mock.calls.map(call => call.action)).toEqual(['generateProse','extractMemory','extractMemory','extractMemory','reviewChapter','auditMemoryCandidate','auditMemoryCandidate','generateProse','extractMemory','reviewChapter','auditMemoryCandidate','extractMemory','reviewChapter','auditMemoryCandidate','generateProse','extractMemory','reviewChapter','auditMemoryCandidate']);
  expect(mock.errors).toEqual([]);
});

function preparedDraft(s, chapterId, text, staging) {
  s = engine.stageProseDraft(s, {text, provider, context:engine.getContext(s)}, chapterId);
  const id = s.drafts.at(-1).id;
  s = engine.beginMemoryExtraction(s, id);
  s = engine.attachMemoryExtraction(s, id, {staging, reviewNotes:[], provider}, engine.createExtractionBinding(s, id));
  s = engine.reviewDraft(s, id);
  s = engine.attachSemanticReview(s, id, review, engine.createReviewBinding(s, id));
  for (const item of engine.createMemoryReviewInput(s, id)) {
    s = engine.beginMemorySupportAssessment(s, id, item.candidateId);
    s = engine.attachMemorySupportAssessment(s, id, item.candidateId, {status:'supported', explanation:'合成预置审阅', provider}, engine.createMemorySupportBinding(s, id, item.candidateId));
    const gate = engine.getMemoryReviewGate(s, id).find(candidate => candidate.candidateId === item.candidateId);
    s = engine.decideMemoryCandidate(s, id, {candidateId:item.candidateId, action:'keep', reviewHash:gate.reviewHash}, gate.binding);
  }
  return s;
}
function acceptedWithPending() {
  let s = preparedDraft(project(), 'ch1', retained.text, [kept]);
  s = engine.acceptDraft(s, s.drafts.at(-1).id);
  return preparedDraft(s, 'ch2', second, extraction(second, 'ch2').staging);
}

test('revising accepted source preserves history but excludes stale memory and gates old chapter drafts', async ({page, context}, info) => {
  const initial = acceptedWithPending(), pendingId = initial.drafts.at(-1).id;
  const mock = await boot(page, context, initial);
  await chapter(page, 0);
  const revised = retained.text.replace(kept.sourceQuote, '阿陶把回形针搁回柜台。程岚把纸屑装进小纸袋，决定暂时不问管理员。');
  await page.getByLabel('章节正文').fill(revised);
  await page.getByRole('button', {name:'保存并分析'}).click();
  await expect(page.getByRole('dialog', {name:'确认改文类型'})).toBeVisible();
  await page.getByRole('button', {name:'仅局部表达，不更新设定'}).click();
  await page.getByRole('button', {name:'确认并提交状态'}).click();
  const changed = await state(page);
  expect(changed.events).toEqual(initial.events);
  expect(changed.chapters[0].revisions.some(version => version.text === retained.text)).toBe(true);
  await page.getByRole('button', {name:'查看场景上下文'}).click();
  const currentContext = JSON.parse(await page.getByRole('dialog', {name:'场景上下文'}).locator('pre').textContent());
  expect(currentContext.events).toEqual([]);
  expect(currentContext.sources[0].text).toBe(revised);
  await page.getByRole('button', {name:'关闭详情'}).click();
  await chapter(page, 1);
  await expect(page.getByRole('button', {name:'接受此版本'})).toBeDisabled();
  const callsBefore = mock.calls.length;
  await page.getByRole('button', {name:'提取候选记忆', exact:true}).click();
  await expect(page.getByRole('status')).toContainText('已变化');
  expect(mock.calls).toHaveLength(callsBefore);
  expect((await state(page)).drafts.find(draft => draft.id === pendingId).status).not.toBe('ACCEPTED');
  await page.getByRole('button', {name:'更新参考上下文'}).click();
  const refresh = page.getByRole('dialog', {name:'确认更新候选参考上下文'});
  await expect(refresh).toContainText('第二章 次日登记簿');
  const beforeCancel = await state(page);
  await refresh.getByRole('button', {name:'取消更新'}).click();
  expect(await state(page)).toEqual(beforeCancel);
  await page.getByRole('button', {name:'更新参考上下文'}).click();
  await page.getByRole('button', {name:'确认更新参考上下文', exact:true}).click();
  const rebased = (await state(page)).drafts.find(draft => draft.id === pendingId);
  expect(mock.calls).toHaveLength(callsBefore);
  expect(rebased.text).toBe(second);
  expect(rebased.proseVersions).toEqual(initial.drafts.at(-1).proseVersions);
  expect(rebased.context.events).toEqual([]);
  expect(rebased.context.sources[0].text).toBe(revised);
  expect(rebased.memoryDecisions).toEqual([]);
  expect(rebased.staging).toEqual([]);
  await extract(page);
  await reviewCurrent(page);
  await expect(choice(page, '保留', 1)).toBeDisabled();
  await audit(page, 1);
  await choice(page, '保留', 1).click();
  expect((await state(page)).events).toEqual(initial.events);
  await accept(page, 1, 1);
  expect(mock.calls.map(call => call.action)).toEqual(['interpretRevision','extractMemory','reviewChapter','auditMemoryCandidate']);
  await capture(page, info, '04-stale-source-excluded-old-candidate-blocked');
  expect(mock.errors).toEqual([]);
});

for (const stage of ['extractMemory','reviewChapter']) test(`${stage} result survives a storage failure, local retry and reload without another request`, async ({page, context}, info) => {
  const mock = await boot(page, context);
  await chapter(page, 0);
  await generate(page, retained.text);
  if (stage === 'reviewChapter') {await extract(page); mock.delayNextReview();}
  else mock.delayNextExtraction();
  await page.getByRole('button', {name:stage === 'extractMemory' ? '提取候选记忆' : '审查候选稿', exact:true}).click();
  await expect.poll(() => mock.delayed.length).toBe(1);
  await page.evaluate(() => {window.originalMultichapterSet = Storage.prototype.setItem; Storage.prototype.setItem = function() {throw new DOMException('Synthetic quota exhausted', 'QuotaExceededError');};});
  mock.delayed[0]();
  await expect(page.getByRole('alert')).toContainText('尚未安全保存');
  if (stage === 'extractMemory') await expect(candidate(page, 2)).toBeVisible();
  else await expect(article(page).getByText(review.summary, {exact:true})).toBeVisible();
  const requestCount = mock.calls.length;
  await capture(page, info, `06-${stage}-result-retained-before-retry`);
  await page.evaluate(() => {Storage.prototype.setItem = window.originalMultichapterSet;});
  await page.getByRole('button', {name:'重试保存'}).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(mock.calls).toHaveLength(requestCount);
  await page.reload();
  if (stage === 'extractMemory') {expect((await state(page)).drafts[0].staging).toHaveLength(2); await expect(candidate(page, 2)).toBeVisible();}
  else {expect((await state(page)).drafts[0].modelReview.summary).toBe(review.summary); await expect(article(page).getByText(review.summary, {exact:true})).toBeVisible();}
  expect(mock.calls).toHaveLength(requestCount);
  expect(mock.errors).toEqual([]);
});

test('exported multi-chapter backup imports separately and cannot reuse pending audit permissions', async ({page, context}, info) => {
  const initial = acceptedWithPending();
  const mock = await boot(page, context, initial);
  await chapter(page, 1);
  await expect(choice(page, '保留', 1)).toBeEnabled();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', {name:'导出项目备份'}).click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  let raw = '';
  for await (const chunk of stream) raw += chunk;
  const backup = JSON.parse(raw);
  expect(backup.state.events).toEqual(initial.events);
  expect(backup.state.drafts.at(-1).memoryDecisions).toHaveLength(1);
  await page.getByLabel('导入备份', {exact:true}).setInputFiles({name:'multichapter-backup.json', mimeType:'application/json', buffer:Buffer.from(raw)});
  await expect(page.getByRole('dialog', {name:'备份导入预览'})).toBeVisible();
  await page.getByRole('button', {name:'确认作为新项目导入'}).click();
  const imported = await state(page);
  expect(imported.projectId).not.toBe(initial.projectId);
  expect(imported.importOrigin.original.state).toEqual(backup.state);
  expect(imported.events.map(event => event.label)).toEqual([kept.label]);
  const pending = imported.drafts.at(-1);
  expect(pending.memoryDecisions).toEqual([]);
  expect(pending.staging).toEqual([]);
  expect(pending.modelReview).toBeNull();
  expect(pending.extraction.status).toBe('pending');
  await chapter(page, 1);
  await expect(page.getByRole('button', {name:'接受此版本'})).toBeDisabled();
  await page.reload();
  await expect(page.getByRole('heading', {level:1})).toHaveText('第二章 次日登记簿');
  expect(mock.calls).toHaveLength(0);
  await extract(page);
  await reviewCurrent(page);
  await expect(choice(page, '保留', 1)).toBeDisabled();
  await audit(page, 1);
  await choice(page, '保留', 1).click();
  await accept(page, 1, 1);
  await capture(page, info, '05-backup-import-reaudited');
  await page.getByLabel('切换项目').selectOption(initial.projectId);
  expect((await state(page)).drafts.at(-1)).toEqual(initial.drafts.at(-1));
  expect((await state(page)).events).toEqual(initial.events);
  expect(mock.calls.map(call => call.action)).toEqual(['extractMemory','reviewChapter','auditMemoryCandidate']);
  expect(mock.errors).toEqual([]);
});
