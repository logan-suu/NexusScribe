import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const read = name => JSON.parse(readFileSync(new URL('../eval/history/multichapter-v1/'+name,import.meta.url),'utf8'));
const sha = value => createHash('sha256').update(value).digest('hex');

test('retained live evidence preserves eight calls, the false positive and the terminal negative',()=>{
 const index=read('artifact-index.json');
 for(const [name,entry] of Object.entries(index.files).filter(([,entry])=>entry.retainedInRepository))assert.equal(sha(readFileSync(new URL('../eval/history/multichapter-v1/'+name,import.meta.url))),entry.sha256,name);
 const diagnostics=read('diagnostics.json');assert.equal(diagnostics.attempts,8);assert.equal(diagnostics.completedStages,8);assert.equal(diagnostics.status,'stopped');assert.equal(diagnostics.validationReason,'UNSUPPORTED_AUDIT');
 assert.equal(diagnostics.usage.totalTokens.knownSum,20438);assert.equal(diagnostics.usage.totalTokens.missingCalls,0);
 const cases=JSON.parse(readFileSync(new URL('../eval/multichapter-counterexamples.json',import.meta.url),'utf8'));
 for(const item of cases){const request=read(`request-${String(item.sequence).padStart(2,'0')}.json`),result=read(`completed-${String(item.sequence).padStart(2,'0')}.json`);assert.equal(item.label,request.input.label);assert.equal(item.sourceQuote,request.input.sourceQuote);assert.deepEqual(item.observed,result.output);}
 assert.equal(cases[0].expectedEntireLabelStatus,'unsupported');assert.equal(cases[0].observed.status,'supported');assert.ok(cases[0].label.includes('第三排'));assert.ok(!cases[0].sourceQuote.includes('第三排'));
 assert.equal(cases[1].observed.status,'unsupported');assert.ok(cases[1].label.includes('阿青'));assert.ok(!cases[1].sourceQuote.includes('阿青'));
 for(const i of [1,5]){const prose=read(`completed-${String(i).padStart(2,'0')}.json`);assert.equal(prose.stats.lengthInRange,false);assert.equal(prose.stats.paragraphsInRange,false);}
});

test('the consumed live protocol cannot be rerun by repeating its old approval flags',()=>{
 const result=spawnSync(process.execPath,['scripts/multichapter-eval.mjs'],{cwd:new URL('..',import.meta.url),encoding:'utf8',env:{PATH:process.env.PATH,GITHUB_ACTIONS:'true',GITHUB_RUN_ATTEMPT:'1',NEXUS_MULTICHAPTER_APPROVED:'true',NEXUS_LIVE_ENABLED:'true',NEXUS_OVERAGE_CONFIRMED_OFF:'true',NEXUS_API_KEY:'OFFLINE_RETIRED_TEST_NOT_A_CREDENTIAL'},timeout:5000});
 assert.equal(result.status,1);assert.equal(result.signal,null);assert.equal(JSON.parse(result.stderr.trim()).code,'PROTOCOL_RETIRED');
 const source=readFileSync(new URL('../scripts/multichapter-eval.mjs',import.meta.url),'utf8');assert.ok(source.includes("if (!offline) throw Object.assign(Error('COMPLETED_PROTOCOL_REQUIRES_NEW_APPROVAL'), {code:'PROTOCOL_RETIRED'});"));
 const ui=readFileSync(new URL('../src/components/DraftPanel.jsx',import.meta.url),'utf8');assert.match(ui,/模型判断：原文支持（可能误判）/);assert.match(ui,/真实测试曾在缺少标签细节时误报支持/);
});
