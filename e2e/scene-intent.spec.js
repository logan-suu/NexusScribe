// Browser plugin not available. Local Playwright only; all API traffic blocked.
// Flow: saved workspace -> inspect intent, switch chapters/edit/refresh -> exact
// saved goal/exitState and matching candidate/context metadata, with zero calls.
import {test, expect} from '@playwright/test';
import * as engine from '../src/domain/engine.js';
import {KEY} from '../src/storage.js';
import {fixture, staleFixture, workspace, GOAL, EXIT, PROSE, provider, manualFixture} from '../tests/fixtures/scene-intent.js';

const card = page => page.getByRole('region', {name:'本章创作意图'});
const button = (page, name) => page.getByRole('button', {name, exact:true});
const chapter = (page, index) => page.getByRole('navigation', {name:'章节'}).getByRole('button').nth(index);
const stored = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), KEY);
async function boot(page, context, state = fixture(), onGeneration = null) {
  const errors = [], requests = [], external = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {if (['error','warning'].includes(message.type())) errors.push(message.text());});
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (!['127.0.0.1','localhost'].includes(url.hostname)) {external.push(url.href); return route.abort('blockedbyclient');}
    if (url.pathname.startsWith('/api/')) {requests.push(url.pathname); if (onGeneration && url.pathname === '/api/agent') return onGeneration(route); return route.fulfill({status:503, json:{error:{message:'No provider requests permitted'}}});}
    return route.continue();
  });
  await page.addInitScript(({key, data}) => {if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(data));}, {key:KEY, data:workspace(state)});
  await page.goto('/');
  await expect(page).toHaveURL('http://127.0.0.1:5173/');
  await expect(page).toHaveTitle('NexusScribe · 雾港来信');
  await expect(page.getByLabel('章节正文', {exact:true})).toBeVisible();
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  return {errors, requests, external};
}
function clean(run) {expect(run.errors).toEqual([]); expect(run.requests).toEqual([]); expect(run.external).toEqual([]);}
async function screenshot(page, testInfo, name) {
  await card(page).first().scrollIntoViewIfNeeded();
  const path = testInfo.outputPath(`${testInfo.project.name}-${name}.png`);
  await page.screenshot({path, fullPage:true});
  await testInfo.attach(`${testInfo.project.name}-${name}`, {path, contentType:'image/png'});
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  for (const element of await card(page).all()) {
    const box = await element.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize().width + 1);
  }
}

test('exact saved intent, chapter switching and draft revision stay aligned without calls', async ({page, context}, testInfo) => {
  const run = await boot(page, context), before = await stored(page);
  expect(await card(page).getByLabel('章节目标 · goal').textContent()).toBe(GOAL);
  expect(await card(page).getByLabel('预期退出状态 · exitState').textContent()).toBe(EXIT);
  await expect(card(page).getByLabel('创作意图来源')).toContainText('config.outline[0]');
  await expect(card(page).getByLabel('创作意图来源')).toContainText('chapter-1');
  await expect(card(page)).toContainText('参考上下文与当前已保存状态一致');
  await expect(card(page)).toContainText('无法确认当时使用的 goal / exitState');
  expect(await stored(page)).toEqual(before);
  await screenshot(page, testInfo, 'saved-intent');
  await chapter(page, 1).click();
  await expect(card(page).getByLabel('章节目标 · goal')).toHaveText('已保存为空');
  await expect(card(page)).toContainText('本章尚无候选稿');
  await chapter(page, 2).click();
  await expect(card(page).getByLabel('章节目标 · goal')).toHaveText('未保存此字段');
  await expect(card(page).getByLabel('预期退出状态 · exitState')).toHaveText('未保存此字段');
  await expect(card(page)).not.toContainText('不能借用计划描述');
  await screenshot(page, testInfo, 'missing-intent');
  await chapter(page, 0).click();
  await button(page, '编辑此稿').click();
  await expect(card(page)).toContainText('候选编辑尚未保存');
  await page.getByLabel('编辑候选稿', {exact:true}).fill(PROSE+'\n作者另加一句。');
  await expect(card(page)).toContainText('对照已保存候选 draft-1 · r1');
  await button(page, '保存候选稿修改').click();
  await expect(card(page)).toContainText('对照已保存候选 draft-1 · r2');
  await expect(card(page)).not.toContainText('候选编辑尚未保存');
  await page.reload();
  await expect(card(page)).toContainText('对照已保存候选 draft-1 · r2');
  expect(await card(page).getByLabel('章节目标 · goal').textContent()).toBe(GOAL);
  expect((await stored(page)).state.events).toEqual([]);
  clean(run);
});

test('stale context refresh keeps prose, with long exact intent and generation-source caveat', async ({page, context}, testInfo) => {
  const state = staleFixture();
  state.config.outline[0].goal = GOAL+'\n'+('核对日期、封口和署名，保留不能确定的部分。'.repeat(8));
  const run = await boot(page, context, state), before = await stored(page);
  await expect(card(page)).toContainText('参考上下文已过期或不匹配');
  expect(await card(page).getByLabel('章节目标 · goal').textContent()).toBe(state.config.outline[0].goal);
  await screenshot(page, testInfo, 'long-stale-intent');
  await button(page, '更新参考上下文').click();
  await button(page, '取消更新').click();
  expect(await stored(page)).toEqual(before);
  await button(page, '更新参考上下文').click();
  await button(page, '确认更新参考上下文').click();
  await expect(card(page)).toContainText('参考上下文与当前已保存状态一致');
  await expect(card(page)).toContainText('无法确认当时使用的 goal / exitState');
  expect((await stored(page)).state.drafts[0].text).toBe(PROSE);
  expect((await stored(page)).state.drafts[0].review).toBeNull();
  clean(run);
});

test('legacy schema and historical/current candidates retain separate bindings', async ({page, context}, testInfo) => {
  let state = staleFixture({oldSchema:true});
  state = engine.rejectDraft(state, state.drafts[0].id);
  state = engine.stageProseDraft(state, {text:'另一份未评估的新候选。', provider, context:engine.getContext(state)}, 'ch1');
  const run = await boot(page, context, state);
  await expect(card(page)).toHaveCount(2);
  await expect(card(page).nth(0)).toContainText('对照已保存候选 draft-2 · r1');
  await expect(card(page).nth(0)).toContainText('参考上下文与当前已保存状态一致');
  await expect(card(page).nth(1)).toContainText('对照历史候选 draft-1 · r1');
  await expect(card(page).nth(1)).toContainText('schema 2');
  await expect(card(page).nth(1)).toContainText('参考上下文已过期或不匹配');
  await chapter(page, 1).click();
  await expect(card(page)).toHaveCount(1);
  await expect(card(page)).not.toContainText('draft-1');
  await chapter(page, 0).click();
  await expect(card(page)).toHaveCount(2);
  await screenshot(page, testInfo, 'candidate-switching');
  clean(run);
});

test('manual draft with outline-only edits displays current intent without claiming generation binding', async ({page, context}) => {
  const state = manualFixture();
  state.config.outline[0].goal = '当前已修改目标，尚未证明本稿实现';
  state.config.outline[0].exitState = '当前新退出状态';
  const run = await boot(page, context, state);
  expect(await card(page).getByLabel('章节目标 · goal').textContent()).toBe(state.config.outline[0].goal);
  expect(await card(page).getByLabel('预期退出状态 · exitState').textContent()).toBe(state.config.outline[0].exitState);
  await expect(card(page)).toContainText('参考上下文与当前已保存状态一致');
  await expect(card(page)).toContainText('无法确认当时使用的 goal / exitState');
  await expect(page.getByLabel('手写稿来源')).toBeVisible();
  const before = await stored(page);
  await chapter(page, 1).click(); await chapter(page, 0).click();
  expect(await stored(page)).toEqual(before);
  clean(run);
});

test('new generation preserves initial request intent across edit, reload and explicit context refresh', async ({page, context}, testInfo) => {
  const state = engine.createProjectFromConfig(fixture().config);
  state.config.outline[0].goal = '';
  delete state.config.outline[0].exitState;
  const captured = [];
  const run = await boot(page, context, state, async route => {
    const body = route.request().postDataJSON();
    expect(body.action).toBe('generateProse'); captured.push(body);
    return route.fulfill({status:200, json:{output:{text:PROSE, chapterId:'ch1', provider,
      generationIntent:{goal:{status:'present',value:'untrusted response metadata'}}}}});
  });
  await button(page, '生成当前章').click();
  await expect(card(page).getByLabel('初次生成请求意图')).toBeVisible();
  const initial = await stored(page), snapshot = initial.state.drafts[0].generationIntent;
  expect(snapshot.goal.value).toBe(captured[0].input.project.outline[0].goal);
  expect(snapshot.goal.value).toBe('沿已有线索推进，保持角色知识边界');
  expect(snapshot.exitState).toEqual({status:'missing',value:null});
  expect(snapshot.chapterId).toBe('ch1');
  await expect(card(page).getByLabel('章节目标 · goal')).toHaveText('已保存为空');
  await expect(card(page).getByLabel('请求目标 · goal')).toHaveText(snapshot.goal.value);
  await expect(card(page)).toContainText('这两个字段与当前已保存意图不同');
  await expect(card(page)).not.toContainText('untrusted response metadata');
  await screenshot(page, testInfo, 'initial-request-fallback');
  await button(page, '编辑此稿').click();
  await page.getByLabel('编辑候选稿', {exact:true}).fill(PROSE+'\n作者后来增加的句子。');
  await expect(card(page)).toContainText('候选编辑尚未保存');
  await button(page, '保存候选稿修改').click();
  await expect(card(page)).toContainText('当前候选已是 r2');
  expect((await stored(page)).state.drafts[0].generationIntent).toEqual(snapshot);
  // Simulate a later saved outline/config from the same supported workspace.
  // This is provenance testing, not a claim that an outline-edit UI exists.
  await page.evaluate(key => {
    const current = JSON.parse(localStorage.getItem(key));
    current.state.config.outline[0].goal = '后来保存的新目标';
    current.state.config.outline[0].exitState = '后来保存的新结尾';
    current.state.config.tone = '后来保存的新语调';
    localStorage.setItem(key, JSON.stringify(current));
  }, KEY);
  await page.reload();
  await expect(card(page).getByLabel('章节目标 · goal')).toHaveText('后来保存的新目标');
  await expect(card(page).getByLabel('请求目标 · goal')).toHaveText(snapshot.goal.value);
  await expect(card(page)).toContainText('参考上下文已过期或不匹配');
  await button(page, '更新参考上下文').click();
  await button(page, '取消更新').click();
  expect((await stored(page)).state.drafts[0].generationIntent).toEqual(snapshot);
  await button(page, '更新参考上下文').click();
  await button(page, '确认更新参考上下文').click();
  await expect(card(page)).toContainText('参考上下文与当前已保存状态一致');
  expect((await stored(page)).state.drafts[0].generationIntent).toEqual(snapshot);
  await screenshot(page, testInfo, 'request-retained-after-refresh');
  await chapter(page, 1).click();
  await expect(card(page).getByLabel('初次生成请求意图')).toHaveCount(0);
  await chapter(page, 0).click();
  await expect(card(page).getByLabel('请求目标 · goal')).toHaveText(snapshot.goal.value);
  expect(run.requests).toEqual(['/api/agent']); expect(captured).toHaveLength(1);
  expect(run.errors).toEqual([]); expect(run.external).toEqual([]);
  expect((await stored(page)).state.events).toEqual([]);
});
