/** Browser adapters propose outputs. Only the domain runtime may commit state. */
import {getInterviewQuestions,createProjectConfig,createDeterministicProvider} from '../authoring/index.js';
export const CAPABILITIES = ['interview','planStory','generateChapter','interpretRevision','reviewChapter'];
export function createTemplateAdapter(){return {
 id:'template-demo',label:'离线确定性模板',isLive:false,
 async interview({input}){return {questions:getInterviewQuestions(input),source:'template'}},
 async planStory({input}){return createProjectConfig(input)},
 generateChapter:createDeterministicProvider().generateChapter,
 async interpretRevision(){return {status:'needs_author_confirmation',operations:[],questions:['请由作者明确区分局部表达与长期设定']}},
 async reviewChapter(){return {semanticStatus:'not_evaluated',issues:[],limitations:['模板模式不执行通用语义审查；请由作者审阅']}}
}}
export function validateProvider(provider){for(const name of CAPABILITIES)if(typeof provider?.[name]!=='function')throw Error(`供应商缺少 ${name} 能力`);return provider}
export function createInjectedProvider(implementation){return validateProvider(implementation)}
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const nonempty=value=>typeof value==='string'&&value.trim().length>0;
const safeKey=key=>typeof key==='string'&&/^[A-Za-z][A-Za-z0-9_]*$/.test(key)&&!['__proto__','prototype','constructor'].includes(key);
export function validateActionOutput(action,output){
 if(!object(output))throw Error('生成服务返回了无效结果，请重试');
 if(action==='interview'&&(!Array.isArray(output.questions)||output.questions.length>6||output.questions.some(q=>!object(q)||!safeKey(q.key)||!nonempty(q.title)||(q.options!==undefined&&(!Array.isArray(q.options)||q.options.some(x=>typeof x!=='string'))))))throw Error('访谈结果格式无效，请重试');
 if(action==='planStory'&&(!object(output.contract)||!Array.isArray(output.contract.fields)||!output.contract.fields.length||output.contract.fields.some(f=>!object(f)||!safeKey(f.key)||!nonempty(f.label)||typeof f.value!=='string')||!Array.isArray(output.outline)||output.outline.length!==3||output.outline.some(c=>!object(c)||!nonempty(c.title)||!nonempty(c.goal))))throw Error('故事规划格式无效：需要故事约定与三章大纲');
 if(action==='generateChapter'&&!nonempty(output.text))throw Error('生成服务未返回章节正文，请重试');
 if(action==='interpretRevision'&&((!Array.isArray(output.operations)&&!Array.isArray(output.suggestedFacts))||!Array.isArray(output.questions)))throw Error('修改解释结果格式无效，请重试');
 if(action==='reviewChapter'&&!Array.isArray(output.issues))throw Error('章节审查结果格式无效，请重试');
 return output;
}
export function createServerProvider({fetchImpl=(...args)=>globalThis.fetch(...args),baseUrl='/api',timeoutMs=120000}={}){
 // A relative same-origin endpoint keeps provider credentials exclusively on the server.
 if(!/^\/(?!\/)/.test(baseUrl))throw Error('生成服务必须使用同源相对路径');
 const endpoint=baseUrl.replace(/\/$/,'');
 const identity={id:'server-model',label:'服务端模型',isLive:true};
 async function request(path,body){
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try {
   const response=await fetchImpl(`${endpoint}${path}`,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},...(body?{body:JSON.stringify(body)}:{}),signal:controller.signal});
   let payload;try{payload=await response.json();}catch{throw Error(`生成服务返回无法读取的响应（HTTP ${response.status}）`);}
   if(!response.ok||payload?.error){const detail=typeof payload?.error==='string'?payload.error:payload?.error?.message||payload?.message;throw Error(detail||`生成服务请求失败（HTTP ${response.status}）`);}
   return payload;
  }catch(error){if(error?.name==='AbortError')throw Error('生成服务响应超时，请重试；没有生成或接受任何章节');throw error;}finally{clearTimeout(timer);}
 }
 const provider={...identity,async getStatus(){const status=await request('/status');if(typeof status?.configured!=='boolean')throw Error('生成服务状态格式无效');return status;}};
 for(const action of CAPABILITIES)provider[action]=async input=>{
  const payload=await request('/agent',{action,input});
  const output=validateActionOutput(action,payload?.output);
  if(action==='generateChapter')return {...output,provider:{...identity,...(object(payload.provider)?payload.provider:{}),...(object(output.provider)?output.provider:{}),isLive:true},...(payload.model?{model:payload.model}:{}),status:'candidate',baseVersion:input?.context?.stateVersion??input?.context?.version??null,staging:Array.isArray(output.staging)?output.staging:[]};
  return output;
 };
 return validateProvider(provider);
}
