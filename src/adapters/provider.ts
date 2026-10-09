import type {Action, ActionOutputMap, ProviderAdapter, RequestOptions, ServerProvider, ProviderStatus} from './types.js';
export type {ProviderAdapter, ProviderStatus} from './types.js';
/** Browser adapters propose outputs. Only the domain runtime may commit state. */
import {getInterviewQuestions,createProjectConfig,createDeterministicProvider} from '../authoring/index.js';
import {segmentProse,MAX_PROSE_LENGTH} from '../domain/prose.js';
export const LEGACY_CAPABILITIES: readonly Action[] = ['interview','planStory','generateChapter','interpretRevision','reviewChapter'];
export const CAPABILITIES: readonly Action[] = [...LEGACY_CAPABILITIES,'generateProse','extractMemory','auditMemoryCandidate','reviseProse'];
export function createTemplateAdapter(): ProviderAdapter{const template=createDeterministicProvider();return {
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
export function validateProvider<T>(provider: T): T {for(const name of CAPABILITIES)if((LEGACY_CAPABILITIES.includes(name)||Object.hasOwn(provider??{},name))&&(!object(provider)||typeof provider[name]!=='function'))throw Error(`供应商缺少 ${name} 能力`);return provider}
export function createInjectedProvider<T>(implementation: T){return validateProvider(implementation)}
const object=(value: unknown): value is Record<string, unknown> =>value!==null&&typeof value==='object'&&!Array.isArray(value);
const nonempty=(value: unknown): value is string =>typeof value==='string'&&value.trim().length>0;
const safeKey=(key: unknown): key is string =>typeof key==='string'&&/^[A-Za-z][A-Za-z0-9_]*$/.test(key)&&!['__proto__','prototype','constructor'].includes(key);
function validateProseRevisionInput(input: unknown){
 const validString=(value: unknown,max: number,empty=false): value is string =>typeof value==='string'&&value.length<=max&&(empty||!!value.trim());
 const context=object(input)?input.context:undefined;
 if(!object(input)||Object.keys(input).length!==4||Object.keys(input).some(key=>!['text','instruction','chapterId','context'].includes(key))||!validString(input.text,MAX_PROSE_LENGTH)||!validString(input.instruction,4000)||!validString(input.chapterId,200)||!object(context)||!validString(context.projectId,200)||!Number.isInteger(context.version)||typeof context.version!=='number'||context.version<1||!Array.isArray(context.sources)||context.sources.length>100||context.sources.some(source=>!object(source)||!validString(source.chapterId,200)||!Number.isInteger(source.revision)||typeof source.revision!=='number'||source.revision<1||!validString(source.text,40000,true)))throw Error('改稿需要完整原文、明确的作者指令、目标章节与有效上下文');
 const isolated={text:input.text,instruction:input.instruction,chapterId:input.chapterId,context};
 if(new TextEncoder().encode(JSON.stringify({action:'reviseProse',input:isolated})).byteLength>128*1024)throw Error('改稿请求过大；请缩小参考上下文');
 return isolated;
}
function validateMemoryAuditInput(input: unknown){
 if(!object(input)||Object.keys(input).length!==2||Object.keys(input).some(key=>!['label','sourceQuote'].includes(key))||!nonempty(input.label)||input.label.length>1000||!nonempty(input.sourceQuote)||input.sourceQuote.length>30000)throw Error('独立记忆审查只接受完整原始主张与该条精确引文');
 const isolated={label:input.label,sourceQuote:input.sourceQuote};
 if(new TextEncoder().encode(JSON.stringify({action:'auditMemoryCandidate',input:isolated})).byteLength>128*1024)throw Error('独立记忆审查请求过大');
 return isolated;
}
// Repeat memory binding validation at the browser boundary. Injected HTTP results
// must not manufacture positive checks or repair the author's candidate evidence.
function validateMemoryCandidates(input: unknown): {candidateId:string;label:string;sourceQuote:string}[]{
 if(!object(input)||!Object.hasOwn(input,'memoryCandidates'))return [];
 const candidates=input.memoryCandidates,seen=new Set();
 const checked: {candidateId:string;label:string;sourceQuote:string}[]=[];
 if(!Array.isArray(candidates)||candidates.length>30)throw Error('记忆候选格式或正文来源无效，请重试');
 for(const candidate of candidates){
  if(!object(candidate)||Object.keys(candidate).some(key=>!['candidateId','label','sourceQuote'].includes(key))||!nonempty(candidate.candidateId)||candidate.candidateId.length>200||!nonempty(candidate.label)||candidate.label.length>1000||!nonempty(candidate.sourceQuote)||candidate.sourceQuote.length>30000||typeof input.text!=='string'||!input.text.includes(candidate.sourceQuote)||seen.has(candidate.candidateId))throw Error('记忆候选格式或正文来源无效，请重试');
  seen.add(candidate.candidateId);
  checked.push({candidateId:candidate.candidateId,label:candidate.label,sourceQuote:candidate.sourceQuote});
 }
 return checked;
}
function validateMemoryChecks(output: Record<string,unknown>,input: unknown){
 const candidates=validateMemoryCandidates(input);
 if(!Object.hasOwn(output,'memoryChecks'))return;
 const checks=output.memoryChecks,seen=new Set();
 if(!Array.isArray(checks)||checks.length>30)throw Error('记忆支持审查结果格式无效，请重试');
 for(const check of checks){
  if(!object(check)||Object.keys(check).some(key=>!['candidateId','status','explanation'].includes(key))||!nonempty(check.candidateId)||check.candidateId.length>200||candidates.filter(candidate=>candidate.candidateId===check.candidateId).length!==1||seen.has(check.candidateId)||(typeof check.status!=='string'||!['supported','unsupported','unknown'].includes(check.status))||!nonempty(check.explanation)||check.explanation.length>4000)throw Error('记忆支持审查结果格式或候选标识无效，请重试');
  seen.add(check.candidateId);
 }
}
export function validateActionOutput<A extends Action>(action: A,output: unknown,input?: unknown): ActionOutputMap[A];
export function validateActionOutput(action: Action,output: unknown,input?: unknown): Record<string,unknown>{
 const request=object(input)?input:{};
 const project=object(request.project)?request.project:{};
 const outline: unknown[]=Array.isArray(project.outline)?project.outline:[];
 const candidate=typeof request.chapterIndex==='number'?outline[request.chapterIndex]:undefined;
 const target=object(candidate)?candidate:{};
 if(!object(output))throw Error('生成服务返回了无效结果，请重试');
 if(action==='auditMemoryCandidate'){
  validateMemoryAuditInput(input);
  if(Object.keys(output).some(key=>!['status','explanation','provider'].includes(key))||!Object.hasOwn(output,'status')||!Object.hasOwn(output,'explanation')||(typeof output.status!=='string'||!['supported','unsupported','unknown'].includes(output.status))||!nonempty(output.explanation)||output.explanation.length>4000||Object.hasOwn(output,'provider')&&!object(output.provider))throw Error('独立记忆审查结果格式无效，请重试');
 }
 if(action==='interview'&&(!Array.isArray(output.questions)||output.questions.length>6||output.questions.some(q=>!object(q)||!safeKey(q.key)||!nonempty(q.title)||(q.options!==undefined&&(!Array.isArray(q.options)||q.options.some(x=>typeof x!=='string'))))))throw Error('访谈结果格式无效，请重试');
 if(action==='planStory'&&(!object(output.contract)||!Array.isArray(output.contract.fields)||!output.contract.fields.length||output.contract.fields.some(f=>!object(f)||!safeKey(f.key)||!nonempty(f.label)||typeof f.value!=='string')||!Array.isArray(output.outline)||output.outline.length!==3||output.outline.some(c=>!object(c)||!nonempty(c.title)||!nonempty(c.goal))))throw Error('故事规划格式无效：需要故事约定与三章大纲');
 if(action==='generateChapter'&&!nonempty(output.text))throw Error('生成服务未返回章节正文，请重试');
 if(action==='generateProse'&&(!nonempty(output.text)||output.text.length>30000||!nonempty(output.chapterId)||(target.id!==undefined&&output.chapterId!==target.id)))throw Error('生成服务未返回有效完整正文，请重试；已保存的正文保持不变');
 if(action==='reviseProse'){
  validateProseRevisionInput(input);
  if(Object.keys(output).some(key=>!['text','chapterId','provider'].includes(key))||!nonempty(output.text)||output.text.length>MAX_PROSE_LENGTH||output.chapterId!==request.chapterId||Object.hasOwn(output,'provider')&&!object(output.provider))throw Error('改稿服务未返回有效完整正文，请重试；已保存的正文保持不变');
 }
 if(action==='extractMemory'){
  const paragraphs=typeof request.text==='string'?segmentProse(request.text):null;
  if(!Array.isArray(output.staging)||output.staging.length>30||!Array.isArray(output.reviewNotes)||output.reviewNotes.length>30||output.reviewNotes.some(note=>!nonempty(note)||note.length>2000)||output.staging.some(entry=>{
   if(!object(entry)||Object.keys(entry).some(key=>!['label','sourceParagraphIndex','sourceQuote','sourceStart','sourceEnd'].includes(key))||!nonempty(entry.label)||entry.label.length>1000||(typeof entry.sourceParagraphIndex!=='number'||!Number.isSafeInteger(entry.sourceParagraphIndex))||entry.sourceParagraphIndex<0||!nonempty(entry.sourceQuote)||entry.sourceQuote.length>30000||(typeof entry.sourceStart!=='number'||!Number.isSafeInteger(entry.sourceStart))||entry.sourceStart<0||(typeof entry.sourceEnd!=='number'||!Number.isSafeInteger(entry.sourceEnd))||entry.sourceEnd<=entry.sourceStart)return true;
   const paragraph=paragraphs?.[entry.sourceParagraphIndex];
   return !paragraph||entry.sourceQuote!==paragraph.text||entry.sourceStart!==paragraph.start||entry.sourceEnd!==paragraph.end;
  }))throw Error('记忆提取结果格式或正文定位无效；已保存的正文保持不变');
 }
 if(action==='interpretRevision'&&((!Array.isArray(output.operations)&&!Array.isArray(output.suggestedFacts))||!Array.isArray(output.questions)))throw Error('修改解释结果格式无效，请重试');
 if(action==='reviewChapter'){
  if(!Array.isArray(output.issues))throw Error('章节审查结果格式无效，请重试');
  validateMemoryChecks(output,input);
 }
 // The overload exposes only fields checked above; every other field remains unknown.
 return output;
}
export function createServerProvider({fetchImpl=(input,init)=>globalThis.fetch(input,init),baseUrl='/api',timeoutMs=120000}: {fetchImpl?: typeof fetch;baseUrl?: string;timeoutMs?: number}={}): ServerProvider{
 // A relative same-origin endpoint keeps provider credentials exclusively on the server.
 if(!/^\/(?!\/)/.test(baseUrl))throw Error('生成服务必须使用同源相对路径');
 const endpoint=baseUrl.replace(/\/$/,'');
 const identity={id:'server-model',label:'服务端模型',isLive:true};
 async function request(path: string,body: unknown,{signal}: RequestOptions={}){
  const controller=new AbortController();let timer: ReturnType<typeof setTimeout> | undefined,abortError: Error | undefined,rejectAbort!: (reason: Error) => void;
  const interrupted=new Promise<never>((_,reject)=>{rejectAbort=reject;});
  const abort=(timeout: boolean)=>{if(abortError)return;abortError=Object.assign(new Error(timeout?'生成服务响应超时，请重试；已保存的正文保持不变':'生成请求已取消；已保存的正文保持不变'),{name:timeout?'TimeoutError':'AbortError',code:timeout?'UPSTREAM_TIMEOUT':'REQUEST_CANCELLED'});rejectAbort(abortError);controller.abort();};
  const onAbort=()=>abort(false);
  signal?.addEventListener('abort',onAbort,{once:true});
  if(signal?.aborted)onAbort();
  timer=setTimeout(()=>abort(true),timeoutMs);
  try {
   const operation=async()=>{
    if(abortError)throw abortError;
    const response=await fetchImpl(`${endpoint}${path}`,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},...(body?{body:JSON.stringify(body)}:{}),signal:controller.signal});
    if(abortError)throw abortError;
    let raw: unknown;try{raw=await response.json();}catch{throw Error(`生成服务返回无法读取的响应（HTTP ${response.status}）`);}
    if(abortError)throw abortError;
    const payload=object(raw)?raw:{};
    const errorData=object(payload.error)?payload.error:{};
    if(!response.ok||payload.error){const detail=typeof payload.error==='string'?payload.error:errorData.message||payload.message;const error=Error(detail?String(detail):`生成服务请求失败（HTTP ${response.status}）`);if(errorData.code==='REQUEST_CANCELLED')Object.assign(error,{name:'AbortError',code:'REQUEST_CANCELLED'});if(errorData.code==='UPSTREAM_TIMEOUT')Object.assign(error,{name:'TimeoutError',code:'UPSTREAM_TIMEOUT'});throw error;}
    return payload;
   };
   return await Promise.race([operation(),interrupted]);
  }catch(error){if(abortError)throw abortError;throw error;}finally{clearTimeout(timer);signal?.removeEventListener('abort',onAbort);}
 }
 const validStatus=(value: Record<string,unknown>): value is ProviderStatus=>typeof value.configured==='boolean';
 const getStatus=async ({signal}: RequestOptions={}): Promise<ProviderStatus>=>{const status=await request('/status',undefined,{signal});if(!validStatus(status))throw Error('生成服务状态格式无效');return status;};
 const run=async <A extends Action>(action: A,input: unknown,{signal}: RequestOptions={}): Promise<ActionOutputMap[A]>=>{
  if(action==='reviewChapter'&&!signal?.aborted)validateMemoryCandidates(input);
  if(action==='auditMemoryCandidate'&&!signal?.aborted)input=validateMemoryAuditInput(input);
  if(action==='reviseProse'&&!signal?.aborted)input=validateProseRevisionInput(input);
  const payload=await request('/agent',{action,input},{signal});
  const output=validateActionOutput(action,payload.output,input);
  const record=output;
  const context=object(input)&&object(input.context)?input.context:{};
  const provider={...identity,...(object(payload.provider)?payload.provider:{}),...(object(record.provider)?record.provider:{}),isLive:true};
  if(action==='generateChapter')return {...output,provider,...(payload.model?{model:payload.model}:{}),status:'candidate',baseVersion:context.stateVersion??context.version??null,staging:Array.isArray(record.staging)?record.staging:[]};
  if(action==='generateProse'||action==='extractMemory'||action==='auditMemoryCandidate'||action==='reviseProse')return {...output,provider};
  return output;
 };
 return validateProvider({...identity,getStatus,
  interview: (input,options)=>run('interview',input,options),
  planStory: (input,options)=>run('planStory',input,options),
  generateChapter: (input,options)=>run('generateChapter',input,options),
  generateProse: (input,options)=>run('generateProse',input,options),
  reviseProse: (input,options)=>run('reviseProse',input,options),
  extractMemory: (input,options)=>run('extractMemory',input,options),
  auditMemoryCandidate: (input,options)=>run('auditMemoryCandidate',input,options),
  interpretRevision: (input,options)=>run('interpretRevision',input,options),
  reviewChapter: (input,options)=>run('reviewChapter',input,options),
 } satisfies ServerProvider);
}
