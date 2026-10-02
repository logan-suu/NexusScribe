import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {runQualityEval,approvedConfig} from '../scripts/writing-quality-eval.mjs';
import {fixtures,buildPair,protocol,flatten} from '../eval/writing-quality-fixtures.mjs';
const env={NEXUS_QUALITY_EVAL_APPROVED:'true',NEXUS_LIVE_ENABLED:'true',NEXUS_OVERAGE_CONFIRMED_OFF:'true',NEXUS_API_KEY:'SYNTHETIC_TEST_KEY'};
const response=(finish='stop')=>new Response(JSON.stringify({choices:[{finish_reason:finish,message:{content:JSON.stringify({chapterId:'chapter-2',paragraphs:['她把白线穿过鞋带，停了一下。','“明天再补牢。”她说。'],staging:[],reviewNotes:[]}),reasoning_content:'PRIVATE_REASONING_SENTINEL'}}],usage:{prompt_tokens:2000,completion_tokens:40,total_tokens:2040,secret:'DO_NOT_SAVE'}}));
test('pilot is six comparable requests, synthetic fixtures, random blinded pairs and allowlisted evidence',async()=>{
 const saved={},bodies=[],logs=[],sleeps=[];const result=await runQualityEval({env,choose:()=>1,sleep:async ms=>sleeps.push(ms),log:x=>logs.push(x),save:async(n,d)=>saved[n]=d,fetchImpl:async(url,opt)=>{
  assert.equal(url,'https://opencode.ai/zen/go/v1/chat/completions');assert.ok(saved['inputs.json']);assert.equal(opt.redirect,'error');
  const body=JSON.parse(opt.body);bodies.push(body);assert.equal(body.model,protocol.model);assert.equal(body.max_tokens,3000);assert.equal(body.temperature,0.7);assert.deepEqual(body.thinking,{type:'disabled'});assert.equal('reasoning_effort' in body,false);assert.equal(opt.body.includes(env.NEXUS_API_KEY),false);return response();
 }});
 assert.equal(result.attempts,6);assert.equal(bodies.length,6);assert.deepEqual(sleeps,[11000,11000,11000,11000,11000]);
 assert.equal(new Set(bodies.map(b=>b.messages[0].content)).size,1);
 assert.deepEqual(saved['diagnostics.json'].calls.map(c=>c.arm),['baseline','nexus','nexus','baseline','baseline','nexus']);
 assert.deepEqual(saved['unblinding.json'].mapping.map(x=>x.A),['nexus','nexus','nexus']);
 assert.equal(JSON.stringify(saved['blind-pairs.json']).includes('baseline'),false);assert.equal(JSON.stringify(saved['blind-pairs.json']).includes('nexus'),false);
 const artifacts=JSON.stringify(saved);for(const forbidden of [env.NEXUS_API_KEY,'PRIVATE_REASONING_SENTINEL','DO_NOT_SAVE','Authorization','reasoning_content'])assert.equal(artifacts.includes(forbidden),false);
 assert.equal(saved['diagnostics.json'].calls[0].usage.prompt_tokens,2000);assert.equal(logs.length,6);
});
test('no request without each approval/overage gate; caller cannot raise endpoint/model/budget',async()=>{
 for(const key of ['NEXUS_QUALITY_EVAL_APPROVED','NEXUS_LIVE_ENABLED','NEXUS_OVERAGE_CONFIRMED_OFF']){
  let calls=0;await assert.rejects(runQualityEval({env:{...env,[key]:'false'},fetchImpl:async()=>{calls++;}}));assert.equal(calls,0);
 }
 const c=approvedConfig({...env,NEXUS_MAX_CALLS:'30',NEXUS_MAX_OUTPUT_TOKENS:'9999',NEXUS_API_MODEL:'other',NEXUS_API_BASE_URL:'https://other.example'});assert.equal(c.NEXUS_MAX_CALLS,'6');assert.equal(c.NEXUS_MAX_OUTPUT_TOKENS,'3000');assert.equal(c.NEXUS_API_MODEL,protocol.model);assert.equal(c.NEXUS_API_BASE_URL,'https://opencode.ai/zen/go/v1');
});
test('first upstream, malformed, oversized or truncated response stops without retry or raw diagnostics',async()=>{
 for(const make of [()=>new Response('PRIVATE_ERROR_SENTINEL',{status:429}),()=>new Response('PRIVATE_BAD_JSON'),()=>new Response('x'.repeat(128*1024+1)),()=>response('length'),()=>Promise.reject(Error('PRIVATE_NETWORK_ERROR'))]){
  let calls=0;const saved={};await assert.rejects(runQualityEval({env,sleep:async()=>{},log:()=>{},save:async(n,d)=>saved[n]=d,fetchImpl:async()=>{calls++;return make();}}));assert.equal(calls,1);assert.equal(saved['diagnostics.json'].status,'stopped');assert.equal(saved['blind-pairs.json'],undefined);assert.equal(JSON.stringify(saved).includes('PRIVATE_'),false);
 }
});
test('synthetic semantics retained and input byte budgets comparable without padding',()=>{
 for(const f of fixtures){const {baseline,nexus,brief}=buildPair(f);assert.deepEqual(baseline.project,nexus.project);assert.equal(nexus.context.facts.length,2);assert.equal(nexus.context.facts.every(x=>x.authority==='explicit_author_decision'),true);assert.equal(nexus.context.sources.length,3);assert.equal(brief,flatten(nexus.context).join('\n'));for(const fact of f.facts)assert.ok(brief.includes(fact));assert.ok(brief.includes(f.prior));const lengths=[baseline,nexus].map(x=>Buffer.byteLength(JSON.stringify(x)));assert.ok(Math.max(...lengths)/Math.min(...lengths)<1.15,JSON.stringify(lengths));}
});
test('frozen protocol and fixture checksums match committed manifest',async()=>{
 const manifest=JSON.parse(await readFile(new URL('../eval/writing-quality-manifest.json',import.meta.url)));for(const [path,hash]of Object.entries(manifest.sha256))assert.equal(createHash('sha256').update(await readFile(new URL('../'+path,import.meta.url))).digest('hex'),hash);
});
test('registered workflow quality scope is opt-in and isolated from existing live scopes',async()=>{
 const workflow=await readFile(new URL('../.github/workflows/live-smoke.yml',import.meta.url),'utf8');
 assert.match(workflow,/default: review-probe/);assert.match(workflow,/quality-pilot' && github.run_attempt == 1/);
 for(const block of workflow.split(/\n      - name:/).slice(1)){
  if(block.includes('scripts/writing-quality-eval.mjs')){assert.match(block,/if: inputs.test_scope == 'quality-pilot'/);assert.match(block,/NEXUS_API_KEY:/);assert.match(block,/NEXUS_QUALITY_EVAL_APPROVED: 'true'/);}
  if(/run: (?:npm ci|node --test)/.test(block))assert.equal(block.includes('NEXUS_API_KEY'),false);
  if(block.includes('scripts/live-writing-journey.mjs'))assert.match(block,/if: inputs.test_scope == 'journey'/);
  if(block.includes('scripts/live-review-probe.mjs'))assert.match(block,/if: inputs.test_scope == 'review-probe'/);
  if(block.includes('scripts/live-generation-probe.mjs'))assert.match(block,/if: inputs.test_scope == 'generation-probe'/);
 }
});
