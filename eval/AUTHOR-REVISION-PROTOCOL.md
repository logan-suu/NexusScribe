# Author-directed chapter-2 revision trial, version 1

## Status, question, and non-goals

**Preregistered staged trial; no live request has been dispatched during preparation.** Recorded routine-test authorization covers one lifetime batch, conditional on exact-source CI and independent review; this document grants no additional batch, retry, or continuation after failure. This is a new, separately identified trial, `author-revision-v1`, with a lifetime ceiling of **three attempted provider requests**. A reviewed source/manifest and successful CI at the exact dispatch SHA are required before the separately approved first dispatch; the revision must be reported and close-read before any continuation. The consumed `multichapter-v1` run and its remaining nominal capacity cannot be reused. Protocol preparation does not itself dispatch a model call, access credentials, or accept application state. Authorized repository publication, review, and merging are separate development work.

Question: can one author-directed revision of the exact retained chapter-2 draft repair its identified visibility defect and excessive length while preserving its useful voice, practical detail, limited knowledge, and outstanding appointment? This is one targeted, non-blind case, not a benchmark, independent human evaluation, proof of general revision quality, or comparison of models. Stage completion, objective adherence, an assistant/human close read, model review, and author acceptance are separate outcomes.

## Immutable source and context

All paths below are relative to the repository root. Do not regenerate, trim, normalize line endings, hand-edit, or reconstruct the source prose from quoted excerpts.

- Revision target: `eval/history/multichapter-v1/completed-05.json`, JSON pointer `/output/text`, chapter `ch2`. The exact text contains 691 Unicode `Script=Han` characters and eight paragraphs under `segmentProse`. File SHA-256: `75a1ae40bb15047e7560c99f8d5ea41486a48c22276630ecbabf24698995d1da`; text UTF-8 SHA-256: `6a58486c108fe32ac376f3d4f5bbd96483b7367300fa61c549aa5fca30142046`
- Original generation inputs: `eval/history/multichapter-v1/request-05.json`, file SHA-256 `2b73b05a467ea495c0050704bfafb830862fdf8516961222d9d1bd935d39a694`. Copy `/input/context` exactly, including source roles, planned chapters, historical-memory exclusion counters, and original facts; do not regenerate it from the current application state
- Exact prior accepted manuscript: `/input/context/sources/0` in that request, chapter `ch1`, revision 3, `ch1-r3`, role `accepted_manuscript`, including the appended broken-bell sentence. Its `/text` UTF-8 SHA-256 is `c093b4d5bf0ae51a4cdf9bc9b62aa7f5f20a1851493b429acac6eec974178a73`
- Context object SHA-256 under UTF-8 `JSON.stringify(value)`, retaining parsed key and array order: `8c7fb150cf64b1c9cee21892a9afb0b11458e349358dea2e5631eadd9a5a7436`. It has three confirmed explicit-author facts, no active events, and planned rather than accepted chapter 2 and 3. Do not promote the target draft or extracted proposals to accepted context
- The original project/index remain provenance only; the new revision boundary receives exactly `{text, instruction, chapterId, context}` with no project/index or ancillary fields. Original project-object SHA-256: `3e0cb449d4cb55e9b949a6de940ca526febed706d2c0fda3f5a649fd6765f5ed`
- `request-06.json` and `request-07.json` retain the original extraction/review and the same context. Their file hashes and all frozen execution dependencies are recorded in `eval/author-revision-manifest.json`

The historical results and source manifest remain unchanged. The older original request hash covers provider serialization; it is not the same quantity as a file hash or extracted-string hash. Clearly label every digest's encoding and scope.

## Exact author instruction

Use the following instruction exactly, as the author's revision request. The instruction is also copied verbatim into the machine-readable manifest; no extra evaluation-only creative instructions, hidden examples, alternative prompt, or follow-up correction may be appended.

```text
请修改这份第二章候选稿，不要重写为另一场戏。将正文压缩到350–500个汉字、4–7段，只返回完整修改后正文。
修复纸盒可见性：纸盒是不透明的。许宁先解下橡皮筋、打开盒盖，老周才查看纸屑；查看后由许宁合盖并重新收好。不得再隔着未打开的盒壁看清纸屑，也不得把纸盒改成透明盒。柜门仍然锁着，不得混淆打开纸盒与打开柜子。
删减重复的提工具袋、盒子碰袋壁及装饰性雨景，保留一两个真正推动动作的实物细节。保留修表师操作的职业感，可沿用镊子或装过游丝的纸盒，不要插入职业介绍。许宁说话简短、与实物相关；阿青着急但不咄咄逼人；老周用办事规矩表达关心。保持第三人称限知，只跟随许宁。
保持次日上午来询问、老周说明旧登记本明天才能查、约定明天上午九点再来的事件顺序。可以保留九点差一刻到达，这不违反九点约定。不要提前查到记录、开柜或履行明天的约定。让延后查记录的说法自然可信，不添加新支线或重大设定。
许宁的左耳仍听不见；损坏的铜铃不能响；阿青仍不知道信封中的旧车票，本章不得向他透露；寄信人仍未知。纸屑继续由许宁保管；四片、纸盒和柜号十七等已有实物关系不得改动。猜测、人物说法和已知事实要分清。保留这场小戏克制、少量干涩幽默的语气，不添加总结、解释、修改说明或审查结论。
```

## Locked transport and stage budget

- Endpoint: `https://opencode.ai/zen/go/v1/chat/completions`; model: `deepseek-v4.1-flash`
- `thinking: {"type":"disabled"}`; omit `reasoning_effort`; temperature 0.7; at most 3,000 output tokens per request. Do not increase the existing output ceiling or change model, endpoint, key, or billing/balance settings
- Three sequential stages, at most one attempted HTTP request each, in this order: `reviseProse`, `extractMemory`, `reviewChapter`. At most 9,000 requested output tokens in aggregate; this ceiling is not usage, cost, or independently verified billing
- Preserve the existing minimum eleven-second inter-request throttle and provider timeout limits. No automatic retries, same-stage reruns, fallback, repair call, new generation, prompt variant, best-of selection, extra judge, or memory-candidate audit. A timeout, uncertain dispatch, interruption, or failure consumes its attempted/uncertain stage; it does not grant a replacement
- Only the existing credential may be used in the separately authorized live step. The recorded authorization confirms Use balance is OFF; the harness still requires the explicit approved/live/overage-off flags. Preparation and offline tests use no credentials and cannot certify the provider's balance switch
- A live runner must enforce the three-call cap independently of provider configuration and persist a run ledger before dispatch. The execution directory must be new. A used or uncertain stage cannot restart. The workflow uses separate dispatches for stages under one immutable trial identity, same frozen source/candidate, and cumulative three-attempt ledger. Repeating a used or uncertain stage is forbidden; a new workflow run is not a new allowance

### Stage 1: one revision

Supply exactly `{text: retainedChapter2Text, instruction: exactAuthorInstruction, chapterId: "ch2", context: exactOriginalContext}` to the production `reviseProse` boundary. The normalized service output is `{text, chapterId, provider}`; only `text` is model prose. The target remains a candidate, not an accepted manuscript. Persist the complete raw response and exact revised prose before any later stage. Never trim, repair, splice, truncate, expand, or replace the model's returned prose to make it pass.

Run the objective checks below, then pause for a recorded human/assistant close read against the preregistered semantic checklist. This is an evaluation gate, **not author approval** and not a provider call. Stage 2 is forbidden until every required item is `pass`; `fail`, `uncertain`, or missing evidence stops the batch with the revised text retained. A model self-review at stage 3 cannot retrospectively satisfy this pre-extraction gate. A runner without this gate is not an implementation of this protocol.

### Stage 2: one extraction

Use `{text: exactStage1Text, chapterId: "ch2", context: exactOriginalContext}`. The serialized transport may deterministically substitute the application's `segmentProse` array for text, as production does. Hash and verify the exact input binding first. Persist raw output before schema validation and the normalized result afterward. Require at least one candidate and exact, in-range paragraph indices/quotes/UTF-16 offsets; preserve every candidate and review note. Any schema/reference failure or empty extraction stops before stage 3. A valid reference proves location, not semantic entailment. Do not run `auditMemoryCandidate`, conduct a separate memory-support model audit, select a candidate, accept memory, commit a fact, or feed extracted proposals back as established context.

### Stage 3: one whole-chapter review

Before dispatch, the named non-blind reader reads the retained extraction and records a new locked continuation decision in `extraction-gate.json`, bound to the exact normalized extraction-output SHA-256. `fail`, `uncertain`, absent, stale, or incomplete evidence stops before the third call. This checks whether to continue the trial; it is not an independent memory-support audit or factual certification.

Use `{text: exactStage1Text, chapterId: "ch2", context: exactOriginalContext}`. Do not add extracted candidates, author-approved facts, or an auto-accept flag. Persist the raw response and normalized review, even when it is unfavorable. Stop as failed if any generic issue has severity `error`, any confirmed-author fact is `contradiction` or `unknown`, or the three current confirmed-author facts are not assessed exactly once with matching record versions. Warnings are retained and discussed, not silently promoted to a clean pass. `not_applicable` can be appropriate for an unmentioned fact; omission alone is not contradiction.

This third stage is advisory and fallible. An empty issue list or all `consistent`/`not_applicable` statuses is not evidence of literary quality or complete correctness. Compare it with the already locked close read and report agreements and misses. There is no fourth call or automatic acceptance, regardless of the result.

## Preregistered checks and stopping rules

### Reproducible objective checks

Before dispatch, verify every frozen file hash, extracted input hash, source role/revision, target ID, original 691-Han/eight-paragraph count, fixed instruction, settings, fresh run identity, and maximum stage order. Hash mismatch or incomplete manifest means zero dispatches.

After stage 1, on the exact returned string:

1. Preserve a nonempty complete plain-prose response under the production bound; reject missing/refused/truncated output, wrong target binding, or schema failure. The offline checker additionally rejects lines starting with Markdown code fences and a whole response parseable as a JSON object/array; other explanatory metadata/partial rewrites require the close read, not a claimed universal plain-prose detector
2. Count Han code points with `(text.match(/\p{Script=Han}/gu) || []).length`; require **350 through 500 inclusive**
3. Count paragraphs with `segmentProse(text).length`; require **4 through 7 inclusive**. This counts nonblank physical lines verbatim, not double-newline runs, Markdown blocks, or a language-model claim
4. Require the exact received string to be unchanged in storage and in every later stage; independently verify SHA-256 and UTF-16 source slices

These checks do not prove that the visibility repair, professional detail, voices, or knowledge constraints succeeded. Keyword presence/absence can assist reading but cannot replace the semantic checklist or prove a negative. Do not use a regex match as evidence that the appointment, box, or character knowledge is causally correct.

### Required pre-extraction semantic close read

The reviewer reads the unchanged original chapter 2, unchanged accepted chapter 1 and facts, exact instruction, and whole revised chapter. Record reviewer type (`human` or `assistant`), non-blind status, stage-1 prose hash, every item as `pass`/`fail`/`uncertain`, exact revised-text evidence spans, and concise reasoning. For negative claims, also state that the entire candidate was read and list relevant references/ambiguities. Do not invent quotes for absent material. Missing evidence or unresolved ambiguity is `uncertain` and stops this trial.

1. **Physical visibility and custody:** an opaque paper box is opened before 老周 observes the scraps, then closed/resecured and retained by 许宁. No seeing through walls, no changed transparent container, no opened cabinet, no changed count/identity/cabinet number, and no implausible handing/teleporting of evidence
2. **Time and outstanding obligation:** the scene remains the next-morning inquiry; arrival at 8:45 is allowed. 老周 postpones checking old records until tomorrow, and the explicit next meeting remains tomorrow morning at nine. The draft neither acquires those records nor fulfills that future appointment
3. **Knowledge and viewpoint:** limited third-person through 许宁; no left-ear hearing, working broken bell, disclosure of the old ticket to 阿青, known sender, unexplained omniscient assertion, or guess silently turned into established fact. Ordinary sounds and silence about a fact are not automatically violations
4. **Voice and useful professional detail:** 许宁's concrete, economical speech and practical repair-trade handling remain; 阿青 is impatient without becoming aggressive; 老周 conveys care through rules. At least one professional/physical detail does real scene work rather than decorative name-dropping or an expository job label. Explain its function with an exact quote
5. **Compression without flattening:** remove redundant bag lifting, box-against-bag beats and decorative rain padding while preserving causal transitions, a credible record-delay explanation, meaningful interaction and a restrained ending. The shortened text should still be a complete scene rather than a plot summary, partial rewrite, or explanation of edits; no extraneous explanatory metadata. A defensible motif is not automatically repetition. Explain any trade-off; an unresolved failure is not overridden by meeting the numeric bounds

If all pass, lock the record before extraction. The reviewer may not rewrite the output, adjust the checklist, or request another sample. Passing this checklist means the stated reader found no blocking defect in this one non-blind comparison; it is not an objective universal writing score or author acceptance.

### First-failure rule

Stop before the next stage on the first failing objective or semantic check, transport/provider error, timeout, incomplete response, truncation, schema/reference failure, protocol/settings/hash mismatch, permission failure, cancellation, or evidence-write failure. Preserve the attempted stage's full received output, including invalid content, and all prior evidence. Record the failed check and stop reason; mark unattempted stages `not_run`. Fetch and response-stream exceptions are `UPSTREAM_ERROR` with delivery/usage uncertain; file persistence exceptions remain `EVIDENCE_FAILED`. Neither classification permits a retry. Failed, uncertain, and interrupted stages are never rerun under this trial. A quality failure cannot be relabeled an engineering success, although transport/schema results can be reported separately.

## Evidence retention and reporting

Before a live implementation is approved, demonstrate credential-free fake-transport tests for all guards, including first-call objective/semantic stop, second-call failure, third-call failure, raw invalid-response retention, call four denial, uncertain attempt denial, no accepted-state mutation, and hash/context/input mismatch.

Preserve exact input bodies (without headers), raw model response bodies/complete content received **before schema normalization**, normalized outputs, hashes, stage checks, gate records, bounded safe error codes, model/settings, finish reason, provider token counters and missing-counter flags, and timing/dispatch accounting. All returned prose, extraction labels/notes, review judgments and failed/truncated content must remain accessible in the synthetic trial artifact, subject to the credential safety exception below. This intentionally does not inherit the old harness's normalized-only evidence policy. Never print or include credentials, authentication headers, environment dumps, or unrelated project/user data. The configured model has thinking disabled; any unexpected reasoning channel or positive reasoning-token count stops the stage and is reported as a settings/response violation; it is never treated as prose or followed as instructions.

The implementation holds the bounded response in memory while scanning for credentials. After the bounded secret scan and parsed-envelope defense, safe bytes are saved to an exclusive raw file before production normalization. Caught stream/read failures retain safe received partial bytes and label them partial. Abrupt process/runner termination before this flush can lose buffered bytes; that attempt remains uncertain and consumed, never retryable. A persistence failure is itself terminal; do not claim bytes were retained if that write failed. Use immutable stage files, atomically updated diagnostics, and no overwrite/reuse of earlier evidence. Raw artifacts contain untrusted output and must never execute. The repository is public. No artifact may contain credentials, authorization headers, environment dumps, or unrelated sensitive material. If a raw response echoes the configured API key or GitHub token (including JSON-escaped form), withhold those bytes, stop, and mark retention explicitly incomplete; do not claim an exact full raw record. The complete bounded 128-KiB response is conservatively held across chunks, so mixed literal/Unicode-escaped keys and split escape sequences cannot leak through an early flush. The scanner covers literal credentials and up to eight successive JSON Unicode/simple-escape decoding passes, including nested envelope/content encodings and either hex-letter case; parsed-envelope and normalized-output checks add defense in depth. It does not claim arbitrary obfuscation detection such as base64. Unresolved deeper escape nesting fails closed. On a broken stream, preserve received safe bytes; conservatively withhold the buffered bytes if they end with an incomplete escape or possible credential prefix. Normal synthetic outputs remain byte-exact, including invalid JSON and truncation. Unexpected sensitive unrelated content requires withholding the affected artifact before publication; this synthetic trial sends no personal manuscript or user data.

The report must include:

- Original versus revised exact prose with separate hashes and objective counts; no edited-for-presentation replacement
- Per-stage attempted/received/valid/not-run state and first stop reason, including any missing/uncertain accounting
- Every preregistered close-read item with concrete evidence and reviewer type; length compliance, structural validity and literary judgment reported separately
- Model review findings, missed issues, and all warnings; extraction retained as unaccepted proposals with no support-certification claim
- Actual provider-reported usage and latency, missing fields marked unknown. No price estimate from token caps or claim that a stopped/invalid request was free
- No change to accepted chapters, author facts, memory decisions, or continuity context; no chapter 3 generation; no new live permission inferred

The stopping condition is either the first recorded failure/uncertainty, or all three stages completed and reported with the candidate still awaiting the author's independent decision. Additional revision, acceptance, a new batch, live workflow activation, or altered sources/instructions require a new explicit decision and separately identified evidence.

## Offline and staged implementation boundaries

`node scripts/run-author-revision-eval.mjs --offline` verifies preregistered inputs and source hashes and reports zero live calls. Its builders/checkers have no transport, credential read, dispatch, or application-state mutation. Other CLI arguments fail closed. Its input builders do not prove an earlier stage ran and are not a cumulative live-call ledger.

The close-read record contains protocol ID, reviewer name/type, `nonBlind: true`, `fullCandidateRead: true`, exact revised `textSha256`, `locked: true`, and exactly the five `closeReadItems` IDs. Each item needs `status: "pass"`, concrete reasoning, and at least one exact `{start, end, quote}` UTF-16 span. The named non-blind reader performs the actual non-blind close read; software validates its integrity, not its truth. Failed/uncertain records are retained but cannot unlock a paid continuation.

The review-stage continuation record has protocol ID, reviewer name/type, `nonBlind: true`, `locked: true`, `status: "pass"`, exact normalized extraction `outputSha256`, a concrete `explanation`, `scope: "continuation_only_not_fact_verification"`, and one or more exact `{candidateIndex, label, sourceQuote}` evidence entries. It cannot assert author acceptance or convert proposals to facts. Both paid continuations therefore require a recorded non-blind inspection rather than a blind automatic chain.

`scripts/run-author-revision-live.mjs` runs only through the separate `.github/workflows/author-revision-trial.yml` workflow:

- Fixed run names `author-revision-v1/revise`, `/extract`, `/review`; one protocol-wide concurrency group; no cancellation of in-progress runs; `github.run_attempt == 1`; one stage request per service process
- Required `ci_run_id` must identify this repository's completed successful `.github/workflows/ci.yml` run at the exact dispatch SHA. The same SHA and CI run ID persist across the three stages; no source change is allowed mid-trial
- Authenticated read-only GitHub workflow-run listing is fully paginated and fails closed on missing, unstable, duplicate, or inaccessible history. Exactly the current stage plus its expected unique successful predecessors must exist. Any duplicate, failed, canceled, rerun, uncertain, out-of-order, or extra trial stage consumes/blocks the trial even if it never reached paid transport. Current and predecessor SHA, workflow path, event, attempt number, statuses, and run IDs are checked
- `prior_run_id` downloads the exact predecessor artifact with the pinned official `actions/download-artifact` action. The cumulative artifact index verifies every file byte hash, source SHA, protocol, normalized output hash, manifest hash, expected status/order/attempt count, and predecessor run ID before any model call. Missing/extra/changed files fail closed
- Fresh exclusive evidence directory; immutable input/request/dispatch files precede transport. `dispatch-0N.json` is a durable attempted-or-uncertain intent with cumulative count N, not independent proof that bytes left the host. The run history is an additional durable consumption witness if execution is interrupted before final ledger persistence
- Safe raw model bytes are saved after the bounded secret scan and before production normalization; safe caught partial responses and failed outputs are retained. Bytes buffered at abrupt process termination may be unavailable and must remain uncertain. Raw-file writes loop over short writes and reject zero-byte writes, tracking only bytes actually written before syncing. An active/cancellation guard and pending-write drain prevent late response/persistence from changing a terminal stage or starting an extra request
- Cumulative stage files and prior indices are carried forward unchanged. Terminal ledger and file index are immutable new stage files. `awaiting_close_read` and `awaiting_review` are pending states, not full-trial success; the final possible successful state is `complete_unaccepted`
- Explicit artifact file allowlist, 30-day retention, no overwrites or recursively uploaded directories. Download pin verified from the official [v4.3.0 commit](https://github.com/actions/download-artifact/commit/d3f86a106a0bac45b974a628896c90dbdf5c8093)

Workflow-run history and immutable artifacts protect normal dispatch/rerun paths, not privileged administrative deletion or replacement of repository history. Do not delete prior runs/artifacts, rename stages, or alter the frozen workflow to evade consumption. If history is missing, expired, deleted, or uncertain, stop; do not assume zero previous calls. No automatic dispatch occurs on push, pull request, schedule, or workflow completion.
