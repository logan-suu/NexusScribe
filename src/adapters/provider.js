/** Browser adapters propose outputs. Only the domain runtime may commit state. */
import {getInterviewQuestions,createProjectConfig,createDeterministicProvider} from '../authoring/index.js';
import {segmentProse} from '../domain/prose.js';
export const LEGACY_CAPABILITIES = ['interview','planStory','generateChapter','interpretRevision','reviewChapter'];
export const CAPABILITIES = [...LEGACY_CAPABILITIES,'generateProse','extractMemory'];
export function createTemplateAdapter(){const template=createDeterministicProvider();return {
 id:'template-demo',label:'离线确定性模板',isLive:false,
 async interview({input}){return {questions:getInterviewQuestions(input),source:'template'}},
 async planStory({input}){return createProjectConfig(input)},
 generateChapter:template.generateChapter,
 async generateProse(input){const {text,chapterId,provider}=await template.generateChapter(input);return {text,chapterId,provider}},
 async extractMemory(){return {staging:[],reviewNotes:['模板模式不执行语义记忆提取；请由作者审阅正文'],provider:{id:template.id,label:template.label,isLive:false}}},
 async interpretRevision(){return {status:'needs_author_confirmation',operations:[],questions:['请由作者明确区分局部表达与长期设定']}},
 async reviewChapter(){return {semanticStatus:'not_evaluated',issues:[],limitations:['模板模式不执行通用语义审查；请由作者审阅']}}
}}
// Existing injected providers remain valid for the legacy workflow. New capabilities
// are explicit and are never synthesized by wrapping a live legacy generation call.
export function validateProvider(provider){for(const name of CAPABILITIES)if((LEGACY_CAPABILITIES.includes(name)||Object.hasOwn(provider??{},name))&&typeof provider?.[name]!=='function')throw Error(`供应商缺少 ${name} 能力`);return provider}
export function createInjectedProvider(implementation){return validateProvider(implementation)}
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const nonempty=value=>typeof value==='string'&&value.trim().length>0;
const safeKey=key=>typeof key==='string'&&/^[A-Za-z][A-Za-z0-9_]*$/.test(key)&&!['__proto__','prototype','constructor'].includes(key);
export function validateActionOutput(action,output,input){
 if(!object(output))throw Error('生成服务返回了无效结果，请重试');
 if(action==='interview'&&(!Array.isArray(output.questions)||output.questions.length>6||output.questions.some(q=>!object(q)||!safeKey(q.key)||!nonempty(q.title)||(q.options!==undefined&&(!Array.isArray(q.options)||q.options.some(x=>typeof x!=='string'))))))throw Error('访谈结果格式无效，请重试');
 if(action==='planStory'&&(!object(output.contract)||!Array.isArray(output.contract.fields)||!output.contract.fields.length||output.contract.fields.some(f=>!object(f)||!safeKey(f.key)||!nonempty(f.label)||typeof f.value!=='string')||!Array.isArray(output.outline)||output.outline.length!==3||output.outline.some(c=>!object(c)||!nonempty(c.title)||!nonempty(c.goal))))throw Error('故事规划格式无效：需要故事约定与三章大纲');
 if(action==='generateChapter'&&!nonempty(output.text))throw Error('生成服务未返回章节正文，请重试');
 if(action==='generateProse'&&(!nonempty(output.text)||output.text.length>30000||!nonempty(output.chapterId)||(input?.project?.outline?.[input.chapterIndex]?.id!==undefined&&output.chapterId!==input.project.outline[input.chapterIndex].id)))throw Error('生成服务未返回有效完整正文，请重试；已保存的正文保持不变');
 if(action==='extractMemory'){
  const paragraphs=typeof input?.text==='string'?segmentProse(input.text):null;
  if(!Array.isArray(output.staging)||output.staging.length>30||!Array.isArray(output.reviewNotes)||output.reviewNotes.length>30||output.reviewNotes.some(note=>!nonempty(note)||note.length>2000)||output.staging.some(entry=>{
   if(!object(entry)||Object.keys(entry).some(key=>!['label','sourceParagraphIndex','sourceQuote','sourceStart','sourceEnd'].includes(key))||!nonempty(entry.label)||entry.label.length>1000||!Number.isSafeInteger(entry.sourceParagraphIndex)||entry.sourceParagraphIndex<0||!nonempty(entry.sourceQuote)||entry.sourceQuote.length>30000||!Number.isSafeInteger(entry.sourceStart)||entry.sourceStart<0||!Number.isSafeInteger(entry.sourceEnd)||entry.sourceEnd<=entry.sourceStart)return true;
   const paragraph=paragraphs?.[entry.sourceParagraphIndex];
   return !paragraph||entry.sourceQuote!==paragraph.text||entry.sourceStart!==paragraph.start||entry.sourceEnd!==paragraph.end;
  }))throw Error('记忆提取结果格式或正文定位无效；已保存的正文保持不变');
 }
 if(action==='interpretRevision'&&((!Array.isArray(output.operations)&&!Array.isArray(output.suggestedFacts))||!Array.isArray(output.questions)))throw Error('修改解释结果格式无效，请重试');
 if(action==='reviewChapter'&&!Array.isArray(output.issues))throw Error('章节审查结果格式无效，请重试');
 return output;
}
export function createServerProvider({fetchImpl=(...args)=>globalThis.fetch(...args),baseUrl='/api',timeoutMs=120000}={}){
 // A relative same-origin endpoint keeps provider credentials exclusively on the server.
 if(!/^\/(?!\/)/.test(baseUrl))throw Error('生成服务必须使用同源相对路径');
 const endpoint=baseUrl.replace(/\/$/,'');
 const identity={id:'server-model',label:'服务端模型',isLive:true};
 async function request(path,body,{signal}={}){
  const controller=new AbortController();let timer,abortError,rejectAbort;
  const interrupted=new Promise((_,reject)=>{rejectAbort=reject;});
  const abort=timeout=>{if(abortError)return;abortError=Object.assign(new Error(timeout?'生成服务响应超时，请重试；已保存的正文保持不变':'生成请求已取消；已保存的正文保持不变'),{name:timeout?'TimeoutError':'AbortError',code:timeout?'UPSTREAM_TIMEOUT':'REQUEST_CANCELLED'});rejectAbort(abortError);controller.abort();};
  const onAbort=()=>abort(false);
  signal?.addEventListener('abort',onAbort,{once:true});
  if(signal?.aborted)onAbort();
  timer=setTimeout(()=>abort(true),timeoutMs);
  try {
   const operation=async()=>{
    if(abortError)throw abortError;
    const response=await fetchImpl(`${endpoint}${path}`,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},...(body?{body:JSON.stringify(body)}:{}),signal:controller.signal});
    if(abortError)throw abortError;
    let payload;try{payload=await response.json();}catch{throw Error(`生成服务返回无法读取的响应（HTTP ${response.status}）`);}
    if(abortError)throw abortError;
    if(!response.ok||payload?.error){const detail=typeof payload?.error==='string'?payload.error:payload?.error?.message||payload?.message;const error=Error(detail||`生成服务请求失败（HTTP ${response.status}）`);if(payload?.error?.code==='REQUEST_CANCELLED')Object.assign(error,{name:'AbortError',code:'REQUEST_CANCELLED'});if(payload?.error?.code==='UPSTREAM_TIMEOUT')Object.assign(error,{name:'TimeoutError',code:'UPSTREAM_TIMEOUT'});throw error;}
    return payload;
   };
   return await Promise.race([operation(),interrupted]);
  }catch(error){if(abortError)throw abortError;throw error;}finally{clearTimeout(timer);signal?.removeEventListener('abort',onAbort);}
 }
 const provider={...identity,async getStatus(){const status=await request('/status');if(typeof status?.configured!=='boolean')throw Error('生成服务状态格式无效');return status;}};
 for(const action of CAPABILITIES)provider[action]=async (input,{signal}={})=>{
  const payload=await request('/agent',{action,input},{signal});
  const output=validateActionOutput(action,payload?.output,input);
  if(action==='generateChapter')return {...output,provider:{...identity,...(object(payload.provider)?payload.provider:{}),...(object(output.provider)?output.provider:{}),isLive:true},...(payload.model?{model:payload.model}:{}),status:'candidate',baseVersion:input?.context?.stateVersion??input?.context?.version??null,staging:Array.isArray(output.staging)?output.staging:[]};
  if(action==='generateProse'||action==='extractMemory')return {...output,provider:{...identity,...(object(payload.provider)?payload.provider:{}),...(object(output.provider)?output.provider:{}),isLive:true}};
  return output;
 };
 return validateProvider(provider);
}
