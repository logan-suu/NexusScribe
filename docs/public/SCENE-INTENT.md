# Saved scene intent / 本章创作意图

## What is displayed / 显示什么

The candidate panel reads the active chapter's **current saved** `config.outline[index].goal` and `.exitState` verbatim, preserving whitespace and line breaks. Like the existing generation entry point, it resolves the canonical chapter ID to its current position and reads that outline slot. Outline IDs may differ from canonical chapter IDs; the panel shows both the slot and original outline ID. Missing or non-unique chapter targets remain unknown. It never borrows a constitution desire, `plans.description`, another chapter's goal or the generator's fallback string. Absent, deliberately empty and unsupported field types are distinguished.

候选稿旁显示当前章节**已保存大纲**的 `goal` 与 `exitState` 原文，保留空格、换行，并标注章节 ID、大纲顺序位置和原大纲 ID。与现有生成入口一样，按当前章节顺序读取对应的大纲位置；不能因为两个 ID 格式不同就猜用其他章节。目标章节缺失或不唯一时保持未知。字段缺失、主动留空、格式不支持分别显示，不借用主角愿望、计划描述或生成默认值。

## Binding and limits / 版本绑定与边界

- Each candidate identifies its own target chapter, saved revision and prose fingerprint, base state version and saved reference-context version/schema. Accepted/rejected candidates are marked historical; demo candidates with the existing implicit `ch3` target never inherit the editor's selected `ch2` goal. Switching chapters or candidates derives the display anew; unsaved candidate edits are explicitly outside the saved binding
- Context currency compares the complete saved context against current context plus project, state version, clean source revisions and chapter revision bindings. A same-version context change or older schema is stale. Missing context cannot be verified. This only describes reference-context currency, never literary quality or fulfillment
- The current plan has a display fingerprint, **not generation-time authority**. Existing drafts do not snapshot their complete preparation/generation outline. A later outline-only edit may change that fingerprint even while reference context still matches. The panel always discloses this limitation; explicit context refresh preserves prose and still does not establish which goal/exitState generated it
- Read-only rendering, navigation and comparison cause zero model/status requests. No persisted schema, memory record, production instruction, provider action or acceptance gate changes. Current intent stays separate from Canon and long-term plot obligations; whether the prose actually fulfills it remains the author's reading decision

每稿分别绑定自己的目标章、已保存候选 revision／正文指纹、基准状态及参考上下文版本；历史稿不伪装成当前稿，未保存编辑另作提示。旧 schema、正文来源或状态变化显示过期，缺少上下文显示无法核对。完整上下文比较只说明参考材料是否一致，不证明文学质量或目标达成。大纲自身没有生成时快照，当前大纲变化也可能不改变参考上下文；界面始终说明这一限制。所有对照均为本地只读展示，不自动评判达成、不写入记忆、不改变接受规则。

## Evidence boundary / 证据边界

The retained [six-output causal writing trial](../../eval/CAUSAL-QUALITY-20261007-RESULTS.md) used frozen fixture inputs. Those contexts do **not uniformly use the current schema-3 context** and do not establish a current browser generation/acceptance journey. The trial's findings and retirement remain unchanged; this panel does not rerun it, adopt the rejected instruction or convert an unfulfilled scene ending into a deterministic detector.

保留的六篇真实输出来自冻结样例，其上下文**并非全部采用当前 schema-3 格式**，不能当作当前应用完整生成／接受流程的验证。历史原文、评价、退休保护及不采用新指令的结论均保留。本改动只是让作者读稿时看见本章目标与预期退出状态，不证明自动写作质量提升。

Offline regression covers exact/missing/empty/malformed fields, positional mapping and reordering, target ambiguity, context/schema staleness, explicit refresh without prose change, revision edits, historical candidates and chapter switching. DOM and desktop/mobile Chromium checks block model calls. These checks establish display/state behavior, not semantic or literary correctness.

离线领域、模拟 DOM 和桌面／手机 Chromium 回归仅验证展示与版本行为；浏览器阻断模型请求。未进行新真实模型实验，不外推语义正确率或文学效果。
