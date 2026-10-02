import test from 'node:test';
import assert from 'node:assert/strict';
import {getInterviewQuestions,createProjectConfig,createStoryContract,createOutline,createDeterministicProvider,generateChapter} from '../src/authoring/index.js';
const idea='失去记忆的灯塔管理员发现每一场暴风雨都会带来一位过去的自己';
test('interview asks two important missing fields and does not repeat explicit input',()=>{
  assert.deepEqual(getInterviewQuestions({idea}).map(q=>q.key),['protagonist','tone']);
  assert.deepEqual(getInterviewQuestions({idea,protagonist:'江屿',tone:'温暖',pov:'第一人称'}).map(q=>q.key),['goal','boundaries']);
  assert.equal(getInterviewQuestions({protagonist:'a',tone:'b',pov:'c',goal:'d',boundaries:'e'}).length,0);
});
test('contract marks input as confirmed and separates deferred or proposed facts',()=>{
  const contract=createStoryContract({idea,protagonist:'江屿'});
  assert.equal(contract.fields.find(f=>f.key==='protagonist').status,'confirmed');
  assert.equal(contract.fields.find(f=>f.key==='emotionalDirection').status,'proposed');
  assert.equal(contract.fields.find(f=>f.key==='boundaries').status,'deferred');
  assert.equal(contract.status,'proposal');
  assert.throws(()=>createStoryContract({idea:'  '}),/灵感/);
});
test('config preserves custom project and creates three actionable scene contracts',()=>{
  const config=createProjectConfig({idea,title:'昨日之塔',protagonist:'江屿',pov:'第一人称',tone:'温暖又怅然',projectId:'test-project'});
  assert.equal(config.projectId,'test-project');assert.equal(config.title,'昨日之塔');assert.equal(config.outline.length,3);
  assert.match(config.outline[0].goal,/江屿/);assert.equal(config.outline[0].scene.preconditions.length,0);
  assert.deepEqual(config.outline[1].scene.preconditions,['chapter-1 已接受']);
  assert.ok(config.outline.every(c=>c.scene.forbiddenReveal&&c.knowledgeDelta));
});
test('template provider creates reproducible input-derived candidate prose without committing facts',async()=>{
  const project=createProjectConfig({idea,protagonist:'江屿',pov:'第一人称',tone:'温暖',goal:'找到明天的自己'});
  const provider=createDeterministicProvider();
  const a=await provider.generateChapter({project,chapterIndex:0,context:{stateVersion:4}});
  const b=await generateChapter({project,chapterIndex:0,context:{stateVersion:4}},provider);
  assert.equal(a.text,b.text);assert.ok(a.text.includes(idea));assert.ok(a.text.includes('找到明天的自己'));
  assert.match(a.text,/我在/);assert.equal(a.status,'candidate');assert.equal(a.baseVersion,4);
  assert.equal(a.provider.isLive,false);assert.match(a.provider.label,/非 AI/);assert.ok(a.staging.every(s=>s.status==='proposed'));
  assert.notEqual((await provider.generateChapter({project,chapterIndex:1})).text,a.text);
  await assert.rejects(provider.generateChapter({project,chapterIndex:-1}),/1–3/);
});
test('provider injection allows a live adapter without changing authoring callers',async()=>{
  const adapter={generateChapter:async request=>({text:request.project.idea,provider:{id:'test-adapter'}})};
  assert.equal((await generateChapter({project:{idea}},adapter)).text,idea);
  await assert.rejects(generateChapter({},{}),/generateChapter/);
});
