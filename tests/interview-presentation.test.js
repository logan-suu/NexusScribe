import test from 'node:test';
import assert from 'node:assert/strict';
import {presentInterview} from '../src/authoring/interviewPresentation.js';

const protagonist = {key:'protagonist', title:'Who acts?', options:['A clockmaker']};
const tone = {key:'tone', title:'What feeling remains?', options:['Dread', 'Wonder']};
const goal = {key:'goal', title:'What do they want?'};

test('unanswered tone leads without rewriting provider questions or their options', () => {
  const batch = Object.freeze([protagonist, tone, goal]);
  assert.deepEqual(presentInterview(batch, {tone:'  '}), [tone, protagonist, goal]);
  assert.deepEqual(batch, [protagonist, tone, goal]);
});

test('missing tone gets a clearly labeled template, without dropping other questions', () => {
  const shown = presentInterview([goal, protagonist], {});
  assert.equal(shown[0].key, 'tone');
  assert.match(shown[0].hint, /通用模板问题/);
  assert.ok(shown[0].options.length);
  assert.deepEqual(shown.slice(1), [goal, protagonist]);
  assert.deepEqual(presentInterview([], {}).map(q => q.key), ['tone']);
});

test('known tone is not asked again, including a fully empty batch', () => {
  assert.deepEqual(presentInterview([protagonist, tone, goal], {tone:'Wonder'}), [protagonist, goal]);
  assert.deepEqual(presentInterview([], {tone:'Wonder'}), []);
});
