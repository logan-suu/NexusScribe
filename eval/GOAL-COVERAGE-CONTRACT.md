# Goal coverage: editorial contract / 目标覆盖：编辑评审约定

Offline, assistant-authored calibration only: **12 input–candidate pairs**, not 12
comparative trials, 24 outputs, model observations or a benchmark score. No model
calls, new runner, UI, production prompt or acceptance gate. The sources are
fictional; their labels require editorial review, not keyword matching.

仅为离线、助手编写的校准材料：12组输入—候选正文配对，不是12次对比试验、
24篇输出、模型观测或基准分数。不新增调用、执行器、界面、生产提示或接受门槛。
合成标签须经编辑判断，不能用关键词匹配替代。

## Read in this order / 阅读顺序

1. Separate **requested future outcomes**, **existing story evidence**, and
   **optional/open interpretations**. A goal permits compatible fictional
   development; it neither asserts prior completion nor commits Canon.
2. Read exact saved goal and exitState separately. Missing/empty exitState adds no
   instruction; it does not cancel a goal. Explicitly competing instructions
   require author clarification rather than silently choosing a winner.
3. Read the complete candidate. Record evidence, authority, attribution, time and
   scope. Departure, prediction and sound can support an attempt without
   establishing its result. Absence from the complete candidate is not an exact
   “absence quote”; in current review output explain it in summary as appropriate.
4. Judge each obligation separately using the [existing rubric](SCENE-GOAL-REVIEW.md).
   `missing` is not proof of the opposite event. An explicit incompatible choice
   can be `contradicted` relative to a goal without contradicting prior Canon.
   `uncertain` preserves materially different readings. A fulfilled goal can
   coexist with a contradicted boundary; never reduce them to one pass/fail.

先区分未来要求、既有证据和开放解释。目标不等于既成事实或正式记忆。缺失／空白的
exitState不取消明确目标；明确冲突才需询问作者。通读全文，保留说话者、时点和范围；
出发、预测、声响不自动证明结果。没有某结果不等于相反结果发生，也不能伪造“缺失引文”。
逐项判断目标与边界；明确拒绝可与目标相悖，却未必与旧设定矛盾。

## Packet and added coverage / 材料与新增覆盖

- [Pairs](goal-coverage-pairs.json): exact synthetic inputs and complete candidates,
  stable IDs GC-01–GC-12, explicit changed premises
- [Annotations](goal-coverage-annotations.json): byte hashes, UTF-16 spans, source
  pointers and editorial rationales; no historical-output annotations are replaced
- `tests/goal-coverage-pairs.test.js`: integrity and identity only, reusing the
  existing exact-reference validator; even a wrong semantic label can pass

Existing calibration already covers agreement, ambiguity and resources (including
91 retained-output obligations plus 15 synthetic examples). This small supplement adds the
**future-outcome versus deliberate-suspense/conflicting-intent contrasts**, exact
same departure text under different inputs, and joint reporting of successful
outcome plus forbidden means. It does not duplicate those 91 obligations into a
new score. Agreement and resource examples are short bridge cases to apply that
same distinction, not independent evidence or a replacement rubric.

已有材料涵盖约定、歧义与资源。本补充聚焦：未来结果与故意悬念／冲突意图的区别、
相同出发正文在不同输入下的不同判断，以及目标完成但手段违规的双维度报告。
约定与资源案例用于衔接，不把旧材料复制成新分数，也不作为独立质量证据。

GC-03 adds visible boarding and service identification; GC-04 changes the goal
itself to deliberate suspense; GC-05 adds conflicting instructions. None is a
fact discovered in historical F3. GC-10 permits a different needle under the
limited input, without claiming its earlier existence was established. GC-11 is
conditional future sourcing, not current inventory or a guaranteed future resource.

GC-03新增可见站台和班次识别，GC-04改变目标为留白，GC-05新增冲突意图；均非历史F3
新发现的事实。GC-10不能将一根断针扩展成全部工具不可用，也不证明替代针原本存在。
GC-11只是未来条件计划，不是当前库存或无条件保证。

## Historical anchor and next decision / 历史依据与下一步

The [retained F3 workflow result](scene-workflows-20261010/RESULTS.md) already
received its complete experimental input. The plan left the bus outcome
unconfirmed; the complete prose did not establish boarding. This is a missing
outcome, not proof the bus was missed. PR36 input fidelity cannot explain away
that result. This packet preserves all historical inputs, outputs, locked reviews
and retired allowances byte-for-byte. No prompt improvement is established.

历史F3已收到完整试验输入；未建立上车不等于错过公交。PR36的输入保真修复不能推翻
该结果。本包不改历史输入、输出、锁定评价或已退役额度，不证明提示词改善。

A later experiment may compare the unchanged instruction with one narrow
editorial clarification separating required future outcomes from unknown prior
facts. This is **proposal only**: first freeze input, intervention, budget, separate
masked reading, failure handling and per-obligation decision criteria. Use fresh
cases and retain unfavorable results; this seen synthetic packet is not a holdout.
Obtain a separate bounded execution decision before any provider attempt. Do not
adopt a prompt from integrity-test success or these manually authored examples.

后续可另议一项窄范围提示澄清对照：明确未来要求与未知旧事实的区别。仅为提案，
须先冻结输入、干预、预算、独立盲读、失败处理与逐项标准，并另获有界执行许可。
本合成包已见，不是留出集；测试通过不构成采用新提示的依据。
