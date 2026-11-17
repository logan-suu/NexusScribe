import {test, expect} from '@playwright/test';

// Rehearses the product mechanics in a clean browser. It is not novice
// study evidence and the offline template is not a continuity-quality test.
test('compiled first-use journey preserves author decisions through Chapter 2', async ({page, context}) => {
  const origin = 'http://127.0.0.1:4173';
  const title = '明天的邮戳';
  const goal = '让主角把信藏在车站的空柜里，等下一位收信人';
  const fact = '铁柜的钥匙只有一把。';
  const firstDraft = '她把信放进站台边的铁柜。';
  const finalText = firstDraft + '\n\n' + fact;
  const errors = [], blocked = [];
  const click = name => page.getByRole('button', {name, exact:true}).click();
  const workspace = () => page.evaluate(() => JSON.parse(localStorage.getItem('nexusscribe.demo.v1')));
  const chapter = n => page.getByRole('navigation',{name:'章节'}).getByRole('button').nth(n - 1);
  page.on('pageerror', error => errors.push(error.message));
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin === origin && !url.pathname.startsWith('/api/')) return route.continue();
    blocked.push(url.href);
    return route.abort();
  });

  await page.goto('/');
  await expect(page).toHaveTitle('NexusScribe · 雾港来信');
  await click('新建故事');
  await page.getByLabel(/你的故事灵感/).fill('一个住户每天收到一封写给明天的信。');
  await page.getByLabel(/给故事起个名字/).fill(title);
  await click('聊聊这个故事');
  await expect(page.getByText('第 1 / 2 问 · 可以留空')).toBeVisible();
  await expect(page.getByLabel(/谁来经历/)).toHaveCount(0);
  await click('温暖又怅然');
  await click('下一问');
  await expect(page.getByLabel(/谁来经历/)).toHaveValue('');
  await click('查看故事约定');
  const boundary = page.locator('label').filter({has:page.getByLabel('创作边界', {exact:true})});
  await expect(boundary).toContainText('待定');
  await page.getByLabel('第1章目标').fill(goal);
  await click('确认约定，开始创作');
  const created = (await workspace()).state;
  expect(created.title).toBe(title);
  expect(created.config.outline[0].goal).toBe(goal);
  expect(created.config.contract.fields.find(field => field.key === 'boundaries').status).toBe('deferred');
  await expect(page.getByLabel('章节目标 · goal')).toHaveText(goal);

  // Compose, reload, then revise. Neither ordinary typing nor staging a
  // proposed update should decide what becomes the accepted version or canon.
  const editor = page.getByLabel('章节正文');
  await editor.fill(firstDraft);
  await page.reload();
  await expect(editor).toHaveValue(firstDraft);
  await editor.fill(finalText);
  await click('作者分类保存 · 不调用模型');
  await click('仅局部表达，不更新设定');
  await click('确认并提交状态');
  await click('准备手写稿 · 不提取记忆');
  await click('审查候选稿');
  await click('接受此版本');
  await expect(page.getByRole('dialog', {name:'确认接受候选稿与已选记忆'})).toBeVisible();
  expect((await workspace()).state.chapters[0].status).not.toBe('ACCEPTED');
  await click('确认接受正文与所选记忆');
  await expect(editor).toHaveValue(finalText);
  const accepted = (await workspace()).state.chapters[0];
  expect(accepted).toMatchObject({status:'ACCEPTED',text:finalText});

  // Select an explicit fact from the unchanged accepted prose. Confirming
  // canon before reviewing a manual draft would require model review.
  await click('作者分类保存 · 不调用模型');
  await page.getByLabel(/确认的设定/).fill(fact);
  await click('按这条设定准备补丁');
  expect((await workspace()).state.facts).toEqual([]);
  await click('确认并提交状态');
  await chapter(2).click();
  await click('生成当前章');
  await expect(page.locator('article.draft .draft-prose')).toBeVisible();
  const after = (await workspace()).state;
  expect(after.projectId).toBe(created.projectId);
  expect(after.chapters[0]).toEqual(accepted);
  expect(after.chapters[1].status).not.toBe('ACCEPTED');
  const candidate = after.drafts.find(draft => draft.chapterId === 'ch2');
  expect(candidate).toMatchObject({status:'DRAFT', provider:'deterministic-template'});
  expect(candidate.context.facts).toContainEqual(expect.objectContaining({label:fact, source:expect.objectContaining({quote:fact, chapterId:'ch1'})}));
  expect(candidate.context.sources).toContainEqual(expect.objectContaining({chapterId:'ch1',role:'accepted_manuscript',text:finalText}));
  await click('故事记忆');
  const memory = page.locator('.full-view').getByRole('button', {name:new RegExp(fact)});
  await expect(memory).toBeVisible();
  await memory.click();
  await expect(page.getByRole('dialog', {name:'来源证据'}).locator('pre')).toContainText(fact);
  expect(errors).toEqual([]);
  expect(blocked).toEqual([]);
});
