import {useEffect, useState} from 'react';
import {BRIEF_FIELDS, composeRevisionBrief, appendRevisionBrief, emptyRevisionBrief} from '../domain/revision-brief.js';
import {MAX_REVISION_INSTRUCTION} from '../domain/author-revision.js';

/** Keep a local editable brief and require explicit, one-use consent for duplicate appends. */
export default function RevisionBriefBuilder({instruction, disabled, onAppend}: {instruction: string; disabled: boolean; onAppend: (value: string) => void}) {
 const [fields,setFields] = useState(emptyRevisionBrief);
 const [preview,setPreview] = useState<string|null>(null);
 const [previewBase,setPreviewBase] = useState('');
 const [replacePreview,setReplacePreview] = useState(false);
 const [duplicateApproval,setDuplicateApproval] = useState<string|null>(null);
 useEffect(()=>setDuplicateApproval(null),[instruction]);
 const duplicateKey = JSON.stringify([instruction,preview]);
 const allowDuplicate = duplicateApproval===duplicateKey;
 const hasDuplicate = Boolean(preview?.trim() && instruction.includes(preview.trim()));
 const composed = composeRevisionBrief(fields);
 let next = '', error = '';
 if (preview?.trim()) {
  try {next = appendRevisionBrief(instruction,preview,{allowDuplicate});} catch (e) {error = (e as Error).message;}
 }
 return <details className="revision-brief" aria-label="整理改稿意见（可选）">
  <summary>整理改稿意见（可选，不调用模型）</summary>
  <p className="fine">只填需要的项目，空项会省略。请对照上方已保存的章节目标与全文，区分必须实现的结果和故意保留的悬念。程序不会判断目标是否达成。</p>
  <p className="fine">此处是临时草拟区；切换章节、刷新或候选正文／目标变化会清空。追加到下方改稿意见后才随项目保存，原有意见不会被覆盖。</p>
  {BRIEF_FIELDS.map(([key,label,placeholder]) => <label className="form-label" key={key}>{label}<textarea aria-label={label} placeholder={placeholder} rows={2} maxLength={1000} value={fields[key]} disabled={disabled} onChange={e=>{setFields({...fields,[key]:e.target.value});setReplacePreview(false);}}/></label>)}
  {preview!==null&&composed!==previewBase&&<p className="warning">草拟字段已变化，现有预览仍保留；请自行修改预览，或明确重新生成。</p>}
  {preview!==null&&preview!==previewBase&&<label><input type="checkbox" checked={replacePreview} disabled={disabled} onChange={e=>setReplacePreview(e.target.checked)}/>我同意重新生成时替换已编辑的预览（下方已保存意见不变）</label>}
  <button disabled={disabled||!composed||composed.length>MAX_REVISION_INSTRUCTION||(preview!==null&&preview!==previewBase&&!replacePreview)} onClick={()=>{setPreview(composed);setPreviewBase(composed);setReplacePreview(false);setDuplicateApproval(null);}}>{preview===null?'生成意见预览 · 不发送':'重新生成预览 · 替换预览内容'}</button>
  {composed.length>MAX_REVISION_INSTRUCTION&&<p className="warning">意见预览超过 4000 字符，请精简；不会截断。</p>}
  {preview!==null&&<><label className="form-label">可编辑的意见预览<textarea aria-label="可编辑的意见预览" rows={5} maxLength={MAX_REVISION_INSTRUCTION} value={preview} disabled={disabled} onChange={e=>{setPreview(e.target.value);setReplacePreview(false);setDuplicateApproval(null);}}/></label><p className="fine">可删除任何不适用的要求。追加仅保存意见，不会发送请求、修改正文或接受稿件。</p>{error&&<p className="warning" role="status">{error}</p>}{hasDuplicate&&<label><input type="checkbox" checked={allowDuplicate} disabled={disabled} onChange={e=>setDuplicateApproval(e.target.checked?duplicateKey:null)}/>我已核对，仍要追加这段预览（本次有效）</label>}<button disabled={disabled||!next} onClick={()=>{setDuplicateApproval(null);onAppend(next);}}>追加到改稿意见 · 保留原有内容</button></>}
 </details>;
}
