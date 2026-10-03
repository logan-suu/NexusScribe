// DOM interaction verification only; does not claim browser visual QA.
import {JSDOM} from 'jsdom';
import {build} from 'esbuild';
import {mkdir,symlink} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const out='/tmp/nexusscribe-ui-tests';await mkdir(out+'/node_modules',{recursive:true});
for(const name of ['react','react-dom','lucide-react']){try{await symlink(resolve('node_modules',name),out+'/node_modules/'+name)}catch(e){if(e.code!=='EEXIST')throw e}}
await build({entryPoints:['src/App.jsx'],bundle:true,packages:'external',format:'esm',outfile:out+'/App.mjs',loader:{'.css':'empty'},jsx:'automatic'});
const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'http://localhost/'});
for(const key of ['window','document','HTMLElement','Element','Node','MutationObserver','localStorage','getComputedStyle'])globalThis[key]=dom.window[key];
Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
dom.window.HTMLElement.prototype.scrollIntoView=function(){};
const React=await import('react');const {render,screen,cleanup,waitFor}=await import('@testing-library/react');const user=(await import('@testing-library/user-event')).default.setup();const {default:App}=await import(out+'/App.mjs');

const calls=[],requests=[];
const expectedBoundary='不靠失忆解谜；禁止人物突然复活。',expectedGoal='查清钟表为何快了一天';
const configModule=await import('../src/authoring/index.js');
globalThis.fetch=async(url,options)=>{if(url==='/api/status')return {ok:true,json:async()=>({configured:true,model:'test-model'})};const {action,input}=JSON.parse(options.body);calls.push(action);requests.push({action,input});let output;
if(action==='interview')output={questions:[{key:'protagonist',title:'谁在故事中作出选择？',hint:'名字',placeholder:'名字'},{key:'tone',title:'想留下什么情绪？',hint:'情绪',placeholder:'情绪'}],summary:'两个关键缺口'};
if(action==='planStory'){const config=configModule.createProjectConfig(input.input);output={contract:config.contract,outline:config.outline};}
if(action==='generateProse')output={text:'林舟合上钟表盒。他听见钟声，却没有看见指针移动。\n林舟决定先检查钟摆，再追问来信的人。',chapterId:input.project.outline[input.chapterIndex].id,staging:[{label:'林舟决定检查钟摆',sourceQuote:'林舟决定先检查钟摆，再追问来信的人。'}],reviewNotes:['需要作者审阅']};
if(action==='extractMemory')output={staging:[{label:'林舟决定检查钟摆',sourceParagraphIndex:1,sourceQuote:'林舟决定先检查钟摆，再追问来信的人。',sourceStart:input.text.indexOf('林舟决定'),sourceEnd:input.text.length}],reviewNotes:[]};
if(action==='reviewChapter')output={summary:'未发现明确矛盾，但这不是独立正确性证明',issues:[],checks:['来源','知识边界']};
if(action==='interpretRevision')output={summary:'作者补充祖父职业',intents:['canon_update'],questions:[],suggestedFacts:[{label:'祖父职业',sourceQuote:'林舟的祖父是一名钟表匠。'}]};
return {ok:true,json:async()=>({output:{...output,provider:{id:'openai-compatible',label:'测试模型',isLive:true,model:'test-model'}}})};};
render(React.createElement(App));
await user.click(screen.getByRole('button',{name:'模型运行方式'}));await user.click(screen.getByRole('button',{name:'检查服务连接'}));await user.click(await screen.findByRole('button',{name:'使用真实模型'}));
await user.click(screen.getByRole('button',{name:'新建故事'}));await user.type(screen.getByLabelText(/你的故事灵感/),'钟表师发现每一只钟都提前一天。');await user.type(screen.getByLabelText(/给故事起个名字/),'时差');await user.click(screen.getByRole('button',{name:'聊聊这个故事'}));await user.type(await screen.findByLabelText(/谁在故事/),'林舟');await user.type(screen.getByLabelText(/想留下什么情绪/),'克制而不安');await user.click(screen.getByText('补充主角愿望与创作边界（可选）'));await user.type(screen.getByLabelText('主角愿望'),expectedGoal);await user.type(screen.getByLabelText('不希望出现的内容'),expectedBoundary);await user.click(screen.getByRole('button',{name:'查看故事约定'}));await user.click(await screen.findByRole('button',{name:'确认约定，开始创作'}));
const customId=JSON.parse(localStorage.getItem('nexusscribe.demo.v1')).state.projectId;await user.selectOptions(screen.getByLabelText('切换项目'),'mist-harbor');await user.selectOptions(screen.getByLabelText('切换项目'),customId);
await user.click(screen.getByRole('button',{name:'生成当前章'}));await screen.findByRole('button',{name:'审查候选稿'});assert.equal(screen.getByRole('button',{name:'接受此版本'}).disabled,true);await user.click(screen.getByRole('button',{name:'提取候选记忆'}));await waitFor(()=>assert.equal(screen.getByRole('button',{name:'审查候选稿'}).disabled,false));await user.click(screen.getByRole('button',{name:'审查候选稿'}));await waitFor(()=>assert.ok(JSON.parse(localStorage.getItem('nexusscribe.demo.v1')).state.drafts[0].modelReview));await user.click(screen.getByRole('button',{name:'接受此版本'}));let saved=JSON.parse(localStorage.getItem('nexusscribe.demo.v1'));assert.equal(saved.state.chapters[0].status,'ACCEPTED');assert.equal(saved.state.events.length,1);
await user.type(screen.getByLabelText('章节正文'),'\n林舟的祖父是一名钟表匠。');await user.click(screen.getByRole('button',{name:'保存并分析'}));await screen.findByText('作者补充祖父职业');await user.click(screen.getByRole('button',{name:/祖父职业/}));await user.click(screen.getByRole('button',{name:'按这条设定准备补丁'}));saved=JSON.parse(localStorage.getItem('nexusscribe.demo.v1'));assert.equal(saved.state.facts.length,0);await user.click(screen.getByRole('button',{name:'确认并提交状态'}));saved=JSON.parse(localStorage.getItem('nexusscribe.demo.v1'));assert.equal(saved.state.facts[0].label,'林舟的祖父是一名钟表匠。');assert.deepEqual(calls,['interview','planStory','generateProse','extractMemory','reviewChapter','interpretRevision']);const critic=requests.find(r=>r.action==='reviewChapter').input.context;assert.equal(critic.projectId,customId);assert.deepEqual(Object.fromEntries(['title','idea','protagonist','tone','pov','goal','boundaries'].map(k=>[k,critic.constitution[k]])),{title:'时差',idea:'钟表师发现每一只钟都提前一天。',protagonist:'林舟',tone:'克制而不安',pov:'第三人称限知',goal:expectedGoal,boundaries:expectedBoundary});
await user.type(screen.getByLabelText('章节正文'),'\n又一处尚待确认的修改。');await user.click(screen.getByRole('button',{name:'保存并分析'}));await screen.findByRole('dialog',{name:'确认改文类型'});await user.click(screen.getByRole('button',{name:'关闭分类'}));const countBeforeGeneration=calls.length;await user.click(screen.getByRole('button',{name:'生成当前章'}));assert.equal(calls.length,countBeforeGeneration);assert.match(screen.getByRole('status').textContent,/尚未请求模型/);
cleanup();console.log('PASS: mocked real-provider UI completes the six-stage prose-first flow; review gate enforced; suggestions require author confirmation; pending source edits blocked before provider call; exact author intent reaches critic after project switching. No external request performed.');
