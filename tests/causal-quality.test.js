// Offline only: injected fake transports, fictional prose and public fake credentials.
import test,{mock} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,mkdir,writeFile,rm,stat,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {ID,WORKFLOW,ENDPOINT,FREEZE_SHA,MASKED_MAPPING_SHA,BODY_SHAS,PATHS,digest,validateRequests,validateFreeze,loadFreeze,approval,gates,validateArtifact,diskIO,reservation,validateReservation,secretEcho,stats,aggregateUsage,runTrial,safeCode,main} from '../scripts/run-causal-quality.mjs';
mock.method(globalThis,'fetch',async()=>{throw Error('NETWORK_FORBIDDEN');});
const key='PUBLIC_FAKE_QUALITY_KEY!+/=not-secret',gh='PUBLIC_FAKE_GITHUB_TOKEN-not-secret',sha='f'.repeat(40);
const env={NEXUS_QUALITY_APPROVED:ID,NEXUS_OVERAGE_CONFIRMED_OFF:'true',GITHUB_ACTIONS:'true',GITHUB_RUN_ATTEMPT:'1',GITHUB_REPOSITORY:'logan-suu/NexusScribe',GITHUB_REF:'refs/heads/dev_v1.0',GITHUB_RUN_ID:'123',NEXUS_CI_RUN_ID:'122',GITHUB_SHA:sha,NEXUS_SOURCE_SHA:sha,NEXUS_API_KEY:key,GH_TOKEN:gh,NEXUS_RESERVATION_UPLOADED:'true',NEXUS_RESERVATION_ARTIFACT_ID:'456'};
const run={id:123,head_sha:sha,head_branch:'dev_v1.0',run_attempt:1,event:'workflow_dispatch',path:'.github/workflows/'+WORKFLOW,display_title:ID,status:'in_progress'};
const ci={id:122,path:'.github/workflows/ci.yml',head_sha:sha,head_branch:'dev_v1.0',event:'push',status:'completed',conclusion:'success'};
const artifact={id:456,name:ID+'-reservation',expired:false,size_in_bytes:2000,workflow_run:{id:123,head_sha:sha}};
const frozen=await readFile(new URL('../eval/causal-continuity-requests.json',import.meta.url));
const manifest=()=>({protocol:ID,status:'new_separately_approved_not_dispatched',bodySha256:[...BODY_SHAS],maxAttempts:6,maxOutputTokensPerCall:3000,maxOutputTokensTotal:18000,maskedMappingSha256:MASKED_MAPPING_SHA,stop:'operational_delivery_safety_budget_uncertainty',sha256:{}});
const trial={requests:validateFreeze(frozen),manifest:manifest()};
const hasCode=code=>e=>e.code===code&&e.message===code;
const prose=n=>Array.from({length:5},()=> '弱'.repeat(n===3||n===4?80:100)).join('\n\n');
function envelope(n=1){return {id:'PRIVATE_ID',model:'PRIVATE_MODEL',extra:{private:'PRIVATE_ENVELOPE'},choices:[{finish_reason:'stop',message:{role:'assistant',content:prose(n)}}],usage:{prompt_tokens:42,completion_tokens:500,total_tokens:542,completion_tokens_details:{reasoning_tokens:0}}};}
const response=(data=envelope(),status=200)=>new Response(JSON.stringify(data),{status,headers:{'x-private':'PRIVATE_HEADER'}});
function memoryIO(initial={}){const data=Object.fromEntries(Object.entries(initial).map(([n,v])=>[n,Buffer.isBuffer(v)?v:Buffer.from(JSON.stringify(v))]));return {data,async write(n,v){assert.equal(Object.hasOwn(data,n),false,'exclusive evidence '+n);data[n]=Buffer.isBuffer(v)?Buffer.from(v):Buffer.from(JSON.stringify(v));},async files(){return {...data};}};}
function context(options={}){const t=options.trial||trial,e=options.env||env,record=reservation(e,t);return {env:e,trial:t,record,runs:[run],ci,artifact,io:memoryIO({'reservation.json':record}),timeoutMs:1000,sleep:async()=>{},...options};}
async function execute(transport=async n=>response(envelope(n)),options={}){
 const c=context(options),calls=[];
 const result=await runTrial({...c,fetchImpl:async(...args)=>{const n=calls.length+1;assert.ok(c.io.data['dispatch-0'+n+'.json'],'dispatch precedes fetch');calls.push(args);return transport(n,...args);}});
 const index=JSON.parse(c.io.data['index.json']);for(const [n,h]of Object.entries(index.sha256))assert.equal(digest(c.io.data[n]),h);
 assert.deepEqual(JSON.parse(c.io.data['result.json']),result);assert.equal(result.remainingAttempts,0);
 return {result,io:c.io,calls};
}
function reader({chunks=[],status=200,stalled=false,throws=false}={}){let count=0,cancels=0;return {stats:()=>({count,cancels}),response:{ok:status>=200&&status<300,status,body:{getReader(){return {read(){count++;if(throws)return Promise.reject(Error(key));return chunks.length?Promise.resolve({done:false,value:Buffer.from(chunks.shift())}):stalled?new Promise(()=>{}):Promise.resolve({done:true});},cancel(){cancels++;return new Promise(()=>{});}};}},text(){throw Error('unbounded text forbidden');}}};}
async function fixtureRoot(t){const root=await mkdtemp(join(tmpdir(),'nexus-quality-'));t.after(()=>rm(root,{recursive:true,force:true}));const m=manifest();for(const p of PATHS){const bytes=await readFile(new URL('../'+p,import.meta.url));await mkdir(dirname(join(root,p)),{recursive:true});await writeFile(join(root,p),bytes);m.sha256[p]=digest(bytes);}await writeFile(join(root,'eval/causal-quality-manifest.json'),JSON.stringify(m));return {root,m};}

test('unchanged six-body freeze pins order, exact messages, target counts and settings',()=>{
 assert.equal(digest(frozen),FREEZE_SHA);assert.equal(validateRequests(trial.requests),trial.requests);
 assert.deepEqual(trial.requests.map(r=>[r.fixture,r.arm]),[['F1-replay','A'],['F1-replay','B'],['F2-physical-transition','B'],['F2-physical-transition','A'],['F3-unused-domain-transfer','A'],['F3-unused-domain-transfer','B']]);
 for(const [i,r]of trial.requests.entries()){assert.equal(digest(r.body),BODY_SHAS[i]);assert.equal(r.body.model,'deepseek-v4.1-flash');assert.deepEqual(r.body.thinking,{type:'disabled'});for(const k of ['seed','reasoning_effort','stream'])assert.equal(Object.hasOwn(r.body,k),false);}
 for(const bytes of [Buffer.from('{}'),Buffer.from('{'),Buffer.concat([frozen,Buffer.from(' ')])])assert.throws(()=>validateFreeze(bytes),hasCode('FREEZE_INVALID'));
 for(const change of [rs=>rs.pop(),rs=>rs[0].body.max_tokens++,rs=>rs[0].targetHan[0]--,rs=>rs[0].arm='B',rs=>rs.reverse(),rs=>rs[1].body.messages[1].content+=' ']){const rs=structuredClone(trial.requests);change(rs);assert.throws(()=>validateRequests(rs),hasCode('FREEZE_INVALID'));}
});
test('whole lifetime history, exact source CI, branch, rerun and approval guards',()=>{
 assert.equal(gates(env,[run],ci),true);
 for(const patch of [{NEXUS_QUALITY_APPROVED:'true'},{NEXUS_QUALITY_APPROVED:'old'},{NEXUS_OVERAGE_CONFIRMED_OFF:'false'}])assert.throws(()=>gates({...env,...patch},[run],ci),hasCode('APPROVAL_REQUIRED'));
 for(const patch of [{GITHUB_ACTIONS:'false'},{GITHUB_RUN_ATTEMPT:'2'},{GITHUB_REPOSITORY:'wrong/repo'},{GITHUB_REF:'refs/heads/main'},{GITHUB_RUN_ID:''},{NEXUS_CI_RUN_ID:'bad'},{GITHUB_SHA:'bad'}])assert.throws(()=>gates({...env,...patch},[run],ci),hasCode('CONFIG_INVALID'));
 assert.throws(()=>approval({...env,NEXUS_SOURCE_SHA:'a'.repeat(40)}),hasCode('SOURCE_MISMATCH'));
 for(const runs of [[],null,{},[run,run]])assert.throws(()=>gates(env,runs,ci),hasCode('STAGE_CONSUMED'));
 for(const patch of [{id:124},{head_sha:'a'.repeat(40)},{head_branch:'main'},{run_attempt:2},{run_attempt:'1'},{event:'push'},{path:'wrong'},{display_title:'other'},{status:'completed'}])assert.throws(()=>gates(env,[{...run,...patch}],ci),hasCode('HISTORY_INVALID'));
 for(const patch of [{id:124},{head_sha:'a'.repeat(40)},{head_branch:'main'},{event:'pull_request'},{path:'wrong'},{status:'in_progress'},{conclusion:'failure'}])assert.throws(()=>gates(env,[run],{...ci,...patch}),hasCode('CI_REQUIRED'));
});
test('uploaded reservation metadata is bound to this exact run and source',()=>{
 validateArtifact(env,artifact);
 for(const patch of [{id:457},{name:'wrong'},{expired:true},{size_in_bytes:0},{workflow_run:{id:124,head_sha:sha}},{workflow_run:{id:123,head_sha:'a'.repeat(40)}}])assert.throws(()=>validateArtifact(env,{...artifact,...patch}),hasCode('PERSISTENCE_FAILED'));
 for(const patch of [{NEXUS_RESERVATION_UPLOADED:'false'},{NEXUS_RESERVATION_ARTIFACT_ID:''}])assert.throws(()=>validateArtifact({...env,...patch},artifact),hasCode('PERSISTENCE_FAILED'));
});
test('reservation binds all six attempts, immutable inputs, output ceilings and masking commitment',()=>{
 const r=reservation(env,trial);validateReservation(r,env,trial);assert.equal(r.attemptsReserved,6);assert.equal(r.remainingAttempts,0);assert.equal(r.maxOutputTokensTotal,18000);assert.equal(r.maxOutputTokensPerCall,3000);assert.equal(r.maskedMappingSha256,MASKED_MAPPING_SHA);assert.deepEqual(r.bodySha256,BODY_SHAS);
 for(const k of Object.keys(r))assert.throws(()=>validateReservation({...r,[k]:null},env,trial),hasCode('PERSISTENCE_FAILED'));
 assert.throws(()=>validateReservation({...r,extra:true},env,trial),hasCode('PERSISTENCE_FAILED'));
});
test('manifest freezes actual source and rejects omissions, extra dependencies and mutations',async t=>{
 const {root,m}=await fixtureRoot(t),path=join(root,'eval/causal-quality-manifest.json');assert.equal((await loadFreeze(root)).requests.length,6);
 for(const patch of [{protocol:'old'},{status:'retired'},{bodySha256:[]},{maxAttempts:7},{maxOutputTokensPerCall:3001},{maxOutputTokensTotal:18001},{maskedMappingSha256:'wrong'},{stop:'literary_gate'},{sha256:{}},{sha256:{...m.sha256,extra:'bad'}}]){await writeFile(path,JSON.stringify({...m,...patch}));await assert.rejects(loadFreeze(root),hasCode('FREEZE_INVALID'));}
 await writeFile(path,JSON.stringify(m));await writeFile(join(root,PATHS[0]),'mutated');await assert.rejects(loadFreeze(root),hasCode('FREEZE_INVALID'));
 assert.equal((await loadFreeze()).requests.length,6);
});
test('disk evidence is exclusive, fsynced, mode restricted and refuses unknown files/symlinks',async t=>{
 const root=await mkdtemp(join(tmpdir(),'nexus-quality-io-'));t.after(()=>rm(root,{recursive:true,force:true}));const io=await diskIO(root);
 await io.write('reservation.json',{});assert.equal((await stat(join(root,'reservation.json'))).mode&0o777,0o600);await assert.rejects(io.write('reservation.json',{}),{code:'EEXIST'});
 for(const n of ['../escape.json','anything.json','dispatch-07.json','response.json'])await assert.rejects(io.write(n,{}),hasCode('PERSISTENCE_FAILED'));
 await symlink(join(root,'reservation.json'),join(root,'dispatch-01.json'));await assert.rejects(io.files(),hasCode('PERSISTENCE_FAILED'));
});
test('six intentionally weak valid candidates continue sequentially with exact bodies and fresh headers',async()=>{
 const gaps=[];let active=0;const {result,io,calls}=await execute(async n=>{active++;assert.equal(active,1);await Promise.resolve();active--;return response(envelope(n));},{sleep:async ms=>gaps.push(ms)});
 assert.equal(calls.length,6);assert.deepEqual(gaps,[11000,11000,11000,11000,11000]);assert.equal(result.status,'six_calls_retained_awaiting_masked_read');assert.equal(result.attempts,6);assert.equal(result.requestedOutputTokens,18000);assert.equal(result.cost,'unknown');assert.deepEqual(result.usage,{promptTokens:252,completionTokens:3000,totalTokens:3252,reasoningTokens:0});
 const sessions=[];for(const [i,[url,opt]]of calls.entries()){assert.equal(url,ENDPOINT);assert.equal(opt.body,JSON.stringify(trial.requests[i].body));assert.equal(digest(opt.body),BODY_SHAS[i]);assert.equal(opt.method,'POST');assert.equal(opt.redirect,'error');assert.equal(opt.headers.Authorization,'Bearer '+key);assert.equal(opt.headers['User-Agent'],'NexusScribe-demo/0.1');assert.equal(opt.headers['Content-Type'],'application/json');sessions.push(opt.headers['x-opencode-session']);assert.match(sessions.at(-1),/^[a-f0-9-]{36}$/);assert.equal(opt.signal.aborted,true);const n=i+1;assert.equal(io.data['raw-prose-0'+n+'.bin'].toString(),prose(n));const completed=JSON.parse(io.data['completed-0'+n+'.json']);assert.equal(completed.text,prose(n));assert.equal(completed.textSha256,digest(prose(n)));assert.equal(completed.counts.pass,true);assert.equal(JSON.parse(io.data['ledger-0'+n+'.json']).status,n===6?'six_calls_retained_awaiting_masked_read':'running');}
 assert.equal(new Set(sessions).size,6);const kept=Object.values(io.data).map(b=>b.toString()).join('\n');for(const v of [key,gh,'PRIVATE_ID','PRIVATE_MODEL','PRIVATE_ENVELOPE','PRIVATE_HEADER','Bearer ',...sessions])assert.equal(kept.includes(v),false);
});
test('preflight and duplicate evidence reject before any provider credential access',async()=>{
 let reads=0,calls=0;const protectedEnv={...env};Object.defineProperty(protectedEnv,'NEXUS_API_KEY',{get(){reads++;throw Error('must not read');}});
 for(const patch of [{runs:[run,run]},{record:{}},{artifact:{...artifact,expired:true}},{io:memoryIO({})},{io:memoryIO({'reservation.json':reservation(env,trial),'dispatch-01.json':{}})}])await assert.rejects(runTrial({...context(),env:protectedEnv,...patch,fetchImpl:async()=>{calls++;return response();}}));
 assert.equal(reads,0);assert.equal(calls,0);
 for(const bad of [undefined,'',' ','bad\r\nheader','x'.repeat(4097)])await assert.rejects(runTrial({...context({env:{...env,NEXUS_API_KEY:bad}}),fetchImpl:async()=>{calls++;}}),hasCode('NOT_CONFIGURED'));
 assert.equal(calls,0);
});
test('failure on any position consumes one attempt, retains prior outputs, makes no retry or continuation',async()=>{
 for(let stop=1;stop<=6;stop++){const {result,calls,io}=await execute(async n=>n===stop?response({error:{code:'rate_limit_exceeded',message:key+' PRIVATE_ERROR'}},429):response(envelope(n)));assert.equal(calls.length,stop);assert.equal(result.attempts,stop);assert.equal(result.error,'UPSTREAM_ERROR');assert.equal(result.status,'stopped');assert.equal(result.stages.at(-1).transportDiagnostics.providerCategory,'rate_limit');assert.equal(Object.hasOwn(io.data,'dispatch-0'+(stop+1)+'.json'),false);assert.equal(Object.values(io.data).some(b=>b.toString().includes('PRIVATE_ERROR')),false);assert.equal(result.usage.completionTokens,null);}
});
test('missing, malformed, inconsistent or over-cap billable usage halts with safe prose preserved',async()=>{
 for(const change of [d=>delete d.usage,d=>delete d.usage.completion_tokens_details,d=>d.usage.completion_tokens='500',d=>d.usage.prompt_tokens=-1,d=>d.usage.total_tokens=1,d=>{d.usage.completion_tokens=3001;d.usage.total_tokens=3043;},d=>d.usage.total_tokens=Infinity]){
  const d=envelope();change(d);const {result,calls,io}=await execute(async()=>response(d));assert.equal(calls.length,1);assert.equal(result.error,'BUDGET_UNCERTAIN');assert.ok(io.data['raw-prose-01.bin']);assert.equal(result.cost,'unknown');
 }
 const d=envelope();d.usage.completion_tokens=3000;d.usage.total_tokens=3042;assert.equal((await execute(async n=>response({...d,choices:envelope(n).choices}))).result.usage.completionTokens,18000);
 assert.deepEqual(aggregateUsage([]),{promptTokens:null,completionTokens:null,totalTokens:null,reasoningTokens:null});
});
test('truncation and deterministic delivery failures retain observed prose and stop',async()=>{
 for(const change of [d=>d.choices[0].finish_reason='length',d=>d.choices[0].message.content='短文',d=>d.choices[0].message.content='弱'.repeat(500)]){const d=envelope();change(d);const {result,calls,io}=await execute(async()=>response(d));assert.equal(calls.length,1);assert.ok(['OUTPUT_TRUNCATED','DELIVERY_FAILED'].includes(result.error));assert.equal(io.data['raw-prose-01.bin'].toString(),d.choices[0].message.content);}
 assert.equal(stats(prose(1),trial.requests[0]).pass,true);assert.equal(stats('弱'.repeat(450)+'\n\n甲\n\n乙\n\n丙',trial.requests[0]).paragraphs,4);
});
test('refusal, tools, malformed envelopes and hidden reasoning are withheld and stop',async()=>{
 const cases=[d=>d.choices[0].message.refusal='refused',d=>d.choices[0].finish_reason='content_filter',d=>d.choices[0].message.tool_calls=[{}],d=>d.choices[0].message.function_call={},d=>d.choices[0].message.role='user',d=>d.choices.push(d.choices[0]),d=>d.choices[0].message.content='',d=>d.choices[0].message.content='```'+prose(1),d=>d.choices[0].message.content='<think>PRIVATE_REASONING</think>'+prose(1),d=>d.choices[0].message.reasoning_content='PRIVATE_REASONING',d=>d.reasoning='PRIVATE_REASONING',d=>d.usage.completion_tokens_details.reasoning_tokens=1,d=>d.choices[0].message.content='\ud800'+prose(1)];
 for(const change of cases){const d=envelope();change(d);const {result,calls,io}=await execute(async()=>response(d));assert.equal(calls.length,1);assert.equal(result.status,'stopped');assert.equal(Object.hasOwn(io.data,'completed-01.json'),false);assert.equal(Object.hasOwn(io.data,'raw-prose-01.bin'),false);assert.equal(Object.values(io.data).some(b=>b.toString().includes('PRIVATE_REASONING')),false);}
 for(const data of [null,{},[],{choices:[null]}, {choices:'bad'}])assert.equal((await execute(async()=>response(data))).result.error,'RESPONSE_INVALID');
});
test('provider and GitHub credential echoes including nested encodings are withheld',async()=>{
 for(const secret of [key,gh])for(const text of [secret,Buffer.from(secret).toString('base64'),Buffer.from(secret).toString('base64url'),Buffer.from(secret).toString('hex'),Buffer.from(secret).toString('hex').toUpperCase(),encodeURIComponent(secret),encodeURIComponent(secret).replace(/%[A-F0-9]{2}/g,x=>x.toLowerCase()),encodeURIComponent(encodeURIComponent(secret)),secret.split('').map(c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0')).join('')]){const d=envelope();d.choices[0].message.content+=text;const {result,calls,io}=await execute(async()=>response(d));assert.equal(calls.length,1);assert.equal(result.error,'SECRET_ECHO');assert.equal(Object.hasOwn(io.data,'raw-prose-01.bin'),false);}
 const d=envelope();d.arbitrary={secret:key};assert.equal((await execute(async()=>response(d))).result.error,'SECRET_ECHO');assert.equal(secretEcho(prose(1),[key,gh]),false);
});
test('bounded success/error readers and network errors retain only safe diagnostics',async()=>{
 for(const [size,error]of [[131072,'DELIVERY_FAILED'],[131073,'RESPONSE_TOO_LARGE']]){const d=envelope();d.choices[0].message.content='短';const base=JSON.stringify(d);const r=reader({chunks:[base+' '.repeat(size-Buffer.byteLength(base))]});const {result,calls}=await execute(async()=>r.response);assert.equal(calls.length,1);assert.equal(result.error,error);assert.equal(result.stages[0].receivedSuccessBytes,size);assert.equal(r.stats().cancels,1);}
 for(const [size,state]of [[16384,'json'],[16385,'too_large']]){const base=JSON.stringify({error:{code:'unsupported_parameter',message:key}});const r=reader({status:400,chunks:[base+' '.repeat(size-Buffer.byteLength(base))]});const {result}=await execute(async()=>r.response);assert.equal(result.error,'UPSTREAM_ERROR');assert.equal(result.stages[0].transportDiagnostics.bodyState,state);}
 assert.equal((await execute(async()=>{throw Error(key);})).result.error,'UPSTREAM_ERROR');assert.equal(safeCode({code:key,message:key}),'PERSISTENCE_FAILED');
 const invalid=reader({chunks:[Buffer.from([0xff])]});assert.equal((await execute(async()=>invalid.response)).result.error,'RESPONSE_INVALID');
});
test('deadline covers fetch, response and error streams; late resolution cannot write or dispatch',{timeout:2000},async()=>{
 let resolveLate;const pending=new Promise(resolve=>resolveLate=resolve);const {result,io,calls}=await execute(()=>pending,{timeoutMs:15});assert.equal(result.error,'UPSTREAM_TIMEOUT');assert.equal(calls.length,1);const saved=JSON.stringify(io.data);resolveLate(response());await new Promise(r=>setTimeout(r,20));assert.equal(JSON.stringify(io.data),saved);
 for(const status of [200,400]){const r=reader({status,stalled:true});const started=Date.now(),out=await execute(async()=>r.response,{timeoutMs:15});assert.equal(out.result.error,'UPSTREAM_TIMEOUT');assert.ok(Date.now()-started<500);assert.equal(out.calls.length,1);assert.equal(r.stats().cancels,1);}
});
test('persistence failure before dispatch makes no call; later failure stops before the next',async()=>{
 for(const failure of ['dispatch-01.json','raw-prose-01.bin','completed-01.json','response-meta-01.json','ledger-01.json','dispatch-02.json']){const c=context(),write=c.io.write.bind(c.io);c.io.write=async(n,v)=>{if(n===failure)throw Error(key);return write(n,v);};let calls=0;const result=await runTrial({...c,fetchImpl:async()=>{calls++;return response();}});assert.equal(calls,failure==='dispatch-01.json'?0:1);assert.equal(result.error,'PERSISTENCE_FAILED');assert.equal(JSON.stringify(result).includes(key),false);}
});
test('frozen request snapshot prevents a transport from replacing a later arm',async()=>{
 const t=structuredClone(trial);const out=await execute(async n=>{if(n===1)t.requests[1].body.messages[0].content='MUTATED';return response(envelope(n));},{trial:t});assert.equal(out.calls.length,6);assert.equal(digest(out.calls[1][1].body),BODY_SHAS[1]);
});
test('prepare has no provider credential access; execute validates durable upload before key',async t=>{
 const {root}=await fixtureRoot(t);let reads=0;const guarded={...env};Object.defineProperty(guarded,'NEXUS_API_KEY',{get(){reads++;return key;}});
 const paths=[];const fake=async url=>{paths.push(url);if(url.includes('/workflows/'))return response({total_count:1,workflow_runs:[run]});if(url.includes('/runs/122'))return response(ci);if(url.includes('/artifacts/456'))return response(artifact);assert.equal(url,ENDPOINT);assert.equal(reads,1);return response({error:{code:'rate_limit_exceeded'}},429);};
 assert.equal((await main('prepare',guarded,{root,fetchImpl:fake})).status,'reserved');assert.equal(reads,0);
 await assert.rejects(main('execute',{...env,NEXUS_RESERVATION_UPLOADED:'false'},{root,fetchImpl:fake}),hasCode('PERSISTENCE_FAILED'));
 const out=await main('execute',guarded,{root,fetchImpl:fake});assert.equal(out.attempts,1);assert.equal(out.error,'UPSTREAM_ERROR');assert.equal(reads,1);assert.ok(paths.indexOf('https://api.github.com/repos/logan-suu/NexusScribe/actions/artifacts/456')<paths.indexOf(ENDPOINT));
 await assert.rejects(main('execute',guarded,{root,fetchImpl:fake}),hasCode('PERSISTENCE_FAILED'));assert.equal(reads,1);
});
test('workflow isolates secret to execution after durable upload; actions pinned, no matrix or retries',async()=>{
 const yaml=await readFile(new URL('../.github/workflows/causal-quality-trial.yml',import.meta.url),'utf8');
 assert.equal((yaml.match(/secrets\./g)||[]).length,1);assert.ok(yaml.indexOf('run-causal-quality.mjs prepare')<yaml.indexOf('id: reservation'));assert.ok(yaml.indexOf('id: reservation')<yaml.indexOf('secrets.NEXUS_API_KEY'));assert.match(yaml,/steps.reservation.outputs.artifact-id != ''/);assert.match(yaml,/NEXUS_RESERVATION_ARTIFACT_ID:.*steps.reservation.outputs.artifact-id/);assert.match(yaml,/cancel-in-progress: false/);assert.match(yaml,/github.run_attempt == 1/);assert.match(yaml,/persist-credentials: false/);assert.doesNotMatch(yaml,/matrix:|continue-on-error:|retry:|NEXUS_API_KEY:.*inputs/);
 for(const line of yaml.split('\n').filter(l=>l.includes('uses:')))assert.match(line,/@[a-f0-9]{40}(?:\s|$)/);
 const protocol=await readFile(new URL('../eval/CAUSAL-QUALITY-PROTOCOL.md',import.meta.url),'utf8');assert.match(protocol,/There is no literary acceptability gate/);assert.match(protocol,new RegExp(MASKED_MAPPING_SHA));
});
