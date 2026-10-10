/** Separately approved four-call, one-case experiment. Not a product entrypoint. */
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {buildProviderRequest,readProviderError} from '../server/provider-transport.ts';
import {secretEcho,explicitRefusal} from './run-causal-quality-20261007.mjs';
export const ID='scene-workflows-20261010';
export const BRANCH='feat/scene-workflows-20261010';
export const ENDPOINT='https://opencode.ai/zen/go/v1/chat/completions';
const DIR='eval/'+ID,OUT='artifacts/'+ID;
export const hash=x=>createHash('sha256').update(typeof x==='string'||Buffer.isBuffer(x)?x:JSON.stringify(x)).digest('hex');
const fail=code=>{throw Object.assign(Error(code),{code});};
const json=async p=>JSON.parse(await readFile(p,'utf8'));
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const save=async(n,v)=>{await mkdir(OUT,{recursive:true});await writeFile(OUT+'/'+n,JSON.stringify(v,null,2)+'\n',{flag:'wx',mode:0o600});};
export function bodyFor(f,stage,prior,feedback){
 if(![1,2,3,4].includes(stage)||f.protocol!==ID||f.maxAttempts!==4||!same(f.maxOutputTokens,[3000,3000,800,3000])||f.totalMaxOutputTokens!==9800||!same(f.settings,{model:'deepseek-v4.1-flash',temperature:0.7,thinking:{type:'disabled'}})||f.fixture.sceneIntent.exitState.status!=='missing'||f.fixture.sceneIntent.exitState.value!==null)fail('FREEZE_INVALID');
 let system=f.system,content=f.generationContent;
 if(stage===2){if(!prior[0]?.text||typeof feedback?.instruction!=='string'||!feedback.instruction.trim()||feedback.instruction.length>2500||!Array.isArray(feedback.items)||feedback.items.length>6||feedback.baselineSha256!==hash(prior[0].text))fail('DEPENDENCY_INVALID');system=f.revisionSystem;content=JSON.stringify({originalInput:f.providerInput,baseline:prior[0].text,editorialFeedback:feedback});}
 if(stage===3){system=f.planSystem;content=f.generationContent;}
 if(stage===4){if(!prior[2]?.text)fail('DEPENDENCY_INVALID');system=f.plannedSystem;content=JSON.stringify({originalInput:f.providerInput,scenePlan:prior[2].text});}
 return {...f.settings,max_tokens:f.maxOutputTokens[stage-1],messages:[{role:'system',content:system},{role:'user',content}]};
}
export function gates(env,stage,runs,ciRuns){
 if(env.GITHUB_ACTIONS!=='true'||env.GITHUB_EVENT_NAME!=='workflow_dispatch'||env.GITHUB_REPOSITORY!=='logan-suu/NexusScribe'||env.GITHUB_REF!=='refs/heads/'+BRANCH||env.GITHUB_RUN_ATTEMPT!=='1'||env.NEXUS_APPROVED!==ID||env.NEXUS_OVERAGE_CONFIRMED_OFF!=='true'||!/^\d+$/.test(env.GITHUB_RUN_ID||'')||!/^[a-f0-9]{40}$/.test(env.GITHUB_SHA||''))fail('APPROVAL_REQUIRED');
 if(![1,2,3,4].includes(stage))fail('RETIRED');
 const trials=runs.filter(r=>r.display_title?.startsWith(ID+'-stage-'));
 if(trials.length!==stage)fail('STAGE_CONSUMED');
 for(let n=1;n<=stage;n++){const matching=trials.filter(r=>r.display_title===ID+'-stage-'+n);if(matching.length!==1)fail('STAGE_CONSUMED');const r=matching[0];if(r.path!=='.github/workflows/ci.yml'||r.head_branch!==BRANCH||r.event!=='workflow_dispatch'||r.run_attempt!==1)fail('HISTORY_INVALID');if(n===stage){if(String(r.id)!==env.GITHUB_RUN_ID||r.head_sha!==env.GITHUB_SHA||!['queued','in_progress'].includes(r.status))fail('HISTORY_INVALID');}else if(r.status!=='completed'||r.conclusion!=='success')fail('PREVIOUS_FAILURE');}
 if(!ciRuns.some(r=>r.path==='.github/workflows/ci.yml'&&r.event==='pull_request'&&r.head_sha===env.GITHUB_SHA&&r.head_branch===BRANCH&&r.status==='completed'&&r.conclusion==='success'))fail('CI_REQUIRED');
}
async function api(path,env){const r=await fetch('https://api.github.com/repos/logan-suu/NexusScribe/'+path,{headers:{Authorization:'Bearer '+env.GH_TOKEN,Accept:'application/vnd.github+json'},redirect:'error',signal:AbortSignal.timeout(20000)});if(!r.ok)fail('HISTORY_UNAVAILABLE');return r.json();}
async function runs(env){const all=[];for(let page=1;page<=20;page++){const x=await api('actions/workflows/ci.yml/runs?branch='+encodeURIComponent(BRANCH)+'&per_page=100&page='+page,env);if(!Array.isArray(x.workflow_runs))fail('HISTORY_UNAVAILABLE');all.push(...x.workflow_runs);if(x.workflow_runs.length<100)return all;}fail('HISTORY_UNAVAILABLE');}
async function load(){const manifest=await json(DIR+'/manifest.json');for(const[p,h]of Object.entries(manifest.sha256))if(hash(await readFile(p))!==h)fail('FREEZE_INVALID');const f=await json(DIR+'/freeze.json'),s=await json(DIR+'/stage.json');if(s.status!=='authorized_single_attempt')fail('RETIRED');const prior=[];for(let n=1;n<s.stage;n++){const item=await json(DIR+'/completed-'+n+'.json');if(item.status!=='complete'||item.stage!==n||item.protocol!==ID||item.textSha256!==hash(item.text)||item.freezeSha256!==hash(await readFile(DIR+'/freeze.json'))||!/^[a-f0-9]{64}$/.test(item.bodySha256||'')||s.prior[n-1]?.sha256!==hash(await readFile(DIR+'/completed-'+n+'.json')))fail('DEPENDENCY_INVALID');prior.push(item);}const feedback=s.stage>=2?await json(DIR+'/feedback.json'):null;return{f,s,prior,feedback,manifest};}
export async function one(body,key,fetchImpl,timeoutMs=120000){
 if(typeof fetchImpl!=='function'||fetchImpl===globalThis.fetch)fail('RETIRED');
 const controller=new AbortController();let reader,timer,active=true;const guard=()=>{if(!active||controller.signal.aborted)fail('UPSTREAM_TIMEOUT');};const began=Date.now();const result={status:'stopped',cost:'unknown'};
 try{const work=(async()=>{const req=buildProviderRequest({endpoint:ENDPOINT,key,body:JSON.stringify(body),signal:controller.signal});const r=await fetchImpl(req.url,req.options);guard();result.httpStatus=r.status;if(!r.ok){const diagnostics=await readProviderError(r,{signal:controller.signal});guard();result.diagnostics=diagnostics;fail('UPSTREAM_ERROR');}reader=r.body?.getReader();if(!reader)fail('RESPONSE_INVALID');let size=0;const chunks=[];for(;;){const p=await reader.read();guard();if(p.done)break;size+=p.value.byteLength;if(size>131072)fail('RESPONSE_TOO_LARGE');chunks.push(Buffer.from(p.value));}const bytes=Buffer.concat(chunks);if(secretEcho(bytes,[key]))fail('SECRET_ECHO');let d;try{d=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{fail('RESPONSE_INVALID');}if(secretEcho(d,[key]))fail('SECRET_ECHO');const pending=[d];while(pending.length){const v=pending.pop();if(v&&typeof v==='object')for(const[k,x]of Object.entries(v)){if(k!=='finish_reason'&&/reason|thinking/i.test(k)&&x!==null&&x!==''&&x!==undefined&&x!==0)fail('HIDDEN_REASONING');if(x&&typeof x==='object')pending.push(x);}}
 if(d.error||!Array.isArray(d.choices)||d.choices.length!==1)fail('RESPONSE_INVALID');const c=d.choices[0],m=c.message;if(!m||m.refusal||c.finish_reason==='content_filter')fail('REFUSAL');if(m.role!=='assistant'||m.function_call!=null||(m.tool_calls!=null&&(!Array.isArray(m.tool_calls)||m.tool_calls.length)))fail('RESPONSE_INVALID');if(typeof m.content!=='string'||!m.content.trim()||!m.content.isWellFormed()||m.content.length>30000)fail('RESPONSE_INVALID');if(explicitRefusal(m.content))fail('REFUSAL');if(/<\/?(?:think(?:ing)?|analysis|reasoning)(?:\s[^>]*)?>/i.test(m.content))fail('HIDDEN_REASONING');
 const u=d.usage;const usage={promptTokens:u?.prompt_tokens,completionTokens:u?.completion_tokens,totalTokens:u?.total_tokens,reasoningTokens:u?.completion_tokens_details?.reasoning_tokens};result.text=m.content;result.textSha256=hash(m.content);result.finishReason=c.finish_reason==='stop'?'stop':'non_stop';result.usage=usage;
 if(!Object.values(usage).every(x=>Number.isSafeInteger(x)&&x>=0)||usage.reasoningTokens!==0||usage.completionTokens>body.max_tokens||usage.totalTokens!==usage.promptTokens+usage.completionTokens)fail('BUDGET_UNCERTAIN');if(c.finish_reason!=='stop')fail('OUTPUT_TRUNCATED');result.status='complete';})();await Promise.race([work,new Promise((_,reject)=>{timer=setTimeout(()=>{active=false;controller.abort();reject(Object.assign(Error('UPSTREAM_TIMEOUT'),{code:'UPSTREAM_TIMEOUT'}));},Math.min(timeoutMs,120000));})]);}
 catch(e){result.error=['UPSTREAM_ERROR','UPSTREAM_TIMEOUT','RESPONSE_TOO_LARGE','RESPONSE_INVALID','SECRET_ECHO','HIDDEN_REASONING','REFUSAL','BUDGET_UNCERTAIN','OUTPUT_TRUNCATED'].includes(e.code)?e.code:'UPSTREAM_ERROR';result.status='stopped';}
 finally{active=false;clearTimeout(timer);controller.abort();try{Promise.resolve(reader?.cancel()).catch(()=>{});}catch{}result.elapsedMs=Date.now()-began;}
 return structuredClone(result);
}
async function main(mode,env=process.env){
 fail('RETIRED'); // All four approved attempts completed. No retry, resume, or new budget.
 const x=await load();const rr=await runs(env);gates(env,x.s.stage,rr,rr);for(const p of x.prior){const old=rr.find(r=>r.display_title===ID+'-stage-'+p.stage);if(!old||String(old.id)!==p.runId||old.head_sha!==p.sourceSha)fail('DEPENDENCY_INVALID');}const body=bodyFor(x.f,x.s.stage,x.prior,x.feedback);const reservation={protocol:ID,stage:x.s.stage,runId:env.GITHUB_RUN_ID,sourceSha:env.GITHUB_SHA,body,bodySha256:hash(body),freezeSha256:hash(await readFile(DIR+'/freeze.json')),mapping:x.f.mapping,maxAttempts:4,attemptedOrUncertain:true,cumulativeMaxOutputTokens:x.f.maxOutputTokens.slice(0,x.s.stage).reduce((a,b)=>a+b,0),balanceEvidence:'User confirmed Use balance OFF; no refreshed console verification',prior:x.s.prior};
 if(mode==='prepare'){await save('reservation.json',reservation);return;}
 if(mode!=='execute')fail('CONFIG_INVALID');const saved=await json(OUT+'/reservation.json');if(!same(saved,reservation)||hash(await readFile(OUT+'/reservation.json'))!==env.NEXUS_RESERVATION_SHA256)fail('PERSISTENCE_FAILED');if(!/^\d+$/.test(env.NEXUS_ARTIFACT_ID||''))fail('PERSISTENCE_FAILED');const a=await api('actions/artifacts/'+env.NEXUS_ARTIFACT_ID,env);if(a.name!==ID+'-reservation-'+x.s.stage||a.expired!==false||String(a.workflow_run?.id)!==env.GITHUB_RUN_ID||a.workflow_run?.head_sha!==env.GITHUB_SHA||a.size_in_bytes<=0)fail('PERSISTENCE_FAILED');
 const key=env.NEXUS_API_KEY;if(typeof key!=='string'||!key.trim()||key.length>4096||/[\r\n]/.test(key))fail('NOT_CONFIGURED');
 await save('dispatch.json',{protocol:ID,stage:x.s.stage,runId:env.GITHUB_RUN_ID,bodySha256:hash(body),attemptedOrUncertain:true});
 const result={protocol:ID,stage:x.s.stage,runId:env.GITHUB_RUN_ID,sourceSha:env.GITHUB_SHA,freezeSha256:reservation.freezeSha256,bodySha256:reservation.bodySha256,...await one(body,key)};
 await save('completed.json',result);console.log(JSON.stringify({stage:x.s.stage,status:result.status,usage:result.usage,cost:result.cost,error:result.error}));if(result.status!=='complete')process.exitCode=1;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)main(process.argv[2]).catch(e=>{console.error(JSON.stringify({status:'blocked',code:['APPROVAL_REQUIRED','RETIRED','STAGE_CONSUMED','HISTORY_INVALID','CI_REQUIRED','HISTORY_UNAVAILABLE','FREEZE_INVALID','DEPENDENCY_INVALID','PERSISTENCE_FAILED','NOT_CONFIGURED','PREVIOUS_FAILURE'].includes(e.code)?e.code:'CONFIG_INVALID'}));process.exitCode=1;});
