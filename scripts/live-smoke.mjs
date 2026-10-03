/** Manual, opt-in network smoke. Never imported by the ordinary test suite to make live calls. */
import assert from 'node:assert/strict';
import {createProjectFromConfig,getContext,stageProviderDraft,rejectDraft,editDraft,saveRevision,attachSemanticReview,createReviewBinding,reviewDraft,acceptDraft,beginSemanticReview,getMemoryReviewGate,decideMemoryCandidate,undoCommit,hash} from '../src/domain/engine.js';
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
 const scope=env.NEXUS_SMOKE_SCOPE??'full-flow';
 if(!['planning-only','full-flow'].includes(scope))stop('setup','INVALID_SCOPE');
 const requestedTokens=env.NEXUS_MAX_OUTPUT_TOKENS===undefined?900:Number(env.NEXUS_MAX_OUTPUT_TOKENS);
 if(!Number.isSafeInteger(requestedTokens)||requestedTokens<=0)stop('setup','INVALID_TOKEN_LIMIT');
 const maxTokens=Math.min(requestedTokens,3000);
 // Hard upper bounds override a caller's larger configuration. No retry branch exists.
 const service=createAgentService({env:{...env,NEXUS_MAX_OUTPUT_TOKENS:String(maxTokens),NEXUS_MAX_CALLS:scope==='planning-only'?'1':'5'},fetchImpl});
 if(!service.status().configured)stop('setup','NOT_CONFIGURED');
 const results=[];
 const call=async(action,input)=>{
  try{const output=await service.run(action,input);results.push({action,code:'PASS'});report(action,'PASS');return output;}
  catch(error){
   const code=SAFE_CODES.has(error?.code)?error.code:'SMOKE_FAILED';
   if(code==='OUTPUT_TRUNCATED'&&error.diagnostics){const safe={finishReason:'length'};for(const key of ['finalContentPresent','reasoningContentPresent'])if(typeof error.diagnostics[key]==='boolean')safe[key]=error.diagnostics[key];for(const key of ['promptTokens','completionTokens','totalTokens','reasoningTokens'])if(Number.isSafeInteger(error.diagnostics[key])&&error.diagnostics[key]>=0&&error.diagnostics[key]<=1000000000)safe[key]=error.diagnostics[key];log(`${action} METADATA ${JSON.stringify(safe)}`);}
   stop(action,code);
  }
 };
 // Entirely invented story: no user projects, filesystem contents or source credentials.
 const idea={idea:'虚构童话：小岛灯塔每晚少一层，旅人寻找原因。',title:'纸灯岛'};
 if(scope==='full-flow')await call(ACTIONS[0],{input:idea});
 const author={...idea,protagonist:'虚构旅人小舟',tone:'温暖',pov:'第三人称限知',goal:'找到灯塔变化的原因',boundaries:'纯虚构短篇，无真实人物。契约各字段和三章提纲的每个值尽量不超过12字；数组尽量简短；只生成一个约100字的短场景。'};
 const plan=await call(ACTIONS[1],{input:author});
 if(scope==='planning-only')return {kind:'bounded-connectivity-contract-smoke',scope,passed:true,attempts:service.status().callsUsed,results};
 const domainResults=[];
 const domain=(action,fn)=>{try{const value=fn();domainResults.push({action,code:'PASS'});report(action,'PASS');return value;}catch{stop(action,'DOMAIN_ASSERTION_FAILED');}};
 const projectId='synthetic-live-smoke';
 const project={...author,projectId,contract:plan.contract,outline:plan.outline};
 const original=createProjectFromConfig(project),originalSnapshot=JSON.stringify(original);
 const originalContext=getContext(original),chapterId='ch1';
 const canonical=state=>JSON.stringify({facts:state.facts,knowledge:state.knowledge,evidence:state.evidence,events:state.events,disclosures:state.disclosures});
 const originalCanon=canonical(original);
 const generated=await call(ACTIONS[2],{project,chapterIndex:0,chapterId:plan.outline[0].id,context:originalContext});
 const staged=domain('domainStage',()=>{const state=stageProviderDraft(original,{...generated,context:originalContext},chapterId);assert.equal(canonical(state),originalCanon);assert.equal(JSON.stringify(original),originalSnapshot);assert.equal(state.drafts[0].requiresSemanticReview,true);return state;});
 const draftId=staged.drafts[0].id,stagedSnapshot=JSON.stringify(staged);
 domain('domainReject',()=>{const rejected=rejectDraft(structuredClone(staged),draftId);assert.equal(rejected.drafts[0].status,'REJECTED');assert.equal(rejected.drafts[0].staging.length,0);assert.equal(canonical(rejected),originalCanon);assert.equal(JSON.stringify(staged),stagedSnapshot);assert.equal(JSON.stringify(original),originalSnapshot);});
 const afterText=`${generated.text}\n小舟把一盏纸灯放在窗边。`;
 const edited=domain('domainEdit',()=>{const state=editDraft(staged,draftId,afterText);assert.equal(state.drafts[0].revision,2);assert.equal(state.drafts[0].text,afterText);assert.equal(state.drafts[0].modelReview,null);assert.equal(canonical(state),originalCanon);assert.equal(JSON.stringify(staged),stagedSnapshot);return state;});
 const editedSnapshot=JSON.stringify(edited);
 const revisionBase=saveRevision(original,chapterId,generated.text,original.chapters[0].revision);
 const revisionBranch=saveRevision(revisionBase,chapterId,afterText,revisionBase.chapters[0].revision);
 await call(ACTIONS[3],{beforeText:generated.text,afterText,chapterId,context:getContext(revisionBranch)});
 domain('domainInterpret',()=>{assert.equal(JSON.stringify(original),originalSnapshot);assert.equal(JSON.stringify(edited),editedSnapshot);assert.equal(canonical(edited),originalCanon);});
 const reviewStarted=beginSemanticReview(reviewDraft(edited,draftId),draftId);
 const expectedReview=createReviewBinding(reviewStarted,draftId);
 const modelReview=await call(ACTIONS[4],{text:afterText,chapterId,context:originalContext});
 const reviewed=domain('domainReview',()=>{const attached=attachSemanticReview(reviewStarted,draftId,modelReview,expectedReview);const state=attached;assert.deepEqual(state.drafts[0].modelReview.issues,modelReview.issues);assert.equal(state.drafts[0].review.passed,true);assert.equal(canonical(state),originalCanon);return state;});
 if(modelReview.issues.some(issue=>issue.severity==='error')){
  domain('domainRejectReview',()=>assert.throws(()=>acceptDraft(reviewed,draftId),{code:'SEMANTIC_REVIEW_ERRORS'}));
  log(`domain METADATA ${JSON.stringify({stagedEvents:reviewed.drafts[0].staging.length,promotedEvents:0,acceptedChapters:0,acceptance:'BLOCKED'})}`);
  stop('domainAccept','DOMAIN_REVIEW_BLOCKED');
 }
 // This invented-story smoke explicitly simulates an author choosing supported originals
 // rejecting every candidate because this historical five-call smoke performs no
 // separate isolated support audits. It never turns a bundled judgment into keep.
 const decided=domain('domainMemoryDecisions',()=>{let state=reviewed;for(const item of getMemoryReviewGate(state,draftId))state=decideMemoryCandidate(state,draftId,{candidateId:item.candidateId,action:'reject',reason:'合成烟测未请求任何单条引文核验，作者明确拒绝全部候选记忆',reviewHash:item.reviewHash},item.binding);assert.ok(getMemoryReviewGate(state,draftId).every(item=>item.resolved));return state;});
 const memoryDecisions=decided.drafts[0].memoryDecisions;
 const accepted=domain('domainAccept',()=>{const state=acceptDraft(decided,draftId);assert.equal(state.chapters[0].text,afterText);assert.equal(state.drafts[0].status,'ACCEPTED');const supported=decided.drafts[0].staging.filter(event=>memoryDecisions.some(decision=>decision.candidateId===event.id&&decision.action==='keep'));assert.equal(state.events.length,original.events.length+supported.length);assert.deepEqual(state.events.map(event=>event.source.quote),supported.map(event=>event.sourceQuote));assert.ok(state.events.every(event=>event.source.chapterId===chapterId&&event.status==='confirmed'&&afterText.includes(event.source.quote)));assert.deepEqual(state.facts,original.facts);assert.equal(JSON.stringify(original),originalSnapshot);return state;});
 domain('domainUndo',()=>{const commit=accepted.commits.at(-1),state=undoCommit(accepted,commit.id);assert.equal(canonical(state),originalCanon);assert.equal(state.chapters[0].text,afterText);assert.deepEqual(state.chapters[0].revisions,accepted.chapters[0].revisions);assert.equal(state.commits.at(-1).kind,'compensation');assert.equal(state.commits.at(-1).undoes,commit.id);assert.ok(state.commits.some(item=>item.id===commit.id));});
 const domainSummary={stagedEvents:staged.drafts[0].staging.length,promotedEvents:accepted.events.length-original.events.length,acceptedChapters:1,acceptance:'ACCEPTED_THEN_COMPENSATED',memoryDecisionPolicy:'synthetic-author-reject-all-no-isolated-audits',keptCandidates:memoryDecisions.filter(item=>item.action==='keep').length,rejectedCandidates:memoryDecisions.filter(item=>item.action==='reject').length,overriddenCandidates:0};
 log(`domain METADATA ${JSON.stringify(domainSummary)}`);
 // Pure in-memory domain checks do not establish independent semantic truth.
 return {kind:'bounded-connectivity-contract-smoke',scope,passed:true,attempts:service.status().callsUsed,results,domainResults,domainSummary};

}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{await runLiveSmoke();}catch{process.exitCode=1;}
}
