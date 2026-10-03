// An in-flight result must never cross a project boundary. No live provider is used.
import {JSDOM} from 'jsdom';
import {build} from 'esbuild';
import {mkdir,symlink} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {createProjectFromConfig,getContext,stageProviderDraft,createReviewBinding,attachSemanticReview,reviewDraft} from '../src/domain/engine.js';
const out='/tmp/nexusscribe-ui-review-race';await mkdir(out+'/node_modules',{recursive:true});
for(const name of ['react','react-dom','lucide-react']){try{await symlink(resolve('node_modules',name),out+'/node_modules/'+name)}catch(e){if(e.code!=='EEXIST')throw e}}
await build({entryPoints:['src/App.jsx'],bundle:true,packages:'external',format:'esm',outfile:out+'/App.mjs',loader:{'.css':'empty'},jsx:'automatic'});
const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'http://localhost/'});
for(const key of ['window','document','HTMLElement','Element','Node','MutationObserver','localStorage','getComputedStyle'])globalThis[key]=dom.window[key];Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});globalThis.IS_REACT_ACT_ENVIRONMENT=true;dom.window.HTMLElement.prototype.scrollIntoView=function(){};
const text='林舟合上钟表盒。',provider={id:'mock',isLive:true};
function project(projectId,idea){let state=createProjectFromConfig({projectId,title:projectId,idea,protagonist:'林舟',boundaries:idea});return stageProviderDraft(state,{text,provider,staging:[],context:getContext(state)},'ch1')}
const a=project('project-A','A的世界约定'),baseB=project('project-B','B的不同世界约定');
const b=reviewDraft(attachSemanticReview(baseB,'draft-1',{summary:'B-specific blocking review',issues:[{severity:'error',explanation:'B的约定尚待处理',sourceQuote:text}],checks:['B约定'],provider},createReviewBinding(baseB,'draft-1')),'draft-1');
localStorage.setItem('nexusscribe.demo.v1',JSON.stringify({format:1,serial:0,state:a,editing:{},patch:null,providerMode:'server',archived:[{state:b,editing:{},patch:null}]}));
let release,requests=0;globalThis.fetch=async(url,options)=>{assert.equal(url,'/api/agent');const request=JSON.parse(options.body);assert.equal(request.action,'reviewChapter');assert.equal(request.input.context.projectId,'project-A');requests++;return new Promise(resolve=>{release=resolve})};
const React=await import('react');const {render,screen,waitFor,cleanup,act}=await import('@testing-library/react');const user=(await import('@testing-library/user-event')).default.setup();const {default:App}=await import(out+'/App.mjs');render(React.createElement(App));
await user.click(screen.getByRole('button',{name:'审查候选稿'}));await waitFor(()=>assert.equal(typeof release,'function'));await user.selectOptions(screen.getByLabelText('切换项目'),'project-B');
await act(async()=>release({ok:true,json:async()=>({output:{summary:'A-only clean review',issues:[],checks:['A约定'],provider}})}));
await waitFor(()=>assert.match(screen.getByLabelText('模型任务状态').textContent,/已取消等待/));let saved=JSON.parse(localStorage.getItem('nexusscribe.demo.v1'));assert.equal(saved.state.projectId,'project-B');assert.equal(saved.state.drafts[0].modelReview.summary,'B-specific blocking review');assert.equal(saved.state.drafts[0].modelReview.issues.length,1);await user.click(screen.getByRole('button',{name:'接受此版本'}));if(screen.queryByRole('button',{name:'确认接受正文与所选记忆'}))await user.click(screen.getByRole('button',{name:'确认接受正文与所选记忆'}));saved=JSON.parse(localStorage.getItem('nexusscribe.demo.v1'));assert.notEqual(saved.state.drafts[0].status,'ACCEPTED');assert.equal(requests,1);cleanup();console.log('PASS: in-flight review cannot cross projects with identical draft IDs, text and versions; B remains blocked by its own report. No live calls.');
