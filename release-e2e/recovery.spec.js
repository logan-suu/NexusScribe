import {test, expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';

const title = '海风里的灯';
const draft = '天色未亮，守灯人把旧钥匙藏进空茶罐。';
const source = 'http://127.0.0.1:4173';
const destination = 'http://127.0.0.1:4174';

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
  await page.getByRole('button', {name:'新建故事'}).click();
  await page.getByLabel(/你的故事灵感/).fill('守灯人收到一封没有寄件人的信。');
  await page.getByLabel(/给故事起个名字/).fill(title);
  await page.getByRole('button', {name:'聊聊这个故事'}).click();
  await page.getByLabel(/谁来经历/).fill('阿遥');
  await page.getByRole('button', {name:'克制而不安'}).click();
  await page.getByRole('button', {name:'查看故事约定'}).click();
  await page.getByRole('button', {name:'确认约定，开始创作'}).click();

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
