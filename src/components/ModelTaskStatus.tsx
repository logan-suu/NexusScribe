import type {ModelTaskController, TokenUsage} from '../hooks/useModelTask.js';
const labels={waiting:'任务进行中 · 等待结果与格式校验',complete:'结果已返回 · 仍需作者审阅',error:'请求失败 · 请检查后手动重试',cancelled:'已取消等待 · 迟到结果不会采用',stale:'正文、项目或模式已变化 · 返回结果未采用'};
export default function ModelTaskStatus({task}: {task: ModelTaskController}){
 const s=task.status;if(!s)return null;
 const fields: [keyof TokenUsage, string][]=[['promptTokens','输入'],['completionTokens','输出'],['reasoningTokens','推理'],['totalTokens','总计']];
 return <section className="model-task-status" aria-label="模型任务状态" aria-live="polite"><div><strong>{s.label}</strong><span>{labels[s.phase]}</span>{task.busy&&<button onClick={task.cancel}>取消请求</button>}</div><p>{fields.map(([key,label])=>{const value=s.usage?.[key];return `${label} tokens：${typeof value==='number'&&Number.isSafeInteger(value)&&value>=0&&value<=1e9?value:'未知'}`}).join(' · ')}</p><small>仅展示服务端供应商报告的用量，不估算费用。取消不保证供应商停止处理或计费；不会自动重试。</small></section>
}
