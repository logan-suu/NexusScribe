/** Browser adapters propose outputs. Only the domain runtime may commit state. */
import {getInterviewQuestions,createProjectConfig,createDeterministicProvider} from '../authoring/index.js';
import {segmentProse,MAX_PROSE_LENGTH} from '../domain/prose.js';
export const LEGACY_CAPABILITIES = ['interview','planStory','generateChapter','interpretRevision','reviewChapter'];
export const CAPABILITIES = [...LEGACY_CAPABILITIES,'generateProse','extractMemory','auditMemoryCandidate','reviseProse'];
export function createTemplateAdapter(){const template=createDeterministicProvider();return {
 id:'template-demo',label:'离线确定性模板',isLive:false,
 async interview({input}){return {questions:getInterviewQuestions(input),source:'template'}},
 async planStory({input}){return createProjectConfig(input)},
 generateChapter:template.generateChapter,
 async generateProse(input){const {text,chapterId,provider}=await template.generateChapter(input);return {text,chapterId,provider}},
 async reviseProse(){throw Object.assign(Error('模板模式不支持按作者指令改稿；请使用已配置的模型服务'),{code:'UNSUPPORTED_CAPABILITY'})},
 async extractMemory(){return {staging:[],reviewNotes:['模板模式不执行语义记忆提取；请由作者审阅正文'],provider:{id:template.id,label:template.label,isLive:false}}},
 async auditMemoryCandidate(){return {status:'unknown',explanation:'模板模式不执行独立语义证据审查；请由作者核对原文',provider:{id:template.id,label:template.label,isLive:false}}},
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
function validateProseRevisionInput(input){
 const validString=(value,max,empty=false)=>typeof value==='string'&&value.length<=max&&(empty||!!value.trim());
 const context=input?.context;
 if(!object(input)||Object.keys(input).length!==4||Object.keys(input).some(key=>!['text','instruction','chapterId','context'].includes(key))||!validString(input.text,MAX_PROSE_LENGTH)||!validString(input.instruction,4000)||!validString(input.chapterId,200)||!object(context)||!validString(context.projectId,200)||!Number.isInteger(context.version)||context.version<1||!Array.isArray(context.sources)||context.sources.length>100||context.sources.some(source=>!object(source)||!validString(source.chapterId,200)||!Number.isInteger(source.revision)||source.revision<1||!validString(source.text,40000,true)))throw Error('改稿需要完整原文、明确的作者指令、目标章节与有效上下文');
 const isolated={text:input.text,instruction:input.instruction,chapterId:input.chapterId,context};
 if(new TextEncoder().encode(JSON.stringify({action:'reviseProse',input:isolated})).byteLength>128*1024)throw Error('改稿请求过大；请缩小参考上下文');
 return isolated;
}
function validateMemoryAuditInput(input){
 if(!object(input)||Object.keys(input).length!==2||Object.keys(input).some(key=>!['label','sourceQuote'].includes(key))||!nonempty(input.label)||input.label.length>1000||!nonempty(input.sourceQuote)||input.sourceQuote.length>30000)throw Error('独立记忆审查只接受完整原始主张与该条精确引文');
 const isolated={label:input.label,sourceQuote:input.sourceQuote};
 if(new TextEncoder().encode(JSON.stringify({action:'auditMemoryCandidate',input:isolated})).byteLength>128*1024)throw Error('独立记忆审查请求过大');
 return isolated;
}
// Repeat memory binding validation at the browser boundary. Injected HTTP results
// must not manufacture positive checks or repair the author's candidate evidence.
function validateMemoryCandidates(input){
 if(!object(input)||!Object.hasOwn(input,'memoryCandidates'))return [];
 const candidates=input.memoryCandidates,seen=new Set();
 if(!Array.isArray(candidates)||candidates.length>30)throw Error('记忆候选格式或正文来源无效，请重试');
 for(const candidate of candidates){
  if(!object(candidate)||Object.keys(candidate).some(key=>!['candidateId','label','sourceQuote'].includes(key))||!nonempty(candidate.candidateId)||candidate.candidateId.length>200||!nonempty(candidate.label)||candidate.label.length>1000||!nonempty(candidate.sourceQuote)||candidate.sourceQuote.length>30000||typeof input.text!=='string'||!input.text.includes(candidate.sourceQuote)||seen.has(candidate.candidateId))throw Error('记忆候选格式或正文来源无效，请重试');
  seen.add(candidate.candidateId);
 }
 return candidates;
}
function validateMemoryChecks(output,input){
 const candidates=validateMemoryCandidates(input);
 if(!Object.hasOwn(output,'memoryChecks'))return;
 const checks=output.memoryChecks,seen=new Set();
 if(!Array.isArray(checks)||checks.length>30)throw Error('记忆支持审查结果格式无效，请重试');
 for(const check of checks){
  if(!object(check)||Object.keys(check).some(key=>!['candidateId','status','explanation'].includes(key))||!nonempty(check.candidateId)||check.candidateId.length>200||candidates.filter(candidate=>candidate.candidateId===check.candidateId).length!==1||seen.has(check.candidateId)||!['supported','unsupported','unknown'].includes(check.status)||!nonempty(check.explanation)||check.explanation.length>4000)throw Error('记忆支持审查结果格式或候选标识无效，请重试');
  seen.add(check.candidateId);
 }
}
export function validateActionOutput(action,output,input){
 if(!object(output))throw Error('生成服务返回了无效结果，请重试');
 if(action==='auditMemoryCandidate'){
  validateMemoryAuditInput(input);
  if(Object.keys(output).some(key=>!['status','explanation','provider'].includes(key))||!Object.hasOwn(output,'status')||!Object.hasOwn(output,'explanation')||!['supported','unsupported','unknown'].includes(output.status)||!nonempty(output.explanation)||output.explanation.length>4000||Object.hasOwn(output,'provider')&&!object(output.provider))throw Error('独立记忆审查结果格式无效，请重试');
 }
 if(action==='interview'&&(!Array.isArray(output.questions)||output.questions.length>6||output.questions.some(q=>!object(q)||!safeKey(q.key)||!nonempty(q.title)||(q.options!==undefined&&(!Array.isArray(q.options)||q.options.some(x=>typeof x!=='string'))))))throw Error('访谈结果格式无效，请重试');
 if(action==='planStory'&&(!object(output.contract)||!Array.isArray(output.contract.fields)||!output.contract.fields.length||output.contract.fields.some(f=>!object(f)||!safeKey(f.key)||!nonempty(f.label)||typeof f.value!=='string')||!Array.isArray(output.outline)||output.outline.length!==3||output.outline.some(c=>!object(c)||!nonempty(c.title)||!nonempty(c.goal))))throw Error('故事规划格式无效：需要故事约定与三章大纲');
 if(action==='generateChapter'&&!nonempty(output.text))throw Error('生成服务未返回章节正文，请重试');
 if(action==='generateProse'&&(!nonempty(output.text)||output.text.length>30000||!nonempty(output.chapterId)||(input?.project?.outline?.[input.chapterIndex]?.id!==undefined&&output.chapterId!==input.project.outline[input.chapterIndex].id)))throw Error('生成服务未返回有效完整正文，请重试；已保存的正文保持不变');
 if(action==='reviseProse'){
  validateProseRevisionInput(input);
  if(Object.keys(output).some(key=>!['text','chapterId','provider'].includes(key))||!nonempty(output.text)||output.text.length>MAX_PROSE_LENGTH||output.chapterId!==input.chapterId||Object.hasOwn(output,'provider')&&!object(output.provider))throw Error('改稿服务未返回有效完整正文，请重试；已保存的正文保持不变');
 }
 if(action==='extractMemory'){
  const paragraphs=typeof input?.text==='string'?segmentProse(input.text):null;
  if(!Array.isArray(output.staging)||output.staging.length>30||!Array.isArray(output.reviewNotes)||output.reviewNotes.length>30||output.reviewNotes.some(note=>!nonempty(note)||note.length>2000)||output.staging.some(entry=>{
   if(!object(entry)||Object.keys(entry).some(key=>!['label','sourceParagraphIndex','sourceQuote','sourceStart','sourceEnd'].includes(key))||!nonempty(entry.label)||entry.label.length>1000||!Number.isSafeInteger(entry.sourceParagraphIndex)||entry.sourceParagraphIndex<0||!nonempty(entry.sourceQuote)||entry.sourceQuote.length>30000||!Number.isSafeInteger(entry.sourceStart)||entry.sourceStart<0||!Number.isSafeInteger(entry.sourceEnd)||entry.sourceEnd<=entry.sourceStart)return true;
   const paragraph=paragraphs?.[entry.sourceParagraphIndex];
   return !paragraph||entry.sourceQuote!==paragraph.text||entry.sourceStart!==paragraph.start||entry.sourceEnd!==paragraph.end;
  }))throw Error('记忆提取结果格式或正文定位无效；已保存的正文保持不变');
 }
 if(action==='interpretRevision'&&((!Array.isArray(output.operations)&&!Array.isArray(output.suggestedFacts))||!Array.isArray(output.questions)))throw Error('修改解释结果格式无效，请重试');
 if(action==='reviewChapter'){
  if(!Array.isArray(output.issues))throw Error('章节审查结果格式无效，请重试');
  validateMemoryChecks(output,input);
 }
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
 const provider={...identity,async getStatus({signal}={}){const status=await request('/status',undefined,{signal});if(typeof status?.configured!=='boolean')throw Error('生成服务状态格式无效');return status;}};
 for(const action of CAPABILITIES)provider[action]=async (input,{signal}={})=>{
  if(action==='reviewChapter'&&!signal?.aborted)validateMemoryCandidates(input);
  if(action==='auditMemoryCandidate'&&!signal?.aborted)input=validateMemoryAuditInput(input);
  if(action==='reviseProse'&&!signal?.aborted)input=validateProseRevisionInput(input);
  const payload=await request('/agent',{action,input},{signal});
  const output=validateActionOutput(action,payload?.output,input);
  if(action==='generateChapter')return {...output,provider:{...identity,...(object(payload.provider)?payload.provider:{}),...(object(output.provider)?output.provider:{}),isLive:true},...(payload.model?{model:payload.model}:{}),status:'candidate',baseVersion:input?.context?.stateVersion??input?.context?.version??null,staging:Array.isArray(output.staging)?output.staging:[]};
  if(action==='generateProse'||action==='extractMemory'||action==='auditMemoryCandidate'||action==='reviseProse')return {...output,provider:{...identity,...(object(payload.provider)?payload.provider:{}),...(object(output.provider)?output.provider:{}),isLive:true}};
  return output;
 };
 return validateProvider(provider);
}
