import {readFileSync} from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {runReviewProbe} from '../scripts/live-review-probe.mjs';
const env={NEXUS_REVIEW_PROBE_APPROVED:'true',NEXUS_JOURNEY_APPROVED:'true',NEXUS_LIVE_ENABLED:'true',NEXUS_OVERAGE_CONFIRMED_OFF:'true',NEXUS_API_KEY:'SYNTHETIC_TEST_KEY'};
test('one-call review probe has realistic previous/planned sources, bounded request and aggregate-only logs',async()=>{
 let count=0;const logs=[];const result=await runReviewProbe({env,log:x=>logs.push(x),fetchImpl:async(url,options)=>{
  count++;const request=JSON.parse(options.body),input=JSON.parse(request.messages[1].content).input;
  assert.equal(request.max_tokens,3000);assert.deepEqual(request.thinking,{type:'disabled'});assert.equal('reasoning_effort' in request,false);
  assert.equal(input.chapterId,'ch2');assert.equal(input.context.sources.length,3);assert.notEqual(input.context.sources[1].text,input.text);
  assert.equal(options.body.includes(env.NEXUS_API_KEY),false);assert.match(request.messages[0].content,/review limitation in summary/);
  return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({summary:'仍需核对全书',issues:[{severity:'error',explanation:'合成阻塞意见仍被如实计数',sourceQuote:'蓝色纸灯'}],checks:['来源']})},finish_reason:'stop'}]}));
 }});
 assert.equal(count,1);assert.deepEqual(result,{passed:true,attempts:1,issues:1,errors:1});assert.deepEqual(logs,['review-probe PASS 1 1 1']);
});
test('review probe fails closed once, exposes fixed reason only, never retries',async()=>{
 let calls=0;const logs=[];await assert.rejects(runReviewProbe({env,log:x=>logs.push(x),fetchImpl:async()=>{calls++;return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({summary:'PRIVATE',issues:[{severity:'info',explanation:'PRIVATE',sourceQuote:'PRIVATE'}],checks:[]})},finish_reason:'stop'}]}))}}));
 assert.equal(calls,1);assert.deepEqual(logs,['review-probe INVALID_MODEL_OUTPUT 1','validation REVIEW_SEVERITY']);
});
test('review probe requires explicit approval before any request',async()=>{
 let calls=0;await assert.rejects(runReviewProbe({env:{...env,NEXUS_REVIEW_PROBE_APPROVED:'false'},fetchImpl:async()=>calls++}));assert.equal(calls,0);
});

test('manual workflow requires exact scope and defaults to one-call probe',()=>{
 const workflow=readFileSync(new URL('../.github/workflows/live-smoke.yml',import.meta.url),'utf8');
 assert.match(workflow,/default: review-probe/);
 assert.match(workflow,/Run approved bounded real-browser journey\n\s+if: inputs.test_scope == 'journey'/);
 assert.match(workflow,/Run approved one-call synthetic review probe\n\s+if: inputs.test_scope == 'review-probe'/);
 assert.match(workflow,/if: always\(\) && inputs.test_scope == 'journey'/);
 assert.equal(workflow.includes("test_scope !="),false);
 assert.match(workflow,/workflow_dispatch:/);assert.equal(/\n  (push|pull_request):/.test(workflow),false);
});
