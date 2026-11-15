import test from 'node:test';
import assert from 'node:assert/strict';
import {assessRevisionUsability} from '../eval/revision-usability.js';

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
