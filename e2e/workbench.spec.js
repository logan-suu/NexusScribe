import {test,expect} from '@playwright/test';
import {createProjectConfig} from '../src/authoring/index.js';
import {createProjectFromConfig,getContext,stageProviderDraft,createReviewBinding,attachSemanticReview,reviewDraft,proposeCustomPatch,commitPatch} from '../src/domain/engine.js';

// All API responses are ephemeral test fixtures. External network requests are blocked.
test.beforeEach(async({page,context})=>{
 await context.route('**/*',async route=>{const url=new URL(route.request().url());if(['127.0.0.1','localhost'].includes(url.hostname))await route.continue();else await route.abort('blockedbyclient')});
 await page.route('**/api/**',async route=>{if(new URL(route.request().url()).pathname==='/api/status')await route.fulfill({json:{configured:false,callsUsed:0,maxCalls:10}});else await route.fulfill({status:503,json:{error:{code:'NOT_CONFIGURED',message:'测试环境不启用外部模型'}}})});
});
async function state(page){return page.evaluate(()=>JSON.parse(localStorage.getItem('nexusscribe.demo.v1')))}
async function capture(page,testInfo,label){const wizard=await page.locator('.ns-wizard-shell').isVisible();if(!wizard)await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:testInfo.outputPath(`${label}.png`),fullPage:!wizard,animations:'disabled'});await testInfo.attach(label,{path:testInfo.outputPath(`${label}.png`),contentType:'image/png'})}
async function noOverflow(page){expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)}
function health(page){const errors=[];page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text())});return errors}

test('chapter edit → proposed patch → selective commit → isolated reject → reload',async({page},testInfo)=>{
 const errors=health(page);await page.goto('/');await expect(page).toHaveTitle('NexusScribe · 雾港来信');await expect(page.getByRole('heading',{level:1})).toHaveText('第二章 雨夜证词');await noOverflow(page);await capture(page,testInfo,'01-workbench');
 await page.getByRole('button',{name:'插入设定修改'}).click();await expect(page.getByLabel('章节正文')).toHaveValue(/陈默三年前见过死者/);await page.getByRole('button',{name:'保存并分析'}).click();expect((await state(page)).state.facts[0].value).toBe('never_met');await expect(page.getByRole('button',{name:'确认并提交状态'})).toBeEnabled();await capture(page,testInfo,'02-patch-review');
 await page.getByRole('button',{name:'确认并提交状态'}).click();const saved=await state(page);expect(saved.state.facts[0].value).toBe('has_met');expect(saved.state.plans.find(p=>p.id==='stranger').status).toBe('invalid');expect(saved.state.plans.find(p=>p.id==='police-reveal').status).toBe('valid');expect(saved.state.plans.find(p=>p.id==='storm').status).toBe('valid');
 await page.getByRole('button',{name:'生成下一场景'}).click();await expect(page.getByRole('button',{name:'审查候选稿'})).toBeVisible();await page.getByRole('button',{name:'审查候选稿'}).click();await page.getByRole('button',{name:'拒绝此稿'}).click();const rejected=await state(page);expect(rejected.state.drafts[0].status).toBe('REJECTED');expect(rejected.state.events.some(e=>e.label?.includes('钥匙'))).toBe(false);await page.reload();await expect(page.getByText(/REJECTED/)).toBeVisible();expect((await state(page)).state.facts[0].value).toBe('has_met');await noOverflow(page);expect(errors).toEqual([]);
});

test('stale candidate cannot be accepted after author changes its source',async({page},testInfo)=>{
 const errors=health(page);await page.goto('/');await page.getByRole('button',{name:'生成下一场景'}).click();await page.getByRole('button',{name:'审查候选稿'}).click();await page.getByRole('button',{name:'局部润色'}).click();await page.getByRole('button',{name:'保存并分析'}).click();await page.getByRole('button',{name:'确认并提交状态'}).click();await page.getByRole('button',{name:'审查候选稿'}).click();await expect(page.getByText(/审查未通过/)).toBeVisible();await expect(page.getByRole('button',{name:'接受此版本'})).toBeDisabled();expect((await state(page)).state.drafts[0].status).not.toBe('ACCEPTED');await capture(page,testInfo,'03-stale-protection');await noOverflow(page);expect(errors).toEqual([]);
});

test('new custom project completes all three chapters with explicit author memory',async({page},testInfo)=>{
 const errors=health(page);await page.goto('/');await page.getByRole('button',{name:'新建故事'}).click();await page.getByLabel(/你的故事灵感/).fill('一位钟表师发现所有停摆的钟都指向明天。');await page.getByLabel(/给故事起个名字/).fill('明日时刻');await capture(page,testInfo,'04-story-idea');await page.getByRole('button',{name:'聊聊这个故事'}).click();await page.getByLabel(/谁来经历/).fill('林舟');await page.getByRole('button',{name:'克制而不安'}).click();await page.getByRole('button',{name:'查看故事约定'}).click();await expect(page.getByRole('heading',{name:'明日时刻'})).toBeVisible();await noOverflow(page);await capture(page,testInfo,'05-story-contract');await page.getByRole('button',{name:'确认约定，开始创作'}).scrollIntoViewIfNeeded();await capture(page,testInfo,'05b-story-contract-actions');await page.getByRole('button',{name:'确认约定，开始创作'}).click();
 for(let i=0;i<3;i++){if(i)await page.getByRole('navigation',{name:'章节'}).getByRole('button').nth(i).click();await page.getByRole('button',{name:'生成当前章'}).click();await page.getByRole('button',{name:'审查候选稿'}).click();await expect(page.getByText(/结构检查通过 · 语义一致性未评估/).last()).toBeVisible();await page.getByRole('button',{name:'接受此版本'}).click();if(await page.getByRole('button',{name:'确认接受正文与所选记忆'}).count())await page.getByRole('button',{name:'确认接受正文与所选记忆'}).click();expect((await state(page)).state.chapters[i].status).toBe('ACCEPTED')}
 const body=page.getByLabel('章节正文');await body.fill((await body.inputValue())+'\n林舟的祖父是一名钟表匠。');await page.getByRole('button',{name:'保存并分析'}).click();await page.getByLabel(/确认的设定/).fill('林舟的祖父是一名钟表匠。');await page.getByRole('button',{name:'按这条设定准备补丁'}).click();expect((await state(page)).state.facts).toHaveLength(0);await page.getByRole('button',{name:'确认并提交状态'}).click();expect((await state(page)).state.facts[0].label).toBe('林舟的祖父是一名钟表匠。');await page.getByRole('button',{name:'故事记忆',exact:true}).click();await capture(page,testInfo,'06-custom-memory');await noOverflow(page);expect(errors).toEqual([]);
});

test('mocked model uses prose-first stages and never skips review or author confirmation',async({page},testInfo)=>{
 const errors=health(page),calls=[],requests=[];const expectedBoundary='不靠失忆解谜；禁止人物突然复活。',expectedGoal='查清钟表为何快了一天';await page.route('**/api/status',route=>route.fulfill({json:{configured:true,liveEnabled:true,model:'test-model',callsUsed:0,maxCalls:10}}));
 await page.route('**/api/agent',async route=>{const {action,input}=route.request().postDataJSON();calls.push(action);requests.push({action,input});let output;
 if(action==='interview')output={questions:[{key:'protagonist',title:'谁在故事中作出选择？',hint:'名字',placeholder:'名字'},{key:'tone',title:'想留下什么情绪？',hint:'情绪',placeholder:'情绪'}],summary:'两个关键缺口'};
 if(action==='planStory'){const config=createProjectConfig(input.input);output={contract:config.contract,outline:config.outline}}
 if(action==='generateProse')output={text:'林舟合上钟表盒。他听见钟声，却没有看见指针移动。\n林舟决定先检查钟摆，再追问来信的人。',chapterId:input.project.outline[input.chapterIndex].id,staging:[{label:'林舟决定检查钟摆',sourceQuote:'林舟决定先检查钟摆，再追问来信的人。'}],reviewNotes:['请作者审阅']};
 if(action==='extractMemory')output={staging:[{label:'林舟决定检查钟摆',sourceParagraphIndex:1,sourceQuote:'林舟决定先检查钟摆，再追问来信的人。',sourceStart:input.text.indexOf('林舟决定'),sourceEnd:input.text.length}],reviewNotes:[]};
 if(action==='auditMemoryCandidate')output={status:'supported',explanation:'独立引文支持标签'};
 if(action==='reviewChapter')output={summary:'未发现明确矛盾，仍需作者复核',issues:[],checks:['来源','知识边界']};
 if(action==='interpretRevision')output={summary:'作者补充祖父职业',intents:['canon_update'],questions:[],suggestedFacts:[{label:'祖父职业',sourceQuote:'林舟的祖父是一名钟表匠。'}]};
 await route.fulfill({json:{output:{...output,provider:{id:'openai-compatible',label:'测试模型',isLive:true,model:'test-model'}}}})});
 await page.goto('/');await page.getByRole('button',{name:'模型运行方式'}).click();await page.getByRole('button',{name:'检查服务连接'}).click();await page.getByRole('button',{name:'使用真实模型'}).click();await page.getByRole('button',{name:'新建故事'}).click();await page.getByLabel(/你的故事灵感/).fill('钟表师发现每一只钟都提前一天。');await page.getByLabel(/给故事起个名字/).fill('时差');await page.getByRole('button',{name:'聊聊这个故事'}).click();await page.getByLabel(/谁在故事/).fill('林舟');await page.getByLabel(/想留下什么情绪/).fill('克制而不安');await page.getByText('补充主角愿望与创作边界（可选）',{exact:true}).click();await page.getByLabel('主角愿望',{exact:true}).fill(expectedGoal);await page.getByLabel('不希望出现的内容',{exact:true}).fill(expectedBoundary);await page.getByRole('button',{name:'查看故事约定'}).click();await page.getByRole('button',{name:'确认约定，开始创作'}).click();const customId=(await state(page)).state.projectId;await page.getByLabel('切换项目').selectOption('mist-harbor');await page.getByLabel('切换项目').selectOption(customId);await page.getByRole('button',{name:'生成当前章'}).click();await expect(page.getByRole('button',{name:'接受此版本'})).toBeDisabled();await page.getByRole('button',{name:'提取候选记忆'}).click();await expect(page.getByRole('button',{name:'审查候选稿'})).toBeEnabled();await page.getByRole('button',{name:'审查候选稿'}).click();await expect(page.getByText('模型语义审阅 · 非独立正确性证明')).toBeVisible();await page.getByRole('button',{name:/^独立核对候选记忆 1/}).click();await expect(page.getByRole('button',{name:/^保留候选记忆 1/})).toBeEnabled();await page.getByRole('button',{name:/^保留候选记忆 1/}).click();await page.getByRole('button',{name:'接受此版本'}).click();if(await page.getByRole('button',{name:'确认接受正文与所选记忆'}).count())await page.getByRole('button',{name:'确认接受正文与所选记忆'}).click();expect((await state(page)).state.events).toHaveLength(1);
 const body=page.getByLabel('章节正文');await body.fill((await body.inputValue())+'\n林舟的祖父是一名钟表匠。');await page.getByRole('button',{name:'保存并分析'}).click();await page.getByRole('button',{name:/祖父职业/}).click();await page.getByRole('button',{name:'按这条设定准备补丁'}).click();expect((await state(page)).state.facts).toHaveLength(0);await page.getByRole('button',{name:'确认并提交状态'}).click();expect((await state(page)).state.facts).toHaveLength(1);expect(calls).toEqual(['interview','planStory','generateProse','extractMemory','reviewChapter','auditMemoryCandidate','interpretRevision']);expect(requests.find(r=>r.action==='reviewChapter').input.context.constitution).toEqual(expect.objectContaining({title:'时差',idea:'钟表师发现每一只钟都提前一天。',protagonist:'林舟',tone:'克制而不安',pov:'第三人称限知',goal:expectedGoal,boundaries:expectedBoundary}));await capture(page,testInfo,'07-mocked-model-review');expect(errors).toEqual([]);
});


test('in-flight semantic review cannot authorize an equal-looking draft in another project',async({page},testInfo)=>{
 const errors=health(page),text='林舟合上钟表盒。',provider={id:'mock',isLive:true};
 function project(projectId,idea){const base=createProjectFromConfig({projectId,title:projectId,idea,protagonist:'林舟',boundaries:idea});return stageProviderDraft(base,{text,provider,staging:[],context:getContext(base)},'ch1')}
 const a=project('project-A','A的世界约定'),baseB=project('project-B','B的不同世界约定');
 const b=reviewDraft(attachSemanticReview(baseB,'draft-1',{summary:'B-specific blocking review',issues:[{severity:'error',explanation:'B的约定尚待处理',sourceQuote:text}],checks:['B约定'],provider},createReviewBinding(baseB,'draft-1')),'draft-1');
 await page.addInitScript(workspace=>localStorage.setItem('nexusscribe.demo.v1',JSON.stringify(workspace)),{format:1,serial:0,state:a,editing:{},patch:null,providerMode:'server',archived:[{state:b,editing:{},patch:null}]});
 let release,requests=0;const gate=new Promise(resolve=>{release=resolve});
 await page.route('**/api/agent',async route=>{const request=route.request().postDataJSON();expect(request.action).toBe('reviewChapter');expect(request.input.context.projectId).toBe('project-A');requests++;await gate;await route.fulfill({json:{output:{summary:'A-only clean review',issues:[],checks:['A约定'],provider}}})});
 await page.goto('/');await page.getByRole('button',{name:'审查候选稿'}).click();await expect.poll(()=>requests).toBe(1);await page.getByLabel('切换项目').selectOption('project-B');release();await expect(page.getByLabel('模型任务状态')).toContainText('已取消等待 · 迟到结果不会采用');let saved=await state(page);expect(saved.state.projectId).toBe('project-B');expect(saved.state.drafts[0].modelReview.summary).toBe('B-specific blocking review');expect(saved.state.drafts[0].modelReview.issues).toHaveLength(1);await page.getByRole('button',{name:'接受此版本'}).click();if(await page.getByRole('button',{name:'确认接受正文与所选记忆'}).count())await page.getByRole('button',{name:'确认接受正文与所选记忆'}).click();saved=await state(page);expect(saved.state.drafts[0].status).not.toBe('ACCEPTED');expect(requests).toBe(1);await capture(page,testInfo,'08-cross-project-review-guard');expect(errors).toEqual([]);
});

test('editing prose invalidates old extraction and requires a new version-bound result',async({page},testInfo)=>{
 const errors=health(page),calls=[];
 const base=createProjectFromConfig({projectId:'edit-prose',idea:'虚构纸灯'});await page.route('**/api/status',route=>route.fulfill({json:{configured:true,liveEnabled:true,callsUsed:calls.length,maxCalls:10}}));
 await page.addInitScript(workspace=>localStorage.setItem('nexusscribe.demo.v1',JSON.stringify(workspace)),{format:1,serial:0,state:base,editing:{},patch:null,providerMode:'server'});
 await page.route('**/api/agent',async route=>{
  const {action,input}=route.request().postDataJSON();calls.push(action);let output;
  if(action==='generateProse')output={text:'小舟来到塔下。\n\n小舟举起蓝色纸灯。',chapterId:'ch1'};
  if(action==='extractMemory'){const quote='小舟举起蓝色纸灯。';output={staging:[{label:'小舟举灯',sourceParagraphIndex:input.text.startsWith('新')?2:1,sourceQuote:quote,sourceStart:input.text.indexOf(quote),sourceEnd:input.text.indexOf(quote)+quote.length}],reviewNotes:[]}}
  if(action==='auditMemoryCandidate')output={status:'supported',explanation:'独立引文支持标签'};
 if(action==='reviewChapter')output={summary:'仍需作者复核',issues:[],checks:['原文']};
  await route.fulfill({json:{output:{...output,provider:{id:'test-model',isLive:true}}}});
 });
 await page.goto('/');await page.getByRole('navigation',{name:'章节'}).getByRole('button').first().click();await page.getByRole('button',{name:'生成当前章'}).click();
 await expect(page.getByRole('button',{name:'审查候选稿'})).toBeDisabled();await expect(page.getByRole('button',{name:'接受此版本'})).toBeDisabled();
 let saved=await state(page);expect(saved.state.drafts[0].text).toBe('小舟来到塔下。\n\n小舟举起蓝色纸灯。');expect(saved.state.events).toHaveLength(0);expect(calls).toEqual(['generateProse']);
 await page.getByRole('button',{name:'提取候选记忆'}).click();await expect(page.getByRole('button',{name:'审查候选稿'})).toBeEnabled();await page.getByRole('button',{name:'审查候选稿'}).click();await expect(page.getByText('模型语义审阅 · 非独立正确性证明')).toBeVisible();
 await page.getByRole('button',{name:'编辑此稿'}).click();await page.getByLabel('编辑候选稿').fill('新加入的段落。\n小舟来到塔下。\n\n小舟举起蓝色纸灯。');await page.getByRole('button',{name:'保存候选稿修改'}).click();
 await expect(page.getByRole('button',{name:'审查候选稿'})).toBeDisabled();await expect(page.getByRole('button',{name:'接受此版本'})).toBeDisabled();saved=await state(page);expect(saved.state.drafts[0].staging).toHaveLength(0);expect(saved.state.drafts[0].modelReview).toBeNull();expect(saved.state.drafts[0].proseVersions).toHaveLength(2);
 await page.getByRole('button',{name:'提取候选记忆'}).click();await expect(page.getByText('当前正文的候选记忆已提取 · 尚需核对与审阅')).toBeVisible();await page.getByRole('button',{name:'审查候选稿'}).click();await expect(page.getByText('模型语义审阅 · 非独立正确性证明')).toBeVisible();await expect(page.getByLabel('候选记忆提交须知')).toContainText('仅提交明确选中的候选记忆');await page.getByRole('button',{name:/^独立核对候选记忆 1/}).click();await expect(page.getByRole('button',{name:/^保留候选记忆 1/})).toBeEnabled();await page.getByRole('button',{name:/^保留候选记忆 1/}).click();await capture(page,testInfo,'11-prose-extraction-evidence');await noOverflow(page);await page.getByRole('button',{name:'接受此版本'}).click();if(await page.getByRole('button',{name:'确认接受正文与所选记忆'}).count())await page.getByRole('button',{name:'确认接受正文与所选记忆'}).click();saved=await state(page);expect(saved.state.events).toHaveLength(1);expect(saved.state.events[0].source.quote).toBe('小舟举起蓝色纸灯。');expect(errors).toEqual([]);
});


test('fact contradiction blocks; explicit evidence-bound exception is cancelable and auditable',async({page},testInfo)=>{
 const errors=health(page),blue='小舟的纸灯是蓝色的。',text='小舟提着小红纸灯。';
 let initial=createProjectFromConfig({projectId:'fact-e2e',idea:'纸灯故事',chapters:[{text:blue}]});
 initial=commitPatch(initial,proposeCustomPatch(initial,'ch1',{intent:'author_fact',statement:blue}));
 initial=stageProviderDraft(initial,{text,provider:{id:'fixture',isLive:true},context:getContext(initial)},'ch2');
 const id=initial.drafts[0].id,fact=initial.facts[0];
 initial=reviewDraft(initial,id);
 initial=attachSemanticReview(initial,id,{summary:'合成模型判断；不证明语义精度',issues:[{severity:'warning',explanation:'节奏可润色',sourceQuote:text}],checks:['设定'],factChecks:[{factId:fact.id,recordVersion:fact.recordVersion,status:'contradiction',explanation:'给定同一盏灯的颜色矛盾',sourceQuote:text}],provider:'fixture'},createReviewBinding(initial,id));
 await page.addInitScript(workspace=>{if(localStorage.getItem('nexusscribe.demo.v1')===null)localStorage.setItem('nexusscribe.demo.v1',JSON.stringify(workspace))},{format:1,serial:0,state:initial,editing:{},patch:null});
 await page.goto('/');await expect(page).toHaveTitle('NexusScribe · 雾港来信');await expect(page.getByRole('button',{name:'接受此版本'})).toBeDisabled();
 await page.getByRole('button',{name:'审阅并决定此项例外'}).click();const dialog=page.getByRole('dialog',{name:'确认单项设定例外'});
 await expect(dialog).toContainText(blue);await expect(dialog).toContainText(text);await expect(dialog.getByRole('button',{name:'确认接受此项例外，保留原设定'})).toBeDisabled();await capture(page,testInfo,'09-fact-decision-evidence');await noOverflow(page);
 await dialog.getByLabel('作者决定理由').fill('暂时保留这段有意例外，待作者后续改稿');await dialog.getByRole('button',{name:'取消决定'}).click();await expect(page.getByRole('button',{name:'接受此版本'})).toBeDisabled();expect((await state(page)).state.drafts[0].factDecisions||[]).toHaveLength(0);
 await page.getByRole('button',{name:'审阅并决定此项例外'}).click();await page.getByLabel('作者决定理由').fill('保留本稿有意例外，不替代蓝灯设定');await page.getByRole('button',{name:'确认接受此项例外，保留原设定'}).click();await expect(page.getByRole('button',{name:'接受此版本'})).toBeEnabled();
 await page.getByRole('button',{name:'接受此版本'}).click();if(await page.getByRole('button',{name:'确认接受正文与所选记忆'}).count())await page.getByRole('button',{name:'确认接受正文与所选记忆'}).click();let saved=await state(page);expect(saved.state.facts[0].label).toBe(blue);expect(saved.state.drafts[0].status).toBe('ACCEPTED');expect(saved.state.commits.at(-1).factDecisions[0].sourceQuote).toBe(text);await page.reload();await expect(page.getByText('作者已明确接受本稿例外 · 原设定保留')).toBeVisible();await capture(page,testInfo,'10-fact-exception-audit');await noOverflow(page);expect(errors).toEqual([]);
});
