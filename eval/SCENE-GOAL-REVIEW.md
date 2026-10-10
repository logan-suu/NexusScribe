# Offline scene-goal review / 离线场景目标评审

## Scope and evidence / 范围与证据

This is an explicit human-review rubric and retrospective calibration, not a product feature, generation instruction, semantic detector, or acceptance gate. It adds no provider call, runner, workflow, authorization, or change to production behavior. The contract validator checks annotation structure and evidence pointers only; a passing test does not establish literary quality, entailment, scene-goal completion, or superiority.

这是供人工复核的显式规则与历史校准，不是产品功能、生成提示、语义检测器或接受门槛。不新增供应商调用、执行器、工作流、授权或生产行为。校验器只检查标注契约和证据定位；测试通过不证明文学质量、语义蕴含、目标达成或质量提升。

- `scene-goal-reviews.json`: new retrospective annotations of retained prose against its **original historical input**; not a replacement for locked judgments
- `scene-goal-counterexamples.json`: labeled synthetic examples that exercise distinctions in this rubric; not new model outputs or independent quality observations
- `scene-goal-synthetic-sources.json`: explicitly synthetic constraint/prose sources for counterexample evidence pointers; not historical source material
- `scene-goal-review.mjs` and `../tests/scene-goal-review.test.js`: offline contract/pointer validation and regression tests; no automatic prose verdict
- Sources: [retired corrected trial results](CAUSAL-QUALITY-20261007-RESULTS.md), [schema-3 fixture provenance](SCHEMA3-CAUSAL-FIXTURES.md), and the exact retained input/output evidence linked by each annotation

历史原文、请求、评价和清单保持不变。新标注另存，不追溯改写旧结论。合成反例只用于验证规则表达和数据契约，不计入真实样本。

The new schema-3 fixtures preserve saved goals but **lack `exitState`**: all nine original outline entries omit it. Keep that absence, including the separate `{status: "missing", value: null}` intent reference. Do not infer or backfill an exit state from goals, prose, later plans, or desired endings. An explicit goal can still impose an obligation. Historical outputs were not generated from these new fixtures; never pair them as if they were, pool them into a new baseline, or treat already-seen F1–F3 as holdouts.

新 schema-3 样例有保存的目标，但九个原大纲条目都缺少 `exitState`。缺失必须保留；不能从目标、原文、后续计划或理想结尾补造。明确目标仍可产生评审义务。旧输出不是这些新输入生成的；不得拼成新基线、合并质量结论或宣称三场是未见留出集。

## Review procedure and statuses / 评审步骤与状态

1. Read the exact input and complete output. Identify the target scene and the source role, revision, speaker, time, and authority of each relevant statement. A later plan is not an event already completed or knowledge already acquired.
2. Extract explicit obligations from saved goals, scene constraints, and applicable continuity/boundary evidence. Decompose compound goals where useful. Do not strengthen a constraint or invent an ideal ending.
3. For every obligation, retain its exact constraint text and source pointer, output evidence pointers where present, one status below, and a short reason connecting evidence to that particular obligation. Review missing fulfillment against the whole output; absence cannot be proved by a conveniently chosen short quote.
4. Record causal ambiguities and plausible alternative readings explicitly. Keep the six dimensions separate; do not turn count compliance, valid quotes, or an aggregate score into acceptance.

先通读准确输入与完整输出，再拆解明确义务。每项保留原约束及定位、相关输出证据及定位、状态与简短理由。缺失判断需检查全文，不能靠局部摘句证明不存在。说明歧义和替代解读；不凭字数、引文有效性或总分自动接受。

| Status | Meaning / 含义 |
| --- | --- |
| `fulfilled` | The required event, choice, state, or boundary is supported at the required time and strength. / 在要求的时点与程度上，有证据支持达成或守住边界。 |
| `partial` | Some required components are supported, but the whole obligation is not fulfilled; name what remains. / 部分成分已实现，完整义务未达成；说明还缺什么。 |
| `missing` | The complete text does not establish the required action or result; a future possibility is insufficient. / 全文未建立要求的行动或结果；将来可能发生不算达成。 |
| `contradicted` | Evidence establishes an incompatible fact, action, or state under the applicable authority and time scope. / 在适用的权威与时间范围内，有证据明确建立不相容的事实、行动或状态。 |
| `uncertain` | Ambiguous staging, attribution, scope, or evidence admits materially different readings. State the gap; do not convert it into a proven contradiction. / 摆位、归属、范围或证据存在实质歧义；指出缺口，不升级为确定矛盾。 |

Use `partial` for a compound obligation with completed components, not as a euphemism for an atomic result that never occurs. An explicit refusal prevents fulfillment of a mutual-agreement obligation, but need not contradict a continuity fact. If a supplied source lacks a value or its authority is unclear, record the limitation instead of manufacturing a testable constraint.

复合义务可以部分达成；原子结果未发生时不能靠换标签掩盖。拒绝不会形成双方约定，但未必构成连续性事实矛盾。来源值缺失或权威不明时记录限制，不补造约束。

## Six dimensions / 六个维度

| Dimension | Review question / 评审问题 |
| --- | --- |
| `goalfulfillment` | Did each explicit goal obligation happen, with the required participants, timing, and degree of commitment? Separate an invitation, intention, or option from a settled result. / 明确目标是否由要求的参与者在要求时点达成？区分邀请、打算、可能性与已落实结果。 |
| `causaltransitions` | Are action → response and state → state changes intelligible from available physical conditions and knowledge? Mark a missing bridge as uncertain when an ordinary omitted action could explain it. / 动作—反应、状态转移是否受物理条件和已知信息支持？普通省略动作可解释的缺桥先标歧义。 |
| `boundaries` | Are explicit prohibitions, Canon, resources, and knowledge limits preserved at their actual scope? Do not promote plans, speculation, or character claims into world facts. / 禁止项、设定、资源和知识边界是否按原范围保持？不将计划、猜测或人物说法升级为世界事实。 |
| `advancement` | Does the scene continue from the retained endpoint and produce relevant change, rather than reset or replay completed exchanges? Economy is useful but is not itself proof of a causal gain. / 是否从已有终点继续并产生相关变化，而非重置或重演？更精练不自动等于因果更好。 |
| `voiceagency` | Does the requested voice survive, with meaningful choices and responses belonging to the characters? Judge actual prose and action, not mere mention of constraints. / 是否保留要求的声音，让人物实际选择与回应？评行动和文字，不数约束关键词。 |
| `countssoft` | Record Han/paragraph target and observation as soft diagnostics. Keep readable outputs even when targets are missed; count misses do not decide goal, quality, or technical validity. / 字数和段数仅作软诊断；超出仍保留可读原文，不据此裁定目标、质量或技术有效性。 |

## Semantic safeguards / 语义护栏

- **Presence is not truth.** An exact quote proves that text occurs at its pointer. It does not prove the quoted proposition, its speaker's knowledge, or its authority. Preserve attribution, negation, questions, hypothetical conditions, and speculative/future modality. “He guessed the sender was X” is not narrator confirmation that X sent it; “she did not know” is not knowledge acquisition.
- **Agreement needs both sides.** A suggestion to return tomorrow, an invitation, a refusal, or “I might not come” does not establish mutual next-day agreement. A future return remains possible without having been agreed in this scene. Do not require a clock time unless the actual obligation does.
- **Mechanism matters.** A broken bell's shell, cord, or nearby metal may make a separate noise that attracts attention. That is not automatically a restored working bell. An ambiguous mechanism is `uncertain`; an explicit normal operation despite the applicable broken-bell fact supports `contradicted`.
- **Resource scope matters.** One broken awl needle does not mean every needle or all tools are unavailable. Distinguish an ordinary hand needle from the broken item. Do not invent a replacement tool or reject an existing resource just to force a verdict.
- **Time and knowledge matter.** A temporary repair now and planned reinforcement tomorrow can coexist. Later plans do not make an absent master learn of a broken needle now. Claims of impossible foot/shoe positioning need stronger evidence than an omitted repositioning step.

引文只证明出现，不证明真相或知情；保留说话者、否定、疑问、假设和推测语气。邀请或拒绝不等于双方约定。坏铃外壳发声不等于铃恢复；一根锥针断了不等于所有工具失效。当前临时修补不因未来加固而变成永久修复；后续计划不授予当前知识。不能把省略的普通动作夸大为物理不可能。

## Retrospective calibration / 历史校准

These assistant-authored annotations are explicitly retrospective and unmasked, using already-known results. They are not a new human-authored or blinded evaluation, additional samples, or an independent replication of the locked reader.

这些由助手编写的标注明确属于已知结果后的非盲回顾，不是新增人工实验或盲评、额外样本或对原评审的独立复现。

- **F1, [locked P1](history/causal-quality-20261007/reading/pair/P1.json):** B was preferred for literary economy. Its concealment motive and stronger receipt inference remain editable ambiguities; neither establishes a robust net causal/continuation improvement. Retain the positive economy finding without upgrading it into substantive B superiority.
- **F2, [locked P3](history/causal-quality-20261007/reading/pair/P3.json):** A's administrator may have prior knowledge; B's broken-bell shell/cord may make noise without restoring the bell. Information-source and mechanism gaps stay uncertain. Neither pair member has a stable demonstrated causal advantage.
- **F3, [locked P2](history/causal-quality-20261007/reading/pair/P2.json):** A's “明天几点？” / “四点以后都在。” establishes the required next-day arrangement in context. B proposes repair tomorrow but ends with “明天我可能不来。” The full goal is not fulfilled: invitation plus possible return is not mutual agreement. This is an unmet obligation, not proof she can never return. Foot/shoe staging remains editable ambiguity; both repairs remain temporary and no material voice/agency regression was established.

F1 保留 B 的精练优势但不夸大因果收益；F2 保留信息来源与发声机制的歧义；F3 的关键是 B 未形成双方明日约定，而非断言永远不会回来。不要改写锁定评价或把软计数不合格变成质量结论。原试验的采用条件未达成；已有六次调用已耗尽，不产生任何新额度。

One disclosed retrospective difference: the locked P3 reader treated F2 B's next-morning arrangement as settled. This new annotation marks the visitors' acceptance `uncertain`: leaving without refusal can imply tacit agreement, but no affirmative response to the proposed time is shown. This more conservative reading does not replace the original judgment or establish a comparative winner.

明确记录一处回顾解释差异：原 P3 把 F2 B 的次晨安排视为落实；新标注认为访客是否接受仍有歧义。未拒绝而离开可暗示默认同意，但没有对所提时间的肯定回应；此保守读法不替换历史评价，也不据此建立胜负。

## Future planning-first versus targeted correction pilot: design only / 后续先规划与定向纠正试点：仅设计

This section proposes a bounded decision to consider later. It is **not approval to run**, does not ask for live approval now, provides no executable prompt or orchestration, and changes no prompt. Keep rubric development, study preregistration, and any separately authorized execution distinct.

本节只是可另行决定的有限研究设计，不是执行授权，现在也不请求在线执行批准；不提供可执行提示或编排、不改提示词。规则开发、研究预注册和另行授权的执行必须分开。

**Concrete allocation: at most FOUR total provider calls, all on one frozen schema-3 F3 input.** This compares two two-call workflows and retains a baseline reference:

| Call | Proposed artifact and dependency / 拟产物与依赖 |
| --- | --- |
| 1 | Fresh baseline prose from the frozen input. / 从冻结输入生成新基线正文。 |
| 2 | Targeted revision of call 1, using the same input plus a human, evidence-grounded review of that baseline under this rubric. / 用相同输入、第一份正文及人工依据证据作出的评审进行定向修订。 |
| 3 | Compact scene plan from the same frozen input, without exposure to calls 1–2 or their feedback. / 从同一冻结输入生成紧凑场景计划，不读取前两次正文或反馈。 |
| 4 | Prose from that input and call 3's plan, without exposure to the correction workflow. / 用原输入与第三次的计划生成正文，不读取纠正流程内容。 |

Calls 1–2 form the **targeted-correction** workflow; calls 3–4 form the **planning-first** workflow. Call 1 also serves as the baseline reference. There are three prose outputs, one plan, and human feedback; there are **not** four independent prose samples. The baseline and its revision are dependent. Human feedback is part of the correction intervention, so any difference compares these complete workflows rather than isolating an architectural effect. Retain all artifacts, including feedback and the plan; score prose, not the plan's promise of success.

第一、二次构成定向纠正；第三、四次构成先规划再写。第一份正文同时作为基线参考。共三份正文、一份计划和人工反馈，并非四份独立正文样本；基线与修订相互依赖。人工反馈属于纠正干预的一部分，差异只能比较完整流程，不能归因于孤立架构效果。保留全部产物，评实际正文而非计划承诺。

Mask the three prose outputs with neutral IDs before scoring, withholding workflow labels, plans, and corrective feedback from the scoring reader. Lock individual rubric reviews before comparative judgment and decoding. The person preparing feedback necessarily sees the baseline; preregister a separate masked scoring reader so this exposure is not misrepresented as blind assessment. No model judge or extra generation is included.

评分前将三份正文匿名编号，向评分者隐藏流程标签、计划和纠正反馈；先锁定逐篇评审，再作比较并解盲。提供反馈的人必然见过基线，须预注册独立盲评者，不能把此类暴露伪装为盲评。不包含模型评审或额外生成。

Before requesting separate execution authorization, freeze these bounded decisions in a new preregistration:

1. **Input and interventions:** retain the exact schema-3 F3 export, its full provider-ready serialization, model/settings, and the missing `exitState`. Freeze the bounded form of the human review, revision intervention, scene plan, and plan-to-prose step. Preserve saved intent and resource limits; the new prose must actually establish agreement, rather than the input falsely asserting it already happened. Do not retrofit historical provenance.
2. **Accounting and safety:** cap all provider attempts at four, including the planning call, with per-call and total token/spending caps and stop conditions. No automatic retries, replacements, extra revision, or model judge. Predefine failure/incomplete handling: dependent steps cannot silently substitute inputs or consume extra calls; fewer usable artifacts may make the comparison inconclusive.
3. **Reading and retention:** freeze dependency isolation, neutral mapping/order, full-artifact retention, individual-before-comparative review, separate reader access, and evidence-pointer conventions. Keep all evaluable prose and soft count misses; retain the exact human feedback as part of the intervention record.
4. **Decision and limits:** predefine the baseline/revised/planned-prose comparisons for the F3 agreement obligation, with temporary-repair, knowledge, voice/agency, and causal constraints assessed separately. Define success, failure, and inconclusive handling before seeing outputs. Report per-output results and plausible alternatives; one already-seen-case pilot cannot support broad adoption, general superiority, or an isolated architecture claim. Fresh holdouts and repeats require a separate later decision and budget.

另行预注册须冻结准确输入与各步干预、四次总上限及失败处理、盲评与保留规则、事先确定的成功／失败／不确定标准。不自动重试，不额外补调用。一个已见场景只支持探索性诊断，不能支持广泛采用或孤立架构优势；未见留出场景与重复生成需要另行决定、另设预算。离线反例和契约测试不支持质量提升声明。
