import {useState} from 'react';
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
export default function DraftPanel({drafts,onReview,onAccept,onReject,onEdit,factReviews={},onFactDecision,onExtract,extractionReady={},busy=false}) {
 const [editing,setEditing]=useState(null),[text,setText]=useState('');
 return <section className="draft-section"><header><h2>下一场景 · 候选稿</h2><span>候选先隔离 · 接受才提交</span></header>
 {drafts.length===0?<p className="empty-note">生成后先审阅，再决定是否接受。候选事件不会进入故事记忆。</p>:drafts.slice().reverse().map(d=>{
  const ledger=factReviews[d.id]||[],unresolved=ledger.filter(item=>item.blocking&&!item.resolved),active=!['ACCEPTED','REJECTED'].includes(d.status),needsExtraction=d.requiresExtraction&&active&&!extractionReady[d.id];
  return <article className="draft" key={d.id}>
   <div className="draft-meta"><span><FileText/>{d.id}</span><span>基于 v{d.baseVersion} · 候选 r{d.revision} · {d.requiresSemanticReview?'真实模型':'确定性模板'} · {d.status}</span></div>
   <div className="draft-prose">{d.text}</div>
   {editing===d.id&&<><textarea className="draft-edit" aria-label="编辑候选稿" value={text} onChange={e=>setText(e.target.value)}/><button onClick={()=>{onEdit(d.id,text);setEditing(null)}}>保存候选稿修改</button></>}
   <div className="staging"><b>候选记忆暂存区</b><span>本稿事件仅在作者接受后成为已确认状态</span></div>
   {d.requiresExtraction&&<div className="extraction-status" aria-label="候选记忆提取状态"><p className={needsExtraction?'warning':'success-note'}>{needsExtraction?(d.extraction?.status==='failed'?'提取未完成 · 已保存的正文保留':'正文已保存 · 需要提取当前版本的候选记忆'):'当前正文的候选记忆已提取 · 尚需核对与审阅'}</p><p className="fine">正文、提取、审阅分别调用模型。失败不会自动重试；版本、段落位置与原文引用由程序生成。空结果不证明没有遗漏。</p></div>}
   {d.staging?.map(event=><article className="staged-event" key={event.id}><strong>{event.label}</strong><p className="fine">候选 r{d.revision}{Number.isInteger(event.sourceParagraphIndex)?` · 段落 ${event.sourceParagraphIndex+1}`:''}{Number.isInteger(event.sourceStart)?` · 字符位置 ${event.sourceStart}–${event.sourceEnd}`:''}</p><blockquote>{event.sourceQuote}</blockquote></article>)}
   {d.extraction?.reviewNotes?.map((note,i)=><p className="fine" key={i}>{note}</p>)}
   {d.review&&<p className={d.review.valid||d.review.passed?'success-note':'warning'}><ShieldCheck/>{d.review.passed?(d.modelReview?'结构检查通过 · 模型语义建议见下方':d.review.semanticStatus==='not_evaluated'?'结构检查通过 · 语义一致性未评估':'当前版本检查通过'):'审查未通过'} {JSON.stringify(d.review.errors||d.review.issues||[])!=='[]'?(d.review.errors||d.review.issues||[]).map(e=>e.explanation||e.message||e).join('；'):''}</p>}
   {d.modelReview&&<div className="model-review"><h4>模型语义审阅 · 非独立正确性证明</h4><p>{d.modelReview.summary}</p><p className="model-limit">模型判断可能遗漏或误判；逐条核对原文。确认例外只解除本稿的该项阻塞，保留原设定，不会修改故事记忆。</p>{d.modelReview.issues?.map((issue,i)=><p className={issue.severity==='error'?'warning':''} key={i}>{issue.explanation}<br/>依据：{issue.sourceQuote}</p>)}
    <section aria-label="已确认设定逐条审阅"><h4>已确认设定 · 逐条核对</h4>{ledger.length===0?<p>没有需逐条审阅的作者确认设定</p>:ledger.map(item=><article className="fact-review-item" style={{borderTop:'1px solid var(--line)',paddingTop:16,marginTop:16}} key={item.factId} data-fact-id={item.factId}>
     <FactEvidence item={item}/>
     <p className={item.blocking&&!item.resolved?'warning':'success-note'}>{item.resolved?'作者已明确接受本稿例外 · 原设定保留':item.blocking?'未解决 · 阻塞接受':'无阻塞 · 仍需作者核对'}</p>
     {item.resolved&&<p>作者理由：{d.factDecisions?.find(x=>x.factId===item.factId)?.reason}</p>}
     {active&&item.blocking&&!item.resolved&&<button onClick={()=>onFactDecision?.(d.id,item.factId)}>审阅并决定此项例外</button>}
    </article>)}</section>
   </div>}
   {active&&<>{unresolved.length>0&&<p className="warning" id={`fact-gate-${d.id}`}>还有 {unresolved.length} 项设定冲突或未知判断未解决。请编辑此稿后重新审查，或逐条明确确认例外并填写理由。</p>}<div className="draft-actions"><button onClick={()=>{setEditing(d.id);setText(d.text)}}>编辑此稿</button>{d.requiresExtraction&&<button disabled={busy} onClick={()=>onExtract?.(d.id)}>{needsExtraction?'提取候选记忆':'重新提取候选记忆'}</button>}<button disabled={busy||needsExtraction} onClick={()=>onReview(d.id)}><ShieldCheck/>审查候选稿</button><button onClick={()=>onReject(d.id)}><X/>拒绝此稿</button><button className="primary" disabled={unresolved.length>0||needsExtraction||busy} aria-describedby={unresolved.length?`fact-gate-${d.id}`:undefined} onClick={()=>onAccept(d.id)}><Check/>接受此版本</button></div></>}
  </article>;
 })}</section>;
}
