import test from 'node:test';
import assert from 'node:assert/strict';
import {journeyConfig,guardJourney} from '../scripts/live-journey-guard.mjs';
const approved={NEXUS_JOURNEY_APPROVED:'true',NEXUS_LIVE_ENABLED:'true',NEXUS_OVERAGE_CONFIRMED_OFF:'true'};
test('journey configuration requires three explicit gates and overrides unsafe limits',()=>{
 for(const key of Object.keys(approved))assert.throws(()=>journeyConfig({...approved,[key]:'false'}));
 const env=journeyConfig({...approved,NEXUS_MAX_CALLS:'99',NEXUS_MAX_OUTPUT_TOKENS:'99000',NEXUS_REASONING_EFFORT:'low'});
 assert.equal(env.NEXUS_MAX_CALLS,'12');assert.equal(env.NEXUS_MAX_OUTPUT_TOKENS,'3000');assert.equal(env.NEXUS_THINKING_MODE,'disabled');assert.equal(env.NEXUS_REASONING_EFFORT,undefined);
 assert.equal(env.NEXUS_API_MODEL,'deepseek-v4.1-flash');assert.equal(env.NEXUS_API_BASE_URL,'https://opencode.ai/zen/go/v1');
});
test('journey enforces 12 calls and serial pacing without retry',async()=>{
 let calls=0,time=0;const waits=[],logs=[];const guard=guardJourney({status:()=>({}),run:async()=>{calls++;return {ok:true}}},{now:()=>time,sleep:async ms=>{waits.push(ms);time+=ms},log:x=>logs.push(x)});
 for(let i=0;i<12;i++)await guard.run('interview',{});
 await assert.rejects(guard.run('interview',{}));assert.equal(calls,12);assert.deepEqual(waits,[0,...Array(11).fill(11000)]);assert.equal(logs.length,12);
});
test('first provider failure latches the session closed and sanitizes logs',async()=>{
 let calls=0;const logs=[];const guard=guardJourney({status:()=>({}),run:async()=>{calls++;throw Object.assign(Error('SECRET RAW RESPONSE'),{code:'UPSTREAM_ERROR'})}},{sleep:async()=>{},log:x=>logs.push(x)});
 await assert.rejects(guard.run('interview',{}),{code:'UPSTREAM_ERROR'});await assert.rejects(guard.run('planStory',{}));assert.equal(calls,1);assert.equal(guard.stopped,true);assert.deepEqual(logs,['provider UPSTREAM_ERROR 1']);
});
test('failed preflight invariant prevents a provider call and closes the session',async()=>{
 let calls=0;const guard=guardJourney({status:()=>({}),run:async()=>calls++},{before:()=>{throw Error('PRIVATE')},log:()=>{}});
 await assert.rejects(guard.run('generateChapter',{}),{code:'JOURNEY_FAILED'});assert.equal(calls,0);assert.equal(guard.stopped,true);
});
test('concurrent request is rejected without an extra provider call',async()=>{
 let release,calls=0;const gate=new Promise(r=>release=r);const guard=guardJourney({status:()=>({}),run:async()=>{calls++;await gate;return {}}},{sleep:async()=>{},log:()=>{}});
 const first=guard.run('interview',{});await assert.rejects(guard.run('interview',{}));release();await first;assert.equal(calls,1);
});
