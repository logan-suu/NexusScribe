// Cloud-only Playwright: user-Mac Browser plugin is outside authorized scope.
// Flow: saved draft -> optional brief -> edited preview -> explicit append -> reload.
// Every provider/external request is blocked; no literary-quality conclusion.
import {test,expect} from '@playwright/test';
import {fixture,workspace,PROSE} from '../tests/fixtures/scene-intent.js';
import {KEY} from '../src/storage.js';
const button=(page,name)=>page.getByRole('button',{name,exact:true});
const stored=page=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),KEY);
/** Load fictional stored prose and block every provider or external request for this test. */
async function boot(page,context){
 const calls=[],errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(['warning','error'].includes(m.type()))errors.push(m.text());});
 await context.route('**/*',route=>{
  const url=new URL(route.request().url());
  if(!['localhost','127.0.0.1'].includes(url.hostname)||url.pathname.startsWith('/api/')){calls.push(url.href);return route.abort();}
  return route.continue();
 });
 await page.addInitScript(({key,data})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(data));},{key:KEY,data:workspace(fixture())});
 await page.goto('/');
 await expect(page).toHaveURL('http://127.0.0.1:5173/');
 await expect(page).toHaveTitle('NexusScribe · 雾港来信');
 await expect(page.getByLabel('章节正文',{exact:true})).toBeVisible();
 await expect(page.locator('vite-error-overlay')).toHaveCount(0);
 await page.getByText('整理改稿意见（可选，不调用模型）',{exact:true}).click();
 return {calls,errors};
}
test('preview edits survive field changes; explicit append preserves existing opinion without requests',async({page,context},info)=>{
 const run=await boot(page,context),before=await stored(page);
 await expect(button(page,'生成意见预览 · 不发送')).toBeDisabled();
 await page.getByLabel('改稿意见',{exact:true}).fill('先保留原有意见。');
 await page.getByLabel('这次必须写出的结果',{exact:true}).fill('明确写出信件已交出。');
 await button(page,'生成意见预览 · 不发送').click();
 await page.getByLabel('可编辑的意见预览',{exact:true}).fill('作者修改后的要求。');
 await page.getByLabel('必须保留的声音或细节',{exact:true}).fill('保留犹豫的停顿。');
 await expect(page.getByLabel('可编辑的意见预览',{exact:true})).toHaveValue('作者修改后的要求。');
 await expect(button(page,'重新生成预览 · 替换预览内容')).toBeDisabled();
 await page.getByLabel('可编辑的意见预览',{exact:true}).fill('');
 await expect(page.getByLabel('可编辑的意见预览',{exact:true})).toBeVisible();
 await expect(button(page,'追加到改稿意见 · 保留原有内容')).toBeDisabled();
 await page.getByLabel('可编辑的意见预览',{exact:true}).fill('作者修改后的要求。');
 await button(page,'追加到改稿意见 · 保留原有内容').click();
 await expect(page.getByLabel('改稿意见',{exact:true})).toHaveValue('先保留原有意见。\n\n作者修改后的要求。');
 await expect(button(page,'追加到改稿意见 · 保留原有内容')).toBeDisabled();
 expect((await stored(page)).state.drafts[0].text).toBe(before.state.drafts[0].text);
 expect((await stored(page)).state.drafts[0].revisionProposals).toEqual([]);
 expect((await stored(page)).state.events).toEqual(before.state.events);
 await page.getByLabel('可编辑的意见预览',{exact:true}).scrollIntoViewIfNeeded();
 await page.screenshot({path:info.outputPath('preview.png'),fullPage:false});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await page.reload();
 await expect(page.getByLabel('改稿意见',{exact:true})).toHaveValue('先保留原有意见。\n\n作者修改后的要求。');
 await page.getByText('整理改稿意见（可选，不调用模型）',{exact:true}).click();
 await expect(page.getByLabel('这次必须写出的结果',{exact:true})).toHaveValue('');
 expect(run.calls).toEqual([]);expect(run.errors).toEqual([]);
});
test('temporary brief resets on chapter switch and saved candidate edit; saved instruction remains',async({page,context})=>{
 const run=await boot(page,context);
 await page.getByLabel('改稿意见',{exact:true}).fill('已保存的要求');
 await page.getByLabel('这次必须写出的结果',{exact:true}).fill('未追加的草拟');
 const chapters=page.getByRole('navigation',{name:'章节'}).getByRole('button');
 await chapters.nth(1).click();await chapters.nth(0).click();
 await page.getByText('整理改稿意见（可选，不调用模型）',{exact:true}).click();
 await expect(page.getByLabel('这次必须写出的结果',{exact:true})).toHaveValue('');
 await page.getByLabel('这次必须写出的结果',{exact:true}).fill('仅用于旧正文');
 await button(page,'编辑此稿').click();
 await expect(button(page,'生成意见预览 · 不发送')).toBeDisabled();
 await page.getByLabel('编辑候选稿',{exact:true}).fill(PROSE+'\n作者新的一句。');
 await button(page,'保存候选稿修改').click();
 await page.getByText('整理改稿意见（可选，不调用模型）',{exact:true}).click();
 await expect(page.getByLabel('这次必须写出的结果',{exact:true})).toHaveValue('');
 await expect(page.getByLabel('改稿意见',{exact:true})).toHaveValue('已保存的要求');
 expect(run.calls).toEqual([]);expect(run.errors).toEqual([]);
});
test('duplicate override is one-use, tied to current text, and cannot bypass the length limit',async({page,context},info)=>{
 const run=await boot(page,context);
 const instruction=page.getByLabel('改稿意见',{exact:true});
 await instruction.fill('不要在开头补充背景细节');
 await page.getByLabel('这次必须写出的结果',{exact:true}).fill('补充背景细节');
 await button(page,'生成意见预览 · 不发送').click();
 const preview=page.getByLabel('可编辑的意见预览',{exact:true});
 await preview.fill('补充背景细节');
 const consent=page.getByRole('checkbox',{name:'我已核对，仍要追加这段预览（本次有效）'});
 const append=button(page,'追加到改稿意见 · 保留原有内容');
 await expect(append).toBeDisabled();await consent.check();await expect(append).toBeEnabled();
 await instruction.fill('不要在开头补充背景细节。');await expect(consent).not.toBeChecked();
 await instruction.fill('不要在开头补充背景细节');await expect(append).toBeDisabled();
 await consent.check();await preview.fill('背景细节');await expect(consent).not.toBeChecked();
 await preview.fill('补充背景细节');await expect(append).toBeDisabled();
 await consent.check();await append.click();
 await expect(instruction).toHaveValue('不要在开头补充背景细节\n\n补充背景细节');
 await expect(consent).not.toBeChecked();await expect(append).toBeDisabled();
 await consent.scrollIntoViewIfNeeded();
 await page.screenshot({path:info.outputPath('duplicate-confirmation.png'),fullPage:false});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await instruction.fill('长'.repeat(4000));await preview.fill('长');await consent.check();
 await expect(append).toBeDisabled();await expect(page.getByText('追加后超过 4000 字符，请先精简预览或原有意见；不会截断或覆盖',{exact:true})).toBeVisible();
 expect(run.calls).toEqual([]);expect(run.errors).toEqual([]);
});
