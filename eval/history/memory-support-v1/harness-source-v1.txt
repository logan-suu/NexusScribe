/** One opt-in, bounded audit of synthetic labels. Never commits model judgments. */
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {mkdir,writeFile,rename} from 'node:fs/promises';
import {performance} from 'node:perf_hooks';
import {createAgentService,SAFE_VALIDATION_REASONS,validateOutput} from '../server/provider.js';
import {buildSupportFixtures} from '../eval/memory-support-fixtures.mjs';
import {safeUsage,aggregateUsage} from './prose-pipeline-eval.mjs';
export const protocol=Object.freeze({id:'memory-support-v1',version:1,model:'deepseek-v4.1-flash',maxCalls:4,maxTokens:3000,temperature:0.7,thinking:'disabled',minimumGapMs:11000,action:'reviewChapter'});
export const ARTIFACT_NAMES=Object.freeze(['inputs.json','diagnostics.json',...Array.from({length:4},(_,i)=>`completed-0${i+1}.json`)]);
const digest=text=>createHash('sha256').update(text).digest('hex');
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const codes=new Set(['NOT_CONFIGURED','INVALID_INPUT','INVALID_MODEL_OUTPUT','UPSTREAM_ERROR','UPSTREAM_TIMEOUT','OUTPUT_TRUNCATED','CALL_LIMIT','RATE_LIMIT','CONCURRENT_LIMIT','REQUEST_CANCELLED','AUDIT_PROTOCOL_ERROR']);
const reasons=new Set(['REQUEST_LIMIT','REQUEST_SETTINGS','REQUEST_COUNT','RESPONSE_SIZE','RESPONSE_BODY','RESPONSE_ENVELOPE','FIXTURE_SET']);
const fail=reason=>{throw Object.assign(Error('Support audit protocol rejected'),{code:'AUDIT_PROTOCOL_ERROR',validationReason:reason});};
const safeError=e=>({code:codes.has(e?.code)?e.code:'AUDIT_STOPPED',...((SAFE_VALIDATION_REASONS.includes(e?.validationReason)||reasons.has(e?.validationReason))?{validationReason:e.validationReason}:{})});
export function approvedConfig(env){
 if(env.NEXUS_MEMORY_SUPPORT_APPROVED!=='true'||env.NEXUS_LIVE_ENABLED!=='true'||env.NEXUS_OVERAGE_CONFIRMED_OFF!=='true')throw Error('APPROVAL_REQUIRED');
 if(env.GITHUB_ACTIONS!=='true'||env.GITHUB_RUN_ATTEMPT!=='1')throw Error('FIRST_ACTIONS_ATTEMPT_REQUIRED');
 return {...env,NEXUS_API_BASE_URL:'https://opencode.ai/zen/go/v1',NEXUS_API_MODEL:protocol.model,NEXUS_THINKING_MODE:'disabled',NEXUS_REASONING_EFFORT:undefined,NEXUS_MAX_CALLS:'4',NEXUS_MAX_OUTPUT_TOKENS:'3000'};
}
export function assessOutput(fixture,output){
 return fixture.input.memoryCandidates.map((candidate,index)=>{
  const check=output.memoryChecks?.find(check=>check.candidateId===candidate.candidateId),expected=fixture.expected[index];
  return {candidateId:candidate.candidateId,expected,status:check?.status??'unknown',missing:!check,explanation:check?.explanation??'No model assessment returned',matched:Boolean(check&&(expected==='supported'?check.status==='supported':check.status!=='supported'))};
 });
}
async function captureResponse(response,record){
 record.httpStatus=Number.isInteger(response.status)?response.status:null;
 const reader=response.body?.getReader();if(!reader){if(!response.ok)return response;fail('RESPONSE_BODY');}
 const chunks=[];let size=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>128*1024)fail('RESPONSE_SIZE');chunks.push(value);}}finally{await reader.cancel().catch(()=>{});}
 const bytes=Buffer.concat(chunks);record.responseBytes=size;
 let data;try{data=JSON.parse(bytes.toString('utf8'));}catch{record.finishReason='unknown';}
 if(data){record.usage=safeUsage(data);const choice=data?.choices?.[0],finish=choice?.finish_reason;record.finishReason=['stop','length','content_filter','tool_calls'].includes(finish)?finish:'unknown';record.finalContentPresent=typeof choice?.message?.content==='string'&&!!choice.message.content.trim();
  // Length is handled by the service's dedicated truncation error; all other
  // incomplete/refusal/error envelopes stop this audit even with valid JSON.
  if(response.ok&&(data.error||choice?.message?.refusal||!['stop','length'].includes(finish))) {const error=Object.assign(Error('Invalid response envelope'),{code:'AUDIT_PROTOCOL_ERROR',validationReason:'RESPONSE_ENVELOPE'});error.auditDiagnostics=record;throw error;}
 }
 return new Response(bytes,{status:response.status});
}
export async function runMemorySupportEval({env=process.env,fetchImpl=globalThis.fetch,sleep=wait,now=()=>performance.now(),serviceFactory=createAgentService,save=async()=>{},log=console.log}={}){
 const config=approvedConfig(env),fixtures=buildSupportFixtures();
 if(fixtures.length!==protocol.maxCalls)fail('FIXTURE_SET');
 const started=now(),calls=[],completed=[];let current=null,attempts=0,terminal=false,writes=Promise.resolve(),revision=0;
 const elapsed=start=>Math.max(0,now()-start);
 const diagnostics=(status,error)=>({protocol,status,attempts,completed:completed.length,requestsPrepared:calls.length,attemptAccountingComplete:status!=='running',
  uncertainDispatches:status==='running'?calls.filter(x=>x.status==='prepared'||x.status==='attempted').length:0,
  accountingNote:'A running prepared checkpoint may already have dispatched. Hard interruption leaves these requests uncertain, never free or confirmed zero. Final attempts are only asserted in complete/stopped records.',
  ...(typeof env.GITHUB_SHA==='string'&&/^[a-f\d]{40}$/i.test(env.GITHUB_SHA)?{sourceCommit:env.GITHUB_SHA}:{}),
  ...(typeof env.GITHUB_RUN_ID==='string'&&/^\d+$/.test(env.GITHUB_RUN_ID)?{runId:env.GITHUB_RUN_ID}:{}),
  ...(error?safeError(error):{}),workflowElapsedMs:elapsed(started),usage:aggregateUsage(calls.filter(x=>x.dispatched)),calls,
  assessments:completed.flatMap(x=>x.assessments),timingNote:'Reported usage only, no imputed missing counts or billing inference. Elapsed times include local telemetry overhead.'});
 const checkpoint=async(name,data)=>{
  if(!ARTIFACT_NAMES.includes(name))fail('REQUEST_SETTINGS');
  const snapshot=structuredClone(data);
  if(name!=='diagnostics.json')return save(name,snapshot);
  snapshot.diagnosticRevision=++revision;
  const pending=writes.catch(()=>{}).then(()=>{if(terminal&&snapshot.status==='running')return;return save(name,snapshot);});writes=pending;await pending;
 };
 await checkpoint('inputs.json',{protocol,fixtures});
 const service=serviceFactory({env:config,now,fetchImpl:async(url,options)=>{
  if(!current||current.requestCount++)fail('REQUEST_COUNT');
  if(attempts>=protocol.maxCalls)fail('REQUEST_LIMIT');
  let body;try{body=JSON.parse(options.body);}catch{fail('REQUEST_SETTINGS');}
  if(url!=='https://opencode.ai/zen/go/v1/chat/completions'||options.method!=='POST'||options.redirect!=='error'||body.model!==protocol.model||body.max_tokens!==protocol.maxTokens||body.thinking?.type!=='disabled'||Object.hasOwn(body,'reasoning_effort'))fail('REQUEST_SETTINGS');
  body.temperature=protocol.temperature;const serialized=JSON.stringify(body);
  const record={sequence:calls.length+1,fixture:current.fixture,requestSha256:digest(serialized),inputBytes:Buffer.byteLength(serialized),status:'prepared',dispatched:false,usage:{},elapsedMs:null};calls.push(record);
  await checkpoint('diagnostics.json',diagnostics('running'));
  if(terminal||options.signal?.aborted)throw Object.assign(Error('Stopped before dispatch'),{code:'REQUEST_CANCELLED'});
  attempts++;record.dispatched=true;record.status='attempted';const start=now();
  try{
   const response=await fetchImpl(url,{...options,body:serialized});if(terminal)return response;
   // Mutate a temporary diagnostic record so a body arriving after a timeout
   // cannot modify the already finalized record.
   const received=structuredClone(record),out=await captureResponse(response,received);
   if(!terminal){Object.assign(record,received);record.status=out.ok?'response_received':'http_error';}return out;
  }catch(error){if(!terminal){if(error?.auditDiagnostics)Object.assign(record,error.auditDiagnostics);record.status='transport_failed';Object.assign(record,safeError(error));}throw error;}
  finally{if(!terminal){record.elapsedMs=elapsed(start);await checkpoint('diagnostics.json',diagnostics('running'));}}
 }});
 try{
  for(const fixture of fixtures){
   if(attempts)await sleep(protocol.minimumGapMs);
   current={fixture:fixture.id,requestCount:0};const start=now();
   const result=await service.run('reviewChapter',structuredClone(fixture.input));
   if(current.requestCount!==1)fail('REQUEST_COUNT');
   const {provider,...output}=result;validateOutput('reviewChapter',output,fixture.input);
   const entry={fixture:fixture.id,sequence:attempts,output,assessments:assessOutput(fixture,output),serviceElapsedMs:elapsed(start)};
   await checkpoint(`completed-0${attempts}.json`,entry);completed.push(entry);calls.at(-1).status='validated';
   await checkpoint('diagnostics.json',diagnostics('running'));log(`memory-support completed ${completed.length}/4`);current=null;
  }
  if(attempts!==4||completed.length!==4)fail('REQUEST_COUNT');
  terminal=true;await checkpoint('diagnostics.json',diagnostics('complete'));
  return {status:'complete',attempts,completed,assessments:completed.flatMap(x=>x.assessments)};
 }catch(error){
  terminal=true;const last=calls.at(-1);if(last&&last.status!=='validated'){last.status=last.dispatched?'failed':'not_dispatched';Object.assign(last,safeError(error));}
  await checkpoint('diagnostics.json',diagnostics('stopped',error));log(`memory-support stopped ${attempts}/4 ${safeError(error).code}`);
  throw Error('Memory support audit stopped; no automatic retry');
 }finally{current=null;}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const directory='memory-support-evidence';
 try{approvedConfig(process.env);await mkdir(directory);await runMemorySupportEval({save:async(name,data)=>{
  if(!ARTIFACT_NAMES.includes(name))fail('REQUEST_SETTINGS');
  if(name==='diagnostics.json'){await writeFile(`${directory}/.diagnostics.tmp`,JSON.stringify(data,null,2)+'\n');await rename(`${directory}/.diagnostics.tmp`,`${directory}/${name}`);}
  else await writeFile(`${directory}/${name}`,JSON.stringify(data,null,2)+'\n',{flag:'wx'});
 }});}catch{process.exitCode=1;}
}
