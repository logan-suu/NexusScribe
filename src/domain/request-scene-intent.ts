import type {Context, Draft, ProjectState} from './types.js';
import type {IntentField} from './review-types.js';
/** Local saved input provenance. This is neither model evidence nor a quality verdict. */
export interface RequestSceneIntent {
 protocol:'request-scene-intent-v1'; boundary:'app-saved-scene-input'; projectId:string; chapterId:string;
 chapterIndex:number; chapterRevision:number; stateVersion:number; draftId:string; runId:string; draftRevision:number;
 contextVersion:number; contextSchemaVersion:number; source:string; goal:IntentField; exitState:IntentField;
}
const object=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const exact=(v:unknown,keys:string[]):v is Record<string,unknown>=>object(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const integer=(v:unknown):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0;
const positive=(v:unknown):v is number=>integer(v)&&v>0;
const id=(v:unknown):v is string=>typeof v==='string'&&!!v.trim()&&v.length<=200;
function fail():never {throw Object.assign(Error('审阅或改稿的创作意图来源记录无效或已过期'),{code:'INVALID_REQUEST_SCENE_INTENT'});}
function field(outline:unknown,key:string):IntentField {
 if(!object(outline)||!Object.hasOwn(outline,key))return {status:'missing',value:null};
 if(typeof outline[key]!=='string')return {status:'invalid',value:null};
 return {status:outline[key].trim()?'present':'empty',value:outline[key]};
}
function validField(v:unknown) {
 if(!exact(v,['status','value']))return false;
 if(v.status==='missing'||v.status==='invalid')return v.value===null;
 return typeof v.value==='string'&&v.value.length<=4000&&(v.status==='present'?!!v.value.trim():v.status==='empty'&&!v.value.trim());
}
export function validateRequestSceneIntent(v:unknown):asserts v is RequestSceneIntent {
 if(!exact(v,['protocol','boundary','projectId','chapterId','chapterIndex','chapterRevision','stateVersion','draftId','runId','draftRevision','contextVersion','contextSchemaVersion','source','goal','exitState'])
 ||v.protocol!=='request-scene-intent-v1'||v.boundary!=='app-saved-scene-input'||!id(v.projectId)||!id(v.chapterId)||!id(v.draftId)||!id(v.runId)
 ||!integer(v.chapterIndex)||!positive(v.chapterRevision)||!positive(v.stateVersion)||!positive(v.draftRevision)||!positive(v.contextVersion)||!integer(v.contextSchemaVersion)
 ||v.source!==`config.outline[${v.chapterIndex}]`||!validField(v.goal)||!validField(v.exitState))fail();
}
export function validateSceneIntentContext(v:unknown,context:unknown,chapterId:unknown):asserts v is RequestSceneIntent {
 validateRequestSceneIntent(v);
 if(!object(context)||!Array.isArray(context.sources)||v.projectId!==context.projectId||v.chapterId!==chapterId||v.stateVersion!==context.version||v.contextVersion!==context.version||v.contextSchemaVersion!==(Object.hasOwn(context,'contextSchemaVersion')?context.contextSchemaVersion:0))fail();
 const source=context.sources[v.chapterIndex];
 if(!object(source)||source.chapterId!==v.chapterId||source.revision!==v.chapterRevision||Object.hasOwn(source,'chapterIndex')&&source.chapterIndex!==v.chapterIndex
 ||context.sources.filter(item=>object(item)&&item.chapterId===v.chapterId).length!==1)fail();
}
export function captureRequestSceneIntent(state:ProjectState,draft:Draft,context:Context):RequestSceneIntent {
 const chapterId=draft.chapterId||'ch3',chapterIndex=state.chapters.findIndex(c=>c.id===chapterId),chapter=state.chapters[chapterIndex];
 if(draft.projectId!==state.projectId||!chapter||state.chapters.filter(c=>c.id===chapterId).length!==1)fail();
 const outline=state.config?.outline?.[chapterIndex];
 const value:RequestSceneIntent={protocol:'request-scene-intent-v1',boundary:'app-saved-scene-input',projectId:state.projectId,chapterId,chapterIndex,chapterRevision:chapter.revision,stateVersion:state.version,draftId:draft.id,runId:draft.runId,draftRevision:draft.revision,contextVersion:context.version,contextSchemaVersion:context.contextSchemaVersion??0,source:`config.outline[${chapterIndex}]`,goal:field(outline,'goal'),exitState:field(outline,'exitState')};
 validateSceneIntentContext(value,context,chapterId);return value;
}
export function isRequestSceneIntentCurrent(state:ProjectState,draft:Draft,value:unknown,context:Context):boolean {
 try{validateRequestSceneIntent(value);return JSON.stringify(value)===JSON.stringify(captureRequestSceneIntent(state,draft,context));}catch{return false;}
}
