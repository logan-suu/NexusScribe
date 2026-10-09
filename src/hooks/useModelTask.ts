import {useEffect,useRef,useState} from 'react';

export type ModelTaskPhase = 'waiting' | 'complete' | 'error' | 'cancelled' | 'stale';
export interface TokenUsage {
 promptTokens?: number;
 completionTokens?: number;
 reasoningTokens?: number;
 totalTokens?: number;
}
export interface ModelTask {
 label: string;
 onCancel?: () => void;
 controller: AbortController;
 snapshot: () => unknown;
 basis: unknown;
}
export interface ModelTaskState {
 label: string;
 phase: ModelTaskPhase;
 usage: TokenUsage | null;
}
export function errorMessage(error: unknown, fallback = ''): string {
 return error instanceof Error ? error.message : typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string' ? error.message : fallback;
}
export function errorCode(error: unknown): unknown {
 return typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined;
}
function readUsage(output: unknown): TokenUsage | null {
 if(typeof output!=='object'||output===null||!('provider' in output))return null;
 const provider=output.provider;
 if(typeof provider!=='object'||provider===null||!('usage' in provider))return null;
 const usage=provider.usage;
 if(typeof usage!=='object'||usage===null)return null;
 return {
  promptTokens:'promptTokens' in usage&&typeof usage.promptTokens==='number'?usage.promptTokens:undefined,
  completionTokens:'completionTokens' in usage&&typeof usage.completionTokens==='number'?usage.completionTokens:undefined,
  reasoningTokens:'reasoningTokens' in usage&&typeof usage.reasoningTokens==='number'?usage.reasoningTokens:undefined,
  totalTokens:'totalTokens' in usage&&typeof usage.totalTokens==='number'?usage.totalTokens:undefined,
 };
}
// Each completion belongs to one request and one exact authoring snapshot.
export default function useModelTask(){
 const active=useRef<ModelTask | null>(null),[status,setStatus]=useState<ModelTaskState | null>(null);
 function begin(label: string,snapshot: () => unknown=()=>null,onCancel?: () => void): ModelTask | null {
  if(active.current)return null;
  const task={label,onCancel,controller:new AbortController(),snapshot,basis:snapshot()};active.current=task;
  setStatus({label,phase:'waiting',usage:null});return task;
 }
 function current(task: ModelTask){return active.current===task&&!task.controller.signal.aborted;}
 function verify(task: ModelTask){
  if(!current(task))return false;
  if(task.snapshot()!==task.basis){finish(task,'stale');return false;}return true;
 }
 function finish(task: ModelTask,phase: ModelTaskPhase='complete',output?: unknown){if(!current(task))return;active.current=null;setStatus({label:task.label,phase,usage:readUsage(output)});}
 function cancel(){const task=active.current;if(!task)return;active.current=null;task.controller.abort();task.onCancel?.();setStatus({label:task.label,phase:'cancelled',usage:null});}
 useEffect(()=>()=>{const task=active.current;active.current=null;task?.controller.abort()},[]);
 return {status,busy:status?.phase==='waiting',begin,verify,current,finish,cancel,isActive:()=>!!active.current};
}
export type ModelTaskController = ReturnType<typeof useModelTask>;
