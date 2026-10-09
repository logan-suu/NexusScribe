import type {ChangeEvent} from 'react';
import type {State, Draft, ExtractionRecord, AuthorInstruction} from './domain/types.js';
import type {ProjectConfig} from './authoring/types.js';
import type {Workspace} from './storage.js';
import type {EvidenceRecord} from './components/Inspector.js';
import type {WorkspaceTab} from './components/Sidebar.js';
import type {FactReviewItem, MemoryReviewItem, AuditBudget} from './components/DraftPanel.js';
import type {RevisionAdoptionChoice, RevisionAdoptionOptions} from './components/RevisionAdoptionDialog.js';
import type {ModelTask} from './hooks/useModelTask.js';
import {errorMessage, errorCode} from './hooks/useModelTask.js';
interface FactDecisionChoice {id: string; item: FactReviewItem; binding: ReturnType<typeof engine.createReviewBinding>; reviewHash: string}
interface MemoryDecisionChoice {id: string; item: MemoryReviewItem; binding: NonNullable<MemoryReviewItem['binding']>; reviewHash: string}
interface ContextRefreshChoice {id: string; snapshot: string; chapterTitle?: string}
interface ExtractionSkipChoice {id: string; snapshot: string; revision: number; textHash: string; count: number; status: ExtractionRecord['status']}
interface AcceptanceChoice {
 id: string; chapterTitle?: string; snapshot: string; draftRevision?: number; textHash?: string;
 manualSource?: Draft['manualSource']; extractionStatus?: ExtractionRecord['status']; selected: MemoryReviewItem[]; total: number;
}
interface Interpretation {summary?: string; questions: string[]; suggestedFacts: {label: string; sourceQuote: string}[]}
function interpretationView(report: Awaited<ReturnType<ReturnType<typeof createServerProvider>['interpretRevision']>>): Interpretation {
 return {summary:typeof report.summary==='string'?report.summary:undefined,questions:report.questions.filter((value): value is string=>typeof value==='string'),suggestedFacts:(Array.isArray(report.suggestedFacts)?report.suggestedFacts:[]).flatMap((value: unknown)=>typeof value==='object'&&value!==null&&'label' in value&&typeof value.label==='string'&&'sourceQuote' in value&&typeof value.sourceQuote==='string'?[{label:value.label,sourceQuote:value.sourceQuote}]:[])};
}
function readAuditBudget(status: import('./adapters/provider.js').ProviderStatus): AuditBudget | null {
 const {callsUsed,maxCalls}=status;
 return typeof callsUsed==='number'&&Number.isSafeInteger(callsUsed)&&callsUsed>=0&&typeof maxCalls==='number'&&Number.isSafeInteger(maxCalls)&&maxCalls>0&&maxCalls<=30?{callsUsed,maxCalls}:null;
}
import {useState,useRef,useEffect} from 'react';
import {ArrowRight,Plus,X,Check,AlertCircle,Download,Layers,FileText} from 'lucide-react';
import * as engine from './domain/engine.js';
import * as revisions from './domain/author-revision.js';
import {getSceneIntentReference} from './domain/scene-intent.js';
import {captureGenerationIntent} from './domain/generation-intent.js';
import RevisionAdoptionDialog from './components/RevisionAdoptionDialog.js';
import {loadWorkspace,persistWorkspace,recoverWorkspace,parseBackup,importBackup,MAX_BACKUP_BYTES,KEY,BACKUP_KEY,QUARANTINE_KEY,download} from './storage.js';
import Sidebar from './components/Sidebar.js';import Editor from './components/Editor.js';import Inspector from './components/Inspector.js';import PatchPanel from './components/PatchPanel.js';import DraftPanel,{FactEvidence,MemoryEvidence,StoredMemoryEvidence,QuoteCard,isSelectedMemory,memoryChoiceLabel,DecisionDialog} from './components/DraftPanel.js';import HistoryView from './components/HistoryView.js';import ProjectWizard from './components/ProjectWizard.js';import {createTemplateAdapter} from './adapters/provider.js';import {createServerProvider} from './authoring/live-provider.js';import ProviderPanel from './components/ProviderPanel.js';
import useModelTask from './hooks/useModelTask.js';
import ModelTaskStatus from './components/ModelTaskStatus.js';
function requireChapter(state: State,id: string){const chapter=state.chapters.find(item=>item.id===id);if(!chapter)throw Error('章节不存在');return chapter}
function initial(){const workspace=loadWorkspace();return {workspace,error:workspace.recovery?.message||''}}
export default function App(){const [{workspace:boot,error:bootError}]=useState(initial);const [workspace,setWorkspace]=useState(boot),ref=useRef(boot);const [tab,setTab]=useState<WorkspaceTab>('write'),[selected,setSelected]=useState(()=>boot.state.mode==='custom'?(boot.state.drafts.findLast(d=>!['ACCEPTED','REJECTED'].includes(d.status))?.chapterId||boot.state.drafts.at(-1)?.chapterId||boot.state.chapters[0].id):'ch2'),[notice,setNotice]=useState(bootError),[error,setError]=useState(!!bootError),[evidence,setEvidence]=useState<EvidenceRecord | null>(null),[showContext,setShowContext]=useState(false),[wizard,setWizard]=useState(false),[classify,setClassify]=useState(false),[statement,setStatement]=useState(''),[providerSettings,setProviderSettings]=useState(false),[interpretation,setInterpretation]=useState<Interpretation | null>(null),[targetFact,setTargetFact]=useState('');const [saveError,setSaveError]=useState(bootError),[importPreview,setImportPreview]=useState<Workspace | null>(null),[importError,setImportError]=useState(''),[recoveryConfirm,setRecoveryConfirm]=useState(false);const importSequence=useRef(0),saveHealth=useRef(bootError);const [factDecision,setFactDecision]=useState<FactDecisionChoice | null>(null),[factReason,setFactReason]=useState('');const [memoryDecision,setMemoryDecision]=useState<MemoryDecisionChoice | null>(null),[memoryReason,setMemoryReason]=useState(''),[memoryAcknowledged,setMemoryAcknowledged]=useState(false),[acceptance,setAcceptance]=useState<AcceptanceChoice | null>(null),[contextRefresh,setContextRefresh]=useState<ContextRefreshChoice | null>(null),[auditBudget,setAuditBudget]=useState<AuditBudget | null>(null),[draftEditing,setDraftEditing]=useState(false);const s=workspace.state,c=s.chapters.find(c=>c.id===selected)||s.chapters[0],value=workspace.editing[c.id]??c.text,dirty=value!==c.text,patch=workspace.patch,validation=patch?engine.validatePatch(s,patch):null,plans=engine.getImpacts(s),mode=workspace.providerMode||'template',provider=mode==='server'?createServerProvider():createTemplateAdapter();
 const [revisionAdoption,setRevisionAdoption]=useState<RevisionAdoptionChoice | null>(null),[extractionSkip,setExtractionSkip]=useState<ExtractionSkipChoice | null>(null);
 const task=useModelTask(),busy=task.busy;const selection=useRef(selected);selection.current=selected;
 const taskSnapshot=()=>JSON.stringify([ref.current.state,ref.current.editing,ref.current.providerMode,selection.current]);
 function recordSaveError(message: string){saveHealth.current=message;setSaveError(message)}
 function retainModelState(state: State){const next={...ref.current,state};ref.current=next;setWorkspace(next);return persist(next)}
 function requireCurrentAuditStorage(){
  try{
   if(saveHealth.current)throw Error(saveHealth.current);
   const raw=localStorage.getItem(KEY);if(raw===null)throw Error('已保存的工作区缺失，请先恢复或导出当前内容');
   const durable=parseBackup(raw),{recovery,...current}=ref.current;
   if(durable.serial!==current.serial||JSON.stringify(durable)!==JSON.stringify(current))throw Error('另一窗口已更新项目，请先导出当前编辑再刷新');
  }catch(error){const message=errorMessage(error)||'无法读取当前保存版本';recordSaveError(message);throw Object.assign(Error(message),{code:'AUDIT_STORAGE_UNSAFE'})}
 }
 function acceptanceSnapshot(){return JSON.stringify([ref.current.state,ref.current.editing,ref.current.patch,ref.current.providerMode,selection.current,draftEditing])}
 function requireCleanAuthorWorkspace(){
  requireCurrentAuditStorage();
  const current=ref.current;
  if(draftEditing||Object.entries(current.editing).some(([id,text])=>text!==undefined&&text!==current.state.chapters.find(ch=>ch.id===id)?.text))throw Error('请先保存并按作者分类提交正在编辑的正文；候选稿编辑需保存或取消');
  if(current.patch&&current.patch.status!=='noop'||current.state.pendingPatches.length)throw Error('请先处理待决补丁，再准备或接受正文');
  if(current.state.chapters.some(ch=>ch.syncStatus!=='CLEAN'))throw Error('请先处理正文与故事记忆的同步问题');
 }
 function openManualClassification(){if(task.isActive())return;setTargetFact('');setStatement('');setInterpretation(null);setClassify(true)}
 function prepareManual(){if(task.isActive())return;try{requireCleanAuthorWorkspace();mutate(st=>engine.stageManualDraft(st,selection.current),'已准备原文不变的手写候选稿；明确选择不提取记忆，尚未接受。请审查后确认；此次未调用模型')}catch(e){notify(errorMessage(e),true)}}
 function skipManualExtraction(id: string){if(task.isActive())return;try{requireCleanAuthorWorkspace();mutate(st=>engine.skipManualMemoryExtraction(st,id),'已明确选择不提取记忆，提交 0 条；旧提取与选择保留在历史中，请重新审查。此次未调用模型')}catch(e){notify(errorMessage(e),true)}}
 function openExtractionSkip(id: string){
  if(task.isActive())return;
  if(ref.current.state.drafts.find(d=>d.id===id)?.manualSource){skipManualExtraction(id);return}
  try{requireCleanAuthorWorkspace();engine.skipMemoryExtraction(ref.current.state,id);const d=ref.current.state.drafts.find(d=>d.id===id);if(!d?.extraction)throw Error('候选提取记录缺失');setExtractionSkip({id,snapshot:acceptanceSnapshot(),revision:d.revision,textHash:d.textHash,count:d.staging.length,status:d.extraction.status})}catch(e){notify(errorMessage(e),true)}
 }
 function confirmExtractionSkip(){
  if(task.isActive()||!extractionSkip)return;
  try{requireCleanAuthorWorkspace();if(acceptanceSnapshot()!==extractionSkip.snapshot)throw Error('候选版本、审阅、提取或工作区已变化，请关闭窗口并重新核对');if(mutate(st=>engine.skipMemoryExtraction(st,extractionSkip.id),'已明确选择不提取记忆，提交 0 条；旧提取与选择已归档，旧审阅已失效。请重新审查后确认接受；此次操作未调用模型'))setExtractionSkip(null)}catch(e){notify(errorMessage(e),true)}
 }
 function notify(text: string,bad=false){setNotice(text);setError(bad)}
 function persist(next: Workspace){try{const saved=persistWorkspace(next,ref.current.serial);ref.current=saved;setWorkspace(saved);recordSaveError('');return saved}catch(e){recordSaveError(errorMessage(e));notify(errorMessage(e),true);return null}}
 function change(text: string){const next={...ref.current,editing:{...ref.current.editing,[c.id]:text}};ref.current=next;setWorkspace(next);persist(next)}
 function mutate(fn: (state: State) => State,message: string){try{const next=fn(ref.current.state);if(persist({...ref.current,state:next})){notify(message);return next}}catch(e){notify(errorMessage(e),true)}}
 function analyze(){try{const old=ref.current,chapter=requireChapter(old.state,c.id),text=old.editing[c.id]??chapter.text;const next=engine.saveRevision(old.state,c.id,text,chapter.revision),p=engine.proposePatch(next,c.id);if(persist({...old,state:next,editing:{...old.editing,[c.id]:undefined},patch:p}))notify(p.status==='blocked'?'正文已保存；这处修改需要语义澄清，记忆未改变':'正文已保存，请检查右侧修改影响',p.status==='blocked')}catch(e){notify(errorMessage(e),true)}}
 function commit(){const currentPatch=ref.current.patch;if(!currentPatch)return;const result=mutate(st=>engine.commitPatch(st,currentPatch),ref.current.state.mode==='custom'?'状态已提交；自建项目的通用语义依赖仍需作者复核':'状态已提交。相关计划已复核，其他计划保留');if(result)persist({...ref.current,patch:null})}
 async function generate(){if(task.isActive())return;if(Object.entries(ref.current.editing).some(([id,t])=>t!==undefined&&t!==s.chapters.find(c=>c.id===id)?.text)){notify('请先保存并分析正在编辑的正文，再生成下一场景',true);return}
 if(ref.current.state.chapters.some(ch=>ch.syncStatus!=='CLEAN')){notify('请先处理正文与故事记忆的同步问题，尚未请求模型',true);return}
 const run=task.begin('章节生成',taskSnapshot);if(!run)return;try{let next;if(s.mode==='custom'||mode==='server'){const index=s.chapters.findIndex(ch=>ch.id===c.id);if(index>0&&s.chapters[index-1].status!=='ACCEPTED')throw Error('请先审阅并接受前一章，再继续下一章');const context=engine.getContext(s);const config=s.config;const project=config?{...config,outline:s.chapters.map((ch,i)=>{const raw=config.outline?.[i],outline=typeof raw==='string'?Object.fromEntries(Object.entries(raw)):raw;return {...outline,id:ch.id,title:outline?.title||ch.title,goal:outline?.goal||'沿已有线索推进，保持角色知识边界'}})}:{projectId:s.projectId,title:s.title,idea:'林夏回到雾港，发现母亲持续收到神秘来信；陈默与死者的关系等待查证。',protagonist:'林夏',pov:'第三人称限知',tone:'克制而不安',goal:'查清母亲旧信与雾港命案的联系',boundaries:'不可让警方无来源提前获知秘密',outline:s.chapters.map(ch=>({id:ch.id,title:ch.title,goal:'沿已有线索推进，保持角色知识边界'}))};const input={project,chapterIndex:index,context};const generationIntent=captureGenerationIntent(input);const output=await provider[mode==='server'?'generateProse':'generateChapter'](input,{signal:run.controller.signal});if(!task.verify(run))return;next=mode==='server'?engine.stageProseDraft(ref.current.state,{...output,context},c.id,generationIntent):engine.stageProviderDraft(ref.current.state,{...output,context,staging:[]},c.id,generationIntent);const candidateWorkspace={...ref.current,state:next};if(mode==='server'){ref.current=candidateWorkspace;setWorkspace(candidateWorkspace)}if(persist(candidateWorkspace))notify(mode==='server'?'正文已独立保存。可提取候选记忆，或明确选择不提取，再审查并决定是否接受；生成、提取和审阅分别调用模型':'模板候选稿已生成，未写入正式记忆；真实模型尚未连接');task.finish(run,'complete',output)}else next=mutate(engine.generateDraft,'候选稿已生成，尚未进入故事记忆');if(next)setTimeout(()=>document.getElementById('drafts')?.scrollIntoView({behavior:'smooth',block:'start'}),60)}catch(e){if(task.current(run)){task.finish(run,'error');notify(errorMessage(e),true)}}finally{if(task.current(run))task.finish(run)}}

 function changeRevisionInstruction(id: string,instruction: string){if(task.isActive())return;mutate(st=>revisions.setRevisionInstruction(st,id,instruction),'改稿意见已保存；修改意见会使旧建议失效')}
 async function requestRevision(id: string){
  if(task.isActive())return;
  if(ref.current.providerMode!=='server'){notify('请先明确选择真实模型模式；离线模板不执行改稿',true);return}
  let run: ModelTask | null | undefined,proposalId: string | undefined,expected: import('./domain/review-types.js').RevisionBinding | undefined;
  const stop=(status: 'cancelled' | 'failed')=>{if(proposalId){const next=revisions.markRevisionFailure(ref.current.state,id,proposalId,status);if(JSON.stringify(next)!==JSON.stringify(ref.current.state))retainModelState(next)}};
  try{
   requireCleanAuthorWorkspace();
   revisions.validateRevisionRequest(ref.current.state,id);
   run=task.begin('作者意见改稿 · 先检查预算',taskSnapshot,()=>stop('cancelled'));if(!run)return;
   const gateway=createServerProvider(),status=await gateway.getStatus({signal:run.controller.signal});
   if(!task.verify(run)){stop('cancelled');return}
   const budget=readAuditBudget(status);
   setAuditBudget(budget);
   if(!status.configured||!status.liveEnabled)throw Error('服务端未配置或未启用真实模型；未发送改稿请求');
   if(!budget||budget.callsUsed>=budget.maxCalls)throw Error('调用预算缺失、无效或耗尽；未发送改稿请求');
   requireCleanAuthorWorkspace();
   if(!task.verify(run)){stop('cancelled');return}
   const next=revisions.beginDraftRevision(ref.current.state,id);
   if(!persist({...ref.current,state:next})){task.finish(run,'error');return;}
   const proposal=next.drafts.find(d=>d.id===id)?.revisionProposals?.at(-1);if(!proposal)throw Error('改稿请求记录缺失');proposalId=proposal.id;expected=structuredClone(proposal.binding);
   const input=revisions.createRevisionInput(next,id,proposalId);
   run.basis=taskSnapshot();
   const output=await gateway.reviseProse(input,{signal:run.controller.signal});
   if(!task.current(run))return;
   const stale=taskSnapshot()!==run.basis;
   const attached=revisions.attachDraftRevision(ref.current.state,id,proposalId,output,expected,{stale});
   if(retainModelState(attached))notify(stale?'改稿结果已保留，但工作区已变化，旧建议不能采用':'改稿建议已单独保存，请比较前后正文，再采用或放弃；原稿与记忆未改变');
   else notify('已收到的改稿结果保留在本窗口，尚未安全保存。请导出当前内容或重试保存；重试保存不会再次调用模型',true);
   task.finish(run,stale?'stale':'complete',output);
  }catch(e){if(!run||task.current(run)){stop(errorCode(e)==='AUDIT_STORAGE_UNSAFE'?'cancelled':'failed');if(run)task.finish(run,'error');notify(`改稿未完成，原稿保留。${errorMessage(e)}`,true)}}
 }
 function openRevisionAdoption(id: string,proposalId: string){if(task.isActive())return;try{requireCleanAuthorWorkspace();const proposal=ref.current.state.drafts.find(d=>d.id===id)?.revisionProposals?.find(p=>p.id===proposalId);if(!proposal?.result)throw Error('改稿建议不存在或尚未返回');revisions.adoptDraftRevision(ref.current.state,id,proposalId,proposal);setRevisionAdoption({id,proposalId,proposal:structuredClone({...proposal,result:proposal.result}),snapshot:acceptanceSnapshot()})}catch(e){notify(errorMessage(e),true)}}
 function confirmRevisionAdoption(options: RevisionAdoptionOptions){if(task.isActive()||!revisionAdoption)return;try{requireCleanAuthorWorkspace();if(acceptanceSnapshot()!==revisionAdoption.snapshot)throw Error('工作区、原稿或选择已变化，请关闭并重新核对');const choice=revisionAdoption;if(mutate(st=>revisions.adoptDraftRevision(st,choice.id,choice.proposalId,choice.proposal,options),'已采用为候选新版本，原稿与建议保留。旧提取、审阅与记忆选择已失效；请重新提取或明确选择不提取，再请求审阅，尚未接受'))setRevisionAdoption(null)}catch(e){notify(errorMessage(e),true)}}
 function cancelInterruptedRevision(id: string,proposalId: string){if(task.isActive())return;try{requireCurrentAuditStorage();mutate(st=>revisions.markRevisionFailure(st,id,proposalId,'cancelled'),'中断请求已标记取消；原稿保留。若要重新请求，请再次明确点击；不会自动重试')}catch(e){notify(errorMessage(e),true)}}
 function discardRevision(id: string,proposalId: string){if(task.isActive())return;try{requireCurrentAuditStorage();mutate(st=>revisions.discardDraftRevision(st,id,proposalId),'已放弃此建议；原稿、建议和调用来源仍保留，此次未调用模型')}catch(e){notify(errorMessage(e),true)}}

 async function extract(id: string){
  if(task.isActive())return;if(ref.current.state.drafts.find(d=>d.id===id)?.manualSource&&ref.current.providerMode!=='server'){notify('手写稿提取是可选的真实模型请求；请先明确选择真实模型模式，或保留不提取记忆',true);return}if(saveError){notify('请先安全保存正文或导出备份，再提取候选记忆',true);return}
  let run: ModelTask | null | undefined,expected: ReturnType<typeof engine.createExtractionBinding> | undefined;
  try{
   const next=engine.beginMemoryExtraction(ref.current.state,id);
   if(!persist({...ref.current,state:next}))return;
   expected=engine.createExtractionBinding(next,id);
   const input=engine.createExtractionInput(next,id);
   const failExtraction=()=>{if(!expected)return;const failed=engine.markExtractionFailure(ref.current.state,id,expected,'cancelled');if(failed!==ref.current.state)retainModelState(failed)};
   run=task.begin('候选记忆提取',taskSnapshot,failExtraction);if(!run)return;
   const output=await createServerProvider().extractMemory(input,{signal:run.controller.signal});
   if(!task.verify(run))return;
   const attached=engine.attachMemoryExtraction(ref.current.state,id,output,expected);
   if(retainModelState(attached))notify('候选记忆已提取，请逐条核对原文；尚未提交，需要审查与作者接受');else notify('候选记忆结果已保留在本窗口，但尚未安全保存。请导出当前内容或重试保存；重试保存不会再次调用模型',true);
   task.finish(run,'complete',output);
  }catch(e){if(!run||task.current(run)){if(expected){const failed=engine.markExtractionFailure(ref.current.state,id,expected);if(failed!==ref.current.state)retainModelState(failed)}if(run)task.finish(run,'error');notify(`候选记忆提取未完成，已保存的正文保留。${errorMessage(e)}`,true)}}
 }
 async function review(id: string){if(task.isActive())return;const snapshot=ref.current.state,draft=snapshot.drafts.find(d=>d.id===id);if(draft?.manualSource){try{requireCleanAuthorWorkspace()}catch(e){notify(errorMessage(e),true);return}if(draft.requiresSemanticReview&&ref.current.providerMode!=='server'){notify('当前有已确认设定，手写稿仍需现有模型审阅与逐项冲突决定；请选择真实模型模式后明确点击审查，本次未请求模型',true);return}}let next=mutate(st=>engine.reviewDraft(st,id),'结构审查已完成');if(!next||!draft?.requiresSemanticReview)return;if(!next.drafts.find(d=>d.id===id)?.review?.passed){notify('结构检查未通过，尚未请求模型审阅',true);return}next=mutate(st=>engine.beginSemanticReview(st,id),'当前审阅进行中；旧审阅与记忆选择已失效');if(!next)return;const run=task.begin('模型审阅',taskSnapshot);if(!run)return;try{const expected=engine.createReviewBinding(next,id),report=await createServerProvider().reviewChapter({text:draft.text,chapterId:draft.chapterId||'ch3',context:engine.getContext(next)},{signal:run.controller.signal});if(!task.verify(run))return;if(retainModelState(engine.attachSemanticReview(ref.current.state,id,report,expected)))notify('模型审阅已返回，仅作为可追溯建议；不会自行修改故事状态');else notify('模型审阅结果已保留在本窗口，但尚未安全保存。请导出当前内容或重试保存；重试保存不会再次调用模型',true);task.finish(run,'complete',report)}catch(e){if(task.current(run)){task.finish(run,'error');notify(errorMessage(e),true)}}}
 function openFactDecision(id: string,factId: string){if(task.isActive())return;try{const current=ref.current.state,d=current.drafts.find(x=>x.id===id),item=engine.getFactReviewGate(current,id).find(x=>x.factId===factId);if(!d||!item?.blocking||item.resolved)throw Error('这条设定的审阅状态已变化，请重新查看');setFactDecision({id,item:structuredClone(item),binding:engine.createReviewBinding(current,id),reviewHash:engine.hash(JSON.stringify(d.modelReview))});setFactReason('')}catch(e){notify(errorMessage(e),true)}}
 function confirmFactDecision(){if(task.isActive()||!factDecision||!factReason.trim())return;const decision=factDecision;const next=mutate(st=>engine.resolveFactReview(st,decision.id,{factId:decision.item.factId,recordVersion:decision.item.recordVersion,action:'accept_exception',reason:factReason.trim(),reviewHash:decision.reviewHash},decision.binding),'已记录本稿的单项例外与作者理由；原设定保留，候选稿尚未接受');if(next){setFactDecision(null);setFactReason('')}}

 async function auditMemory(id: string,candidateId: string){
  if(task.isActive())return;
  if(ref.current.providerMode!=='server'){notify('请先明确选择真实模型模式，才能发起单条独立核对',true);return}
  if(saveHealth.current){notify('请先安全保存当前内容，再发起独立核对',true);return}
  let run: ModelTask | null | undefined,expected: ReturnType<typeof engine.createMemorySupportBinding> | undefined;
  const stopAttempt=(status: 'cancelled' | 'failed')=>{if(!expected)return;const current=ref.current.state,failed=engine.markMemorySupportFailure(current,id,candidateId,expected,status);if(JSON.stringify(failed)!==JSON.stringify(current))retainModelState(failed)};
  try{
   const next=engine.beginMemorySupportAssessment(ref.current.state,id,candidateId);
   if(!persist({...ref.current,state:next}))return;
   expected=engine.createMemorySupportBinding(next,id,candidateId);
   const input=engine.createMemorySupportInput(next,id,candidateId);
   run=task.begin('单条独立核对 · 先检查预算',taskSnapshot,()=>stopAttempt('cancelled'));if(!run)return;
   const gateway=createServerProvider(),status=await gateway.getStatus({signal:run.controller.signal});
   if(!task.verify(run)){stopAttempt('cancelled');return}
   const budget=readAuditBudget(status);
   setAuditBudget(budget);
   if(status?.configured!==true||status?.liveEnabled!==true)throw Error('服务端未配置或未启用真实模型；未发送独立核对请求');
   if(!budget)throw Error('服务端调用预算缺失或无效；未发送独立核对请求');
   if(budget.callsUsed>=budget.maxCalls)throw Error('服务端本次进程的调用预算已耗尽；未发送独立核对请求');
   // Check the current persisted version and synchronous save health after the awaited preflight.
   requireCurrentAuditStorage();
   if(!task.verify(run)){stopAttempt('cancelled');return}
   const report=await gateway.auditMemoryCandidate(input,{signal:run.controller.signal});
   if(!task.verify(run)){stopAttempt('cancelled');return}
   const attached=engine.attachMemorySupportAssessment(ref.current.state,id,candidateId,report,expected);
   if(retainModelState(attached))notify('这条候选的独立核对已返回；只看原始标签与该条引文，仍需作者明确选择');
   else notify('独立核对结果已保留在本窗口，但尚未安全保存。请导出当前内容或重试保存；重试保存不会再次调用模型',true);
   task.finish(run,'complete',report);
  }catch(e){if(!run||task.current(run)){stopAttempt(errorCode(e)==='AUDIT_STORAGE_UNSAFE'?'cancelled':'failed');if(run)task.finish(run,'error');notify(`单条独立核对未完成。${errorMessage(e)}`,true)}}
 }
 function chooseMemory(id: string,candidateId: string,action: 'keep_quote' | 'attest_keep' | 'reject'){
  if(task.isActive())return;
  try{const item=engine.getMemoryReviewGate(ref.current.state,id).find(x=>x.candidateId===candidateId);if(!item||!item.binding||!item.reviewHash)throw Error('候选记忆已变化，请重新审阅');
   if(action==='attest_keep'){if(!item.canAttest)throw Error('当前候选不能确认转述，请重新审阅');setMemoryDecision({id,item:structuredClone(item),binding:structuredClone(item.binding),reviewHash:item.reviewHash});setMemoryReason('');setMemoryAcknowledged(false);return}
   const {reviewHash,binding}=item;mutate(st=>engine.decideMemoryCandidate(st,id,{candidateId,action,reviewHash},binding),action==='reject'?'已拒绝这条候选记忆；原文保留':'已选择原文摘录，仅确认文本存在；接受稿件前不会提交');
  }catch(e){notify(errorMessage(e),true)}
 }
 function confirmMemoryDecision(){
  if(task.isActive()||!memoryDecision||!memoryReason.trim()||!memoryAcknowledged)return;
  const decision=memoryDecision;
  const next=mutate(st=>engine.decideMemoryCandidate(st,decision.id,{candidateId:decision.item.candidateId,action:'attest_keep',reason:memoryReason.trim(),reviewHash:decision.reviewHash,attestation:{protocol:'quote-grounded-memory-v1',accepted:true,statement:engine.MEMORY_ATTESTATION_STATEMENT}},decision.binding),'已记录作者对未验证转述的明确确认与理由；这不是已验证事实，尚未提交');
  if(next){setMemoryDecision(null);setMemoryReason('');setMemoryAcknowledged(false)}
 }
 function rejectAllMemories(id: string){
  if(task.isActive())return;
  mutate(st=>{let next=st;const ids=engine.getMemoryReviewGate(next,id).map(item=>item.candidateId);for(const candidateId of ids){const item=engine.getMemoryReviewGate(next,id).find(row=>row.candidateId===candidateId);if(!item?.binding||!item.reviewHash)throw Error('候选记忆已变化，请重新审阅');next=engine.decideMemoryCandidate(next,id,{candidateId,action:'reject',reviewHash:item.reviewHash},item.binding)}return next},'已拒绝全部候选记忆，原文保留；此次未调用模型，可仅接受正文');
 }
 function openContextRefresh(id: string){if(task.isActive())return;const current=ref.current.state,d=current.drafts.find(item=>item.id===id);if(!d)return;setContextRefresh({id,snapshot:JSON.stringify(current),chapterTitle:current.chapters.find(ch=>ch.id===d.chapterId)?.title})}
 function confirmContextRefresh(){if(task.isActive()||!contextRefresh)return;if(JSON.stringify(ref.current.state)!==contextRefresh.snapshot){notify('正文或故事状态已变化，请关闭窗口并重新确认',true);return}if(mutate(st=>engine.refreshDraftContext(st,contextRefresh.id),'参考上下文已更新，原候选正文保留。请重新提取或明确选择不提取，再审阅并确认；此次未请求模型'))setContextRefresh(null)}
 function openAcceptance(id: string){
  if(task.isActive())return;
  try{requireCleanAuthorWorkspace();const current=ref.current.state;engine.acceptDraft(current,id); // Pure validation; nothing is persisted until confirmation.
   const items=engine.getMemoryReviewGate(current,id);setAcceptance({id,chapterTitle:current.chapters.find(ch=>ch.id===(current.drafts.find(d=>d.id===id)?.chapterId||'ch3'))?.title,snapshot:acceptanceSnapshot(),draftRevision:current.drafts.find(d=>d.id===id)?.revision,textHash:current.drafts.find(d=>d.id===id)?.textHash,manualSource:current.drafts.find(d=>d.id===id)?.manualSource,extractionStatus:current.drafts.find(d=>d.id===id)?.extraction?.status,selected:items.filter(isSelectedMemory),total:items.length});
  }catch(e){notify(errorMessage(e),true)}
 }
 function confirmAcceptance(){
  if(task.isActive()||!acceptance)return;
  if(acceptanceSnapshot()!==acceptance.snapshot){notify('候选版本、审阅或记忆选择已变化；正文编辑、待决补丁或当前章节也可能变化，请关闭窗口并重新确认',true);return}
  try{requireCleanAuthorWorkspace()}catch(e){notify(errorMessage(e),true);return}
  if(mutate(st=>engine.acceptDraft(st,acceptance.id),`已接受当前章，仅提交选中的 ${acceptance.selected.length} 条记忆；可以继续下一章`))setAcceptance(null);
 }
 async function prepareAnalysis(){if(task.isActive())return;setTargetFact('');if(mode!=='server'){setStatement('');setInterpretation(null);setClassify(true);return}setInterpretation(null);let run: ModelTask | null | undefined;try{const old=ref.current,chapter=requireChapter(old.state,c.id),beforeText=chapter.revisions.find(r=>r.revision===chapter.syncedRevision)?.text||chapter.text,next=engine.saveRevision(old.state,c.id,old.editing[c.id]??chapter.text,chapter.revision);if(!persist({...old,state:next,editing:{...old.editing,[c.id]:undefined}}))return;run=task.begin('修改分析',taskSnapshot);if(!run)return;const ctx=engine.getContext(next),after=requireChapter(next,c.id),report=await provider.interpretRevision({beforeText,afterText:after.text,chapterId:c.id,context:ctx},{signal:run.controller.signal});if(!task.verify(run))return;task.finish(run,'complete',report);setInterpretation(interpretationView(report));setStatement('');setClassify(true);notify('模型仅提出改文解释，需由你确认后才能准备补丁')}catch(e){if(!run||task.current(run)){if(run)task.finish(run,'error');notify(errorMessage(e),true)}}}
 function createProject(config: ProjectConfig){task.cancel();const chapters=config.outline.map((p,i)=>({title:`第${['一','二','三'][i]}章 ${p.title}`}));const next=engine.createProjectFromConfig({...config,chapters});const archived=[...(ref.current.archived||[]),{state:ref.current.state,editing:ref.current.editing,patch:ref.current.patch}];if(!persist({...ref.current,state:next,editing:{},patch:null,archived}))throw Error('项目保存失败，请先导出原项目');setSelected('ch1');setTab('write');setWizard(false);notify('故事约定与前三章计划已保存，点击生成当前章开始创作')}
 function switchProject(id: string){if(!(ref.current.archived||[]).some(p=>p.state.projectId===id))return;task.cancel();const old=ref.current,list=old.archived||[],target=list.find(p=>p.state.projectId===id);if(!persist({...old,...target,archived:[...list.filter(p=>p.state.projectId!==id),{state:old.state,editing:old.editing,patch:old.patch}]}))return;setSelected('ch1');setTab('write');notify('已切换项目，原项目及其编辑已保留')}
 function authorClassify(intent: AuthorInstruction['intent']){try{const old=ref.current,chapter=requireChapter(old.state,c.id),next=engine.saveRevision(old.state,c.id,old.editing[c.id]??chapter.text,chapter.revision),p=engine.proposeCustomPatch(next,c.id,{intent,statement,...(targetFact?{targetFactId:targetFact}:{})});if(persist({...old,state:next,editing:{...old.editing,[c.id]:undefined},patch:p})){setClassify(false);notify('已按你的明确分类准备补丁，请审阅后提交')}}catch(e){notify(errorMessage(e),true)}}

 async function previewImport(event: ChangeEvent<HTMLInputElement>){const file=event.target.files?.[0];event.target.value='';const token=++importSequence.current;setImportPreview(null);setImportError('');if(!file)return;try{if(file.size>MAX_BACKUP_BYTES)throw Error('备份超过 2 MiB 上限');const parsed=parseBackup(await file.text());if(token===importSequence.current)setImportPreview(parsed)}catch(e){if(token===importSequence.current)setImportError(errorMessage(e))}}
 function confirmImport(){if(!importPreview)return;task.cancel();try{const next=importBackup(ref.current,importPreview);if(persist(next)){setImportPreview(null);setSelected(next.state.chapters[0].id);setTab('write');notify('已导入为新项目，原项目与暂存编辑保留；待定候选需重新审阅')}}catch(e){setImportError(errorMessage(e))}}
 function recover(){try{const saved=recoverWorkspace(ref.current);ref.current=saved;setWorkspace(saved);recordSaveError('');setRecoveryConfirm(false);notify('已恢复当前工作区与内存编辑，原始数据保留')}catch(e){recordSaveError(errorMessage(e))}}
 function exportRaw(){try{const data={primary:localStorage.getItem(KEY),lastGood:localStorage.getItem(BACKUP_KEY),preserved:localStorage.getItem(QUARANTINE_KEY)};download('NexusScribe-存储原始数据.json',data)}catch(e){recordSaveError('浏览器禁止读取存储：'+errorMessage(e))}}
 useEffect(()=>{function leaving(e: BeforeUnloadEvent){if(saveError){e.preventDefault();e.returnValue=''}}window.addEventListener('beforeunload',leaving);return()=>window.removeEventListener('beforeunload',leaving)},[saveError]);
 useEffect(()=>{function changed(e: StorageEvent){if(e.key===KEY){recordSaveError('另一窗口已更新项目，请先导出当前编辑再刷新');task.cancel();notify('另一窗口已更新项目，请先导出当前编辑再刷新',true)}}window.addEventListener('storage',changed);return()=>window.removeEventListener('storage',changed)},[]);
 return <div className="app-shell"><Sidebar state={s} mode={mode} tab={tab} setTab={setTab} selected={selected} onSelect={id=>{task.cancel();setSelected(id);setTab('write')}} onExport={()=>download('NexusScribe-项目备份.json',workspace)} projects={workspace.archived||[]} onSwitch={switchProject}/><main className="workspace"><header className="topbar"><div><h1>{tab==='write'?c.title:tab==='memory'?'故事记忆':'版本记录'}</h1><p><span className={'save-dot '+(dirty?'pending':'')}/>{saveError?'未保存 · 请导出当前内容':dirty?'编辑内容已暂存 · 等待分析':`已保存 · 正文 r${c.revision}`}<span className="separator">/</span>故事状态 v{s.version}</p></div><div className="top-actions"><label className="backup-import">导入备份<input aria-label="导入备份" type="file" accept=".json,application/json" onChange={previewImport}/></label><button aria-label="模型运行方式" onClick={()=>setProviderSettings(true)}>模型</button><button onClick={()=>{task.cancel();setWizard(true)}}><Plus/>新建故事</button><button className="primary" disabled={busy} onClick={generate}>{busy?'任务进行中…':s.mode==='custom'?'生成当前章':'生成下一场景'}<ArrowRight/></button></div></header>{notice&&<div className={'notice '+(error?'error':'')} role="status">{error?<AlertCircle/>:<Check/>}<span>{notice}</span><button className="icon-button" aria-label="关闭通知" onClick={()=>setNotice('')}><X/></button></div>}
 <ModelTaskStatus task={task}/>
 {saveError&&<section className="recovery-banner" role="alert"><strong>当前内容尚未安全保存</strong><p>{saveError}</p><button onClick={()=>download('NexusScribe-当前内容备份.json',workspace)}>导出当前内容（含暂存编辑）</button><button onClick={exportRaw}>导出存储原始数据</button>{workspace.recovery?.blocked?<button onClick={()=>setRecoveryConfirm(true)}>检查并恢复存储</button>:<button onClick={()=>persist(ref.current)}>重试保存</button>}</section>}
 {importError&&<p className="notice error" role="alert">{importError}<button onClick={()=>setImportError('')}>关闭导入错误</button></p>}
 {tab==='write'?<>{s.mode==='custom'&&<div className="workflow-banner"><strong>{mode==='server'?'已确认故事约定 → 三章规划 → 保存正文 → 提取记忆或明确跳过 → 审阅定稿':'已确认故事约定 → 三章规划 → 模板候选 → 作者审阅定稿'}</strong><br/>{s.config?.idea}<br/>当前章节状态：{c.status==='ACCEPTED'?'已接受':c.status==='PLANNED'?'待创作':c.status==='DRAFT'?'已修改 · 待重新接受':c.status} · {mode==='server'?'使用真实服务端模型，候选结果仍需作者确认':'模板运行，真实模型待接入'}</div>}<Editor onManualClassify={s.mode==='custom'?openManualClassification:null} onManualPrepare={s.mode==='custom'?prepareManual:null} chapter={c} value={value} dirty={dirty} onChange={change} onAnalyze={s.mode==='custom'?prepareAnalysis:analyze} onPreset={()=>{change(value.replace(engine.NEVER_MET,engine.HAS_MET));notify('已插入预置设定修改，点击“保存并分析”查看影响')}} onPolish={()=>{change(value.replace('缓缓走向窗前','走到窗前').replace('雨点敲打着审讯室的窗','雨敲着审讯室的窗'));notify('已应用预置局部润色，不会推导全书文风偏好')}}/><div className="under-editor"><button className="text-button" onClick={()=>setShowContext(true)}><Layers/>查看场景上下文</button><button className="text-button" onClick={()=>download(s.title+'.txt',s.chapters.map(c=>c.title+'\n\n'+(workspace.editing[c.id]??c.text)).join('\n\n'),'text/plain')}><Download/>导出正文</button><span>{mode==='server'?'真实模型 · 结果必须验证与确认':s.mode==='custom'?'模板模式 · 作者确认改文类型 · 未连接真实模型':'演示解释器仅识别预置修改，其他改文保留待决'}</span></div><div id="drafts"><DraftPanel chapterIntent={getSceneIntentReference(s,c.id)} sceneIntentByDraft={Object.fromEntries(s.drafts.map(d=>[d.id,getSceneIntentReference(s,c.id,d)]))} onCancelRevision={cancelInterruptedRevision} onRevisionInstruction={changeRevisionInstruction} onRequestRevision={requestRevision} onAdoptRevision={openRevisionAdoption} onDiscardRevision={discardRevision} revisionCurrent={Object.fromEntries(s.drafts.map(d=>[d.id,revisions.getRevisionCurrency(s,d.id)]))} key={`${s.projectId}-${c.id}`} onEditingChange={setDraftEditing} onSkipExtraction={openExtractionSkip} contextCurrent={Object.fromEntries(s.drafts.map(d=>[d.id,!d.requiresExtraction||engine.isDraftContextCurrent(s,d.id)]))} onRefreshContext={openContextRefresh} chapterTitle={s.mode==='custom'?c.title:null} drafts={s.mode==='custom'?s.drafts.filter(d=>(d.chapterId||'ch3')===c.id):s.drafts} busy={busy} auditDisabled={!!saveError} mode={mode} auditBudget={auditBudget} onMemoryAudit={auditMemory} extractionReady={Object.fromEntries(s.drafts.map(d=>[d.id,!d.requiresExtraction||engine.hasCurrentExtraction(s,d.id)]))} onExtract={extract} memoryReviews={Object.fromEntries(s.drafts.map(d=>[d.id,engine.getMemoryReviewGate(s,d.id)]))} onMemoryDecision={chooseMemory} onRejectAllMemory={rejectAllMemories} factReviews={Object.fromEntries(s.drafts.map(d=>[d.id,engine.getFactReviewGate(s,d.id)]))} onFactDecision={openFactDecision} onEdit={(id,text)=>{task.cancel();mutate(st=>engine.editDraft(st,id,text),'草稿编辑已保存；旧提取与审查已失效，请重新提取或明确选择不提取，再审查')}} onReview={review} onAccept={openAcceptance} onReject={id=>{task.cancel();mutate(st=>engine.rejectDraft(st,id),'已拒绝候选稿，暂存事件已隔离，不会进入故事记忆')}}/></div></>:tab==='history'?<HistoryView state={s} onUndo={id=>mutate(st=>engine.undoCommit(st,id),'已创建补偿版本；原正文保留，请复核正文与设定的一致性')}/>:<section className="full-view"><h2>让每条记忆都有来处</h2><p className="muted">世界事实、角色认知、未来计划与候选状态分别管理；已接受摘录仅证明文本存在，转述仍未验证</p><div className="memory-sections">{([['已确认事实',s.facts],['角色认知',s.knowledge],['支持证据',s.evidence],['已接受摘录与转述',s.events],['读者披露',s.disclosures]] satisfies [string, EvidenceRecord[]][]).map(([title,items])=><section key={title}><h3>{title}<span>{items.length}</span></h3>{items.length?items.map((x: EvidenceRecord,i)=><button className="memory-record" key={x.id||i} onClick={()=>setEvidence(x)}><FileText/><span>{x.label||x.proposition||x.quote||x.id}<small>{x.memoryDecision?memoryChoiceLabel(x.memoryDecision.action):title==='已接受摘录与转述'?'历史记忆 · 未验证':x.status|| (x.active?'有效':'失效')}</small></span><ArrowRight/></button>):<p className="fine">暂无记录，未接受的候选事件不会出现在这里</p>}</section>)}</div></section>}
 </main><Inspector state={s} plans={plans} onEvidence={setEvidence}><PatchPanel patch={patch} validation={validation} onCommit={commit} onClose={()=>persist({...ref.current,patch:null})}/></Inspector>
 {(evidence||showContext)&&<div className="modal-backdrop" onClick={()=>{setEvidence(null);setShowContext(false)}}><section className="modal" role="dialog" aria-modal="true" aria-label={evidence?'来源证据':'场景上下文'} onClick={e=>e.stopPropagation()}><header><h2>{evidence?'来源与版本':'场景上下文包'}</h2><button className="icon-button" aria-label="关闭详情" onClick={()=>{setEvidence(null);setShowContext(false)}}><X/></button></header><p className="muted">原始证据保留指定 revision。结构化状态不会替代原文。</p><StoredMemoryEvidence record={evidence||{}} isEvent={s.events.some(item=>item.id===evidence?.id)} quoteCard={evidence?.memoryDecision&&evidence.draftId&&s.drafts.some(d=>d.id===evidence.draftId)?engine.getMemoryReviewGate(s,evidence.draftId).find(item=>item.candidateId===evidence.memoryDecision?.candidateId)?.quoteCard:null}/><pre>{JSON.stringify(evidence||engine.getContext(s),null,2)}</pre></section></div>}
 {factDecision&&<div className="modal-backdrop"><section className="modal" style={{maxHeight:'calc(100dvh - 24px)',overflowY:'auto',overflowWrap:'anywhere',overscrollBehavior:'contain'}} role="dialog" aria-modal="true" aria-label="确认单项设定例外" onKeyDown={e=>{if(e.key==='Escape')setFactDecision(null)}}><header><h2>明确接受本稿例外</h2><button className="icon-button" aria-label="关闭设定决定" onClick={()=>setFactDecision(null)}><X/></button></header><p className="warning">这项决定只适用于打开此窗口时的候选版本与审查报告。原设定保持不变，不代表接受整篇候选稿。</p><p>故事状态 v{factDecision.binding.stateVersion} · 候选 r{factDecision.binding.draftRevision} · 审查 {factDecision.reviewHash}</p><FactEvidence item={factDecision.item}/><label className="form-label">作者决定理由（必填）<textarea autoFocus aria-label="作者决定理由" maxLength={2000} value={factReason} onChange={e=>setFactReason(e.target.value)} rows={3}/></label><div className="draft-actions"><button onClick={()=>setFactDecision(null)}>取消决定</button><button className="primary" disabled={busy||!factReason.trim()} onClick={confirmFactDecision}>确认接受此项例外，保留原设定</button></div></section></div>}
 {memoryDecision&&<DecisionDialog label="作者确认未验证转述" title="明确确认此条未验证转述" onClose={()=>setMemoryDecision(null)}><p className="warning">保留的是模型生成的转述。即使模型判断 supported，它仍未经验证：程序不保证原文蕴含这条转述，也不保证它是故事世界真相。传闻、否定、角色所知与未来计划不能自动当成已发生事实。请核对全文，再自行决定是否承担保留此转述的风险；接受整篇稿件仍需另行确认。</p><p className="fine">故事状态 v{memoryDecision.binding?.stateVersion} · 候选 r{memoryDecision.binding?.draftRevision} · 审查 {memoryDecision.reviewHash}</p><MemoryEvidence item={memoryDecision.item}/><label className="form-label">作者确认理由（必填）<textarea data-autofocus aria-label="作者确认理由" maxLength={2000} rows={3} value={memoryReason} onChange={e=>setMemoryReason(e.target.value)}/></label><label className="memory-attestation"><input type="checkbox" aria-label="我理解这条转述未经验证" checked={memoryAcknowledged} onChange={e=>setMemoryAcknowledged(e.target.checked)}/><span>{engine.MEMORY_ATTESTATION_STATEMENT}</span></label><div className="draft-actions"><button onClick={()=>setMemoryDecision(null)}>取消作者确认</button><button className="primary" disabled={busy||!memoryReason.trim()||!memoryAcknowledged} onClick={confirmMemoryDecision}>确认保留未验证转述</button></div></DecisionDialog>}
 {revisionAdoption&&<RevisionAdoptionDialog choice={revisionAdoption} busy={busy} saveError={saveError} onRetrySave={()=>persist(ref.current)} onClose={()=>setRevisionAdoption(null)} onConfirm={confirmRevisionAdoption}/>}
 {contextRefresh&&<DecisionDialog label="确认更新候选参考上下文" title="保留候选正文，更新参考上下文" onClose={()=>setContextRefresh(null)}><p>目标章节：{contextRefresh.chapterTitle}</p><p>将此候选稿绑定到当前已保存的故事状态。正文不会自动改写，可能仍与新上下文冲突；原版本与审计历史保留。</p><p className="warning">旧提取、审阅与记忆选择将失效。之后须重新提取并逐条选择，或重新明确选择不提取记忆，再审阅和确认，才能接受。更新本身不调用模型。</p><div className="draft-actions"><button data-autofocus onClick={()=>setContextRefresh(null)}>取消更新</button><button className="primary" disabled={busy} onClick={confirmContextRefresh}>确认更新参考上下文</button></div></DecisionDialog>}
 {extractionSkip&&<DecisionDialog label="确认不提取候选记忆" title="仅保留正文 · 不提取候选记忆" onClose={()=>setExtractionSkip(null)}><p className="fine">候选 r{extractionSkip.revision} · 文本校验 {extractionSkip.textHash}</p><p>当前提取状态：{({pending:'尚未完成',complete:'已完成',failed:'失败',cancelled:'已取消',skipped:'已明确跳过'})[extractionSkip.status]} · {extractionSkip.count} 条候选记忆</p><p>确认后将清空当前候选记忆与选择，并把旧提取、原文引文、选择及审阅记录保留在历史中；已提交的故事记忆不变。</p><p className="warning">旧结构审查、模型审阅和设定例外全部失效。模型来源保持不变；仍须重新审查、解决设定冲突，并在最后明确确认接受正文。</p><p>这一步不调用模型，新增 0 条记忆；不表示没有可提取内容，也不表示全流程 0 次调用。模型审阅仍需单独请求，已有请求可能已计费。接受后的正文仍会进入后续章节上下文。</p><div className="draft-actions"><button data-autofocus onClick={()=>setExtractionSkip(null)}>返回核对</button><button className="primary" disabled={busy||!!saveError} onClick={confirmExtractionSkip}>确认不提取记忆</button></div></DecisionDialog>}
 {acceptance&&<DecisionDialog label="确认接受候选稿与已选记忆" title="确认接受正文与所选记忆" onClose={()=>setAcceptance(null)}><p>目标章节：{acceptance.chapterTitle}</p><p className="fine">候选 r{acceptance.draftRevision} · 文本校验 {acceptance.textHash}</p>{acceptance.manualSource&&<p className="warning">手写稿来自已保存正文 r{acceptance.manualSource.revision}，原文不变。接受只记录作者决定，不表示模型验证、设定无冲突或文学质量合格；此前正文版本与作者分类来源会保留。</p>}<p>将接受当前候选正文，并提交已选的 {acceptance.selected.length} / {acceptance.total} 条记忆。未选中的候选记忆不会进入故事记忆。</p>{acceptance.selected.length===0?<p className="warning">此次仅接受正文，提交 0 条候选记忆。{acceptance.extractionStatus==='skipped'&&'作者已明确跳过记忆提取，模型来源保留；这不是提取成功的空结果，也不免除当前审阅。'}接受正文仍会进入后续章节上下文。</p>:<ul className="accepted-memory-list">{acceptance.selected.map(item=><li key={item.candidateId}><strong>{memoryChoiceLabel(item.decision?.action)}</strong>{item.decision?.action==='keep_quote'?<QuoteCard card={item.quoteCard}/>:<><p>转述：{item.label}</p><p>作者理由：{item.decision?.reason}</p><p className="warning">即使模型判断支持，该转述仍未经验证，不保证原文蕴含或故事世界真相。</p></>}</li>)}</ul>}<p className="fine">原文摘录仅确认文本存在；作者确认的转述仍未经验证。模型建议和作者选择都不是独立正确性证明。编辑、重新提取、重新审阅或切换项目后，必须重新确认。</p><div className="draft-actions"><button data-autofocus onClick={()=>setAcceptance(null)}>返回核对</button><button className="primary" disabled={busy} onClick={confirmAcceptance}>确认接受正文与所选记忆</button></div></DecisionDialog>}
 {importPreview&&<div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-label="备份导入预览" onKeyDown={e=>{if(e.key==='Escape'){++importSequence.current;setImportPreview(null)}}}><header><h2>备份导入预览</h2></header><p>作为新项目导入，不覆盖现有项目。原始正文版本和设定例外审计保留在导入来源中。待决补丁不自动执行；待定候选的旧审阅与例外确认失效，必须重新审阅。</p><ul>{[importPreview,...(importPreview.archived||[])].map(p=><li key={p.state.projectId}>{p.state.title} · {p.state.chapters.length} 章 · {p.state.chapters.reduce((n,c)=>n+c.revisions.length,0)} 个正文版本 · {p.state.commits.length} 条提交 · {p.state.drafts.reduce((n,d)=>n+(d.factDecisions?.length||0),0)} 条候选例外决定</li>)}</ul><p>仅验证数据结构，不证明内容真实或模型判断正确。当前运行方式不变。导入来源会占用额外本地空间；浏览器存储不是可靠的异地备份。</p><button onClick={()=>{++importSequence.current;setImportPreview(null)}}>取消导入</button><button className="primary" disabled={busy} onClick={confirmImport}>确认作为新项目导入</button></section></div>}
 {recoveryConfirm&&<div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-label="确认恢复存储"><h2>确认恢复存储</h2><p>将用当前显示的工作区和内存编辑修复主存储。可读取的损坏原始数据必须先保留成功；失败时不会覆盖。建议先下载当前内容与原始数据。上一份备份可能缺少最近一次修改。</p><button onClick={()=>setRecoveryConfirm(false)}>取消恢复</button><button onClick={recover}>保留原始数据并确认恢复</button></section></div>}
 {wizard&&<ProjectWizard provider={provider} onCreate={createProject} onCancel={()=>setWizard(false)}/>}
 {providerSettings&&<ProviderPanel mode={mode} onMode={newMode=>{task.cancel();if(persist({...ref.current,providerMode:newMode})){setProviderSettings(false);notify(newMode==='server'?'已选择服务端模型；每次调用受服务端上限控制，失败不会回退模板':'已选择离线模板，不调用外部模型')}}} onClose={()=>setProviderSettings(false)}/>}
 {classify&&<div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-label="确认改文类型"><header><h2>这次修改如何影响故事？</h2><button aria-label="关闭分类" className="icon-button" onClick={()=>setClassify(false)}><X/></button></header><p className="muted">{interpretation?'模型解释是候选建议。请检查下列证据，再明确选择局部表达或确认一条正文设定。':'当前未连接语义模型。请明确选择只保存局部表达，或从正文中摘取一条已确认的设定。'}</p>{interpretation&&<div className="model-review"><h4>模型解释</h4><p>{interpretation.summary}</p>{interpretation.questions?.map((q,i)=><p key={i} className="warning">{q}</p>)}{interpretation.suggestedFacts?.map((f,i)=><button key={i} className="suggested-fact" onClick={()=>setStatement(f.sourceQuote)}>{f.label}<br/>原文：{f.sourceQuote}</button>)}<p className="model-limit">点击候选仅填入待确认内容，不会提交记忆</p></div>}<label className="form-label">设定操作<select aria-label="要替代的现有设定" value={targetFact} onChange={e=>setTargetFact(e.target.value)}><option value="">新增一条设定</option>{s.facts.filter(f=>f.status==='confirmed').map(f=><option value={f.id} key={f.id}>替代：{f.label}</option>)}</select></label><label className="form-label">确认的设定（须为正文精确片段）<textarea value={statement} onChange={e=>setStatement(e.target.value)} rows={3}/></label><div className="draft-actions"><button onClick={()=>authorClassify('local_prose')}>仅局部表达，不更新设定</button><button className="primary" disabled={!statement.trim()} onClick={()=>authorClassify('author_fact')}>按这条设定准备补丁</button></div></section></div>}

 </div>
}
