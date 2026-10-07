# Future schema-3 causal fixtures / 面向后续评估的 schema-3 样例

This is a new, offline-only fixture set for the same three fictional causal scenes: F1 rain-night locker continuation, F2 next-morning physical transition, and F3 temporary shoe repair. These are already-seen development scenarios, not fresh holdouts. It adds no trial, provider entrypoint, production prompt, acceptance rule or dependency. Historical requests, output bytes, judgments, manifests and retired guards remain unchanged. **These inputs cannot be paired with the old outputs or pooled with old A/B results to claim a new baseline, an improvement, or a current browser generation/acceptance journey.** Any future paid evaluation needs a separately approved protocol and fresh outputs.

这是三场已见开发场景的新离线样例集，不是新增实验或未见留出集。没有真实模型调用、付费执行入口、生产提示词或接受规则变更。历史请求、原文、评价、清单及退休保护均保持原样。**新输入不能与旧输出拼成新基线或混入旧 A/B 结果，也不证明质量提升或当前浏览器完整生成／接受流程。** 后续付费评估仍需单独批准、另定方案并生成新输出。

## Reproduce / 复现

With the repository's existing Node/npm installation:

```sh
node scripts/export-schema3-causal-fixtures.mjs --check
node scripts/export-schema3-causal-fixtures.mjs --write
node --test tests/schema3-causal-fixtures.test.js
npm run check
```

The default is read-only `--check`; `--write` replaces only the new `eval/schema3-causal-fixtures.json`. Both are offline. The exporter creates fictional states through existing domain operations, builds the actual `App.jsx` in jsdom, selects chapter two and intercepts its existing generation input before server dispatch. The captured boundary is **App → gateway**, before the server injects chapterId or constructs provider model messages/settings; this is not a provider wire-body export. Its fetch stub always throws, never returning invented model prose. Thus the project mapping is the actual App mapping and context is the actual `getContext`, not a cloned serializer or hand-labeled source roles. Three intercepted in-memory client attempts mean **zero server/provider calls**, not three model calls. Tests also poison HTTP/HTTPS/TCP/TLS access and enable fake live flags; no network fallback or live CLI mode exists.

默认只读核对；`--write` 仅重建这个新 JSON。导出器用现有领域操作构建状态，在模拟 DOM 中运行真实 App 的第二章入口，并在请求进入服务端之前截获输入后报错。截获边界为 **App → 网关**，早于服务端补入 chapterId、组装供应商消息和参数，不是最终供应商请求体。上下文和章节映射来自生产代码；不复制序列化器、不手填来源角色、不伪造模型回答。三次内存截获对应 **0 次服务端／供应商调用**。测试另外阻断网络，伪造启用标志也不会付费执行。

The export contains deterministic source, test, package.json and package-lock SHA-256 values, the reference baseline commit, original source pointers, positional target provenance and explicit old/new metadata comparisons. It does not hash itself, avoiding a self-hash cycle. It has no timestamps, random IDs, temporary paths, provider configuration, system messages or A/B arms. It uses the repository's existing jsdom/esbuild test toolchain. `npm test` includes the fixture tests, so `npm run check` checks export drift without regenerating it. If a future evaluation uses this set, retain that exact export alongside its results; never regenerate it in place to rewrite evaluation history.

The separate `validationOnlySha256` map binds `server/provider.js` and `server/provider-transport.js` for the tests' current input validator. They are validation-only dependencies, not App capture runtime: the exporter reads their bytes for provenance without importing or running server/provider code. 单独的 `validationOnlySha256` 仅绑定测试所用的当前输入校验模块及其传输依赖；导出器只读取其字节计算哈希，不导入或执行服务端／供应商代码，两者不属于 App 截获运行路径。

## Reconstruction and material differences / 重建与实质差异

- Existing `writing-quality-fixtures.mjs` is insufficient: today's `createProjectFromConfig` marks all supplied chapters PLANNED, including its prior-prose seed. This new builder creates a clearly labeled offline/template draft, performs the real structural review and acceptance operations with zero selected memories, and then exports context. The synthetic acceptance is scaffolding, not historical author action or semantic validation; `semanticStatus` remains `not_evaluated`, and no positive model review is manufactured
- F1/F3 keep every original source character and every confirmed fact record byte-for-byte as JSON values. Their accepted-prior role is a deliberate synthetic starting-state change, not evidence that the historical run used accepted prose. Role/authority changes can affect future model behavior even with identical story text. Their same prior text is now an accepted source at r2 rather than r1; state version becomes 4 rather than 3. The fact evidence intentionally remains at its original r1. Their old contexts had no schema field or source roles and used sceneTime 3; the new contexts use schema 3, null sceneTime, source positions/status/roles, and the current memory authority policy
- F2 imports the retained validated PLANNED seed, accepts retained completed-01 prose through the still-supported legacy offline/template domain path, saves the exact retained r3 prose, and reconfirms the bell fact via the existing author-fact patch builder. This preserves state version 5, ch1-r3, all three fact IDs/authorities/anchors and every source character exactly. It deliberately uses legacy acceptance semantics; it does not claim a new prose-only workflow ran. A modern prose-only acceptance followed by editing would demote the chapter and require acceptance again
- F2's first two facts still cite ch1-r1, whose quotations do not occur in current ch1-r3. Their historical revision remains in the reconstructed state; they are confirmed author decisions, not newly located quotations in current prose. The broken-bell fact retains r3 offsets 697–715. Never reanchor the first two facts to current prose or silently drop them
- F2's old schema-2 context had no included events and counted one stale memory. This bounded reconstruction intentionally omits that optional historical event/draft selection lineage; current `getContext` therefore reports staleSource 0 rather than 1. It does not copy old fallible selections or hand-stamp old counters. Empty events do not erase the full accepted manuscript or confirmed Canon
- All fixtures target chapterIndex 1 / canonical ch2; the App maps all outline IDs positionally to ch1/ch2/ch3. F1/F3's saved outline ID `chapter-2` survives only in provenance. This is an App-input fixture: the server-added `input.chapterId` is deliberately absent; the canonical ID is already in `project.outline[1].id` and `target.chapterId`
- Accepted ch1 is prior continuity, while target ch2 and later ch3 remain PLANNED/CLEAN planning text. Null sceneTime does not mean zero or a fabricated event timestamp. A pending edit becomes unaccepted context in the regression test. Later plans cannot establish knowledge already acquired

旧写作样例构建器会把前文也标为规划，因此并非重复建设。新样例通过真实领域操作取得角色，所有新增“接受”只是明确标注的离线脚手架，不是作者新决定或模型正确性证据。F1/F3 明确改变了合成起始状态，不证明历史请求真的使用了已接受前文；即使原文不变，角色和权威变化也可能影响模型行为。其前文成为 r2／状态 v4，设定锚点仍是 r1。F2 保留旧版接受语义，在重建状态里维持 v5、前文 r3 和三条设定的完整原记录；前两条引用 r1，不能伪装成当前 r3 引文。旧可选记忆选择链未重建，所以 staleSource 从 1 变为 0，未手工伪造计数。三例都按顺序定位第二章 ch2；ch1 是已接受前文，ch2/ch3 仍是规划，不代表已经发生。

## Intent, missing values and authority / 意图、缺失值与权威边界

All original goals, scene descriptions, voice/length constraints and boundaries are preserved verbatim. Each target has a saved goal. **None of the nine original outline entries has an exitState field.** Absence stays absence in project input; the separate read-only intent reference reports `{status:"missing", value:null}`. No desired ending is inferred from goal, scene, plans.description, constitution desire or prose. Tests distinguish missing from explicitly empty goals. The existing App's generation fallback is not used for these three nonempty goals, and the saved-intent reference never borrows that fallback.

目标、场景、声音、长度与边界均保留原文。三场都有已保存 goal；九个大纲条目全部没有 exitState。输入继续缺字段，单独的只读意图引用报告缺失；不从目标、场景、计划描述或主角愿望补造退出状态，也不把明确留空与缺失混同。

F1 must continue after the lock exchange and envelope concealment; F2 retains the paper box in the zipped tool bag, locked cabinet 17, appointment and broken bell; F3 continues after the white-thread exchange with a temporary repair and the master's unchanged knowledge boundary. Existing `focus` and `evaluatorNotes` remain outside provider input, including F3's ordinary-hand-needle nuance. They do not introduce new story resources. `sceneIntent` is saved author intent, not a completion detector or Canon. Source-role labels, exact quotations and accepted prose do not independently certify world truth, entailment, knowledge acquisition or literary quality.

F1 从既有锁柜对白和藏信动作后继续；F2 保留工具袋中的纸盒、锁住的十七号柜、约定和坏铃；F3 保留白线、临时修补与师傅的知识边界。旧评估说明仍在模型输入之外，不变成新增工具或设定。意图不是自动达成检测器，也不是 Canon；角色标签、精确引文与接受状态不独立证明世界真相、语义蕴含、知识获取或文学质量。
