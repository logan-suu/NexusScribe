/** Manual real-browser + real-model journey. No mocks, state writes, traces or raw logs. */
import assert from 'node:assert/strict';
import http from 'node:http';
import {mkdir} from 'node:fs/promises';
import {chromium,expect} from '@playwright/test';
import {createServer as createViteServer} from 'vite';
import {createAgentService} from '../server/provider.js';
import {createHandler} from '../server/index.js';
import {journeyConfig,guardJourney} from './live-journey-guard.mjs';
import {planJourneyMemorySelection} from './journey-memory-selection.mjs';
const fact='小舟的纸灯是蓝色的。';
const boundary='纯虚构温暖童话，无真实人物。每章只写约100字短场景。设定与提纲字段用短句；不要血腥情节。';
let browser,vite,server,phase='setup';
const check=(condition)=>assert.ok(condition,'Journey invariant failed');
const snapshot=s=>JSON.stringify({facts:s.facts,knowledge:s.knowledge,evidence:s.evidence,events:s.events,disclosures:s.disclosures,plans:s.plans});
try {
 const env=journeyConfig(process.env);
 const service=guardJourney(createAgentService({env}),{before(action,input){
  if(action==='generateProse'&&input.chapterIndex>0){
   check(input.context.facts.some(f=>f.label===fact));
   check(input.context.sources.some(s=>s.chapterId==='ch1'&&s.text.includes(fact)));
  }
 }});
 check(service.status().configured);
 server=http.createServer(createHandler(service));
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(8787,'127.0.0.1',resolve)});
 vite=await createViteServer({logLevel:'silent',server:{host:'127.0.0.1',port:5173,strictPort:true}});await vite.listen();
 browser=await chromium.launch();
 const context=await browser.newContext({viewport:{width:1440,height:1000}});
 // Browser can contact only this app; provider traffic originates in the guarded backend.
 await context.route('**/*',route=>{const u=new URL(route.request().url());return u.protocol==='http:'&&u.hostname==='127.0.0.1'&&['5173','8787'].includes(u.port)?route.continue():route.abort()});
 const page=await context.newPage();page.setDefaultTimeout(45000);let errors=0;
 page.on('pageerror',()=>errors++);page.on('console',m=>{if(m.type()==='error')errors++});
 const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('nexusscribe.demo.v1')).state);
 const click=name=>page.getByRole('button',{name,exact:true}).click();
 const call=async(name)=>{
  const [r]=await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname==='/api/agent'),click(name)]);
  check(r.ok()&&!service.stopped);
 };
 const capture=async label=>{await mkdir('live-journey-evidence',{recursive:true});await page.screenshot({path:`live-journey-evidence/${label}.png`,fullPage:false,animations:'disabled'})};
 phase='onboarding';await page.goto('http://127.0.0.1:5173');check((await page.title()).includes('NexusScribe'));
 await click('模型运行方式');await click('检查服务连接');await click('使用真实模型');await click('新建故事');
 await page.getByLabel(/你的故事灵感/).fill('虚构旅人小舟来到纸灯岛，发现灯塔每晚少一层。他用三章短场景寻找原因，每章约100字。');await page.getByLabel(/给故事起个名字/).fill('纸灯岛');await call('聊聊这个故事');
 await page.getByRole('button',{name:'查看故事约定',exact:true}).waitFor();
 const answers={protagonist:'小舟',tone:'温暖好奇',pov:'第三人称限知',goal:'找到灯塔变化的原因',boundaries:boundary};
 for(const field of await page.locator('input[id^="question-"]').all()){const key=(await field.getAttribute('id')).slice(9);check(Object.hasOwn(answers,key));await field.fill(answers[key])}
 await page.getByText('补充主角愿望与创作边界（可选）',{exact:true}).click();await page.locator('#story-goal').fill(answers.goal);await page.locator('#story-boundaries').fill(boundary);
 await call('查看故事约定');await page.getByRole('button',{name:'确认约定，开始创作',exact:true}).waitFor();await capture('01-contract');await click('确认约定，开始创作');
 let initial,settingCommit,afterSetting,selectedMemoryTotal=0;
 for(let i=0;i<3;i++){
  phase=`chapter-${i+1}`;
  if(i)await page.getByRole('navigation',{name:'章节',exact:true}).getByRole('button').nth(i).click();
  const before=await read();await call('生成当前章');await page.getByRole('button',{name:'审查候选稿',exact:true}).waitFor();check(snapshot(await read())===snapshot(before));
  await call('提取候选记忆');check(snapshot(await read())===snapshot(before));
  await call('审查候选稿');await expect.poll(async()=>!!(await read()).drafts.at(-1).modelReview,{timeout:10000}).toBe(true);
  if((await read()).drafts.at(-1).modelReview.issues.some(x=>x.severity==='error')){console.log('review BLOCKED');throw Error('SEMANTIC_REVIEW_BLOCKED')}
  // Each choice uses its visible, candidate-specific control. No model status is overridden.
  const reviewed=await read(),draft=reviewed.drafts.at(-1),selection=planJourneyMemorySelection(reviewed,draft.id);
  for(const choice of selection.decisions)await click(`${choice.action==='keep'?'保留':'拒绝'}候选记忆 ${choice.index+1}：${choice.label}`);
  const decided=await read();check(snapshot(decided)===snapshot(before));
  check(decided.drafts.at(-1).memoryDecisions.length===selection.total);
  check(decided.drafts.at(-1).memoryDecisions.every(choice=>choice.action==='keep'||choice.action==='reject'));
  await expect(page.getByRole('button',{name:'接受此版本',exact:true})).toBeEnabled();await click('接受此版本');
  await expect(page.getByRole('dialog',{name:'确认接受候选稿与已选记忆'})).toContainText(`已选的 ${selection.selected} / ${selection.total} 条记忆`);
  check((await read()).drafts.at(-1).status!=='ACCEPTED');await click('确认接受正文与所选记忆');
  await expect.poll(async()=>(await read()).chapters[i].status).toBe('ACCEPTED');
  check((await read()).events.length===before.events.length+selection.selected);selectedMemoryTotal+=selection.selected;
  console.log(`memory CHAPTER ${i+1} SELECTED ${selection.selected} TOTAL ${selection.total} REJECTED ${selection.rejected}`);
  await capture(`0${i+2}-chapter-${i+1}`);
  if(i===0){
   phase='setting-edit';initial=await read();const body=page.getByLabel('章节正文');await body.fill((await body.inputValue())+'\n'+fact);await call('保存并分析');
   await page.getByLabel(/确认的设定（/).fill(fact);await click('按这条设定准备补丁');check((await read()).facts.length===0);await click('确认并提交状态');
   afterSetting=await read();check(afterSetting.facts.some(f=>f.label===fact));settingCommit=afterSetting.commits.at(-1).id;
  }
 }
 phase='undo';const completed=await read();check(completed.chapters.every(c=>c.status==='ACCEPTED'));assert.deepEqual(service.actions,['interview','planStory','generateProse','extractMemory','reviewChapter','interpretRevision','generateProse','extractMemory','reviewChapter','generateProse','extractMemory','reviewChapter']);
 const textBefore=JSON.stringify(completed.chapters.map(c=>({text:c.text,revisions:c.revisions})));
 await click('版本记录');
 const undo=async id=>page.locator('.history-row').filter({has:page.locator('p').filter({hasText:`${id} ·`})}).getByRole('button',{name:'撤销',exact:true}).click();
 // A setting cannot be silently rewound across subsequent changed event state.
 await undo(settingCommit);check((await read()).commits.length===completed.commits.length);check((await page.getByRole('status').textContent()).includes('后续提交依赖'));console.log('undo DEPENDENCY_BLOCKED');
 // Undo later accepts in reverse order, then the setting, using only visible controls.
 for(const commit of completed.commits.filter(c=>c.version>afterSetting.version).reverse()){await undo(commit.id);check((await read()).commits.some(c=>c.undoes===commit.id))}
 await undo(settingCommit);let undone=await read();check(undone.commits.some(c=>c.undoes===settingCommit));check(snapshot(undone)===snapshot(initial));check(JSON.stringify(undone.chapters.map(c=>({text:c.text,revisions:c.revisions})))===textBefore);
 await capture('05-compensating-history');await page.reload();undone=await read();check(snapshot(undone)===snapshot(initial));check(undone.commits.some(c=>c.undoes===settingCommit));check(errors===0);check(await page.locator('h1').count()>0);check(await page.locator('vite-error-overlay').count()===0);
 console.log(`journey PASS ${service.actions.length} ${completed.chapters.length} ${undone.commits.filter(c=>c.kind==='compensation').length} SELECTED_MEMORY ${selectedMemoryTotal}`);
}catch{console.log(`journey FAIL ${phase}`);process.exitCode=1;}
finally{await browser?.close();await vite?.close();if(server?.listening)await new Promise(resolve=>server.close(resolve));}
