import {currentMaintenancePaths} from './eval-source-inventory.mjs';
/** Consumed and retired after one HTTP-400 attempt. Explicit fake replay only; no live CLI. */
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { segmentProse } from '../src/domain/prose.js';
import { validateInput } from '../server/provider.js';
import { secretScan, createDiskEvidence, aggregateUsage } from './run-author-revision-live.mjs';
export const ID='causal-continuity-v1';
export const WORKFLOW='causal-continuity-trial.yml';
export const ENDPOINT='https://opencode.ai/zen/go/v1/chat/completions';
export const FREEZE_SHA='5701b71bf86b7db9675095872606234b324a0e6e39930f6484000a45dff3fe73';
export const FROZEN_PATHS=Object.freeze(currentMaintenancePaths(['scripts/inspect-causal-transport.mjs','tests/causal-transport-compatibility.test.js','eval/CAUSAL-CONTINUITY-RESULTS.md','eval/history/causal-continuity-v1/dispatch-01.json','eval/history/causal-continuity-v1/index-01.json','eval/history/causal-continuity-v1/intent-01.json','eval/history/causal-continuity-v1/ledger-01.json','eval/history/causal-continuity-v1/outcome.json','eval/history/causal-continuity-v1/response-meta-01.json','eval/history/causal-continuity-v1/source-manifest.json','eval/history/causal-continuity-v1/source-protocol.md','eval/history/causal-continuity-v1/source-runner.mjs','eval/history/causal-continuity-v1/source-workflow.yml','eval/history/causal-continuity-v1/transport-compatibility.json','eval/history/causal-continuity-v1/artifact-index.json','scripts/run-causal-continuity.mjs','.github/workflows/causal-continuity-trial.yml','eval/CAUSAL-CONTINUITY-PROTOCOL.md','eval/causal-continuity-requests.json','tests/causal-continuity.test.js','scripts/run-author-revision-live.mjs','scripts/run-author-revision-eval.mjs','server/provider.js', 'server/provider-transport.js','src/domain/prose.js','eval/history/prose-pipeline-v1/inputs.json','eval/history/multichapter-v1/request-05.json','eval/writing-quality-fixtures.mjs']));
export const DIMENSIONS=['new_scene_change','physical_prerequisites_custody','temporal_causal_sequence','motivation_obligation','knowledge_pov_attribution','voice_economy_agency','delivery_contract'];
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export const digest=x=>createHash('sha256').update(typeof x==='string'||Buffer.isBuffer(x)?x:JSON.stringify(x)).digest('hex');
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const fail=code=>{throw Object.assign(Error(code),{code});};
const SAFE=new Set(['APPROVAL_REQUIRED','CONFIG_INVALID','HISTORY_INVALID','STAGE_CONSUMED','CI_REQUIRED','FREEZE_INVALID','PRIOR_INVALID','GATE_FAILED','PERSISTENCE_FAILED','UPSTREAM_ERROR','UPSTREAM_TIMEOUT','RESPONSE_INVALID','RESPONSE_TOO_LARGE','SECRET_ECHO','OUTPUT_TRUNCATED','DELIVERY_FAILED','REFUSAL','HIDDEN_REASONING','NOT_CONFIGURED','RETIRED']);
const code=e=>SAFE.has(e?.code)?e.code:'PERSISTENCE_FAILED';
const name=(prefix,n,ext='json')=>`${prefix}-${String(n).padStart(2,'0')}.${ext}`;
const parse=x=>JSON.parse(Buffer.from(x).toString('utf8'));
const object=x=>x&&typeof x==='object'&&!Array.isArray(x);
const nonempty=x=>typeof x==='string'&&!!x.trim();
export const runName=n=>`${ID}/call-${n}`;
export function scan(value,env){
 const text=Buffer.isBuffer(value)?value.toString('utf8'):typeof value==='string'?value:JSON.stringify(value);
 if(secretScan(text,env)!=='clear')return false;
 for(const secret of [env.NEXUS_API_KEY,env.GH_TOKEN].filter(nonempty)){
  const variants=[Buffer.from(secret).toString('base64'),Buffer.from(secret).toString('base64url'),Buffer.from(secret).toString('hex'),encodeURIComponent(secret)];
  if(variants.some(x=>text.includes(x)))return false;
 }
 return true;
}
export function approved(env,n){
 if(env.NEXUS_CAUSAL_APPROVED!=='true'||env.NEXUS_OVERAGE_CONFIRMED_OFF!=='true')fail('APPROVAL_REQUIRED');
 if(env.GITHUB_ACTIONS!=='true'||env.GITHUB_RUN_ATTEMPT!=='1'||!Number.isInteger(n)||n<1||n>6||!/^[a-f0-9]{40}$/.test(env.GITHUB_SHA||'')||!/^\d+$/.test(env.GITHUB_RUN_ID||'')||!/^\d+$/.test(env.NEXUS_CI_RUN_ID||'')||env.GITHUB_REPOSITORY!=='logan-suu/NexusScribe')fail('CONFIG_INVALID');
}
export function validateFreeze(bytes){
 if(digest(bytes)!==FREEZE_SHA)fail('FREEZE_INVALID');
 const f=parse(bytes);if(f.requests.length!==6)fail('FREEZE_INVALID');
 const order=[['F1-replay','A'],['F1-replay','B'],['F2-physical-transition','B'],['F2-physical-transition','A'],['F3-unused-domain-transfer','A'],['F3-unused-domain-transfer','B']];
 f.requests.forEach((r,i)=>{
  const b=r.body;if(r.sequence!==i+1||!same([r.fixture,r.arm],order[i])||digest(b)!==r.bodySha256||b.model!=='deepseek-v4.1-flash'||b.max_tokens!==3000||b.temperature!==0.7||!same(b.thinking,{type:'disabled'})||!same(Object.keys(b),['model','max_tokens','thinking','temperature','messages']))fail('FREEZE_INVALID');
  const wire=JSON.parse(b.messages[1].content);if(wire.action!=='generateProse')fail('FREEZE_INVALID');validateInput(wire.action,wire.input);
 });
 for(let i=0;i<6;i+=2){const pair=f.requests.slice(i,i+2),a=pair.find(x=>x.arm==='A').body,b=pair.find(x=>x.arm==='B').body;if(a.messages[1].content!==b.messages[1].content||b.messages[0].content!==a.messages[0].content+'\n'+f.causalInstruction)fail('FREEZE_INVALID');}
 return f;
}
export async function loadFrozen(root=ROOT){
 const m=parse(await readFile(resolve(root,'eval/causal-continuity-manifest.json')));
 if(m.protocol!==ID||m.status!=='retired_consumed_offline_replay'||m.stop!=='any_arm_failure_or_uncertain'||m.maxAttempts!==6||m.maxOutputTokens!==18000)fail('FREEZE_INVALID');
 if(!object(m.sha256)||!same(Object.keys(m.sha256).sort(),[...FROZEN_PATHS].sort()))fail('FREEZE_INVALID');
 for(const [p,h]of Object.entries(m.sha256)){if(p.includes('..')||digest(await readFile(resolve(root,p)))!==h)fail('FREEZE_INVALID');}
 return {freeze:validateFreeze(await readFile(resolve(root,'eval/causal-continuity-requests.json'))),manifest:m};
}
export function history({env,n,runs,ci,prior}){
 approved(env,n);
 if(!Array.isArray(runs)||runs.length!==n||new Set(runs.map(r=>r.id)).size!==n)fail('STAGE_CONSUMED');
 if(String(ci?.id)!==env.NEXUS_CI_RUN_ID||ci.path!=='.github/workflows/ci.yml'||ci.head_sha!==env.GITHUB_SHA||ci.status!=='completed'||ci.conclusion!=='success')fail('CI_REQUIRED');
 for(let i=1;i<=n;i++){
  const matches=runs.filter(r=>r.display_title===runName(i));if(matches.length!==1)fail('STAGE_CONSUMED');const r=matches[0];
  if(r.run_attempt!==1||r.head_sha!==env.GITHUB_SHA||r.event!=='workflow_dispatch'||r.path!=='.github/workflows/'+WORKFLOW)fail('HISTORY_INVALID');
  if(i===n){if(String(r.id)!==env.GITHUB_RUN_ID||!['queued','in_progress','waiting','pending'].includes(r.status))fail('STAGE_CONSUMED');}
  else if(r.status!=='completed'||r.conclusion!=='success'||String(r.id)!==prior?.stages?.[i-1]?.runId)fail('PRIOR_INVALID');
 }
}
export function stats(text,r){
 const han=(text.match(/\p{Script=Han}/gu)||[]).length,paragraphs=segmentProse(text).length;
 return {han,paragraphs,pass:han>=r.targetHan[0]&&han<=r.targetHan[1]&&paragraphs>=r.targetParagraphs[0]&&paragraphs<=r.targetParagraphs[1]};
}
export function validateGate(g,text,sourceHash){
 return object(g)&&g.protocol===ID&&g.locked===true&&g.masked===true&&g.fullCandidateRead===true&&g.status==='pass'&&g.textSha256===digest(text)&&g.storyInputSha256===sourceHash&&nonempty(g.reviewer)&&Array.isArray(g.items)&&same(g.items.map(x=>x.id),DIMENSIONS)&&g.items.every(x=>x.status==='acceptable'&&nonempty(x.explanation)&&Array.isArray(x.evidence)&&x.evidence.length>0&&x.evidence.every(e=>nonempty(e.quote)&&Number.isInteger(e.start)&&Number.isInteger(e.end)&&e.start>=0&&e.end>e.start&&text.slice(e.start,e.end)===e.quote));
}
export function verifyPrior(files,n,env,trial,gates){
 if(n===1){if(Object.keys(files).length||gates!==null||env.NEXUS_PRIOR_RUN_ID)fail('PRIOR_INVALID');return null;}
 try{
  const inv=parse(files[name('index',n-1)]);if(inv.protocol!==ID||inv.sourceSha!==env.GITHUB_SHA||inv.sequence!==n-1||!same(Object.keys(files).sort(),[...Object.keys(inv.sha256),name('index',n-1)].sort()))fail('PRIOR_INVALID');
  for(const [p,h]of Object.entries(inv.sha256))if(!/^[a-z][a-z0-9-]*\.(json|bin)$/.test(p)||digest(Buffer.from(files[p]))!==h)fail('PRIOR_INVALID');
  const ledger=parse(files[name('ledger',n-1)]);
  if(ledger.protocol!==ID||ledger.sourceSha!==env.GITHUB_SHA||ledger.manifestSha256!==digest(trial.manifest)||ledger.ciRunId!==env.NEXUS_CI_RUN_ID||ledger.attempts!==n-1||ledger.status!=='awaiting_masked_read'||ledger.stages.length!==n-1||ledger.stages.at(-1).runId!==env.NEXUS_PRIOR_RUN_ID)fail('PRIOR_INVALID');
  for(let i=1;i<n;i++){
   const r=trial.freeze.requests[i-1],entry=ledger.stages[i-1],out=parse(files[name('completed',i)]);
   if(entry.sequence!==i||entry.dispatched!==true||entry.status!=='awaiting_masked_read'||entry.requestSha256!==r.bodySha256||entry.outputSha256!==digest(out.text)||!stats(out.text,r).pass)fail('PRIOR_INVALID');
   const g=i===n-1?gates?.individual:parse(files[name('gate',i)]).individual;
   if(!validateGate(g,out.text,digest(r.body.messages[1].content)))fail('GATE_FAILED');
  }
  for(let last=2;last<n;last+=2){const p=last===n-1?gates?.pairwise:parse(files[name('gate',last)]).pairwise,a=parse(files[name('completed',last-1)]).text,b=parse(files[name('completed',last)]).text;if(!validatePair(p,a,b))fail('GATE_FAILED');}
  return ledger;
 }catch(e){if(['GATE_FAILED','PRIOR_INVALID'].includes(e.code))throw e;fail('PRIOR_INVALID');}
}
export function validatePair(p,a,b){
 const texts=new Map([[digest(a),a],[digest(b),b]]);
 return object(p)&&p.locked===true&&p.masked===true&&p.status==='pass'&&Array.isArray(p.outputSha256)&&same([...p.outputSha256].sort(),[digest(a),digest(b)].sort())&&['first','second','neither'].includes(p.preferred)&&['first','second','neither'].includes(p.causalImprovement)&&nonempty(p.explanation)&&p.materialVoiceRegression===false&&p.checklistPadding===false&&Array.isArray(p.evidence)&&p.evidence.length>=2&&[digest(a),digest(b)].every(h=>p.evidence.some(e=>e.textSha256===h))&&p.evidence.every(e=>texts.has(e.textSha256)&&nonempty(e.quote)&&Number.isInteger(e.start)&&Number.isInteger(e.end)&&e.start>=0&&e.end>e.start&&texts.get(e.textSha256).slice(e.start,e.end)===e.quote);
}
export function finalizeTrial({files,env,trial,gates}){
 const ledger=verifyPrior(files,7,env,trial,gates);return {protocol:ID,sourceSha:ledger.sourceSha,attempts:ledger.attempts,status:'six_calls_read_locked_not_adopted',finalGates:gates,finalGatesSha256:digest(gates),evidenceIndexSha256:digest(files['index-06.json'])};
}
const safeUsage=d=>Object.fromEntries(Object.entries({promptTokens:d?.usage?.prompt_tokens,completionTokens:d?.usage?.completion_tokens,totalTokens:d?.usage?.total_tokens,reasoningTokens:d?.usage?.completion_tokens_details?.reasoning_tokens}).filter(([,v])=>Number.isSafeInteger(v)&&v>=0));
/** One and only one transport call. Per-call output awaits a separate locked reading. */
export async function runOne({n,env,trial,runs,ci,priorFiles={},gates=null,io,fetchImpl,sleep=ms=>new Promise(r=>setTimeout(r,ms)),timeoutMs=120000,offlineReplay=false}){
 if(offlineReplay!==true||typeof fetchImpl!=='function'||fetchImpl===globalThis.fetch)fail('RETIRED');
 const prior=verifyPrior(priorFiles,n,env,trial,gates);history({env,n,runs,ci,prior});
 if(!nonempty(env.NEXUS_API_KEY)||/[\r\n]/.test(env.NEXUS_API_KEY)||env.NEXUS_API_KEY.length>4096)fail('NOT_CONFIGURED');
 for(const [p,b]of Object.entries(priorFiles)){if(!scan(b,env))fail('SECRET_ECHO');await io.write(p,Buffer.from(b));}
 if(n>1){if(!scan(gates,env))fail('SECRET_ECHO');await io.write(name('gate',n-1),gates);await sleep(11000);}
 const request=trial.freeze.requests[n-1],body=JSON.stringify(request.body),entry={sequence:n,runId:env.GITHUB_RUN_ID,dispatched:false,status:'prepared',usage:{},requestSha256:digest(body)};
 const ledger={protocol:ID,sourceSha:env.GITHUB_SHA,manifestSha256:digest(trial.manifest),ciRunId:env.NEXUS_CI_RUN_ID,status:'prepared',attempts:n-1,stages:[...(prior?.stages||[]),entry]};
 await io.write(name('intent',n),{protocol:ID,sequence:n,sourceSha:env.GITHUB_SHA,runId:env.GITHUB_RUN_ID,endpoint:ENDPOINT,body,bodySha256:digest(body),priorAttempts:n-1});
 const controller=new AbortController();let timer,reader,received=0,active=true,writes=Promise.resolve();const began=Date.now();
 const persist=(p,v)=>{const pending=writes.then(()=>{if(!active||controller.signal.aborted)fail('UPSTREAM_TIMEOUT');return io.write(p,v);});writes=pending;return pending;};
 try{
  await io.write(name('dispatch',n),{protocol:ID,sequence:n,runId:env.GITHUB_RUN_ID,requestSha256:digest(body),attemptedOrUncertain:true,cumulativeAttempts:n});
  entry.dispatched=true;entry.status='attempted';ledger.attempts=n;
  const operation=(async()=>{
   let response;try{response=await fetchImpl(ENDPOINT,{method:'POST',redirect:'error',headers:{'Content-Type':'application/json',Authorization:`Bearer ${env.NEXUS_API_KEY}`},body,signal:controller.signal});}catch{fail(controller.signal.aborted?'UPSTREAM_TIMEOUT':'UPSTREAM_ERROR');}
   if(controller.signal.aborted)fail('UPSTREAM_TIMEOUT');entry.httpStatus=response.status;reader=response.body?.getReader();if(!reader)fail('RESPONSE_INVALID');const chunks=[];
   for(;;){let part;try{part=await reader.read();}catch{fail('UPSTREAM_ERROR');}if(controller.signal.aborted)fail('UPSTREAM_TIMEOUT');if(part.done)break;received+=part.value.length;if(received>128*1024)fail('RESPONSE_TOO_LARGE');chunks.push(Buffer.from(part.value));}
   const bytes=Buffer.concat(chunks);if(!scan(bytes,env))fail('SECRET_ECHO');let data;try{data=parse(bytes);}catch{fail('RESPONSE_INVALID');}if(!scan(data,env))fail('SECRET_ECHO');
   entry.usage=safeUsage(data);const choice=data?.choices?.[0];entry.finishReason=['stop','length','content_filter','tool_calls'].includes(choice?.finish_reason)?choice.finish_reason:'unknown';
   // Never persist raw envelopes: unknown fields and hidden reasoning stay in memory only.
   const hasReasoning=entry.usage.reasoningTokens>0||data?.choices?.some(c=>Object.entries(c.message||{}).some(([k,v])=>/reason|thinking/i.test(k)&&v!==null&&v!==''&&v!==undefined));
   if(hasReasoning)fail('HIDDEN_REASONING');
   await persist(name('response-meta',n),{httpStatus:response.status,finishReason:entry.finishReason,usage:entry.usage,receivedBytes:received});
   if(entry.usage.completionTokens>3000)fail('RESPONSE_INVALID');
   if(!response.ok)fail('UPSTREAM_ERROR');if(data.error||!Array.isArray(data.choices)||data.choices.length!==1||!object(choice.message)||choice.message.role!==undefined&&choice.message.role!=='assistant'||choice.message.function_call!=null||choice.message.tool_calls!=null&&(!Array.isArray(choice.message.tool_calls)||choice.message.tool_calls.length>0))fail('RESPONSE_INVALID');
   if(choice.message.refusal||entry.finishReason==='content_filter')fail('REFUSAL');
   const text=choice.message.content;if(typeof text!=='string')fail('RESPONSE_INVALID');
   if(/<think(?:ing)?>/i.test(text))fail('HIDDEN_REASONING');
   await persist(name('raw-prose',n,'bin'),Buffer.from(text,'utf8'));entry.outputSha256=digest(text);
   const counts=stats(text,request);await persist(name('completed',n),{text,textSha256:digest(text),counts});entry.counts=counts;
   if(entry.finishReason!=='stop')fail('OUTPUT_TRUNCATED');if(!text.trim()||text.length>30000||/^\s*(?:```|~~~|\{|\[)/.test(text))fail('RESPONSE_INVALID');
   if(!counts.pass)fail('DELIVERY_FAILED');
  })();
  await Promise.race([operation,new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();void reader?.cancel().catch(()=>{});reject(Object.assign(Error('UPSTREAM_TIMEOUT'),{code:'UPSTREAM_TIMEOUT'}));},timeoutMs);})]);
  entry.status='awaiting_masked_read';ledger.status='awaiting_masked_read';
 }catch(e){entry.status='failed';entry.error=code(e);ledger.status='stopped';}
 finally{
  active=false;clearTimeout(timer);controller.abort();void reader?.cancel().catch(()=>{});await writes.catch(()=>{});
  entry.receivedBytes=received;entry.elapsedMs=Date.now()-began;ledger.usage=aggregateUsage(ledger.stages);
  await io.write(name('ledger',n),ledger);const files=await io.files();await io.write(name('index',n),{protocol:ID,sourceSha:env.GITHUB_SHA,sequence:n,sha256:Object.fromEntries(Object.entries(files).map(([p,b])=>[p,digest(b)]))});
 }
 return ledger;
}
/** Retirement precedes all environment/credential access, history reads and transport. */
export async function main(){fail('RETIRED');}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{await main();}catch(e){console.error(JSON.stringify({status:'blocked',code:code(e)}));process.exitCode=1;}}
