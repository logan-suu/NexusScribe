// Strictly offline: every transport is injected, and every credential is public fake data.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,mkdir,writeFile,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {ID,WORKFLOW,ENDPOINT,BODY_SHA,FREEZE_SHA,PATHS,digest,bodyFrom,gates,loadFreeze,diskIO,reservation,validateReservation,runOne,safeCode} from '../scripts/run-compatibility-probe.mjs';

const key='PUBLIC_FAKE_PROBE_KEY!+/=not-a-secret';
const sha='f'.repeat(40);
const env={NEXUS_COMPATIBILITY_APPROVED:ID,NEXUS_OVERAGE_CONFIRMED_OFF:'true',GITHUB_ACTIONS:'true',GITHUB_RUN_ATTEMPT:'1',GITHUB_REPOSITORY:'logan-suu/NexusScribe',GITHUB_REF:'refs/heads/dev_v1.0',GITHUB_RUN_ID:'123',NEXUS_CI_RUN_ID:'122',GITHUB_SHA:sha,NEXUS_SOURCE_SHA:sha,NEXUS_API_KEY:key};
const ci={id:122,path:'.github/workflows/ci.yml',head_sha:sha,status:'completed',conclusion:'success'};
const run={id:123,head_sha:sha,run_attempt:1,event:'workflow_dispatch',path:'.github/workflows/'+WORKFLOW,display_title:ID,status:'in_progress'};
const frozen=await readFile(new URL('../eval/causal-continuity-requests.json',import.meta.url));
const trial={body:bodyFrom(frozen),manifest:{protocol:ID,maxAttempts:1,sha256:{}}};
const prose='OFFLINE_PROSE_MUST_NOT_BE_RETAINED_灯塔';
const envelope=()=>({id:'PRIVATE_RESPONSE_ID',model:'PRIVATE_MODEL',choices:[{finish_reason:'stop',message:{role:'assistant',content:prose}}],usage:{prompt_tokens:42,completion_tokens:9,total_tokens:51,completion_tokens_details:{reasoning_tokens:0}}});
const response=(data=envelope(),status=200)=>new Response(JSON.stringify(data),{status,headers:{'x-private-response-id':'PRIVATE_HEADER'}});
function memoryIO(){const files={};return {filesData:files,async write(name,value){assert.equal(Object.hasOwn(files,name),false);files[name]=Buffer.from(JSON.stringify(value));},async files(){return {...files};}};}
async function execute(fetchImpl=async()=>response(),options={}){
 const io=memoryIO(),calls=[];
 const result=await runOne({env,trial,record:reservation(env,trial),io,timeoutMs:1000,...options,fetchImpl:async(...args)=>{calls.push(args);return fetchImpl(...args);}});
 assert.equal(calls.length,1,'a reserved execution makes exactly one attempt, without retry');
 assert.equal(result.attempts,1);assert.equal(result.remainingAttempts,0);
 assert.deepEqual(Object.keys(io.filesData).sort(),['dispatch.json','index.json','result.json']);
 assert.equal(JSON.parse(io.filesData['index.json']).sha256['result.json'],digest(io.filesData['result.json']));
 assert.deepEqual(JSON.parse(io.filesData['result.json']),result);
 return {result,io,calls};
}
const hasCode=code=>error=>error.code===code&&error.message===code;
function readerResponse({chunks=[],status=200,stalled=false,throws=false,cancelStalls=false}={}){
 let reads=0,cancels=0;
 return {response:{ok:status>=200&&status<300,status,body:{getReader(){return {read(){reads++;if(throws)return Promise.reject(Error(key));if(chunks.length)return Promise.resolve({done:false,value:Buffer.from(chunks.shift())});return stalled?new Promise(()=>{}):Promise.resolve({done:true});},cancel(){cancels++;return cancelStalls?new Promise(()=>{}):Promise.resolve();}};}},text(){throw Error('unbounded text() must never be used');}},stats:()=>({reads,cancels})};
}

test('frozen F1 baseline A body and bytes are exact; mutations fail closed',()=>{
 assert.equal(digest(frozen),FREEZE_SHA);assert.equal(digest(trial.body),BODY_SHA);
 assert.equal(BODY_SHA,'2b598fa0db1271b0024150b80afab36bf2bb86ae7573dedb5bbe3bb9c664241c');
 const first=JSON.parse(frozen).requests[0];assert.equal(first.sequence,1);assert.equal(first.fixture,'F1-replay');assert.equal(first.arm,'A');
 assert.equal(trial.body,JSON.stringify(first.body));
 const body=JSON.parse(trial.body);assert.equal(body.model,'deepseek-v4.1-flash');assert.equal(body.max_tokens,3000);assert.equal(body.temperature,0.7);assert.deepEqual(body.thinking,{type:'disabled'});assert.equal(body.messages.length,2);
 for(const field of ['seed','reasoning_effort','stream'])assert.equal(Object.hasOwn(body,field),false);
 for(const bytes of [Buffer.concat([frozen,Buffer.from(' ')]),Buffer.from('{}'),Buffer.from('{'),Buffer.from(frozen.toString().replace('F1-replay','F2-replay'))])assert.throws(()=>bodyFrom(bytes),hasCode('FREEZE_INVALID'));
});

test('approval, balance, source, repository, branch, run identity and rerun gates',()=>{
 assert.equal(gates(env,[run],ci),true);
 for(const patch of [{NEXUS_COMPATIBILITY_APPROVED:''},{NEXUS_COMPATIBILITY_APPROVED:'old-protocol'},{NEXUS_OVERAGE_CONFIRMED_OFF:'false'},{NEXUS_OVERAGE_CONFIRMED_OFF:'TRUE'}])assert.throws(()=>gates({...env,...patch},[run],ci),hasCode('APPROVAL_REQUIRED'));
 for(const patch of [{GITHUB_ACTIONS:'false'},{GITHUB_RUN_ATTEMPT:'2'},{GITHUB_RUN_ATTEMPT:''},{GITHUB_REPOSITORY:'other/repository'},{GITHUB_REF:'refs/heads/main'},{GITHUB_REF:'refs/tags/dev_v1.0'},{GITHUB_RUN_ID:'abc'},{GITHUB_RUN_ID:''},{NEXUS_CI_RUN_ID:'abc'},{GITHUB_SHA:'short'}])assert.throws(()=>gates({...env,...patch},[run],ci),hasCode('CONFIG_INVALID'));
 assert.throws(()=>gates({...env,NEXUS_SOURCE_SHA:'a'.repeat(40)},[run],ci),hasCode('SOURCE_MISMATCH'));
 for(const runs of [null,{},[],[run,run]])assert.throws(()=>gates(env,runs,ci),hasCode('STAGE_CONSUMED'));
 for(const patch of [{id:124},{head_sha:'a'.repeat(40)},{run_attempt:2},{run_attempt:'1'},{event:'push'},{path:'.github/workflows/other.yml'},{display_title:'old-stage'},{status:'completed'}])assert.throws(()=>gates(env,[{...run,...patch}],ci),hasCode('HISTORY_INVALID'));
 for(const status of ['queued','waiting','pending','in_progress'])assert.equal(gates(env,[{...run,status}],ci),true);
});

test('only successful completed exact-source CI is accepted',()=>{
 for(const patch of [{id:123},{path:'.github/workflows/other.yml'},{head_sha:'a'.repeat(40)},{status:'in_progress'},{conclusion:'failure'},{conclusion:'skipped'},{conclusion:null}])assert.throws(()=>gates(env,[run],{...ci,...patch}),hasCode('CI_REQUIRED'));
 assert.throws(()=>gates(env,[run],undefined),hasCode('CI_REQUIRED'));
});

test('reservation binds source, body, manifest, limits and a fully consumed single attempt',async()=>{
 const record=reservation(env,trial);assert.equal(validateReservation(record,env,trial),undefined);
 assert.equal(record.attemptsReserved,1);assert.equal(record.remainingAttempts,0);assert.equal(record.attemptedOrUncertain,true);assert.equal(record.bodySha256,BODY_SHA);assert.equal(record.manifestSha256,digest(trial.manifest));assert.equal(record.endpoint,ENDPOINT);assert.equal(record.deadlineMs,120000);assert.equal(record.successEnvelopeLimitBytes,131072);assert.equal(record.errorEnvelopeLimitBytes,16384);assert.equal(record.maxOutputTokens,3000);
 for(const field of Object.keys(record)){const changed={...record,[field]:null};assert.throws(()=>validateReservation(changed,env,trial),hasCode('PERSISTENCE_FAILED'));}
 for(const changed of [{...record,extra:true},{},null])assert.throws(()=>validateReservation(changed,env,trial),hasCode('PERSISTENCE_FAILED'));
 assert.throws(()=>validateReservation(record,env,{...trial,body:trial.body+' '}),hasCode('PERSISTENCE_FAILED'));
 let calls=0;await assert.rejects(runOne({env,trial,record:{...record,remainingAttempts:1},io:memoryIO(),fetchImpl:async()=>{calls++;return response();}}),hasCode('PERSISTENCE_FAILED'));assert.equal(calls,0);
});

test('freeze manifest rejects missing, extra, mutated files and protocol limits',async t=>{
 const root=await mkdtemp(join(tmpdir(),'nexus-probe-freeze-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const manifest={protocol:ID,maxAttempts:1,sha256:{}};
 for(const path of PATHS){const bytes=path==='eval/causal-continuity-requests.json'?frozen:Buffer.from('offline fixture '+path);await mkdir(dirname(join(root,path)),{recursive:true});await writeFile(join(root,path),bytes);manifest.sha256[path]=digest(bytes);}
 const save=value=>writeFile(join(root,'eval/compatibility-probe-manifest.json'),JSON.stringify(value));await save(manifest);
 assert.equal((await loadFreeze(root)).body,trial.body);
 for(const patch of [{protocol:'old-protocol'},{maxAttempts:2},{sha256:{...manifest.sha256,extra:'bad'}},{sha256:{}}]){await save({...manifest,...patch});await assert.rejects(loadFreeze(root),hasCode('FREEZE_INVALID'));}
 await save(manifest);await writeFile(join(root,PATHS[0]),'tampered');await assert.rejects(loadFreeze(root),hasCode('FREEZE_INVALID'));
});

test('durable evidence uses exclusive files and restricted modes',async t=>{
 const root=await mkdtemp(join(tmpdir(),'nexus-probe-evidence-'));t.after(()=>rm(root,{recursive:true,force:true}));const io=await diskIO(root);
 await io.write('reservation.json',reservation(env,trial));assert.equal((await stat(join(root,'reservation.json'))).mode&0o777,0o600);
 await assert.rejects(io.write('reservation.json',{}),{code:'EEXIST'});
 await assert.rejects(io.write('../escape.json',{}),hasCode('PERSISTENCE_FAILED'));
 assert.deepEqual(Object.keys(await io.files()),['reservation.json']);
});

test('one fake transport preserves exact body and four headers; success retains metadata only',async()=>{
 const {result,io,calls}=await execute();const [url,options]=calls[0];assert.equal(url,ENDPOINT);assert.equal(options.method,'POST');assert.equal(options.redirect,'error');assert.equal(options.body,trial.body);assert.equal(digest(options.body),BODY_SHA);
 assert.deepEqual(Object.keys(options.headers).sort(),['Authorization','Content-Type','User-Agent','x-opencode-session']);assert.equal(options.headers.Authorization,`Bearer ${key}`);assert.equal(options.headers['Content-Type'],'application/json');assert.equal(options.headers['User-Agent'],'NexusScribe-demo/0.1');assert.match(options.headers['x-opencode-session'],/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i);assert.equal(options.signal.aborted,true);
 assert.equal(result.status,'compatible_response');assert.equal(result.contentSha256,digest(prose));assert.equal(result.contentCharacters,prose.length);assert.equal(result.finishReason,'stop');assert.equal(result.cost,'unknown');assert.deepEqual(result.usage,{promptTokens:42,completionTokens:9,totalTokens:51,reasoningTokens:0});assert.deepEqual(result.missingUsageFields,[]);assert.ok(result.elapsedMs>=0);assert.equal(result.receivedSuccessBytes,Buffer.byteLength(JSON.stringify(envelope())));
 const retained=Object.values(io.filesData).map(bytes=>bytes.toString()).join('\n');for(const value of [key,prose,'PRIVATE_RESPONSE_ID','PRIVATE_HEADER','PRIVATE_MODEL',options.headers['x-opencode-session'],'Bearer '])assert.equal(retained.includes(value),false);
 const second=await execute();assert.notEqual(second.calls[0][1].headers['x-opencode-session'],options.headers['x-opencode-session']);
});

test('missing or invalid usage stays unknown and arbitrary numeric/provider fields are discarded',async()=>{
 const data=envelope();data.usage={prompt_tokens:-1,completion_tokens:'9',total_tokens:Infinity,completion_tokens_details:{reasoning_tokens:0.5},cost:123,secret:key};
 // The key is intentionally removed: successful numeric-field filtering is separate from echo rejection.
 delete data.usage.secret;
 const {result}=await execute(async()=>response(data));assert.equal(result.status,'compatible_response');assert.deepEqual(result.usage,{});assert.equal(result.cost,'unknown');assert.deepEqual(result.missingUsageFields,['promptTokens','completionTokens','totalTokens','reasoningTokens']);
});

test('invalid credentials stop before transport or persistence',async()=>{
 for(const invalid of [undefined,'',' ','bad\r\nheader','x'.repeat(4097)]){let calls=0;const io=memoryIO();await assert.rejects(runOne({env:{...env,NEXUS_API_KEY:invalid},trial,record:reservation(env,trial),io,fetchImpl:async()=>{calls++;return response();}}),hasCode('NOT_CONFIGURED'));assert.equal(calls,0);assert.deepEqual(io.filesData,{});}
});

test('HTTP errors retain bounded enums without free text, headers, prose or credentials',async()=>{
 for(const [status,code,category] of [[400,'unsupported_parameter','unsupported_parameter'],[401,'invalid_api_key','authentication'],[402,'insufficient_quota','quota'],[429,'rate_limit_exceeded','rate_limit'],[503,'server_error','upstream_unavailable']]){
  const {result,io}=await execute(async()=>response({error:{code,message:key+' PRIVATE_ERROR',param:'PRIVATE_PARAM',request_id:'PRIVATE_ID'},choices:envelope().choices},status));assert.equal(result.error,'UPSTREAM_ERROR');assert.equal(result.status,'stopped');assert.equal(result.transportDiagnostics.providerCategory,category);assert.equal(result.transportDiagnostics.bodyState,'json');assert.deepEqual(Object.keys(result.transportDiagnostics).sort(),['bodyState','httpCategory','httpStatus','providerCategory']);assert.deepEqual(result.usage,{});for(const value of [key,'PRIVATE_ERROR','PRIVATE_PARAM','PRIVATE_ID',prose])assert.equal(Object.values(io.filesData).map(bytes=>bytes.toString()).join('\n').includes(value),false);
 }
 for(const data of [{error:{code:'unrecognized',message:'unsupported_parameter'}},{error:{code:'invalid_api_key',type:'permission_error'}},{error:'unsupported_parameter'}]){const {result}=await execute(async()=>response(data,400));assert.equal(result.transportDiagnostics.providerCategory,'unknown');}
 const {result}=await execute(async()=>{throw Error(key);});assert.equal(result.error,'UPSTREAM_ERROR');assert.equal(JSON.stringify(result).includes(key),false);
 assert.equal(safeCode({code:key,message:key}),'PERSISTENCE_FAILED');
});

test('16 KiB error boundary is exact and no unbounded text fallback exists',async()=>{
 const base=JSON.stringify({error:{code:'unsupported_parameter'}});
 for(const [size,state] of [[16384,'json'],[16385,'too_large']]){const fake=readerResponse({status:400,chunks:[base+' '.repeat(size-Buffer.byteLength(base))]});const {result}=await execute(async()=>fake.response);assert.equal(result.error,'UPSTREAM_ERROR');assert.equal(result.transportDiagnostics.bodyState,state);assert.equal(fake.stats().cancels,1);}
 const malformed=readerResponse({status:400,chunks:['NOT_JSON '+key]});assert.equal((await execute(async()=>malformed.response)).result.transportDiagnostics.bodyState,'invalid_json');
 const noBody={ok:false,status:400,body:null,text(){throw Error('must not call');}};assert.equal((await execute(async()=>noBody)).result.transportDiagnostics.bodyState,'unavailable');
 const rejected=readerResponse({status:500,throws:true});assert.equal((await execute(async()=>rejected.response)).result.transportDiagnostics.bodyState,'unavailable');
});

test('128 KiB success boundary caps accumulated bytes, including oversized chunks',async()=>{
 const base=JSON.stringify(envelope());
 for(const [size,error] of [[131072,undefined],[131073,'RESPONSE_TOO_LARGE']]){const fake=readerResponse({chunks:[base+' '.repeat(size-Buffer.byteLength(base))]});const {result}=await execute(async()=>fake.response);assert.equal(result.error,error);assert.equal(result.receivedSuccessBytes,size);assert.equal(fake.stats().cancels,1);}
 const fake=readerResponse({chunks:[Buffer.alloc(65536,32),Buffer.alloc(65537,32)]});assert.equal((await execute(async()=>fake.response)).result.error,'RESPONSE_TOO_LARGE');assert.equal(fake.stats().reads,2);
});

test('total deadline bounds fetch, success body and error body stalls and ignores late transport resolution',{timeout:2000},async()=>{
 let late;const pending=new Promise(resolve=>{late=resolve;});const first=await execute(()=>pending,{timeoutMs:15});assert.equal(first.result.error,'UPSTREAM_TIMEOUT');const serialized=JSON.stringify(first.io.filesData);late(response());await new Promise(resolve=>setTimeout(resolve,20));assert.equal(JSON.stringify(first.io.filesData),serialized);
 for(const status of [200,400]){const fake=readerResponse({status,stalled:true,cancelStalls:true});const started=Date.now();const {result}=await execute(async()=>fake.response,{timeoutMs:15});assert.equal(result.error,'UPSTREAM_TIMEOUT');assert.equal(result.status,'stopped');assert.ok(Date.now()-started<500);assert.equal(fake.stats().cancels,1);assert.equal(Object.hasOwn(result,'transportDiagnostics'),false);}
});

test('malformed envelopes and messages consistently stop as RESPONSE_INVALID',async()=>{
 for(const data of [null,[],{},'text',{error:{}},{choices:null},{choices:[]},{choices:[null]},{choices:[{}]},{choices:[{message:null}]},{choices:[{message:[]}]}]){const {result}=await execute(async()=>response(data));assert.equal(result.error,'RESPONSE_INVALID',JSON.stringify(data));}
 for(const patch of [{role:'user'},{content:undefined},{content:''},{content:'  '},{content:[]},{function_call:{}},{tool_calls:{}},{tool_calls:[{}]}]){const data=envelope();Object.assign(data.choices[0].message,patch);assert.equal((await execute(async()=>response(data))).result.error,'RESPONSE_INVALID');}
 const multiple=envelope();multiple.choices.push(multiple.choices[0]);assert.equal((await execute(async()=>response(multiple))).result.error,'RESPONSE_INVALID');
 const over=envelope();over.usage.completion_tokens=3001;assert.equal((await execute(async()=>response(over))).result.error,'RESPONSE_INVALID');
 const invalid=readerResponse({chunks:['{not json']});assert.equal((await execute(async()=>invalid.response)).result.error,'RESPONSE_INVALID');
 assert.equal((await execute(async()=>({ok:true,status:200,body:null}))).result.error,'RESPONSE_INVALID');
});

test('refusal, hidden reasoning and non-stop finish reasons are rejected without retaining content',async()=>{
 const cases=[['REFUSAL',d=>{d.choices[0].message.refusal='PRIVATE_REFUSAL';}],['REFUSAL',d=>{d.choices[0].finish_reason='content_filter';}],['HIDDEN_REASONING',d=>{d.usage.completion_tokens_details.reasoning_tokens=1;}],['HIDDEN_REASONING',d=>{d.choices[0].message.reasoning_content='PRIVATE_REASONING';}],['HIDDEN_REASONING',d=>{d.choices[0].message.thinking={text:'PRIVATE_REASONING'};}],['HIDDEN_REASONING',d=>{d.choices[0].message.content='<think>PRIVATE_REASONING</think>'; }],['HIDDEN_REASONING',d=>{d.choices[0].message.content='<thinking>PRIVATE_REASONING</thinking>'; }],['OUTPUT_TRUNCATED',d=>{d.choices[0].finish_reason='length';}],['OUTPUT_TRUNCATED',d=>{d.choices[0].finish_reason='tool_calls';}],['OUTPUT_TRUNCATED',d=>{d.choices[0].finish_reason='PRIVATE_UNKNOWN_FINISH';}]];
 for(const [error,change]of cases){const data=envelope();change(data);const {result,io}=await execute(async()=>response(data));assert.equal(result.error,error);for(const marker of [prose,'PRIVATE_REASONING','PRIVATE_REFUSAL','PRIVATE_UNKNOWN_FINISH'])assert.equal(Object.values(io.filesData).map(bytes=>bytes.toString()).join('\n').includes(marker),false);}
});

test('secret echoes in arbitrary envelope fields and common encodings fail closed',async()=>{
 const encoded=[key,Buffer.from(key).toString('base64'),Buffer.from(key).toString('base64url'),Buffer.from(key).toString('hex'),encodeURIComponent(key),[...key].map(c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0')).join('')];
 for(const value of encoded){const data=envelope();data.private_field=value;const {result,io}=await execute(async()=>response(data));assert.equal(result.error,'SECRET_ECHO');assert.deepEqual(result.usage,{});assert.equal(Object.hasOwn(result,'contentSha256'),false);assert.equal(Object.values(io.filesData).map(bytes=>bytes.toString()).join('\n').includes(key),false);}
});

test('rejected success stream is an upstream error and never records its free-text exception',async()=>{
 const fake=readerResponse({throws:true});const {result,io}=await execute(async()=>fake.response);assert.equal(result.error,'UPSTREAM_ERROR');assert.equal(fake.stats().cancels,1);assert.equal(Object.values(io.filesData).map(bytes=>bytes.toString()).join('\n').includes(key),false);
});

test('exclusive dispatch marker is durable before fetch and prevents a second local execution',async t=>{
 const root=await mkdtemp(join(tmpdir(),'nexus-probe-once-'));t.after(()=>rm(root,{recursive:true,force:true}));const io=await diskIO(root);let calls=0;
 const args={env,trial,record:reservation(env,trial),io,fetchImpl:async()=>{calls++;const marker=JSON.parse((await io.files())['dispatch.json']);assert.equal(marker.attemptedOrUncertain,true);assert.equal(marker.remainingAttempts,0);return response();}};
 await runOne(args);await assert.rejects(runOne(args),{code:'EEXIST'});assert.equal(calls,1);
 const index=JSON.parse((await io.files())['index.json']);assert.equal(Object.hasOwn(index.sha256,'dispatch.json'),true);
});

test('failed pre-dispatch persistence makes zero transport attempts',async()=>{
 let calls=0;const blocked={async write(){throw Object.assign(Error('offline disk full'),{code:'ENOSPC'});}};
 await assert.rejects(runOne({env,trial,record:reservation(env,trial),io:blocked,fetchImpl:async()=>{calls++;return response();}}),{code:'ENOSPC'});assert.equal(calls,0);
});

test('public error codes are a fixed allowlist; arbitrary exceptions cannot leak details',()=>{
 for(const code of ['APPROVAL_REQUIRED','CONFIG_INVALID','SOURCE_MISMATCH','CI_REQUIRED','STAGE_CONSUMED','HISTORY_INVALID','FREEZE_INVALID','NOT_CONFIGURED','PERSISTENCE_FAILED','UPSTREAM_ERROR','UPSTREAM_TIMEOUT','RESPONSE_TOO_LARGE','RESPONSE_INVALID','REFUSAL','HIDDEN_REASONING','SECRET_ECHO','OUTPUT_TRUNCATED'])assert.equal(safeCode({code,message:key,stack:key}),code);
 for(const error of [null,undefined,Error(key),{code:key},{code:'toString'},{code:'__proto__'}])assert.equal(safeCode(error),'PERSISTENCE_FAILED');
});
