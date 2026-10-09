import {randomUUID} from 'node:crypto';
import type {ProviderRequestInput,ProviderRequest,ProviderCategory,HttpCategory,TransportDiagnostics,ErrorResponse,RunOptions,UnknownRecord} from './types.js';

// Honest application identity. This does not identify NexusScribe as OpenCode.
export const PROVIDER_USER_AGENT='NexusScribe-demo/0.1';
export const MAX_ERROR_RESPONSE_BYTES=16*1024;
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

/** Pure request construction: no environment access, fetch, retry or body rewrite.
 * Independent requests get fresh sessions by default. The app explicitly passes
 * its existing process session for ordinary calls; isolated audits never do.
 * The caller owns approval, credential handling, budgets and an abort deadline.
 */
export function buildProviderRequest({endpoint,key,body,signal,sessionId=randomUUID()}: ProviderRequestInput): ProviderRequest {
  let url;try{url=new URL(endpoint);}catch{throw Error('INVALID_TRANSPORT_REQUEST');}
  if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||typeof key!=='string'||!key.trim()||/[\r\n]/.test(key)||typeof body!=='string'||!uuid.test(sessionId)||!signal||typeof signal.addEventListener!=='function')throw Error('INVALID_TRANSPORT_REQUEST');
  return {url:url.href,options:{method:'POST',redirect:'error',signal,headers:{'Content-Type':'application/json','User-Agent':PROVIDER_USER_AGENT,'x-opencode-session':sessionId,Authorization:`Bearer ${key}`},body}};
}

const providerCategories=new Map<string,ProviderCategory>([
  ['invalid_api_key','authentication'],['authentication_error','authentication'],
  ['permission_denied','permission'],['permission_error','permission'],
  ['insufficient_quota','quota'],['rate_limit_exceeded','rate_limit'],['rate_limit_error','rate_limit'],
  ['model_not_found','model_unavailable'],['unsupported_model','model_unavailable'],
  ['unsupported_parameter','unsupported_parameter'],['context_length_exceeded','context_limit'],
  ['invalid_request_error','invalid_request'],['server_error','upstream_unavailable'],
]);
const object=(x: unknown): x is UnknownRecord=>!!x&&typeof x==='object'&&!Array.isArray(x);
export function providerErrorCategory(data: unknown): ProviderCategory {
  if(!object(data)||!object(data.error))return 'unknown';
  // Exact code/type matches only. Never inspect message, param, nested text,
  // URLs, request IDs or arbitrary error strings. Conflicts remain unknown.
  const error=data.error;
  const categories=['code','type'].map(k=>typeof error[k]==='string'?providerCategories.get(error[k]):undefined).filter((category): category is ProviderCategory=>category!==undefined);
  return categories.length&&categories.every(x=>x===categories[0])?categories[0]:'unknown';
}
export function httpErrorCategory(status: unknown): HttpCategory {
  if(status===400||status===422)return 'invalid_request';
  if(status===401)return 'authentication';
  if(status===402)return 'payment_required';
  if(status===403)return 'permission';
  if(status===404)return 'not_found';
  if(status===408||status===504)return 'timeout';
  if(status===413)return 'request_too_large';
  if(status===429)return 'rate_limit';
  if(typeof status==='number'&&Number.isInteger(status)&&status>=500&&status<=599)return 'upstream_unavailable';
  return 'unknown';
}

/** Bounded, enum-only diagnostics for non-2xx responses. No raw envelope escapes.
 * Uses the caller's abort deadline, including while reading a stalled stream.
 * These are HTTP observations/provider claims, never proof of a root cause.
 */
export async function readProviderError(response: ErrorResponse,{signal}: RunOptions={}): Promise<TransportDiagnostics> {
  const httpStatus=Number.isInteger(response?.status)&&response.status>=100&&response.status<=599?response.status:null;
  const out: TransportDiagnostics={httpStatus,httpCategory:httpErrorCategory(httpStatus),providerCategory:'unknown',bodyState:'unavailable'};
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  let onAbort: (()=>void) | undefined;
  try {
    if(signal?.aborted)return {...out,bodyState:'aborted'};
    // Do not fall back to unbounded response.text().
    reader=response.body?.getReader();if(!reader)return out;
    const aborted=new Promise<{aborted: true}>(resolve=>{onAbort=()=>resolve({aborted:true});signal?.addEventListener('abort',onAbort,{once:true});});
    if(signal?.aborted)onAbort?.();
    const chunks: Buffer[]=[];let bytes=0;
    for(;;){
      const result=await Promise.race([reader.read(),aborted]);
      if('aborted' in result||signal?.aborted)return {...out,bodyState:'aborted'};
      if(result.done)break;
      bytes+=result.value.byteLength;if(bytes>MAX_ERROR_RESPONSE_BYTES)return {...out,bodyState:'too_large'};
      chunks.push(Buffer.from(result.value));
    }
    let data: unknown;try{data=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{return {...out,bodyState:'invalid_json'};}
    return {...out,providerCategory:providerErrorCategory(data),bodyState:'json'};
  }catch{return {...out,bodyState:signal?.aborted?'aborted':'unavailable'};}
  finally {
    if(onAbort)signal?.removeEventListener('abort',onAbort);
    // Cleanup must not make the caller wait on a broken upstream reader.
    try{Promise.resolve(reader?.cancel()).catch(()=>{});}catch{}
  }
}
