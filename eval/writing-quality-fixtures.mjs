import {createProjectFromConfig,proposeCustomPatch,commitPatch,getContext} from '../src/domain/engine.js';
export const protocol={version:2,model:'deepseek-v4.1-flash',temperature:0.7,maxTokens:3000,maxCalls:6,thinking:'disabled',target:'450–600 Chinese characters',seed:null};
export const fixtures=[
 {id:'mystery',title:'雨夜寄存室',idea:'修表师替邻居寻找一封没有署名的信。',protagonist:'程岚',tone:'克制、带一点干涩幽默',pov:'第三人称限知，只跟随程岚',goal:'发现锁柜底下的纸屑，决定次日问管理员，不揭晓寄信人',facts:['程岚的左耳听不见。','阿陶不知道信封里装的是一张旧车票。'],prior:'程岚的左耳听不见。她把右耳转向柜门，还是只听到水管响。阿陶说：“你总得问点什么。”她说：“先问这锁，收费低。”阿陶不知道信封里装的是一张旧车票。程岚没有拆穿，只把信封压在修表垫下。',constraints:['阿陶不能无来源知道车票内容；本场景不向他揭露','不能把左耳听声写成真实感知','寄信人保持未知'],voice:'程岚用简短、实物相关的干涩回应；阿陶着急但不咄咄逼人',scene:'雨夜，寄存室；程岚和阿陶找一只锁柜的钥匙，柜底纸屑提供小线索；结尾决定明早问管理员'},
 {id:'warm-fantasy',title:'炉边借火',idea:'山村的送信员替一只怕冷的小云找到过夜的地方。',protagonist:'米禾',tone:'温暖但不甜腻，有轻微笨拙感',pov:'第三人称限知，只跟随米禾',goal:'借到熄火后的面包炉余温；小云决定留下，暴风雪尚未到来',facts:['小云碰到明火就会缩成雾，不能直接靠近火焰。','米禾答应老板娘天亮前把烤盘擦干净。'],prior:'小云碰到明火就会缩成雾，不能直接靠近火焰。米禾把它从灶口捧回来，围裙湿了一片。“别急，”她说，“我们可以借一点不烫的暖。”米禾答应老板娘天亮前把烤盘擦干净。老板娘敲敲最黑的烤盘：“这个也算。”',constraints:['本场景不能让小云直接接触明火而安然无恙','承诺不能被遗忘、取消或当成已经履行','不引入大战、救世主或新的宏大魔法规则'],voice:'米禾用具体小事安慰；老板娘关心人却用做事规矩表达',scene:'面包店打烊后；米禾和老板娘处理炉子的余温，小云用微小动作表示接受；结尾留下清洗烤盘的活'},
 {id:'slice-of-life',title:'末班车前',idea:'社区修鞋摊的学徒第一次独自守摊，邻居送来一只断带凉鞋。',protagonist:'周小满',tone:'平实、轻微尴尬，感情藏在动作里',pov:'第三人称限知，只跟随周小满',goal:'做出临时修补，让邻居赶上末班车；并约定明天再补牢',facts:['摊上只剩白色线，不能变出黑线。','周小满还没有告诉师傅自己把针折断过一次。'],prior:'摊上只剩白色线，不能变出黑线。周小满把线轴转到缺口朝里，赵姨还是看见了。“白的就白的，鞋底谁看。”周小满还没有告诉师傅自己把针折断过一次。她把那截断针裹进纸里，搁在零钱盒旁。',constraints:['修补只能用现有白线，不凭空出现工具或帮手','师傅不在场，不能突然知道断针的事','不可让临时修补成为无缺陷的永久修复'],voice:'周小满回答容易停顿但不自怜；赵姨实际、体贴，不讲人生大道理',scene:'傍晚社区修鞋摊；末班车快到，周小满修断带；一处动作上的犹豫，结尾约明日再补牢'}
];
export function buildPair(f){
 const project={projectId:`quality-${f.id}`,title:f.title,idea:f.idea,protagonist:f.protagonist,tone:f.tone,pov:f.pov,goal:f.goal,boundaries:`纯虚构。写450–600个汉字的一场戏，4–7段，只写当前场景。人物声音：${f.voice}。${f.constraints.join('；')}。不写评析。`,constraints:f.constraints,outline:[{id:'chapter-1',title:'此前',goal:'仅作参考'},{id:'chapter-2',title:f.title,goal:f.goal,scene:f.scene},{id:'chapter-3',title:'以后',goal:'未来计划，不可当作已发生'}],chapters:[{text:f.prior},{text:'【创作规划，尚非生成正文】'+f.scene},{text:'【创作规划，尚非生成正文】后续发展未定。'}]};
 let state=createProjectFromConfig(project);
 for(const statement of f.facts)state=commitPatch(state,proposeCustomPatch(state,'ch1',{intent:'author_fact',statement}));
 const context=getContext(state);
 // Plain reference text preserves every scalar (including repeated values and metadata).
 // Keeping the same information avoids a deliberately memory-deprived baseline.
 const brief=flatten(context).join('\n');
 const common={project,chapterIndex:1,chapterId:'chapter-2'};
 return {nexus:{...common,context},baseline:{...common,context:{projectId:context.projectId,version:context.version,sources:[],referenceBrief:brief}},brief};
}
export function flatten(x,label='reference',depth=0){
 const prefix=' '.repeat(depth)+label+':';
 if(x===null||typeof x!=='object')return [`${prefix} ${String(x)}`];
 const entries=Object.entries(x);
 return entries.length?[prefix,...entries.flatMap(([k,v])=>flatten(v,k,depth+1))]:[`${prefix} ${Array.isArray(x)?'[]':'{}'}`];
}
