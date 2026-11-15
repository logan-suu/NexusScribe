import test from 'node:test';
import assert from 'node:assert/strict';
import {createAgentService} from '../server/provider.js';
import {stageProseDraft} from '../src/domain/engine.js';
import {buildControlledContinuity,scope,chapterOne,approved,superseded,notApproved,renderedProse} from '../eval/controlled-continuity-fixture.mjs';

test('controlled continuation sends accepted text and only current Canon over a fake transport', async () => {
  const {accepted,current,pending,input} = buildControlledContinuity();
  assert.equal(accepted.chapters[0].status,'ACCEPTED');
  assert.equal(pending.status,'proposed');
  assert.equal(current.factHistory[0].label,superseded);
  const factSource = current.facts[0].source;
  const sourceChapter = current.chapters.find(chapter=>chapter.id===factSource.chapterId);
  const historical = sourceChapter.revisions.find(revision=>revision.revision===factSource.revision);
  assert.ok(sourceChapter.revision>factSource.revision);
  assert.equal(historical.text.slice(factSource.start,factSource.end),approved);
  assert.equal(factSource.quote,approved);
  assert.equal(current.chapters[0].text,chapterOne);
  const env = {
    NEXUS_OVERAGE_CONFIRMED_OFF:'true', NEXUS_LIVE_ENABLED:'true',
    NEXUS_API_BASE_URL:'https://example.test/v1', NEXUS_API_MODEL:scope.model,
    NEXUS_API_KEY:'OFFLINE_ONLY_NOT_A_CREDENTIAL',
    NEXUS_MAX_CALLS:String(scope.maxCalls), NEXUS_MAX_OUTPUT_TOKENS:String(scope.maxOutputTokens),
    NEXUS_THINKING_MODE:scope.thinkingMode,
  };
  const requests = [];
  const service = createAgentService({env,timeoutMs:scope.timeoutMs,fetchImpl:async (url, options)=>{
    assert.equal(String(url),'https://example.test/v1/chat/completions');
    requests.push(JSON.parse(options.body));
    return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:renderedProse}}]}));
  }});
  const proposal = await service.run(scope.action,input);
  assert.equal(proposal.text,renderedProse);
  assert.equal(proposal.chapterId,'ch2');
  assert.equal(requests.length,1);
  assert.equal(requests[0].model,scope.model);
  assert.equal(requests[0].max_tokens,scope.maxOutputTokens);
  assert.deepEqual(requests[0].thinking,{type:'disabled'});
  const wire = JSON.parse(requests[0].messages[1].content);
  assert.equal(wire.action,scope.action);
  assert.equal(wire.input.chapterId,'ch2');
  assert.equal(wire.input.context.sources.find(source=>source.chapterId==='ch1').text,chapterOne);
  assert.equal(wire.input.context.sources.find(source=>source.chapterId==='ch1').role,'accepted_manuscript');
  assert.deepEqual(wire.input.context.facts.map(({label,recordVersion,authority})=>[label,recordVersion,authority]),
    [[approved,2,'explicit_author_decision']]);
  assert.doesNotMatch(JSON.stringify(wire),new RegExp(superseded));
  assert.deepEqual(wire.input.context.facts[0].source,factSource);
  const planned = wire.input.context.sources.find(source=>source.chapterId==='ch2');
  assert.equal(planned.role,'planned_content');
  assert.equal(planned.text,`【未采纳的构想：${notApproved}】`);
  // Exclude only the one validated authoritative record; no other input, outline,
  // history or prompt text may supply the target color independently.
  const withoutAuthorFact = structuredClone(wire);
  withoutAuthorFact.input.context.facts = [];
  const nonCanonRequest = {...requests[0],messages:requests[0].messages.map(message=>
    message.role==='user' ? {...message,content:JSON.stringify(withoutAuthorFact)} : message)};
  assert.doesNotMatch(JSON.stringify(nonCanonRequest),/蓝|blue/i);
  assert.doesNotMatch(JSON.stringify(wire.input.context.facts),new RegExp(notApproved));
  assert.match(wire.input.project.boundaries,/身份不揭晓/);
  assert.match(wire.input.project.outline[1].exitState,/询问已经发生/);
  const staged = stageProseDraft(current,{...proposal,context:input.context},'ch2');
  assert.equal(staged.drafts.at(-1).text,renderedProse);
  assert.notEqual(staged.chapters[1].status,'ACCEPTED');
  assert.deepEqual(staged.facts,current.facts);
  assert.deepEqual(staged.events,current.events);
  await assert.rejects(service.run(scope.action,input),{code:'CALL_LIMIT'});
  assert.equal(requests.length,1);
});

test('a failed or truncated reply cannot become an accepted chapter or retry past the budget', async () => {
  const {current,input} = buildControlledContinuity();
  const env = {
    NEXUS_OVERAGE_CONFIRMED_OFF:'true',NEXUS_LIVE_ENABLED:'true',
    NEXUS_API_BASE_URL:'https://example.test/v1',NEXUS_API_MODEL:scope.model,
    NEXUS_API_KEY:'OFFLINE_ONLY_NOT_A_CREDENTIAL',NEXUS_MAX_CALLS:'1',
  };
  let requests = 0;
  const service = createAgentService({env,fetchImpl:async ()=>{
    requests++;
    return new Response(JSON.stringify({choices:[{finish_reason:'length',message:{content:renderedProse}}]}));
  }});
  await assert.rejects(service.run(scope.action,input),{code:'OUTPUT_TRUNCATED'});
  await assert.rejects(service.run(scope.action,input),{code:'CALL_LIMIT'});
  assert.equal(requests,1);
  assert.equal(current.chapters[0].status,'ACCEPTED');
  assert.equal(current.chapters[1].status,'PLANNED');
  assert.equal(current.drafts.length,1);
});
