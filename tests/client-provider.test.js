import test from 'node:test';
import assert from 'node:assert/strict';
import {createServerProvider,createTemplateAdapter,CAPABILITIES} from '../src/adapters/provider.js';
import {mergeStoryPlan,createProjectConfig} from '../src/authoring/index.js';
const response=output=>({ok:true,status:200,json:async()=>({output})});
test('server provider routes all five actions through same-origin without credentials',async()=>{
 const calls=[];const outputs={interview:{questions:[{key:'tone',title:'你希望是什么情绪？'}]},planStory:createProjectConfig({idea:'海上的城堡'}),generateChapter:{text:'新的章节',staging:[]},interpretRevision:{suggestedFacts:[],questions:[]},reviewChapter:{issues:[]}};
 const provider=createServerProvider({fetchImpl:async(url,options)=>{const body=JSON.parse(options.body);calls.push({url,options,body});return response(outputs[body.action]);}});
 for(const action of CAPABILITIES){const result=await provider[action]({input:{idea:'海上的城堡'},context:{stateVersion:8}});assert.ok(result);}
 assert.equal(calls.length,5);assert.ok(calls.every(c=>c.url==='/api/agent'));
 assert.deepEqual(calls.map(c=>c.body.action),CAPABILITIES);
 assert.equal(calls[0].body.input.input.idea,'海上的城堡');assert.ok(calls.every(c=>!c.options.headers.Authorization));
});
test('generation always remains candidate and retains runtime version',async()=>{
 const provider=createServerProvider({fetchImpl:async()=>response({text:'章节',status:'accepted',baseVersion:999,provider:{id:'openai-compatible',model:'configured-test-model'}})});
 const result=await provider.generateChapter({context:{stateVersion:8}});
 assert.equal(result.status,'candidate');assert.equal(result.baseVersion,8);assert.equal(result.provider.isLive,true);assert.equal(result.provider.model,'configured-test-model');
});
test('unavailable server errors reject without silent template output',async()=>{
 let calls=0;
 const provider=createServerProvider({fetchImpl:async()=>{calls++;return {ok:false,status:503,json:async()=>({error:{message:'未配置服务端模型'}})};}});
 await assert.rejects(provider.interview({input:{idea:'故事'}}),/未配置/);assert.equal(calls,1);
 const malformed=createServerProvider({fetchImpl:async()=>response({text:''})});
 await assert.rejects(malformed.generateChapter({}),/正文/);
 const wrongSchema=createServerProvider({fetchImpl:async()=>response({questions:[{key:'constructor',title:'bad'}]})});
 await assert.rejects(wrongSchema.interview({}),/格式/);
 assert.throws(()=>createServerProvider({baseUrl:'https://untrusted.example'}),/同源/);
});
test('status can be checked without requesting model output',async()=>{
 const provider=createServerProvider({fetchImpl:async(url,options)=>{assert.equal(url,'/api/status');assert.equal(options.method,'GET');return {ok:true,status:200,json:async()=>({configured:false,model:null})};}});
 assert.equal((await provider.getStatus()).configured,false);
});
test('story plan retains explicit author inputs and marks new model facts as proposals',()=>{
 const input={projectId:'chosen-id',idea:'我的故事',title:'我的书名',protagonist:'阿岚',tone:'温暖',pov:'第一人称'};
 const output=createProjectConfig({idea:'模型的故事',protagonist:'另一个名字',tone:'悲伤',goal:'找到出口'});
 const merged=mergeStoryPlan(input,output,{id:'server-model',label:'服务端模型',isLive:true});
 assert.equal(merged.idea,input.idea);assert.equal(merged.title,input.title);assert.equal(merged.projectId,input.projectId);
 assert.equal(merged.protagonist,'阿岚');assert.equal(merged.goal,'找到出口');assert.equal(merged.provider,'server-model');
 assert.equal(merged.contract.fields.find(f=>f.key==='protagonist').value,'阿岚');
 assert.equal(merged.contract.fields.find(f=>f.key==='desire').status,'proposed');
 assert.equal(merged.contract.provenance.isLive,true);
});
test('template adapter continues to support the same workflow',async()=>{
 const provider=createTemplateAdapter();const input={idea:'海上的城堡'};
 assert.equal((await provider.interview({input})).questions.length,2);
 const plan=await provider.planStory({input});assert.equal(plan.outline.length,3);
 assert.equal((await provider.generateChapter({project:plan})).provider.isLive,false);
});
