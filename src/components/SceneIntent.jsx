const missingLabels = {missing:'未保存此字段', empty:'已保存为空', invalid:'字段格式不支持'};

function IntentValue({label, field}) {
  return <div><dt>{label}</dt><dd aria-label={label}>{field.status === 'present' ? field.value : <span className="muted">{missingLabels[field.status]}</span>}</dd></div>;
}

export default function SceneIntent({reference, editing = false}) {
  if (!reference) return null;
  const {draft} = reference;
  const contextLabels = {current:'参考上下文与当前已保存状态一致', stale:'参考上下文已过期或不匹配', unavailable:'缺少参考上下文，无法核对'};
  return <section className="scene-intent" aria-label="本章创作意图">
    <h3>本章创作意图 <span>仅供作者对照 · 不调用模型</span></h3>
    <p className="fine">{reference.chapterTitle} · {reference.chapterId} · 已保存正文 r{reference.chapterRevision ?? '未知'}</p>
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
      <p className="fine">本稿未保存准备或生成时的完整大纲快照，无法确认当时使用的 goal / exitState；当前意图仅供对照。更新参考上下文也不会自动改写正文。</p>
    </div> : <p className="fine">本章尚无候选稿；以上仅是当前保存的大纲。</p>}
    <p className="fine">这是创作方向，与已确认事实、长期伏笔承诺分开。是否在正文中实现，由作者阅读判断；此处不自动判定达成，不改变接受条件。</p>
  </section>;
}
