import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {assessRevisionPilot,assessRevisionUsability} from '../eval/revision-usability.js';

const attempt = (stage, ui, task, options = {}) => ({
  stage, interface: ui, task, seconds: ui === 'guided' ? 55 : 50,
  score: {outcome: true, continuity: ui === 'guided', voice: true, protectedUnknown: true},
  contradiction: false, ...options
});
const pairs = () => [0,1].flatMap(() =>
  ['a','b'].flatMap(task => ['guided','free'].map(ui => [
    attempt('first', ui, task),
    attempt('second', ui === 'free' ? 'guided' : 'free', task === 'a' ? 'b' : 'a')
  ]))
);

test('balanced paired scores can pass the aggregate decision rule', () => {
  const result = assessRevisionUsability(pairs());
  assert.equal(result.status, 'pass');
  assert.equal(result.wins, 8);
  assert.equal(result.guidedComplete, 8);
  assert.equal(result.medianTimeRatio, 1.1);
});

test('empty, incomplete and order-biased trials cannot pass', () => {
  assert.equal(assessRevisionUsability([]).medianTimeRatio, null);
  assert.equal(assessRevisionUsability(pairs().slice(1)).status, 'insufficient');
  const oneOrder = pairs().filter(([first]) => first.interface === 'guided');
  assert.equal(assessRevisionUsability([...oneOrder, ...oneOrder]).status, 'insufficient');
});

test('a critical contradiction, regression in time or no paired gains blocks a pass', () => {
  for (const mutation of [
    a => ({...a, contradiction:true}),
    a => ({...a, seconds:100}),
    a => ({...a, score:{...a.score, continuity:false}})
  ]) {
    const result = assessRevisionUsability(pairs().map(pair =>
      pair.map(a => a.interface === 'guided' ? mutation(a) : a)
    ));
    assert.equal(result.status, 'revise');
  }
});

test('malformed inputs and repeated tasks are rejected rather than counted', () => {
  const [[first, second]] = pairs();
  assert.throws(() => assessRevisionUsability([[first, {...second, task: first.task}]]));
  assert.throws(() => assessRevisionUsability([[first, {...second, seconds: Number.NaN}]]));
  assert.throws(() => assessRevisionUsability([[first, {...second, score: {outcome: true}}]]));
});

function pilot(mode = 'participants') {
  const cases = pairs();
  const allocation = cases.map(([first], i) => ({
    id: 'p' + String(i + 1).padStart(3, '0'), firstInterface: first.interface, firstTask: first.task
  }));
  const observations = cases.map((attempts, i) => ({
    id: allocation[i].id,
    attempts: attempts.map(({seconds,score,contradiction}) => ({status:'completed',seconds,score,contradiction}))
  }));
  return {mode, allocation, observations};
}

test('every allocated participant contributes to both denominators even when results are missing', () => {
  const input = pilot();
  input.allocation.push({id:'p009',firstInterface:'guided',firstTask:'a'});
  const result = assessRevisionPilot(input);
  assert.equal(result.status,'inconclusive-attrition');
  assert.equal(result.allocated,9);
  assert.equal(result.incompletePairs,1);
  assert.equal(result.arms.guided.assigned,9);
  assert.equal(result.arms.free.assigned,9);
  assert.equal(result.arms.guided.incomplete.unreported,1);
  assert.equal(result.arms.free.incomplete.unreported,1);
  assert.equal(result.paired.wins,8);
  assert.ok(!JSON.stringify(result).includes('p009'));
});

test('guided-only abandonment is distinct from a free-arm technical failure', () => {
  const input = pilot();
  input.observations[0].attempts = [
    {status:'incomplete',reason:'abandoned'},
    {status:'incomplete',reason:'technical'},
  ];
  const result = assessRevisionPilot(input);
  assert.equal(result.status,'inconclusive-attrition');
  assert.equal(result.arms.guided.completed,7);
  assert.equal(result.arms.guided.incomplete.abandoned,1);
  assert.equal(result.arms.free.incomplete.technical,1);
  assert.equal(result.arms.free.incomplete.abandoned,0);
});

test('rehearsals cannot pass even when every synthetic observation is favorable', () => {
  assert.equal(assessRevisionPilot(pilot('rehearsal')).status,'rehearsal-only');
  assert.equal(assessRevisionPilot(pilot()).status,'pass');
  assert.equal(assessRevisionPilot({mode:'participants',allocation:[],observations:[]}).status,'insufficient');
});

test('duplicate, unknown and malformed partial observations fail closed', () => {
  for(const mutate of [
    input=>input.allocation.push(input.allocation[0]),
    input=>input.observations.push(input.observations[0]),
    input=>input.observations[0].id='p999',
    input=>input.observations[0].attempts.pop(),
    input=>input.observations[0].attempts[0]={status:'incomplete',reason:'unreported'},
    input=>{input.observations[0].attempts[1]={status:'incomplete',reason:'timeout'};input.observations[0].attempts[0].seconds=0;},
  ]){
    const input=pilot();
    mutate(input);
    assert.throws(()=>assessRevisionPilot(input),/Invalid pilot/);
  }
});

test('CLI distinguishes real gate pass, incomplete pilot, rehearsal and invalid input', t => {
  const work = mkdtempSync(join(tmpdir(),'nexus-usability-'));
  t.after(()=>rmSync(work,{recursive:true,force:true}));
  const file = join(work,'scores.json');
  const run = input => {
    writeFileSync(file,JSON.stringify(input));
    return spawnSync(process.execPath,['--import','tsx','scripts/score-revision-usability.mjs',file],{encoding:'utf8'});
  };
  const valid = run(pilot());
  assert.equal(valid.status,0,valid.stderr);
  assert.equal(JSON.parse(valid.stdout).status,'pass');
  const rehearsal = run(pilot('rehearsal'));
  assert.equal(rehearsal.status,2,rehearsal.stderr);
  assert.equal(JSON.parse(rehearsal.stdout).status,'rehearsal-only');
  const input = pilot();
  input.observations.pop();
  const incomplete = run(input);
  assert.equal(incomplete.status,2,incomplete.stderr);
  assert.equal(JSON.parse(incomplete.stdout).status,'inconclusive-attrition');
  const invalid = run([]);
  assert.equal(invalid.status,1);
  assert.equal(invalid.stdout,'');
});
