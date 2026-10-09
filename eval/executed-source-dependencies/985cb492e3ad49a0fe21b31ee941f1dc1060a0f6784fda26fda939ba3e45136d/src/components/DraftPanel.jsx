import RevisionPanel from './RevisionPanel.jsx';
import SceneIntent from './SceneIntent.jsx';
import {useState,useRef,useEffect} from 'react';
import {Check, X, ShieldCheck, FileText} from 'lucide-react';

const statusLabels={consistent:'一致',contradiction:'冲突',not_applicable:'不适用',unknown:'未知 / 未判断'};
export function FactEvidence({item}) {
 return <div className="fact-evidence" style={{minWidth:0,overflowWrap:'anywhere'}}>
  <p><strong>{item.factLabel}</strong><br/>设定 {item.factId} · 记录 v{item.recordVersion}</p>
  <p>设定来源：{item.factSource?.chapterId||'缺失章节'} · 正文 r{item.factSource?.revision??'未知'}{item.factSource?.paragraphId?` · 段落 ${item.factSource.paragraphId}`:''}</p>
  <blockquote style={{whiteSpace:'pre-wrap',margin:'8px 0 16px',padding:'10px 12px',borderLeft:'3px solid var(--line)',background:'#f4f6f0'}}>{item.factSource?.quote||'无可核验的设定原文'}</blockquote>
  {!item.provenanceValid&&<p className="warning">原始版本证据无法核验</p>}
  <p>候选证据：{item.candidate?.draftId} · 候选 r{item.candidate?.revision}</p>
  <blockquote style={{whiteSpace:'pre-wrap',margin:'8px 0 16px',padding:'10px 12px',borderLeft:'3px solid var(--line)',background:'#f4f6f0'}}>{item.sourceQuote||'模型未提供候选原文证据，请核对完整候选稿'}</blockquote>
  <p>模型判断：{statusLabels[item.status]||item.status} · {item.explanation}</p>
 </div>;
}
const memoryStatusLabels={supported:'模型判断：原文支持（可能误判）',unsupported:'模型判断：原文不支持',unknown:'未知 / 未判断'};
export const isSelectedMemory=item=>item.resolved&&['keep_quote','attest_keep'].includes(item.decision?.action);
export function memoryChoiceLabel(action){
 const labels={keep_quote:'原文摘录 · 仅确认文本存在',attest_keep:'作者确认的未验证转述',keep:'历史保留 · 未验证转述',override_keep:'历史例外保留 · 未验证转述',reject:'作者已拒绝 · 不会提交'};
 return typeof action==='string'&&Object.hasOwn(labels,action)?labels[action]:'未验证的历史记忆';
}
export function QuoteCard({card}){
 if(!card)return <p className="warning" aria-label="原文摘录不可用">无法唯一定位原文段落，暂不能保留原文摘录。请重新提取或修正来源；模型建议不能替代原文定位。</p>;
 return <section className="quote-card" aria-label="原文摘录卡">
  <h4>原文摘录 · 完整来源段落</h4>
  <p className="fine">章节 {card.chapterId} · 候选 {card.draftId} · 候选 r{card.draftRevision} · 段落 {card.paragraphId}{Number.isInteger(card.paragraphIndex)?`（第 ${card.paragraphIndex+1} 段）`:''} · 字符位置 {card.start}–{card.end}</p>
  {card.before&&<div className="quote-context"><p className="fine">前文上下文 · {card.before.paragraphId} · {card.before.start}–{card.before.end}</p><blockquote aria-label="摘录前文上下文">{card.before.text}</blockquote></div>}
  <blockquote aria-label="完整来源段落">{card.text}</blockquote>
  {card.after&&<div className="quote-context"><p className="fine">后文上下文 · {card.after.paragraphId} · {card.after.start}–{card.after.end}</p><blockquote aria-label="摘录后文上下文">{card.after.text}</blockquote></div>}
  <p className="fine">程序仅确认这些文字出现在所标来源中。不保证候选转述被原文蕴含，也不保证叙述、传闻或角色认知是故事世界的真相。保留本摘录无需模型核对。</p>
 </section>;
}
export function MemoryEvidence({item}) {
 return <div className="memory-evidence">
  <div className="memory-paraphrase" aria-label="模型候选转述"><p><strong>候选标签：{item.label}</strong></p><p className="fine">模型生成的转述 · 未验证，不能因模型判断支持而成为已验证事实</p>
   <p className="fine">候选记忆 {item.candidateId} · 候选 r{item.binding?.draftRevision??'未知'}{Number.isInteger(item.candidateSnapshot?.sourceParagraphIndex)?` · 段落 ${item.candidateSnapshot.sourceParagraphIndex+1}`:''}{Number.isInteger(item.candidateSnapshot?.sourceStart)?` · 字符位置 ${item.candidateSnapshot.sourceStart}–${item.candidateSnapshot.sourceEnd}`:''}</p>
   <p className="fine">候选附带的原始引文（与完整来源段落分开保留）</p><blockquote aria-label="完整候选原文引用">{item.sourceQuote||'缺少可核验的原文引用'}</blockquote>
  </div>
  <QuoteCard card={item.quoteCard}/>
  <section className="memory-model-advice" aria-label="可选模型建议"><h4>可选模型建议 · 不授予事实可信度</h4>
   <p className="warning">独立引文核对：{item.isolatedAssessmentId?(memoryStatusLabels[item.status]||memoryStatusLabels.unknown):memoryStatusLabels.unknown}</p>
   <p>{item.assessmentOrigin==='historic_combined_unverified'?'此历史记录来自旧版整章判断，未经单条引文独立核对':item.explanation||'尚无当前版本的独立引文判断；不影响有效原文摘录的选择'}</p>
   <p className="warning" aria-label="模型记忆判断风险">模型判断只是建议，真实测试曾在缺少标签细节时误报支持。即使模型判断 supported，转述仍未经验证；原文包含不等于含义蕴含，更不等于故事世界真相。</p>
   {item.legacyAssessment&&<div className="legacy-memory-assessment" aria-label="历史整章记忆判断"><p>历史整章判断（未经独立核对，不授予保留或事实验证权限）：{memoryStatusLabels[item.legacyAssessment.status]||memoryStatusLabels.unknown}</p><p>{item.legacyAssessment.explanation}</p></div>}
  </section>
 </div>;
}
export function StoredMemoryEvidence({record,quoteCard,isEvent=false}){
 const decision=record.memoryDecision||(isEvent?{}:null);
 if(!decision)return null;
 const card=quoteCard;
 return <section className="memory-evidence" aria-label="已保存记忆的可信度说明"><p className="warning">{memoryChoiceLabel(decision.action)}</p>{!record.memoryDecision&&<p className="warning">历史记忆缺少作者选择记录，未经验证；旧 confirmed 状态不构成事实验证。</p>}<p className="fine">已接受来源：章节 {record.source?.chapterId||'未知'} · 正文 r{record.source?.revision??'未知'}{record.source?.paragraphId?` · 段落 ${record.source.paragraphId}`:''}</p>
  {decision.action==='keep_quote'?<><p>保存的是精确原文摘录。仅核验文本存在，不保证世界真相或任何转述的含义。</p>{card?<QuoteCard card={card}/>:<blockquote aria-label="已保存原文摘录">{record.source?.quote||record.label}</blockquote>}{record.originalLabel&&<p className="fine">原始模型候选转述（仅供审计，未作为记忆正文）：{record.originalLabel}</p>}</>:<><p>这条转述没有得到独立事实验证；模型支持判断和作者选择都不保证原文蕴含它，也不保证故事世界真相。</p><p>转述：{record.label}</p><blockquote aria-label="已保存转述的原始引文">{record.source?.quote||'缺少原始引文'}</blockquote></>}
  {decision.reason&&<p>作者理由：{decision.reason}</p>}{decision.attestation?.statement&&<p>作者确认声明：{decision.attestation.statement}</p>}
 </section>;
}
// Keep keyboard focus inside the decision, and return it to its opener on close.
export function DecisionDialog({label,title,onClose,children}) {
 const container=useRef(null);
 useEffect(()=>{const opener=document.activeElement;const panel=container.current;(panel?.querySelector('[data-autofocus]')||panel)?.focus();return()=>{if(opener?.isConnected)opener.focus()}},[]);
 function keydown(event){
  if(event.key==='Escape'){event.preventDefault();onClose();return}
  if(event.key!=='Tab')return;
  const controls=[...container.current.querySelectorAll('button:not(:disabled),textarea:not(:disabled),input:not(:disabled),[tabindex="0"]')];
  if(!controls.length){event.preventDefault();container.current.focus();return}
  const first=controls[0],last=controls.at(-1);
  if(event.shiftKey&&(document.activeElement===first||document.activeElement===container.current)){event.preventDefault();last.focus()}
  else if(!event.shiftKey&&(document.activeElement===last||document.activeElement===container.current)){event.preventDefault();first.focus()}
 }
 return <div className="modal-backdrop"><section ref={container} className="modal memory-decision-modal" role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} onKeyDown={keydown}><header><h2>{title}</h2><button className="icon-button" aria-label={`关闭${label}`} onClick={onClose}><X/></button></header>{children}</section></div>;
}
export default function DraftPanel({drafts,chapterTitle=null,chapterIntent=null,sceneIntentByDraft={},contextCurrent={},onRefreshContext,onReview,onAccept,onReject,onEdit,factReviews={},onFactDecision,onExtract,onSkipExtraction,onEditingChange,extractionReady={},memoryReviews={},onMemoryDecision,onRejectAllMemory,onMemoryAudit,revisionCurrent={},onRevisionInstruction,onRequestRevision,onAdoptRevision,onDiscardRevision,onCancelRevision,mode='template',auditBudget=null,auditDisabled=false,busy=false}) {
 const [editing,setEditing]=useState(null),[text,setText]=useState('');
 useEffect(()=>{onEditingChange?.(editing!==null);return()=>onEditingChange?.(false)},[editing,onEditingChange]);
 return <section className="draft-section"><header><h2>{chapterTitle?`${chapterTitle} · 候选稿`:'下一场景 · 候选稿'}</h2><span>候选先隔离 · 接受才提交</span></header>
 {drafts.length===0?<><SceneIntent reference={chapterIntent}/><p className="empty-note">生成后先审阅，再决定是否接受。候选事件不会进入故事记忆。</p></>:drafts.slice().reverse().map(d=>{
  const ledger=factReviews[d.id]||[],unresolved=ledger.filter(item=>item.blocking&&!item.resolved),memories=memoryReviews[d.id]||[],pendingMemories=memories.filter(item=>!item.resolved),selectedMemories=memories.filter(isSelectedMemory),active=!['ACCEPTED','REJECTED'].includes(d.status),needsExtraction=d.requiresExtraction&&active&&!extractionReady[d.id],rejected=d.status==='REJECTED',skipped=d.extraction?.status==='skipped',extracted=d.extraction?.status==='complete'&&(extractionReady[d.id]||d.status==='ACCEPTED'),emptyExtraction=extracted&&d.staging?.length===0&&!rejected;
  const extractionMessage=skipped?'作者明确选择不提取记忆 · 0 条候选；跳过这一步不调用模型，不代表没有可提取内容':rejected?'候选稿已拒绝 · 提取已取消；历史提取与选择记录已归档，未提交':d.extraction?.status==='failed'?'提取未完成 · 已保存的正文保留':d.extraction?.status==='cancelled'?'提取已取消 · 已保存的正文保留':extracted?(d.status==='ACCEPTED'?'此版本已接受 · 仅作者选中的记忆已提交':'当前正文的候选记忆已提取 · 尚需核对与审阅'):'正文已保存 · 可提取当前版本的候选记忆，或明确选择不提取';
  return <article className="draft" key={d.id}>
   <div className="draft-meta"><span><FileText/>{d.id}</span><span>基于 v{d.baseVersion} · 候选 r{d.revision} · {d.manualSource?'作者手写稿 · 未验证':d.requiresSemanticReview?'真实模型':'确定性模板'} · {d.status}</span></div>
   <SceneIntent reference={sceneIntentByDraft[d.id]} editing={editing===d.id}/>
   <div className="draft-prose">{d.text}</div>{d.manualSource&&<p className="fine" aria-label="手写稿来源">原正文 r{d.manualSource.revision} · 作者分类 {d.manualSource.patchId}。手写候选保留此版本不变；修改请回章节编辑器分类保存、拒绝旧稿，再准备新稿。{d.requiresSemanticReview?'当前有已确认设定：仍须明确点击模型审查，并逐项解决冲突或未知判断；不会自动请求模型。':'当前无已确认设定：只做本地结构检查即可进入作者确认，不调用模型；语义一致性未评估。'}</p>}
   {active&&d.requiresExtraction&&contextCurrent[d.id]===false&&<div className="warning" aria-label="候选参考上下文已过期"><p>参考正文、故事状态或上下文格式已变化。可保留本稿正文并更新参考上下文，再重新提取或明确选择不提取记忆，然后重新审阅。旧批准不能沿用。</p><button disabled={busy} onClick={()=>onRefreshContext?.(d.id)}>更新参考上下文</button></div>}
   {editing===d.id&&<><textarea className="draft-edit" aria-label="编辑候选稿" value={text} onChange={e=>setText(e.target.value)}/><button onClick={()=>{onEdit(d.id,text);setEditing(null)}}>保存候选稿修改</button><button onClick={()=>setEditing(null)}>取消候选稿修改</button></>}
   <RevisionPanel draft={d} mode={mode} busy={busy||editing!==null} disabled={auditDisabled} current={revisionCurrent[d.id]} onInstruction={onRevisionInstruction} onRequest={onRequestRevision} onAdopt={onAdoptRevision} onDiscard={onDiscardRevision} onCancel={onCancelRevision}/><div className="staging"><b>候选记忆暂存区</b><span>仅在接受正文后保存所选摘录或未验证转述</span></div>
   {d.requiresExtraction&&<div className="extraction-status" aria-label="候选记忆提取状态"><p className={extracted&&!rejected?'success-note':'warning'}>{extractionMessage}</p><p className="fine">{d.manualSource?'手写稿的准备、明确跳过提取、结构检查与接受不调用模型。可选提取会额外调用模型；有已确认设定时审查也需明确调用模型。跳过提取不能解除设定冲突。':'模型正文、可选记忆提取、整章审阅分别调用模型。可明确跳过提取并以 0 条新记忆接受正文；模型来源、整章审阅与设定冲突门禁保留。跳过不调用模型，不表示全流程零调用。失败不会自动成为空结果；接受正文仍进入后续上下文。'}</p></div>}
   {active&&memories.length>0&&<div className="memory-audit-budget" aria-label="独立核对调用预算"><p>{d.manualSource?'手写稿不调用生成。可选记忆提取额外 1 次请求；有已确认设定时，明确请求的整章审阅额外 1 次。每条可选独立核对再增加 1 次；摘录选择、转述确认和全部拒绝不调用模型，不会批量调用或自动重试。':'选择提取时，真实模型每章基础 3 次请求（正文、提取、整章审阅）+ K 次可选单条独立核对。明确跳过提取则通常为正文 + 整章审阅 2 次；已有请求不会因跳过而撤销或退款。保留原文摘录、作者确认转述和全部拒绝均不调用模型。每次点击独立核对仅核对一条，额外 1 次模型请求，不会批量调用或自动重试。'}</p><p>此前访谈、规划、生成及其他调用也会占用服务端本次进程上限。{auditBudget?`最近一次派发前检查：已用 ${auditBudget.callsUsed} / ${auditBudget.maxCalls} 次；此后用量可能变化。`:'尚无当前预算读数；每次核对前会检查，预算缺失或耗尽时不发送。'}服务端上限最终生效；调用数不是金额上限，账单费用仍未知。</p>{mode!=='server'&&<p>离线模板不发起独立模型核对；可保留有效原文摘录、明确确认未验证转述或拒绝。需要模型建议时请先明确选择真实模型模式。</p>}</div>}
   <section className="memory-candidates" aria-label="候选记忆逐条选择">
    {memories.map((item,index)=><article className="staged-event" key={item.candidateId} data-candidate-id={item.candidateId} aria-label={`候选记忆 ${index+1}：${item.label}`}>
     <MemoryEvidence item={item}/>
     {active&&<p className="fine" aria-label={`独立核对状态 ${index+1}`}>{({pending:'尚未收到独立核对结果 · 预算检查或请求未完成',complete:'独立核对已完成 · 判断仍可能有误',failed:'独立核对失败 · 未采用任何新判断，可按需手动重试',cancelled:'独立核对已取消 · 迟到结果不会采用',stale:'旧独立核对已过期 · 可按需对当前版本手动核对'})[item.auditState]||'尚未使用可选独立核对 · 原文摘录无需模型建议'}</p>}
     <p className={item.resolved?'success-note':'warning'}>{item.resolved?`${memoryChoiceLabel(item.decision?.action)}${['keep_quote','attest_keep'].includes(item.decision?.action)?(d.status==='ACCEPTED'?' · 已随正文保存':' · 接受稿件后提交'):''}`:'尚未决定 · 阻塞接受'}</p>
     {item.decision?.reason&&<p>作者理由：{item.decision.reason}</p>}
     {active&&<div className="memory-actions"><button className="primary" disabled={busy||auditDisabled||!item.canKeepQuote} aria-label={`保留原文摘录候选记忆 ${index+1}：${item.label}`} aria-pressed={item.resolved&&item.decision?.action==='keep_quote'} onClick={()=>onMemoryDecision?.(d.id,item.candidateId,'keep_quote')}>保留原文摘录</button><button disabled={busy||auditDisabled||!item.canAttest} aria-label={`作者确认未验证转述候选记忆 ${index+1}：${item.label}`} aria-pressed={item.resolved&&item.decision?.action==='attest_keep'} onClick={()=>onMemoryDecision?.(d.id,item.candidateId,'attest_keep')}>作者确认未验证转述</button><button disabled={busy||auditDisabled||!item.canDecide} aria-label={`拒绝候选记忆 ${index+1}：${item.label}`} aria-pressed={item.resolved&&item.decision?.action==='reject'} onClick={()=>onMemoryDecision?.(d.id,item.candidateId,'reject')}>拒绝</button><button disabled={busy||auditDisabled||mode!=='server'||!item.canAudit} aria-label={`独立核对候选记忆 ${index+1}：${item.label}（可选，额外 1 次模型请求）`} onClick={()=>onMemoryAudit?.(d.id,item.candidateId)}>可选独立核对 · 额外 1 次模型请求</button></div>}
    </article>)}
    {rejected&&<p className="fine" aria-label="候选记忆已归档">此稿已拒绝，原有候选与作者选择仅保留在审计记录中，不会提交为故事记忆。</p>}
    {(skipped||emptyExtraction||!d.requiresExtraction&&memories.length===0&&!rejected)&&<p className="fine" aria-label="无候选记忆">{skipped?'作者选择不提取 · 0 条候选记忆。正文仍会作为已接受原文进入后续上下文。':d.requiresExtraction?'提取成功 · 返回 0 条候选记忆。空结果不证明没有遗漏。':'此稿没有候选记忆。'}</p>}
   </section>
   {d.extraction?.reviewNotes?.map((note,i)=><p className="fine" key={i}>{note}</p>)}
   {active&&!needsExtraction&&<p className="warning" aria-label="候选记忆提交须知">默认保留可追溯的原文摘录，只确认文本存在。若要保留候选转述，须另行勾选未验证风险并说明作者理由。模型 supported 不会让转述成为已验证事实。全部拒绝也可接受正文；选择和拒绝不产生模型请求。</p>}
   {d.review&&<p className={d.review.valid||d.review.passed?'success-note':'warning'}><ShieldCheck/>{d.review.passed?(d.modelReview?'结构检查通过 · 模型语义建议见下方':d.review.semanticStatus==='not_evaluated'?'结构检查通过 · 语义一致性未评估':'当前版本检查通过'):'审查未通过'} {JSON.stringify(d.review.errors||d.review.issues||[])!=='[]'?(d.review.errors||d.review.issues||[]).map(e=>e.explanation||e.message||e).join('；'):''}</p>}
   {d.modelReview&&<div className="model-review"><h4>模型语义审阅 · 非独立正确性证明</h4><p>{d.modelReview.summary}</p><p className="model-limit">模型判断可能遗漏或误判；逐条核对原文。确认例外只解除本稿的该项阻塞，保留原设定，不会修改故事记忆。</p>{d.modelReview.issues?.map((issue,i)=><p className={issue.severity==='error'?'warning':''} key={i}>{issue.explanation}<br/>依据：{issue.sourceQuote}</p>)}
    <section aria-label="已确认设定逐条审阅"><h4>已确认设定 · 逐条核对</h4>{ledger.length===0?<p>没有需逐条审阅的作者确认设定</p>:ledger.map(item=><article className="fact-review-item" style={{borderTop:'1px solid var(--line)',paddingTop:16,marginTop:16}} key={item.factId} data-fact-id={item.factId}>
     <FactEvidence item={item}/>
     <p className={item.blocking&&!item.resolved?'warning':'success-note'}>{item.resolved?'作者已明确接受本稿例外 · 原设定保留':item.blocking?'未解决 · 阻塞接受':'无阻塞 · 仍需作者核对'}</p>
     {item.resolved&&<p>作者理由：{d.factDecisions?.find(x=>x.factId===item.factId)?.reason}</p>}
     {active&&item.blocking&&!item.resolved&&<button disabled={busy} onClick={()=>onFactDecision?.(d.id,item.factId)}>审阅并决定此项例外</button>}
    </article>)}</section>
   </div>}
   {active&&<><p className="memory-selection-summary" aria-label="候选记忆选择汇总" id={`memory-gate-${d.id}`}>已选 {selectedMemories.length} / {memories.length} 条候选记忆 · {pendingMemories.length} 条尚未决定</p>{memories.length>0&&<button disabled={busy||auditDisabled||memories.some(item=>!item.canDecide)} onClick={()=>onRejectAllMemory?.(d.id)}>全部拒绝候选记忆 · 不调用模型</button>}{unresolved.length>0&&<p className="warning" id={`fact-gate-${d.id}`}>还有 {unresolved.length} 项设定冲突或未知判断未解决。请编辑此稿后重新审查，或逐条明确确认例外并填写理由。</p>}<div className="draft-actions">{!d.manualSource&&<button onClick={()=>{setEditing(d.id);setText(d.text)}}>编辑此稿</button>}{d.requiresExtraction&&!skipped&&<button disabled={busy||auditDisabled||editing!==null} onClick={()=>onSkipExtraction?.(d.id)}>不提取记忆 · 仅保留正文</button>}{d.requiresExtraction&&<button disabled={busy||!!d.manualSource&&(auditDisabled||mode!=='server')} onClick={()=>onExtract?.(d.id)}>{needsExtraction||skipped?'提取候选记忆':'重新提取候选记忆'}</button>}<button disabled={busy||needsExtraction||editing!==null} onClick={()=>onReview(d.id)}><ShieldCheck/>审查候选稿</button><button onClick={()=>onReject(d.id)}><X/>拒绝此稿</button><button className="primary" disabled={unresolved.length>0||pendingMemories.length>0||needsExtraction||busy||editing!==null} aria-label="接受此版本" aria-describedby={`memory-gate-${d.id}${unresolved.length?` fact-gate-${d.id}`:''}`} onClick={()=>onAccept(d.id)}><Check/>接受此版本 · 提交 {selectedMemories.length} 条记忆</button></div></>}
  </article>;
 })}</section>;
}
