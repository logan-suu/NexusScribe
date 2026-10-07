// Fictional local-only fixture. The outline deliberately has noncanonical IDs.
import * as engine from '../../src/domain/engine.js';
export const GOAL = '  让陆遥核对封口上的日期，\n再决定是否把信交给守门人。🙂  ';
export const EXIT = '  陆遥亲手交出未拆封的信；守门人仍不知道寄信人。  ';
export const PROSE = '陆遥把信按在桌面上。\n\n她仍没有决定下一步。';
export const provider = {id:'scene-intent-offline', isLive:true, model:'synthetic'};
export function fixture() {
  let state = engine.createProjectFromConfig({projectId:'scene-intent-test', title:'日期与封口',
    goal:'主角愿望不能充当本章目标',
    chapters:[{title:'第一章 日期'}, {title:'第二章 门槛'}, {title:'第三章 回信'}],
    outline:[{id:'chapter-1', goal:GOAL, exitState:EXIT}, {id:'chapter-2', goal:'', exitState:'\n  '}, {id:'chapter-3', description:'不能借用计划描述'}],
  });
  state = engine.stageProseDraft(state, {text:PROSE, provider, context:engine.getContext(state)}, 'ch1');
  return state;
}
export function staleFixture({oldSchema = false} = {}) {
  const state = fixture();
  if (oldSchema) state.drafts[0].context.contextSchemaVersion = 2;
  else {
    state.config.tone = '新的克制语气';
    state.config.outline[0].goal = '当前新目标：在窗口关闭前交出信件。';
  }
  return state;
}
export const workspace = state => ({format:1, serial:0, state, editing:{}, patch:null, providerMode:'server'});
export function manualFixture() {
  let state = engine.createProjectFromConfig(fixture().config);
  state = engine.saveRevision(state, 'ch1', PROSE, 1);
  state = engine.commitPatch(state, engine.proposeCustomPatch(state, 'ch1', {intent:'local_prose'}));
  return engine.stageManualDraft(state, 'ch1');
}
export function templateFixture() {
  const state = engine.createProjectFromConfig(fixture().config);
  return engine.stageProviderDraft(state, {text:PROSE, provider:{id:'deterministic-template', isLive:false}, context:engine.getContext(state), staging:[]}, 'ch1');
}
