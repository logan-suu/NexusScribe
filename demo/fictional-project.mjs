// Fictional, deterministic inputs. No provider, network, credentials or real author data.
import {createProjectConfig} from '../src/authoring/index.js';
import {createProjectFromConfig, saveRevision, proposeCustomPatch, commitPatch} from '../src/domain/engine.js';

export const INPUT = Object.freeze({
  projectId:'acceptance-fiction', title:'窗边的信 · 离线验收样例',
  idea:'修表师陆遥收到一封没有署名的信，决定先问清来处，再拆开信封。',
  protagonist:'陆遥', tone:'克制而不安', pov:'第三人称限知',
  goal:'查清是谁把信送到修表铺', boundaries:'不靠失忆解谜；未知信息不得当作已确认事实。',
});
export const MANUAL = '陆遥把未拆封的信放在窗边。雨声盖住了楼下的脚步。\n\n她记下信封上的日期，决定先去问守门人昨夜谁来过。';
export const GENERATED = '陆遥把信放在窗边。她没有拆开信封，读完信纸上的字，才发现没有署名。\n\n她决定去问守门人昨夜谁来过。';
export const REVISION = '陆遥拆开信封，把信纸放在窗边。上面只写着一个日期，没有署名。\n\n她决定去问守门人昨夜谁来过。';
export const AUTHOR_EDIT = '陆遥拆开信封，把信纸压在停走的怀表下。上面只写着一个日期，没有署名。\n\n她决定去问守门人昨夜谁来过。';
export const NEXT = '第二天，陆遥带着那张只写了日期的信纸找到守门人。她把纸放在桌上，先问他昨夜是谁送来的。';
export const CANON = '陆遥从未见过寄信人。';
export const CONFLICT = '陆遥认出寄信人的脸，说：“我们昨天见过。”';
export const workspace = state => ({format:1, serial:0, state, editing:{}, patch:null, providerMode:'template'});
export function demoStart() {
  const s = createProjectFromConfig(createProjectConfig(INPUT));
  return workspace(saveRevision(s, s.chapters[0].id, MANUAL, s.chapters[0].revision));
}
export function demoCanonBlocked() {
  let s = createProjectFromConfig(createProjectConfig({...INPUT, projectId:'acceptance-canon', title:'窗边的信 · 设定阻塞样例'}));
  const id = s.chapters[0].id;
  s = saveRevision(s, id, CANON, s.chapters[0].revision);
  s = commitPatch(s, proposeCustomPatch(s, id, {intent:'author_fact', statement:CANON}));
  s = saveRevision(s, id, CONFLICT, s.chapters[0].revision);
  return workspace(commitPatch(s, proposeCustomPatch(s, id, {intent:'local_prose'})));
}
