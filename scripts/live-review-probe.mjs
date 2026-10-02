/** One synthetic review contract probe, manually dispatched; no raw output retained. */
import {pathToFileURL} from 'node:url';
import {createAgentService,SAFE_VALIDATION_REASONS} from '../server/provider.js';
import {journeyConfig,SAFE_CODES} from './live-journey-guard.mjs';
export async function runReviewProbe({env=process.env,fetchImpl=globalThis.fetch,log=console.log}={}){
 if(env.NEXUS_REVIEW_PROBE_APPROVED!=='true')throw Error('APPROVAL_REQUIRED');
 const service=createAgentService({env:{...journeyConfig(env),NEXUS_MAX_CALLS:'1'},fetchImpl});
 const text='小舟提着蓝色纸灯走到塔下。潮声从石缝间传来，他把纸灯举高，发现墙上有一道浅浅的水痕。他没有猜测失去的楼层去了哪里，只在水痕旁做了记号，决定等退潮后再来查看。';
 const input={text,chapterId:'ch2',context:{projectId:'synthetic-review-probe',version:3,constitution:{title:'纸灯岛',idea:'旅人查找灯塔每晚少一层的原因',protagonist:'小舟',tone:'温暖好奇',pov:'第三人称限知',goal:'查找灯塔变化的原因',boundaries:'纯虚构短篇，不出现真实人物或血腥情节。'},facts:[{id:'f1',label:'小舟的纸灯是蓝色的。',value:'小舟的纸灯是蓝色的。',status:'confirmed'}],knowledge:[],sources:[{chapterId:'ch1',revision:3,text:'小舟来到岛上，看到灯塔比昨天低了一层。小舟的纸灯是蓝色的。'},{chapterId:'ch2',revision:1,text:'【创作规划，尚非生成正文】本章正文等待作者或已配置的模型提供。'},{chapterId:'ch3',revision:1,text:'【创作规划，尚非生成正文】本章正文等待作者或已配置的模型提供。'}]}};
 try{const out=await service.run('reviewChapter',input);const errors=out.issues.filter(i=>i.severity==='error').length;log(`review-probe PASS ${service.status().callsUsed} ${out.issues.length} ${errors}`);return {passed:true,attempts:service.status().callsUsed,issues:out.issues.length,errors};}
 catch(error){const code=SAFE_CODES.has(error?.code)?error.code:'PROBE_FAILED';log(`review-probe ${code} ${service.status().callsUsed}`);if(SAFE_VALIDATION_REASONS.includes(error?.validationReason))log(`validation ${error.validationReason}`);throw Error('Review probe stopped');}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{await runReviewProbe();}catch{process.exitCode=1;}}
