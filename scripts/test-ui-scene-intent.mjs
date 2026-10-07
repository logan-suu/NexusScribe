// Zero-call saved-intent display regressions. No model/quality assessment.
import {JSDOM} from 'jsdom';
import {build} from 'esbuild';
import {mkdir, symlink} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import * as engine from '../src/domain/engine.js';
import {getSceneIntentReference} from '../src/domain/scene-intent.js';
import {KEY} from '../src/storage.js';
import {fixture, staleFixture, workspace, GOAL, EXIT, PROSE, provider, manualFixture, templateFixture} from '../tests/fixtures/scene-intent.js';

const out = '/tmp/nexusscribe-ui-scene-intent';
await mkdir(out+'/node_modules', {recursive:true});
for (const name of ['react','react-dom','lucide-react']) {
  try {await symlink(resolve('node_modules', name), out+'/node_modules/'+name);}
  catch (error) {if (error.code !== 'EEXIST') throw error;}
}
await build({entryPoints:['src/App.jsx','src/components/SceneIntent.jsx'], bundle:true, packages:'external', format:'esm', outdir:out, outExtension:{'.js':'.mjs'}, loader:{'.css':'empty'}, jsx:'automatic'});
const dom = new JSDOM('<!doctype html><html><body></body></html>', {url:'http://localhost/'});
for (const key of ['window','document','HTMLElement','Element','Node','MutationObserver','localStorage','getComputedStyle','File']) globalThis[key] = dom.window[key];
Object.defineProperty(globalThis, 'navigator', {value:dom.window.navigator, configurable:true});
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
dom.window.HTMLElement.prototype.scrollIntoView = function() {};
const React = await import('react');
const {render, screen, within, cleanup, fireEvent, waitFor, act} = await import('@testing-library/react');
const user = (await import('@testing-library/user-event')).default.setup();
const {default:App} = await import(out+'/App.mjs');
const {default:SceneIntent} = await import(out+'/components/SceneIntent.mjs');
let calls = [];
globalThis.fetch = async (...args) => {calls.push(args); throw Error('No API calls permitted for scene-intent UI');};
const stored = () => JSON.parse(localStorage.getItem(KEY));
const button = name => screen.getByRole('button', {name, exact:true});
const intent = () => screen.getByRole('region', {name:'本章创作意图'});
const chapter = index => within(screen.getByRole('navigation', {name:'章节'})).getAllByRole('button')[index];
function boot(state = fixture()) {cleanup(); localStorage.clear(); localStorage.setItem(KEY, JSON.stringify(workspace(state))); render(React.createElement(App));}

boot(); const before = structuredClone(stored());
assert.equal(within(intent()).getByLabelText('章节目标 · goal').textContent, GOAL);
assert.equal(within(intent()).getByLabelText('预期退出状态 · exitState').textContent, EXIT);
assert.match(intent().textContent, /config.outline\[0\]/); assert.match(intent().textContent, /大纲 ID：chapter-1/);
assert.match(intent().textContent, /r1/); assert.match(intent().textContent, /未保存准备或生成时的完整大纲快照/);
assert.match(intent().textContent, /不自动判定达成/); assert.match(intent().textContent, /参考上下文与当前已保存状态一致/);
assert.deepEqual(stored(), before);
await user.click(chapter(1));
assert.equal(within(intent()).getByLabelText('章节目标 · goal').textContent, '已保存为空');
assert.match(intent().textContent, /本章尚无候选稿/); assert.doesNotMatch(intent().textContent, /draft-1/);
await user.click(chapter(2));
assert.equal(within(intent()).getByLabelText('章节目标 · goal').textContent, '未保存此字段');
assert.equal(within(intent()).getByLabelText('预期退出状态 · exitState').textContent, '未保存此字段');
assert.doesNotMatch(intent().textContent, /不能借用计划描述|主角愿望/);
await user.click(chapter(0));
await user.click(button('编辑此稿'));
assert.match(intent().textContent, /候选编辑尚未保存/);
fireEvent.change(screen.getByLabelText('编辑候选稿', {exact:true}), {target:{value:PROSE+'\n作者另加一句。'}});
assert.match(intent().textContent, /r1/);
await user.click(button('保存候选稿修改'));
assert.match(intent().textContent, /r2/); assert.doesNotMatch(intent().textContent, /候选编辑尚未保存/);
assert.equal(within(intent()).getByLabelText('章节目标 · goal').textContent, GOAL);
assert.deepEqual(stored().state.events, []);
assert.deepEqual(calls, []);
console.log('PASS saved intent: exact whitespace/fields, missing/empty, chapter switching, saved draft revision and edit warning; no writes on read or network calls');

for (const oldSchema of [false, true]) {
  boot(staleFixture({oldSchema})); const text = stored().state.drafts[0].text;
  assert.match(intent().textContent, /参考上下文已过期或不匹配/);
  await user.click(button('更新参考上下文'));
  await user.click(button('确认更新参考上下文'));
  assert.match(intent().textContent, /参考上下文与当前已保存状态一致/);
  assert.match(intent().textContent, /无法确认当时使用的 goal/);
  assert.equal(stored().state.drafts[0].text, text);
}
let mixed = engine.rejectDraft(fixture(), fixture().drafts[0].id);
mixed = engine.stageProseDraft(mixed, {text:'同章新候选。', provider, context:engine.getContext(mixed)}, 'ch1');
boot(mixed);
let cards = screen.getAllByRole('region', {name:'本章创作意图'});
assert.equal(cards.length, 2);
assert.match(cards[0].textContent, /对照已保存候选 draft-2/);
assert.match(cards[1].textContent, /对照历史候选 draft-1/);
assert.match(cards[1].textContent, /历史正文与记录保持不变/);
await user.click(chapter(1)); await user.click(chapter(0));
assert.equal(screen.getAllByRole('region', {name:'本章创作意图'}).length, 2);
assert.deepEqual(calls, []);
console.log('PASS saved reference context: same-version context changes and schema-2 stale, explicit refresh preserves prose, rejected/new candidate bindings remain separate');

// Missing snapshot and unsupported field rendering remain honest without
// teaching storage to accept damaged or legacy records it already rejects.
cleanup(); const unknown = fixture(); delete unknown.drafts[0].context;
unknown.config.outline[0].goal = 5;
render(React.createElement(SceneIntent, {reference:getSceneIntentReference(unknown, 'ch1', unknown.drafts[0])}));
assert.match(intent().textContent, /缺少参考上下文，无法核对/);
assert.equal(within(intent()).getByLabelText('章节目标 · goal').textContent, '字段格式不支持');
boot(engine.generateDraft(engine.createInitialState()));
assert.match(intent().textContent, /第三章 潮声之后 · ch3/);
assert.doesNotMatch(intent().textContent, /第二章 雨夜证词/);
assert.deepEqual(calls, []);
cleanup();
console.log('PASS absent/invalid source display and legacy demo target ch3; ZERO model/status requests');

for (const base of [manualFixture, templateFixture]) {
  const state = base(), beforeContext = structuredClone(state.drafts[0].context);
  state.config.outline[0].goal = '新的当前目标，但没有生成时大纲快照';
  state.config.outline[0].exitState = '新的当前退出状态';
  boot(state);
  assert.equal(within(intent()).getByLabelText('章节目标 · goal').textContent, state.config.outline[0].goal);
  assert.equal(within(intent()).getByLabelText('预期退出状态 · exitState').textContent, state.config.outline[0].exitState);
  assert.match(intent().textContent, /参考上下文与当前已保存状态一致/);
  assert.match(intent().textContent, /无法确认当时使用的 goal/);
  assert.deepEqual(stored().state.drafts[0].context, beforeContext);
  assert.deepEqual(calls, []);
}
cleanup();
console.log('PASS manual/template sources and config-only goal/exit edits: current context does not claim generation intent or fulfillment');

// One explicitly clicked, mocked generation may finish after navigation. The
// new chapter's locally derived intent must never inherit that late candidate.
boot(engine.createProjectFromConfig(fixture().config));
let finish, request;
globalThis.fetch = async (url, options) => {
  assert.equal(url, '/api/agent');
  request = {...JSON.parse(options.body), signal:options.signal};
  assert.equal(request.action, 'generateProse');
  return new Promise(resolve => {finish = resolve;});
};
await user.click(button('生成当前章'));
await waitFor(() => assert.equal(typeof finish, 'function'));
await user.click(chapter(1));
assert.equal(within(intent()).getByLabelText('章节目标 · goal').textContent, '已保存为空');
await act(async () => finish({ok:true, status:200, json:async () => ({output:{text:PROSE, chapterId:'ch1', provider}})}));
assert.equal(request.signal.aborted, true);
assert.deepEqual(stored().state.drafts, []);
assert.match(intent().textContent, /第二章 门槛 · ch2/);
assert.doesNotMatch(intent().textContent, /draft-1|第一章 日期/);
cleanup();
console.log('PASS async chapter switch: one explicit synthetic generation returns late; current chapter intent remains correct and no late candidate is inserted (no real model calls)');
