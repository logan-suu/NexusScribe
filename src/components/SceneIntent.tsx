import type {getSceneIntentReference} from '../domain/scene-intent.js';
type SceneIntentReference = NonNullable<ReturnType<typeof getSceneIntentReference>>;
const missingLabels = {missing:'未保存此字段', empty:'已保存为空', invalid:'字段格式不支持'};

function IntentValue({label, field}: {label: string; field: SceneIntentReference['goal']}) {
  return <div><dt>{label}</dt><dd aria-label={label}>{field.status === 'present' ? field.value : <span className="muted">{missingLabels[field.status]}</span>}</dd></div>;
}

export default function SceneIntent({reference, editing = false}: {reference?: SceneIntentReference | null; editing?: boolean}) {
  if (!reference) return null;
  const {draft} = reference;
  const generation = draft?.generationIntent;
  const sameFields = generation && (['goal','exitState'] as const).every(key =>
    generation[key].status === reference[key].status && generation[key].value === reference[key].value);
  const contextLabels = {current:'参考上下文与当前已保存状态一致', stale:'参考上下文已过期或不匹配', unavailable:'缺少参考上下文，无法核对'};
  return <section className="scene-intent" aria-label="本章创作意图">
    <h3>本章创作意图 <span>仅供作者对照 · 不调用模型</span></h3>
    <p className="fine">{reference.chapterTitle} · {reference.chapterId} · 已保存正文 r{reference.chapterRevision ?? '未知'}</p>
    <h4>当前已保存大纲</h4>
    <dl className="scene-intent-fields">
      <IntentValue label="章节目标 · goal" field={reference.goal}/>
      <IntentValue label="预期退出状态 · exitState" field={reference.exitState}/>
    </dl>
    <p className="fine" aria-label="创作意图来源">来源位置：当前项目已保存配置 {reference.source ?? '无法唯一定位章节'}，按章节顺序对应 · 大纲 ID：{reference.outlineId ?? '未记录'} · 状态 v{reference.stateVersion} · 意图指纹 {reference.intentHash}</p>
    {draft ? <div className="scene-intent-binding" aria-label="创作意图对照版本">
      <p>对照{draft.archived ? '历史候选' : '已保存候选'} {draft.id} · r{draft.revision} · 正文指纹 {draft.textHash}</p>
      <p>候选基准 v{draft.baseVersion} · 参考上下文 v{draft.contextVersion ?? '未知'} / schema {draft.contextSchemaVersion ?? '未记录'}</p>
      <p className={draft.contextStatus === 'current' ? 'fine' : 'warning'}>{contextLabels[draft.contextStatus]}{draft.archived ? '；历史正文与记录保持不变' : ''}</p>
      {editing ? <p className="warning">候选编辑尚未保存；上述版本仅对应已保存正文。</p> : null}
      {generation ? <div className="scene-intent-request" aria-label="初次生成请求意图">
        <h4>初次生成请求 · r1</h4>
        <dl className="scene-intent-fields">
          <IntentValue label="请求目标 · goal" field={generation.goal}/>
          <IntentValue label="请求退出状态 · exitState" field={generation.exitState}/>
        </dl>
        <p className="fine">请求大纲位置 project.outline[{generation.chapterIndex}] · 目标 {generation.chapterId} · 生成状态 v{generation.stateVersion}</p>
        <p className={sameFields ? 'fine' : 'warning'}>{sameFields ? '这两个字段与当前已保存意图一致' : '这两个字段与当前已保存意图不同；可能来自生成时的默认值或之后的大纲修改'}</p>
        {draft.revision > 1 ? <p className="warning">当前候选已是 r{draft.revision}；此记录只对应初次生成 r1，不代表后续编辑或按意见改稿的指令。</p> : null}
        <p className="fine">记录范围：应用生成入口（真实模式为 App → 网关）的两个字段，并非完整提示词，也不证明模型执行了目标。更新参考上下文不会改写此记录。</p>
      </div> : <p className="fine">{draft.manual ? '手写稿没有模型生成请求。' : ''}本稿未保存准备或生成时的完整大纲快照，无法确认当时使用的 goal / exitState；当前意图仅供对照。更新参考上下文也不会自动改写正文。</p>}
    </div> : <p className="fine">本章尚无候选稿；以上仅是当前保存的大纲。</p>}
    <p className="fine">这是创作方向，与已确认事实、长期伏笔承诺分开。是否在正文中实现，由作者阅读判断；此处不自动判定达成，不改变接受条件。</p>
  </section>;
}
