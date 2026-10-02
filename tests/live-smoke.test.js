import test from 'node:test';
import assert from 'node:assert/strict';
import {runLiveSmoke} from '../scripts/live-smoke.mjs';
const env={NEXUS_SMOKE_APPROVED:'true',NEXUS_LIVE_ENABLED:'true',NEXUS_OVERAGE_CONFIRMED_OFF:'true',NEXUS_API_BASE_URL:'https://provider.example.test/v1',NEXUS_API_MODEL:'mock-model',NEXUS_API_KEY:'secret-never-print',NEXUS_MAX_OUTPUT_TOKENS:'5000',NEXUS_MAX_CALLS:'100'};
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
