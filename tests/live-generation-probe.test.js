import test from 'node:test';
import assert from 'node:assert/strict';
import {runGenerationProbe} from '../scripts/live-generation-probe.mjs';
const env={NEXUS_GENERATION_PROBE_APPROVED:'true',NEXUS_JOURNEY_APPROVED:'true',NEXUS_LIVE_ENABLED:'true',NEXUS_OVERAGE_CONFIRMED_OFF:'true',NEXUS_API_KEY:'SYNTHETIC_TEST_KEY'};
const respond=out=>new Response(JSON.stringify({choices:[{message:{content:JSON.stringify(out)},finish_reason:'stop'}]}));
test('generation probe sends one bounded request with competing source IDs and prior/planned events',async()=>{
 const logs=[];let calls=0;const result=await runGenerationProbe({env,log:x=>logs.push(x),fetchImpl:async(url,options)=>{
  calls++;const wire=JSON.parse(options.body),input=JSON.parse(wire.messages[1].content).input;
  assert.equal(wire.max_tokens,3000);assert.deepEqual(wire.thinking,{type:'disabled'});assert.equal('reasoning_effort' in wire,false);assert.equal(input.chapterId,'chapter-2');assert.equal(input.context.sources[1].chapterId,'ch2');assert.match(input.context.sources[1].text,/尚非生成正文/);
  assert.match(wire.messages[0].content,/zero-based integer/);assert.match(wire.messages[0].content,/Unsupported proposals or uncertainty belong in reviewNotes/);assert.equal(options.body.includes(env.NEXUS_API_KEY),false);
  return respond({paragraphs:['小舟抬起蓝灯，沿墙观察潮痕。'],chapterId:'chapter-2',staging:[{label:'小舟查看潮痕',sourceParagraphIndex:0}],reviewNotes:[]});
 }});
 assert.equal(calls,1);assert.deepEqual(result,{passed:true,attempts:1,stagedEvents:1,anchoredEvents:1,reviewNotes:0});assert.deepEqual(logs,['generation-probe PASS 1 1 1 0']);
});
test('generation probe still rejects prior-chapter quote, without normalization or retry',async()=>{
 const logs=[];let calls=0;await assert.rejects(runGenerationProbe({env,log:x=>logs.push(x),fetchImpl:async()=>{calls++;return respond({text:'小舟举起蓝灯，查看潮痕。',chapterId:'chapter-2',staging:[{label:'保留船票',sourceQuote:'他把旧船票放进衣袋，决定先去码头问路。'}],reviewNotes:[]})}}));
 assert.equal(calls,1);assert.deepEqual(logs,['generation-probe INVALID_MODEL_OUTPUT 1','validation STAGING_QUOTE_MISMATCH']);
});
test('generation probe requires explicit gate before request',async()=>{let calls=0;await assert.rejects(runGenerationProbe({env:{...env,NEXUS_GENERATION_PROBE_APPROVED:'false'},fetchImpl:async()=>calls++}));assert.equal(calls,0)});

test('generation probe refuses an invalid paragraph index after one attempt',async()=>{
 let calls=0;const logs=[];await assert.rejects(runGenerationProbe({env,log:x=>logs.push(x),fetchImpl:async()=>{calls++;return respond({paragraphs:['小舟举起纸灯。'],chapterId:'chapter-2',staging:[{label:'举灯',sourceParagraphIndex:7}],reviewNotes:[]})}}));
 assert.equal(calls,1);assert.deepEqual(logs,['generation-probe INVALID_MODEL_OUTPUT 1','validation STAGING_REFERENCE_RANGE']);
});
