/** Provider-independent authoring contracts. Template output is explicitly non-AI. */
export const TEMPLATE_PROVIDER = Object.freeze({id:'deterministic-template',label:'确定性模板 · 非 AI 生成',isLive:false});
const clean = (value, fallback='') => typeof value === 'string' && value.trim() ? value.trim() : fallback;
const questionBank = [
  {key:'protagonist',title:'谁来经历这个故事？',hint:'给主角一个名字，也可以补上一句话身份或愿望',placeholder:'例如：许知夏，一位回乡整理遗物的修复师',importance:5},
  {key:'tone',title:'你希望读者最后留下什么感觉？',hint:'情绪会影响开场、人物选择和章节落点',options:['温暖又怅然','克制而不安','明亮、有冒险感'],placeholder:'也可以写自己的情绪方向',importance:4},
  {key:'pov',title:'我们从谁的眼睛看这个故事？',hint:'限知视角只呈现当前人物能知道的事',options:['第三人称限知','第一人称'],importance:3},
  {key:'goal',title:'主角现在最想做到什么？',hint:'一个具体愿望，比提前决定结局更有帮助',placeholder:'例如：找到来信人，弄清母亲没有说出口的事',importance:2},
  {key:'boundaries',title:'有哪些你不希望故事出现的内容？',hint:'可以写不接受的桥段、尺度或设定，也可以暂时留空',placeholder:'例如：不靠失忆解谜；不要突然复活',importance:1},
];
export function getInterviewQuestions(input={}) {
  return questionBank.filter(q=>!clean(input[q.key])).slice(0,2).map(q=>({...q}));
}
export function normalizeAuthoringInput(input={}) {
  return {idea:clean(input.idea),title:clean(input.title,'未命名的故事'),protagonist:clean(input.protagonist,'未命名的旅人'),tone:clean(input.tone,'克制而不安'),pov:clean(input.pov,'第三人称限知'),goal:clean(input.goal,'沿着灵感中的异常，找到一个可以验证的答案'),boundaries:clean(input.boundaries)};
}
export function createStoryContract(input={}) {
  const value=normalizeAuthoringInput(input);
  if(!value.idea) throw new Error('请先写下一句故事灵感');
  const fields=[
    ['premise','故事起点',value.idea,'idea'],['protagonist','主角',value.protagonist,'protagonist'],
    ['emotionalDirection','情绪方向',value.tone,'tone'],['pov','叙述视角',value.pov,'pov'],
    ['desire','主角愿望',value.goal,'goal'],['obstacle','当前阻碍','现有线索不足以支持结论；主角需要采取行动',''],
    ['coreQuestion','核心悬念','这个异常为什么发生，它将如何改变主角？',''],
    ['boundaries','创作边界',value.boundaries||'待定：后续可以随时补充','boundaries'],
    ['opening','首章入口','从灵感中的第一个异常开始，让主角做出一个具体选择',''],
  ].map(([key,label,text,source])=>({key,label,value:text,status:source&&clean(input[source])?'confirmed':key==='boundaries'?'deferred':'proposed',source:source&&clean(input[source])?'user':'template'}));
  return {schemaVersion:1,fields,premise:value.idea,protagonist:value.protagonist,emotionalDirection:value.tone,pov:value.pov,desire:value.goal,boundaries:value.boundaries,unresolved:['结局与最终真相尚未决定'],status:'proposal',provenance:TEMPLATE_PROVIDER};
}
export function createOutline(input={}) {
  const p=normalizeAuthoringInput(input);
  return [
    {id:'chapter-1',title:'异常的起点',goal:`让${p.protagonist}第一次正面遭遇灵感中的异常，并决定追索`,conflict:'想维持原来的生活，却无法忽视眼前的异常',knowledgeDelta:'知道异常确实存在；尚不知道原因',exitState:'做出主动调查的选择',emotionalArc:`平静 → ${p.tone}`},
    {id:'chapter-2',title:'答案的另一面',goal:`围绕“${p.goal}”验证第一条线索，让简单解释受到挑战`,conflict:'线索与最初的判断并不一致',knowledgeDelta:'排除一种解释，发现仍待核实的新可能',exitState:'决定验证新的可能，暂不下定论',emotionalArc:`${p.tone} → 犹疑`},
    {id:'chapter-3',title:'选择的代价',goal:`让${p.protagonist}在接近答案时做出有代价的选择`,conflict:'得到答案和保全重要之物无法同时实现',knowledgeDelta:'当前问题得到局部回应，最终真相仍可由作者决定',exitState:'以主动选择推进下一阶段',emotionalArc:`犹疑 → ${p.tone}`},
  ].map((chapter,index)=>({...chapter,number:index+1,status:'planned',pov:p.pov,scene:{time:`故事第 ${index+1} 个阶段`,location:'沿用故事灵感中的地点（细节待定）',participants:[p.protagonist],allowedReveal:chapter.knowledgeDelta,forbiddenReveal:'未确认的最终真相与视角人物尚未获得的知识',preconditions:index===0?[]:[`chapter-${index} 已接受`]},provenance:TEMPLATE_PROVIDER.id}));
}
export function createProjectConfig(input={}) {
  const p=normalizeAuthoringInput(input);
  const contract=createStoryContract(input);
  return {...p,projectId:clean(input.projectId,`project-${globalThis.crypto?.randomUUID?.()||Date.now().toString(36)}`),outline:createOutline(p),contract,provider:TEMPLATE_PROVIDER.id};
}
/** Inject a live provider implementing this same generateChapter(request) method. */
export function createDeterministicProvider() {
  return { ...TEMPLATE_PROVIDER, async generateChapter({project,chapterIndex=0,context={}}={}) {
    if(!project?.idea) throw new Error('章节生成需要项目灵感');
    if(!Number.isInteger(chapterIndex)||chapterIndex<0||chapterIndex>2) throw new Error('演示模板支持第 1–3 章');
    const p=normalizeAuthoringInput(project), chapter=project.outline?.[chapterIndex]||createOutline(p)[chapterIndex];
    const actor=p.pov==='第一人称'?'我':p.protagonist;
    const inputEcho=`“${p.idea.replace(/[。！？]+$/u,'')}。”`;
    const openings=[`${actor}在心里反复整理那件事，却始终找不到一个能安放它的位置。\n\n${inputEcho}\n\n这不是答案，只是所有问题开始的地方。`,`${actor}把先前的经过重新排了一遍。最容易相信的解释，并没有因此变得更可靠。\n\n${inputEcho}\n\n如今要做的，是找出其中哪一部分能够被证实。`,`${actor}终于明白，继续追问本身也是一种选择。\n\n${inputEcho}\n\n最初令人驻足的异常仍在，但问题已经从“发生了什么”，变成“接下来要怎么做”。`];
    const mood=/温暖|明亮|治愈/.test(p.tone)?'心里仍然留着一小块明亮的地方。即使答案不尽如人意，也还有值得靠近的人和事。':/冒险|热血/.test(p.tone)?'犹豫只停留了一瞬。未知并没有变小，却第一次显得可以穿过。':'那种不安并不锋利，却始终没有散去，像一句停在半途、无人接下去的话。';
    const closing=chapterIndex===0?`${actor}决定先从最确定的一点做起：把亲眼见到的，与自己猜测的分开。那一页上没有结论，只有第一个可以追问的问题。`:chapterIndex===1?`${actor}划去了最初那个过于轻巧的答案。留下的空白需要新的证据，不能只凭愿望补上。下一步的方向，终于比之前清楚了一点。`:`${actor}没有替所有人作出解释。还有些事必须等到当事人愿意开口，有些答案则需要承担后果才能靠近。此刻，能确认的只有接下来的那一步。`;
    const text=`${openings[chapterIndex]}\n\n${mood}\n\n${actor}想要的很清楚：${p.goal}。可越是如此，就越不能把想相信的当成已经发生的。\n\n${closing}`;
    return {text,chapterId:chapter.id,chapterIndex,provider:TEMPLATE_PROVIDER,baseVersion:context.stateVersion??context.version??null,status:'candidate',staging:[{type:'scene-progress',value:chapter.exitState,status:'proposed',source:'deterministic-template'}],reviewNotes:['模板仅演示创作流程，不代表模型生成质量','尚未确认的真相保持待定；草稿接受前不写入正式记忆'],contextUsed:{pov:p.pov,tone:p.tone,boundaries:p.boundaries,sourceIds:context.sourceIds||[]}};
  }};
}
export async function generateChapter(request,provider=createDeterministicProvider()) {
  if(typeof provider?.generateChapter!=='function') throw new Error('生成服务需要实现 generateChapter(request)');
  return provider.generateChapter(request);
}

/** Preserve explicit author inputs when applying a provider's reviewable planning proposal. */
export function mergeStoryPlan(input,output,provider) {
  if(!output?.contract?.fields?.length||!Array.isArray(output?.outline)||output.outline.length!==3)throw new Error('故事规划缺少约定或三章大纲');
  const config=createProjectConfig(input);
  const map={premise:'idea',protagonist:'protagonist',emotionalDirection:'tone',pov:'pov',desire:'goal',boundaries:'boundaries'};
  const fields=output.contract.fields.map(field=>{
    const key=map[field.key],userValue=key&&clean(input[key]);
    if(key&&!userValue&&clean(field.value))config[key]=field.value;
    return {...field,status:userValue?'confirmed':field.status==='deferred'?'deferred':'proposed',source:userValue?'user':provider.id,...(userValue?{value:userValue}:{})};
  });
  const providerMetadata={id:provider.id,label:provider.label,isLive:provider.isLive,...(output.provider&&typeof output.provider==='object'?output.provider:{})};
  const contract={...output.contract,status:'proposal',fields,provenance:{...(output.contract.provenance&&typeof output.contract.provenance==='object'?output.contract.provenance:{}),...providerMetadata}};
  for(const field of fields)contract[field.key]=field.value;
  return {...config,provider:provider.id,providerMetadata,contract,outline:output.outline.map((chapter,index)=>({...chapter,id:chapter.id||`chapter-${index+1}`,number:index+1,status:'planned',provenance:provider.id}))};
}
