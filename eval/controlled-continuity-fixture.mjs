import {acceptDraft, commitPatch, createProjectFromConfig, getContext,
  proposeCustomPatch, reviewDraft, saveRevision, stageManualDraft} from '../src/domain/engine.js';

export const sourceCommit = 'ddbd57be3e9e1fe313d893e88be2568a10b1af14';
export const scope = Object.freeze({model:'deepseek-v4.1-flash', action:'generateProse', maxCalls:1,
  maxOutputTokens:1200, timeoutMs:30000, thinkingMode:'disabled'});
export const chapterOne = '夜潮已落，照岸把未拆的信塞进干燥的上衣口袋。送信人没有留下姓名。\n\n她敲了值班室的门，没人应声。她决定等天亮，步行去北码头问值班员。';
export const superseded = '北码头的指示灯是琥珀色。';
export const approved = '北码头的指示灯是蓝色。';
export const notApproved = '送信人就是值班员。';
export const renderedProse = '天刚亮，照岸走到北码头。她认准蓝色指示灯，沿它照出的入口走到值班亭。\n\n她隔着口袋按住未拆的信，只问值班员昨夜有没有见过来客。';
const config = {
  projectId:'controlled-continuity', title:'潮退之后', idea:'一封没有署名的来信',
  protagonist:'照岸', pov:'第三人称限知', tone:'克制，不解释人物没有见过的事',
  boundaries:'到第二章结束，信封仍未拆，送信人的身份不揭晓。照岸不知道谁送信。',
  outline:[{id:'ch1',title:'退潮',goal:'收到信，决定去北码头'},
    {id:'ch2',title:'北码头',goal:'清晨抵达北码头，以指示灯辨认正确入口，然后询问值班员。',exitState:'询问已经发生；信未拆，身份未揭晓。'}],
  constraints:['信封仍未拆；送信人身份未揭晓；传言不是已确认事实。'],
};

/** Pure fixture assembly. No environment reads, network, persistence or model dispatch. */
export function buildControlledContinuity() {
  const initial = createProjectFromConfig(config);
  const withText = saveRevision(initial,'ch1',chapterOne,initial.chapters[0].revision);
  const local = commitPatch(withText, proposeCustomPatch(withText,'ch1',{intent:'local_prose'}));
  const staged = stageManualDraft(local,'ch1');
  const id = staged.drafts.at(-1).id;
  const accepted = acceptDraft(reviewDraft(staged,id),id);
  const oldText = saveRevision(accepted,'ch2',superseded,accepted.chapters[1].revision);
  const baseline = commitPatch(oldText,proposeCustomPatch(oldText,'ch2',{intent:'author_fact',statement:superseded}));
  const edited = saveRevision(baseline,'ch2',approved+'\n【未采纳的构想：'+notApproved+'】',baseline.chapters[1].revision);
  const amendment = proposeCustomPatch(edited,'ch2',{intent:'author_fact',statement:approved,targetFactId:baseline.facts[0].id});
  const current = commitPatch(edited, amendment);
  const pending = proposeCustomPatch(current,'ch2',{intent:'author_fact',statement:notApproved});
  return {accepted, current, pending, input:{project:structuredClone(config),chapterIndex:1,context:getContext(current)}};
}
