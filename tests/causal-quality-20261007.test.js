import {readHistoricalSource} from '../scripts/eval-source-inventory.mjs';
// Offline only: injected fake transports, fictional prose and public fake credentials.
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import test,{mock} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,mkdir,writeFile,rm,stat,symlink,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {ID,WORKFLOW,ENDPOINT,FREEZE_SHA,MASKING,BODY_SHAS,PATHS,digest,validateRequests,validateFreeze,loadFreeze,approval,gates,validateArtifact,diskIO,reservation,validateReservation,validateMapping,maskedPacket,explicitRefusal,secretEcho,stats,aggregateUsage,runTrial,safeCode,main} from '../scripts/run-causal-quality-20261007.mjs';
mock.method(globalThis,'fetch',async()=>{throw Error('NETWORK_FORBIDDEN');});
const key='PUBLIC_FAKE_QUALITY_KEY!+/=not-secret',gh='PUBLIC_FAKE_GITHUB_TOKEN-not-secret',sha='f'.repeat(40);
const env={NEXUS_QUALITY_APPROVED:ID,NEXUS_OVERAGE_CONFIRMED_OFF:'true',GITHUB_ACTIONS:'true',GITHUB_RUN_ATTEMPT:'1',GITHUB_REPOSITORY:'logan-suu/NexusScribe',GITHUB_REF:'refs/heads/dev_v1.0',GITHUB_RUN_ID:'123',NEXUS_CI_RUN_ID:'122',GITHUB_SHA:sha,NEXUS_SOURCE_SHA:sha,NEXUS_API_KEY:key,GH_TOKEN:gh,NEXUS_RESERVATION_UPLOADED:'true',NEXUS_RESERVATION_ARTIFACT_ID:'456',NEXUS_RESERVATION_SHA256:'0'.repeat(64)};
const run={id:123,head_sha:sha,head_branch:'dev_v1.0',run_attempt:1,event:'workflow_dispatch',path:'.github/workflows/'+WORKFLOW,display_title:ID,status:'in_progress'};
const ci={id:122,path:'.github/workflows/ci.yml',head_sha:sha,head_branch:'dev_v1.0',event:'push',status:'completed',conclusion:'success'};
const artifact={id:456,name:ID+'-reservation',expired:false,size_in_bytes:2000,workflow_run:{id:123,head_sha:sha}};
const frozen=await readFile(new URL('../eval/causal-continuity-requests.json',import.meta.url));
const manifest=()=>({protocol:ID,status:'retired_consumed_offline_replay',remainingAttempts:0,attemptsObserved:6,bodySha256:[...BODY_SHAS],maxAttempts:6,maxOutputTokensPerCall:3000,maxOutputTokensTotal:18000,masking:MASKING,softTargets:'score_only_never_gate',stop:'operational_safety_resource_budget_uncertainty',sha256:{}});
const mapping=Array.from({length:6},(_,i)=>({sequence:i+1,candidateId:'C-'+String(i+1).padStart(32,'0')}));
const trial={requests:validateFreeze(frozen),manifest:manifest()};
const hasCode=code=>e=>e.code===code&&e.message===code;
const prose=n=>Array.from({length:5},()=> '弱'.repeat(n===3||n===4?80:100)).join('\n\n');
function envelope(n=1){return {id:'PRIVATE_ID',model:'PRIVATE_MODEL',extra:{private:'PRIVATE_ENVELOPE'},choices:[{finish_reason:'stop',message:{role:'assistant',content:prose(n)}}],usage:{prompt_tokens:42,completion_tokens:500,total_tokens:542,completion_tokens_details:{reasoning_tokens:0}}};}
const response=(data=envelope(),status=200)=>new Response(JSON.stringify(data),{status,headers:{'x-private':'PRIVATE_HEADER'}});
function memoryIO(initial={}){const data=Object.fromEntries(Object.entries(initial).map(([n,v])=>[n,Buffer.isBuffer(v)?v:Buffer.from(JSON.stringify(v))]));return {data,async write(n,v){assert.equal(Object.hasOwn(data,n),false,'exclusive evidence '+n);data[n]=Buffer.isBuffer(v)?Buffer.from(v):Buffer.from(JSON.stringify(v));},async files(){return {...data};}};}
function context(options={}){const t=options.trial||trial,e=options.env||env,record=reservation(e,t,mapping);return {offlineReplay:true,env:{...e,NEXUS_RESERVATION_SHA256:digest(Buffer.from(JSON.stringify(record)))},trial:t,record,runs:[run],ci,artifact,io:memoryIO({'reservation.json':record}),timeoutMs:1000,sleep:async()=>{},...options,env:{...e,NEXUS_RESERVATION_SHA256:digest(Buffer.from(JSON.stringify(record)))}};}
async function execute(transport=async n=>response(envelope(n)),options={}){
 const c=context(options),calls=[];
 const result=await runTrial({...c,fetchImpl:async(...args)=>{const n=calls.length+1;assert.ok(c.io.data['dispatch-0'+n+'.json'],'dispatch precedes fetch');calls.push(args);return transport(n,...args);}});
 const index=JSON.parse(c.io.data['index.json']);for(const [n,h]of Object.entries(index.sha256))assert.equal(digest(c.io.data[n]),h);
 assert.deepEqual(JSON.parse(c.io.data['result.json']),result);assert.equal(result.remainingAttempts,0);
 return {result,io:c.io,calls};
}
function reader({chunks=[],status=200,stalled=false,throws=false}={}){let count=0,cancels=0;return {stats:()=>({count,cancels}),response:{ok:status>=200&&status<300,status,body:{getReader(){return {read(){count++;if(throws)return Promise.reject(Error(key));return chunks.length?Promise.resolve({done:false,value:Buffer.from(chunks.shift())}):stalled?new Promise(()=>{}):Promise.resolve({done:true});},cancel(){cancels++;return new Promise(()=>{});}};}},text(){throw Error('unbounded text forbidden');}}};}
async function fixtureRoot(t){const root=await mkdtemp(join(tmpdir(),'nexus-quality-'));t.after(()=>rm(root,{recursive:true,force:true}));const m=manifest();for(const p of PATHS){const bytes=await readFile(new URL('../'+p,import.meta.url));await mkdir(dirname(join(root,p)),{recursive:true});await writeFile(join(root,p),bytes);m.sha256[p]=digest(bytes);}await writeFile(join(root,'eval/causal-quality-20261007-manifest.json'),JSON.stringify(m));return {root,m};}

async function archiveFiles(dir,prefix=''){
 const names=[];for(const item of await readdir(dir,{withFileTypes:true})){const name=prefix+item.name;if(item.isDirectory())names.push(...await archiveFiles(new URL(item.name+'/',dir),name+'/'));else names.push(name);}return names.sort();
}
async function executedSource(t){
 const root=await mkdtemp(join(tmpdir(),'nexus-quality07-executed-source-'));t.after(()=>rm(root,{recursive:true,force:true}));
 // The original repository executes these exact .js bytes as ESM. Preserve that package context in the temporary historical replay.
 await writeFile(join(root,'package.json'),JSON.stringify({type:'module'}));
 const history=new URL('../eval/history/causal-quality-20261007/',import.meta.url),m=JSON.parse(await readFile(new URL('source-manifest.json',history)));
 const archived={'scripts/run-causal-quality-20261007.mjs':'source-runner.mjs','.github/workflows/causal-quality-20261007-trial.yml':'source-workflow.yml','eval/CAUSAL-QUALITY-20261007-PROTOCOL.md':'source-protocol.md','tests/causal-quality-20261007.test.js':'source-tests.js'};
 for(const [p,h]of Object.entries(m.sha256)){
  const bytes=archived[p]?await readFile(new URL(archived[p],history)):await readHistoricalSource(p,h);assert.equal(digest(bytes),h);
  await mkdir(dirname(join(root,p)),{recursive:true});await writeFile(join(root,p),bytes);
 }
 await writeFile(join(root,'eval/causal-quality-20261007-manifest.json'),await readFile(new URL('source-manifest.json',history)));
 const source=await import(pathToFileURL(join(root,'scripts/run-causal-quality-20261007.mjs')).href);return {root,main:source.main};
}

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
 for(const patch of [{NEXUS_RESERVATION_UPLOADED:'false'},{NEXUS_RESERVATION_ARTIFACT_ID:''},{NEXUS_RESERVATION_SHA256:''}])assert.throws(()=>validateArtifact({...env,...patch},artifact),hasCode('PERSISTENCE_FAILED'));
});
test('reservation binds all six attempts, immutable inputs, output ceilings and masking commitment',()=>{
 const r=reservation(env,trial,mapping);validateReservation(r,env,trial);assert.equal(r.attemptsReserved,6);assert.equal(r.remainingAttempts,0);assert.equal(r.maxOutputTokensTotal,18000);assert.equal(r.maxOutputTokensPerCall,3000);assert.equal(r.maskedMappingSha256,digest(mapping));assert.deepEqual(r.maskedMapping,mapping);assert.deepEqual(r.bodySha256,BODY_SHAS);
 for(const k of Object.keys(r))assert.throws(()=>validateReservation({...r,[k]:null},env,trial),hasCode('PERSISTENCE_FAILED'));
 assert.throws(()=>validateReservation({...r,extra:true},env,trial),hasCode('PERSISTENCE_FAILED'));
});
test('manifest freezes actual source and rejects omissions, extra dependencies and mutations',async t=>{
 const {root,m}=await fixtureRoot(t),path=join(root,'eval/causal-quality-20261007-manifest.json');assert.equal((await loadFreeze(root)).requests.length,6);
 for(const patch of [{protocol:'old'},{status:'retired'},{bodySha256:[]},{maxAttempts:7},{maxOutputTokensPerCall:3001},{maxOutputTokensTotal:18001},{masking:'wrong'},{softTargets:'fatal'},{stop:'literary_gate'},{sha256:{}},{sha256:{...m.sha256,extra:'bad'}}]){await writeFile(path,JSON.stringify({...m,...patch}));await assert.rejects(loadFreeze(root),hasCode('FREEZE_INVALID'));}
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
 for(const patch of [{runs:[run,run]},{record:{}},{artifact:{...artifact,expired:true}},{io:memoryIO({})},{io:memoryIO({'reservation.json':reservation(env,trial,mapping),'dispatch-01.json':{}})}])await assert.rejects(runTrial({...context(),env:protectedEnv,...patch,fetchImpl:async()=>{calls++;return response();}}));
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
test('truncation remains fatal with exact observed prose retained; soft counts are observations',async()=>{
 const d=envelope();d.choices[0].finish_reason='length';const {result,calls,io}=await execute(async()=>response(d));assert.equal(calls.length,1);assert.equal(result.error,'OUTPUT_TRUNCATED');assert.equal(io.data['raw-prose-01.bin'].toString(),d.choices[0].message.content);
 assert.equal(stats(prose(1),trial.requests[0]).pass,true);assert.equal(stats('弱'.repeat(450)+'\n\n甲\n\n乙\n\n丙',trial.requests[0]).paragraphs,4);
});
test('refusal, tools, malformed envelopes and hidden reasoning are withheld and stop',async()=>{
 const cases=[d=>d.choices[0].message.refusal='refused',d=>d.choices[0].finish_reason='content_filter',d=>d.choices[0].message.tool_calls=[{}],d=>d.choices[0].message.function_call={},d=>d.choices[0].message.role='user',d=>d.choices.push(d.choices[0]),d=>d.choices[0].message.content='',d=>d.choices[0].message.content='<think>PRIVATE_REASONING</think>'+prose(1),d=>d.choices[0].message.reasoning_content='PRIVATE_REASONING',d=>d.reasoning='PRIVATE_REASONING',d=>d.usage.completion_tokens_details.reasoning_tokens=1,d=>d.choices[0].message.content='\ud800'+prose(1)];
 for(const change of cases){const d=envelope();change(d);const {result,calls,io}=await execute(async()=>response(d));assert.equal(calls.length,1);assert.equal(result.status,'stopped');assert.equal(Object.hasOwn(io.data,'completed-01.json'),false);assert.equal(Object.hasOwn(io.data,'raw-prose-01.bin'),false);assert.equal(Object.values(io.data).some(b=>b.toString().includes('PRIVATE_REASONING')),false);}
 for(const data of [null,{},[],{choices:[null]}, {choices:'bad'}])assert.equal((await execute(async()=>response(data))).result.error,'RESPONSE_INVALID');
});
test('provider and GitHub credential echoes including nested encodings are withheld',async()=>{
 for(const secret of [key,gh])for(const text of [secret,Buffer.from(secret).toString('base64'),Buffer.from(secret).toString('base64url'),Buffer.from(secret).toString('hex'),Buffer.from(secret).toString('hex').toUpperCase(),encodeURIComponent(secret),encodeURIComponent(secret).replace(/%[A-F0-9]{2}/g,x=>x.toLowerCase()),encodeURIComponent(encodeURIComponent(secret)),secret.split('').map(c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0')).join('')]){const d=envelope();d.choices[0].message.content+=text;const {result,calls,io}=await execute(async()=>response(d));assert.equal(calls.length,1);assert.equal(result.error,'SECRET_ECHO');assert.equal(Object.hasOwn(io.data,'raw-prose-01.bin'),false);}
 const d=envelope();d.arbitrary={secret:key};assert.equal((await execute(async()=>response(d))).result.error,'SECRET_ECHO');assert.equal(secretEcho(prose(1),[key,gh]),false);
});
test('bounded success/error readers and network errors retain only safe diagnostics',async()=>{
 for(const [size,error]of [[131072,undefined],[131073,'RESPONSE_TOO_LARGE']]){const d=envelope();d.choices[0].message.content='短';const base=JSON.stringify(d);const r=reader({chunks:[base+' '.repeat(size-Buffer.byteLength(base))]});const {result,calls}=await execute(async n=>n===1?r.response:response(envelope(n)));assert.equal(calls.length,error?1:6);assert.equal(result.error,error);assert.equal(result.stages[0].receivedSuccessBytes,size);assert.equal(r.stats().cancels,1);}
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
test('archived PREPARE and EXECUTE preserve original credential-before-upload guards with fake transport only',async t=>{
 const {root,main}=await executedSource(t);let reads=0;const guarded={...env};Object.defineProperty(guarded,'NEXUS_API_KEY',{get(){reads++;return key;}});
 const paths=[];const fake=async url=>{paths.push(url);if(url.includes('/workflows/'))return response({total_count:1,workflow_runs:[run]});if(url.includes('/runs/122'))return response(ci);if(url.includes('/artifacts/456'))return response(artifact);assert.equal(url,ENDPOINT);assert.equal(reads,1);return response({error:{code:'rate_limit_exceeded'}},429);};
 assert.equal((await main('prepare',guarded,{root,fetchImpl:fake})).status,'reserved');assert.equal(reads,0);
 guarded.NEXUS_RESERVATION_SHA256=digest(await readFile(join(root,'artifacts/'+ID+'/reservation.json')));
 await assert.rejects(main('execute',{...env,NEXUS_RESERVATION_UPLOADED:'false'},{root,fetchImpl:fake}),hasCode('PERSISTENCE_FAILED'));
 const out=await main('execute',guarded,{root,fetchImpl:fake});assert.equal(out.attempts,1);assert.equal(out.error,'UPSTREAM_ERROR');assert.equal(reads,1);assert.ok(paths.indexOf('https://api.github.com/repos/logan-suu/NexusScribe/actions/artifacts/456')<paths.indexOf(ENDPOINT));
 await assert.rejects(main('execute',guarded,{root,fetchImpl:fake}),hasCode('PERSISTENCE_FAILED'));assert.equal(reads,1);
});
test('archived workflow isolates secret to execution after durable upload; actions pinned, no matrix or retries',async()=>{
 const yaml=await readFile(new URL('../eval/history/causal-quality-20261007/source-workflow.yml',import.meta.url),'utf8');
 assert.equal((yaml.match(/secrets\./g)||[]).length,1);assert.ok(yaml.indexOf('run-causal-quality-20261007.mjs prepare')<yaml.indexOf('id: reservation'));assert.ok(yaml.indexOf('id: reservation')<yaml.indexOf('secrets.NEXUS_API_KEY'));assert.match(yaml,/steps.reservation.outputs.artifact-id != ''/);assert.match(yaml,/NEXUS_RESERVATION_ARTIFACT_ID:.*steps.reservation.outputs.artifact-id/);assert.match(yaml,/cancel-in-progress: false/);assert.match(yaml,/github.run_attempt == 1/);assert.match(yaml,/persist-credentials: false/);assert.doesNotMatch(yaml,/matrix:|continue-on-error:|retry:|NEXUS_API_KEY:.*inputs/);
 for(const line of yaml.split('\n').filter(l=>l.includes('uses:')))assert.match(line,/@[a-f0-9]{40}(?:\s|$)/);
 const protocol=await readFile(new URL('../eval/CAUSAL-QUALITY-20261007-PROTOCOL.md',import.meta.url),'utf8');assert.match(protocol,/There is no literary acceptability gate/);assert.match(protocol,/full mapping.*reservation/);assert.match(protocol,/soft.*never.*gate/i);
});

test('historical exact 472-Han 11-paragraph output is preserved and proceeds to B and all six',async()=>{
 const bytes=await readFile(new URL('../eval/history/causal-quality-20261006/raw-prose-01.bin',import.meta.url));
 assert.equal(digest(bytes),'75a24e4f346bf57c3775c8d3180074334544ea9f1a5b0773f4beffaf9233dbf3');
 const text=bytes.toString('utf8');assert.deepEqual(stats(text,trial.requests[0]),{han:472,paragraphs:11,pass:false});
 const {result,calls,io}=await execute(async n=>{const d=envelope(n);if(n===1)d.choices[0].message.content=text;return response(d);});
 assert.equal(result.status,'six_calls_retained_awaiting_masked_read');assert.equal(calls.length,6);assert.equal(calls[1][1].body,JSON.stringify(trial.requests[1].body));assert.deepEqual(io.data['raw-prose-01.bin'],bytes);
 assert.equal(result.stages[0].error,undefined);assert.equal(result.stages[0].counts.pass,false);
});

test('every soft miss, wrapper and weak/constraint-breaking story continues at every sequence unchanged',async()=>{
 const samples={short:'短',long:'长'.repeat(2500),oneParagraph:'弱'.repeat(500),elevenParagraphs:Array(11).fill('弱'.repeat(45)).join('\n\n'),wrongLanguage:'The rain fell. It rained again. Nothing changed.',markdown:'```text\n'+prose(1)+'\n```',tilde:'~~~\n'+prose(1)+'\n~~~',json:JSON.stringify({text:prose(1)}),array:JSON.stringify([prose(1)]),weak:'弱'.repeat(500),constraintFailure:'程岚用左耳听清了话，阿陶立刻知道信封里车票的内容。寄信人是管理员。',safeControl:'正文\u0000仍然是字符串',whitespaceAround:'  正文\r\n\t'};
 for(const [name,text] of Object.entries(samples))for(let position=1;position<=6;position++){
  const {result,calls,io}=await execute(async n=>{const d=envelope(n);if(n===position)d.choices[0].message.content=text;return response(d);});
  assert.equal(calls.length,6,name+' at '+position);assert.equal(result.status,'six_calls_retained_awaiting_masked_read');assert.equal(result.error,undefined);assert.equal(io.data[`raw-prose-0${position}.bin`].toString(),text);
  const packet=JSON.parse(io.data['candidate-'+mapping[position-1].candidateId+'.json']);assert.equal(packet.text,text);assert.equal(packet.textSha256,digest(text));
 }
});

test('all fatal transport, envelope, safety, budget and resource classes stop at every sequence',async()=>{
 const modified=fn=>()=>{const d=envelope();fn(d);return response(d);};
 const cases=[
  ['http','UPSTREAM_ERROR',()=>response({error:{code:'rate_limit_exceeded',message:key}},429)],
  ['fetch rejection','UPSTREAM_ERROR',()=>{throw Error(key);}],
  ['stream rejection','UPSTREAM_ERROR',()=>reader({throws:true}).response],
  ['fetch deadline','UPSTREAM_TIMEOUT',()=>new Promise(()=>{})],
  ['success stream deadline','UPSTREAM_TIMEOUT',()=>reader({stalled:true}).response],
  ['error stream deadline','UPSTREAM_TIMEOUT',()=>reader({status:400,stalled:true}).response],
  ['invalid JSON','RESPONSE_INVALID',()=>new Response('{')],
  ['invalid UTF-8','RESPONSE_INVALID',()=>reader({chunks:[Buffer.from([0xff])]}).response],
  ['nonobject envelope','RESPONSE_INVALID',()=>response(null)],
  ['multiple choices','RESPONSE_INVALID',modified(d=>d.choices.push(d.choices[0]))],
  ['wrong role','RESPONSE_INVALID',modified(d=>d.choices[0].message.role='user')],
  ['tools','RESPONSE_INVALID',modified(d=>d.choices[0].message.tool_calls=[{}])],
  ['function call','RESPONSE_INVALID',modified(d=>d.choices[0].message.function_call={})],
  ['nonstring','RESPONSE_INVALID',modified(d=>d.choices[0].message.content={text:'fiction'})],
  ['empty','RESPONSE_INVALID',modified(d=>d.choices[0].message.content='')],
  ['blank','RESPONSE_INVALID',modified(d=>d.choices[0].message.content=' \r\n\t')],
  ['ill-formed Unicode','RESPONSE_INVALID',modified(d=>d.choices[0].message.content='\ud800')],
  ['truncation','OUTPUT_TRUNCATED',modified(d=>d.choices[0].finish_reason='length'),true],
  ['unknown finish','OUTPUT_TRUNCATED',modified(d=>d.choices[0].finish_reason='other'),true],
  ['explicit provider refusal','REFUSAL',modified(d=>d.choices[0].message.refusal='refused')],
  ['explicit text refusal','REFUSAL',modified(d=>d.choices[0].message.content='I cannot help with that request.')],
  ['content filter','REFUSAL',modified(d=>d.choices[0].finish_reason='content_filter')],
  ['reasoning field','HIDDEN_REASONING',modified(d=>d.choices[0].message.reasoning_content='PRIVATE_REASONING')],
  ['reasoning markup','HIDDEN_REASONING',modified(d=>d.choices[0].message.content='<think>PRIVATE_REASONING</think>')],
  ['reasoning tokens','HIDDEN_REASONING',modified(d=>d.usage.completion_tokens_details.reasoning_tokens=1)],
  ['provider secret','SECRET_ECHO',modified(d=>d.choices[0].message.content=key)],
  ['GitHub secret','SECRET_ECHO',modified(d=>d.arbitrary={private:gh})],
  ['encoded credential','SECRET_ECHO',modified(d=>d.choices[0].message.content=encodeURIComponent(encodeURIComponent(key)))],
  ['missing usage','BUDGET_UNCERTAIN',modified(d=>delete d.usage),true],
  ['inconsistent usage','BUDGET_UNCERTAIN',modified(d=>d.usage.total_tokens=1),true],
  ['negative usage','BUDGET_UNCERTAIN',modified(d=>d.usage.prompt_tokens=-1),true],
  ['over-cap usage','BUDGET_UNCERTAIN',modified(d=>{d.usage.completion_tokens=3001;d.usage.total_tokens=3043;}),true],
  ['unsafe integer usage','BUDGET_UNCERTAIN',modified(d=>d.usage.prompt_tokens=Number.MAX_SAFE_INTEGER+1),true],
  ['success-envelope cap','RESPONSE_TOO_LARGE',()=>reader({chunks:[Buffer.alloc(131073,32)]}).response],
  ['UTF-16 cap','RESPONSE_TOO_LARGE',modified(d=>d.choices[0].message.content='x'.repeat(30001))],
 ];
 for(const [name,code,make,keep=false] of cases)for(let position=1;position<=6;position++){
  const {result,calls,io}=await execute(async n=>n===position?make():response(envelope(n)),{timeoutMs:25});
  assert.equal(calls.length,position,name+' at '+position);assert.equal(result.error,code,name+' at '+position);assert.equal(result.status,'stopped');assert.equal(result.attempts,position);assert.equal(result.remainingAttempts,0);
  assert.equal(Object.hasOwn(io.data,`dispatch-0${position+1}.json`),false);assert.equal(Object.hasOwn(io.data,`raw-prose-0${position}.bin`),keep,name);assert.equal(Object.hasOwn(io.data,'candidate-'+mapping[position-1].candidateId+'.json'),false);
  for(let earlier=1;earlier<position;earlier++)assert.ok(io.data[`raw-prose-0${earlier}.bin`]);
  const retained=Object.values(io.data).map(b=>b.toString()).join('\n');for(const secret of [key,gh,'PRIVATE_REASONING'])assert.equal(retained.includes(secret),false);
 }
 assert.equal(explicitRefusal('抱歉，我无法满足这个请求。'),true);assert.equal(explicitRefusal('“I cannot help with that request,” the clerk said.'),false);
});

test('universal limits are inclusive and do not become writing targets',async()=>{
 for(const text of ['x'.repeat(30000),'😀'.repeat(15000)]){
  const {result,calls,io}=await execute(async()=>{const d=envelope();d.choices[0].message.content=text;return response(d);});assert.equal(calls.length,6);assert.equal(result.error,undefined);assert.equal(io.data['raw-prose-01.bin'].toString(),text);
 }
});

test('persistence failure for every per-call evidence class at every sequence stops without retry',async()=>{
 for(let position=1;position<=6;position++)for(const kind of ['dispatch','raw-prose','completed','candidate','response-meta','ledger']){
  const c=context(),write=c.io.write.bind(c.io),name=kind==='candidate'?'candidate-'+mapping[position-1].candidateId+'.json':`${kind}-0${position}.${kind==='raw-prose'?'bin':'json'}`;
  c.io.write=async(n,v)=>{if(n===name)throw Error('PRIVATE_PERSISTENCE_ERROR');return write(n,v);};
  let calls=0;const result=await runTrial({...c,fetchImpl:async()=>response(envelope(++calls))});
  assert.equal(calls,kind==='dispatch'?position-1:position,name);assert.equal(result.error,'PERSISTENCE_FAILED');assert.equal(result.status,'stopped');assert.equal(result.remainingAttempts,0);assert.equal(JSON.stringify(result).includes('PRIVATE_PERSISTENCE_ERROR'),false);
 }
 for(const terminal of ['result.json','index.json']){const c=context(),write=c.io.write.bind(c.io);c.io.write=async(n,v)=>{if(n===terminal)throw Error('PRIVATE_PERSISTENCE_ERROR');return write(n,v);};let calls=0;await assert.rejects(runTrial({...c,fetchImpl:async()=>response(envelope(++calls))}));assert.equal(calls,6);}
});

test('full stored mapping schema, uniqueness, integrity and prepared byte hash reject before key',async()=>{
 const badMaps=[null,[],mapping.slice(1),mapping.map((r,i)=>i===1?{...r,candidateId:mapping[0].candidateId}:r),mapping.map((r,i)=>i===2?{...r,sequence:4}:r),mapping.map((r,i)=>i===0?{...r,candidateId:'F1-A'}:r),mapping.map((r,i)=>i===0?{...r,arm:'A'}:r)];
 for(const bad of badMaps)assert.throws(()=>validateMapping(bad),hasCode('PERSISTENCE_FAILED'));
 for(const mutate of [r=>r.maskedMapping=badMaps[3],r=>r.maskedMapping[0].candidateId='C-'+'a'.repeat(32),r=>r.maskedMappingSha256='a'.repeat(64),r=>delete r.maskedMapping,r=>delete r.maskedMappingSha256]){
  const c=context();mutate(c.record);c.io=memoryIO({'reservation.json':c.record});c.env.NEXUS_RESERVATION_SHA256=digest(c.io.data['reservation.json']);let reads=0,calls=0;
  Object.defineProperty(c.env,'NEXUS_API_KEY',{get(){reads++;return key;}});await assert.rejects(runTrial({...c,fetchImpl:async()=>{calls++;return response();}}),hasCode('PERSISTENCE_FAILED'));assert.equal(reads,0);assert.equal(calls,0);
 }
 const c=context();c.env.NEXUS_RESERVATION_SHA256='a'.repeat(64);let reads=0;Object.defineProperty(c.env,'NEXUS_API_KEY',{get(){reads++;return key;}});await assert.rejects(runTrial({...c,fetchImpl:async()=>response()}),hasCode('PERSISTENCE_FAILED'));assert.equal(reads,0);
});

test('PREPARE alone generates durable random map; execution reuses stored IDs after fresh object load',async t=>{
 const maps=[];
 for(let attempt=0;attempt<2;attempt++){
  const {root,main}=await executedSource(t);let reads=0;const guarded={...env};Object.defineProperty(guarded,'NEXUS_API_KEY',{get(){reads++;throw Error('NO_CREDENTIAL_ACCESS');}});
  const fake=async url=>url.includes('/workflows/')?response({total_count:1,workflow_runs:[run]}):response(ci);
  await main('prepare',guarded,{root,fetchImpl:fake});assert.equal(reads,0);
  const bytes=await readFile(join(root,'artifacts/'+ID+'/reservation.json'));const stored=JSON.parse(bytes);validateMapping(stored.maskedMapping);assert.equal(stored.maskedMappingSha256,digest(stored.maskedMapping));maps.push(stored.maskedMapping);
  await assert.rejects(main('prepare',guarded,{root,fetchImpl:fake}));assert.deepEqual(await readFile(join(root,'artifacts/'+ID+'/reservation.json')),bytes);
 }
 assert.notDeepEqual(maps[0],maps[1]);assert.equal(new Set(maps.flat().map(r=>r.candidateId)).size,12);
 const c=context(),saved=JSON.parse(JSON.stringify(c.record));c.record=saved;c.io=memoryIO({'reservation.json':saved});const before=structuredClone(saved.maskedMapping);let n=0;
 const result=await runTrial({...c,fetchImpl:async()=>response(envelope(++n))});assert.equal(result.attempts,6);assert.deepEqual(saved.maskedMapping,before);
 const packets=Object.entries(c.io.data).filter(([name])=>name.startsWith('candidate-')).map(([,b])=>JSON.parse(b)).sort((a,b)=>a.candidateId.localeCompare(b.candidateId));
 assert.equal(packets.length,6);assert.deepEqual(packets.map(p=>p.candidateId),before.map(r=>r.candidateId));
 for(const [i,p]of packets.entries()){assert.deepEqual(Object.keys(p),['candidateId','storyInput','storyInputSha256','text','textSha256','targets','counts']);assert.deepEqual(p,maskedPacket(trial.requests[i],saved,prose(i+1)));for(const key of ['sequence','arm','fixture','runId','sourceSha','repository','system'])assert.equal(Object.hasOwn(p,key),false);}
});

test('retired main and CLI reject all modes before argument/environment/evidence/network access',async()=>{
 let reads=0;const forbidden=new Proxy({}, {get(){reads++;throw Error('FORBIDDEN_ACCESS');},ownKeys(){reads++;throw Error('FORBIDDEN_ACCESS');}});
 for(const mode of [undefined,'prepare','execute','offline','restart',forbidden])await assert.rejects(main(mode,forbidden,forbidden),hasCode('RETIRED'));
 assert.equal(reads,0);assert.equal(safeCode({code:'RETIRED'}),'RETIRED');
 for(const args of [[],['prepare'],['execute'],['--offline-replay']]){
  const cli=spawnSync(process.execPath,['--import','tsx','scripts/run-causal-quality-20261007.mjs',...args],{cwd:new URL('..',import.meta.url),encoding:'utf8',env:{...process.env,...env,NEXUS_LIVE_ENABLED:'true'}});
  assert.equal(cli.status,1);assert.equal(cli.stdout,'');assert.deepEqual(JSON.parse(cli.stderr),{status:'blocked',code:'RETIRED'});assert.equal(cli.stderr.includes(key),false);
 }
});

test('retired runTrial requires explicit fake replay before reading any operational input',async()=>{
 let reads=0,calls=0;const fake=async()=>{calls++;return response();};
 for(const patch of [{},{fetchImpl:fake},{offlineReplay:false,fetchImpl:fake},{offlineReplay:'true',fetchImpl:fake},{offlineReplay:1,fetchImpl:fake},{offlineReplay:true},{offlineReplay:true,fetchImpl:null},{offlineReplay:true,fetchImpl:globalThis.fetch}]){
  const options={...patch};for(const name of ['env','trial','record','runs','ci','artifact','io','timeoutMs','sleep'])Object.defineProperty(options,name,{get(){reads++;throw Error('FORBIDDEN_ACCESS');}});
  await assert.rejects(runTrial(options),hasCode('RETIRED'));
 }
 await assert.rejects(runTrial(),hasCode('RETIRED'));await assert.rejects(runTrial(null),hasCode('RETIRED'));assert.equal(reads,0);assert.equal(calls,0);
});

test('retired workflow has no credentials, checkout, upload or enabled job',async()=>{
 const yaml=await readFile(new URL('../.github/workflows/causal-quality-20261007-trial.yml',import.meta.url),'utf8');const active=yaml.split('\n').filter(l=>!/^\s*#/.test(l)).join('\n');
 assert.doesNotMatch(active,/secrets\s*\.|NEXUS_API_KEY|GH_TOKEN|run-causal-quality-20261007\.mjs|upload-artifact@|actions\/checkout@/);
 const jobs=active.split(/^jobs:\s*$/m)[1];assert.ok(jobs);const blocks=jobs.split(/^  [a-zA-Z_][\w-]*:\s*$/m).slice(1);assert.ok(blocks.length>0);for(const block of blocks)assert.match(block,/^    if:\s*(?:\$\{\{\s*false\s*\}\}|false)\s*$/m);
 const source=await readFile(new URL('../scripts/run-causal-quality-20261007.mjs',import.meta.url),'utf8');assert.doesNotMatch(source,/prepareMapping|randomBytes|async function get\(|api\.github\.com/);
});

test('39 original evidence files and five exact executed sources stay byte-for-byte hash-linked',async()=>{
 const dir=new URL('../eval/history/causal-quality-20261007/',import.meta.url),read=n=>readFile(new URL(n,dir)),archive=JSON.parse(await read('artifact-index.json'));
 assert.equal(archive.runId,'37557977202');assert.equal(archive.sourceSha,'effcaaaeed9e4dd99e06e8eeffbc1b4cafbdcb85');assert.equal(archive.ciRunId,'37555966642');assert.equal(archive.artifactId,'11454978404');assert.equal(archive.reservationArtifactId,'11454993088');assert.equal(archive.originalEvidenceFiles,39);assert.equal(archive.exactExecutedSourceFiles,5);
 assert.equal(archive.artifactZipSha256,'12a03c32728412135fbe0c11abe77a12888bc7d2d8c8e64638dcca6be320d87a');assert.equal(archive.reservationZipSha256,'b8e3e75bb479febdb3c4e8ab1e63a0fbcd92e58ad627a3ceb12350770848b0cf');
 assert.deepEqual(await archiveFiles(dir),[...Object.keys(archive.sha256),'artifact-index.json'].sort());assert.ok(Object.keys(archive.sha256).length>=44);for(const [n,h]of Object.entries(archive.sha256))assert.equal(digest(await read(n)),h,n);
 const index=JSON.parse(await read('index.json'));assert.equal(Object.keys(index.sha256).length,38);for(const [n,h]of Object.entries(index.sha256))assert.equal(digest(await read(n)),h,n);
 const originalBytes=await read('source-manifest.json'),original=JSON.parse(originalBytes),record=JSON.parse(await read('reservation.json'));
 assert.equal(digest(originalBytes),'bcfdc4f0100655dcc39950ef5f00f545e591a8d4bccc54e107193ca9da204557');assert.equal(original.status,'new_separately_approved_not_dispatched');assert.equal(digest(original),record.manifestSha256);assert.equal(record.manifestSha256,'7226ddbae0c7eddec10971becd36b42ab729ce3da7f9303f0f1d6d200b53261c');
 const sources={'scripts/run-causal-quality-20261007.mjs':'source-runner.mjs','.github/workflows/causal-quality-20261007-trial.yml':'source-workflow.yml','eval/CAUSAL-QUALITY-20261007-PROTOCOL.md':'source-protocol.md','tests/causal-quality-20261007.test.js':'source-tests.js'};
 for(const [path,h]of Object.entries(original.sha256)){const bytes=sources[path]?await read(sources[path]):await readHistoricalSource(path,h);assert.equal(digest(bytes),h,path);}
 const source=(await read('source-runner.mjs')).toString();assert.match(source,/export async function main\(mode=/);assert.doesNotMatch(source,/offlineReplay|fail\('RETIRED'\)/);
});

test('durably recovered original mapping binds all six untouched packets, counts and terminal usage',async()=>{
 const dir=new URL('../eval/history/causal-quality-20261007/',import.meta.url),read=n=>readFile(new URL(n,dir));
 const record=JSON.parse(await read('reservation.json')),result=JSON.parse(await read('result.json')),archive=JSON.parse(await read('artifact-index.json'));
 assert.equal(digest(await read('reservation.json')),'941350cdb703ba0e73da108c2d1c46e841720c0d8cd9a84d87b01c48b230bf07');validateMapping(record.maskedMapping);assert.equal(digest(record.maskedMapping),record.maskedMappingSha256);assert.equal(record.maskedMappingSha256,'378805940e08d7a5c3746f75333c0c6b17b846632622cf0cc37e940f69e8698b');assert.equal(result.maskedMappingSha256,record.maskedMappingSha256);
 assert.equal(archive.maskedReading.fullCandidateMappingAvailable,true);assert.equal(archive.maskedReading.fullCandidateMappingReverified,true);
 assert.equal(result.status,'six_calls_retained_awaiting_masked_read');assert.equal(result.attempts,6);assert.equal(result.remainingAttempts,0);assert.equal(result.requestedOutputTokens,18000);assert.equal(result.cost,'unknown');assert.equal(result.error,undefined);assert.deepEqual(result.usage,{promptTokens:12283,completionTokens:3427,totalTokens:15710,reasoningTokens:0});assert.equal(result.stages.filter(s=>!s.counts.pass).length,5);
 const observedCounts=[[644,13,false],[535,4,true],[665,13,false],[610,13,false],[529,13,false],[750,13,false]];
 for(let i=0;i<6;i++){
  const n=String(i+1).padStart(2,'0'),text=(await read('raw-prose-'+n+'.bin')).toString(),completed=JSON.parse(await read('completed-'+n+'.json')),packet=JSON.parse(await read('candidate-'+record.maskedMapping[i].candidateId+'.json')),stage=result.stages[i],dispatch=JSON.parse(await read('dispatch-'+n+'.json')),ledger=JSON.parse(await read('ledger-'+n+'.json'));
  assert.equal(completed.text,text);assert.equal(completed.textSha256,digest(text));assert.deepEqual(packet,maskedPacket(trial.requests[i],record,text));assert.equal(stage.textSha256,digest(text));assert.equal(stage.httpStatus,200);assert.equal(stage.finishReason,'stop');assert.equal(stage.status,'retained_for_masked_read');assert.equal(stage.error,undefined);assert.deepEqual(Object.values(stats(text,trial.requests[i])),observedCounts[i]);assert.deepEqual(stage.counts,completed.counts);assert.equal(dispatch.requestSha256,BODY_SHAS[i]);assert.equal(dispatch.sequence,i+1);assert.equal(dispatch.attemptedOrUncertain,true);assert.equal(ledger.attempts,i+1);assert.equal(ledger.remainingAttempts,0);
 }
 const current=JSON.parse(await readFile(new URL('../eval/causal-quality-20261007-manifest.json',import.meta.url)));assert.equal(current.status,'retired_consumed_offline_replay');assert.equal(current.remainingAttempts,0);assert.equal(current.attemptsObserved,6);
});

test('six locked individual reports retain exact durable bytes and all 222 decoded-source/output spans',async()=>{
 const dir=new URL('../eval/history/causal-quality-20261007/',import.meta.url),read=n=>readFile(new URL(n,dir));
 const lockBytes=await read('reading/individual/individual-lock-manifest.json'),lock=JSON.parse(lockBytes),durable=JSON.parse(await read('reading/individual-durable-locks.json'));
 assert.equal(lock.locked,true);assert.equal(lock.fullCandidateRead,true);assert.equal(lock.evaluationStage,'all_six_individuals_locked_before_any_pairwise_packet');assert.equal(lock.reports.length,6);assert.equal(lock.sourceAndTextHashesVerified,true);assert.equal(lock.utf16QuoteSpansVerified,222);
 assert.equal(lock.evaluatorIsolation.readOnlyNeutralCandidatePacketsAndOwnReports,true);for(const [k,v]of Object.entries(lock.evaluatorIsolation))if(k!=='readOnlyNeutralCandidatePacketsAndOwnReports')assert.equal(v,false,k);
 const blob=b=>createHash('sha1').update(Buffer.from('blob '+b.length+'\0')).update(b).digest('hex');
 assert.equal(blob(lockBytes),durable['individual-lock-manifest.json'].gitBlob);
 let spans=0;
 for(const report of lock.reports){
  const bytes=await read('reading/individual/'+report.candidateId+'.json'),judgment=JSON.parse(bytes),packet=JSON.parse(await read('candidate-'+report.candidateId+'.json'));
  assert.equal(digest(bytes),report.reportSha256);assert.equal(blob(bytes),durable[report.candidateId+'.json'].gitBlob);if(durable[report.candidateId+'.json'].sha256)assert.equal(digest(bytes),durable[report.candidateId+'.json'].sha256);
  assert.equal(report.locked,true);assert.equal(report.fullCandidateRead,true);assert.equal(judgment.evaluationStage,'individual_locked_before_pairwise');assert.equal(judgment.candidateId,packet.candidateId);assert.equal(judgment.storyInputSha256,digest(packet.storyInput));assert.equal(judgment.textSha256,digest(packet.text));assert.equal(report.storyInputSha256,judgment.storyInputSha256);assert.equal(report.textSha256,judgment.textSha256);assert.equal(judgment.proseEvaluable,true);
  const source=JSON.parse(packet.storyInput);
  const visit=v=>{if(!v||typeof v!=='object')return;if(typeof v.quote==='string'&&Number.isInteger(v.startUtf16)&&Number.isInteger(v.endUtf16)){
   let coordinate;if(v.kind==='output'){assert.equal(v.path,'/text');coordinate=packet.text;}else{assert.equal(v.kind,'source');assert.ok(v.path.startsWith('/storyInput(decoded)/'));coordinate=source;for(const part of v.path.slice('/storyInput(decoded)/'.length).split('/')){const key=part.replace(/~1/g,'/').replace(/~0/g,'~');assert.equal(Object.hasOwn(coordinate,key),true);coordinate=coordinate[key];}}
   assert.equal(typeof coordinate,'string');assert.ok(v.startUtf16>=0&&v.endUtf16>=v.startUtf16&&v.endUtf16<=coordinate.length);assert.equal(coordinate.slice(v.startUtf16,v.endUtf16),v.quote,judgment.candidateId+' '+v.path);spans++;
  }for(const child of Object.values(v))visit(child);};visit(judgment);
 }
 assert.equal(spans,222);assert.equal(lock.nonSubstantiveErrata.length,1);assert.equal(lock.nonSubstantiveErrata[0].candidateId,'C-cd731f5e836adb51f8a072cc0d8b92af');
 const original=JSON.parse(await read('reading/individual/C-cd731f5e836adb51f8a072cc0d8b92af.json'));assert.ok(original.dimensions.motivation_obligation.explanation.includes(lock.nonSubstantiveErrata[0].quotedOriginal));
});

test('three locked pairs preserve nine individual/pair judgments, neutral packets and all 306 spans',async()=>{
 const dir=new URL('../eval/history/causal-quality-20261007/',import.meta.url),read=n=>readFile(new URL(n,dir)),lockBytes=await read('reading/pair/pair-lock-manifest.json'),lock=JSON.parse(lockBytes),durable=JSON.parse(await read('reading/pair-durable-locks.json'));
 const blob=b=>createHash('sha1').update(Buffer.from('blob '+b.length+'\0')).update(b).digest('hex');
 assert.equal(digest(lockBytes),'1fe2e4bbbf9a7abededa657708dd07ee9e7771af913c57cd287415630d30fc97');assert.equal(blob(lockBytes),durable['pair-lock-manifest.json'].gitBlob);assert.equal(lock.locked,true);assert.equal(lock.fullPairRead,true);assert.equal(lock.individualReportBytesUnchanged,true);assert.equal(lock.evaluationStage,'all_three_pairwise_reports_locked_before_unmask');assert.equal(lock.individualLockManifestSha256,digest(await read('reading/individual/individual-lock-manifest.json')));assert.equal(lock.utf16QuoteSpansVerified,84);assert.equal(lock.pairs.length,3);
 assert.equal(lock.isolation.readOnlySuppliedPairPacketsAndOwnIndividualReportsDuringPairStage,true);assert.equal(lock.isolation.allIndividualReportsLockedBeforePairPackets,true);for(const k of ['armIdentitiesKnown','armIdentitySoughtOrInferred','consultedOtherEvaluators','usedPaidApiOrModelJudge','delegatedEvaluation'])assert.equal(lock.isolation[k],false);
 let spans=0;
 for(const record of lock.pairs){
  const bytes=await read('reading/pair/'+record.pairId+'.json'),j=JSON.parse(bytes),packet=JSON.parse(await read('reading/pair-packets/'+record.pairId+'.json'));
  assert.equal(digest(bytes),record.reportSha256);assert.equal(blob(bytes),durable[record.pairId+'.json'].gitBlob);assert.equal(j.locked,true);assert.equal(j.fullPairRead,true);assert.equal(j.individualJudgmentsPreserved,true);assert.equal(j.armIdentitiesKnown,false);assert.equal(j.softComplianceNotUsedAsProseVerdict.bothProseEvaluable,true);assert.equal(j.softComplianceNotUsedAsProseVerdict.technicalFailureEstablished,false);assert.deepEqual(j.softComplianceNotUsedAsProseVerdict.first,packet.first.counts);assert.deepEqual(j.softComplianceNotUsedAsProseVerdict.second,packet.second.counts);assert.equal(j.pairId,packet.pairId);assert.equal(j.storyInputSha256,digest(packet.storyInput));assert.equal(j.storyInputSha256,record.storyInputSha256);assert.ok(packet.first.candidateId<packet.second.candidateId);
  for(const side of ['first','second']){assert.deepEqual(packet[side],JSON.parse(await read('candidate-'+packet[side].candidateId+'.json')));assert.deepEqual(j[side],record[side]);assert.equal(j[side].candidateId,packet[side].candidateId);assert.equal(j[side].textSha256,digest(packet[side].text));assert.equal(packet[side].storyInput,packet.storyInput);}
  for(const field of ['overallPreference','causalImprovement','materialVoiceAgencyRegression','checklistPadding'])assert.equal(j[field],record[field]);
  const source=JSON.parse(packet.storyInput),visit=v=>{if(!v||typeof v!=='object')return;if(typeof v.quote==='string'&&Number.isInteger(v.startUtf16)&&Number.isInteger(v.endUtf16)){
   let coordinate;if(['first','second'].includes(v.side)){assert.equal(v.path,'/'+v.side+'/text');coordinate=packet[v.side].text;}else{assert.equal(v.side,'source');assert.ok(v.path.startsWith('/storyInput(decoded)/'));coordinate=source;for(const part of v.path.slice('/storyInput(decoded)/'.length).split('/')){const key=part.replace(/~1/g,'/').replace(/~0/g,'~');assert.equal(Object.hasOwn(coordinate,key),true);coordinate=coordinate[key];}}
   assert.equal(typeof coordinate,'string');assert.ok(v.startUtf16>=0&&v.endUtf16>=v.startUtf16&&v.endUtf16<=coordinate.length);assert.equal(coordinate.slice(v.startUtf16,v.endUtf16),v.quote,j.pairId+' '+v.path);spans++;
  }for(const child of Object.values(v))visit(child);};visit(j);
 }
 assert.equal(spans,84);assert.equal(spans+JSON.parse(await read('reading/individual/individual-lock-manifest.json')).utf16QuoteSpansVerified,306);
});

test('post-lock decoded outcome derives arms from durable mapping and fails adoption on literature, not counts',async()=>{
 const dir=new URL('../eval/history/causal-quality-20261007/',import.meta.url),read=n=>readFile(new URL(n,dir)),decoded=JSON.parse(await read('decoded-outcome.json')),reservation=JSON.parse(await read('reservation.json'));
 assert.equal(decoded.decodedAfterAllIndividualAndPairwiseRecordsLocked,true);assert.equal(decoded.bindings.reservationFileSha256,digest(await read('reservation.json')));assert.equal(decoded.bindings.maskedMappingSha256,digest(reservation.maskedMapping));assert.equal(decoded.bindings.individualLockManifestSha256,digest(await read('reading/individual/individual-lock-manifest.json')));assert.equal(decoded.bindings.pairLockManifestSha256,digest(await read('reading/pair/pair-lock-manifest.json')));assert.equal(decoded.bindings.executedProtocolFileSha256,digest(await read('source-protocol.md')));
 const byId=new Map(reservation.maskedMapping.map(r=>[r.candidateId,trial.requests[r.sequence-1]]));
 for(const pair of decoded.pairs){
  const bytes=await read('reading/pair/'+pair.pairId+'.json'),j=JSON.parse(bytes);assert.equal(pair.reportSha256,digest(bytes));assert.equal(pair.packetSha256,digest(await read('reading/pair-packets/'+pair.pairId+'.json')));
  for(const side of ['first','second']){const request=byId.get(j[side].candidateId);assert.equal(pair[side].arm,request.arm);assert.equal(pair[side].sequence,request.sequence);assert.equal(pair.fixture,request.fixture);assert.equal(pair[side].textSha256,j[side].textSha256);}
  for(const name of ['overallPreference','causalImprovement','materialVoiceAgencyRegression','checklistPadding'])assert.equal(pair[name+'Arm'],['first','second'].includes(j[name])?byId.get(j[j[name]].candidateId).arm:j[name]);
 }
 assert.deepEqual(decoded.pairs.map(p=>[p.pairId,p.fixture,p.overallPreferenceArm,p.causalImprovementArm]),[['P1','F1-replay','B','neither'],['P2','F3-unused-domain-transfer','A','A'],['P3','F2-physical-transition','neither','neither']]);
 const dimensions=['new_scene_change','physical_prerequisites_custody','temporal_causal_sequence','motivation_obligation','knowledge_pov_attribution','voice_economy_agency'];
 assert.equal(decoded.bIndividualLiteraryAssessment.length,3);for(const b of decoded.bIndividualLiteraryAssessment){assert.equal(byId.get(b.candidateId).arm,'B');const j=JSON.parse(await read('reading/individual/'+b.candidateId+'.json'));assert.deepEqual(Object.keys(b.literaryDimensionLabels),dimensions);for(const k of dimensions)assert.equal(b.literaryDimensionLabels[k],j.dimensions[k].label);assert.equal(b.allRequiredLiteraryDimensionsAcceptable,dimensions.every(k=>j.dimensions[k].label==='acceptable'));}
 assert.equal(decoded.adoptionCriterion.decision,'not_met');assert.equal(decoded.adoptionCriterion.threeCompletePairsAvailable,true);assert.equal(decoded.adoptionCriterion.requiredSubstantiveBPairGains,2);assert.equal(decoded.adoptionCriterion.observedSubstantiveBPairGains,decoded.pairs.filter(p=>p.causalImprovementArm==='B').length);assert.equal(decoded.adoptionCriterion.observedSubstantiveBPairGains,0);assert.equal(decoded.adoptionCriterion.allThreeBAcceptableOnRequiredLiteraryDimensions,false);assert.equal(decoded.adoptionCriterion.softTargetsExcludedFromDecision,true);assert.equal(decoded.readingVerification.totalQuoteSpans,306);
 const f3b=decoded.bIndividualLiteraryAssessment.find(b=>b.fixture==='F3-unused-domain-transfer');assert.equal(f3b.literaryDimensionLabels.motivation_obligation,'clear_failure');
 const p2=JSON.parse(await read('reading/pair-packets/P2.json'));assert.ok(p2.second.text.includes('明天我可能不来'));assert.ok(p2.first.text.includes('明天几点'));assert.ok(p2.first.text.includes('四点以后都在'));
});
