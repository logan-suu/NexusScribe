import {currentMaintenancePaths} from './eval-source-inventory.mjs';
/** Consumed after one scoreable HTTP-200 output; retired on delivery-count stop. Explicit fake replay only. */
import {readFile,mkdir,open,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {buildProviderRequest,readProviderError} from '../server/provider-transport.js';
import {segmentProse} from '../src/domain/prose.js';

export const ID='causal-quality-20261006';
export const WORKFLOW='causal-quality-trial.yml';
export const ENDPOINT='https://opencode.ai/zen/go/v1/chat/completions';
export const FREEZE_SHA='5701b71bf86b7db9675095872606234b324a0e6e39930f6484000a45dff3fe73';
export const MASKED_MAPPING_SHA='00618555ff112bf760b93660740fd038c7078bfd02a3049f96680d38b72a895f';
export const BODY_SHAS=['2b598fa0db1271b0024150b80afab36bf2bb86ae7573dedb5bbe3bb9c664241c','73f139424a49b72b2d3d84781968b7a031122c9d56f4932caa9688afdd9fd308','b08e91571190cb4ea1a18a84f1c5dcf03636f1e5aedceec744db116f2d0e9322','f6e433b06fdd772c042614c9a2d5fc41b14f523ef1184f12e28cc3e468bb2e04','3817d325ba0d06b1216f19700612978002f5d6bd1a00cc7a5f11f657a73a2f76','26f9ae08bf3dcf8611def04c295e857c73ef785b52f565a70b02d9be61254228'];
export const PATHS=Object.freeze(currentMaintenancePaths(["scripts/run-causal-quality.mjs","server/provider-transport.js","src/domain/prose.js",".github/workflows/causal-quality-trial.yml",".github/workflows/ci.yml","eval/CAUSAL-QUALITY-PROTOCOL.md","eval/causal-continuity-requests.json","tests/causal-quality.test.js","eval/CAUSAL-QUALITY-RESULTS.md","eval/history/causal-quality-20261006/masked-candidate.json","eval/history/causal-quality-20261006/masked-individual.json","eval/history/causal-quality-20261006/artifact-index.json","eval/history/causal-quality-20261006/completed-01.json","eval/history/causal-quality-20261006/dispatch-01.json","eval/history/causal-quality-20261006/index.json","eval/history/causal-quality-20261006/ledger-01.json","eval/history/causal-quality-20261006/raw-prose-01.bin","eval/history/causal-quality-20261006/reservation.json","eval/history/causal-quality-20261006/response-meta-01.json","eval/history/causal-quality-20261006/result.json","eval/history/causal-quality-20261006/source-manifest.json","eval/history/causal-quality-20261006/source-protocol.md","eval/history/causal-quality-20261006/source-runner.mjs","eval/history/causal-quality-20261006/source-tests.js","eval/history/causal-quality-20261006/source-workflow.yml"]));
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const ORDER=[['F1-replay','A'],['F1-replay','B'],['F2-physical-transition','B'],['F2-physical-transition','A'],['F3-unused-domain-transfer','A'],['F3-unused-domain-transfer','B']];
const object=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const fail=code=>{throw Object.assign(Error(code),{code});};
export const digest=x=>createHash('sha256').update(typeof x==='string'||Buffer.isBuffer(x)?x:JSON.stringify(x)).digest('hex');
const SAFE=new Set(['RETIRED','APPROVAL_REQUIRED','CONFIG_INVALID','SOURCE_MISMATCH','CI_REQUIRED','STAGE_CONSUMED','HISTORY_INVALID','FREEZE_INVALID','NOT_CONFIGURED','PERSISTENCE_FAILED','UPSTREAM_ERROR','UPSTREAM_TIMEOUT','RESPONSE_TOO_LARGE','RESPONSE_INVALID','REFUSAL','HIDDEN_REASONING','SECRET_ECHO','OUTPUT_TRUNCATED','DELIVERY_FAILED','BUDGET_UNCERTAIN']);
export const safeCode=e=>SAFE.has(e?.code)?e.code:'PERSISTENCE_FAILED';
const filename=(prefix,n,ext='json')=>`${prefix}-${String(n).padStart(2,'0')}.${ext}`;
const allowedFile=n=>/^(?:reservation|result|index)\.json$/.test(n)||/^(?:dispatch|response-meta|completed|ledger)-0[1-6]\.json$/.test(n)||/^raw-prose-0[1-6]\.bin$/.test(n);

export function validateRequests(requests){
 if(!Array.isArray(requests)||requests.length!==6)fail('FREEZE_INVALID');
 requests.forEach((r,i)=>{
  const b=r.body,range=i===2||i===3?[350,500]:[450,600];
  if(r.sequence!==i+1||!same([r.fixture,r.arm],ORDER[i])||!same(r.targetHan,range)||!same(r.targetParagraphs,[4,7])||r.bodySha256!==BODY_SHAS[i]||digest(b)!==BODY_SHAS[i]||b.model!=='deepseek-v4.1-flash'||b.max_tokens!==3000||b.temperature!==0.7||!same(b.thinking,{type:'disabled'})||!same(Object.keys(b),['model','max_tokens','thinking','temperature','messages']))fail('FREEZE_INVALID');
 });
 return requests;
}
export function validateFreeze(bytes){
 if(digest(bytes)!==FREEZE_SHA)fail('FREEZE_INVALID');
 const parsed=JSON.parse(bytes);validateRequests(parsed.requests);return parsed.requests;
}
export async function loadFreeze(root=ROOT){
 try{
  const manifest=JSON.parse(await readFile(resolve(root,'eval/causal-quality-manifest.json')));
  if(manifest.protocol!==ID||manifest.status!=='retired_consumed_offline_replay'||!same(manifest.bodySha256,BODY_SHAS)||manifest.maxAttempts!==6||manifest.maxOutputTokensPerCall!==3000||manifest.maxOutputTokensTotal!==18000||manifest.maskedMappingSha256!==MASKED_MAPPING_SHA||manifest.stop!=='operational_delivery_safety_budget_uncertainty'||!object(manifest.sha256)||!same(Object.keys(manifest.sha256).sort(),[...PATHS].sort()))fail('FREEZE_INVALID');
  for(const p of PATHS)if(digest(await readFile(resolve(root,p)))!==manifest.sha256[p])fail('FREEZE_INVALID');
  return {manifest,requests:validateFreeze(await readFile(resolve(root,'eval/causal-continuity-requests.json')))};
 }catch{fail('FREEZE_INVALID');}
}
export function approval(env){
 if(env.NEXUS_QUALITY_APPROVED!==ID||env.NEXUS_OVERAGE_CONFIRMED_OFF!=='true')fail('APPROVAL_REQUIRED');
 if(env.GITHUB_ACTIONS!=='true'||env.GITHUB_RUN_ATTEMPT!=='1'||env.GITHUB_REPOSITORY!=='logan-suu/NexusScribe'||env.GITHUB_REF!=='refs/heads/dev_v1.0'||!/^\d+$/.test(env.GITHUB_RUN_ID||'')||!/^\d+$/.test(env.NEXUS_CI_RUN_ID||'')||!/^[a-f0-9]{40}$/.test(env.GITHUB_SHA||''))fail('CONFIG_INVALID');
 if(env.NEXUS_SOURCE_SHA!==env.GITHUB_SHA)fail('SOURCE_MISMATCH');
}
export function gates(env,runs,ci){
 approval(env);
 if(String(ci?.id)!==env.NEXUS_CI_RUN_ID||ci.path!=='.github/workflows/ci.yml'||ci.head_sha!==env.GITHUB_SHA||ci.head_branch!=='dev_v1.0'||!['push','workflow_dispatch'].includes(ci.event)||ci.status!=='completed'||ci.conclusion!=='success')fail('CI_REQUIRED');
 if(!Array.isArray(runs)||runs.length!==1)fail('STAGE_CONSUMED');
 const r=runs[0];if(String(r.id)!==env.GITHUB_RUN_ID||r.head_sha!==env.GITHUB_SHA||r.head_branch!=='dev_v1.0'||r.run_attempt!==1||r.event!=='workflow_dispatch'||r.path!=='.github/workflows/'+WORKFLOW||r.display_title!==ID||!['queued','in_progress','waiting','pending'].includes(r.status))fail('HISTORY_INVALID');
 return true;
}
export function validateArtifact(env,a){
 if(env.NEXUS_RESERVATION_UPLOADED!=='true'||!/^\d+$/.test(env.NEXUS_RESERVATION_ARTIFACT_ID||'')||String(a?.id)!==env.NEXUS_RESERVATION_ARTIFACT_ID||a.name!==ID+'-reservation'||a.expired!==false||!Number.isSafeInteger(a.size_in_bytes)||a.size_in_bytes<=0||String(a.workflow_run?.id)!==env.GITHUB_RUN_ID||a.workflow_run?.head_sha!==env.GITHUB_SHA)fail('PERSISTENCE_FAILED');
}
export async function diskIO(dir){
 await mkdir(dir,{recursive:true,mode:0o700});
 return {
  async write(name,value){
   if(!allowedFile(name))fail('PERSISTENCE_FAILED');
   const handle=await open(resolve(dir,name),'wx',0o600);
   try{await handle.writeFile(Buffer.isBuffer(value)?value:JSON.stringify(value,null,2)+'\n');await handle.sync();}finally{await handle.close();}
   const folder=await open(dir,'r');try{await folder.sync();}finally{await folder.close();}
  },
  async files(){const out={};for(const item of await readdir(dir,{withFileTypes:true})){if(!item.isFile()||!allowedFile(item.name))fail('PERSISTENCE_FAILED');out[item.name]=await readFile(resolve(dir,item.name));}return out;}
 };
}
export function reservation(env,trial){
 validateRequests(trial.requests);
 return {protocol:ID,sourceSha:env.GITHUB_SHA,ciRunId:env.NEXUS_CI_RUN_ID,runId:env.GITHUB_RUN_ID,attemptsReserved:6,remainingAttempts:0,attemptedOrUncertain:true,bodySha256:[...BODY_SHAS],manifestSha256:digest(trial.manifest),maskedMappingSha256:MASKED_MAPPING_SHA,endpoint:ENDPOINT,maxOutputTokensPerCall:3000,maxOutputTokensTotal:18000,deadlineMsPerCall:120000,minGapMs:11000,successEnvelopeLimitBytes:131072,errorEnvelopeLimitBytes:16384,balanceEvidence:'user previously confirmed Use balance off; no refreshed console verification'};
}
export function validateReservation(record,env,trial){if(!same(record,reservation(env,trial)))fail('PERSISTENCE_FAILED');}
export function secretEcho(value,secrets){
 const present=secrets.filter(s=>typeof s==='string'&&s.length);
 const variants=present.flatMap(s=>[s,Buffer.from(s).toString('base64'),Buffer.from(s).toString('base64url'),encodeURIComponent(s)]);
 const hex=present.map(s=>Buffer.from(s).toString('hex'));
 const texts=[Buffer.isBuffer(value)?value.toString('utf8'):typeof value==='string'?value:JSON.stringify(value)];
 if(!Buffer.isBuffer(value)&&(object(value)||Array.isArray(value))){const pending=[value];while(pending.length){const v=pending.pop();if(typeof v==='string')texts.push(v);else if(v&&typeof v==='object')for(const child of Object.values(v))pending.push(child);}}
 for(let text of texts){let settled=false;for(let i=0;i<10;i++){if(variants.some(s=>text.includes(s))||hex.some(s=>text.toLowerCase().includes(s)))return true;const next=text.replace(/\\u([a-fA-F0-9]{4})|\\(["\\/bfnrt])/g,(_,h,c)=>h?String.fromCharCode(parseInt(h,16)):({'"':'"','\\':'\\','/':'/','b':'\b','f':'\f','n':'\n','r':'\r','t':'\t'}[c])).replace(/%([a-fA-F0-9]{2})/g,(_,h)=>String.fromCharCode(parseInt(h,16)));if(next===text){settled=true;break;}text=next;}if(!settled)return true;}
 return false;
}
export function stats(text,request){const han=(text.match(/\p{Script=Han}/gu)||[]).length,paragraphs=segmentProse(text).length;return {han,paragraphs,pass:han>=request.targetHan[0]&&han<=request.targetHan[1]&&paragraphs>=request.targetParagraphs[0]&&paragraphs<=request.targetParagraphs[1]};}
function usage(data){return Object.fromEntries(Object.entries({promptTokens:data?.usage?.prompt_tokens,completionTokens:data?.usage?.completion_tokens,totalTokens:data?.usage?.total_tokens,reasoningTokens:data?.usage?.completion_tokens_details?.reasoning_tokens}).filter(([,v])=>Number.isSafeInteger(v)&&v>=0));}
function hasHiddenReasoning(data){
 const pending=[data];while(pending.length){const value=pending.pop();if(!value||typeof value!=='object')continue;for(const [k,v]of Object.entries(value)){if(k!=='finish_reason'&&/reason|thinking/i.test(k)&&v!==null&&v!==''&&v!==undefined&&v!==0)return true;if(v&&typeof v==='object')pending.push(v);}}
 return false;
}
function budgetError(u){return Object.keys(u).length!==4||u.reasoningTokens!==0||u.completionTokens>3000||!Number.isSafeInteger(u.promptTokens+u.completionTokens)||u.totalTokens!==u.promptTokens+u.completionTokens;}
/** Read one bounded envelope entirely in memory. No arbitrary provider field or error text can escape. */
async function one({request,key,secrets,fetchImpl,timeoutMs}){
 const out={sequence:request.sequence,requestSha256:request.bodySha256,status:'stopped',usage:{},cost:'unknown'};
 const controller=new AbortController();let timer,reader,active=true,received=0;const began=Date.now();
 const guard=()=>{if(!active||controller.signal.aborted)fail('UPSTREAM_TIMEOUT');};
 try{
  const wire=buildProviderRequest({endpoint:ENDPOINT,key,body:JSON.stringify(request.body),signal:controller.signal});
  const operation=(async()=>{
   let response;try{response=await fetchImpl(wire.url,wire.options);}catch{fail(controller.signal.aborted?'UPSTREAM_TIMEOUT':'UPSTREAM_ERROR');}guard();
   const httpStatus=Number.isInteger(response?.status)&&response.status>=100&&response.status<=599?response.status:null;out.httpStatus=httpStatus;
   if(!response.ok){const diagnostics=await readProviderError(response,{signal:controller.signal});guard();return {httpStatus,transportDiagnostics:diagnostics,error:'UPSTREAM_ERROR'};}
   reader=response.body?.getReader();if(!reader)fail('RESPONSE_INVALID');const chunks=[];
   for(;;){let part;try{part=await reader.read();}catch{fail(controller.signal.aborted?'UPSTREAM_TIMEOUT':'UPSTREAM_ERROR');}guard();if(part.done)break;if(!(part.value instanceof Uint8Array))fail('RESPONSE_INVALID');received+=part.value.byteLength;if(received>131072)fail('RESPONSE_TOO_LARGE');chunks.push(Buffer.from(part.value));}
   const bytes=Buffer.concat(chunks);if(secretEcho(bytes,secrets))fail('SECRET_ECHO');let data;try{data=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{fail('RESPONSE_INVALID');}
   if(secretEcho(data,secrets))fail('SECRET_ECHO');
   if(hasHiddenReasoning(data))fail('HIDDEN_REASONING');
   if(!object(data)||data.error||!Array.isArray(data.choices)||data.choices.length!==1||!object(data.choices[0])||!object(data.choices[0].message))fail('RESPONSE_INVALID');
   const c=data.choices[0],m=c.message,u=usage(data),finishReason=['stop','length','content_filter','tool_calls'].includes(c.finish_reason)?c.finish_reason:'unknown';
   if(m.refusal||finishReason==='content_filter')fail('REFUSAL');
   if(m.role!==undefined&&m.role!=='assistant'||m.function_call!=null||m.tool_calls!=null&&(!Array.isArray(m.tool_calls)||m.tool_calls.length))fail('RESPONSE_INVALID');
   const text=m.content;
   if(typeof text!=='string'||!text.isWellFormed()||!text.trim()||text.length>30000||/^\s*(?:```|~~~|\{|\[)/.test(text)||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text))fail('RESPONSE_INVALID');
   if(/<\/?(?:think(?:ing)?|analysis|reasoning)(?:\s[^>]*)?>/i.test(text))fail('HIDDEN_REASONING');
   const counts=stats(text,request);
   const error=budgetError(u)?'BUDGET_UNCERTAIN':finishReason!=='stop'?'OUTPUT_TRUNCATED':!counts.pass?'DELIVERY_FAILED':undefined;
   return {httpStatus,finishReason,usage:u,text,textSha256:digest(text),counts,...(error?{error}:{})};
  })();
  Object.assign(out,await Promise.race([operation,new Promise((_,reject)=>{timer=setTimeout(()=>{active=false;controller.abort();reject(Object.assign(Error('UPSTREAM_TIMEOUT'),{code:'UPSTREAM_TIMEOUT'}));},Math.min(timeoutMs,120000));})]));
  if(!out.error)out.status='retained_for_masked_read';
 }catch(e){out.error=safeCode(e);}
 finally{active=false;clearTimeout(timer);controller.abort();try{Promise.resolve(reader?.cancel()).catch(()=>{});}catch{}out.receivedSuccessBytes=received;out.elapsedMs=Date.now()-began;out.missingUsageFields=['promptTokens','completionTokens','totalTokens','reasoningTokens'].filter(k=>!Object.hasOwn(out.usage,k));}
 return out;
}
export function aggregateUsage(stages){
 const names=['promptTokens','completionTokens','totalTokens','reasoningTokens'];
 return Object.fromEntries(names.map(k=>[k,stages.length&&stages.every(s=>Number.isSafeInteger(s.usage[k]))&&Number.isSafeInteger(stages.reduce((sum,s)=>sum+s.usage[k],0))?stages.reduce((sum,s)=>sum+s.usage[k],0):null]));
}
/** Historical execution behavior is retained only for explicit injected fake replay. */
export async function runTrial({env,trial,record,runs,ci,artifact,io,fetchImpl,timeoutMs=120000,sleep=ms=>new Promise(r=>setTimeout(r,ms)),offlineReplay=false}){
 if(offlineReplay!==true||typeof fetchImpl!=='function'||fetchImpl===globalThis.fetch)fail('RETIRED');
 gates(env,runs,ci);validateArtifact(env,artifact);validateReservation(record,env,trial);
 if(typeof fetchImpl!=='function'||!Number.isFinite(timeoutMs)||timeoutMs<=0||typeof sleep!=='function')fail('CONFIG_INVALID');
 const before=await io.files();if(!same(Object.keys(before),['reservation.json'])||!same(JSON.parse(before['reservation.json']),record))fail('PERSISTENCE_FAILED');
 // Freeze a private snapshot before asynchronous transport; external mutation cannot replace later bodies.
 const requests=JSON.parse(JSON.stringify(validateRequests(trial.requests)));
 const key=env.NEXUS_API_KEY;if(typeof key!=='string'||!key.trim()||key.length>4096||/[\r\n]/.test(key))fail('NOT_CONFIGURED');
 const secrets=[key,env.GH_TOKEN];
 const result={protocol:ID,sourceSha:env.GITHUB_SHA,runId:env.GITHUB_RUN_ID,ciRunId:env.NEXUS_CI_RUN_ID,manifestSha256:digest(trial.manifest),attemptsReserved:6,attempts:0,remainingAttempts:0,requestedOutputTokens:0,status:'running',cost:'unknown',stages:[]};
 try{
  for(const request of requests){
   if(result.attempts)await sleep(11000);
   const n=request.sequence;
   await io.write(filename('dispatch',n),{protocol:ID,sourceSha:env.GITHUB_SHA,runId:env.GITHUB_RUN_ID,sequence:n,requestSha256:request.bodySha256,attemptedOrUncertain:true,cumulativeAttempts:n,maxAttempts:6,cumulativeRequestedOutputTokens:n*3000,maxRequestedOutputTokens:18000});
   result.attempts=n;result.requestedOutputTokens=n*3000;
   const observed=await one({request,key,secrets,fetchImpl,timeoutMs});
   const {text,...stage}=observed;result.stages.push(stage);
   if(text!==undefined){await io.write(filename('raw-prose',n,'bin'),Buffer.from(text,'utf8'));await io.write(filename('completed',n),{text,textSha256:stage.textSha256,counts:stage.counts,storyInputSha256:digest(request.body.messages[1].content)});}
   result.usage=aggregateUsage(result.stages);
   if(result.usage.completionTokens!==null&&result.usage.completionTokens>18000){stage.error='BUDGET_UNCERTAIN';stage.status='stopped';}
   result.status=stage.error?'stopped':n===6?'six_calls_retained_awaiting_masked_read':'running';
   if(stage.error)result.error=stage.error;
   await io.write(filename('response-meta',n),stage);
   await io.write(filename('ledger',n),result);
   if(stage.error)break;
  }
  if(result.attempts===6&&result.stages.every(s=>s.status==='retained_for_masked_read'))result.status='six_calls_retained_awaiting_masked_read';
 }catch(e){result.error=safeCode(e);result.status='stopped';}
 result.usage=aggregateUsage(result.stages);
 await io.write('result.json',result);
 const files=await io.files();
 await io.write('index.json',{protocol:ID,sourceSha:env.GITHUB_SHA,runId:env.GITHUB_RUN_ID,sha256:Object.fromEntries(Object.entries(files).map(([n,b])=>[n,digest(b)]))});
 return result;
}
/** Retirement precedes all argument, environment, credential, history, evidence and transport access. */
export async function main(){fail('RETIRED');}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{const result=await main();console.log(JSON.stringify({protocol:ID,status:result.status,attempts:result.attempts,code:result.error}));if(result.status==='stopped')process.exitCode=1;}catch(e){console.error(JSON.stringify({status:'blocked',code:safeCode(e)}));process.exitCode=1;}}
