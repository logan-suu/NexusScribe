/**
 * Revision-local paragraph anchors are owned by the program, never by a model.
 * Keep each nonblank physical line verbatim; offsets are JavaScript UTF-16
 * string offsets, so text.slice(start, end) always returns the exact paragraph.
 */
export interface ProseParagraph {id:string; index:number; start:number; end:number; text:string}
export function segmentProse(text: unknown): ProseParagraph[] {
 if (typeof text !== 'string') throw new TypeError('正文必须是字符串');
 const paragraphs: ProseParagraph[]=[];
 for (const match of text.matchAll(/[^\r\n]+/g)) {
  if (!match[0].trim()) continue;
  const index=paragraphs.length;
  paragraphs.push({id:`p${index+1}`,index,start:match.index,end:match.index+match[0].length,text:match[0]});
 }
 return paragraphs;
}

export const MAX_PROSE_LENGTH=30000;
