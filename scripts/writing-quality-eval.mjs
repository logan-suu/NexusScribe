/** Opt-in synthetic paired pilot. No retries, judge calls, or provider-body logging. */
import {pathToFileURL} from 'node:url';
import {createHash,randomInt} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {createAgentService,SAFE_VALIDATION_REASONS} from '../server/provider.js';
import {fixtures,buildPair,protocol} from '../eval/writing-quality-fixtures.mjs';
const digest=x=>createHash('sha256').update(x).digest('hex');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const safeCodes=new Set(['NOT_CONFIGURED','INVALID_INPUT','INVALID_MODEL_OUTPUT','UPSTREAM_ERROR','UPSTREAM_TIMEOUT','OUTPUT_TRUNCATED','CALL_LIMIT','RATE_LIMIT','CONCURRENT_LIMIT']);
export function approvedConfig(env){
 if(env.NEXUS_QUALITY_EVAL_APPROVED!=='true'||env.NEXUS_LIVE_ENABLED!=='true'||env.NEXUS_OVERAGE_CONFIRMED_OFF!=='true')throw Error('APPROVAL_REQUIRED');
 return {...env,NEXUS_API_BASE_URL:'https://opencode.ai/zen/go/v1',NEXUS_API_MODEL:protocol.model,NEXUS_THINKING_MODE:'disabled',NEXUS_REASONING_EFFORT:undefined,NEXUS_MAX_CALLS:'6',NEXUS_MAX_OUTPUT_TOKENS:'3000'};
}
function stats(text){const sentences=text.split(/[。！？]/u).map(x=>x.trim()).filter(Boolean);return {characters:[...text].length,hanCharacters:(text.match(/\p{Script=Han}/gu)||[]).length,paragraphs:text.split('\n').length,repeatedExactSentences:sentences.filter((x,i)=>sentences.indexOf(x)!==i).length};}
function safeUsage(data){const result={};for(const k of ['prompt_tokens','completion_tokens','total_tokens'])if(Number.isSafeInteger(data?.usage?.[k])&&data.usage[k]>=0&&data.usage[k]<1e9)result[k]=data.usage[k];return result;}
async function boundedResponse(response){
 if(!response.ok)return {response,usage:{}};
 const reader=response.body?.getReader();if(!reader)throw Error('RESPONSE_BODY');
 const chunks=[];let size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>128*1024)throw Error('RESPONSE_SIZE');chunks.push(value);}}catch(e){await reader.cancel();throw e;}
 const bytes=Buffer.concat(chunks);let usage={};try{usage=safeUsage(JSON.parse(bytes.toString('utf8')));}catch{}
 // Raw response exists only transiently in memory; allowlisted token counts survive.
 return {response:new Response(bytes,{status:response.status}),usage};
}
export async function runQualityEval({env=process.env,fetchImpl=globalThis.fetch,sleep=wait,choose=randomInt,log=console.log,save=async()=>{}}={}){
 const config=approvedConfig(env);let attempts=0,current=null;const calls=[],pairs=[],mapping=[];
 const service=createAgentService({env:config,fetchImpl:async(url,options)=>{
  if(attempts>=6)throw Error('CALL_LIMIT');attempts++;
  const body=JSON.parse(options.body);body.temperature=protocol.temperature;
  const serialized=JSON.stringify(body);
  const record={sequence:attempts,fixture:current.fixture,arm:current.arm,requestSha256:digest(serialized),inputBytes:Buffer.byteLength(serialized),inputCharacters:[...serialized].length,usage:{}};calls.push(record);
  const result=await boundedResponse(await fetchImpl(url,{...options,body:serialized}));record.usage=result.usage;return result.response;
 }});
 const inputs=fixtures.map(f=>({fixture:f.id,...buildPair(f)}));
 // Written before the first request; exact prompts can be reconstructed using provider.js at source SHA.
 await save('inputs.json',{protocol,inputs});
 try{
  for(let i=0;i<fixtures.length;i++){
   const f=fixtures[i],pair=inputs[i],outputs={};
   for(const arm of i%2===0?['baseline','nexus']:['nexus','baseline']){
    if(attempts)await sleep(11000);
    current={fixture:f.id,arm};
    const result=await service.run('generateChapter',pair[arm]);
    outputs[arm]=result.text;calls.at(-1).output=stats(result.text);calls.at(-1).outputSha256=digest(result.text);
    log(`quality-eval completed ${attempts}/6`);
   }
   const first=choose(2)===0?'baseline':'nexus',second=first==='baseline'?'nexus':'baseline';
   pairs.push({id:f.id,brief:{title:f.title,prior:f.prior,scene:f.scene,goal:f.goal,voice:f.voice,constraints:f.constraints,length:protocol.target},A:outputs[first],B:outputs[second]});
   mapping.push({id:f.id,A:first,B:second});
  }
  // Keep method identity and call order away from the blinded reading packet.
  await save('blind-pairs.json',{notice:'Exploratory synthetic paired pilot; not a statistical benchmark. Review before opening mapping or diagnostics.',pairs});
  await save('unblinding.json',{mapping});
  await save('diagnostics.json',{protocol,status:'complete',attempts,calls});
  return {status:'complete',attempts,pairs};
 }catch(error){
  const code=safeCodes.has(error?.code)?error.code:'EVAL_STOPPED';
  await save('diagnostics.json',{protocol,status:'stopped',attempts,code,...(SAFE_VALIDATION_REASONS.includes(error?.validationReason)?{validationReason:error.validationReason}:{}),calls});
  log(`quality-eval stopped ${attempts}/6 ${code}`);throw Error('Quality evaluation stopped; no automatic retry');
 }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const directory='writing-quality-evidence';
 try{await runQualityEval({save:async(name,data)=>{await mkdir(directory,{recursive:true});await writeFile(`${directory}/${name}`,JSON.stringify(data,null,2)+'\n',{flag:'wx'});}});}catch{process.exitCode=1;}
}
