import {ApiError,SAFE_VALIDATION_REASONS} from '../server/provider.js';
export const SAFE_CODES=new Set(['NOT_CONFIGURED','INVALID_INPUT','INVALID_MODEL_OUTPUT','UPSTREAM_ERROR','UPSTREAM_TIMEOUT','OUTPUT_TRUNCATED','CALL_LIMIT','RATE_LIMIT','CONCURRENT_LIMIT']);
export function journeyConfig(env) {
 if(env.NEXUS_JOURNEY_APPROVED!=='true'||env.NEXUS_LIVE_ENABLED!=='true'||env.NEXUS_OVERAGE_CONFIRMED_OFF!=='true')throw Error('APPROVAL_REQUIRED');
 return {...env,NEXUS_API_BASE_URL:'https://opencode.ai/zen/go/v1',NEXUS_API_MODEL:'deepseek-v4.1-flash',NEXUS_THINKING_MODE:'disabled',NEXUS_REASONING_EFFORT:undefined,NEXUS_MAX_CALLS:'12',NEXUS_MAX_OUTPUT_TOKENS:'3000'};
}
/** A fail-closed wrapper: no retry, no provider/body logging, hard session budget. */
export function guardJourney(service,{log=console.log,now=Date.now,sleep=ms=>new Promise(r=>setTimeout(r,ms)),before=()=>{}}={}) {
 let attempts=0,stopped=false,last=-Infinity,busy=false;const actions=[];
 return {status:()=>({...service.status(),callsUsed:attempts,maxCalls:12}),get stopped(){return stopped},actions,
 async run(action,input){
  if(stopped||attempts>=12||busy)throw new ApiError(429,'CALL_LIMIT','Live journey stopped');
  busy=true;
  try {
   before(action,input);
   await sleep(Math.max(0,11000-(now()-last)));
   if(stopped)throw Error('STOPPED');
   last=now();attempts++;actions.push(action);
   const result=await service.run(action,input);
   log(`provider PASS ${attempts}`);return result;
  }catch(error){stopped=true;const code=SAFE_CODES.has(error?.code)?error.code:'JOURNEY_FAILED';log(`provider ${code} ${attempts}`);if(code==='INVALID_MODEL_OUTPUT'&&SAFE_VALIDATION_REASONS.includes(error?.validationReason))log(`validation ${error.validationReason}`);throw new ApiError(502,code,'Live journey stopped');}
  finally{busy=false;}
 }};
}
