# Memory support audit v1: key counterexample missed, then timeout

## Outcome

[Actions run 37143836878](https://github.com/logan-suu/NexusScribe/actions/runs/37143836878), source `c139ce3a8bfbbbe7c169c2387a109a2668215acb`, ran the [frozen protocol](MEMORY-SUPPORT-PROTOCOL.md) once. It stopped after **2 of at most 4 requests**: the first review completed; the second timed out after 30 seconds. No retry, replacement sample, extra model, new prose, extraction, paid judge or automatic memory commit followed. Remaining calls were not attempted.

The completed review **missed the exact semantic defect this increment aimed to detect**. Its original combined label and quote were retained verbatim from the prior prose-pipeline pilot:

- Label: 阿陶催促程岚问点什么，程岚回应先问锁、收费低
- The candidate's quoted paragraph contains 阿陶's prompt but not 程岚's reply
- The model returned `supported`, while its explanation explicitly acknowledged the omission and borrowed the separate `retained-reply` candidate's quote / whole chapter to justify the combined label

This violates the preregistered whole-label, own-quote criterion. It is not an offset or JSON-schema failure. The exact response is in [completed-01.json](history/memory-support-v1/completed-01.json). No label, quote, expected judgment or returned assessment was rewritten to make this appear successful.

The second candidate, the separately quoted reply, was also classified `supported`, matching its preregistered editorial expectation. That label uses 回应 (responded), whose relationship to the preceding turn is interpretive when inspecting only the isolated quote; the preregistered caveat still applies. This one match does not offset the clear false support above.

Only **2 of 11 planned candidate assessments** were returned. The three multi-claim/time candidates received no usable response before timeout; the six belief/negation/instruction/identity candidates were never called. They are untested, not correct, rejected or model-judged unknown. No general accuracy, precision/recall, robustness or literary-quality conclusion is available.

## Calls, usage and evidence

| Request | Fixed fixture | Outcome | Reported prompt | Reported output | Reported total | Request elapsed |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| 1 | Retained cross-paragraph counterexample | Valid review; false support on combined label | 1,479 | 282 | 1,761 | 2.323 s |
| 2 | Multi-claim and time | `UPSTREAM_TIMEOUT` | Unknown | Unknown | Unknown | 30.001 s |

Known reported usage is 1,761 total tokens for the first call only. The second request was dispatched and may have consumed provider work or allowance; its usage and billing are unknown, never counted as zero. The first response reported zero reasoning tokens; that is provider telemetry, not proof of internal computation. No currency estimate is made.

All requests used the existing Go endpoint/model `deepseek-v4.1-flash`, requested thinking disabled, no reasoning_effort, temperature 0.7 and a 3,000-output-token cap. An eleven-second throttle separated requests. Total measured workflow time was 43.337 seconds, including throttle/checkpoint overhead. The first validated output was checkpointed before the second call and survived its failure.

The [evidence directory](history/memory-support-v1/) includes exact fixed inputs/expectations, the one completed review, and safe diagnostics for both dispatched requests. The artifact SHA-256 was `0947677176e88853e692be1fc91a2d72fcf2bd41da87d8a1175affc09d0286ad`. No invalid body, hidden reasoning, credential or invented timed-out response is retained.

## Product consequence and integration boundary

Explicit per-candidate author selection, version binding, original evidence retention, reasoned overrides, rejection of all candidates and selected-only commits work as engineering controls. Missing/unsupported model judgments block ordinary keep. **At the audited source, a false `supported` judgment still enables ordinary keep**, and this pilot observed exactly that failure. Final author selection remains required, but it cannot be advertised as an automatic quote-entailment guarantee.

The existing review combines whole-prose/canon review with candidate support assessment. Strong instructions did not prevent cross-candidate evidence borrowing in this run. A future design should evaluate genuinely isolated candidate evidence or a better claim/evidence representation, and validate it separately. That could change calls, tokens, latency or author interaction; no extra live experiment is included here.

[Engineering CI 37143679048](https://github.com/logan-suu/NexusScribe/actions/runs/37143679048) passed on the exact source: 391 unit/contract tests, eight DOM suites, build and 54 desktop/mobile Chromium cases. Those checks use fictional/fake model judgments. Six rendered screenshots were inspected for candidate evidence, overrides, reject-all confirmation and rejected-extraction status; mobile quotes and controls wrapped readably, and tested overflow/focus checks passed. These engineering results do not turn the failed live semantic audit into a pass.

The initial CI run had 50/54 browser cases pass; four failed only because the shared mounting helper required an intentionally empty candidate container to have visible dimensions. The test now verifies visible prose, attached candidate container and exact candidate count. Runtime safeguards and the failed/rejected-state assertions were unchanged.

**This increment remains in draft PR #9 pending a decision on the failed live criterion.** It has not been merged into `dev_v1.0`, released to `main`, or deployed. The bounded audit is finished at its stopping condition; no further live calls are authorized by this result itself.

## Later offline correction

A subsequent unmerged implementation separates per-candidate auditing into a strict label+own-quote request and removes ordinary-keep authority from old bundled judgments. Its design and costs are documented [separately](../docs/public/ISOLATED-MEMORY-REVIEW.md). The v1 live CLI is retired before configuration or dispatch so it cannot rerun with a changed provider prompt; exact original provider/harness/test sources retain their original hashes in this audit's history. These maintenance changes do not alter the failed output or expectations above, and no isolated live result has been obtained.
