import type {ProjectConfig, AuthoringInput} from '../authoring/types.js';
import type {ProviderAdapter} from '../adapters/provider.js';
import {errorMessage} from '../hooks/useModelTask.js';
interface ProjectWizardProps {
 onCreate: (config: ProjectConfig) => void | Promise<void>;
 onCancel: () => void;
 provider?: ProviderAdapter;
}
interface InterviewQuestionView {key: string; title: string; hint?: string; placeholder?: string; options?: string[]}
type StoryProposal = ProjectConfig;
type WizardInput = Record<string,string> & Required<Omit<AuthoringInput,'projectId'>>;
const contractInputKeys: Record<string, keyof AuthoringInput> = {premise:'idea',protagonist:'protagonist',emotionalDirection:'tone',pov:'pov',desire:'goal',boundaries:'boundaries'};
import {useState,useRef} from 'react';
import {ArrowLeft, ArrowRight, BookOpen, Check, Feather, Sparkles, X} from 'lucide-react';
import {mergeStoryPlan} from '../authoring/index.js';
import {createTemplateAdapter, validateActionOutput} from '../adapters/provider.js';
import '../authoring/wizard.css';
import useModelTask from '../hooks/useModelTask.js';
import ModelTaskStatus from './ModelTaskStatus.js';

const DEFAULT_PROVIDER=createTemplateAdapter();
const STEPS=['一句灵感','创作访谈','故事约定'];
const EXAMPLE='一个回乡整理遗物的人，发现已故母亲每年都会收到同一个陌生人的信。';
export default function ProjectWizard({onCreate,onCancel,provider=DEFAULT_PROVIDER}: ProjectWizardProps) {
  const [step,setStep]=useState(0);
  const [input,setInput]=useState<WizardInput>({idea:'',title:'',protagonist:'',tone:'',pov:'第三人称限知',goal:'',boundaries:''});
  const [questions,setQuestions]=useState<InterviewQuestionView[]>([]);
  const [proposal,setProposal]=useState<StoryProposal | null>(null);
  const [preview,setPreview]=useState('');
  const [error,setError]=useState('');
  const [creating,setCreating]=useState(false);
  const task=useModelTask(),busy=task.busy||creating,latest=useRef<{step: number; input: WizardInput; proposal: StoryProposal | null} | null>(null);latest.current={step,input,proposal};
  const snapshot=()=>JSON.stringify(latest.current);
  function close(){task.cancel();onCancel()}
  const update=(key: string,value: string)=>setInput(old=>({...old,[key]:value}));
  async function advance() {
    if(task.isActive()||creating)return;setError('');
    if(step===0&&!input.idea.trim()){setError('先写下一句灵感，我们再一起把它展开');return;}
    const run=task.begin(step===0?'创作访谈':'故事规划',snapshot);if(!run)return;
    try {
      if(step===0) {
        const result=validateActionOutput('interview',await provider.interview({input},{signal:run.controller.signal}));if(!task.verify(run))return;task.finish(run,'complete',result);
        setQuestions(result.questions.map(question=>({key:question.key,title:question.title,options:question.options,hint:typeof question.hint==='string'?question.hint:undefined,placeholder:typeof question.placeholder==='string'?question.placeholder:undefined})));setStep(1);
      } else {
        const result=validateActionOutput('planStory',await provider.planStory({input},{signal:run.controller.signal}));if(!task.verify(run))return;
        const config=mergeStoryPlan(input,result,provider);
        setProposal(config);setPreview('');setStep(2);task.finish(run,'complete',result);
      }
    }catch(e){if(task.current(run)){task.finish(run,'error');setError(errorMessage(e)||'生成服务暂时不可用，请手动重试');}}
  }
  function editContract(key: string,value: string) {
    const configKey=contractInputKeys[key];
    setProposal(old=>old?({...old,...(configKey?{[configKey]:value}:{}),contract:{...old.contract,[key]:value,fields:old.contract.fields.map(f=>f.key===key?{...f,value,status:'confirmed',source:'user'}:f)}}):old);
    setPreview('');
  }
  async function showPreview() {
    if(task.isActive()||creating||!proposal)return;const run=task.begin('开场试写',snapshot);if(!run)return;setError('');
    try{const draft=await provider.generateChapter({project:proposal,chapterIndex:0,chapterId:proposal.outline[0].id,context:{projectId:proposal.projectId,version:0,sources:[]}},{signal:run.controller.signal});if(!task.verify(run))return;setPreview(draft.text);task.finish(run,'complete',draft);}catch(e){if(task.current(run)){task.finish(run,'error');setError(errorMessage(e));}}
  }
  async function create() {
    if(task.isActive()||creating||!proposal)return;setCreating(true);setError('');
    try {
      const contract={...proposal.contract,status:'confirmed',fields:proposal.contract.fields.map(f=>f.status==='deferred'?f:{...f,status:'confirmed'})};
      await onCreate({...proposal,contract});
    } catch(e){setError(errorMessage(e)||'创建失败，请重试');setCreating(false);}
  }
  return <div className="ns-wizard-shell"><section className="ns-wizard" aria-labelledby="wizard-title">
    <header className="ns-wizard-top"><span className="ns-wizard-brand"><Feather size={18}/>NEXUS SCRIBE <span>/ 新故事</span></span><button className="ns-wizard-icon" onClick={close} aria-label="关闭新建故事"><X size={20}/></button></header>
    <nav aria-label="创建步骤" className="ns-wizard-progress">{STEPS.map((label,index)=><span key={label} aria-current={step===index?'step':undefined} className={step===index?'current':step>index?'completed':''}><b>{step>index?<Check size={13}/>:String(index+1).padStart(2,'0')}</b>{label}</span>)}</nav>
    <div className="ns-wizard-content">
      <div className="ns-wizard-heading"><h1 id="wizard-title">{['一个念头，就能开始','把重要的方向说清楚','在落笔前，达成约定'][step]}</h1><p>{['不需要完整的大纲。一个人、一桩怪事，或一种忘不掉的感觉，都可以。','只问影响下一步的缺口。还没决定的部分，可以留待写作时发现。','这是可修改的创作提案。你确认后，我们才把它作为故事的起点。'][step]}</p></div>
      {step===0?<div className="ns-wizard-fields"><label htmlFor="story-idea">你的故事灵感 <span>必填</span></label><textarea id="story-idea" autoFocus rows={5} maxLength={2000} value={input.idea} onChange={e=>update('idea',e.target.value)} placeholder="有一天，一个人发现……"/><div className="ns-wizard-example"><span>需要一个起点？</span><button onClick={()=>update('idea',EXAMPLE)}>试试「母亲的来信」<ArrowRight size={13}/></button></div><label htmlFor="story-title">给故事起个名字 <span>可以以后再改</span></label><input id="story-title" maxLength={80} value={input.title} onChange={e=>update('title',e.target.value)} placeholder="未命名的故事"/></div>:null}
      {step===1?<div className="ns-wizard-fields">{questions.map((q,index)=><div className="ns-wizard-question" key={q.key}><label htmlFor={`question-${q.key}`}><span className="ns-wizard-qnum">0{index+1}</span>{q.title}</label><p>{q.hint}</p>{q.options?<div className="ns-wizard-options">{q.options.map(option=><button key={option} className={input[q.key]===option?'selected':''} onClick={()=>update(q.key,option)}>{option}</button>)}</div>:null}<input id={`question-${q.key}`} maxLength={180} value={input[q.key]||''} onChange={e=>update(q.key,e.target.value)} placeholder={q.placeholder||'写下你的想法'}/></div>)}<div className="ns-wizard-pov"><label htmlFor="story-pov">叙述视角</label><select id="story-pov" value={input.pov} onChange={e=>update('pov',e.target.value)}><option>第三人称限知</option><option>第一人称</option></select></div><details><summary>补充主角愿望与创作边界（可选）</summary><label htmlFor="story-goal">主角愿望</label><input id="story-goal" maxLength={200} value={input.goal} onChange={e=>update('goal',e.target.value)} placeholder="主角现在最想做到什么？"/><label htmlFor="story-boundaries">不希望出现的内容</label><textarea id="story-boundaries" rows={2} maxLength={500} value={input.boundaries} onChange={e=>update('boundaries',e.target.value)} placeholder="例如：不靠失忆解谜；不出现血腥描写"/></details></div>:null}
      {step===2&&proposal?<div className="ns-wizard-review"><div className="ns-wizard-contract-head"><BookOpen size={21}/><div><h2>{proposal.title}</h2><p>故事约定 · 点击内容即可修改</p></div></div><div className="ns-wizard-contract">{proposal.contract.fields.map(field=><label key={field.key} className="ns-wizard-contract-field"><span>{field.label}<small className={field.status}>{field.status==='confirmed'?'你的设定':field.status==='deferred'?'待定':provider.isLive?'模型建议':'模板建议'}</small></span><textarea aria-label={field.label} value={field.value} rows={field.key==='premise'?3:2} onChange={e=>editContract(field.key,e.target.value)}/></label>)}</div><div className="ns-wizard-outline"><h2>前三章 · 可调整的路线</h2><p>{provider.isLive?'这是一份模型提案；章节标题和目标都能在这里改':'这是一份模板提案；章节标题和目标都能在这里改'}</p>{proposal.outline.map((chapter,index)=><article key={chapter.id}><span>0{index+1}</span><div><input aria-label={`第${index+1}章标题`} value={chapter.title} onChange={e=>setProposal(old=>old?({...old,outline:old.outline.map((c,i)=>i===index?{...c,title:e.target.value}:c)}):old)}/><textarea aria-label={`第${index+1}章目标`} rows={2} value={chapter.goal} onChange={e=>setProposal(old=>old?({...old,outline:old.outline.map((c,i)=>i===index?{...c,goal:e.target.value}:c)}):old)}/></div></article>)}</div><button className="ns-wizard-preview-button" disabled={busy} onClick={showPreview}><Sparkles size={16}/>{preview?'重新试写开场':'先试写一段'}<span>{provider.isLive?provider.label:'确定性模板 · 非 AI'}</span></button>{preview?<div className="ns-wizard-preview"><b>候选试写 · 不写入正式记忆</b><p>{preview}</p></div>:null}</div>:null}
      <ModelTaskStatus task={task}/>
      {error?<p className="ns-wizard-error" role="alert">{error}</p>:null}
    </div>
    <footer className="ns-wizard-footer"><button className="ns-wizard-back" onClick={()=>step===0?close():setStep(step-1)} disabled={busy}><ArrowLeft size={16}/>{step===0?'返回工作台':'上一步'}</button><span className="ns-wizard-disclosure">{provider.isLive?'服务端模型规划 · 待作者确认':'离线模板规划 · 不调用 AI'}</span>{step<2?<button className="ns-wizard-next" disabled={busy} onClick={advance}>{busy?'正在准备…':step===0?'聊聊这个故事':'查看故事约定'}<ArrowRight size={16}/></button>:<button className="ns-wizard-next" disabled={busy} onClick={create}><Check size={16}/>{busy?'正在准备…':'确认约定，开始创作'}</button>}</footer>
  </section></div>;
}
