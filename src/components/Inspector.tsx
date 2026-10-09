import type {ReactNode} from 'react';
import type {State, SourceAnchor, MemoryDecision} from '../domain/types.js';
import type {getImpacts} from '../domain/engine.js';
export type EvidenceRecord = (State['facts'][number] | State['evidence'][number] | State['knowledge'][number] | State['events'][number] | State['disclosures'][number]) & {label?: string; proposition?: string; quote?: string; status?: string; active?: boolean; memoryDecision?: MemoryDecision; draftId?: string; source?: SourceAnchor; originalLabel?: string};
interface InspectorProps {
 state: State;
 plans: ReturnType<typeof getImpacts>;
 onEvidence: (record: EvidenceRecord) => void;
 children?: ReactNode;
}
import {BookOpen, ExternalLink, Phone, StickyNote} from 'lucide-react';
export default function Inspector({state,plans,onEvidence,children}: InspectorProps){const activeFacts=state.facts.filter(f=>!['superseded','retracted'].includes(f.status));return <aside className="inspector"><h2><BookOpen/>故事记忆 <span>v{state.version}</span></h2><div className="inspector-tabs">核心设定<span>来源可追溯</span></div><section><h3>世界事实</h3>{activeFacts.length===0&&<p className="custom-empty">尚未确认全局设定</p>}{activeFacts.map(f=><button key={f.id} className="fact-row" onClick={()=>onEvidence(f)}>{f.label||f.statement||f.description||f.text||f.value||f.id}<ExternalLink/></button>)}</section><section><h3>角色认知</h3>{state.knowledge.length?state.knowledge.filter(k=>k.id!=='lin-address').map(k=><p className="memory-value" key={k.id}>{k.label}</p>):<p className="custom-empty">暂无已确认角色认知</p>}<p className="fine">作者修改世界真相，不会自动让角色知情</p></section><section><h3>支持证据</h3><div className="support"><p>{state.mode==='custom'?'来自已确认正文的证据':'林夏知道交易地点'}</p>{state.evidence.filter(e=>e.active!==false&&!['invalid','retracted','deleted'].includes(e.status??'')).map(e=><button key={e.id} onClick={()=>onEvidence(e)}>{e.id.includes('phone')?<Phone/>:<StickyNote/>}<span>{e.label||e.title||e.description||e.id}</span><ExternalLink/></button>)}</div></section><section><h3>后续计划</h3><ol className="plan-list">{plans.map(p=><li key={p.id}><b className={p.status==='invalid'?'invalid':''}/><div>{p.title||p.label||p.id}<small>{p.reason||p.description}</small></div></li>)}</ol></section>{children}</aside>}
