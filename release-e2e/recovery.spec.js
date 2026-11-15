import {test, expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';

const title = '海风里的灯';
const draft = '天色未亮，守灯人把旧钥匙藏进空茶罐。';
const source = 'http://127.0.0.1:4173';
const destination = 'http://127.0.0.1:4174';

async function createStory(page) {
  await page.getByRole('button', {name:'新建故事'}).click();
  await page.getByLabel(/你的故事灵感/).fill('守灯人收到一封没有寄件人的信。');
  await page.getByLabel(/给故事起个名字/).fill(title);
  await page.getByRole('button', {name:'聊聊这个故事'}).click();
  await page.getByLabel(/谁来经历/).fill('阿遥');
  await page.getByRole('button', {name:'克制而不安'}).click();
  await page.getByRole('button', {name:'查看故事约定'}).click();
  await page.getByRole('button', {name:'确认约定，开始创作'}).click();
}

test('compiled app recovers pending manuscript text from an exported backup on a fresh origin', async ({page, context}) => {
  const errors = [];
  const external = [];
  page.on('pageerror', error => errors.push(error.message));
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if ([source, destination].includes(url.origin)) return route.continue();
    external.push(url.origin);
    return route.abort();
  });

  await page.goto('/');
  const status = await page.evaluate(async () => {
    const response = await fetch('/api/status');
    if (!response.ok) throw new Error('Compiled gateway status unavailable');
    return response.json();
  });
  expect(status.liveEnabled).toBe(false);
  await createStory(page);

  const editor = page.getByLabel('章节正文');
  await editor.fill(draft);
  await page.reload();
  await expect(editor).toHaveValue(draft);
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', {name:'导出项目备份'}).click();
  const download = await downloading;
  const raw = await readFile(await download.path());
  const backup = JSON.parse(raw.toString('utf8'));
  expect(backup.state.title).toBe(title);
  expect(Object.values(backup.editing)).toContain(draft);

  await page.goto(destination);
  await expect(page).toHaveTitle('NexusScribe · 雾港来信');
  await expect(editor).not.toHaveValue(draft);

  const upload = buffer => page.getByLabel('导入备份', {exact:true}).setInputFiles({
    name:'fictional-recovery.json',mimeType:'application/json',buffer,
  });
  await upload(Buffer.from('{"format":99}'));
  await expect(page.getByRole('alert')).toContainText('不兼容');
  await page.getByRole('button', {name:'关闭导入错误'}).click();
  await upload(raw);
  await expect(page.getByRole('dialog', {name:'备份导入预览'})).toBeVisible();
  await page.getByRole('button', {name:'确认作为新项目导入'}).click();
  await expect(editor).toHaveValue(draft);
  await page.reload();
  await expect(editor).toHaveValue(draft);

  await page.goto(source);
  await expect(editor).toHaveValue(draft);
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test('compiled app preserves accepted author text and uses it for the next chapter after cross-origin restore', async ({page, context}) => {
  const key = 'nexusscribe.demo.v1';
  const manuscript = '她把信放回窗台。\n\n整个夜晚，她都没有拆开信封。';
  const next = '次日清晨，守灯人带着未拆的信走到码头。';
  const errors = [];
  const unexpected = [];
  const calls = [];
  const state = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)).state, key);
  const click = name => page.getByRole('button', {name,exact:true}).click();
  page.on('pageerror', error => errors.push(error.message));
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if ([source,destination].includes(url.origin) && !url.pathname.startsWith('/api/')) return route.continue();
    unexpected.push(url.href);
    return route.abort();
  });

  await page.goto('/');
  await createStory(page);
  const editor = page.getByLabel('章节正文');
  await editor.fill(manuscript);
  await click('作者分类保存 · 不调用模型');
  await click('仅局部表达，不更新设定');
  await click('确认并提交状态');
  await click('准备手写稿 · 不提取记忆');
  await click('审查候选稿');
  await click('接受此版本');
  await click('确认接受正文与所选记忆');
  const accepted = await state();
  expect(accepted.chapters[0]).toMatchObject({status:'ACCEPTED',text:manuscript});
  expect(accepted.events).toEqual([]);
  await page.reload();
  await expect(editor).toHaveValue(manuscript);

  const [download] = await Promise.all([page.waitForEvent('download'), click('导出项目备份')]);
  const raw = await readFile(await download.path());
  expect(JSON.parse(raw.toString('utf8')).state).toEqual(accepted);
  await page.goto(destination);
  await expect(editor).not.toHaveValue(manuscript);
  await page.getByLabel('导入备份', {exact:true}).setInputFiles({name:'fictional-accepted.json',mimeType:'application/json',buffer:raw});
  await expect(page.getByRole('dialog', {name:'备份导入预览'})).toBeVisible();
  await click('确认作为新项目导入');
  await expect(editor).toHaveValue(manuscript);
  await page.reload();
  await expect(editor).toHaveValue(manuscript);
  const imported = await state();
  expect(imported.projectId).not.toBe(accepted.projectId);
  expect(imported.importOrigin.original.state).toEqual(accepted);
  expect(imported.chapters[0].revisions).toEqual(accepted.chapters[0].revisions);

  await page.route(destination + '/api/status', route => route.fulfill({json:{configured:true,liveEnabled:true,model:'fictional',callsUsed:0,maxCalls:1}}));
  await page.route(destination + '/api/agent', route => {
    const call = route.request().postDataJSON();
    calls.push(call);
    return route.fulfill({json:{output:{text:next,chapterId:'ch2',provider:{id:'compiled-recovery-mock',isLive:true}}}});
  });
  await click('模型运行方式');
  await click('检查服务连接');
  await click('使用真实模型');
  await page.getByRole('navigation', {name:'章节'}).getByRole('button').nth(1).click();
  await click('生成当前章');
  await expect(page.locator('article.draft .draft-prose')).toHaveText(next);
  expect(calls).toHaveLength(1);
  expect(calls[0]).toMatchObject({action:'generateProse',input:{chapterIndex:1,context:{events:[]}}});
  expect(calls[0].input.context.sources).toContainEqual(expect.objectContaining({chapterId:'ch1',text:manuscript,role:'accepted_manuscript'}));
  expect(errors).toEqual([]);
  expect(unexpected).toEqual([]);
});
