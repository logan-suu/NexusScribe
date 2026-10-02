import {useEffect,useRef,useState} from 'react';
// Each completion belongs to one request and one exact authoring snapshot.
export default function useModelTask(){
 const active=useRef(null),[status,setStatus]=useState(null);
 function begin(label,snapshot=()=>null){
  if(active.current)return null;
  const task={label,controller:new AbortController(),snapshot,basis:snapshot()};active.current=task;
  setStatus({label,phase:'waiting',usage:null});return task;
 }
 function current(task){return active.current===task&&!task.controller.signal.aborted;}
 function verify(task){
  if(!current(task))return false;
  if(task.snapshot()!==task.basis){finish(task,'stale');return false;}return true;
 }
 function finish(task,phase='complete',output){if(!current(task))return;active.current=null;setStatus({label:task.label,phase,usage:output?.provider?.usage||null});}
 function cancel(){const task=active.current;if(!task)return;active.current=null;task.controller.abort();setStatus({label:task.label,phase:'cancelled',usage:null});}
 useEffect(()=>()=>{const task=active.current;active.current=null;task?.controller.abort()},[]);
 return {status,busy:status?.phase==='waiting',begin,verify,current,finish,cancel,isActive:()=>!!active.current};
}
