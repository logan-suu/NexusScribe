/** Manual, opt-in network smoke. Never imported by the ordinary test suite to make live calls. */
import {pathToFileURL} from 'node:url';
import {createAgentService} from '../server/provider.js';
const SAFE_CODES=new Set(['NOT_CONFIGURED','INVALID_INPUT','INVALID_MODEL_OUTPUT','UPSTREAM_ERROR','UPSTREAM_TIMEOUT','OUTPUT_TRUNCATED','CALL_LIMIT','RATE_LIMIT','CONCURRENT_LIMIT']);
const ACTIONS=['interview','planStory','generateChapter','interpretRevision','reviewChapter'];
export class SmokeError extends Error {
 constructor(action,code){super('Live smoke failed; no further calls were attempted.');this.name='SmokeError';this.action=action;this.code=code;}
}
/** Returns only pass summaries. Story data and upstream outputs stay in process memory. */
export async function runLiveSmoke({env=process.env,fetchImpl=globalThis.fetch,log=console.log}={}) {
 const report=(action,code)=>log(`${action} ${code}`);
 const stop=(action,code)=>{report(action,code);throw new SmokeError(action,code);};
 if(env.NEXUS_SMOKE_APPROVED!=='true'||env.NEXUS_LIVE_ENABLED!=='true'||env.NEXUS_OVERAGE_CONFIRMED_OFF!=='true')stop('setup','APPROVAL_REQUIRED');
 const requestedTokens=env.NEXUS_MAX_OUTPUT_TOKENS===undefined?900:Number(env.NEXUS_MAX_OUTPUT_TOKENS);
 if(!Number.isSafeInteger(requestedTokens)||requestedTokens<=0)stop('setup','INVALID_TOKEN_LIMIT');
 const maxTokens=Math.min(requestedTokens,3000);
 // Hard upper bounds override a caller's larger configuration. No retry branch exists.
 const service=createAgentService({env:{...env,NEXUS_MAX_OUTPUT_TOKENS:String(maxTokens),NEXUS_MAX_CALLS:'5'},fetchImpl});
 if(!service.status().configured)stop('setup','NOT_CONFIGURED');
 const results=[];
 const call=async(action,input)=>{
  try{const output=await service.run(action,input);results.push({action,code:'PASS'});report(action,'PASS');return output;}
  catch(error){stop(action,SAFE_CODES.has(error?.code)?error.code:'SMOKE_FAILED');}
 };
 // Entirely invented story: no user projects, filesystem contents or source credentials.
 const idea={idea:'虚构童话：小岛灯塔每晚少一层，旅人寻找原因。',title:'纸灯岛'};
 await call(ACTIONS[0],{input:idea});
 const author={...idea,protagonist:'虚构旅人小舟',tone:'温暖',pov:'第三人称限知',goal:'找到灯塔变化的原因',boundaries:'纯虚构短篇，无真实人物。契约各字段和三章提纲的每个值尽量不超过12字；数组尽量简短；只生成一个约100字的短场景。'};
 const plan=await call(ACTIONS[1],{input:author});
 const projectId='synthetic-live-smoke';
 const project={...author,projectId,contract:plan.contract,outline:plan.outline};
 const chapterId=plan.outline[0].id;
 const draft=await call(ACTIONS[2],{project,chapterIndex:0,chapterId,context:{projectId,version:0,sources:[]}});
 const afterText=`${draft.text}\n小舟把一盏纸灯放在窗边。`;
 const context={projectId,version:1,sources:[{chapterId,revision:1,text:afterText}]};
 await call(ACTIONS[3],{beforeText:draft.text,afterText,chapterId,context});
 await call(ACTIONS[4],{text:afterText,chapterId,context});
 // A schema/evidence smoke result is not semantic approval or a production commit.
 return {kind:'bounded-connectivity-contract-smoke',passed:true,attempts:service.status().callsUsed,results};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{await runLiveSmoke();}catch{process.exitCode=1;}
}
