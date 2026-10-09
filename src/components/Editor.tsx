import type {Chapter} from '../domain/types.js';
interface EditorProps {
 chapter: Chapter;
 value: string;
 onChange: (text: string) => void;
 onAnalyze: () => void;
 onPreset: () => void;
 onPolish: () => void;
 onManualClassify?: (() => void) | null;
 onManualPrepare?: (() => void) | null;
 dirty: boolean;
}
import {Save, Sparkles, PenLine, FileText} from 'lucide-react';
export default function Editor({chapter,value,onChange,onAnalyze,onPreset,onPolish,onManualClassify,onManualPrepare,dirty}: EditorProps){return <section className="editor" aria-label="章节编辑器"><div className="editor-toolbar"><span><FileText/>正文 · 纯文本</span><span>{value.length} 字 <i/> revision {chapter.revision}</span></div><div className="manuscript"><h2>{chapter.title.replace(/^第.章[ ·　]*/, '')}</h2><textarea aria-label="章节正文" value={value} spellCheck={false} onChange={e=>onChange(e.target.value)}/></div><footer className="editor-actions">{onManualClassify&&<button onClick={onManualClassify}>作者分类保存 · 不调用模型</button>}{onManualPrepare&&<button onClick={onManualPrepare}>准备手写稿 · 不提取记忆</button>}<button onClick={onPreset} disabled={chapter.id!=='ch2'}><Sparkles/>插入设定修改</button><button onClick={onPolish}><PenLine/>局部润色</button><button className="primary" onClick={onAnalyze}><Save/>{dirty?'保存并分析':'分析当前正文'}</button></footer></section>}
