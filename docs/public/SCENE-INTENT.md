# Saved and initial-request scene intent / 本章创作意图与初次请求

## What is displayed / 显示什么

The candidate panel reads the active chapter's **current saved** `config.outline[index].goal` and `.exitState` verbatim, preserving whitespace and line breaks. Like the existing generation entry point, it resolves the canonical chapter ID to its current position and reads that outline slot. Outline IDs may differ from canonical chapter IDs; the panel shows both the slot and original outline ID. Missing or non-unique chapter targets remain unknown. It never borrows a constitution desire, `plans.description`, another chapter's goal or the generator's fallback string. Absent, deliberately empty and unsupported field types are distinguished.

候选稿旁显示当前章节**已保存大纲**的 `goal` 与 `exitState` 原文，保留空格、换行，并标注章节 ID、大纲顺序位置和原大纲 ID。与现有生成入口一样，按当前章节顺序读取对应的大纲位置；不能因为两个 ID 格式不同就猜用其他章节。目标章节缺失或不唯一时保持未知。字段缺失、主动留空、格式不支持分别显示，不借用主角愿望、计划描述或生成默认值。

## Binding and limits / 版本绑定与边界

- Each candidate identifies its own target chapter, saved revision and prose fingerprint, base state version and saved reference-context version/schema. Accepted/rejected candidates are marked historical; demo candidates with the existing implicit `ch3` target never inherit the editor's selected `ch2` goal. Switching chapters or candidates derives the display anew; unsaved candidate edits are explicitly outside the saved binding
- Context currency compares the complete saved context against current context plus project, state version, clean source revisions and chapter revision bindings. A same-version context change or older schema is stale. Missing context cannot be verified. This only describes reference-context currency, never literary quality or fulfillment
- The current plan has a display fingerprint, **not generation-time authority**. A later outline-only edit may change that fingerprint while reference context still matches. Drafts created before request capture remain explicitly unknown; context refresh never reconstructs their original intent
- Read-only rendering, navigation and comparison cause zero model/status requests. New generation records add optional local provenance; the existing backup schema remains compatible. No memory record, production instruction, provider action or acceptance gate changes. Current intent stays separate from Canon and long-term plot obligations; whether the prose actually fulfills it remains the author's reading decision

每稿分别绑定自己的目标章、已保存候选 revision／正文指纹、基准状态及参考上下文版本；历史稿不伪装成当前稿，未保存编辑另作提示。旧 schema、正文来源或状态变化显示过期，缺少上下文显示无法核对。完整上下文比较只说明参考材料是否一致，不证明文学质量或目标达成。旧稿没有生成时快照，当前大纲变化也可能不改变参考上下文；界面始终说明这一限制。所有对照均为本地只读展示，不自动评判达成、不写入记忆、不改变接受规则。

## Initial generation input, from 2026-10-09 / 初次生成入口记录

New app-generated candidates capture the two exact fields from the **mapped generation input before calling the adapter**. In server mode this is App → gateway, before server normalization and provider prompt construction; in template mode it is the local template input. The snapshot records canonical chapter identity, positional slot, initial source revision/state version and draft/run/r1 identity. It stores goal and exitState as exact string values plus explicit present/empty/missing/unsupported statuses, never inferring an ending. The existing App fallback for a missing or empty goal can therefore differ from the saved outline; both are displayed without changing the request itself. Unsupported values are labeled unsupported, not silently turned into strings.

应用新生成的候选会在调用适配器**之前**记录映射后的两个字段。真实模式的边界为 App → 网关，早于服务端规范化与供应商提示词组装；模板模式记录本地模板输入。来源包括规范章节 ID、位置、初始正文来源 revision／状态版本以及候选／运行／r1 标识。缺失、主动留空、格式不支持分别保留，不猜测结尾。生成入口原有的目标默认值可能与当前保存大纲不同，两者分别显示，不改动请求内容。

The optional `generationIntent` record is supplied by the App as a separate domain argument; metadata returned by a provider cannot create it. It is cloned when captured and staged. It survives edits, adopted revision proposals, rejection/acceptance, reload, export/import and explicit context refresh, but **always describes the initial generation r1**. Later revisions display that limitation. It does not preserve the full project, full outline, provider wire request, generation settings, later revision instructions or proof that a model followed them. Existing author-revision provenance remains separate. Structurally valid imported records are local history, not authenticated provider receipts; imports remap project identities consistently and retain original import history.

`generationIntent` 是 App 单独传给领域层的可选记录，供应商返回的同名字段不能伪造该记录。捕获和保存均独立复制；编辑、采纳改稿、接受／拒绝、刷新、导出导入和更新参考上下文都会保留，但**始终只描述初次生成 r1**。后续版本明确提示这一点。它不是完整项目、大纲、请求体、模型参数、后续改稿意见或模型执行证明。导入只检查本地记录结构与身份关系，不提供供应商认证；新项目身份按原有导入规则映射，原导入历史保留。

Old candidates, direct legacy domain calls and hand-prepared drafts remain without this optional record. No migration invents historical fields; manual preparation never creates generation provenance. Backup validation rejects malformed optional records without discarding or rewriting existing manuscript/history. Capture is provenance-only: it adds no model call, scoring, memory semantics, acceptance gate or new live evaluation permission. Failed, cancelled or stale requests create no draft or provenance record. The current versus initial-field comparison is exact, not semantic; equality does not establish fulfillment and differences do not imply a quality failure.

旧稿、未提供记录的旧领域接口及手写候选继续缺省，不反推或补写历史。损坏的可选记录在导入时拒绝，不改写现有正文或历史。失败、取消、过期请求不会留下候选或来源记录。新记录不增加模型调用、评分、记忆语义、接受条件或真实评估权限。两个字段只做原文比较；一致不代表达成，不同也不表示写作质量失败。

## Evidence boundary / 证据边界

The retained [six-output causal writing trial](../../eval/CAUSAL-QUALITY-20261007-RESULTS.md) used frozen fixture inputs. Those contexts do **not uniformly use the current schema-3 context** and do not establish a current browser generation/acceptance journey. The trial's findings and retirement remain unchanged; this panel does not rerun it, adopt the rejected instruction or convert an unfulfilled scene ending into a deterministic detector.

保留的六篇真实输出来自冻结样例，其上下文**并非全部采用当前 schema-3 格式**，不能当作当前应用完整生成／接受流程的验证。历史原文、评价、退休保护及不采用新指令的结论均保留。本改动只是让作者读稿时看见本章目标与预期退出状态，不证明自动写作质量提升。

Offline regression also exercises the actual App capture with synthetic responses, ignores provider-supplied provenance, retains the initial snapshot across edits/reload/context refresh/import, and checks zero-network template capture. Existing coverage includes exact/missing/empty/malformed fields, positional mapping and reordering, target ambiguity, context/schema staleness, explicit refresh without prose change, revision edits, historical candidates and chapter switching. DOM and desktop/mobile Chromium checks block model calls. These checks establish display/state behavior, not semantic or literary correctness.

离线领域、模拟 DOM 和桌面／手机 Chromium 回归仅验证展示与版本行为；浏览器阻断模型请求。未进行新真实模型实验，不外推语义正确率或文学效果。
