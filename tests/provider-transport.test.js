import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,cp,copyFile,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {getEventListeners} from 'node:events';
import {buildProviderRequest,PROVIDER_USER_AGENT,MAX_ERROR_RESPONSE_BYTES,providerErrorCategory,httpErrorCategory,readProviderError} from '../server/provider-transport.js';
import {createAgentService} from '../server/provider.js';

const endpoint='https://opencode.ai/zen/go/v1/chat/completions';
const key='PUBLIC_FAKE_TRANSPORT_KEY!+/=';
const signal=()=>new AbortController().signal;
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const env={NEXUS_LIVE_ENABLED:'true',NEXUS_OVERAGE_CONFIRMED_OFF:'true',NEXUS_API_BASE_URL:'https://example.test/v1',NEXUS_API_MODEL:'test-model',NEXUS_API_KEY:key};
const input={input:{idea:'离线虚构灯塔'}};
const interview={questions:[{key:'tone',title:'什么情绪？',hint:'选择感觉',placeholder:'温暖'}],summary:'先确定情绪'};
const success=()=>new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify(interview)}}]}));

test('shared builder preserves exact body bytes and established explicit transport contract',async()=>{
  const old=JSON.parse(await readFile(new URL('../eval/history/author-revision-v1/request-01.json',import.meta.url)));
  const deadline=signal(),request=buildProviderRequest({endpoint:old.endpoint,key,body:old.body,signal:deadline});
  assert.equal(request.url,endpoint);assert.equal(request.options.body,old.body);
  assert.deepEqual(Object.keys(request.options).sort(),['body','headers','method','redirect','signal']);
  assert.equal(request.options.method,'POST');assert.equal(request.options.redirect,'error');assert.strictEqual(request.options.signal,deadline);
  assert.deepEqual(Object.keys(request.options.headers).sort(),['Authorization','Content-Type','User-Agent','x-opencode-session']);
  assert.equal(request.options.headers['Content-Type'],'application/json');assert.equal(request.options.headers.Authorization,`Bearer ${key}`);
  assert.equal(request.options.headers['User-Agent'],PROVIDER_USER_AGENT);assert.equal(PROVIDER_USER_AGENT,'NexusScribe-demo/0.1');
  assert.match(request.options.headers['x-opencode-session'],uuid);
  const body=JSON.parse(request.options.body);assert.equal(body.model,'deepseek-v4.1-flash');assert.equal(body.max_tokens,3000);assert.deepEqual(body.thinking,{type:'disabled'});assert.equal(body.temperature,0.7);assert.equal(Object.hasOwn(body,'reasoning_effort'),false);
});

test('independent frozen requests get fresh UUIDs without rewriting settings or messages',async()=>{
  const freeze=JSON.parse(await readFile(new URL('../eval/causal-continuity-requests.json',import.meta.url)));
  const sessions=[];
  for(const item of freeze.requests){
    const body=JSON.stringify(item.body),request=buildProviderRequest({endpoint,key,body,signal:signal()});
    assert.equal(request.options.body,body);assert.deepEqual(JSON.parse(request.options.body),item.body);
    assert.match(request.options.headers['x-opencode-session'],uuid);sessions.push(request.options.headers['x-opencode-session']);
  }
  assert.equal(new Set(sessions).size,6);
});

test('ordinary app session behavior and isolated context/session separation remain unchanged',async()=>{
  const calls=[];const service=createAgentService({env,fetchImpl:async(url,options)=>{calls.push({url,options});return JSON.parse(options.body).messages[1].content.includes('sourceQuote')?new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify({status:'unknown',explanation:'离线占位'})}}]})):success();}});
  await service.run('interview',input);
  await service.run('auditMemoryCandidate',{label:'虚构甲',sourceQuote:'虚构引文甲'});
  await service.run('auditMemoryCandidate',{label:'虚构乙',sourceQuote:'虚构引文乙'});
  await service.run('interview',input);
  const sessions=calls.map(x=>x.options.headers['x-opencode-session']);assert.equal(sessions[0],sessions[3]);assert.equal(new Set(sessions.slice(0,3)).size,3);
  for(const [i,call]of calls.entries()){
    const body=JSON.parse(call.options.body);assert.equal(body.max_tokens,1200);assert.equal(body.model,'test-model');
    assert.equal(Object.hasOwn(body,'temperature'),false);assert.equal(Object.hasOwn(body,'thinking'),false);assert.equal(Object.hasOwn(body,'reasoning_effort'),false);
    assert.equal(call.options.headers['User-Agent'],PROVIDER_USER_AGENT);assert.match(sessions[i],uuid);
    if(i===1||i===2){const own=i===1?'甲':'乙',other=i===1?'乙':'甲';assert.deepEqual(JSON.parse(body.messages[1].content),{label:`虚构${own}`,sourceQuote:`虚构引文${own}`});assert.ok(!call.options.body.includes(`虚构引文${other}`));assert.ok(!call.options.body.includes(input.input.idea));}
  }
});

test('request builder fails closed without leaking invalid credential, endpoint or session',()=>{
  const valid={endpoint,key,body:'{}',signal:signal()};
  for(const patch of [{endpoint:'http://example.test'},{endpoint:'https://u:p@example.test'},{endpoint:'https://example.test/?secret=PRIVATE'},{endpoint:'https://example.test/#PRIVATE'},{endpoint:'PRIVATE'}, {key:'PRIVATE\r\nX: y'},{key:''},{body:{}},{signal:undefined},{sessionId:'PRIVATE'}])assert.throws(()=>buildProviderRequest({...valid,...patch}),e=>e.message==='INVALID_TRANSPORT_REQUEST');
});

test('HTTP categories are bounded observations, with no root-cause inference',()=>{
  for(const [status,expected]of [[400,'invalid_request'],[401,'authentication'],[402,'payment_required'],[403,'permission'],[404,'not_found'],[408,'timeout'],[413,'request_too_large'],[422,'invalid_request'],[429,'rate_limit'],[500,'upstream_unavailable'],[503,'upstream_unavailable'],[504,'timeout'],[307,'unknown'],[200,'unknown'],[600,'unknown'],['400','unknown'],[null,'unknown']])assert.equal(httpErrorCategory(status),expected);
});

test('provider category accepts only exact allowlisted code/type fields; conflicting claims are unknown',()=>{
  for(const [code,category]of [['invalid_api_key','authentication'],['permission_denied','permission'],['insufficient_quota','quota'],['rate_limit_exceeded','rate_limit'],['model_not_found','model_unavailable'],['unsupported_parameter','unsupported_parameter'],['context_length_exceeded','context_limit'],['invalid_request_error','invalid_request'],['server_error','upstream_unavailable']])assert.equal(providerErrorCategory({error:{code,message:key,param:key}}),category);
  assert.equal(providerErrorCategory({error:{type:'authentication_error'}}),'authentication');
  assert.equal(providerErrorCategory({error:{code:'invalid_api_key',type:'server_error'}}),'unknown');
  for(const error of [key,[],null,{code:'__proto__'},{code:'constructor'},{code:{value:'invalid_api_key'}},{code:'INVALID_API_KEY'},{code:'invalid_api_key '+key},{message:'invalid_api_key'},{nested:{code:'invalid_api_key'}}])assert.equal(providerErrorCategory({error}),'unknown');
});

test('error reader returns exactly status and enums, never arbitrary response strings or headers',async()=>{
  const variants=[key,Buffer.from(key).toString('base64'),Buffer.from(key).toString('hex'),encodeURIComponent(key),'PRIVATE_URL','PRIVATE_REASONING','PRIVATE_MANUSCRIPT'];
  const data={error:{code:'unsupported_parameter',message:variants.join(' '),param:key,details:variants},choices:[{message:{content:variants.join(' '),reasoning_content:'PRIVATE_REASONING'}}],request_id:key};
  const deadline=signal();const result=await readProviderError(new Response(JSON.stringify(data),{status:400,headers:{'x-request-id':key}}),{signal:deadline});
  assert.deepEqual(result,{httpStatus:400,httpCategory:'invalid_request',providerCategory:'unsupported_parameter',bodyState:'json'});
  for(const secret of variants)assert.ok(!JSON.stringify(result).includes(secret));
  assert.equal(getEventListeners(deadline,'abort').length,0);
});

for(const [label,text,state]of [['html','<html>PRIVATE</html>','invalid_json'],['malformed','{PRIVATE','invalid_json'],['empty','','invalid_json'],['array','[]','json'],['unknown code',JSON.stringify({error:{code:key}}),'json'],['oversize','x'.repeat(MAX_ERROR_RESPONSE_BYTES+1),'too_large']])test(`error reader safely handles ${label}`,async()=>{
  const result=await readProviderError(new Response(text,{status:400}),{signal:signal()});
  assert.deepEqual(result,{httpStatus:400,httpCategory:'invalid_request',providerCategory:'unknown',bodyState:state});
});

test('error reader never uses unbounded text fallback or lets cancel errors escape',async()=>{
  let textCalls=0;const unavailable=await readProviderError({status:401,text:async()=>{textCalls++;return key;}},{signal:signal()});assert.equal(textCalls,0);assert.equal(unavailable.bodyState,'unavailable');
  const broken={status:500,body:{getReader:()=>({read:async()=>{throw Error(key);},cancel(){throw Error(key);}})}};
  const result=await readProviderError(broken,{signal:signal()});assert.deepEqual(result,{httpStatus:500,httpCategory:'upstream_unavailable',providerCategory:'unknown',bodyState:'unavailable'});
});

test('oversize streamed error cancels promptly and does not drain or classify partial JSON',async()=>{
  let reads=0,cancels=0;const controller=new AbortController();
  const result=await readProviderError({status:400,body:{getReader:()=>({read:async()=>{reads++;return {done:false,value:Buffer.alloc(MAX_ERROR_RESPONSE_BYTES+1)};},cancel(){cancels++;return new Promise(()=>{});}})}},{signal:controller.signal});
  assert.equal(reads,1);assert.equal(cancels,1);assert.equal(result.bodyState,'too_large');assert.equal(result.providerCategory,'unknown');assert.equal(getEventListeners(controller.signal,'abort').length,0);
});

test('stalled error reader aborts with cleanup and ignores late private data',async()=>{
  const controller=new AbortController();let release,cancels=0;
  const pending=readProviderError({status:400,body:{getReader:()=>({read:()=>new Promise(resolve=>{release=resolve;}),cancel:async()=>{cancels++;}})}},{signal:controller.signal});
  controller.abort(key);const result=await pending;assert.equal(result.bodyState,'aborted');assert.equal(result.providerCategory,'unknown');assert.equal(cancels,1);assert.equal(getEventListeners(controller.signal,'abort').length,0);
  release({done:false,value:Buffer.from(JSON.stringify({error:{code:key}}))});assert.ok(!JSON.stringify(result).includes(key));
  assert.equal((await readProviderError(new Response(key,{status:400}),{signal:controller.signal})).bodyState,'aborted');
});

test('app exposes safe non-2xx diagnostics to server caller, consumes one call, never retries',async()=>{
  let calls=0;const service=createAgentService({env:{...env,NEXUS_MAX_CALLS:'1'},fetchImpl:async()=>{calls++;return new Response(JSON.stringify({error:{code:'unsupported_parameter',message:key}}),{status:400});}});
  await assert.rejects(service.run('interview',input),e=>{assert.equal(e.code,'UPSTREAM_ERROR');assert.equal(e.status,502);assert.deepEqual(e.transportDiagnostics,{httpStatus:400,httpCategory:'invalid_request',providerCategory:'unsupported_parameter',bodyState:'json'});assert.ok(!String(e.stack).includes(key));assert.ok(!JSON.stringify(e).includes(key));return true;});
  await assert.rejects(service.run('interview',input),{code:'CALL_LIMIT'});assert.equal(calls,1);
});

for(const cancel of [false,true])test(`app error-body ${cancel?'cancellation':'timeout'} is bounded without retry`,async()=>{
  let calls=0,cancels=0,upstream,started;const ready=new Promise(r=>{started=r;}),controller=new AbortController();
  const service=createAgentService({env,timeoutMs:20,fetchImpl:async(_url,options)=>{calls++;upstream=options.signal;return {ok:false,status:400,body:{getReader:()=>({read:()=>{started();return new Promise(()=>{});},cancel:async()=>{cancels++;}})}};}});
  const pending=service.run('interview',input,{signal:controller.signal});await ready;if(cancel)controller.abort(key);
  await assert.rejects(pending,e=>e.code===(cancel?'REQUEST_CANCELLED':'UPSTREAM_TIMEOUT')&&!JSON.stringify(e).includes(key));
  await new Promise(r=>setImmediate(r));assert.equal(calls,1);assert.equal(cancels,1);assert.equal(upstream.aborted,true);assert.equal(getEventListeners(controller.signal,'abort').length,0);assert.equal(getEventListeners(upstream,'abort').length,0);
});

test('all four current source freezes include and reject a modified transport dependency',async()=>{
  const root=fileURLToPath(new URL('../',import.meta.url)),directory=await mkdtemp(join(tmpdir(),'nexus-transport-freeze-'));
  try{
    for(const path of ['server','src','scripts','eval'])await cp(join(root,path),join(directory,path),{recursive:true});
    for(const path of ['.github','tests'])await cp(join(root,path),join(directory,path),{recursive:true});
    for(const path of ['package.json','package-lock.json','index.html','vite.config.js'])await copyFile(join(root,path),join(directory,path));
    const validators=[];
    for(const [path,name]of [['run-causal-continuity.mjs','loadFrozen'],['run-author-revision-eval.mjs','verifyFrozenManifest'],['isolated-memory-support-eval.mjs','verifyFrozenManifest'],['multichapter-eval.mjs','verifyFrozenManifest']]){
      const module=await import(pathToFileURL(join(directory,'scripts',path)));assert.ok(module.FROZEN_PATHS.includes('server/provider-transport.js'));
      await module[name]();validators.push(module[name]);
    }
    const target=join(directory,'server/provider-transport.js');await writeFile(target,(await readFile(target,'utf8'))+'\n// synthetic mutation\n');
    for(const validate of validators)await assert.rejects(validate());
  }finally{await rm(directory,{recursive:true,force:true});}
});
