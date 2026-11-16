import {getInterviewQuestions} from './index.js';
import type {AuthoringInput, InterviewQuestion} from './types.js';

export function presentInterview(questions: readonly InterviewQuestion[], input: AuthoringInput) {
  const remaining = questions.filter(question => question.key !== 'tone');
  if (input.tone?.trim()) return remaining;
  const suppliedTone = questions.find(question => question.key === 'tone');
  if (suppliedTone) return [suppliedTone, ...remaining];
  const fallbackTone = getInterviewQuestions({}).find(question => question.key === 'tone');
  return fallbackTone ? [{...fallbackTone, hint: `通用模板问题 · ${fallbackTone.hint}`}, ...remaining] : remaining;
}
