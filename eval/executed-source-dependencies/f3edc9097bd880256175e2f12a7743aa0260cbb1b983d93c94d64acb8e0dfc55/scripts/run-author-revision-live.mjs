/** Consumed trial: live CLI permanently retired. Explicit fake-transport helpers remain for offline regression replay only. */
import { mkdir, open } from 'node:fs/promises';
import { resolve, basename } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createAgentService } from '../server/provider.js';
import { protocol, digest, buildRevisionInput, buildFollowupInput, assessStage, validateCloseReadRecord } from './run-author-revision-eval.mjs';

export const STAGES = Object.freeze(['revise', 'extract', 'review']);
export const WORKFLOW = 'author-revision-trial.yml';
const ACTIONS = ['reviseProse', 'extractMemory', 'reviewChapter'];
const SAFE_CODES = new Set(['PROTOCOL_RETIRED','APPROVAL_REQUIRED','FIRST_ACTIONS_ATTEMPT_REQUIRED','INVALID_STAGE','HISTORY_INVALID','STAGE_CONSUMED','SOURCE_MISMATCH','CI_REQUIRED','PRIOR_EVIDENCE_INVALID','GATE_FAILED','REQUEST_COUNT','REQUEST_SETTINGS','INPUT_MISMATCH','RESPONSE_INVALID','RESPONSE_TOO_LARGE','SECRET_ECHO','SECRET_SCAN_UNCERTAIN','EVIDENCE_FAILED','OBJECTIVE_OR_SEMANTIC_FAILURE','UPSTREAM_ERROR','UPSTREAM_TIMEOUT','OUTPUT_TRUNCATED','INVALID_MODEL_OUTPUT','REQUEST_CANCELLED','NOT_CONFIGURED','RATE_LIMIT','CALL_LIMIT']);
const stop = code => { throw Object.assign(Error(code), { code }); };
const safeCode = error => SAFE_CODES.has(error?.code) ? error.code : 'EVIDENCE_FAILED';
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const same = (a,b) => JSON.stringify(a) === JSON.stringify(b);
const utf8 = value => Buffer.isBuffer(value) ? value : Buffer.from(typeof value === 'string' ? value : JSON.stringify(value,null,2)+'\n');
const json = bytes => JSON.parse(Buffer.from(bytes).toString('utf8'));
const pause = ms => new Promise(r => setTimeout(r,ms));
const nameFor = (prefix,n,ext='json') => `${prefix}-${String(n).padStart(2,'0')}.${ext}`;
export const runName = stage => `${protocol.id}/${stage}`;
export function secretScan(value,env,{partial=false}={}) {
  const secrets=[env.NEXUS_API_KEY,env.GH_TOKEN].filter(x=>typeof x==='string'&&x.length);
  let text=utf8(value).toString('utf8');
  const escapes=/\\u([a-fA-F0-9]{4})|\\(["\\/bfnrt])/g;
  const simple={'"':'"','\\':'\\','/':'/','b':'\b','f':'\f','n':'\n','r':'\r','t':'\t'};
  for(let depth=0;depth<=8;depth++){
    if(secrets.some(secret=>text.includes(secret)))return 'secret';
    const decoded=text.replace(escapes,(_,hex,character)=>hex?String.fromCharCode(parseInt(hex,16)):simple[character]);
    if(decoded===text){
      if(partial){
        if(/\\(?:u[a-fA-F0-9]{0,3})?$/.test(text))return 'uncertain';
        for(const secret of secrets)for(let n=1;n<secret.length&&n<=text.length;n++)if(text.endsWith(secret.slice(0,n)))return 'uncertain';
      }
      return 'clear';
    }
    if(depth===8)return 'uncertain';text=decoded;
  }
  return 'uncertain';
}
const containsSecret=(value,env)=>secretScan(value,env)!=='clear';
const safeName = name => /^[a-z][a-z0-9-]*\.(?:json|bin)$/.test(name) && basename(name) === name;

export function approvedConfig(env) {
  if(env.NEXUS_AUTHOR_REVISION_APPROVED!=='true'||env.NEXUS_LIVE_ENABLED!=='true'||env.NEXUS_OVERAGE_CONFIRMED_OFF!=='true')stop('APPROVAL_REQUIRED');
  if(env.GITHUB_ACTIONS!=='true'||env.GITHUB_RUN_ATTEMPT!=='1')stop('FIRST_ACTIONS_ATTEMPT_REQUIRED');
  if(!/^\d+$/.test(env.GITHUB_RUN_ID||'')||!/^\d+$/.test(env.NEXUS_CI_RUN_ID||'')||!/^[a-f\d]{40}$/i.test(env.GITHUB_SHA||'')||!/^[-\w.]+\/[-\w.]+$/.test(env.GITHUB_REPOSITORY||''))stop('HISTORY_INVALID');
  return {...env,NEXUS_API_BASE_URL:'https://opencode.ai/zen/go/v1',NEXUS_API_MODEL:protocol.model,
    NEXUS_MAX_CALLS:'1',NEXUS_MAX_OUTPUT_TOKENS:'3000',NEXUS_THINKING_MODE:'disabled',NEXUS_REASONING_EFFORT:undefined};
}
export function validateRunHistory({stage,env,runs,priorLedger,ciRun}) {
  approvedConfig(env); const index=STAGES.indexOf(stage); if(index<0)stop('INVALID_STAGE');
  if(!Array.isArray(runs)||new Set(runs.map(r=>r?.id)).size!==runs.length)stop('HISTORY_INVALID');
  if(!object(ciRun)||String(ciRun.id)!==env.NEXUS_CI_RUN_ID||ciRun.head_sha!==env.GITHUB_SHA||ciRun.path!=='.github/workflows/ci.yml'||ciRun.status!=='completed'||ciRun.conclusion!=='success')stop('CI_REQUIRED');
  const trialRuns=runs.filter(r=>typeof r.display_title==='string'&&r.display_title.startsWith(protocol.id+'/'));
  if(trialRuns.length!==index+1)stop('STAGE_CONSUMED');
  for(let i=0;i<=index;i++) {
    const matches=trialRuns.filter(r=>r.display_title===runName(STAGES[i]));
    if(matches.length!==1)stop('STAGE_CONSUMED');
    const run=matches[0];
    if(run.head_sha!==env.GITHUB_SHA||run.run_attempt!==1||run.event!=='workflow_dispatch'||run.path!=='.github/workflows/'+WORKFLOW)stop('HISTORY_INVALID');
    if(i===index) {if(String(run.id)!==env.GITHUB_RUN_ID||!['in_progress','queued','waiting','pending'].includes(run.status))stop('STAGE_CONSUMED');}
    else if(run.status!=='completed'||run.conclusion!=='success'||String(run.id)!==priorLedger?.stages?.[i]?.runId)stop('PRIOR_EVIDENCE_INVALID');
  }
  if(index===0&&priorLedger)stop('PRIOR_EVIDENCE_INVALID');
  return true;
}

export function verifyPriorFiles(files,stage,env,trial) {
  const index=STAGES.indexOf(stage); if(index<0)stop('INVALID_STAGE');
  if(!object(files))stop('PRIOR_EVIDENCE_INVALID');
  if(index===0) {if(Object.keys(files).length)stop('PRIOR_EVIDENCE_INVALID');return null;}
  try {
    const indexName=nameFor('index',index), inventory=json(files[indexName]);
    if(!object(inventory.sha256)||inventory.protocol!==protocol.id||inventory.sourceSha!==env.GITHUB_SHA||inventory.stage!==STAGES[index-1])stop('PRIOR_EVIDENCE_INVALID');
    const names=Object.keys(files).sort();
    if(!same(names,[...Object.keys(inventory.sha256),indexName].sort()))stop('PRIOR_EVIDENCE_INVALID');
    for(const name of Object.keys(inventory.sha256))if(!safeName(name)||digest(Buffer.from(files[name]))!==inventory.sha256[name])stop('PRIOR_EVIDENCE_INVALID');
    const ledger=json(files[nameFor('ledger',index)]);
    if(ledger.protocol!==protocol.id||ledger.sourceSha!==env.GITHUB_SHA||ledger.manifestSha256!==digest(trial.manifest)||ledger.status==='stopped'||ledger.attempts!==index||ledger.stages.length!==index||ledger.ciRunId!==env.NEXUS_CI_RUN_ID)stop('PRIOR_EVIDENCE_INVALID');
    ledger.stages.forEach((entry,i)=>{if(entry.sequence!==i+1||entry.stage!==STAGES[i]||entry.action!==ACTIONS[i]||entry.dispatched!==true||entry.status!==(i===0?'awaiting_close_read':'passed'))stop('PRIOR_EVIDENCE_INVALID');});
    const revised=json(files['completed-01.json']).output;
    if(assessStage('reviseProse',revised,{trial}).status!=='pass'||digest(revised)!==ledger.stages[0].outputSha256)stop('PRIOR_EVIDENCE_INVALID');
    if(index===2) {
      const gate=json(files['close-read.json']),extracted=json(files['completed-02.json']).output;
      if(validateCloseReadRecord(gate,revised.text).status!=='pass'||assessStage('extractMemory',extracted,{trial,text:revised.text,closeRead:gate}).status!=='pass'||digest(extracted)!==ledger.stages[1].outputSha256)stop('PRIOR_EVIDENCE_INVALID');
    }
    if(String(ledger.stages.at(-1).runId)!==env.NEXUS_PRIOR_RUN_ID)stop('PRIOR_EVIDENCE_INVALID');
    return ledger;
  } catch(error) {if(error?.code==='PRIOR_EVIDENCE_INVALID')throw error;stop('PRIOR_EVIDENCE_INVALID');}
}

/** Exclusive evidence directory and immutable files. Raw bytes alone append during one request. */
export async function createDiskEvidence(directory) {
  await mkdir(directory); const tracked=new Map(),handles=new Map();
  const write=async(name,value)=>{
    if(!safeName(name)||tracked.has(name))stop('EVIDENCE_FAILED');const bytes=utf8(value),handle=await open(resolve(directory,name),'wx',0o600);
    try{await handle.writeFile(bytes);await handle.sync();}finally{await handle.close();}tracked.set(name,bytes);
  };
  return {write,
    async startRaw(name){if(!safeName(name)||tracked.has(name)||handles.has(name))stop('EVIDENCE_FAILED');handles.set(name,await open(resolve(directory,name),'wx',0o600));tracked.set(name,Buffer.alloc(0));},
    async appendRaw(name,chunk){const handle=handles.get(name);if(!handle)stop('EVIDENCE_FAILED');const bytes=Buffer.from(chunk);let offset=0;while(offset<bytes.length){const {bytesWritten}=await handle.write(bytes,offset,bytes.length-offset);if(!Number.isInteger(bytesWritten)||bytesWritten<=0)stop('EVIDENCE_FAILED');offset+=bytesWritten;tracked.set(name,Buffer.concat([tracked.get(name),bytes.subarray(offset-bytesWritten,offset)]));}await handle.sync();},
    async endRaw(name){const handle=handles.get(name);if(handle){await handle.sync();await handle.close();handles.delete(name);}return tracked.get(name);},
    async files(){return Object.fromEntries([...tracked].map(([name,bytes])=>[name,Buffer.from(bytes)]));}
  };
}
const USAGE_KEYS=['promptTokens','completionTokens','totalTokens','reasoningTokens'];
export function aggregateUsage(stages){return Object.fromEntries(USAGE_KEYS.map(key=>{const attempted=stages.filter(x=>x.dispatched),known=attempted.filter(x=>Object.hasOwn(x.usage||{},key));return[key,{knownSum:known.length?known.reduce((n,x)=>n+x.usage[key],0):null,reportedCalls:known.length,missingCalls:attempted.length-known.length,complete:attempted.length>0&&known.length===attempted.length}];}));}
function safeUsage(data) {return Object.fromEntries(Object.entries({promptTokens:data?.usage?.prompt_tokens,completionTokens:data?.usage?.completion_tokens,totalTokens:data?.usage?.total_tokens,reasoningTokens:data?.usage?.completion_tokens_details?.reasoning_tokens}).filter(([,v])=>Number.isSafeInteger(v)&&v>=0));}


/** Recorded continuation inspection, not semantic entailment or acceptance. */
export function validateExtractionGate(record,output) {
  return object(record)&&record.protocol===protocol.id&&['human','assistant'].includes(record.reviewerType)&&typeof record.reviewer==='string'&&!!record.reviewer.trim()&&
    record.nonBlind===true&&record.locked===true&&record.status==='pass'&&record.outputSha256===digest(output)&&record.scope==='continuation_only_not_fact_verification'&&
    typeof record.explanation==='string'&&!!record.explanation.trim()&&Array.isArray(record.evidence)&&record.evidence.length>0&&record.evidence.every(item=>{
      const candidate=output?.staging?.[item?.candidateIndex];return Number.isSafeInteger(item?.candidateIndex)&&item.candidateIndex>=0&&candidate&&item.label===candidate.label&&item.sourceQuote===candidate.sourceQuote;
    });
}

export async function runStage({stage,env,trial,runs,ciRun,priorFiles={},closeRead,extractionGate,io,fetchImpl,offlineReplay=false,sleep=pause,now=()=>performance.now()}) {
  if(offlineReplay!==true||typeof fetchImpl!=='function'||fetchImpl===globalThis.fetch)stop('PROTOCOL_RETIRED');
  const config=approvedConfig(env),index=STAGES.indexOf(stage),sequence=index+1;
  if(index<0)stop('INVALID_STAGE');
  const prior=verifyPriorFiles(priorFiles,stage,env,trial);
  validateRunHistory({stage,env,runs,priorLedger:prior,ciRun});
  const ledger={protocol:protocol.id,sourceSha:env.GITHUB_SHA,manifestSha256:digest(trial.manifest),ciRunId:env.NEXUS_CI_RUN_ID,
    status:'prepared',attempts:index,stages:prior?structuredClone(prior.stages):[]};
  for(const [name,bytes]of Object.entries(priorFiles))await io.write(name,bytes);
  let revised,indexGate;
  if(index){
    revised=json(priorFiles['completed-01.json']).output;
    indexGate=closeRead;
    if(containsSecret(closeRead??null,env))stop('SECRET_ECHO');
    await io.write(nameFor('close-read-attempt',sequence),closeRead??null);
    if(validateCloseReadRecord(closeRead,revised.text).status!=='pass'||index===2&&!same(json(priorFiles['close-read.json']),closeRead)){
      await io.write('blocked-stage.json',{protocol:protocol.id,stage,runId:env.GITHUB_RUN_ID,sourceSha:env.GITHUB_SHA,status:'stopped',attempts:index,code:'GATE_FAILED'});stop('GATE_FAILED');
    }
    if(index===1)await io.write('close-read.json',closeRead);
    if(index===2){
      if(containsSecret(extractionGate??null,env))stop('SECRET_ECHO');
      await io.write('extraction-gate.json',extractionGate??null);
      if(!validateExtractionGate(extractionGate,json(priorFiles['completed-02.json']).output)){
        await io.write('blocked-stage.json',{protocol:protocol.id,stage,runId:env.GITHUB_RUN_ID,sourceSha:env.GITHUB_SHA,status:'stopped',attempts:index,code:'GATE_FAILED',gate:'extraction_continuation'});stop('GATE_FAILED');
      }
    }
  }
  const action=ACTIONS[index],input=index?buildFollowupInput(action,revised.text,trial,indexGate):buildRevisionInput(trial);
  const record={sequence,stage,action,runId:env.GITHUB_RUN_ID,dispatched:false,status:'prepared',usage:{},sourceTextSha256:digest(input.text)};
  ledger.stages.push(record);
  await io.write(nameFor('intent',sequence),{protocol:protocol.id,sourceSha:env.GITHUB_SHA,runId:env.GITHUB_RUN_ID,ciRunId:env.NEXUS_CI_RUN_ID,sequence,stage,input,inputSha256:digest(input),manifestSha256:ledger.manifestSha256,priorAttempts:index});
  let requests=0,rawStarted=false,active=true,transportError,writes=Promise.resolve(),rawPending=Buffer.alloc(0);
  const persist=operation=>{if(!active)stop('REQUEST_CANCELLED');const pending=writes.then(()=>{if(!active)stop('REQUEST_CANCELLED');return operation();});writes=pending;return pending;};
  const ensureActive=signal=>{if(!active||signal?.aborted)stop('REQUEST_CANCELLED');};
  const rawName=nameFor('raw',sequence,'bin'),started=now();
  const service=createAgentService({env:config,fetchImpl:async(url,options)=>{
    try {
    ensureActive(options.signal);
    if(requests++!==0||ledger.attempts>=protocol.maxCalls)stop('REQUEST_COUNT');
    const body=JSON.parse(options.body);
    if(url!==protocol.endpoint||options.method!=='POST'||options.redirect!=='error'||body.model!==protocol.model||body.max_tokens!==3000||!same(body.thinking,{type:'disabled'})||Object.hasOwn(body,'reasoning_effort'))stop('REQUEST_SETTINGS');
    const wire=JSON.parse(body.messages?.[1]?.content||'null');
    const expected=action==='extractMemory'?{action,input:{chapterId:input.chapterId,context:input.context,paragraphs:(await import('../src/domain/prose.js')).segmentProse(input.text)}}:{action,input};
    if(!same(wire,expected))stop('INPUT_MISMATCH');
    body.temperature=protocol.temperature;const serialized=JSON.stringify(body);
    await persist(()=>io.write(nameFor('request',sequence),{endpoint:url,body:serialized,bodySha256:digest(serialized)}));
    await persist(()=>io.startRaw(rawName));rawStarted=true;ensureActive(options.signal);
    await persist(()=>io.write(nameFor('dispatch',sequence),{protocol:protocol.id,stage,runId:env.GITHUB_RUN_ID,sourceSha:env.GITHUB_SHA,sequence,priorAttempts:index,cumulativeAttempts:sequence,attemptedOrUncertain:true,requestSha256:digest(serialized)}));
    ensureActive(options.signal);
    // The immutable intent and request already exist. This local flag is not independent billing proof.
    record.dispatched=true;record.status='attempted';ledger.attempts++;record.requestSha256=digest(serialized);
    let response;try{response=await fetchImpl(url,{...options,body:serialized});}catch{ensureActive(options.signal);stop('UPSTREAM_ERROR');}
    ensureActive(options.signal);
    let reader;try{reader=response.body?.getReader();}catch{ensureActive(options.signal);stop('UPSTREAM_ERROR');}if(!reader)stop('RESPONSE_INVALID');
    record.httpStatus=response.status;let received=0;const chunks=[];
    const onAbort=()=>{void reader.cancel().catch(()=>{});};options.signal.addEventListener('abort',onAbort,{once:true});
    try{for(;;){
      ensureActive(options.signal);let part;try{part=await reader.read();}catch{ensureActive(options.signal);stop('UPSTREAM_ERROR');}ensureActive(options.signal);if(part.done)break;
      const chunk=Buffer.from(part.value);chunks.push(chunk);received+=chunk.length;rawPending=Buffer.concat([rawPending,chunk]);
      const scan=secretScan(rawPending,env);if(scan!=='clear'){record.secretEchoWithheld=scan==='secret';record.secretScanUncertain=scan==='uncertain';record.rawComplete=false;stop(scan==='secret'?'SECRET_ECHO':'SECRET_SCAN_UNCERTAIN');}
      if(received>128*1024)stop('RESPONSE_TOO_LARGE');
    }
    ensureActive(options.signal);
    }finally{options.signal.removeEventListener('abort',onAbort);await reader.cancel().catch(()=>{});}
    const bytes=Buffer.concat(chunks);let data,parseFailed=false;try{data=json(bytes);}catch{parseFailed=true;}
    if(!parseFailed){const scan=secretScan(data,env);if(scan!=='clear'){record.secretEchoWithheld=scan==='secret';record.secretScanUncertain=scan==='uncertain';stop(scan==='secret'?'SECRET_ECHO':'SECRET_SCAN_UNCERTAIN');}}
    if(rawPending.length){const flush=rawPending;await persist(()=>{rawPending=Buffer.alloc(0);return io.appendRaw(rawName,flush);});}ensureActive(options.signal);
    record.rawBytes=bytes.length;record.rawSha256=digest(bytes);record.rawComplete=true;
    if(parseFailed)stop('RESPONSE_INVALID');
    record.usage=safeUsage(data);const choice=data?.choices?.[0];record.finishReason=['stop','length','content_filter','tool_calls'].includes(choice?.finish_reason)?choice.finish_reason:'unknown';
    if(!response.ok)return new Response(bytes,{status:response.status});
    if(!Array.isArray(data.choices)||data.choices.length!==1||choice.message?.tool_calls?.length||choice.message?.reasoning_content||record.usage.reasoningTokens>0)stop('RESPONSE_INVALID');
    return new Response(bytes,{status:response.status});
    }catch(error){transportError=error;throw error;}
  }});
  try{
    if(index)await sleep(protocol.minimumGapMs);
    const output=await service.run(action,input);if(requests!==1||!record.dispatched)stop('REQUEST_COUNT');
    const {provider,...normalized}=output;const normalizedScan=secretScan(normalized,env);if(normalizedScan!=='clear'){record.secretEchoWithheld=normalizedScan==='secret';record.secretScanUncertain=normalizedScan==='uncertain';stop(normalizedScan==='secret'?'SECRET_ECHO':'SECRET_SCAN_UNCERTAIN');}
    const assessed=assessStage(action,normalized,{trial,...(index?{text:revised.text,closeRead:indexGate}:{})});
    record.outputSha256=digest(normalized);record.assessment=assessed;
    await io.write(nameFor('completed',sequence),{sequence,stage,action,output:normalized,outputSha256:record.outputSha256,assessment:assessed});
    if(assessed.status!=='pass')stop('OBJECTIVE_OR_SEMANTIC_FAILURE');
    record.status=index===0?'awaiting_close_read':'passed';ledger.status=index===0?'awaiting_close_read':index===2?'complete_unaccepted':'awaiting_review';
  }catch(error){record.status='failed';record.error=safeCode(transportError||error);ledger.status='stopped';}
  finally{
    active=false;await writes.catch(()=>{});
    if(rawStarted&&rawPending.length&&!record.secretEchoWithheld&&!record.secretScanUncertain){
      const scan=secretScan(rawPending,env,{partial:true});
      if(scan==='clear'){const flush=rawPending;rawPending=Buffer.alloc(0);await io.appendRaw(rawName,flush);}
      else{record.secretEchoWithheld=scan==='secret';record.secretScanUncertain=scan==='uncertain';record.rawComplete=false;}
      rawPending=Buffer.alloc(0);
    }
    if(rawStarted){const bytes=await io.endRaw(rawName);if(bytes){record.rawBytes=bytes.length;record.rawSha256=digest(bytes);if(!record.rawComplete)record.rawComplete=false;}}
    record.elapsedMs=Math.max(0,now()-started);
    record.missingUsageFields=USAGE_KEYS.filter(key=>!Object.hasOwn(record.usage,key));ledger.usage=aggregateUsage(ledger.stages);
    await io.write(nameFor('ledger',sequence),ledger);
    const files=await io.files(),sha256={};for(const[name,bytes]of Object.entries(files))sha256[name]=digest(bytes);
    await io.write(nameFor('index',sequence),{protocol:protocol.id,sourceSha:env.GITHUB_SHA,stage,sha256});
  }
  return ledger;
}

async function apiGet(path,env,fetchImpl) {
  if(!env.GH_TOKEN)stop('HISTORY_INVALID');
  const response=await fetchImpl('https://api.github.com/repos/'+env.GITHUB_REPOSITORY+path,{method:'GET',redirect:'error',headers:{Accept:'application/vnd.github+json',Authorization:`Bearer ${env.GH_TOKEN}`,'X-GitHub-Api-Version':'2022-11-28'},signal:AbortSignal.timeout(30000)});
  if(!response.ok)stop('HISTORY_INVALID');return response.json();
}
export async function loadRunHistory(env,fetchImpl) {
  if(typeof fetchImpl!=='function'||fetchImpl===globalThis.fetch)stop('PROTOCOL_RETIRED');
  const runs=[];let total;
  for(let page=1;page<=100;page++){
    const data=await apiGet(`/actions/workflows/${WORKFLOW}/runs?per_page=100&page=${page}`,env,fetchImpl);
    if(!Number.isSafeInteger(data.total_count)||!Array.isArray(data.workflow_runs)||total!==undefined&&total!==data.total_count)stop('HISTORY_INVALID');
    total=data.total_count;runs.push(...data.workflow_runs);
    if(runs.length===total)return runs;
    if(runs.length>total||data.workflow_runs.length===0)stop('HISTORY_INVALID');
  }
  stop('HISTORY_INVALID');
}
/** Retirement gate precedes environment/credential access, history reads and transport. */
export async function main(){stop('PROTOCOL_RETIRED');}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{await main();}catch(error){console.error(JSON.stringify({status:'blocked',code:safeCode(error)}));process.exitCode=1;}}
