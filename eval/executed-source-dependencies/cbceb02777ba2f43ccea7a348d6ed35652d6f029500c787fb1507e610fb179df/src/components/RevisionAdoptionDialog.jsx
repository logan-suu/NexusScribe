import {useState} from 'react';
import {DecisionDialog} from './DraftPanel.jsx';
import {countLabel} from './RevisionPanel.jsx';
import {proseCounts, parseRevisionLengthBounds, revisionLengthWarnings} from '../domain/author-revision.js';
import {MAX_PROSE_LENGTH} from '../domain/prose.js';
import {download} from '../storage.js';
const fields = [['hanMin','汉字下限'],['hanMax','汉字上限'],['paragraphsMin','段数下限'],['paragraphsMax','段数上限']];
export default function RevisionAdoptionDialog({choice, busy, saveError, onRetrySave, onClose, onConfirm}) {
 const {proposal, proposalId} = choice;
 const [text,setText] = useState(proposal.result.text), [limits,setLimits] = useState({});
 let lengthBounds = {}, boundsError = '';
 try {lengthBounds = parseRevisionLengthBounds(limits)} catch (error) {boundsError = error.message}
 const counts = proseCounts(text), warnings = boundsError ? [] : revisionLengthWarnings(text,lengthBounds);
 const edited = text !== proposal.result.text;
 return <DecisionDialog label="确认采用改稿建议" title="编辑并采用为候选新版本" onClose={onClose}>
  <p>来源候选 r{proposal.binding.draftRevision} · {proposalId}</p>
  <p>作者意见：{proposal.binding.instruction}</p>
  <p>改稿前：{countLabel(proposal.beforeCounts)}<br/>模型原始建议：{countLabel(proposal.afterCounts)}</p>
  <details className="revision-original"><summary tabIndex={0}>查看不可改写的模型原始建议</summary><pre aria-label="采用窗口模型原文">{proposal.result.text}</pre></details>
  <label className="form-label">待采用正文<textarea aria-label="待采用正文" value={text} maxLength={MAX_PROSE_LENGTH} rows={9} disabled={busy} onChange={event=>setText(event.target.value)}/></label>
  <p aria-label="待采用正文计数">待采用：{countLabel(counts)}</p>
  <p className="fine">{edited?'作者已编辑；最终正文将记录为 explicit_author_edit，不会归为模型原始输出。':'当前与模型原始建议相同；采用仍是作者的明确选择。'} 模型原文、来源与原始计数保持不变。</p>
  <fieldset className="revision-length-bounds"><legend>作者篇幅范围（可选，仅本地提醒）</legend>{fields.map(([key,label])=><label className="form-label" key={key}>{label}<input type="text" inputMode="numeric" pattern="[0-9]*" aria-label={label} value={limits[key]??''} disabled={busy} onChange={event=>setLimits(previous=>({...previous,[key]:event.target.value}))}/></label>)}</fieldset>
  <p className="fine">留空表示不设限制。汉字按 Unicode Han 字符，段数按非空物理行。不会从修改意见推断范围，不会自动改写或调用模型。范围与实际计数随采用记录保留。</p>
  {boundsError&&<p className="warning" role="alert">{boundsError}</p>}
  {warnings.length>0&&<div className="warning" aria-label="篇幅提醒"><ul>{warnings.map(warning=><li key={warning}>{warning}</li>)}</ul><p>仅提醒，仍可采用；数值达标也不证明情节、含义或文学质量正确。</p></div>}
  <p className="warning">采用会保留原稿和此次建议，并使旧提取、整章审阅、设定例外与记忆选择全部失效。之后须重新明确提取、审阅与选择，才能接受。此次采用本身不调用模型，不自动接受章节；作者编辑也不代表语义正确或文学质量通过。</p>
  <p className="fine">本窗口编辑与范围在最终确认前尚未保存。返回比较、关闭、Escape 或刷新会放弃这些本地编辑；可先导出待采用正文。模型建议始终保留。</p>
  {saveError&&<div className="warning" role="alert"><p>此次采用尚未安全保存，编辑仍留在本窗口。请先导出待采用正文，再尝试恢复工作区保存；恢复不会自动采用或调用模型。</p><button onClick={onRetrySave}>重试保存当前工作区</button></div>}
  <div className="draft-actions"><button data-autofocus onClick={onClose}>返回比较</button><button onClick={()=>download('NexusScribe-待采用正文.txt',text,'text/plain')}>导出待采用正文</button><button className="primary" disabled={busy||!!saveError||!!boundsError||!text.trim()||text.length>MAX_PROSE_LENGTH} onClick={()=>onConfirm({text,lengthBounds})}>确认采用并使旧审阅失效</button></div>
 </DecisionDialog>;
}
