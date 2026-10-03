import {getMemoryReviewGate} from '../src/domain/engine.js';

/** Offline decision plan for the explicitly approved browser journey. Never overrides a judgment or adds a model request. Unaudited/bundled-only candidates are rejected. */
export function planJourneyMemorySelection(state,draftId){
 const items=getMemoryReviewGate(state,draftId);
 if(items.some(item=>!item.canDecide))throw Error('MEMORY_SELECTION_NOT_CURRENT');
 const decisions=items.map((item,index)=>({candidateId:item.candidateId,label:item.label,index,action:item.status==='supported'&&item.canKeep?'keep':'reject'}));
 const selected=decisions.filter(item=>item.action==='keep').length;
 return {decisions,selected,rejected:decisions.length-selected,total:decisions.length};
}
