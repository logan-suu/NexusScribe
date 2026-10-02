import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {createAgentService,readConfig,validateInput,validateOutput,parseModelJson,MAX_BODY_BYTES,normalizePlan} from '../server/provider.js';
import {createHandler,originAllowed} from '../server/index.js';
const env={NEXUS_OVERAGE_CONFIRMED_OFF:'true',NEXUS_LIVE_ENABLED:'true',NEXUS_API_BASE_URL:'https://example.test/v1/',NEXUS_API_MODEL:'test-model',NEXUS_API_KEY:'server-only-secret'};
const input={input:{idea:'一座灯塔每晚失去一层',protagonist:'阿离'}};
const interview={questions:[{key:'tone',title:'什么情绪？',hint:'选择故事感觉',placeholder:'例如温暖'}],summary:'先确定情绪'};
const reply=out=>new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify(out)}}]}));
const source={chapterId:'chapter-1',revision:1,text:'原文'};
const context={projectId:'p1',version:1,sources:[source]};
const generation={project:{projectId:'p1',idea:'灯塔',outline:[{id:'chapter-1'}]},chapterIndex:0,context};
const chapter={text:'阿离找到灯。',chapterId:'chapter-1',staging:[{label:'找到灯',sourceQuote:'阿离找到灯。'}],reviewNotes:[]};
test('disabled by default; status never reveals credentials or URL path',async()=>{
 let count=0;const s=createAgentService({env:{...env,NEXUS_LIVE_ENABLED:'false'},fetchImpl:()=>{count++;}});
 assert.equal(s.status().configured,false);await assert.rejects(s.run('interview',input),{code:'NOT_CONFIGURED'});assert.equal(count,0);
 assert.equal(JSON.stringify(s.status()).includes(env.NEXUS_API_KEY),false);assert.equal(s.status().baseHost,'example.test');assert.equal(JSON.stringify(s.status()).includes('/v1'),false);
 assert.equal(readConfig({...env,NEXUS_OVERAGE_CONFIRMED_OFF:''}).configured,false);
 for(const key of ['NEXUS_API_BASE_URL','NEXUS_API_MODEL','NEXUS_API_KEY'])assert.equal(readConfig({...env,[key]:''}).configured,false);
});
test('configuration rejects unsafe URLs and invalid caps',()=>{
 for(const url of ['http://example.test','https://u:p@example.test','https://example.test/?q=1','https://example.test/#hash','not a url'])assert.equal(readConfig({...env,NEXUS_API_BASE_URL:url}).configured,false);
 for(const [key,value] of [['NEXUS_MAX_CALLS','31'],['NEXUS_MAX_OUTPUT_TOKENS','3001'],['NEXUS_MAX_CALLS','0'],['NEXUS_MAX_OUTPUT_TOKENS','no']])assert.equal(readConfig({...env,[key]:value}).configured,false);
 assert.equal(readConfig(env).endpoint,'https://example.test/v1/chat/completions');
});
test('authentication is server-only, explicit cap sent and metadata canonical',async()=>{
 let request;const s=createAgentService({env,fetchImpl:async(url,options)=>{request={url,...options};return reply(interview);}});
 const out=await s.run('interview',input);assert.equal(out.provider.isLive,true);assert.equal(request.headers.Authorization,'Bearer server-only-secret');assert.equal(request.redirect,'error');assert.equal(request.headers['User-Agent'],'NexusScribe-demo/0.1');assert.match(request.headers['x-opencode-session'],/^[0-9a-f-]{36}$/);assert.equal(JSON.parse(request.body).max_tokens,1200);assert.equal(request.body.includes(env.NEXUS_API_KEY),false);assert.equal(JSON.stringify(out).includes(env.NEXUS_API_KEY),false);
});
test('strict inputs reject missing core, action, wrong wrapper and cross-project context before fetch',async()=>{
 let count=0;const s=createAgentService({env,fetchImpl:async()=>{count++;return reply(interview);}});
 for(const [action,payload] of [['bad',{}],['interview',{}],['interview',{idea:'x'}],['planStory',{input:{idea:''}}],['generateChapter',{...generation,chapterIndex:1}],['generateChapter',{...generation,context:{...context,projectId:'other'}}],['reviewChapter',{text:'x',chapterId:'absent',context}],['interpretRevision',{beforeText:'old',afterText:'new',chapterId:'chapter-1',context}]])await assert.rejects(s.run(action,payload),{code:'INVALID_INPUT'});
 assert.equal(count,0);
});
test('full JSON or single fenced JSON only, never guessed or prose extracted',()=>{
 assert.deepEqual(parseModelJson('```json\n{"a":1}\n```'),{a:1});
 for(const text of ['Here: {"a":1}','{"a":1,}','[]','```json\n{}\n``` trailing','{} {}'])assert.throws(()=>parseModelJson(text),{code:'INVALID_MODEL_OUTPUT'});
});
test('output malformed, tampered metadata, unsupported evidence and wrong chapter rejected without fallback',async()=>{
 for(const output of [{questions:[]},{...interview,provider:{isLive:false}},{...chapter,chapterId:'foreign'},{...chapter,staging:[{label:'invented',sourceQuote:'不存在'}]}]){
 const action=output.text?'generateChapter':'interview';const s=createAgentService({env,fetchImpl:async()=>reply(output)});await assert.rejects(s.run(action,action==='generateChapter'?generation:input),{code:'INVALID_MODEL_OUTPUT'});
 }
 const s=createAgentService({env,fetchImpl:async()=>reply(chapter)});assert.equal((await s.run('generateChapter',generation)).text,chapter.text);
});
test('upstream body, credential errors and timeout are redacted',async()=>{
 for(const fetchImpl of [async()=>{throw Error(env.NEXUS_API_KEY);},async()=>new Response(env.NEXUS_API_KEY,{status:401}),async()=>new Response('{bad')]){
 const s=createAgentService({env,fetchImpl});await assert.rejects(s.run('interview',input),e=>e.code==='UPSTREAM_ERROR'&&!e.message.includes(env.NEXUS_API_KEY));
 }
 const s=createAgentService({env,timeoutMs:5,fetchImpl:()=>new Promise(()=>{})});await assert.rejects(s.run('interview',input),{code:'UPSTREAM_TIMEOUT'});
});
test('hard lifetime cap applies to failures too',async()=>{
 let count=0;const s=createAgentService({env:{...env,NEXUS_MAX_CALLS:'1'},fetchImpl:async()=>{count++;return new Response('',{status:500});}});
 await assert.rejects(s.run('interview',input),{code:'UPSTREAM_ERROR'});await assert.rejects(s.run('interview',input),{code:'CALL_LIMIT'});assert.equal(count,1);
});
test('bounded concurrent calls and per-minute request rate',async()=>{
 const resolvers=[];const s=createAgentService({env,fetchImpl:()=>new Promise(resolve=>resolvers.push(resolve))});
 const a=s.run('interview',input),b=s.run('interview',input);await assert.rejects(s.run('interview',input),{code:'CONCURRENT_LIMIT'});resolvers.forEach(r=>r(reply(interview)));await Promise.all([a,b]);
 const r=createAgentService({env,now:()=>1000,fetchImpl:async()=>reply(interview)});for(let i=0;i<6;i++)await r.run('interview',input);await assert.rejects(r.run('interview',input),{code:'RATE_LIMIT'});
});
test('revision/review suggestions are evidence bound and never state commits',()=>{
 const revision={beforeText:'以前',afterText:'原文',chapterId:'chapter-1',context};validateInput('interpretRevision',revision);
 validateOutput('interpretRevision',{summary:'待确认',intents:['ambiguous'],questions:['是否是事实？'],suggestedFacts:[{label:'原文',sourceQuote:'原文'}]},revision);
 assert.throws(()=>validateOutput('interpretRevision',{summary:'x',intents:['canon_update'],questions:[],suggestedFacts:[{label:'假',sourceQuote:'虚构'}]},revision));
 validateOutput('reviewChapter',{summary:'需复核',issues:[{severity:'warning',explanation:'可能不一致',sourceQuote:'原文'}],checks:['角色知识']},{text:'原文'});
 assert.equal(context.version,1);assert.equal(source.text,'原文');
});
async function request({body='',method='POST',url='/api/agent',headers={}}={},service={status:()=>({configured:false}),run:async()=>interview}){
 const req=Readable.from([Buffer.from(body)]);Object.assign(req,{method,url,headers:{host:'127.0.0.1:8787','content-type':'application/json',...headers}});
 const result={};const res={writeHead(status,headers){result.status=status;result.headers=headers;},end(text){result.body=JSON.parse(text);}};await createHandler(service)(req,res);return result;
}
test('HTTP body limits, origin/host and JSON validation without sockets',async()=>{
 assert.equal(originAllowed('https://evil.test'),false);assert.equal(originAllowed('http://localhost:5173'),true);assert.equal(originAllowed('http://127.0.0.1:4173'),true);assert.equal(originAllowed('http://localhost:4173'),true);assert.equal(originAllowed('http://localhost.evil.test:4173'),false);
 assert.equal((await request({body:'x'.repeat(MAX_BODY_BYTES+1)})).status,413);
 assert.equal((await request({body:'{'})).status,400);
 assert.equal((await request({headers:{origin:'https://evil.test'}})).status,403);
 assert.equal((await request({headers:{host:'evil.test'}})).status,403);
 assert.equal((await request({headers:{'content-type':'text/plain'}})).status,415);
 const good=await request({body:JSON.stringify({action:'interview',input})});assert.deepEqual(good.body,{output:interview});
 const status=await request({method:'GET',url:'/api/status'});assert.deepEqual(status.body,{configured:false});
});

test('brand-new chapter preview uses empty version zero context',async()=>{const s=createAgentService({env,fetchImpl:async()=>reply(chapter)});const out=await s.run('generateChapter',{...generation,chapterId:'chapter-1',context:{projectId:'p1',version:0,sources:[]}});assert.equal(out.text,chapter.text);});
test('planning contract requires all nine fields and exactly three scenes',async()=>{
 const fieldKeys=['premise','protagonist','emotionalDirection','pov','desire','obstacle','coreQuestion','boundaries','opening'];
 const contract={fields:fieldKeys.map(key=>({key,label:key,value:'待作者确认',status:'proposed'})),premise:'灯塔消失',protagonist:'阿离',emotionalDirection:'不安',pov:'第三人称',desire:'查明真相',boundaries:'',unresolved:['灯塔为何消失']};
 const outline=[1,2,3].map(n=>({id:`chapter-${n}`,title:'灯塔',goal:'查明原因',conflict:'无法靠近',knowledgeDelta:'发现线索',exitState:'选择调查',emotionalArc:'平静到不安',pov:'第三人称',scene:{time:'夜',location:'海边',participants:['阿离'],allowedReveal:'灯塔变矮',forbiddenReveal:'最终真相',preconditions:[]}}));
 const service=createAgentService({env,fetchImpl:async()=>reply({contract,outline})});const out=await service.run('planStory',input);assert.equal(out.contract.status,'proposal');assert.equal(out.outline.length,3);assert.equal(out.outline[0].number,1);
 for(const malformed of [{contract:{...contract,fields:contract.fields.slice(1)},outline},{contract,outline:outline.slice(1)},{contract,outline:[outline[0],outline[0],outline[0]]}])assert.throws(()=>validateOutput('planStory',malformed,input),{code:'INVALID_MODEL_OUTPUT'});
});
test('truncated or oversized upstream output is never used',async()=>{
 const truncated=createAgentService({env,fetchImpl:async()=>new Response(JSON.stringify({choices:[{finish_reason:'length',message:{content:JSON.stringify(interview)}}]}))});await assert.rejects(truncated.run('interview',input),{code:'OUTPUT_TRUNCATED'});
 const oversized=createAgentService({env,fetchImpl:async()=>new Response('x'.repeat(130*1024))});await assert.rejects(oversized.run('interview',input),{code:'UPSTREAM_ERROR'});
});
test('all calls use a stable session identifier without impersonation',async()=>{
 const sessions=[];const service=createAgentService({env,fetchImpl:async(url,options)=>{sessions.push(options.headers['x-opencode-session']);assert.equal(options.headers['User-Agent'],'NexusScribe-demo/0.1');return reply(interview);}});await service.run('interview',input);await service.run('interview',input);assert.equal(sessions[0],sessions[1]);
});

test('interview cannot reask an already answered question',()=>{assert.throws(()=>validateOutput('interview',interview,{idea:'灯塔',tone:'不安'}),{code:'INVALID_MODEL_OUTPUT'});assert.throws(()=>validateOutput('interview',interview,{idea:'灯塔',answers:{tone:'温暖'}}),{code:'INVALID_MODEL_OUTPUT'});});

const compactInput={idea:'灯塔逐层消失',protagonist:'作者的小舟',tone:'作者的温暖',pov:'第一人称',goal:'作者的目标',boundaries:'不要复活'};
const compactPlan={proposals:{},obstacle:'雾阻挡道路',coreQuestion:'谁收走灯塔',opening:'夜访海边',unresolved:['真相待定'],outline:[1,2,3].map(n=>({title:`纸灯${n}`,goal:'寻找灯塔',conflict:'海雾封路',knowledgeDelta:'发现纸灯',exitState:'决定追踪',emotionalArc:'好奇到犹豫',scene:{time:'夜晚',location:'海岛',participants:['小舟'],allowedReveal:'纸灯线索',forbiddenReveal:'最终真相',preconditions:[]}}))};
test('compact plans preserve explicit author values and create stable canonical metadata',async()=>{
 const canonical=normalizePlan(compactPlan,compactInput);
 for(const [authorKey,contractKey] of [['idea','premise'],['protagonist','protagonist'],['tone','emotionalDirection'],['pov','pov'],['goal','desire'],['boundaries','boundaries']]){
 assert.equal(canonical.contract[contractKey],compactInput[authorKey]);assert.equal(canonical.contract.fields.find(f=>f.key===contractKey).status,'confirmed');
 }
 assert.deepEqual(canonical.outline.map(ch=>ch.id),['chapter-1','chapter-2','chapter-3']);assert.ok(canonical.outline.every(ch=>ch.pov==='第一人称'));assert.equal(canonical.contract.fields.length,9);
 assert.throws(()=>normalizePlan({...compactPlan,proposals:{pov:'擅自更改'}},compactInput),{code:'INVALID_MODEL_OUTPUT'});
 let captured;const service=createAgentService({env,fetchImpl:async(url,options)=>{captured=JSON.parse(options.body);return reply(compactPlan);}});const out=await service.run('planStory',{input:compactInput});assert.equal(out.provider.id,'openai-compatible');assert.equal(out.contract.provenance.id,'openai-compatible');assert.equal(out.contract.status,'proposal');assert.ok(out.outline.every(ch=>ch.provenance==='openai-compatible'));
 assert.ok(captured.messages[0].content.includes('Compact planning response'));assert.ok(captured.messages[0].content.includes('12 Chinese characters'));assert.equal(Object.hasOwn(captured,'reasoning_effort'),false);assert.equal(Object.hasOwn(captured,'thinking'),false);
});
test('compact plans require every missing author proposal and every creative field, without fabricated fallback',()=>{
 const missingAuthor={idea:'灯塔'};const proposals={protagonist:'旅人',tone:'温暖',pov:'第三人称',goal:'找灯塔'};
 const out=normalizePlan({...compactPlan,proposals},missingAuthor);assert.equal(out.contract.protagonist,'旅人');assert.equal(out.contract.fields.find(f=>f.key==='protagonist').status,'proposed');assert.equal(out.contract.boundaries,'');assert.equal(out.contract.fields.find(f=>f.key==='boundaries').status,'deferred');
 const answers={idea:'灯塔',answers:{protagonist:'作者回答',tone:'明亮',pov:'第一人称',goal:'回家'}};assert.equal(normalizePlan(compactPlan,answers).contract.protagonist,'作者回答');
 for(const key of ['obstacle','coreQuestion','opening','unresolved','outline','proposals']){const wire=structuredClone(compactPlan);delete wire[key];assert.throws(()=>normalizePlan(wire,compactInput),{code:'INVALID_MODEL_OUTPUT'});}
 for(const key of Object.keys(proposals)){const proposed={...proposals};delete proposed[key];assert.throws(()=>normalizePlan({...compactPlan,proposals:proposed},missingAuthor),{code:'INVALID_MODEL_OUTPUT'});}
 for(const key of ['title','goal','conflict','knowledgeDelta','exitState','emotionalArc','scene']){const wire=structuredClone(compactPlan);delete wire.outline[0][key];assert.throws(()=>normalizePlan(wire,compactInput),{code:'INVALID_MODEL_OUTPUT'});}
 for(const key of ['time','location','participants','allowedReveal','forbiddenReveal','preconditions']){const wire=structuredClone(compactPlan);delete wire.outline[0].scene[key];assert.throws(()=>normalizePlan(wire,compactInput),{code:'INVALID_MODEL_OUTPUT'});}
 for(const outline of [compactPlan.outline.slice(1),[...compactPlan.outline,compactPlan.outline[0]]])assert.throws(()=>normalizePlan({...compactPlan,outline},compactInput),{code:'INVALID_MODEL_OUTPUT'});
 assert.throws(()=>normalizePlan({...compactPlan,outline:compactPlan.outline.map(ch=>({...ch,id:'untrusted'}))},compactInput),{code:'INVALID_MODEL_OUTPUT'});
});
test('compact example measures actual JSON character redundancy without estimating tokens',()=>{
 const canonical=normalizePlan(compactPlan,compactInput);const compactCharacters=JSON.stringify(compactPlan).length,canonicalCharacters=JSON.stringify(canonical).length;
 assert.ok(compactCharacters<canonicalCharacters);assert.equal(compactCharacters,832);assert.equal(canonicalCharacters,1634);
});

test('legacy plans cannot overwrite explicit author choices or elevate model creative fields',async()=>{
 const legacy=normalizePlan(compactPlan,compactInput);const mapping={premise:'idea',protagonist:'protagonist',emotionalDirection:'tone',pov:'pov',desire:'goal',boundaries:'boundaries'};
 for(const key of Object.keys(mapping))legacy.contract[key]='模型擅自改变';
 for(const field of legacy.contract.fields){field.status='confirmed';if(Object.hasOwn(mapping,field.key))field.value='模型擅自改变';}
 legacy.outline.forEach(ch=>{ch.id='model-'+ch.id;ch.pov='模型的视角';});
 const original=structuredClone(legacy);const normalized=normalizePlan(legacy,compactInput);
 for(const [key,authorKey] of Object.entries(mapping)){assert.equal(normalized.contract[key],compactInput[authorKey]);const field=normalized.contract.fields.find(f=>f.key===key);assert.equal(field.value,compactInput[authorKey]);assert.equal(field.status,'confirmed');}
 for(const key of ['obstacle','coreQuestion','opening']){const field=normalized.contract.fields.find(f=>f.key===key);assert.equal(field.status,'proposed');assert.equal(field.value,compactPlan[key]);}
 assert.deepEqual(normalized.outline.map(ch=>ch.id),['chapter-1','chapter-2','chapter-3']);assert.ok(normalized.outline.every(ch=>ch.pov===compactInput.pov));assert.deepEqual(legacy,original);
 const noAuthor=normalizePlan(legacy,{idea:'作者灵感'});assert.equal(noAuthor.contract.fields.find(f=>f.key==='protagonist').status,'proposed');assert.equal(noAuthor.contract.boundaries,'');assert.equal(noAuthor.contract.fields.find(f=>f.key==='boundaries').status,'deferred');
 const service=createAgentService({env,fetchImpl:async()=>reply(legacy)});const result=await service.run('planStory',{input:compactInput});assert.equal(result.contract.protagonist,compactInput.protagonist);assert.equal(result.contract.fields.find(f=>f.key==='obstacle').status,'proposed');
});

test('reasoning effort is absent by default and explicit low preserves transport/auth/caps',async()=>{
 const requests=[];for(const selected of [undefined,'low']){
 const configuredEnv={...env};if(selected!==undefined)configuredEnv.NEXUS_REASONING_EFFORT=selected;
 const service=createAgentService({env:configuredEnv,fetchImpl:async(url,options)=>{requests.push({url,options,body:JSON.parse(options.body)});return reply(interview);}});await service.run('interview',input);
 }
 assert.equal(Object.hasOwn(requests[0].body,'reasoning_effort'),false);assert.equal(requests[1].body.reasoning_effort,'low');
 for(const request of requests){assert.equal(Object.hasOwn(request.body,'thinking'),false);assert.equal(request.body.max_tokens,1200);assert.equal(request.options.headers.Authorization,'Bearer server-only-secret');assert.equal(request.options.headers['User-Agent'],'NexusScribe-demo/0.1');assert.equal(request.options.redirect,'error');}
 assert.equal(requests[0].options.headers['x-opencode-session'],requests[1].options.headers['x-opencode-session']);assert.equal(requests[0].url,requests[1].url);
 const {reasoning_effort,...withoutEffort}=requests[1].body;assert.deepEqual(withoutEffort,requests[0].body);
});
test('invalid reasoning values block configuration before fetch and low errors never fallback',async()=>{
 for(const value of ['','none','high','max','LOW','low ','disabled']){let calls=0;const service=createAgentService({env:{...env,NEXUS_REASONING_EFFORT:value},fetchImpl:async()=>{calls++;return reply(interview);}});assert.equal(service.status().configured,false);await assert.rejects(service.run('interview',input),{code:'NOT_CONFIGURED'});assert.equal(calls,0);}
 let calls=0;const service=createAgentService({env:{...env,NEXUS_REASONING_EFFORT:'low'},fetchImpl:async()=>{calls++;return new Response('private upstream',{status:400});}});await assert.rejects(service.run('interview',input),{code:'UPSTREAM_ERROR'});assert.equal(calls,1);
});
