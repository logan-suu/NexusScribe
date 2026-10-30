import {MAX_REVISION_INSTRUCTION} from './author-revision.js';

export const BRIEF_FIELDS = [
 ['outcome', '这次必须写出的结果', '例如：明确写出赶上末班车，不只写朝车站走去'],
 ['continuity', '需要修正的衔接或重演', '例如：从已接受前文之后继续，不重演递线的动作'],
 ['preserve', '必须保留的声音或细节', '例如：保留人物说话时的停顿与主动选择'],
 ['unknown', '本次仍不揭晓的事实', '例如：保留失踪者身份未知；不要把本章必须实现的结果填在这里'],
] as const;
export type BriefField = typeof BRIEF_FIELDS[number][0];
export type RevisionBrief = Record<BriefField, string>;
export const emptyRevisionBrief = (): RevisionBrief => ({outcome:'', continuity:'', preserve:'', unknown:''});

/** Author-entered editorial instructions only. No semantic classification or model call. */
export function composeRevisionBrief(brief: RevisionBrief): string {
 return BRIEF_FIELDS.filter(([key]) => brief[key].trim()).map(([key,label]) => `${label}：\n${brief[key].trim()}`).join('\n\n');
}
/** Never truncate or replace an author's existing instruction. */
export function appendRevisionBrief(instruction: string, preview: string): string {
 const addition = preview.trim();
 if (!addition) throw Error('请先填写并生成意见预览');
 if (instruction.includes(addition)) throw Error('这段预览已包含在改稿意见中，无需重复追加');
 const combined = instruction ? `${instruction}\n\n${addition}` : addition;
 if (combined.length > MAX_REVISION_INSTRUCTION) throw Error('追加后超过 4000 字符，请先精简预览或原有意见；不会截断或覆盖');
 return combined;
}
