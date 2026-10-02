/** One synthetic fact-contradiction assessment, not browser E2E or an accuracy estimate. */
import {pathToFileURL} from 'node:url';
import {createAgentService,SAFE_VALIDATION_REASONS} from '../server/provider.js';
import {journeyConfig,SAFE_CODES} from './live-journey-guard.mjs';
import * as engine from '../src/domain/engine.js';
export async function runReviewProbe({env=process.env,fetchImpl=globalThis.fetch,log=console.log}={}){
 if(env.NEXUS_REVIEW_PROBE_APPROVED!=='true')throw Error('APPROVAL_REQUIRED');
 const service=createAgentService({env:{...journeyConfig(env),NEXUS_MAX_CALLS:'1'},fetchImpl});
 // Entirely synthetic domain fixture. No storage/browser injection or author exception.
 const fact='小舟的纸灯是蓝色的。';
 let state=engine.createProjectFromConfig({projectId:'synthetic-review-probe',title:'纸灯岛',idea:'旅人查找灯塔每晚少一层的原因',protagonist:'小舟',tone:'温暖好奇',pov:'第三人称限知',goal:'查找灯塔变化的原因',boundaries:'纯虚构短篇，不出现真实人物或血腥情节。',chapters:[{text:'小舟来到岛上，看到灯塔比昨天低了一层。\n'+fact}]});
 state=engine.commitPatch(state,engine.proposeCustomPatch(state,'ch1',{intent:'author_fact',statement:fact}));
 const text='小舟提着自己的那盏小红纸灯走到塔下。那盏灯一直是红色的，没有被染色或更换。潮声从石缝间传来，他把纸灯举高，在水痕旁做了记号。';
 const context=engine.getContext(state);
 state=engine.stageProviderDraft(state,{text,context,provider:{id:'synthetic-candidate',isLive:true}},'ch2');
 const id=state.drafts[0].id;state=engine.reviewDraft(state,id);const binding=engine.createReviewBinding(state,id);
 const input={text,chapterId:'ch2',context};
 try{
  const out=await service.run('reviewChapter',input);
  state=engine.attachSemanticReview(state,id,out,binding);
  const ledger=engine.getFactReviewGate(state,id),contradictions=ledger.filter(x=>x.status==='contradiction'&&x.provenanceValid&&x.blocking&&!x.resolved).length;
  if(contradictions!==1)throw Error('ASSESSMENT_NOT_ESTABLISHED');
  let blocked=false;try{engine.acceptDraft(state,id)}catch(error){blocked=error.code==='FACT_DECISION_REQUIRED'}
  if(!blocked||state.drafts[0].status==='ACCEPTED'||state.drafts[0].factDecisions?.length||state.events.length)throw Error('GATE_NOT_ESTABLISHED');
  const errors=out.issues.filter(i=>i.severity==='error').length;
  log(`review-probe PASS ${service.status().callsUsed} ${out.issues.length} ${errors} ${contradictions} 1`);
  return {passed:true,attempts:service.status().callsUsed,issues:out.issues.length,errors,contradictions,blocked:true};
 }catch(error){const code=SAFE_CODES.has(error?.code)?error.code:['ASSESSMENT_NOT_ESTABLISHED','GATE_NOT_ESTABLISHED'].includes(error?.message)?error.message:'PROBE_FAILED';log(`review-probe ${code} ${service.status().callsUsed}`);if(SAFE_VALIDATION_REASONS.includes(error?.validationReason))log(`validation ${error.validationReason}`);throw Error('Review probe stopped');}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{await runReviewProbe();}catch{process.exitCode=1;}}
