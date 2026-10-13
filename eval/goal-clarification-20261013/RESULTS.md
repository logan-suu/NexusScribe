# Fresh goal clarification pilot / 新场景目标澄清试点

## Operational result / 执行结果

The pilot stopped after **three** provider attempts. Attempts1–2 form the archive-handover pair; attempt3 returned complete safe coastal prose with HTTP200 and finish_reason=stop but omitted reasoning_tokens accounting. The frozen guard classified this as BUDGET_UNCERTAIN and retired attempt4 without dispatch. No retry, fallback or extra call occurred. Missing reasoning accounting is **not evidence of nonzero reasoning**. The coastal comparison is unavailable; its retained text is descriptive material, not a valid completed comparison cell.

本轮在第三次调用后按事先约定停止。前两次档案移交场景构成完整对照；第三次虽返回HTTP200和完整正文，但缺少推理token用量字段，触发用量不确定保护。第四次没有发出，剩余额度已作废。缺字段不等于已经发生推理，也不能把未报告当成零。海边场景没有完整对照。

Production baseline remains unchanged. No semantic result is inferred from green tests, fulfilled formatting or workflow failure. Text review results are recorded separately below after masked individual and comparative locks.

## Source and evidence

- Exact executed source506101d1b3c13938ac2e964c2d3028334cdf9010; [successful prerequest PR CI38340489255](https://github.com/logan-suu/NexusScribe/actions/runs/38340489255)
- [Single manual run38341038248](https://github.com/logan-suu/NexusScribe/actions/runs/38341038248): both offline jobs succeeded before live job; live job stopped as specified
- Full frozen inputs, per-pair system delta, all four requests and random neutral IDs: freeze.json
- Global reservation uploaded at03:22:42UTC before provider dispatch; reservation artifact11787285849 ZIP SHA25668bacd71652b1b063d690c1eef8d3f8461e2326b0989ecdc93cdacf617074c58
- Complete safe evidence artifact11787330919 ZIP SHA256c170b83769cd0c10f3ff90b9fb57c65b5c9805976fb265dd6c917bd5d6697ab2
- Both downloaded ZIP digests verified; reservation file bytes match across artifacts; all body/text/freeze hashes verified. No raw provider envelope, credential or arbitrary provider error retained
- Original executable runner/workflow/test/manifest retained as executed-* files; current runner retires before network/credentials and requires explicit nonglobal fake transport in helper tests. Original CI and both old maintenance manifests restored

## Usage, timing and counts

| Attempt | Input | Output | Total | Reasoning reported | Provider time | Han/paragraphs |
|---|---:|---:|---:|---|---:|---|
| 1 archive baseline |1805|399|2204|0|5.175s|448/10|
| 2 archive clarification |1869|440|2309|0|6.151s|519/6|
| 3 coastal clarification, accounting stop |1875|465|2340|not reported|5.316s|542/11|
| Total |5549|1304|6853|unknown aggregate|16.642s|soft targets450–600Han,4–7paragraphs|

The original result.json sums available numeric fields and reports reasoningTokens:0; this is an incomplete aggregate, not verified all-attempt zero. The explicit corrected ledger.json preserves null/unknown for aggregate reasoning while leaving raw retained result.json unchanged. Input/output totals are provider-reported. Monetary cost remains unknown, and reported latency excludes native review, CI, dispatch and artifact handling. Use balance OFF relies on the user's existing confirmation, not a new console check.

字数／段数只作软诊断，不影响保留和评分。总计6853token是已报告输入输出之和；推理用量总计未知。费用没有账单金额，不能据此宣称免费。记录的原始汇总把可用推理字段加为零，修正账本明确说明第三次缺失，原记录未改写。

## Locked native reading / 锁定后的原生模型辅助阅读

Independent masked individual records were locked at b92ac4c41348da3f778533df824b3f53b59d82f8 before any comparative request. The same-scene masked comparison was then locked at e5d98ed2fdb36ed8c05a7e3f3ff175a32bc2dbc6 before this decoded report. These are native model-assisted editorial judgments, **not human evaluation**. Exact text hashes, input pointers and UTF-16 quote offsets accompany each finding; count measurements are separately reproducible.

| Archive dimension | Locked finding | Decoded interpretation |
|---|---|---|
| Observable goal fulfillment | Tie: both deliver all three books, witness checking/signature, return the receipt | No demonstrated clarification advantage |
| Unknown facts and substantive boundaries | Tie: prior letter remains unresolved; no forbidden intervention | Neither confuses unknown prior facts with unfinished requested action |
| Advancement | Tie: handover advances without replaying completed packing | No advantage |
| Causal/object continuity | C-7b1d7bf660ab40d79fc84b144deff647 preferred | Baseline cleaner; clarified ending places box at returned station after saying it will be collected tomorrow |
| Voice and agency | Tie, partial deliberative voice | Both restrained and personally enact task, neither clearly weighs actual replies |
| Soft length/paragraph targets | C-2084e5d763a446e28d2017564eab2cb1 preferred | Clarified519Han/6paragraphs versus baseline448/10; no goal-failure inference |
| Overall editorial reading | Weak preference for C-7b1d7bf660ab40d79fc84b144deff647 | Narrow baseline continuity preference, not a general performance claim |

The third output C-c4dc94f1e75143b480015edcc14b6dfb is coastal clarification prose. Its individual reader finds three transmissions, time recording and unresolved waiting, with protected suspense preserved. Adherence to the signal card is qualified by an explicit timing deviation; four-second intervals conflict with14:07/14:09 entries. Its11paragraphs miss only the soft paragraph target. Because accounting failed and no coastal baseline was sent, this is descriptive defect discovery only; there is **no coastal treatment comparison**.

档案场景两稿均完成全部目标，并保留旧信未知信息。澄清版符合软字数／段数要求，但结尾箱子位置衔接较弱；原版在这一个样本的连贯性上略优。两稿对“回答前斟酌”的刻画都只部分满足。不能据此宣称某提示整体更优。海边澄清稿保住悬念，但出现时间间隔自相矛盾；没有原版对照，只能记录问题。

## Decision and limits / 结论与边界

Keep the production baseline unchanged; do not adopt the appended clarification automatically. One sample per available cell, only one completed pair, no human reader, and potentially easy/ceiling-level explicit goals prevent architecture or reliability conclusions. Both fresh cases specify exitState, so the instruction clause about an unfilled exitState remains untested. The engine-produced unused third planned chapter is identical within each pair and not treated as prior fact. Ordinary invented signal patterns/times are allowed; only contradictions, not invention itself, are faults.

The pilot is retired with zero remaining calls. Any new live replication requires a separately approved bounded experiment. Useful offline next work is to retain these object/time continuity cases in evaluation and distinguish optional prior ambiguity, required future outcomes and explicit suspense without hard-coding the sample prose. This report does not introduce an automatic semantic judge or silently change author intent.

## Verification / 验证

- Pre-dispatch exact-source PR CI and both manual-run offline prerequisites passed
- Independent local safety audit found all461base files unchanged after retirement, including production and prior trials
- Local retirement check passed910tests, offline journeys/UI contracts, typecheck, lint, build and compiled gateway; additional evidence-lock regression checks added afterward
- Final exact-head CI is linked from draft PR38; do not treat historical green runs as covering later commits
- No CodeRabbit review requested for this new PR; draft status retained pending its separate authorization
