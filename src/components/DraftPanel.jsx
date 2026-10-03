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
const memoryStatusLabels={supported:'原文支持',unsupported:'原文不支持',unknown:'未知 / 未判断'};
export function MemoryEvidence({item}) {
 return <div className="memory-evidence">
  <p><strong>候选标签：{item.label}</strong></p>
  <p className="fine">候选记忆 {item.candidateId} · 候选 r{item.binding?.draftRevision??'未知'}{Number.isInteger(item.candidateSnapshot?.sourceParagraphIndex)?` · 段落 ${item.candidateSnapshot.sourceParagraphIndex+1}`:''}{Number.isInteger(item.candidateSnapshot?.sourceStart)?` · 字符位置 ${item.candidateSnapshot.sourceStart}–${item.candidateSnapshot.sourceEnd}`:''}</p>
  <blockquote aria-label="完整候选原文引用">{item.sourceQuote||'缺少可核验的原文引用'}</blockquote>
  <p className={item.status==='supported'?'success-note':'warning'}>模型逐条判断：{memoryStatusLabels[item.status]||memoryStatusLabels.unknown}</p>
  <p>{item.explanation||'尚无当前版本的逐条语义判断，请先审查候选稿'}</p>
 </div>;
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
export default function DraftPanel({drafts,onReview,onAccept,onReject,onEdit,factReviews={},onFactDecision,onExtract,extractionReady={},memoryReviews={},onMemoryDecision,busy=false}) {
 const [editing,setEditing]=useState(null),[text,setText]=useState('');
 return <section className="draft-section"><header><h2>下一场景 · 候选稿</h2><span>候选先隔离 · 接受才提交</span></header>
 {drafts.length===0?<p className="empty-note">生成后先审阅，再决定是否接受。候选事件不会进入故事记忆。</p>:drafts.slice().reverse().map(d=>{
  const ledger=factReviews[d.id]||[],unresolved=ledger.filter(item=>item.blocking&&!item.resolved),memories=memoryReviews[d.id]||[],pendingMemories=memories.filter(item=>!item.resolved),selectedMemories=memories.filter(item=>item.resolved&&['keep','override_keep'].includes(item.decision?.action)),active=!['ACCEPTED','REJECTED'].includes(d.status),needsExtraction=d.requiresExtraction&&active&&!extractionReady[d.id],rejected=d.status==='REJECTED',extracted=d.extraction?.status==='complete'&&(extractionReady[d.id]||d.status==='ACCEPTED'),emptyExtraction=extracted&&d.staging?.length===0&&!rejected;
  const extractionMessage=rejected?'候选稿已拒绝 · 提取已取消；历史提取与选择记录已归档，未提交':d.extraction?.status==='failed'?'提取未完成 · 已保存的正文保留':d.extraction?.status==='cancelled'?'提取已取消 · 已保存的正文保留':extracted?(d.status==='ACCEPTED'?'此版本已接受 · 仅作者选中的记忆已提交':'当前正文的候选记忆已提取 · 尚需核对与审阅'):'正文已保存 · 需要提取当前版本的候选记忆';
  return <article className="draft" key={d.id}>
   <div className="draft-meta"><span><FileText/>{d.id}</span><span>基于 v{d.baseVersion} · 候选 r{d.revision} · {d.requiresSemanticReview?'真实模型':'确定性模板'} · {d.status}</span></div>
   <div className="draft-prose">{d.text}</div>
   {editing===d.id&&<><textarea className="draft-edit" aria-label="编辑候选稿" value={text} onChange={e=>setText(e.target.value)}/><button onClick={()=>{onEdit(d.id,text);setEditing(null)}}>保存候选稿修改</button></>}
   <div className="staging"><b>候选记忆暂存区</b><span>本稿事件仅在作者接受后成为已确认状态</span></div>
   {d.requiresExtraction&&<div className="extraction-status" aria-label="候选记忆提取状态"><p className={extracted&&!rejected?'success-note':'warning'}>{extractionMessage}</p><p className="fine">正文、提取、审阅分别调用模型。失败不会自动重试；版本、段落位置与原文引用由程序生成。空结果不证明没有遗漏。</p></div>}
   <section className="memory-candidates" aria-label="候选记忆逐条选择">
    {memories.map((item,index)=><article className="staged-event" key={item.candidateId} data-candidate-id={item.candidateId} aria-label={`候选记忆 ${index+1}：${item.label}`}>
     <MemoryEvidence item={item}/>
     <p className={item.resolved?'success-note':'warning'}>{item.resolved?(item.decision?.action==='reject'?'作者已拒绝 · 不会提交':item.decision?.action==='override_keep'?'作者例外保留 · 未经模型验证':'作者已选择保留 · 接受稿件后提交'):'尚未决定 · 阻塞接受'}</p>
     {item.decision?.reason&&<p>作者理由：{item.decision.reason}</p>}
     {active&&<div className="memory-actions"><button disabled={busy||!item.canKeep} aria-label={`保留候选记忆 ${index+1}：${item.label}`} aria-pressed={item.resolved&&item.decision?.action==='keep'} onClick={()=>onMemoryDecision?.(d.id,item.candidateId,'keep')}>保留</button><button disabled={busy||!item.canDecide} aria-label={`拒绝候选记忆 ${index+1}：${item.label}`} aria-pressed={item.resolved&&item.decision?.action==='reject'} onClick={()=>onMemoryDecision?.(d.id,item.candidateId,'reject')}>拒绝</button>{!item.canKeep&&<button disabled={busy||!item.canOverride} aria-label={`例外保留候选记忆 ${index+1}：${item.label}`} onClick={()=>onMemoryDecision?.(d.id,item.candidateId,'override_keep')}>审阅并例外保留</button>}</div>}
    </article>)}
    {rejected&&<p className="fine" aria-label="候选记忆已归档">此稿已拒绝，原有候选与作者选择仅保留在审计记录中，不会提交为故事记忆。</p>}
    {(emptyExtraction||!d.requiresExtraction&&memories.length===0&&!rejected)&&<p className="fine" aria-label="无候选记忆">{d.requiresExtraction?'提取成功 · 返回 0 条候选记忆。空结果不证明没有遗漏。':'此稿没有候选记忆。'}</p>}
   </section>
   {d.extraction?.reviewNotes?.map((note,i)=><p className="fine" key={i}>{note}</p>)}
   {active&&!needsExtraction&&<p className="warning" aria-label="候选记忆提交须知">请逐条决定保留或拒绝。接受此版本仅提交明确选中的候选记忆；全部拒绝也可接受正文。模型的逐条判断可能误判，精确引用与格式通过不代表含义正确；例外保留属于作者决定，不是已验证事实。</p>}
   {d.review&&<p className={d.review.valid||d.review.passed?'success-note':'warning'}><ShieldCheck/>{d.review.passed?(d.modelReview?'结构检查通过 · 模型语义建议见下方':d.review.semanticStatus==='not_evaluated'?'结构检查通过 · 语义一致性未评估':'当前版本检查通过'):'审查未通过'} {JSON.stringify(d.review.errors||d.review.issues||[])!=='[]'?(d.review.errors||d.review.issues||[]).map(e=>e.explanation||e.message||e).join('；'):''}</p>}
   {d.modelReview&&<div className="model-review"><h4>模型语义审阅 · 非独立正确性证明</h4><p>{d.modelReview.summary}</p><p className="model-limit">模型判断可能遗漏或误判；逐条核对原文。确认例外只解除本稿的该项阻塞，保留原设定，不会修改故事记忆。</p>{d.modelReview.issues?.map((issue,i)=><p className={issue.severity==='error'?'warning':''} key={i}>{issue.explanation}<br/>依据：{issue.sourceQuote}</p>)}
    <section aria-label="已确认设定逐条审阅"><h4>已确认设定 · 逐条核对</h4>{ledger.length===0?<p>没有需逐条审阅的作者确认设定</p>:ledger.map(item=><article className="fact-review-item" style={{borderTop:'1px solid var(--line)',paddingTop:16,marginTop:16}} key={item.factId} data-fact-id={item.factId}>
     <FactEvidence item={item}/>
     <p className={item.blocking&&!item.resolved?'warning':'success-note'}>{item.resolved?'作者已明确接受本稿例外 · 原设定保留':item.blocking?'未解决 · 阻塞接受':'无阻塞 · 仍需作者核对'}</p>
     {item.resolved&&<p>作者理由：{d.factDecisions?.find(x=>x.factId===item.factId)?.reason}</p>}
     {active&&item.blocking&&!item.resolved&&<button disabled={busy} onClick={()=>onFactDecision?.(d.id,item.factId)}>审阅并决定此项例外</button>}
    </article>)}</section>
   </div>}
   {active&&<><p className="memory-selection-summary" aria-label="候选记忆选择汇总" id={`memory-gate-${d.id}`}>已选 {selectedMemories.length} / {memories.length} 条候选记忆 · {pendingMemories.length} 条尚未决定</p>{unresolved.length>0&&<p className="warning" id={`fact-gate-${d.id}`}>还有 {unresolved.length} 项设定冲突或未知判断未解决。请编辑此稿后重新审查，或逐条明确确认例外并填写理由。</p>}<div className="draft-actions"><button onClick={()=>{setEditing(d.id);setText(d.text)}}>编辑此稿</button>{d.requiresExtraction&&<button disabled={busy} onClick={()=>onExtract?.(d.id)}>{needsExtraction?'提取候选记忆':'重新提取候选记忆'}</button>}<button disabled={busy||needsExtraction} onClick={()=>onReview(d.id)}><ShieldCheck/>审查候选稿</button><button onClick={()=>onReject(d.id)}><X/>拒绝此稿</button><button className="primary" disabled={unresolved.length>0||pendingMemories.length>0||needsExtraction||busy} aria-label="接受此版本" aria-describedby={`memory-gate-${d.id}${unresolved.length?` fact-gate-${d.id}`:''}`} onClick={()=>onAccept(d.id)}><Check/>接受此版本 · 提交 {selectedMemories.length} 条记忆</button></div></>}
  </article>;
 })}</section>;
}
