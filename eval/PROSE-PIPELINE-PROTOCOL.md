# Synthetic prose-first pipeline pilot, version 1

## Question and preserved history

Does separating prose generation from structured memory extraction improve short-scene usability, prose quality or failure isolation relative to the existing single-response generation contract? This is an exploratory three-fixture paired architecture pilot with one sample per arm. It is not a statistical benchmark, whole-book continuity test, human quality verdict or evidence of cost savings. A pipeline can return usable prose while its memory extractor fails; report that partial outcome without calling the pipeline or pair complete.

This is a new experiment, not an amendment to the earlier context-packaging quality pilot. Existing `eval/WRITING-QUALITY-PROTOCOL.md`, fixtures, manifest, results and history remain unchanged. The earlier v1 and v2 runs stopped before a completed pair; their completed-pair total remains zero. Their attempted calls are historical consumption in addition to this new maximum-nine-call batch. Never relabel, reconstruct or recycle their missing outputs.

## Frozen synthetic inputs and architectural arms

Reuse the existing three wholly synthetic Chinese scene fixtures and `buildPair(fixture).nexus` from `eval/writing-quality-fixtures.mjs`. Fixed fixture order: mystery, warm fantasy, slice of life. Each continuation asks for 450–600 Chinese characters, 4–7 paragraphs, a small scene, the supplied voice and a constrained ending. Each arm receives an independent deep copy of exactly the same generation input: project, chapter index and ID, actual structured context, prior prose, scene goals, confirmed author facts, POV, voices and restrictions. No real manuscript or personal information is used.

- Legacy arm: one `service.run('generateChapter', input)` call. This is the current strict production contract for paragraphs, chapter ID, staging and review notes. No evaluation-only prose instruction, forced-empty ancillary fields, repair or relaxed validation is added
- Prose-first arm: one `service.run('generateProse', input)` call, followed by one `service.run('extractMemory', {text, chapterId, context})` call using the exact returned prose, the same generation target ID and the original context. The new wire generation response is plain prose, not JSON; the runtime supplies the chapter ID independently. Extraction returns proposed staging and review notes. Server-derived source quotes and offsets must exactly bind to the unchanged generated text

Both generation arms therefore have equal story information and context packaging. Their system instructions, action names and output contracts necessarily differ. Extraction adds an extra request and repeats context plus generated prose; total pipeline input, output, request count and latency are not token matched. There is no padding or claim that a shorter first response means lower total cost. Extraction never rewrites prose or commits author facts. Valid evidence locations establish exact source binding, not semantic entailment or memory completeness; author review remains necessary.

Fixed phase order: mystery legacy/prose/extract; warm-fantasy prose/extract/legacy; slice-of-life legacy/prose/extract. This partial counterbalancing is not fully balanced. Failure of any phase ends the entire batch immediately, so a legacy failure before a new-arm call can leave no new-arm observation for that fixture. Do not hide this consequence, reorder the run adaptively or infer what an unattempted phase would have produced.

## Locked request and authorization limits

- Endpoint: `https://opencode.ai/zen/go/v1/chat/completions`
- Model: `deepseek-v4.1-flash`; thinking disabled; omit `reasoning_effort`
- Temperature: 0.7 for every stage, applied only in the experiment transport wrapper. Production normally omits a temperature override
- Maximum output: 3000 tokens per call. Exactly three calls per complete fixture and no more than nine attempted outbound requests. The combined ceiling is 27,000 output tokens, not actual usage, price or billing
- Minimum 11-second delay between stages; sequential execution. Provider rate and per-request timeout controls still apply
- No retries, regenerated samples, JSON repair, fallback providers, prompt amendments, extra judge calls, extra fixtures or best-of selection. Stop on the first provider error, timeout, truncation, malformed result, protocol violation or evidence persistence failure
- At most one transport request per stage, enforced independently of the service. No run restart, Actions rerun (`github.run_attempt == 1`) or existing evidence-directory reuse. An interrupted or failed run requires a new explicit user decision and a separately identified protocol/batch before any further paid request
- Manual dispatch only in the existing `.github/workflows/live-smoke.yml`, scope `prose-pipeline`, approval checkbox true, with explicit confirmation that provider Use balance is OFF. The script also requires the three approval/live/overage flags, GitHub Actions and `GITHUB_RUN_ATTEMPT=1`
- Use only the existing `NEXUS_API_KEY` Actions Secret, injected only into the selected live generation step. Offline checks receive no credential. The harness cannot independently verify the provider's Use balance switch. Never read, print, replace or create credentials
- Existing live scopes retain their prior behavior. The new scope uses the same concurrency group; no automatic or CI-triggered live dispatch. Review and commit source, protocol, manifest and offline tests before any separately authorized dispatch

## Evidence and timing

Write `inputs.json` before the first call; it contains exact synthetic generation inputs shared by both arms. Record the reviewed source SHA and Actions run ID when supplied. A separate manifest freezes this protocol, fixture source, harness and offline tests; the reviewed commit locks the runtime and workflow used at dispatch.

Immediately after each successful, validated stage, write its immutable `completed-01.json` through `completed-09.json` checkpoint. Sequence numbers refer to actual call order. Generation checkpoints contain only normalized synthetic prose, chapter ID, allowlisted ancillary output where applicable, hashes and descriptive counts. Extraction checkpoints contain only normalized proposals/notes and the hash of the exact source prose. The prose checkpoint must exist before extraction starts, and remains available if extraction fails. Never save or reconstruct malformed provider output as a completed result.

`diagnostics.json` is updated during execution and at a terminal state. It distinguishes stage invocations, prepared requests, attempted outbound requests, transport responses, validation success/failure, completed phases and completed pairs. Preparation is persisted before dispatch; a failed preparation write counts no outbound attempt. A nonterminal snapshot after external interruption is marked accounting-incomplete: treat any prepared request as potentially sent, do not claim its missing usage was zero, and do not restart the run. It includes each request's hash, serialized input byte/character counts, bounded HTTP status, fixed-enum outcome and final-content-presence indicator. Never save raw upstream bodies, HTTP headers, credentials, provider reasoning text, error messages or stack traces. Unknown or unallowlisted errors become a generic fixed code.

Use an injectable monotonic clock. Report per-request transport/read latency, per-stage service latency, per-arm service-latency sums, per-fixture first-prose and full-memory availability/latency, and total script-workflow elapsed time (not Actions checkout/bootstrap time). Include failed stages and requests in accounting. Service latency includes harness diagnostic persistence within the service call but excludes pre-stage throttle and the output checkpoint; total workflow elapsed includes throttle, parsing, validation and checkpoint writes up to each snapshot. Diagnostic writes are serialized and revisioned so a delayed earlier write cannot replace a terminal record. After prepared-intent persistence, recheck terminal status and request cancellation before dispatch; a timeout during that write causes zero outbound requests. A late response from a transport that ignores timeout cancellation cannot overwrite terminal diagnostics or create a completed checkpoint. Provider rate-limit waits are not intrinsic architecture speed. Compare time to first validated prose (legacy generation versus prose generation) separately from end-to-end validated memory availability (legacy generation versus prose plus extraction). Do not label the new first stage as a complete workflow.

Usage is provider-reported prompt/completion/total tokens and optional reasoning-token counts, captured before production response validation so truncated or malformed outputs still count when the envelope supplies usage. Aggregate by stage, arm and all attempted requests. Each metric includes a sum of known reported values, reported-call count, missing-call count and completeness flag. Missing counts stay unknown; never invent zeros, derive total tokens from other fields, assume an invalid response was free, equate a cap with actual use or infer monetary savings. Request hashes and exact input sizes explain the inherent architectural input differences.

Only fixed allowlisted files are uploaded: `inputs.json`, `diagnostics.json`, `blind-pairs.json`, `unblinding.json`, and the nine named completed-stage checkpoints. No recursive directories, raw dumps or wildcard artifacts. Artifacts are retained for seven days; separately authorized sanitized evidence may later be preserved durably. A stopped run retains earlier checkpoints and safe diagnostics but produces no complete blinded corpus. Completed pairs within a stopped batch are counted honestly, while an incomplete fixture never counts as a pair.

## Blinded prose review and separate memory review

Create `blind-pairs.json` only after all nine required stages and all three pairs validate. Randomly assign A/B independently after each complete pair; persist mapping separately in `unblinding.json`. No model seed is claimed. Give the reviewer only the blind pairs and the following rubric. Do not show them source mappings, ordered checkpoints, diagnostics, memory outputs or the protocol's arm order until judgments are locked. Architecture may still be recognizable from style; note imperfect blinding.

For each pair and dimension, record A / B / tie / uncertain, exact short supporting quotes from each output, and a concrete explanation:

1. Character voice: distinct speech/actions consistent with the supplied character voice
2. Pacing: a comprehensible causal scene with a proportionate turn and earned ending
3. Repetition: unnecessary repeated language, beats or explanation, while distinguishing deliberate motifs
4. Constraint inheritance: physical limits, POV, character knowledge, unresolved information and ending. Absence is not contradiction; beliefs, dialogue, metaphor and world assertions differ. Quote an actual incompatible assertion or mark uncertainty

Note length/paragraph adherence and defects descriptively. Do not turn automated counts into literary scores or calculate an aggregate score, significance, win rate or overall superiority claim from three samples. If the reviewer is an assistant, label it assistant qualitative review, not independent human evidence. No extra paid judge calls are authorized.

After prose judgments are locked and mapping revealed, separately inspect each arm's proposed memory: supporting source span, semantic support, omissions, false events, uncertainty notes and commitment risk. The legacy contract lacks the new explicit offsets, so report that structural difference rather than awarding a quality point automatically. Neither source binding nor empty staging proves correct or complete memory. Record end-to-end success, failed phase, first-prose availability, total measured latency and usage completeness alongside any qualitative findings. Partial and negative results remain useful and must not be relabeled a successful comparison.

## Blank review record

Pair ID:
Reviewer type and whether prose judgments were locked before unblinding:
Character voice: A / B / tie / uncertain; A quote; B quote; explanation
Pacing: A / B / tie / uncertain; A quote; B quote; explanation
Repetition: A / B / tie / uncertain; A quote; B quote; explanation
Constraint inheritance: A / B / tie / uncertain; A quote; B quote; explanation
Length/paragraph adherence, ambiguity and other defects:
After unblinding, memory support/omissions/false events/uncertainty:
Per-arm first-prose and full-memory availability, latency, usage and missing telemetry:
Smallest evidence-supported next decision:
