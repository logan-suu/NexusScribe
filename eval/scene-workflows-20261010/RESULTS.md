# F3 workflow pilot results / F3 写作流程试点结果

## Decision / 结论

**Keep the production baseline. Neither tested workflow completed every explicit scene goal in this single case.** Both targeted revision and planning-first prose made the next-day reinforcement agreement clearer, but all three texts left catching the last bus unestablished and replayed already accepted material. This is a useful failure diagnosis, not evidence that either architecture is generally better or worse.

**保留正式基线，不据此切换流程。** 定向修订和先规划再写都把“双方约定明日补牢”写得更明确，但三份正文都没有建立“赶上末班车”这一明确目标，也都重演了已接受前文。没写明赶上，不代表已经证明没赶上。一次已见合成场景只支持诊断，不能证明通用架构优劣。

The four separately approved provider attempts all returned HTTP 200 with `finish_reason: stop`, no retry and zero reported reasoning tokens. All outputs were retained, including soft length misses. The allowance is consumed and retired: the branch live job was removed, CLI returns `RETIRED` before credential/network access, and the remaining transport helper requires explicit nonglobal-function injection; retained tests use fakes.

## Scope and method / 范围与方法

- One frozen current schema-3 F3 fixture, with `chapterId: ch2` injected as the gateway does. `exitState` remains missing; no invented ending or historical provenance
- Calls 1–2: fresh baseline, then targeted revision using exact baseline plus six-item native editorial feedback
- Calls 3–4: isolated compact plan, then prose using original input plus the exact unedited plan. Neither provider request received baseline, revision or corrective feedback
- Three prose outputs and one plan; baseline/revision are dependent. Native assistant feedback is an explicit intervention, not human participant data or isolated architecture control
- Separate fresh native scoring reader received only neutral-ID prose/input packets and rubric. It reviewed in frozen lexical ID order without repository/history/mapping access, then locked individual reviews before comparison and decoding
- Individual locks were committed at [477dc600](https://github.com/logan-suu/NexusScribe/commit/477dc600c142230d6fd75d62336f84a5fe890bb5); comparative lock at [e16b9db7](https://github.com/logan-suu/NexusScribe/commit/e16b9db787f05cdfa50665610138221b23aa8b15). 102 individual and 53 comparative evidence quotes have exact UTF-16 pointers. Quote validity proves textual presence, not semantic truth

本次是匿名标签下的原生助手评审，不是人工盲测或独立人类实验。反馈者看过基线；评分者另起、未见反馈或流程标签。计划和反馈、完整输入与输出、请求和消耗账本全部保留。字数与段数仅作软诊断。

## Decoded results / 解盲结果

| Output | Neutral ID suffix | Temporary repair | Mutual tomorrow agreement | Catching last bus | Han / paragraphs |
| --- | --- | --- | --- | --- | --- |
| Baseline, call 1 | `5eec…45afc` | fulfilled | uncertain | missing from text | 553 / 16 |
| Targeted revision, call 2 | `5817…f75d3` | fulfilled | fulfilled | missing from text | 436 / 8 |
| Planning-first prose, call 4 | `f2bb…ceb27` | fulfilled | fulfilled | missing from text | 546 / 6 |

Soft targets were 450–600 Han and 4–7 paragraphs. Only planning-first prose meets both; that does not establish full goal completion or overall superiority.

### What changed / 实际变化

1. **Tomorrow agreement:** baseline's “行，赶得上” may accept the repair or the whole proposal; the reader retained that uncertainty. Revision adds “明天这个点，我拿来，你别嫌烦” and an answer. Planned prose says Zhao agrees to bring it tomorrow. Both interventions improve explicit support for this obligation
2. **Bus outcome remains absent:** baseline ends with departure around a corner; revision adds distant braking and restarting; planned prose sends Zhao toward the stop. None establishes boarding or reaching the last bus in time. Sound, a forecast or an intention is not itself proof of the required result
3. **Continuation remains weak:** all repeat the prior white-thread exchange; planning-first also restarts Zhao's arrival. A scene plan did not prevent replay; corrective feedback did not fully remove it
4. **Voice and agency:** the targeted revision less clearly realizes the requested halting spoken replies, although hesitation remains in action and practical choices survive. Planned prose preserves explicit pauses. No wholesale agency loss or proven hard-boundary regression was established
5. **Resource/knowledge scope:** all repairs remain temporary. A normal hand needle need not be the earlier broken needle. Tool provenance gaps stay uncertain. Baseline's future black-thread promise and Zhao's claimed earlier needle sighting are not proof of current black-thread supply or the absent master's knowledge

目标表达更明确是局部收益，不能抵消赶车结果缺失和前文重演。定向修订还削弱了部分口头停顿；先规划的字数段数更符合要求，但这些都不足以判定总体胜出。所有歧义和替代解读保留在锁定评审中。

### Plan diagnostic, inspected after locked scoring / 解盲后计划诊断

The exact call-3 plan explicitly says “赵姨是否真赶上末班车，本场不确认。” It treated a required goal as an unresolved issue. Call 4 received the unchanged plan under a system instruction making it subordinate to original input, but still did not establish the outcome. This identifies a concrete candidate failure mechanism; one observation does not prove the plan caused the omission. Baseline and revision also omit it.

第三次计划把原本要求达成的“赶上末班车”列成“本场不确认”的模糊项。这提示后续应检查计划有没有把硬性创作目标降成可选项；但本次没有因果隔离，不能断言遗漏全由计划造成。计划保持原样，没有为了让结果更好而偷偷修正或追加调用。

## Usage and timing / 用量与耗时

| Call | Artifact | Input tokens | Output tokens | Total | Provider elapsed |
| --- | --- | ---: | ---: | ---: | ---: |
| 1 | Baseline prose | 1,998 | 531 | 2,529 | 5.433 s |
| 2 | Targeted revision | 3,394 | 413 | 3,807 | 3.565 s |
| 3 | Compact plan | 1,999 | 444 | 2,443 | 4.896 s |
| 4 | Planned prose | 2,525 | 512 | 3,037 | 5.379 s |
| Total | Four attempts | 9,916 | 1,900 | 11,816 | 19.273 s |

Targeted-correction workflow totals 6,336 tokens and 8.998 s provider time; planning-first totals 5,480 tokens and 10.275 s provider time. These exclude native editorial/scoring work, CI, dispatch and retention, and are not production end-to-end latency or a stable cost comparison. Monetary cost is **unknown** because no billing amount was supplied. Output ceilings (3,000/3,000/800/3,000; total 9,800) are not dollar or input-token caps. Use balance OFF is based on the user's existing confirmation, not a refreshed console observation. No purchase, upgrade, fallback model or new credential was used.

## Evidence and verification / 证据与核验

- [Preregistered protocol](PROTOCOL.md), [frozen input/settings/templates/mapping](freeze.json), [feedback](feedback.json), [consumed ledger](ledger.json), [decoded outcome](decoded-outcome.json)
- Exact stage sources and successful runs:
  - [Call 1 / run 38082772859](https://github.com/logan-suu/NexusScribe/actions/runs/38082772859), source `93ed0eb353ed87492f954a0037fa69f038e9ecb5`
  - [Call 2 / run 38083867227](https://github.com/logan-suu/NexusScribe/actions/runs/38083867227), source `e30c64d4ccb364318ebe6332a4db1e4f91e0b52a`
  - [Call 3 / run 38084831853](https://github.com/logan-suu/NexusScribe/actions/runs/38084831853), source `d42bef6b1b0e540eeae7814d3edda0eae00956f3`
  - [Call 4 / run 38085899767](https://github.com/logan-suu/NexusScribe/actions/runs/38085899767), source `37c931b3f03f92fe68a44fdee2fb12a03f24eb30`
- `reservation-1..4.json` holds each pre-call exact request and neutral mapping; `dispatch-1..4.json` records attempt claims; `completed-1..4.json` retains safe complete text, usage, hashes and timing
- [Individual locks](reading/individual-lock-manifest.json), [masked comparison](reading/comparison.json), [comparison lock](reading/comparison-lock-manifest.json). Native independent safety review checked dependencies, retirement and accounting; automated pointer/hash tests do not establish literary truth
- All prior source/historical trial files are preserved. Original CI workflow is restored; production runtime and prompt defaults are unchanged. PR remains draft; no external CodeRabbit invocation, main release or deployment

## Next decision / 后续判断

Do not spend more calls or adopt a workflow on this result. A useful offline next step is to distinguish explicit outcome obligations from genuinely open plot questions in the planning/review contract, while preserving human editorial choice and avoiding keyword-based acceptance. Fresh cases, repetitions or a revised live trial need their own bounded decision. This study has zero attempts remaining.

后续可先离线澄清“必须在本场建立的结果”与“可以保留的悬念”，并检验评审如何向作者解释尚未达成的目标；不要把关键词命中升级为自动通过。新增真实调用、未见场景或重复试验需另设边界。本轮四次额度已经全部耗尽。
