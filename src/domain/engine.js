/** Deterministic, local demonstration runtime. No LLM is called. */
export const NEVER_MET = '陈默从未见过死者。';
export const HAS_MET = '陈默三年前见过死者，但一直隐瞒。';
export const PHONE = '林夏接到电话，得知交易地点在旧码头。';
export const PAPER = '林夏展开地址纸条，上面写着旧码头。';
const copy = (x) => structuredClone(x);
export function hash(text) { let n = 2166136261; for (const c of text) n = Math.imul(n ^ c.charCodeAt(0), 16777619); return (n >>> 0).toString(16); }
const fail = (code, message) => { const e = new Error(message); e.code = code; throw e; };
const chapter = (s,id) => s.chapters.find(c=>c.id===id) || fail('NOT_FOUND','章节不存在');
const draft = (s,id) => s.drafts.find(d=>d.id===id) || fail('NOT_FOUND','草稿不存在');
const relation = (s) => s.facts.find(f=>f.id==='relationship');
const snapshot = (s) => copy({facts:s.facts,knowledge:s.knowledge,evidence:s.evidence,plans:s.plans,events:s.events,disclosures:s.disclosures});
function revisionRecord(c,text,revision) {return {id:`${c.id}-r${revision}`,revision,text,hash:hash(text),paragraphs:text.split('\n').map((text,i)=>({id:`p${i+1}`,text}))};}
export function createInitialState(projectId = 'mist-harbor') {
 const chapters = [
 {id:'ch1',title:'第一章 旧信',text:`母亲去世后的第七天，林夏回到雾港。旧信叠在窗边，信封上的字迹始终没有变。\n${PHONE}\n${PAPER}\n纸条背面有一行小字：潮声之后，别回头。`},
 {id:'ch2',title:'第二章 雨夜证词',text:`雨点敲打着审讯室的窗。陈默缓缓走向窗前。\n${NEVER_MET}\n警方尚不知道陈默与死者的真实关系。林夏站在走廊尽头，攥着母亲留下的信。\n“那天晚上，你在哪里？”警员问。陈默没有立刻回答。`},
 {id:'ch3',title:'第三章 潮声之后',text:'林夏来到旧码头，海雾遮住了仓库的门。\n风暴即将登陆，最后一班渡轮已经停航。她想起纸条上的那句话，却不明白母亲为什么让她别回头。'}
 ].map(c=>({...c,revision:1,syncedRevision:1,status:'ACCEPTED',syncStatus:'CLEAN',revisions:[revisionRecord(c,c.text,1)]}));
 return {schemaVersion:1,mode:'demo',projectId,title:'雾港来信',version:1,chapters,
 facts:[{id:'relationship',subject:'陈默',predicate:'与死者的关系',value:'never_met',label:'陈默从未见过死者',status:'confirmed',recordVersion:1,validStoryFrom:'过去',source:{chapterId:'ch2',revision:1,paragraphId:'p2',quote:NEVER_MET}}],
 knowledge:[{id:'police-relationship',holder:'警方',proposition:'陈默与死者过去相识',status:'explicitly_unaware',label:'警方仍未获知过去相识的秘密',supportSets:[]},{id:'lin-address',holder:'林夏',proposition:'交易地点在旧码头',status:'knows',label:'林夏知道交易地点',supportSets:[['phone'],['paper']],at:3}],
 evidence:[{id:'phone',label:'电话告知',chapterId:'ch1',revision:1,paragraphId:'p2',quote:PHONE,active:true,storyTime:1},{id:'paper',label:'地址纸条',chapterId:'ch1',revision:1,paragraphId:'p3',quote:PAPER,active:true,storyTime:2}],
 plans:[{id:'stranger',title:'陌生人的不在场证明',chapter:6,description:'以二人确实陌生为前提排除陈默',condition:'never_met',status:'valid'}, {id:'police-reveal',title:'警方首次发现相识',chapter:15,description:'警方通过旧记录第一次发现二人曾经相识',condition:'police_unaware',status:'valid'}, {id:'storm',title:'风暴封港',chapter:8,description:'暴风雨阻断海上救援，与人物关系无关',condition:'independent',status:'valid'}, {id:'visit',title:'林夏前往交易地点',chapter:8,description:'需在出发前具有有效的地址来源',condition:'address_support',status:'valid'}],
 events:[],disclosures:[],preferences:[],drafts:[],commits:[],factHistory:[],pendingPatches:[],derived:[],sequence:0};
}
export function saveRevision(state,chapterId,text,expectedRevision) {
 const c=chapter(state,chapterId); if(expectedRevision!==c.revision) fail('STALE_REVISION','正文版本已变化，请重新加载');
 if(typeof text!=='string'||!text.trim()) fail('INVALID_TEXT','正文不能为空'); if(text===c.text)return copy(state);
 const s=copy(state), next=chapter(s,chapterId);next.text=text;next.revision++;next.syncStatus='PENDING';next.revisions.push(revisionRecord(next,text,next.revision));
 s.derived=s.derived.map(x=>x.chapterId===chapterId?{...x,status:'stale'}:x);return s;
}
function source(c,quote){const pos=c.text.indexOf(quote);return {chapterId:c.id,revision:c.revision,revisionId:`${c.id}-r${c.revision}`,paragraphId:`p${c.text.slice(0,Math.max(0,pos)).split('\n').length}`,quote,start:pos,end:pos+quote.length};}
export function proposePatch(state,chapterId) {
 const c=chapter(state,chapterId), prev=c.revisions.find(r=>r.revision===(c.syncedRevision??1))?.text ?? c.text;
 const p={id:`patch-${state.projectId}-${chapterId}-${c.revision}-${state.version}`,projectId:state.projectId,baseVersion:state.version,chapterId,revision:c.revision,textHash:hash(c.text),intents:[],scope:'chapter',status:'proposed',summary:'',operations:[],questions:[],evidence:[]};
 if(c.syncStatus==='CLEAN'){p.status='noop';p.summary='正文与记忆已同步';return p;}
 let expected=prev;
 if(state.mode!=='custom'&&chapterId==='ch2'&&prev.includes(NEVER_MET)&&c.text.includes(HAS_MET)&&!c.text.includes(NEVER_MET)) {
  p.intents.push('canon_update','event_update');p.scope='story';p.operations.push({op:'set_relationship',targetId:'relationship',expectedRecordVersion:relation(state).recordVersion,value:'has_met',validStoryFrom:'案发前三年',source:source(c,HAS_MET)});p.evidence.push(source(c,HAS_MET));expected=expected.replace(NEVER_MET,HAS_MET);
 }
 if(state.mode!=='custom'&&chapterId==='ch1') for(const e of state.evidence){if(prev.includes(e.quote)&&!c.text.includes(e.quote)&&e.active){p.operations.push({op:'remove_evidence',targetId:e.id});p.intents.push('knowledge_support_update');expected=expected.replace(e.quote+'\n','').replace(e.quote,'');}}
 const normalize=t=>t.replace(/缓缓走向窗前/g,'走到窗前').replace(/雨点敲打着审讯室的窗/g,'雨敲着审讯室的窗').replace(/\s+/g,'');
 if(normalize(c.text)!==normalize(expected)){p.status='blocked';p.intents.push('ambiguous');p.questions.push('这处修改是世界真相、角色证词，还是局部表达？当前演示解释器无法可靠判断，请保留待决。');p.summary='存在未支持或含糊修改，正文已保存，记忆尚未提交';}
 else if(!p.operations.length){p.intents.push('local_prose');p.summary='仅更新本章表达，不新增全局设定或文风规则';}
 else p.summary=p.operations.some(o=>o.op==='set_relationship')?'修订过去相识的世界事实；警方仍不知情；精确复核相关计划':'移除失效来源，并检查其他独立且时间有效的支持';
 return p;
}
export function evaluateSupport(state,assertionId='lin-address',at) {
 const k=state.knowledge.find(k=>k.id===assertionId);if(!k)fail('NOT_FOUND','认知记录不存在');const time=at??k.at??Infinity;
 const paths=k.supportSets.filter(set=>set.length&&set.every(id=>{const e=state.evidence.find(e=>e.id===id);return e&&e.active&&e.storyTime<=time;}));
 return {status:paths.length?'supported':'unsupported',validPaths:copy(paths),sourceIds:[...new Set(paths.flat())],explanation:paths.length?'至少一条独立支持路径在行动前有效':'缺少行动前有效支持；不等于命题为假或角色明确不知道'};
}
export function getImpacts(state) {if(state.mode==='custom')return copy(state.plans).map(p=>({...p,reason:p.reason||'作者提供的章节计划；尚未执行通用语义依赖检查'}));return state.plans.map(p=>{let valid=true,reason='不依赖本次关系变化，保留原计划';if(p.condition==='never_met'){valid=relation(state).value==='never_met';reason=valid?'陌生前提仍成立':'二人确实陌生的前提已被推翻，必须重新规划';}if(p.condition==='police_unaware'){valid=state.knowledge.find(k=>k.id==='police-relationship').status==='explicitly_unaware';reason='警方尚未获知，首次揭示仍然成立';}if(p.condition==='address_support'){valid=evaluateSupport(state).status==='supported';reason=evaluateSupport(state).explanation;}return {...p,status:valid?'valid':p.condition==='address_support'?'needs_review':'invalid',reason};});}
function applyOperations(s,p){for(const o of p.operations){if(o.op==='set_relationship'){const old=copy(relation(s));s.factHistory.push({...old,status:'superseded',recordedToVersion:s.version+1});Object.assign(relation(s),{value:o.value,label:'陈默三年前见过死者，但一直隐瞒',recordVersion:old.recordVersion+1,validStoryFrom:o.validStoryFrom,source:o.source,supersedesVersion:old.recordVersion});s.events.push({id:`past-meeting-${p.id}`,label:'陈默与死者三年前相见',storyTime:'案发前三年',status:'confirmed',source:o.source});s.disclosures.push({id:`reveal-${p.id}`,proposition:'过去相识',audience:'reader',status:'explicit',source:o.source});}else if(o.op==='supersede_author_fact'){const current=s.facts.find(f=>f.id===o.targetId),old=copy(current);s.factHistory.push({...old,status:'superseded',recordedToVersion:s.version+1});Object.assign(current,{label:o.statement,value:o.statement,recordVersion:old.recordVersion+1,recordedFromVersion:s.version+1,supersedesVersion:old.recordVersion,source:copy(o.source)});}else if(o.op==='append_author_fact'){s.facts.push({id:`author-fact-${p.id}`,projectId:s.projectId,label:o.statement,value:o.statement,predicate:'作者确认的设定',subject:'作者决定',status:'confirmed',authority:'explicit_author_decision',recordVersion:1,recordedFromVersion:s.version+1,source:copy(o.source)});}else if(o.op==='remove_evidence'){s.evidence.find(e=>e.id===o.targetId).active=false;}}
 const k=s.knowledge.find(k=>k.id==='lin-address');if(k)k.status=evaluateSupport(s).status==='supported'?'knows':'unsupported';s.plans=getImpacts(s);}
export function validatePatch(state,p) {
 const errors=[];if(!p||p.projectId!==state.projectId)errors.push('跨项目补丁被拒绝');
 if(p?.baseVersion!==state.version)errors.push('状态版本已变化');const c=state.chapters.find(c=>c.id===p?.chapterId);
 if(!c||p.revision!==c.revision||p.textHash!==hash(c.text))errors.push('正文 revision 或哈希已变化');
 if(p?.status==='blocked'||p?.questions?.length)errors.push('存在未解决的语义歧义');
 if(c&&p.projectId===state.projectId){let canonical;try{canonical=p.authorInstruction?proposeCustomPatch(state,c.id,p.authorInstruction):proposePatch(state,c.id);}catch{errors.push('作者确认指令无效');}if(canonical&&(JSON.stringify(p.operations)!==JSON.stringify(canonical.operations)||p.status!==canonical.status||p.instructionHash!==canonical.instructionHash))errors.push('补丁操作缺少原文支持或被篡改');}
 for(const o of p?.operations??[]){if(o.op==='set_relationship'&&o.expectedRecordVersion!==relation(state).recordVersion)errors.push('目标记录版本已变化');if(o.op==='supersede_author_fact'){const target=state.facts.find(f=>f.id===o.targetId);if(!target||target.projectId!==state.projectId||target.status!=='confirmed'||target.authority!=='explicit_author_decision'||target.recordVersion!==o.expectedRecordVersion)errors.push('作者设定目标不存在、不可替代或记录版本已变化');}if(!['set_relationship','remove_evidence','append_author_fact','supersede_author_fact'].includes(o.op))errors.push('未知操作');}
 let impacts=getImpacts(state);if(!errors.length){const s=copy(state);applyOperations(s,p);impacts=getImpacts(s);}return {valid:!errors.length,errors,impacts};
}
export function commitPatch(state,p) {
 const prior=state.commits.find(c=>c.patchId===p.id);if(prior){if(prior.patchHash!==hash(JSON.stringify(p)))fail('IDEMPOTENCY_CONFLICT','同一操作 ID 对应不同补丁');return copy(state);}
 const check=validatePatch(state,p);if(!check.valid)fail('INVALID_PATCH',check.errors.join('；'));if(p.status==='noop')return copy(state);
 const s=copy(state),before=snapshot(s);applyOperations(s,p);s.version++;chapter(s,p.chapterId).syncStatus='CLEAN';chapter(s,p.chapterId).syncedRevision=p.revision;s.sequence++;
 s.commits.push({id:`commit-${s.sequence}`,kind:'patch',patchId:p.id,patchHash:hash(JSON.stringify(p)),version:s.version,summary:p.summary,chapterId:p.chapterId,revision:p.revision,before,after:snapshot(s),dependencies:[],operations:copy(p.operations)});return s;
}
export function undoCommit(state,commitId) {
 const c=state.commits.find(c=>c.id===commitId);if(!c)fail('NOT_FOUND','提交不存在');if(state.commits.some(x=>x.undoes===commitId))return copy(state);
 if(c.kind==='compensation')fail('INVALID_UNDO','不能简单撤销补偿记录');
 const later=state.commits.filter(x=>x.version>c.version&&!state.commits.some(y=>y.undoes===x.id));if(later.some(x=>x.dependencies?.includes(commitId))||JSON.stringify(snapshot(state))!==JSON.stringify(c.after))fail('DEPENDENT_COMMIT','后续提交依赖或改变了这份状态，不能直接逆操作');
 const s=copy(state),before=snapshot(s);Object.assign(s,copy(c.before));s.version++;s.sequence++;
 s.commits.push({id:`commit-${s.sequence}`,kind:'compensation',undoes:commitId,version:s.version,summary:'补偿撤销：保留全部正文和提交历史',before,after:snapshot(s),dependencies:[]});
 if(c.chapterId){chapter(s,c.chapterId).syncStatus='NEEDS_REVIEW';chapter(s,c.chapterId).syncedRevision=Math.max(1,(c.revision??2)-1);}return s;
}
export function getContext(state) {
 return {projectId:state.projectId,version:state.version,view:'writer',sceneTime:3,pov:state.mode==='custom'?(state.config?.protagonist??'主角'):'林夏',facts:copy(state.facts.filter(f=>f.status==='confirmed')),knowledge:copy(state.knowledge),forbiddenReveals:state.mode==='custom'?(state.config?.constraints??[]):['警方不得无来源得知陈默与死者过去相识'],plans:getImpacts(state),obligations:state.mode==='custom'?[]:[{id:'letter-origin',label:'母亲多年收到的旧信：寄信人仍待揭示',status:'OPEN'}],sources:state.chapters.map(c=>({chapterId:c.id,revision:c.revision,revisionId:`${c.id}-r${c.revision}`,text:c.text,channel:'original_text'})),summaries:copy(state.derived.filter(x=>x.status==='valid'&&chapter(state,x.chapterId).revision===x.revision)),support:state.knowledge.some(k=>k.id==='lin-address')?evaluateSupport(state):{status:'unsupported',validPaths:[],sourceIds:[]},staging:[]};
}
export function generateDraft(state) {
 if(state.mode==='custom')fail('PROVIDER_REQUIRED','自定义项目需要已配置的模型生成结果；预置演示不会冒充通用生成');
 if(state.chapters.some(c=>c.syncStatus!=='CLEAN'))fail('UNSYNCED_TEXT','正文与故事状态仍待同步或冲突复核');
 const s=copy(state);s.sequence++;const id=`draft-${s.sequence}`,met=relation(s).value==='has_met';
 const text=`风暴压低了雾港的天色。林夏把旧信收进衣袋，走到仓库门前。\n${met?'陈默望着旧码头，避开了警员的视线。三年前的那次见面，他仍没有说出口。':'陈默站在警戒线外。他与死者素未谋面，眼前的一切都让他陌生。'}\n警方继续核对雨夜的行踪，并没有得知被隐瞒的关系。\n林夏从门框上方取下一把铜钥匙。\n她用铜钥匙打开仓库的门，潮湿的纸张气味迎面涌来。\n远处传来停航广播。信封上的字迹，和门内账簿上的字迹一模一样。`;
 s.drafts.push({id,projectId:s.projectId,runId:`run-${s.sequence}`,revision:1,baseVersion:s.version,chapterRevisions:Object.fromEntries(s.chapters.map(c=>[c.id,c.revision])),status:'DRAFT',text,textHash:hash(text),provider:'deterministic-demo',staging:[{id:`key-${id}`,label:'林夏获得铜钥匙',status:'proposed',acquiredScene:1,usedScene:2,sourceQuote:'林夏从门框上方取下一把铜钥匙。'}],context:getContext(s),review:null});return s;
}
function issuesFor(s,d){const issues=[];const add=(ruleId,explanation)=>issues.push({ruleId,severity:'error',explanation,certainty:'deterministic',suggestedAction:'修正正文或重新生成并审查'});
 if(d.projectId!==s.projectId)add('PROJECT','草稿不属于当前项目');if(d.baseVersion!==s.version)add('STATE_VERSION','草稿基于旧状态版本');if(s.chapters.some(c=>d.chapterRevisions[c.id]!==c.revision))add('TEXT_VERSION','源正文已变更');if(s.chapters.some(c=>c.syncStatus!=='CLEAN'))add('UNSYNCED','源正文存在未解决的记忆同步');
 if(typeof d.text!=='string'||!d.text.trim())add('EMPTY_TEXT','草稿正文不能为空');if(!s.chapters.some(c=>c.id===(d.chapterId||'ch3')))add('CHAPTER','草稿目标章节不存在');
 if(s.mode==='custom')return issues;
 if(d.text.includes('用铜钥匙打开')&&!d.text.includes('取下一把铜钥匙'))add('KEY_SUPPORT','开门动作缺少此前获得钥匙的来源');if(d.text.includes('警方已经知道')||d.text.includes('警方早已知道'))add('KNOWLEDGE_LEAK','警方无来源提前获知秘密');if(relation(s)?.value==='has_met'&&d.text.includes('素未谋面'))add('CANON','草稿仍使用被替代的陌生关系');return issues;}
export function reviewDraft(state,id){const s=copy(state),d=draft(s,id);if(!['DRAFT','IN_REVIEW'].includes(d.status))fail('DRAFT_STATUS','只能审查待定草稿');const issues=issuesFor(s,d);d.review={stateVersion:s.version,chapterId:d.chapterId||'ch3',stagingHash:hash(JSON.stringify(d.staging)),textHash:hash(d.text),revision:d.revision,issues,passed:!issues.length,checks:s.mode==='custom'?['项目隔离','状态版本','正文版本','目标章节','非空正文']:['状态版本','正文版本','角色知识边界','钥匙获取前置条件','已确认关系'],semanticStatus:s.mode==='custom'?'not_evaluated':'fixture_rules_only',limitations:s.mode==='custom'?['仅通过确定性版本与结构检查；通用语义一致性、角色知识与文风需作者复核']:['预置案例规则审查，不代表通用语义完备性']};d.status='IN_REVIEW';return s;}
export function editDraft(state,id,text){if(typeof text!=='string'||!text.trim())fail('INVALID_TEXT','正文不能为空');const s=copy(state),d=draft(s,id);if(!['DRAFT','IN_REVIEW'].includes(d.status))fail('DRAFT_STATUS','只能编辑待定草稿');d.text=text;d.textHash=hash(text);d.revision++;d.review=null;d.modelReview=null;d.status='DRAFT';return s;}
export function acceptDraft(state,id){const original=draft(state,id);if(original.status==='ACCEPTED')return copy(state);if(original.status==='REJECTED')fail('DRAFT_STATUS','拒绝的草稿不能接受');if(!original.review?.passed||original.review.chapterId!==(original.chapterId||'ch3')||original.review.stagingHash!==hash(JSON.stringify(original.staging))||original.review.textHash!==hash(original.text)||original.review.stateVersion!==state.version||original.review.revision!==original.revision||issuesFor(state,original).length)fail('REVIEW_REQUIRED','请对当前正文与当前状态重新审查');
 if(original.requiresSemanticReview&&!currentSemanticReview(state,original))fail('SEMANTIC_REVIEW_REQUIRED','真实模型草稿需要当前版本的模型审查建议；模型审查不是独立真实性证明');if(original.requiresSemanticReview&&original.modelReview.issues.some(i=>i.severity==='error'))fail('SEMANTIC_REVIEW_ERRORS','模型审查发现阻塞问题，请修改并重新审查');
 const s=copy(state),d=draft(s,id),before=snapshot(s);d.status='ACCEPTED';const c=chapter(s,d.chapterId||'ch3');c.text=d.text;c.revision++;c.revisions.push(revisionRecord(c,c.text,c.revision));c.status='ACCEPTED';c.syncStatus='CLEAN';c.syncedRevision=c.revision;s.version++;s.sequence++;
 for(const e of d.staging)if(d.text.includes(e.sourceQuote))s.events.push({...e,status:'confirmed',draftId:id,source:{chapterId:c.id,revision:c.revision,quote:e.sourceQuote}});
 s.commits.push({id:`commit-${s.sequence}`,kind:'draft_accept',draftId:id,version:s.version,summary:'接受经当前版本审查的候选稿',before,after:snapshot(s),dependencies:s.commits.filter(x=>x.kind==='patch'&&!s.commits.some(y=>y.undoes===x.id)).map(x=>x.id),chapterId:c.id,revision:c.revision});return s;}
export function rejectDraft(state,id){const s=copy(state),d=draft(s,id);if(d.status==='ACCEPTED')fail('DRAFT_STATUS','已接受草稿需要补偿撤销');d.status='REJECTED';d.staging=[];return s;}

/** Generic projects contain only user-supplied configuration, never demo Canon. */
export function createProjectFromConfig(config = {}) {
 const s=createInitialState(config.projectId || `project-${hash(JSON.stringify(config))}`);
 s.mode='custom';s.title=config.title||'未命名小说';s.config=copy(config);
 s.facts=[];s.knowledge=[];s.evidence=[];s.plans=(Array.isArray(config.outline)?config.outline:[]).map((p,i)=>({id:`outline-${i+1}`,title:typeof p==='string'?p:p.title||`第${i+1}章`,chapter:i+1,description:typeof p==='string'?p:p.description||p.goal||'',status:'ready',condition:'author_outline'}));s.events=[];s.disclosures=[];
 const premise=config.premise||config.idea||'尚未填写故事灵感';
 s.chapters=[1,2,3].map((n)=>{const c={id:`ch${n}`,title:config.chapters?.[n-1]?.title||`第${n}章 待创作`,text:config.chapters?.[n-1]?.text||`【创作规划，尚非生成正文】\n${premise}\n本章正文等待作者或已配置的模型提供。`,revision:1,syncedRevision:1,status:'PLANNED',syncStatus:'CLEAN'};return {...c,revisions:[revisionRecord(c,c.text,1)]};});return s;
}

/** Call only for an explicit author classification, not provider-inferred instructions. */
export function proposeCustomPatch(state,chapterId,instruction) {
 if(state.mode!=='custom')fail('PROJECT_MODE','作者分类接口仅用于自定义项目');
 if(!instruction||!['local_prose','author_fact'].includes(instruction.intent))fail('AUTHOR_INSTRUCTION','需要作者明确选择局部表达或确认设定');
 const c=chapter(state,chapterId),statement=typeof instruction.statement==='string'?instruction.statement.trim():'';
 if(instruction.intent==='author_fact'&&(!statement||!c.text.includes(statement)))fail('AUTHOR_EVIDENCE','确认的设定必须是当前正文中的完整原文片段');
 let target;
 if(instruction.targetFactId!==undefined){if(instruction.intent!=='author_fact'||typeof instruction.targetFactId!=='string'||!instruction.targetFactId)fail('AUTHOR_TARGET','只有明确设定修改可以选择替代目标');target=state.facts.find(f=>f.id===instruction.targetFactId);if(!target||target.projectId!==state.projectId||target.status!=='confirmed'||target.authority!=='explicit_author_decision')fail('AUTHOR_TARGET','替代目标必须是同一项目中已确认的作者设定');}
 const authorInstruction={intent:instruction.intent,...(instruction.intent==='author_fact'?{statement}:{}),...(target?{targetFactId:target.id}:{})};
 const instructionHash=hash(JSON.stringify({projectId:state.projectId,revision:c.revision,textHash:hash(c.text),authorInstruction}));
 const evidence=source(c,instruction.intent==='author_fact'?statement:c.text);
 return {id:`author-patch-${state.projectId}-${chapterId}-${c.revision}-${state.version}-${instructionHash}`,projectId:state.projectId,baseVersion:state.version,chapterId,revision:c.revision,textHash:hash(c.text),intents:[instruction.intent],scope:instruction.intent==='author_fact'?'story':'chapter',status:'proposed',summary:instruction.intent==='author_fact'?(target?'替代作者明确选择的现有设定，保留原记录与出处':'记录作者明确确认的设定，不进行额外语义推断'):'按作者分类保存局部表达，不提升为长期设定',operations:instruction.intent==='author_fact'?[{op:target?'supersede_author_fact':'append_author_fact',...(target?{targetId:target.id,expectedRecordVersion:target.recordVersion}:{}),statement,source:evidence}]:[],questions:[],evidence:[evidence],authorInstruction,instructionHash};
}
/** Stage a provider result against the exact context snapshot it consumed. */
export function stageProviderDraft(state,result,chapterId) {
 chapter(state,chapterId);
 if(state.chapters.some(c=>c.syncStatus!=='CLEAN'))fail('UNSYNCED_TEXT','先处理未同步的作者修改，再保存生成候选');
 if(!result||typeof result.text!=='string'||!result.text.trim())fail('INVALID_TEXT','模型结果缺少有效正文');
 const context=result.context;
 if(!context||context.projectId!==state.projectId)fail('PROJECT_MISMATCH','模型结果缺少同项目的上下文快照');
 if(context.version!==state.version)fail('STALE_STATE','模型结果基于过时的故事状态');
 if(!Array.isArray(context.sources)||state.chapters.some(c=>!context.sources.some(x=>x.chapterId===c.id&&x.revision===c.revision&&x.text===c.text)))fail('STALE_REVISION','模型结果基于过时或缺失的正文快照');
 if(result.staging!==undefined&&!Array.isArray(result.staging))fail('INVALID_STAGING','草稿暂存变化必须是数组');
 const staging=(result.staging??[]).map((e,i)=>{if(!e||typeof e.label!=='string'||!e.label.trim()||typeof e.sourceQuote!=='string'||!e.sourceQuote.trim()||!result.text.includes(e.sourceQuote))fail('INVALID_STAGING','草稿事件需要当前候选正文中的原文证据');return {id:`staged-${state.sequence+1}-${i+1}`,label:e.label,sourceQuote:e.sourceQuote,status:'proposed'};});
 const s=copy(state);s.sequence++;const id=`draft-${s.sequence}`;
 s.drafts.push({id,projectId:s.projectId,chapterId,runId:`run-${s.sequence}`,revision:1,baseVersion:s.version,chapterRevisions:Object.fromEntries(s.chapters.map(c=>[c.id,c.revision])),status:'DRAFT',text:result.text,textHash:hash(result.text),provider:typeof result.provider==='string'?result.provider:(result.provider?.id||'external-provider'),providerInfo:typeof result.provider==='object'&&result.provider?copy(result.provider):null,requiresSemanticReview:Boolean(result.provider?.isLive),modelReview:null,staging,context:copy(context),review:null});return s;
}

function currentSemanticReview(state,d) {
 const r=d.modelReview;
 return Boolean(r&&r.stateVersion===state.version&&r.draftRevision===d.revision&&r.textHash===hash(d.text)&&r.chapterId===(d.chapterId||'ch3')&&r.stagingHash===hash(JSON.stringify(d.staging))&&state.chapters.every(c=>r.chapterRevisions?.[c.id]===c.revision&&d.chapterRevisions?.[c.id]===c.revision)&&!issuesFor(state,d).length);
}
/** Attach a model's advisory, never a source of authoritative Canon changes. */
export function attachSemanticReview(state,draftId,report,expected) {
 const original=draft(state,draftId);
 if(!['DRAFT','IN_REVIEW'].includes(original.status))fail('DRAFT_STATUS','只能审查待定草稿');
 if(!expected||expected.stateVersion!==state.version||expected.draftRevision!==original.revision||expected.textHash!==hash(original.text)||original.baseVersion!==state.version)fail('STALE_SEMANTIC_REVIEW','模型审查结果与当前状态或草稿版本不一致');
 if(original.projectId!==state.projectId||state.chapters.some(c=>original.chapterRevisions?.[c.id]!==c.revision||c.syncStatus!=='CLEAN'))fail('STALE_SEMANTIC_REVIEW','模型审查使用的项目或源正文已变化');
 if(!report||typeof report.summary!=='string'||!Array.isArray(report.issues)||!Array.isArray(report.checks)||report.checks.some(x=>typeof x!=='string')||!(typeof report.provider==='string'&&report.provider.trim()||report.provider&&typeof report.provider==='object'&&typeof report.provider.id==='string'&&report.provider.id.trim()))fail('INVALID_SEMANTIC_REVIEW','模型审查报告格式不完整');
 for(const issue of report.issues){
  if(!issue||typeof issue!=='object'||Array.isArray(issue)||Object.keys(issue).some(k=>!['severity','explanation','sourceQuote'].includes(k))||!['error','warning'].includes(issue.severity)||typeof issue.explanation!=='string'||!issue.explanation.trim()||typeof issue.sourceQuote!=='string'||!issue.sourceQuote.trim()||!original.text.includes(issue.sourceQuote))fail('INVALID_SEMANTIC_REVIEW','每项审查问题必须使用合法级别、说明和当前草稿中的精确原文证据');
 }
 const s=copy(state),d=draft(s,draftId);
 d.modelReview={summary:report.summary,issues:copy(report.issues),checks:copy(report.checks),provider:copy(report.provider),stateVersion:s.version,draftRevision:d.revision,textHash:hash(d.text),chapterId:d.chapterId||'ch3',stagingHash:hash(JSON.stringify(d.staging)),chapterRevisions:copy(d.chapterRevisions),semanticStatus:'model_reviewed_unverified',advisory:true,limitations:['模型审查是候选判断，并非独立真实性或全面语义一致性证明；作者仍需核对来源与知识获取路径']};
 return s;
}
