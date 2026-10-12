// Deterministic App → adapter → server-validation → provider-prompt regressions.
// Both HTTP boundaries are fake. No credentials, sockets, or quality claims.
import {JSDOM} from 'jsdom';
import {build} from 'esbuild';
import {mkdir, symlink} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import * as engine from '../src/domain/engine.js';
import {captureGenerationIntent} from '../src/domain/generation-intent.js';
import {createAgentService} from '../server/provider.js';
import {KEY, parseBackup} from '../src/storage.js';
import {fixture, workspace, GOAL, EXIT, PROSE, provider} from '../tests/fixtures/scene-intent.js';

const out='/tmp/nexusscribe-ui-request-scene-intent';
await mkdir(out+'/node_modules',{recursive:true});
for(const name of ['react','react-dom','lucide-react']) {
  try {await symlink(resolve('node_modules',name),out+'/node_modules/'+name);}
  catch(error) {if(error.code!=='EEXIST')throw error;}
}
await build({entryPoints:['src/App.tsx'],bundle:true,packages:'external',format:'esm',outfile:out+'/App.mjs',loader:{'.css':'empty'},jsx:'automatic'});
const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'http://localhost/'});
for(const key of ['window','document','HTMLElement','Element','Node','MutationObserver','localStorage','getComputedStyle','File'])globalThis[key]=dom.window[key];
Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
dom.window.HTMLElement.prototype.scrollIntoView=function(){};
const React=await import('react');
const {render,screen,within,cleanup,fireEvent,waitFor,act}=await import('@testing-library/react');
const user=(await import('@testing-library/user-event')).default.setup();
const {default:App}=await import(out+'/App.mjs');
const saved=()=>JSON.parse(localStorage.getItem(KEY));
const draft=()=>saved().state.drafts[0];
const button=name=>screen.getByRole('button',{name,exact:true});
const chapter=index=>within(screen.getByRole('navigation',{name:'章节'})).getAllByRole('button')[index];
const REVIEW='审查候选稿', REVISE='按意见生成改稿建议 · 1 次模型请求';
const AFTER='  陆遥把信交给守门人。🙂\n\n她没有回头。\n';
const INSTRUCTION='保留人物视角，用动作结束。';
const env={NEXUS_OVERAGE_CONFIRMED_OFF:'true',NEXUS_LIVE_ENABLED:'true',NEXUS_API_BASE_URL:'https://example.test/v1',NEXUS_API_MODEL:'synthetic-only',NEXUS_API_KEY:'fake-noncredential'};
const envelope=content=>new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content}}]}));
const response=output=>({ok:true,status:200,json:async()=>({output})});
let calls=[],prompts=[],hold=false,release;
function base(index=0) {
  const config=structuredClone(fixture().config), id=`ch${index+1}`;
  // Deliberately distinguish saved scene goals from initial generation input.
  config.outline[index]={id:`legacy-outline-${index+1}`,goal:GOAL,exitState:EXIT,description:'DESCRIPTION MUST NOT BECOME GOAL'};
  let state=engine.createProjectFromConfig(config);
  const context=engine.getContext(state);
  const generationIntent=captureGenerationIntent({project:{projectId:state.projectId,outline:state.chapters.map(c=>({id:c.id,goal:'INITIAL GENERATION GOAL',exitState:'INITIAL GENERATION EXIT'}))},chapterIndex:index,context});
  state=engine.stageProseDraft(state,{text:PROSE,provider,context},id,generationIntent);
  return engine.skipMemoryExtraction(state,state.drafts[0].id);
}
function boot(initial=base(),archived=[]) {
  cleanup();localStorage.clear();calls=[];prompts=[];hold=false;release=undefined;
  const service=createAgentService({env,fetchImpl:async(url,options)=>{
    assert.equal(url,'https://example.test/v1/chat/completions');
    const body=JSON.parse(options.body),request=JSON.parse(body.messages[1].content);
    prompts.push({request,system:body.messages[0].content});
    assert.ok(['reviewChapter','reviseProse'].includes(request.action));
    return envelope(request.action==='reviewChapter'?JSON.stringify({summary:'Synthetic advisory review',issues:[],checks:[],factChecks:[]}):AFTER);
  }});
  globalThis.fetch=async(url,options={})=>{
    assert.ok(['/api/status','/api/agent'].includes(url),`Unexpected network ${url}`);
    if(url==='/api/status') {assert.equal(options.method,'GET');return {ok:true,status:200,json:async()=>service.status()};}
    assert.equal(options.method,'POST');
    const request=JSON.parse(options.body);calls.push({...request,signal:options.signal});
    // Finish validation/prompt/output first, then adversarially ignore transport
    // cancellation so App itself must reject a late otherwise-valid response.
    const output=await service.run(request.action,request.input);
    if(hold)return new Promise(resolve=>{release=()=>resolve(response(output));});
    return response(output);
  };
  localStorage.setItem(KEY,JSON.stringify({...workspace(initial),archived}));
  render(React.createElement(App));
}
async function start(action) {
  if(action==='reviseProse')fireEvent.change(screen.getByLabelText('改稿意见'),{target:{value:INSTRUCTION}});
  await user.click(button(action==='reviewChapter'?REVIEW:REVISE));
}
const field=value=>({status:typeof value==='string'?(value.trim()?'present':'empty'):'invalid',value:typeof value==='string'?value:null});
function assertBinding(intent,state,index,expectedGoal,expectedExit) {
  const d=state.drafts[0];
  assert.deepEqual(intent,{protocol:'request-scene-intent-v1',boundary:'app-saved-scene-input',projectId:state.projectId,chapterId:`ch${index+1}`,chapterIndex:index,chapterRevision:state.chapters[index].revision,stateVersion:state.version,draftId:d.id,runId:d.runId,draftRevision:d.revision,contextVersion:state.version,contextSchemaVersion:engine.getContext(state).contextSchemaVersion,source:`config.outline[${index}]`,goal:expectedGoal,exitState:expectedExit});
}
for(const variant of ['present','empty','missing','invalid','second-chapter']) {
  const index=variant==='second-chapter'?1:0,state=base(index),outline=state.config.outline[index];
  if(variant==='empty'){outline.goal=' \n ';outline.exitState='';}
  if(variant==='missing'){delete outline.goal;delete outline.exitState;}
  if(variant==='invalid'){outline.goal=17;outline.exitState={description:'DO NOT SUBSTITUTE'};}
  const expectedGoal=Object.hasOwn(outline,'goal')?field(outline.goal):{status:'missing',value:null};
  const expectedExit=Object.hasOwn(outline,'exitState')?field(outline.exitState):{status:'missing',value:null};
  boot(state);if(index)await user.click(chapter(index));
  const origin=structuredClone(draft().generationIntent);
  await start('reviewChapter');
  await waitFor(()=>assert.equal(draft().modelReview?.summary,'Synthetic advisory review'));
  assert.equal(calls.length,1);assert.equal(prompts.length,1);
  assertBinding(calls[0].input.sceneIntent,state,index,expectedGoal,expectedExit);
  assert.deepEqual(prompts[0].request.input.sceneIntent,calls[0].input.sceneIntent);
  assert.deepEqual(draft().modelReview.sceneIntent,calls[0].input.sceneIntent);
  assert.match(prompts[0].system,/sceneIntent/);
  assert.equal(calls[0].input.chapterId,`ch${index+1}`);
  await start('reviseProse');
  await waitFor(()=>assert.equal(draft().revisionProposals.at(-1)?.status,'proposed',screen.getByLabelText('模型任务状态').textContent));
  assert.deepEqual(calls.map(c=>c.action),['reviewChapter','reviseProse']);assert.equal(prompts.length,2);
  assertBinding(calls[1].input.sceneIntent,state,index,expectedGoal,expectedExit);
  assert.deepEqual(prompts[1].request.input,calls[1].input);
  assert.equal(calls[1].input.text,PROSE);assert.equal(calls[1].input.instruction,INSTRUCTION);
  const source=draft().revisionSnapshots.find(s=>s.id===draft().revisionProposals.at(-1).binding.snapshotId);
  assert.deepEqual(source.sceneIntent,calls[1].input.sceneIntent);
  assert.deepEqual(source.contextSnapshot,calls[1].input.context);
  assert.equal(source.textSnapshot,PROSE);
  assert.deepEqual(draft().generationIntent,origin);
  assert.equal(draft().text,PROSE);assert.deepEqual(saved().state.events,[]);
  assert.equal(draft().revisionProposals.at(-1).result.text,AFTER);
  const durable=saved();assert.deepEqual(parseBackup(JSON.stringify(durable)).state,durable.state);
  cleanup();render(React.createElement(App));
  assert.deepEqual(saved(),durable);assert.equal(calls.length,2);
  console.log(`PASS ${variant}: actual App/adapter/server/provider prompt, exact saved intent, durable snapshots and immutable initial generation intent`);
}

for(const action of ['reviewChapter','reviseProse'])for(const interruption of ['navigation','cancel','project','candidate','goal-cross-tab','context-cross-tab']) {
  const a=base();
  // A valid independent project can contain the same draft ID and prose.
  let other=engine.createProjectFromConfig({...a.config,projectId:'second-project'});
  other=engine.stageProseDraft(other,{text:PROSE,provider,context:engine.getContext(other)},'ch1');
  other=engine.skipMemoryExtraction(other,other.drafts[0].id);
  boot(a,[{state:other,editing:{},patch:null}]);hold=true;
  await start(action);await waitFor(()=>assert.equal(typeof release,'function'));
  const originalIntent=structuredClone(calls[0].input.sceneIntent);
  if(interruption==='navigation')await user.click(chapter(1));
  if(interruption==='cancel')await user.click(button('取消请求'));
  if(interruption==='project')await user.selectOptions(screen.getByLabelText('切换项目'),'second-project');
  if(interruption==='candidate') {
    await user.click(button('编辑此稿'));
    fireEvent.change(screen.getByLabelText('编辑候选稿',{exact:true}),{target:{value:PROSE+'\n作者的新句子。'}});
    await user.click(button('保存候选稿修改'));
  }
  if(interruption.endsWith('cross-tab')) {
    const external=saved();external.serial++;
    if(interruption==='goal-cross-tab')external.state.config.outline[0].goal='NEW SAVED GOAL';
    else external.state.config.tone='NEW CONTEXT TONE';
    localStorage.setItem(KEY,JSON.stringify(external));
  }
  const beforeLate=saved();await act(async()=>release());
  assert.equal(calls.length,1);assert.equal(prompts.length,1);
  assert.deepEqual(calls[0].input.sceneIntent,originalIntent);
  assert.equal(draft().modelReview,null,'Late review must not attach to a changed/cancelled target');
  assert.notEqual(draft().revisionProposals?.at(-1)?.status,'proposed','Late advice must not be adoptable');
  assert.deepEqual(draft().generationIntent,beforeLate.state.drafts[0].generationIntent);
  assert.equal(draft().text,beforeLate.state.drafts[0].text);
  if(interruption.endsWith('cross-tab'))assert.deepEqual(saved(),beforeLate,'Late response must not overwrite external saved goals/context');
  if(interruption==='project')assert.equal(saved().state.projectId,'second-project');
  console.log(`PASS delayed ${action}/${interruption}: old scene binding cannot gain authority or overwrite saved state`);
}
cleanup();
console.log('PASS request scene intent DOM regression: fake HTTP and fake provider only; no real model calls or quality judgments');
