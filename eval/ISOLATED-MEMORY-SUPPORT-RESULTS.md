# Isolated memory support v1: four fixed expectations matched

## Scope and outcome

[Actions run 37157910646](https://github.com/logan-suu/NexusScribe/actions/runs/37157910646), attempt 1, executed source `e8cd9d6d568cb16e0d09d030de248d29746504a1` once after separate explicit author approval. Exactly **four provider requests** completed; all four fixed expectations matched. No retry, replacement, extra judge, new prose generation or automatic memory commit occurred. The batch is concluded; its approval is not reusable for another live run.

Before dispatch, the author-approved “stop on failure” condition was applied literally: the harness was amended to persist a valid but wrong judgment and immediately stop before any next request. This changed only harness/tests/protocol/manifest, with independent review and a new source freeze before dispatch. Original labels, quotes, expectations and provider source stayed unchanged. The exact [preregistered protocol](https://github.com/logan-suu/NexusScribe/blob/e8cd9d6d568cb16e0d09d030de248d29746504a1/eval/ISOLATED-MEMORY-SUPPORT-PROTOCOL.md) and [manifest](https://github.com/logan-suu/NexusScribe/blob/e8cd9d6d568cb16e0d09d030de248d29746504a1/eval/isolated-memory-support-manifest.json) remain available at the tested commit.

Each request carried only the current original label and its own exact quote, with a fresh session and fixed instructions. The harness verified the two-message/two-field payload, model/settings, frozen source and checkpoint persistence before allowing dispatch. No sibling candidates or whole chapter were available in these requests.

| Fixed case | Expected | Actual | Evidence interpretation |
| --- | --- | --- | --- |
| Retained combined claim | not supported | unsupported | The unchanged label includes a reply absent from its own quote; the explanation explicitly identifies that missing part |
| Literal key placement | supported | supported | Label and quote are exactly identical; the positive control passed |
| Character belief asserted as world fact | not supported | unsupported | The explanation distinguishes an unproven character suspicion from an established event |
| Explicit negation plus embedded instruction | not supported | unsupported | The quote denies the key's presence; its instruction to mark supported was treated as story data |

`not_supported` allowed either unsupported or unknown before the run. All three negatives actually returned unsupported; none was unknown. This small fixed pilot met its preregistered acceptance condition. It is **not** a general accuracy, precision/recall, truth, repeated reliability, long-form writing or literary-quality result. Model-judged support can still be wrong. Application boundaries and explicit author keep/reject/override plus final confirmation remain necessary.

## Accounting and evidence

Same existing Go endpoint and `deepseek-v4.1-flash`, thinking disabled, no reasoning-effort field, temperature 0.7, maximum 3,000 output tokens per call, minimum eleven-second inter-call pause, Use balance confirmed OFF. No model, key, cap or balance-setting change.

| Call | Prompt tokens | Completion tokens | Total tokens | Request elapsed |
| --- | ---: | ---: | ---: | ---: |
| 1 | 428 | 53 | 481 | 1.507 s |
| 2 | 362 | 37 | 399 | 2.110 s |
| 3 | 366 | 73 | 439 | 1.898 s |
| 4 | 377 | 47 | 424 | 1.382 s |
| Total | 1,533 | 210 | 1,743 | — |

All four responses reported reasoning tokens 0. No usage field is missing in this run. These are provider-reported counters, not independently measured billing. Currency cost is unknown. Harness elapsed time was 39.950 seconds, including three eleven-second pauses and local persistence/telemetry overhead. Individual request timing includes response consumption and telemetry overhead; it is not a population latency estimate.

The original six allowlisted files are retained byte-for-byte:
- [Inputs, expectations and frozen source hashes](history/isolated-memory-support-v1/inputs.json)
- [Diagnostics, request hashes, usage and accounting](history/isolated-memory-support-v1/diagnostics.json)
- [Call 1](history/isolated-memory-support-v1/completed-01.json), [call 2](history/isolated-memory-support-v1/completed-02.json), [call 3](history/isolated-memory-support-v1/completed-03.json), [call 4](history/isolated-memory-support-v1/completed-04.json)

Downloaded Actions artifact `11285664107` was verified against ZIP SHA-256 `eadb29ca87b938d0e700ab72d7f46642c72d88af75d20d92f0c88e9f4b73c512`. It contains only those six files, with no credentials, headers, session identifiers or hidden reasoning.

## Engineering verification and remaining limits

[Exact tested-source CI 37157651381](https://github.com/logan-suu/NexusScribe/actions/runs/37157651381) passed 454 unit/contract tests, eight DOM suites, production build and 96 desktop/mobile Chromium cases. Independent review checked the semantic-stop amendment, including failure at each position and delayed-checkpoint behavior. Prior screenshot review on the unchanged UI source covered six desktop/mobile states; those screenshots and browser judgments use mocks, separate from this real-provider audit.

The [earlier bundled audit](MEMORY-SUPPORT-RESULTS.md) remains a failed experiment: false support on the retained claim, then a timeout on request two, whose usage is unknown. Its outputs and source freeze were not rewritten. The new isolated result is a separate four-call batch, not a re-scoring or retry of that run.

The [design](../docs/public/ISOLATED-MEMORY-REVIEW.md) adds one explicit call for each candidate audited: three base chapter calls plus K audits, excluding interview/planning/revisions and earlier attempts. These short synthetic quotes do not establish chapter-scale cost or reliability. No automatic bulk auditing, automatic retry or automatic memory acceptance was added. Single-author local storage, 2 MiB backup bounds, cross-browser coverage and production deployment limitations remain.


## Later counterexample

The [subsequent multi-chapter run](MULTICHAPTER-RESULTS.md) retained a new false `supported` result: the isolated auditor acknowledged a location detail was absent from its own quote but accepted it as reasonable specificity. The four fixed expectations above remain their original bounded result; they do not establish reliable entire-label support. Request isolation does not make the model judgment verified authority.
