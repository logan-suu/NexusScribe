/** One synthetic generation probe with competing old/planned evidence sources. */
import {pathToFileURL} from 'node:url';
import {createAgentService,SAFE_VALIDATION_REASONS} from '../server/provider.js';
import {journeyConfig,SAFE_CODES} from './live-journey-guard.mjs';
export async function runGenerationProbe({env=process.env,fetchImpl=globalThis.fetch,log=console.log}={}){
 if(env.NEXUS_GENERATION_PROBE_APPROVED!=='true')throw Error('APPROVAL_REQUIRED');
 const service=createAgentService({env:{...journeyConfig(env),NEXUS_MAX_CALLS:'1'},fetchImpl});
 const projectId='synthetic-generation-probe';
 const input={project:{projectId,title:'纸灯岛',idea:'小舟来到岛上寻找灯塔每晚少一层的原因。',protagonist:'小舟',tone:'温暖好奇',pov:'第三人称限知',goal:'查找灯塔变化的原因',boundaries:'纯虚构短篇，无真实人物。每章约100字。',outline:[{id:'chapter-1',title:'抵岛',goal:'发现灯塔变矮'},{id:'chapter-2',title:'潮痕',goal:'小舟在塔下观察潮水留下的痕迹，结尾决定等退潮再来，不在本章确认最终原因'},{id:'chapter-3',title:'退潮',goal:'退潮后继续调查'}]},chapterIndex:1,context:{projectId,version:3,facts:[{id:'f1',label:'小舟的纸灯是蓝色的。',value:'小舟的纸灯是蓝色的。',status:'confirmed'}],knowledge:[],sources:[{chapterId:'ch1',revision:3,text:'小舟刚上岸便看见了灯塔。他把旧船票放进衣袋，决定先去码头问路。小舟的纸灯是蓝色的。'},{chapterId:'ch2',revision:1,text:'【创作规划，尚非生成正文】小舟将在灯塔下发现线索。'},{chapterId:'ch3',revision:1,text:'【创作规划，尚非生成正文】退潮后才进一步调查。'}]}};
 try{const out=await service.run('generateChapter',input);const anchoredEvents=out.staging.filter(e=>Number.isInteger(e.sourceParagraphIndex)).length;log(`generation-probe PASS ${service.status().callsUsed} ${out.staging.length} ${anchoredEvents} ${out.reviewNotes.length}`);return {passed:true,attempts:service.status().callsUsed,stagedEvents:out.staging.length,anchoredEvents,reviewNotes:out.reviewNotes.length};}
 catch(error){const code=SAFE_CODES.has(error?.code)?error.code:'PROBE_FAILED';log(`generation-probe ${code} ${service.status().callsUsed}`);if(SAFE_VALIDATION_REASONS.includes(error?.validationReason))log(`validation ${error.validationReason}`);throw Error('Generation probe stopped');}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{await runGenerationProbe();}catch{process.exitCode=1;}}
