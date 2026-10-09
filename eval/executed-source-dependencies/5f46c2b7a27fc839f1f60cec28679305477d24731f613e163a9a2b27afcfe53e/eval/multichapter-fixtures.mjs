/** Frozen wholly synthetic setup. No imports, user manuscript, or generated replacements. */
export const initialFacts = Object.freeze(['许宁的左耳听不见。', '阿青不知道信封里装着一张旧车票。']);
export const addedAuthorFact = '寄存室的铜铃已经损坏，不能发出声音。';
export const project = Object.freeze({
  projectId: 'multichapter-synthetic-v1', title: '雨停前的寄存室',
  idea: '修表师许宁与邻居阿青在旧寄存室查找一封未署名信的来处；他们只能处理眼前的小线索。',
  protagonist: '许宁', pov: '第三人称限知，只跟随许宁', tone: '克制，实物细节，少量干涩幽默',
  goal: '三场连续小戏：发现纸屑，查问管理员，再依据回答安排下一步；寄信人保持未知。',
  boundaries: '每章350–500个汉字，4–7段。只写指定当前场景，接续已接受正文，不重演已发生的对白和动作。许宁说话简短、与实物相关；阿青着急但不咄咄逼人；管理员用办事规矩表达关心。不得写成许宁用左耳听声。阿青不得无来源知道信封中的旧车票，本三章不向他揭露；不得揭晓寄信人，不引入宏大阴谋。对纸屑和锁痕的猜测不能直接成为世界事实。没有获准的开锁动作不得提前成功。保留尚未履行的约定。',
  constraints: ['许宁不能用左耳听见声音', '阿青不知道信封中的旧车票，本三章不得揭露', '寄信人保持未知'],
  outline: [
    { id: 'ch1', title: '柜底的纸', goal: '雨夜发现柜底纸屑并妥善保管；决定次日上午向管理员询问。柜门保持锁着。', scene: '雨夜寄存室；许宁与阿青检查锁柜；先观察再取证；结尾约定次日上午来问管理员。' },
    { id: 'ch2', title: '门边的询问', goal: '次日上午携前章保管的纸屑来问管理员；在门边用符合当前设定的方法招呼他；管理员只确认柜号旧记录明天才能查，三人约明早再来。', scene: '雨后次日上午寄存室门边；管理员出来应门，查看纸屑；不给寄信人答案；许宁继续保管纸屑，柜门仍未打开。' },
    { id: 'ch3', title: '等记录的人', goal: '紧接第二章离开寄存室；依据管理员刚才的回答安排明早查旧记录。许宁与阿青分工准备，纸屑仍有明确保管处；不提前跳到明天或得到记录。', scene: '第二章之后门外檐下；二人讨论刚发生的询问及下一步，用一个实物动作结束，保持未知。' }
  ]
});
export function buildMultichapterFixture() {
  return { project: structuredClone(project), initialFacts: [...initialFacts], addedAuthorFact,
    seedNote: 'The synthetic confirmed project and two author facts are seeded once before the app loads. All generation, memory choices, acceptance, later text editing and fact confirmation use visible UI.',
    firstChapterReference: initialFacts.join('\n') + '\n许宁把未拆开的信封压在修表垫下。阿青等在寄存室门边。' };
}
