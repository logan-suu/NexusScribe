/** One explicitly approved transport probe. No literary trial or retries. */
import {readFile,mkdir,open,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {buildProviderRequest,readProviderError} from '../server/provider-transport.js';
export const ID='transport-compatibility-20261006';
export const WORKFLOW='compatibility-probe.yml';
export const ENDPOINT='https://opencode.ai/zen/go/v1/chat/completions';
export const BODY_SHA='2b598fa0db1271b0024150b80afab36bf2bb86ae7573dedb5bbe3bb9c664241c';
export const FREEZE_SHA='5701b71bf86b7db9675095872606234b324a0e6e39930f6484000a45dff3fe73';
export const PATHS=['scripts/run-compatibility-probe.mjs','server/provider-transport.js','.github/workflows/compatibility-probe.yml','eval/COMPATIBILITY-PROBE-PROTOCOL.md','eval/causal-continuity-requests.json','tests/compatibility-probe.test.js'];
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export const digest=x=>createHash('sha256').update(typeof x==='string'||Buffer.isBuffer(x)?x:JSON.stringify(x)).digest('hex');
const fail=code=>{throw Object.assign(Error(code),{code});};
const SAFE=new Set(['APPROVAL_REQUIRED','CONFIG_INVALID','SOURCE_MISMATCH','CI_REQUIRED','STAGE_CONSUMED','HISTORY_INVALID','FREEZE_INVALID','NOT_CONFIGURED','PERSISTENCE_FAILED','UPSTREAM_ERROR','UPSTREAM_TIMEOUT','RESPONSE_TOO_LARGE','RESPONSE_INVALID','REFUSAL','HIDDEN_REASONING','SECRET_ECHO','OUTPUT_TRUNCATED']);
export const safeCode=e=>SAFE.has(e?.code)?e.code:'PERSISTENCE_FAILED';
const object=x=>x&&typeof x==='object'&&!Array.isArray(x);
export function bodyFrom(bytes){
 if(digest(bytes)!==FREEZE_SHA)fail('FREEZE_INVALID');
 const request=JSON.parse(bytes).requests[0];const body=JSON.stringify(request.body);
 if(request.sequence!==1||request.fixture!=='F1-replay'||request.arm!=='A'||digest(body)!==BODY_SHA)fail('FREEZE_INVALID');
 return body;
}
export function gates(env,runs,ci){
 if(env.NEXUS_COMPATIBILITY_APPROVED!==ID||env.NEXUS_OVERAGE_CONFIRMED_OFF!=='true')fail('APPROVAL_REQUIRED');
 if(env.GITHUB_ACTIONS!=='true'||env.GITHUB_RUN_ATTEMPT!=='1'||env.GITHUB_REPOSITORY!=='logan-suu/NexusScribe'||env.GITHUB_REF!=='refs/heads/dev_v1.0'||!/^\d+$/.test(env.GITHUB_RUN_ID||'')||!/^\d+$/.test(env.NEXUS_CI_RUN_ID||'')||!/^[a-f0-9]{40}$/.test(env.GITHUB_SHA||''))fail('CONFIG_INVALID');
 if(env.NEXUS_SOURCE_SHA!==env.GITHUB_SHA)fail('SOURCE_MISMATCH');
 if(String(ci?.id)!==env.NEXUS_CI_RUN_ID||ci.path!=='.github/workflows/ci.yml'||ci.head_sha!==env.GITHUB_SHA||ci.status!=='completed'||ci.conclusion!=='success')fail('CI_REQUIRED');
 if(!Array.isArray(runs)||runs.length!==1)fail('STAGE_CONSUMED');
 const r=runs[0];if(String(r.id)!==env.GITHUB_RUN_ID||r.head_sha!==env.GITHUB_SHA||r.run_attempt!==1||r.event!=='workflow_dispatch'||r.path!=='.github/workflows/'+WORKFLOW||r.display_title!==ID||!['queued','in_progress','waiting','pending'].includes(r.status))fail('HISTORY_INVALID');
 return true;
}
export async function loadFreeze(root=ROOT){
 const manifest=JSON.parse(await readFile(resolve(root,'eval/compatibility-probe-manifest.json')));
 if(manifest.protocol!==ID||manifest.maxAttempts!==1||JSON.stringify(Object.keys(manifest.sha256).sort())!==JSON.stringify([...PATHS].sort()))fail('FREEZE_INVALID');
 for(const p of PATHS)if(digest(await readFile(resolve(root,p)))!==manifest.sha256[p])fail('FREEZE_INVALID');
 return {manifest,body:bodyFrom(await readFile(resolve(root,'eval/causal-continuity-requests.json')))};
}
export async function diskIO(dir){
 await mkdir(dir,{recursive:true});
 return {async write(name,value){if(!/^[a-z][a-z0-9-]*\.json$/.test(name))fail('PERSISTENCE_FAILED');const handle=await open(resolve(dir,name),'wx',0o600);try{await handle.writeFile(JSON.stringify(value,null,2)+'\n');await handle.sync();}finally{await handle.close();}},async files(){const out={};for(const name of await readdir(dir))out[name]=await readFile(resolve(dir,name));return out;}};
}
export function reservation(env,trial){return {protocol:ID,sourceSha:env.GITHUB_SHA,ciRunId:env.NEXUS_CI_RUN_ID,runId:env.GITHUB_RUN_ID,attemptsReserved:1,remainingAttempts:0,attemptedOrUncertain:true,bodySha256:digest(trial.body),manifestSha256:digest(trial.manifest),endpoint:ENDPOINT,maxOutputTokens:3000,deadlineMs:120000,successEnvelopeLimitBytes:131072,errorEnvelopeLimitBytes:16384,balanceEvidence:'user previously confirmed Use balance off; no refreshed console verification'};}
export function validateReservation(record,env,trial){if(JSON.stringify(record)!==JSON.stringify(reservation(env,trial)))fail('PERSISTENCE_FAILED');}
const usage=d=>Object.fromEntries(Object.entries({promptTokens:d?.usage?.prompt_tokens,completionTokens:d?.usage?.completion_tokens,totalTokens:d?.usage?.total_tokens,reasoningTokens:d?.usage?.completion_tokens_details?.reasoning_tokens}).filter(([,v])=>Number.isSafeInteger(v)&&v>=0));
function secretEcho(value,key){
 const variants=[key,Buffer.from(key).toString('base64'),Buffer.from(key).toString('base64url'),Buffer.from(key).toString('hex'),encodeURIComponent(key)];
 const texts=[typeof value==='string'?value:JSON.stringify(value)];
 if(object(value)||Array.isArray(value)){const pending=[value];while(pending.length){const v=pending.pop();if(typeof v==='string')texts.push(v);else if(v&&typeof v==='object')pending.push(...Object.values(v));}}
 for(let text of texts){let settled=false;for(let i=0;i<10;i++){if(variants.some(s=>text.includes(s)))return true;const next=text.replace(/\\u([a-fA-F0-9]{4})|\\(["\\/bfnrt])/g,(_,h,c)=>h?String.fromCharCode(parseInt(h,16)):({'"':'"','\\':'\\','/':'/','b':'\b','f':'\f','n':'\n','r':'\r','t':'\t'}[c]));if(next===text){settled=true;break;}text=next;}if(!settled)return true;}
 return false;
}
/** Injected fake tests use this same function. Production invokes it once only after durable reservation upload. */
export async function runOne({env,trial,record,io,fetchImpl,timeoutMs=120000}){
 validateReservation(record,env,trial);
 const key=env.NEXUS_API_KEY;if(typeof key!=='string'||!key.trim()||key.length>4096||/[\r\n]/.test(key))fail('NOT_CONFIGURED');
 await io.write('dispatch.json',{protocol:ID,runId:env.GITHUB_RUN_ID,sourceSha:env.GITHUB_SHA,bodySha256:BODY_SHA,attemptedOrUncertain:true,remainingAttempts:0});
 const controller=new AbortController();let timer,reader,active=true,received=0;const began=Date.now();
 const out={protocol:ID,sourceSha:env.GITHUB_SHA,runId:env.GITHUB_RUN_ID,bodySha256:BODY_SHA,attempts:1,remainingAttempts:0,status:'stopped',usage:{},cost:'unknown'};
 try{
  const request=buildProviderRequest({endpoint:ENDPOINT,key,body:trial.body,signal:controller.signal});
  const operation=(async()=>{
   let response;try{response=await fetchImpl(request.url,request.options);}catch{fail(controller.signal.aborted?'UPSTREAM_TIMEOUT':'UPSTREAM_ERROR');}
   if(!active||controller.signal.aborted)fail('UPSTREAM_TIMEOUT');
   out.httpStatus=Number.isInteger(response.status)&&response.status>=100&&response.status<=599?response.status:null;
   if(!response.ok){const diagnostics=await readProviderError(response,{signal:controller.signal});if(!active||controller.signal.aborted)fail('UPSTREAM_TIMEOUT');out.transportDiagnostics=diagnostics;fail('UPSTREAM_ERROR');}
   reader=response.body?.getReader();if(!reader)fail('RESPONSE_INVALID');const chunks=[];
   for(;;){let part;try{part=await reader.read();}catch{fail(controller.signal.aborted?'UPSTREAM_TIMEOUT':'UPSTREAM_ERROR');}if(!active||controller.signal.aborted)fail('UPSTREAM_TIMEOUT');if(part.done)break;received+=part.value.byteLength;if(received>131072)fail('RESPONSE_TOO_LARGE');chunks.push(Buffer.from(part.value));}
   const bytes=Buffer.concat(chunks);if(secretEcho(bytes.toString('utf8'),key))fail('SECRET_ECHO');let data;try{data=JSON.parse(bytes);}catch{fail('RESPONSE_INVALID');}
   if(secretEcho(data,key))fail('SECRET_ECHO');if(!object(data)||!Array.isArray(data.choices)||data.choices.length!==1||!object(data.choices[0])||!object(data.choices[0].message))fail('RESPONSE_INVALID');out.usage=usage(data);
   const c=data?.choices?.[0];out.finishReason=['stop','length','content_filter','tool_calls'].includes(c?.finish_reason)?c.finish_reason:'unknown';
   if(out.usage.reasoningTokens>0||data?.choices?.some(c=>object(c.message)&&Object.entries(c.message).some(([k,v])=>/reason|thinking/i.test(k)&&v!==null&&v!==''&&v!==undefined)))fail('HIDDEN_REASONING');
   if(data.error||!Array.isArray(data.choices)||data.choices.length!==1||!object(c.message)||c.message.role!==undefined&&c.message.role!=='assistant'||c.message.function_call!=null||c.message.tool_calls!=null&&(!Array.isArray(c.message.tool_calls)||c.message.tool_calls.length))fail('RESPONSE_INVALID');
   if(c.message.refusal||out.finishReason==='content_filter')fail('REFUSAL');
   if(typeof c.message.content!=='string'||!c.message.content.trim()||out.usage.completionTokens>3000)fail('RESPONSE_INVALID');
   if(/<think(?:ing)?>/i.test(c.message.content))fail('HIDDEN_REASONING');
   // Intentionally retain no prose or envelope. This is solely a compatibility observation.
   out.contentCharacters=c.message.content.length;out.contentSha256=digest(c.message.content);
   if(out.finishReason!=='stop')fail('OUTPUT_TRUNCATED');out.status='compatible_response';
  })();
  await Promise.race([operation,new Promise((_,reject)=>{timer=setTimeout(()=>{active=false;controller.abort();reject(Object.assign(Error('UPSTREAM_TIMEOUT'),{code:'UPSTREAM_TIMEOUT'}));},Math.min(timeoutMs,120000));})]);
 }catch(e){out.status='stopped';out.error=safeCode(e);}
 finally{active=false;clearTimeout(timer);controller.abort();try{Promise.resolve(reader?.cancel()).catch(()=>{});}catch{}out.receivedSuccessBytes=received;out.elapsedMs=Date.now()-began;out.missingUsageFields=['promptTokens','completionTokens','totalTokens','reasoningTokens'].filter(k=>!Object.hasOwn(out.usage,k));await io.write('result.json',out);const files=await io.files();await io.write('index.json',{protocol:ID,sourceSha:env.GITHUB_SHA,sha256:Object.fromEntries(Object.entries(files).map(([n,b])=>[n,digest(b)]))});}
 return out;
}
async function get(path,env){const response=await fetch('https://api.github.com/repos/logan-suu/NexusScribe'+path,{redirect:'error',headers:{Accept:'application/vnd.github+json',Authorization:`Bearer ${env.GH_TOKEN}`},signal:AbortSignal.timeout(30000)});if(!response.ok)fail('HISTORY_INVALID');return response.json();}
export async function main(mode=process.argv[2],env=process.env){
 if(!['prepare','execute'].includes(mode))fail('CONFIG_INVALID');
 const trial=await loadFreeze();
 const history=await get('/actions/workflows/'+WORKFLOW+'/runs?per_page=100',env);
 if(history.total_count!==1||history.workflow_runs?.length!==1)fail('STAGE_CONSUMED');
 const ci=await get('/actions/runs/'+env.NEXUS_CI_RUN_ID,env);gates(env,history.workflow_runs,ci);
 const io=await diskIO(resolve(ROOT,'compatibility-probe-evidence'));
 if(mode==='prepare'){await io.write('reservation.json',reservation(env,trial));return;}
 if(env.NEXUS_RESERVATION_UPLOADED!=='true')fail('PERSISTENCE_FAILED');
 const record=JSON.parse(await readFile(resolve(ROOT,'compatibility-probe-evidence/reservation.json')));
 const out=await runOne({env,trial,record,io,fetchImpl:globalThis.fetch});console.log(JSON.stringify(out));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{await main();}catch(e){console.error(JSON.stringify({status:'blocked',code:safeCode(e)}));process.exitCode=1;}}
