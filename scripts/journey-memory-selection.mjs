import {getMemoryReviewGate} from '../src/domain/engine.js';

/** Offline decision plan for the explicitly approved browser journey. Never adds a model request or fabricates an author attestation. Every candidate is explicitly rejected, regardless of optional model advice. */
export function planJourneyMemorySelection(state,draftId){
 const items=getMemoryReviewGate(state,draftId);
 if(items.some(item=>!item.canDecide))throw Error('MEMORY_SELECTION_NOT_CURRENT');
 const decisions=items.map((item,index)=>({candidateId:item.candidateId,label:item.label,index,action:'reject'}));
 // This generic synthetic journey makes no informed author attestation. Reject all; a model verdict is never selection authority.
 const selected=0;
 return {decisions,selected,rejected:decisions.length-selected,total:decisions.length};
}
