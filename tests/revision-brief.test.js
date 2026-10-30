import test from 'node:test';
import assert from 'node:assert/strict';
import {composeRevisionBrief,appendRevisionBrief,emptyRevisionBrief} from '../src/domain/revision-brief.js';

test('optional brief omits empty fields and preserves author intent without classification',()=>{
 assert.equal(composeRevisionBrief(emptyRevisionBrief()),'');
 const brief={...emptyRevisionBrief(),outcome:'  写明赶上车。  ',unknown:'身份仍未知。'};
 assert.equal(composeRevisionBrief(brief),'这次必须写出的结果：\n写明赶上车。\n\n本次仍不揭晓的事实：\n身份仍未知。');
 assert.equal(brief.outcome,'  写明赶上车。  ');
});
test('append preserves exact existing instruction, rejects duplicates/empty/overflow without truncating',()=>{
 assert.equal(appendRevisionBrief('  已有意见\n','补充'), '  已有意见\n\n\n补充');
 assert.equal(appendRevisionBrief('', '  补充  '),'补充');
 assert.throws(()=>appendRevisionBrief('已有意见','\n '));
 assert.throws(()=>appendRevisionBrief('已有补充','补充'));
 assert.equal(appendRevisionBrief('a'.repeat(3997),'b').length,4000);
 assert.throws(()=>appendRevisionBrief('a'.repeat(3998),'b'),/超过 4000/);
});
