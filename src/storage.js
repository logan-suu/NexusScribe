import {createInitialState} from './domain/engine.js';
const KEY='nexusscribe.demo.v1';
export function loadWorkspace(){
 const raw=localStorage.getItem(KEY);
 if(!raw)return {format:1,serial:0,state:createInitialState(),editing:{},patch:null};
 const data=JSON.parse(raw);
 if(data.format!==1||!data.state?.chapters||!Number.isInteger(data.serial))throw Error('保存数据格式不兼容，请先导出浏览器数据后再处理');
 return data;
}
export function persistWorkspace(data,expected){
 const current=localStorage.getItem(KEY);const serial=current?JSON.parse(current).serial:0;
 if(serial!==expected)throw Error('另一窗口已更新项目。请刷新页面加载新版本，当前操作未覆盖新数据');
 const next={...data,format:1,serial:expected+1};
 localStorage.setItem(KEY,JSON.stringify(next));return next;
}
export function download(name,data,type='application/json'){
 const blob=new Blob([typeof data==='string'?data:JSON.stringify(data,null,2)],{type});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
export {KEY};
