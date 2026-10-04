import {createInitialState, getImpacts, getFactReviewGate, validatePatch, validateProseDraftRecord, validateMemoryDraftRecord, validateManualDraftSource, hash} from './domain/engine.js';
import {validateDraftRevisions} from './domain/author-revision.js';
import {archiveMemoryReview, replaceMemoryCandidates} from './domain/memory-review.js';
export const KEY='nexusscribe.demo.v1', BACKUP_KEY=KEY+'.last-good', QUARANTINE_KEY=KEY+'.preserved';
export const MAX_BACKUP_BYTES=2*1024*1024;
const bad=message=>{throw Error(message)};
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const integer=x=>Number.isSafeInteger(x)&&x>=0;
const text=x=>typeof x==='string';
const fresh=()=>({format:1,serial:0,state:createInitialState(),editing:{},patch:null});
// Never evaluate imported content. Bound traversal and forbid dangerous keys at every depth.
function inspect(value,depth=0,budget={nodes:0}){
 if(depth>60||++budget.nodes>150000)bad('备份结构超出安全上限');
 if(Array.isArray(value)){if(value.length>20000)bad('备份列表过大');value.forEach(v=>inspect(v,depth+1,budget));}
 else if(object(value))for(const [key,v] of Object.entries(value)){if(['__proto__','prototype','constructor'].includes(key))bad('备份包含不安全字段');inspect(v,depth+1,budget);}
}
function records(items,label){if(!Array.isArray(items)||items.some(x=>!object(x)))bad(label+'格式无效');const ids=items.filter(x=>x.id!==undefined).map(x=>x.id);if(ids.some(x=>!text(x)||!x)||new Set(ids).size!==ids.length)bad(label+' ID 冲突');}
const stringFields=['kind','type','op','id','title','text','label','originalLabel','statement','description','proposition','quote','status','condition','reason','summary','explanation','sourceQuote','factLabel','factId','chapterId','paragraphId','candidateId','decisionId','draftId','runId','projectId','holder','subject','predicate','authority','value','mode','syncStatus','semanticStatus'];
const numberFields=['revision','version','baseVersion','recordVersion','syncedRevision','draftRevision','stateVersion','toVersion'];
function displayTypes(value){if(Array.isArray(value))value.forEach(displayTypes);else if(object(value)){for(const [k,v] of Object.entries(value)){if(stringFields.includes(k)&&v!==null&&!text(v))bad('备份文本字段格式无效：'+k);if(numberFields.includes(k)&&v!==null&&!integer(v))bad('备份版本字段格式无效：'+k);displayTypes(v);}}}
function validateProject(p){
 if(!object(p)||!object(p.state)||!object(p.editing))bad('项目结构无效');const s=p.state;
 if(s.schemaVersion!==1||!['demo','custom'].includes(s.mode)||!text(s.projectId)||!s.projectId||!text(s.title)||!integer(s.version)||!integer(s.sequence))bad('项目版本或标识不兼容');
 displayTypes(s);
 for(const key of ['chapters','facts','knowledge','evidence','plans','events','disclosures','preferences','drafts','commits','factHistory','pendingPatches','derived']){
  // History may repeat logical IDs across record versions; other entity collections may not.
  if(key==='factHistory'){if(!Array.isArray(s[key])||s[key].some(x=>!object(x)))bad('历史格式无效');}else records(s[key],key);
 }
 for(const key of ['facts','knowledge','evidence','plans','events','disclosures','drafts','commits'])if(s[key].some(x=>!text(x.id)||!x.id))bad(key+' 缺少 ID');
 if(!s.chapters.length||s.chapters.length>2000)bad('章节数量无效');
 for(const c of s.chapters){if(!text(c.id)||!c.id||!text(c.title)||!text(c.text)||!integer(c.revision)||!integer(c.syncedRevision)||!text(c.status)||!text(c.syncStatus))bad('章节格式无效');records(c.revisions,'正文版本');const revs=new Set();for(const r of c.revisions){if(!integer(r.revision)||revs.has(r.revision)||!text(r.text)||!Array.isArray(r.paragraphs)||r.paragraphs.some(p=>!object(p)||!text(p.id)||!text(p.text)))bad('正文版本格式无效');revs.add(r.revision)}if(!c.revisions.some(r=>r.revision===c.revision&&r.text===c.text))bad('当前正文缺少对应原始版本');}
 for(const [id,t] of Object.entries(p.editing))if(!s.chapters.some(c=>c.id===id)||(t!==undefined&&!text(t)))bad('暂存正文格式无效');
 for(const k of s.knowledge)if(!Array.isArray(k.supportSets)||k.supportSets.some(a=>!Array.isArray(a)||a.some(x=>!text(x))))bad('认知来源格式无效');
 for(const d of s.drafts){
  try{validateProseDraftRecord(d);validateMemoryDraftRecord(d);validateDraftRevisions(d);validateManualDraftSource(s,d);}catch{bad('候选稿正文版本或记忆提取记录无效');}
  if(d.requiresExtraction!==undefined&&typeof d.requiresExtraction!=='boolean')bad('候选稿提取标记无效');
  if(d.requiresExtraction===true){
   if(d.projectId!==s.projectId)bad('候选稿提取记录不属于当前项目');
   for(const source of d.context.sources)if(!s.chapters.some(c=>c.id===source.chapterId&&c.revisions.some(r=>r.revision===source.revision&&r.text===source.text)))bad('候选稿来源正文版本无效');
  }
  if(!text(d.id)||!text(d.text)||!integer(d.revision)||!object(d.chapterRevisions)||!Array.isArray(d.staging))bad('候选稿格式无效');for(const report of [d.review,d.modelReview])if(report!=null){if(!object(report))bad('审阅记录格式无效');for(const key of ['issues','errors','factLedger','factChecks','memoryLedger','memoryChecks'])if(report[key]!==undefined&&(!Array.isArray(report[key])||report[key].some(entry=>!(object(entry)||(['issues','errors'].includes(key)&&report===d.review&&text(entry))))))bad('审阅列表格式无效');}if(d.factDecisions!==undefined&&(!Array.isArray(d.factDecisions)||d.factDecisions.some(x=>!object(x))))bad('例外记录格式无效');}
 if(s.config&&(!object(s.config)||(s.config.outline!==undefined&&(!Array.isArray(s.config.outline)||s.config.outline.some(x=>!object(x)&&!text(x))))))bad('故事约定格式无效');
 if(s.config){for(const key of ['idea','premise','protagonist','pov','tone','goal','boundaries'])if(s.config[key]!==undefined&&!text(s.config[key]))bad('故事约定文本格式无效');if(s.config.constraints!==undefined&&(!Array.isArray(s.config.constraints)||s.config.constraints.some(x=>!text(x))))bad('故事约定限制格式无效');}
 if(p.patch!==null&&p.patch!==undefined){if(!object(p.patch)||!Array.isArray(p.patch.operations)||!Array.isArray(p.patch.questions)||!Array.isArray(p.patch.intents))bad('待决补丁格式无效');displayTypes(p.patch);if(p.patch.operations.some(x=>!object(x))||p.patch.questions.some(x=>!text(x))||p.patch.intents.some(x=>!text(x)))bad('待决补丁内容格式无效');}
 try{getImpacts(s);s.drafts.forEach(d=>getFactReviewGate(s,d.id));if(p.patch)validatePatch(s,p.patch);}catch{bad('项目依赖结构无效，未导入');}
}
export function parseBackup(raw){
 if(!text(raw)||new TextEncoder().encode(raw).length>MAX_BACKUP_BYTES)bad('备份超过 2 MiB 上限');
 let data;try{data=JSON.parse(raw)}catch{bad('备份不是有效 JSON')}
 inspect(data);if(object(data))delete data.recovery; // Runtime recovery flags are never trusted from serialized input.
 if(!object(data)||data.format!==1||!integer(data.serial)||data.serial===Number.MAX_SAFE_INTEGER)bad('保存数据格式不兼容');
 if(data.providerMode!==undefined&&!['template','server'].includes(data.providerMode))bad('运行方式无效');
 if(data.archived!==undefined&&!Array.isArray(data.archived))bad('项目列表无效');
 const projects=[data,...(data.archived||[])];if(projects.length>50)bad('备份最多支持 50 个项目');projects.forEach(validateProject);
 const ids=projects.map(p=>p.state.projectId);if(new Set(ids).size!==ids.length)bad('项目 ID 冲突');return data;
}
function encode(data){const {recovery,...clean}=data;const raw=JSON.stringify(clean);parseBackup(raw);return raw;}
export function loadWorkspace(){
 let primaryRaw;
 try{primaryRaw=localStorage.getItem(KEY);if(primaryRaw!==null)return parseBackup(primaryRaw);const backup=localStorage.getItem(BACKUP_KEY);if(backup!==null)return {...parseBackup(backup),recovery:{blocked:true,primaryRaw:null,message:'主存储缺失，已打开上一份可读备份。请导出并确认恢复后再保存。'}};return fresh();}
 catch(error){let workspace=fresh(),available=false;try{const raw=localStorage.getItem(BACKUP_KEY);if(raw!==null){workspace=parseBackup(raw);available=true}}catch{}
 return {...workspace,recovery:{blocked:true,primaryRaw,message:available?'主存储损坏，已打开上一份可读备份；原始数据未改变。请导出并确认恢复。':'存储无法读取，已进入临时工作区；原始数据未改变。请导出当前内容。',available,error:error.message}};}
}
export function persistWorkspace(data,expected){
 if(data.recovery?.blocked)bad('尚未恢复存储，当前编辑仅在内存中；请先导出并确认恢复');
 const current=localStorage.getItem(KEY),old=current===null?null:parseBackup(current);
 if((old?.serial??0)!==expected)bad('另一窗口已更新项目。当前编辑已保留在内存，请先导出再刷新');
 const next={...data,format:1,serial:expected+1};const raw=encode(next);
 if(current!==null)localStorage.setItem(BACKUP_KEY,current);
 localStorage.setItem(KEY,raw);return next;
}
export function recoverWorkspace(data){
 if(!data.recovery?.blocked)bad('无需恢复');const current=localStorage.getItem(KEY);
 if(current!==data.recovery.primaryRaw)bad('存储已被另一窗口改变，请导出当前编辑后重新打开');
 const {recovery,...clean}=data;const next={...clean,serial:clean.serial+1};const raw=encode(next);
 // A preservation failure MUST stop repair. Existing evidence is never silently replaced.
 if(current!==null){const preserved=localStorage.getItem(QUARANTINE_KEY);if(preserved!==null&&preserved!==current)bad('已存在另一份损坏原始数据，请先导出，暂不覆盖恢复');localStorage.setItem(QUARANTINE_KEY,current);}
 localStorage.setItem(KEY,raw);return next;
}
export function importBackup(current,backup,idFactory=()=>`import-${crypto.randomUUID()}`){
 const parsed=parseBackup(JSON.stringify(backup)),used=new Set([current.state.projectId,...(current.archived||[]).map(p=>p.state.projectId)]);
 const projects=[parsed,...(parsed.archived||[])].map(p=>{
  const id=idFactory();if(!text(id)||!id||used.has(id))bad('新项目 ID 冲突，未导入');used.add(id);
  const original=structuredClone({state:p.state,editing:p.editing,patch:p.patch??null});
  const clone=structuredClone(original);function remap(v){if(Array.isArray(v))v.forEach(remap);else if(object(v))for(const [k,x] of Object.entries(v)){if(k==='projectId'&&x===p.state.projectId)v[k]=id;else remap(x)}}remap(clone);
  // Exact original bytes are available in the user's source file; preserve structured audit here.
  clone.state.importOrigin={projectId:p.state.projectId,original};clone.patch=null;clone.state.pendingPatches=[];
  for(const d of clone.state.drafts){
   if(d.requiresExtraction&&d.extraction.binding)d.extraction.binding.contextHash=hash(JSON.stringify(d.context));
   if(!['ACCEPTED','REJECTED'].includes(d.status)){
    for(const proposal of d.revisionProposals||[])if(['requesting','proposed'].includes(proposal.status)){proposal.status='stale';proposal.resultSnapshot=null;}
    archiveMemoryReview(d,'backup_imported');d.review=null;d.modelReview=null;d.factDecisions=[];d.status='DRAFT';
    if(d.requiresExtraction){replaceMemoryCandidates(d,[]);d.extraction={status:'pending',attempt:d.extraction.attempt+1,binding:null};}
   }
  }
  return clone;
 });
 const active={state:current.state,editing:current.editing,patch:current.patch};
 const next={...current,...projects[0],archived:[...(current.archived||[]),active,...projects.slice(1)]};encode(next);return next;
}
export function download(name,data,type='application/json'){
 const blob=new Blob([typeof data==='string'?data:JSON.stringify(data,null,2)],{type});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
