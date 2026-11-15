// Deferred fake responses intentionally ignore abort to exercise late-result guards.
import {JSDOM} from 'jsdom';import {build} from 'esbuild';import {mkdir,symlink} from 'node:fs/promises';import {resolve} from 'node:path';import assert from 'node:assert/strict';import {createProjectFromConfig} from '../src/domain/engine.js';
const out='/tmp/nexusscribe-ui-generation-controls';await mkdir(out+'/node_modules',{recursive:true});for(const name of ['react','react-dom','lucide-react']){try{await symlink(resolve('node_modules',name),out+'/node_modules/'+name)}catch(e){if(e.code!=='EEXIST')throw e}}await build({entryPoints:['src/App.tsx'],bundle:true,packages:'external',format:'esm',outfile:out+'/App.mjs',loader:{'.css':'empty'},jsx:'automatic'});
const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'http://localhost/'});for(const key of ['window','document','HTMLElement','Element','Node','MutationObserver','localStorage','getComputedStyle'])globalThis[key]=dom.window[key];Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});globalThis.IS_REACT_ACT_ENVIRONMENT=true;dom.window.HTMLElement.prototype.scrollIntoView=function(){};
const React=await import('react');const {render,screen,waitFor,cleanup,act}=await import('@testing-library/react');const user=(await import('@testing-library/user-event')).default.setup();const {default:App}=await import(out+'/App.mjs');
const key='nexusscribe.demo.v1',a=createProjectFromConfig({projectId:'A',title:'A',idea:'雾港'}),b=createProjectFromConfig({projectId:'B',title:'B',idea:'灯塔'});let calls=[];globalThis.fetch=(url,options)=>new Promise(resolve=>calls.push({resolve,options,body:JSON.parse(options.body)}));const saved=()=>JSON.parse(localStorage.getItem(key));
async function boot(){cleanup();calls=[];localStorage.clear();localStorage.setItem(key,JSON.stringify({format:1,serial:0,state:a,editing:{},patch:null,providerMode:'server',archived:[{state:b,editing:{},patch:null}]}));render(React.createElement(App));await user.click(screen.getByRole('navigation',{name:'章节'}).querySelector('button'));}
async function release(index,text='迟到的正文',usage){await act(async()=>calls[index].resolve({ok:true,status:200,json:async()=>({output:{text,chapterId:'ch1',staging:[],provider:{id:'test',isLive:true,...(usage?{usage}:{})}}})}));}
await boot();await user.dblClick(screen.getByRole('button',{name:'生成当前章'}));assert.equal(calls.length,1);assert.match(screen.getByLabelText('模型任务状态').textContent,/未知/);await user.click(screen.getByRole('button',{name:'取消请求'}));assert.equal(calls[0].options.signal.aborted,true);await user.click(screen.getByRole('button',{name:'生成当前章'}));assert.equal(calls.length,2);await release(0);assert.equal(saved().state.drafts.length,0);assert.ok(screen.getByRole('button',{name:'取消请求'}));await release(1,'第二次的正文',{promptTokens:12,completionTokens:7,totalTokens:19});assert.equal(saved().state.drafts.length,1);assert.equal(saved().state.drafts[0].text,'第二次的正文');assert.match(screen.getByLabelText('模型任务状态').textContent,/总计 tokens：19/);
await boot();await user.click(screen.getByRole('button',{name:'生成当前章'}));await user.selectOptions(screen.getByLabelText('切换项目'),'B');await release(0);assert.equal(saved().state.projectId,'B');assert.equal(saved().state.drafts.length,0);assert.equal(saved().archived.find(p=>p.state.projectId==='A').state.drafts.length,0);
await boot();await user.click(screen.getByRole('button',{name:'生成当前章'}));await user.type(screen.getByLabelText('章节正文'),'作者的未分析修改');const edited=saved().editing;await release(0);assert.deepEqual(saved().editing,edited);assert.equal(saved().state.drafts.length,0);assert.match(screen.getByLabelText('模型任务状态').textContent,/返回结果未采用/);
await boot();await user.click(screen.getByRole('button',{name:'生成当前章'}));await user.type(screen.getByLabelText('章节正文'),'错误时保留的修改');const before=saved();await act(async()=>calls[0].resolve({ok:false,status:503,json:async()=>({error:{message:'测试失败'}})}));assert.deepEqual(saved(),before);assert.equal(calls.length,1);assert.match(screen.getByLabelText('模型任务状态').textContent,/手动重试/);cleanup();render(React.createElement(App));await user.click(screen.getByRole('navigation',{name:'章节'}).querySelector('button'));assert.match(screen.getByLabelText('章节正文').value,/错误时保留的修改/);assert.equal(screen.queryByRole('button',{name:'取消请求'}),null);assert.equal(calls.length,1);
await boot();await user.click(screen.getByRole('button',{name:'生成当前章'}));cleanup();assert.equal(calls[0].options.signal.aborted,true);render(React.createElement(App));await release(0);assert.equal(saved().state.drafts.length,0);assert.equal(calls.length,1);assert.equal(screen.queryByRole('button',{name:'取消请求'}),null);
await boot();await user.click(screen.getByRole('button',{name:'新建故事'}));await user.type(screen.getByLabelText(/你的故事灵感/),'雨中的灯塔');await user.click(screen.getByRole('button',{name:'聊聊这个故事'}));await user.click(screen.getByRole('button',{name:'关闭新建故事'}));assert.equal(calls[0].options.signal.aborted,true);await act(async()=>calls[0].resolve({ok:true,status:200,json:async()=>({output:{questions:[{key:'tone',title:'迟到的问题'}]}})}));await user.click(screen.getByRole('button',{name:'新建故事'}));assert.equal(screen.queryByText('迟到的问题'),null);assert.equal(screen.getByLabelText(/你的故事灵感/).value,'');await user.type(screen.getByLabelText(/你的故事灵感/),'新的灯塔');await user.dblClick(screen.getByRole('button',{name:'聊聊这个故事'}));assert.equal(calls.length,2);await user.type(screen.getByLabelText(/你的故事灵感/),'与新方向');await act(async()=>calls[1].resolve({ok:true,status:200,json:async()=>({output:{questions:[{key:'tone',title:'旧方向的问题'}]}})}));assert.equal(screen.queryByText('旧方向的问题'),null);assert.match(screen.getByLabelText('模型任务状态').textContent,/返回结果未采用/);assert.match(screen.getByLabelText(/你的故事灵感/).value,/与新方向/);cleanup();
console.log('PASS generation controls: repeated clicks, cancel/new-request late race, project switch, author edit stale result, failure preservation/no retry, reload, wizard close/reopen. Fake responses only.');

for (const questions of [[],[{key:'tone',title:'只有这一问'}],[{key:'protagonist',title:'保留模型的主角问题'}]]) {
  await boot();
  await user.click(screen.getByRole('button',{name:'新建故事'}));
  await user.type(screen.getByLabelText(/你的故事灵感/),'钟声从海面传来');
  await user.click(screen.getByRole('button',{name:'聊聊这个故事'}));
  await act(async()=>calls[0].resolve({ok:true,status:200,json:async()=>({output:{questions}})}));
  const hasProviderTone=questions[0]?.key==='tone';
  assert.equal(screen.queryByLabelText('只有这一问')!==null,hasProviderTone);
  if(!hasProviderTone){
    assert.ok(screen.getByLabelText(/你希望读者最后留下什么感觉/));
    assert.match(screen.getByText(/通用模板问题/).textContent,/情绪会影响开场/);
  }
  if(questions[0]?.key==='protagonist'){
    assert.equal(screen.queryByLabelText('保留模型的主角问题'),null);
    await user.click(screen.getByRole('button',{name:'下一问'}));
    assert.ok(screen.getByLabelText('保留模型的主角问题'));
  }
  assert.ok(screen.getByRole('button',{name:'查看故事约定'}));
  assert.equal(calls.length,1);
  await user.click(screen.getByRole('button',{name:'关闭新建故事'}));
  await user.click(screen.getByRole('button',{name:'新建故事'}));
  assert.equal(screen.getByLabelText(/你的故事灵感/).value,'');
  assert.equal(screen.queryByLabelText('只有这一问'),null);
  cleanup();
}
console.log('PASS interview edge cases: empty or omitted tone falls back locally; provider tone and other questions retained, optional unanswered flow, fresh reopen; mock only.');

await boot();
await user.click(screen.getByRole('button',{name:'新建故事'}));
await user.type(screen.getByLabelText(/你的故事灵感/),'第一条虚构灵感');
await user.click(screen.getByRole('button',{name:'聊聊这个故事'}));
const respondToInterview = async index => {
  await act(async()=>calls[index].resolve({ok:true,status:200,json:async()=>({
    output:{questions:[{key:'tone',title:'想留下什么情绪？',options:['克制而不安']}]}
  })}));
};
await respondToInterview(0);
await user.click(screen.getByRole('button',{name:'克制而不安'}));
await user.click(screen.getByRole('button',{name:'上一步'}));
await user.type(screen.getByLabelText(/你的故事灵感/),'追加方向');
assert.ok(screen.getByText('重新访谈时不会沿用上一轮的答案。'));
await user.click(screen.getByRole('button',{name:'重新访谈'}));
assert.equal(calls.length,2);
const changedInput = calls[1].body.input.input;
assert.equal(changedInput.idea,'第一条虚构灵感追加方向');
assert.equal(changedInput.tone,'');
await act(async()=>calls[1].resolve({ok:false,status:503,json:async()=>({error:{message:'模拟访谈失败'}})}));
assert.equal(calls.length,2);
assert.ok(screen.getByRole('alert'));
assert.equal(screen.queryByLabelText('想留下什么情绪？'),null);
const premiseField=screen.getByLabelText(/你的故事灵感/);
assert.equal(premiseField.value,'第一条虚构灵感追加方向');
await user.clear(premiseField);
await user.type(premiseField,'第一条虚构灵感');
await user.click(screen.getByRole('button',{name:'聊聊这个故事'}));
assert.equal(calls.length,2);
assert.equal(screen.getByLabelText('想留下什么情绪？').value,'克制而不安');
await user.click(screen.getByRole('button',{name:'上一步'}));
await user.type(screen.getByLabelText(/你的故事灵感/),'追加方向');
await user.click(screen.getByRole('button',{name:'重新访谈'}));
assert.equal(calls.length,3);
await respondToInterview(2);
assert.equal(screen.getByRole('button',{name:'克制而不安'}).getAttribute('aria-pressed'),'false');
assert.equal(screen.getByLabelText('想留下什么情绪？').value,'');
cleanup();
console.log('PASS edited premise starts a separately disclosed interview without inherited suggestions; mock only.');

await boot();
await user.click(screen.getByRole('button',{name:'新建故事'}));
await user.type(screen.getByLabelText(/你的故事灵感/),'一位修表师接到昨天寄给自己的信。');
await user.click(screen.getByRole('button',{name:'聊聊这个故事'}));
await respondToInterview(0);
await user.click(screen.getByRole('button',{name:'克制而不安'}));
await user.click(screen.getByRole('button',{name:'查看故事约定'}));
const {createProjectConfig}=await import('../src/authoring/index.js');
await act(async()=>calls[1].resolve({ok:true,status:200,json:async()=>({
  output:createProjectConfig(calls[1].body.input.input)
})}));
const agreementTone='冷峻，但保留温柔';
const openingGoal='让修表师先核对邮戳，而不是立即追问寄信人';
const edit=async(label,value)=>{
  const field=screen.getByLabelText(label);
  await user.clear(field);
  await user.type(field,value);
};
const assertEdits=()=>{
  const tone=screen.getByLabelText('情绪方向');
  assert.equal(tone.value,agreementTone);
  assert.match(tone.closest('label').textContent,/你的设定/);
  assert.equal(screen.getByLabelText('第1章目标').value,openingGoal);
};
await edit('情绪方向',agreementTone);
await edit('第1章目标',openingGoal);
await user.click(screen.getByRole('button',{name:'上一步'}));
await user.click(screen.getByRole('button',{name:'查看故事约定'}));
assertEdits();
assert.deepEqual(calls.map(({body})=>body.action),['interview','planStory']);
await user.click(screen.getByRole('button',{name:'上一步'}));
await edit('想留下什么情绪？','幽默');
assert.match(screen.getByText(/重新规划成功后会替换/).textContent,/包括你的修改.*失败时保留上一版/);
await user.click(screen.getByRole('button',{name:'重新规划'}));
assert.equal(calls[2].body.input.input.tone,'幽默');
await act(async()=>calls[2].resolve({ok:false,status:503,json:async()=>({error:{message:'模拟规划失败'}})}));
assert.ok(screen.getByRole('alert'));
assert.equal(screen.getByLabelText('想留下什么情绪？').value,'幽默');
assert.equal(calls.length,3);
await user.click(screen.getByRole('button',{name:'克制而不安'}));
assert.equal(screen.queryByText(/重新规划成功后会替换/),null);
await user.click(screen.getByRole('button',{name:'查看故事约定'}));
assertEdits();
assert.equal(calls.length,3);
await user.click(screen.getByRole('button',{name:'确认约定，开始创作'}));
const savedPlan=saved().state.config;
const savedTone=savedPlan.contract.fields.find(field=>field.key==='emotionalDirection');
assert.deepEqual([savedTone.value,savedTone.status,savedTone.source],[agreementTone,'confirmed','user']);
assert.equal(savedPlan.outline[0].goal,openingGoal);
cleanup();
console.log('PASS author agreement and outline edits survive unchanged Back/Forward and failed replanning; mock only.');
