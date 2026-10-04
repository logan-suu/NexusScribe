import {proseCounts, MAX_REVISION_INSTRUCTION, getRevisionSource} from '../domain/author-revision.js';
export const countLabel = counts => `${counts.han} 汉字 · ${counts.characters} 字符 · ${counts.paragraphs} 段`;
const statuses = {requesting:'请求中', proposed:'待作者核对', failed:'请求失败 · 不自动重试', cancelled:'请求已取消', stale:'建议已过期 · 仅保留记录', discarded:'作者已放弃 · 原稿保留', adopted:'已采用为候选新版本 · 尚未接受'};
export default function RevisionPanel({draft, mode, busy, disabled, current, onInstruction, onRequest, onAdopt, onDiscard, onCancel}) {
 const active = ['DRAFT','IN_REVIEW'].includes(draft.status);
 const supported = draft.requiresExtraction && draft.providerInfo?.isLive && !draft.manualSource && draft.provider !== 'author-manuscript';
 if (!supported && !draft.revisionProposals?.length) return null;
 return <section className="revision-panel" aria-label="按作者意见改稿">
  <h3>按作者意见改稿</h3>
  <p className="fine">一条修改意见、一次明确请求、一个独立建议。不会覆盖原稿、自动提取记忆、审阅或接受。模型改稿与作者核对都不保证文学质量。</p>
  <p className="fine">计数：汉字按 Unicode Han 字符；字符按 Unicode 码点（含标点、空白与换行）；每个非空物理行算一段。当前稿：{countLabel(proseCounts(draft.text))}</p>
  {active&&<><label className="form-label">给这篇候选稿的修改意见<textarea aria-label="改稿意见" value={draft.revisionInstruction||''} maxLength={MAX_REVISION_INSTRUCTION} rows={3} disabled={busy||disabled} onChange={event=>onInstruction(draft.id,event.target.value)}/></label><button disabled={busy||disabled||mode!=='server'||!draft.revisionInstruction?.trim()} onClick={()=>onRequest(draft.id)}>按意见生成改稿建议 · 1 次模型请求</button><p className="fine">发送当前候选全文、意见与当前故事上下文到已配置的服务端模型。先检查本次进程调用预算；计数上限不是费用上限。失败不会自动重试或切换模型。{mode!=='server'?'请明确选择真实模型模式；离线模板不能执行此改稿。':''}</p></>}
  {(draft.revisionProposals||[]).slice().reverse().map(proposal=>{
   const source=getRevisionSource(draft,proposal);
   const available = active && proposal.status==='proposed' && current?.[proposal.id];
   return <article key={proposal.id} className="revision-proposal" aria-label={`改稿建议 ${proposal.id}`}>
    <h4>{proposal.id} · {proposal.status==='proposed'&&!current?.[proposal.id]?'建议已过期 · 不能采用':statuses[proposal.status]}</h4>
    {active&&proposal.status==='requesting'&&!busy&&<button disabled={disabled} onClick={()=>onCancel(draft.id,proposal.id)}>取消中断的改稿请求</button>}<p>修改意见：{proposal.binding.instruction}</p><p className="fine">来源候选 r{proposal.binding.draftRevision} · 指令 v{proposal.binding.instructionVersion}</p>
    {proposal.result&&<><div className="revision-comparison"><section><h4>改稿前 · {countLabel(proposal.beforeCounts)}</h4><pre aria-label="改稿前正文">{source.textSnapshot}</pre></section><section><h4>改稿建议 · {countLabel(proposal.afterCounts)}</h4><pre aria-label="改稿建议正文">{proposal.result.text}</pre></section></div><p className="fine">完整前后正文与模型来源保留；计数不判断情节、声音、含义或质量是否改善。</p>{active&&['proposed','stale'].includes(proposal.status)&&<div className="draft-actions"><button className="primary" disabled={!available||busy||disabled} onClick={()=>onAdopt(draft.id,proposal.id)}>核对并采用改稿建议</button><button disabled={busy||disabled} onClick={()=>onDiscard(draft.id,proposal.id)}>放弃此改稿建议</button></div>}</>}
   </article>;
  })}
 </section>;
}
