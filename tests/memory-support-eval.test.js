import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {approvedConfig,protocol,ARTIFACT_NAMES,assessOutput,runMemorySupportEval,assertV1LiveDispatchAllowed} from '../scripts/memory-support-eval.mjs';
import {buildSupportFixtures} from '../eval/memory-support-fixtures.mjs';
import {createAgentService} from '../server/provider.js';
const env={NEXUS_MEMORY_SUPPORT_APPROVED:'true',NEXUS_LIVE_ENABLED:'true',NEXUS_OVERAGE_CONFIRMED_OFF:'true',NEXUS_API_KEY:'PRIVATE_TEST_KEY',GITHUB_ACTIONS:'true',GITHUB_RUN_ATTEMPT:'1',GITHUB_SHA:'a'.repeat(40),GITHUB_RUN_ID:'123'};
const fixtures=buildSupportFixtures();
const outFor=input=>({summary:'合成审查',issues:[],checks:[],factChecks:[],memoryChecks:input.memoryCandidates.map((x,index)=>({candidateId:x.candidateId,status:fixtures.find(f=>f.input.context.projectId===input.context.projectId).expected[index]==='supported'?'supported':'unsupported',explanation:'合成固定结果'}))});
const response=(output,extra={})=>new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify(output),reasoning_content:'PRIVATE_REASONING'}}],usage:{prompt_tokens:100,completion_tokens:20,total_tokens:120,private:'PRIVATE_USAGE'},private:'PRIVATE_BODY',...extra}));
function setup(extra={}){
 const saved={},calls=[],logs=[],gaps=[];
 const options={env,save:async(name,data)=>{saved[name]=structuredClone(data)},sleep:async ms=>{gaps.push(ms)},log:x=>logs.push(x),fetchImpl:async(url,options)=>{const body=JSON.parse(options.body),input=JSON.parse(body.messages[1].content).input;calls.push({url,body,input});return response(outFor(input));},...extra};
 return {saved,calls,logs,gaps,options,run:()=>runMemorySupportEval(options)};
}
const noPrivate=value=>{const json=JSON.stringify(value);for(const token of ['PRIVATE_','Authorization','Bearer ','reasoning_content'])assert.ok(!json.includes(token),token)};
test('four production review calls reuse fixed original labels, quote evidence and locked settings',async()=>{
 const h=setup(),result=await h.run();assert.equal(result.attempts,4);assert.equal(result.assessments.length,11);assert.ok(result.assessments.every(x=>x.matched&&!x.missing));
 assert.deepEqual(h.gaps,[11000,11000,11000]);assert.equal(h.calls.length,4);assert.equal(h.saved['diagnostics.json'].status,'complete');
 assert.deepEqual(h.saved['inputs.json'].fixtures,fixtures);
 for(const [i,call] of h.calls.entries()){assert.deepEqual(call.input,fixtures[i].input);assert.equal(call.body.model,protocol.model);assert.equal(call.body.max_tokens,3000);assert.equal(call.body.temperature,.7);assert.deepEqual(call.body.thinking,{type:'disabled'});assert.equal(Object.hasOwn(call.body,'reasoning_effort'),false);assert.ok(h.saved[`completed-0${i+1}.json`]);}
 assert.equal(h.saved['diagnostics.json'].usage.totalTokens.knownSum,480);noPrivate(h.saved);noPrivate(h.logs);
});
test('retained counterexample keeps exact original combined label and paragraph0 quote',async()=>{
 const original=JSON.parse(await readFile(new URL('../eval/history/prose-pipeline-v1/completed-03.json',import.meta.url),'utf8')).staging[1];
 const prose=JSON.parse(await readFile(new URL('../eval/history/prose-pipeline-v1/completed-02.json',import.meta.url),'utf8')).text;
 assert.equal(fixtures[0].input.text,prose);assert.equal(fixtures[0].input.memoryCandidates[0].label,original.label);assert.equal(fixtures[0].input.memoryCandidates[0].sourceQuote,original.sourceQuote);assert.equal(fixtures[0].expected[0],'not_supported');
 assert.ok(!original.sourceQuote.includes('收费低'));assert.ok(prose.includes('收费低'));
});
test('wrong but wellformed judgments are retained and never retried or hidden',async()=>{
 let attempts=0;const h=setup({fetchImpl:async(_url,options)=>{attempts++;const input=JSON.parse(JSON.parse(options.body).messages[1].content).input;const output=outFor(input);output.memoryChecks.forEach(x=>x.status='supported');return response(output)}});
 const r=await h.run();assert.equal(attempts,4);assert.equal(r.assessments.filter(x=>!x.matched).length,7);assert.equal(h.saved['completed-01.json'].assessments[0].status,'supported');
});
test('missing or ambiguous assessments remain unknown without counting missing as success',()=>{
 const none=assessOutput(fixtures[0],{});assert.ok(none.every(x=>x.missing&&!x.matched&&x.status==='unknown'));
 const r=assessOutput(fixtures[0],{memoryChecks:[{candidateId:'retained-combined',status:'unknown',explanation:'不确定'}]});assert.equal(r[0].matched,true);assert.equal(r[1].matched,false);
});
test('first error stops after preserving prior successful checkpoint and failure usage',async()=>{
 let attempts=0;const h=setup({fetchImpl:async(_url,options)=>{attempts++;const input=JSON.parse(JSON.parse(options.body).messages[1].content).input;return attempts===2?response(outFor(input),{choices:[{finish_reason:'length',message:{content:'PRIVATE_INVALID'}}]}):response(outFor(input))}});
 await assert.rejects(h.run(),/no automatic retry/);assert.equal(attempts,2);assert.ok(h.saved['completed-01.json']);assert.equal(h.saved['completed-02.json'],undefined);assert.equal(h.saved['diagnostics.json'].completed,1);assert.equal(h.saved['diagnostics.json'].code,'OUTPUT_TRUNCATED');assert.equal(h.saved['diagnostics.json'].usage.totalTokens.knownSum,240);noPrivate(h.saved);
});
test('error/refusal and incomplete envelopes stop on first request even with valid review JSON',async()=>{
 for(const variant of ['content_filter','tool_calls',null,'refusal','error']){
  let calls=0;const h=setup({fetchImpl:async(_url,options)=>{calls++;const input=JSON.parse(JSON.parse(options.body).messages[1].content).input,output=outFor(input);return response(output,{...(variant==='error'?{error:{message:'PRIVATE_ERROR'}}:{}),choices:[{finish_reason:['refusal','error'].includes(variant)?'stop':variant,message:{content:JSON.stringify(output),...(variant==='refusal'?{refusal:'PRIVATE_REFUSAL'}:{})}}]})}});
  await assert.rejects(h.run());assert.equal(calls,1);assert.equal(h.saved['diagnostics.json'].completed,0);assert.equal(h.saved['diagnostics.json'].usage.totalTokens.knownSum,120);noPrivate(h.saved);
 }
});
test('durable prepared checkpoint reports dispatch uncertainty before network entry',async()=>{
 let observed;const h=setup({fetchImpl:async(_url,options)=>{observed??=structuredClone(h.saved['diagnostics.json']);return response(outFor(JSON.parse(JSON.parse(options.body).messages[1].content).input));}});await h.run();
 assert.equal(observed.attempts,0);assert.equal(observed.uncertainDispatches,1);assert.equal(observed.attemptAccountingComplete,false);assert.match(observed.accountingNote,/uncertain/);
 assert.equal(h.saved['diagnostics.json'].attemptAccountingComplete,true);assert.equal(h.saved['diagnostics.json'].uncertainDispatches,0);
});
test('invalid JSON, HTTP errors and transport failures never retry or persist unsafe bodies',async()=>{
 for(const fetchImpl of [async()=>new Response('PRIVATE_HTTP',{status:500}),async()=>{throw Error('PRIVATE_TRANSPORT')},async()=>response({}, {choices:[{finish_reason:'stop',message:{content:'PRIVATE_JSON'}}]})]){
  let attempts=0;const h=setup({fetchImpl:async(...args)=>{attempts++;return fetchImpl(...args)}});await assert.rejects(h.run());assert.equal(attempts,1);assert.equal(h.saved['diagnostics.json'].status,'stopped');noPrivate(h.saved);noPrivate(h.logs);
 }
});
test('oversized envelope cancels its stream and stops at one attempted request',async()=>{
 let calls=0,cancelled=false;const h=setup({fetchImpl:async()=>{calls++;return new Response(new ReadableStream({start(controller){controller.enqueue(new Uint8Array(128*1024+1));},cancel(){cancelled=true}}));}});
 await assert.rejects(h.run());assert.equal(calls,1);assert.equal(cancelled,true);assert.equal(h.saved['diagnostics.json'].calls[0].validationReason,'RESPONSE_SIZE');assert.equal(h.saved['diagnostics.json'].completed,0);
});
test('input or prepared-intent persistence failure sends zero provider requests',async()=>{
 for(const badName of ['inputs.json','diagnostics.json']){let calls=0;const h=setup({save:async name=>{if(name===badName)throw Error('PRIVATE_STORAGE')},fetchImpl:async()=>{calls++;return response({})}});await assert.rejects(h.run());assert.equal(calls,0);}
});
test('failed output checkpoint stops without dispatching next fixture',async()=>{
 let calls=0;const h=setup({save:async(name,data)=>{if(name==='completed-01.json')throw Error('PRIVATE_STORAGE');h.saved[name]=structuredClone(data)},fetchImpl:async(_url,options)=>{calls++;return response(outFor(JSON.parse(JSON.parse(options.body).messages[1].content).input))}});
 await assert.rejects(h.run());assert.equal(calls,1);assert.equal(h.saved['diagnostics.json'].completed,0);assert.equal(h.saved['diagnostics.json'].status,'stopped');noPrivate(h.saved);
});
test('timeout while prepared write is pending cannot dispatch a late request or overwrite terminal diagnostics',async()=>{
 let release,enteredResolve,calls=0;const entered=new Promise(resolve=>enteredResolve=resolve),hold=new Promise(resolve=>release=resolve);
 const h=setup({serviceFactory:config=>createAgentService({...config,timeoutMs:5}),save:async(name,data)=>{if(name==='diagnostics.json'&&data.status==='running'&&data.diagnosticRevision===1){enteredResolve();await hold;}h.saved[name]=structuredClone(data)},fetchImpl:async()=>{calls++;return response({})}});
 const pending=h.run();await entered;await new Promise(resolve=>setTimeout(resolve,20));release();await assert.rejects(pending);await new Promise(resolve=>setTimeout(resolve,10));assert.equal(calls,0);assert.equal(h.saved['diagnostics.json'].status,'stopped');assert.equal(h.saved['diagnostics.json'].attempts,0);
});
test('late response after timeout cannot change completed terminal artifacts',async()=>{
 let release,enteredResolve;const entered=new Promise(resolve=>enteredResolve=resolve),h=setup({serviceFactory:config=>createAgentService({...config,timeoutMs:5}),fetchImpl:async()=>{enteredResolve();return new Promise(resolve=>release=resolve)}});
 const pending=h.run();await entered;await assert.rejects(pending);const before=structuredClone(h.saved);release(response({}));await new Promise(resolve=>setTimeout(resolve,20));assert.deepEqual(h.saved,before);assert.equal(h.saved['diagnostics.json'].attempts,1);
});
test('all approvals and first Actions attempt are mandatory; caller cannot change endpoint/model/budget',()=>{
 for(const key of ['NEXUS_MEMORY_SUPPORT_APPROVED','NEXUS_LIVE_ENABLED','NEXUS_OVERAGE_CONFIRMED_OFF','GITHUB_ACTIONS','GITHUB_RUN_ATTEMPT'])assert.throws(()=>approvedConfig({...env,[key]:'false'}));
 assert.throws(()=>approvedConfig({...env,GITHUB_RUN_ATTEMPT:'2'}));const config=approvedConfig({...env,NEXUS_API_MODEL:'other',NEXUS_MAX_CALLS:'100',NEXUS_REASONING_EFFORT:'high'});assert.equal(config.NEXUS_MAX_CALLS,'4');assert.equal(config.NEXUS_API_MODEL,protocol.model);assert.equal(config.NEXUS_REASONING_EFFORT,undefined);
});
test('frozen audit source hashes and artifact allowlist match preregistration',async()=>{
 const manifest=JSON.parse(await readFile(new URL('../eval/memory-support-manifest.json',import.meta.url),'utf8'));
 for(const [path,sha] of Object.entries({...manifest.sha256,...manifest.maintenanceSha256})){const bytes=await readFile(new URL('../'+path,import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),sha,path);}
 assert.deepEqual(ARTIFACT_NAMES,['inputs.json','diagnostics.json','completed-01.json','completed-02.json','completed-03.json','completed-04.json']);
});

test('workflow audit scope is explicit, first-attempt-only and artifact allowlisted',async()=>{
 const workflow=await readFile(new URL('../.github/workflows/live-smoke.yml',import.meta.url),'utf8');
 assert.match(workflow,/memory-support' && github.run_attempt == 1/);assert.match(workflow,/default: review-probe/);
 const block=workflow.split(/\n      - name:/).find(x=>x.includes('run: node --import tsx scripts/memory-support-eval.mjs'));
 assert.match(block,/NEXUS_MEMORY_SUPPORT_APPROVED: 'true'/);assert.match(block,/NEXUS_API_KEY:/);
 const artifact=workflow.split(/\n      - name:/).find(x=>x.includes('name: synthetic-memory-support-audit'));
 for(const name of ARTIFACT_NAMES)assert.ok(artifact.includes('memory-support-evidence/'+name));
 assert.ok(!artifact.includes('*.json'));assert.ok(!artifact.includes('completed-05'));
});

test('concluded v1 live entry point refuses dispatch before configuration or output writes',async()=>{
 assert.throws(()=>assertV1LiveDispatchAllowed(),/COMPLETED_PROTOCOL_RETIRED/);
 const source=await readFile(new URL('../scripts/memory-support-eval.mjs',import.meta.url),'utf8');
 const cli=source.slice(source.indexOf("if(process.argv[1]&&import.meta.url"));
 assert.ok(cli.indexOf('assertV1LiveDispatchAllowed();')>=0);
 assert.ok(cli.indexOf('assertV1LiveDispatchAllowed();')<cli.indexOf('approvedConfig(process.env)'));
 assert.match(cli,/no provider requests were sent/);
});
