import test from 'node:test';
import assert from 'node:assert/strict';
import {runLiveSmoke} from '../scripts/live-smoke.mjs';
const env={NEXUS_SMOKE_APPROVED:'true',NEXUS_LIVE_ENABLED:'true',NEXUS_OVERAGE_CONFIRMED_OFF:'true',NEXUS_API_BASE_URL:'https://provider.example.test/v1',NEXUS_API_MODEL:'mock-model',NEXUS_API_KEY:'secret-never-print',NEXUS_MAX_CALLS:'100'};
const fieldKeys=['premise','protagonist','emotionalDirection','pov','desire','obstacle','coreQuestion','boundaries','opening'];
const fixtures={
 interview:{questions:[{key:'tone',title:'情绪？',hint:'请选择',placeholder:'温暖'}],summary:'待补充'},
 planStory:{contract:{fields:fieldKeys.map(key=>({key,label:key,value:'提案',status:'proposed'})),premise:'灯塔变矮',protagonist:'小舟',emotionalDirection:'温暖',pov:'第三人称',desire:'找原因',boundaries:'虚构',unresolved:['原因']},outline:[1,2,3].map(n=>({id:`chapter-${n}`,title:'纸灯',goal:'寻找',conflict:'阻碍',knowledgeDelta:'线索',exitState:'继续',emotionalArc:'好奇',pov:'第三人称',scene:{time:'夜',location:'岛',participants:['小舟'],allowedReveal:'线索',forbiddenReveal:'真相',preconditions:[]}}))},
 generateChapter:{text:'小舟找到一盏纸灯。',chapterId:'chapter-1',staging:[{label:'找到纸灯',sourceQuote:'小舟找到一盏纸灯。'}],reviewNotes:['提案']},
 interpretRevision:{summary:'新增行动',intents:['canon_update'],questions:[],suggestedFacts:[{label:'放置纸灯',sourceQuote:'小舟把一盏纸灯放在窗边。'}]},
 reviewChapter:{summary:'待作者复核',issues:[],checks:['检查正文来源']}
};
const response=output=>new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify(output)}}]}));
function mock({failAt,malformedAt}={}){
 const calls=[];const fetchImpl=async(url,options)=>{
  const body=JSON.parse(options.body),request=JSON.parse(body.messages[1].content);calls.push({url,options,body,request});
  if(request.action===failAt)throw new Error(`${env.NEXUS_API_KEY} prompt output sensitive upstream error`);
  return response(request.action===malformedAt?{}:fixtures[request.action]);
 };return {calls,fetchImpl};
}
test('all approval flags required before any network, missing credentials blocked',async()=>{
 for(const flag of ['NEXUS_SMOKE_APPROVED','NEXUS_LIVE_ENABLED','NEXUS_OVERAGE_CONFIRMED_OFF','NEXUS_API_KEY']){
 const m=mock(),lines=[];await assert.rejects(runLiveSmoke({env:{...env,[flag]:''},fetchImpl:m.fetchImpl,log:s=>lines.push(s)}),e=>['APPROVAL_REQUIRED','NOT_CONFIGURED'].includes(e.code));assert.equal(m.calls.length,0);assert.equal(lines.length,1);assert.equal(lines[0].includes(env.NEXUS_API_KEY),false);
 }
});
test('successful smoke performs exactly five sequential validated calls, bounded output and summary-only logs',async()=>{
 const m=mock(),lines=[];const result=await runLiveSmoke({env,fetchImpl:m.fetchImpl,log:s=>lines.push(s)});
 assert.equal(result.passed,true);assert.equal(result.attempts,5);assert.equal(m.calls.length,5);
 assert.deepEqual(m.calls.map(c=>c.request.action),Object.keys(fixtures));assert.deepEqual(lines,Object.keys(fixtures).map(action=>`${action} PASS`));
 for(const call of m.calls){assert.equal(call.body.max_tokens,900);assert.equal(call.options.headers.Authorization,`Bearer ${env.NEXUS_API_KEY}`);assert.equal(call.options.redirect,'error');}
 const text=JSON.stringify({result,lines});for(const forbidden of [env.NEXUS_API_KEY,env.NEXUS_API_BASE_URL,env.NEXUS_API_MODEL,fixtures.generateChapter.text,'Authorization','messages'])assert.equal(text.includes(forbidden),false);
 const revised=m.calls[3].request.input,review=m.calls[4].request.input;
 assert.equal(revised.context.sources[0].text,revised.afterText);assert.equal(review.context.sources[0].text,review.text);assert.equal(revised.chapterId,'chapter-1');
});
test('stop at every first failure without retry or fallback and redact upstream details',async()=>{
 for(const [index,action] of Object.keys(fixtures).entries()){
 const m=mock({failAt:action}),lines=[];await assert.rejects(runLiveSmoke({env,fetchImpl:m.fetchImpl,log:s=>lines.push(s)}),e=>e.code==='UPSTREAM_ERROR'&&!e.message.includes(env.NEXUS_API_KEY));assert.equal(m.calls.length,index+1);assert.equal(lines.at(-1),`${action} UPSTREAM_ERROR`);assert.equal(lines.join().includes('sensitive'),false);
 }
});
test('malformed and unsupported evidence stop the smoke',async()=>{
 const m=mock({malformedAt:'generateChapter'});await assert.rejects(runLiveSmoke({env,fetchImpl:m.fetchImpl,log:()=>{}}),{code:'INVALID_MODEL_OUTPUT'});assert.equal(m.calls.length,3);
 let count=0;const fetchImpl=async(url,options)=>{count++;const {action}=JSON.parse(JSON.parse(options.body).messages[1].content);return response(action==='interpretRevision'?{...fixtures.interpretRevision,suggestedFacts:[{label:'虚构来源',sourceQuote:'正文不存在'}]}:fixtures[action]);};
 await assert.rejects(runLiveSmoke({env,fetchImpl,log:()=>{}}),{code:'INVALID_MODEL_OUTPUT'});assert.equal(count,4);
});
test('lower explicitly configured output token bound is preserved',async()=>{
 const m=mock();await runLiveSmoke({env:{...env,NEXUS_MAX_OUTPUT_TOKENS:'400'},fetchImpl:m.fetchImpl,log:()=>{}});assert.ok(m.calls.every(c=>c.body.max_tokens===400));
});

test('explicit 3000-token limit is supported and larger requests are hard-capped',async()=>{
 for(const selected of ['3000','5000']){
 const m=mock();const result=await runLiveSmoke({env:{...env,NEXUS_MAX_OUTPUT_TOKENS:selected},fetchImpl:m.fetchImpl,log:()=>{}});assert.equal(result.attempts,5);assert.ok(m.calls.every(c=>c.body.max_tokens===3000));
 }
});
test('invalid explicit token limits fail before any network',async()=>{
 for(const selected of ['0','-1','1.5','','invalid','Infinity','9007199254740992']){
 const m=mock(),lines=[];await assert.rejects(runLiveSmoke({env:{...env,NEXUS_MAX_OUTPUT_TOKENS:selected},fetchImpl:m.fetchImpl,log:s=>lines.push(s)}),{code:'INVALID_TOKEN_LIMIT'});assert.equal(m.calls.length,0);assert.deepEqual(lines,['setup INVALID_TOKEN_LIMIT']);
 }
});
test('a higher selected limit does not authorize truncation retries',async()=>{
 let count=0;const lines=[];const fetchImpl=async(url,options)=>{count++;const body=JSON.parse(options.body);assert.equal(body.max_tokens,3000);const {action}=JSON.parse(body.messages[1].content);return action==='planStory'?new Response(JSON.stringify({choices:[{finish_reason:'length',message:{content:'{}'}}]})):response(fixtures[action]);};
 await assert.rejects(runLiveSmoke({env:{...env,NEXUS_MAX_OUTPUT_TOKENS:'3000'},fetchImpl,log:s=>lines.push(s)}),{code:'OUTPUT_TRUNCATED'});assert.equal(count,2);assert.deepEqual(lines,['interview PASS','planStory METADATA {"finishReason":"length","finalContentPresent":true,"reasoningContentPresent":false}','planStory OUTPUT_TRUNCATED']);
});

test('planning-only makes exactly one planStory call with synthetic input and bounded tokens',async()=>{
 const m=mock(),lines=[];const result=await runLiveSmoke({env:{...env,NEXUS_SMOKE_SCOPE:'planning-only',NEXUS_MAX_OUTPUT_TOKENS:'5000'},fetchImpl:m.fetchImpl,log:s=>lines.push(s)});
 assert.equal(m.calls.length,1);assert.equal(m.calls[0].request.action,'planStory');assert.equal(m.calls[0].body.max_tokens,3000);assert.equal(result.scope,'planning-only');assert.equal(result.attempts,1);assert.equal(result.kind,'bounded-connectivity-contract-smoke');assert.deepEqual(lines,['planStory PASS']);assert.ok(m.calls[0].request.input.idea.includes('虚构'));assert.ok(m.calls[0].body.messages[0].content.includes('Compact planning response'));
 for(const privateText of [env.NEXUS_API_KEY,env.NEXUS_API_BASE_URL,fixtures.generateChapter.text])assert.equal(JSON.stringify({result,lines}).includes(privateText),false);
});
test('planning-only stops on malformed, truncated or failed first response without retry',async()=>{
 for(const mode of ['malformed','failed','truncated']){
 let count=0;const lines=[];const fetchImpl=async()=>{count++;if(mode==='failed')throw Error('private credential '+env.NEXUS_API_KEY);return mode==='truncated'?new Response(JSON.stringify({choices:[{finish_reason:'length',message:{content:'{}'}}]})):response({});};
 const expected={malformed:'INVALID_MODEL_OUTPUT',failed:'UPSTREAM_ERROR',truncated:'OUTPUT_TRUNCATED'}[mode];await assert.rejects(runLiveSmoke({env:{...env,NEXUS_SMOKE_SCOPE:'planning-only',NEXUS_MAX_OUTPUT_TOKENS:'3000'},fetchImpl,log:s=>lines.push(s)}),{code:expected});assert.equal(count,1);assert.deepEqual(lines,[...(mode==='truncated'?['planStory METADATA {"finishReason":"length","finalContentPresent":true,"reasoningContentPresent":false}']:[]),`planStory ${expected}`]);
 }
});
test('invalid scope is rejected before network, explicit full-flow remains five calls',async()=>{
 for(const scope of ['','planning','FULL-FLOW','planning-only ']){const m=mock();await assert.rejects(runLiveSmoke({env:{...env,NEXUS_SMOKE_SCOPE:scope},fetchImpl:m.fetchImpl,log:()=>{}}),{code:'INVALID_SCOPE'});assert.equal(m.calls.length,0);}
 const m=mock();const result=await runLiveSmoke({env:{...env,NEXUS_SMOKE_SCOPE:'full-flow'},fetchImpl:m.fetchImpl,log:()=>{}});assert.equal(result.scope,'full-flow');assert.equal(result.attempts,5);assert.equal(m.calls.length,5);
});
test('planning-only truncation records aggregate usage but never content or reasoning text',async()=>{
 const lines=[],secret='private-reasoning-and-output-must-never-be-logged';let count=0;
 const fetchImpl=async()=>{count++;return new Response(JSON.stringify({choices:[{finish_reason:'length',message:{content:null,reasoning_content:secret}}],usage:{prompt_tokens:200,completion_tokens:900,total_tokens:1100,completion_tokens_details:{reasoning_tokens:900},untrusted_text:secret}}))};
 await assert.rejects(runLiveSmoke({env:{...env,NEXUS_SMOKE_SCOPE:'planning-only'},fetchImpl,log:s=>lines.push(s)}),e=>e.code==='OUTPUT_TRUNCATED');
 assert.equal(count,1);const output=lines.join('\n');assert.equal(output.includes(secret),false);assert.equal(output.includes(env.NEXUS_API_KEY),false);assert.match(output,/"reasoningTokens":900/);assert.match(output,/"finalContentPresent":false/);assert.match(output,/"reasoningContentPresent":true/);assert.match(output,/planStory OUTPUT_TRUNCATED/);
});
