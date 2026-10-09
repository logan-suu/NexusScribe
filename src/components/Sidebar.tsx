import type {LucideIcon} from 'lucide-react';
import type {State} from '../domain/types.js';
export type WorkspaceTab = 'write' | 'memory' | 'history';
interface SidebarProps {
 state: State;
 mode?: 'template' | 'server';
 tab: WorkspaceTab;
 setTab: (tab: WorkspaceTab) => void;
 selected?: string;
 onSelect: (id: string) => void;
 onExport: () => void;
 projects?: {state: State}[];
 onSwitch: (id: string) => void;
}
import {Feather, BookOpen, History, FileText, Download} from 'lucide-react';
export default function Sidebar({state,mode='template',tab,setTab,selected,onSelect,onExport,projects=[],onSwitch}: SidebarProps){return <aside className="sidebar">
 <div className="brand">NexusScribe<span>写作，从此有迹可循</span></div>
 <div className="project-label">项目</div><h2 className="project-title">{state.title}<span>中文悬疑 · 单作者</span></h2>
 {projects.length>0&&<select className="project-switch" aria-label="切换项目" value={state.projectId} onChange={e=>onSwitch(e.target.value)}><option value={state.projectId}>{state.title}</option>{projects.map(p=><option key={p.state.projectId} value={p.state.projectId}>{p.state.title}</option>)}</select>}<nav aria-label="主导航">{([['write',Feather,'写作工作台'],['memory',BookOpen,'故事记忆'],['history',History,'版本记录']] satisfies [WorkspaceTab, LucideIcon, string][]).map(([id,Icon,label])=><button key={id} className={tab===id?'nav active':'nav'} onClick={()=>setTab(id)}><Icon/>{label}</button>)}</nav>
 <div className="chapter-label">章节 <span>03</span></div><nav aria-label="章节">{state.chapters.map((c,i)=><button key={c.id} onClick={()=>onSelect(c.id)} className={selected===c.id&&tab==='write'?'chapter active':'chapter'}><FileText/><span><small>第{['一','二','三'][i]}章</small>{c.title.replace(/^第.章[ ·　]*/, '')}</span>{c.syncStatus!=='CLEAN'&&<i className="dot"/>}</button>)}</nav>
 <div className="side-bottom"><button className="text-button" onClick={onExport}><Download/>导出项目备份</button><p>{mode==='server'?'服务端模型 · 作者审阅':state.mode==='custom'?'自建项目 · 模板模式':'预置故事 · 确定性演示'}<br/>{mode==='server'?'本地保存 · 已启用外部模型':'本地浏览器保存，无模型调用'}</p></div>
 </aside>}
