# Isolated candidate support: corrective design and bounded pilot

## Why the first design failed

The [v1 live audit](../../eval/MEMORY-SUPPORT-RESULTS.md) returned a false `supported` judgment on the retained combined claim. The model acknowledged that the candidate's own quote omitted the reply, then borrowed another candidate's evidence from the same request. Stronger wording inside that shared full-chapter review is not an isolation boundary.

The unchanged failure evidence remains authoritative for v1. The original provider source and manifest are preserved at `c139ce3a8bfbbbe7c169c2387a109a2668215acb`; an exact source copy is archived with the same SHA-256 so later implementation changes cannot be mistaken for that experiment. No unused portion of its stopped four-call allowance is reused.

## Chosen correction

Keep whole-chapter/canon review for its existing purpose. Remove its ability to establish current candidate support. Add `auditMemoryCandidate`, accepting exactly one original `label` and its own `sourceQuote`. Reject extra fields and arrays at both client and server boundaries. Construct the upstream user message from those two strings only, with a dedicated fixed schema and a fresh request session identifier. Do not transmit IDs, draft text, context, other candidates, previous outputs or retrieval results.

Target identity and provenance stay in the domain: immutable original candidate, saved text/offsets, extraction attempt, project/state/source revisions, current review and one request attempt. Validate that binding before dispatch and again before attaching the result. The application, not the model, marks a successful response as an isolated assessment. The returned schema is only status and explanation; missing or malformed output is a failed attempt, distinct from a valid `unknown` judgment.

Each candidate has its own active attempt and retained history, using shared immutable snapshots rather than repeating full manuscript/context data per result. Starting a re-audit revokes that candidate's old active assessment and decision immediately. It does not reset other candidates' completed assessments or fact decisions. Edit, re-extraction, re-review, rejection, project/context changes and import invalidate stale authority. Cancellation and late responses cannot restore it.

Old bundled `memoryChecks`, even when they say `supported`, remain visible historical/advisory data and cannot enable new ordinary keep. Pending old keep decisions require a current isolated assessment or an explicit reasoned override. Accepted historical records remain historical; they are neither deleted nor relabeled as isolated or verified.

## Author control and cost

The default is one explicit per-candidate audit button, labeled as one additional model request. There is no extraction-time, chapter-review-time or acceptance-time fan-out. The author can reject an item without auditing it, or use the existing explicit reasoned override, which remains visibly unverified. A successful isolated assessment does not itself select or commit anything; ordinary keep and final acceptance are separate author decisions.

Before an audit, the UI checks the server's configuration and remaining lifetime-call allowance. That preflight can itself be cancelled or become stale; recheck before dispatch. The server remains authoritative against races, concurrency, rate and lifetime limits. Preserve results if allowance is exhausted. Do not silently restart the server, raise a cap, use another provider or retry.

For a successful chapter, writing + extraction + whole-prose/canon review remains **three base calls**; auditing K candidates adds K calls. Interview, planning, revisions, retries explicitly requested by an author, and prior chapters consume additional attempts. The unchanged server default is 10 lifetime attempts and maximum configured value is 30; a fresh three-call chapter leaves at most seven audits, while interview/planning can reduce that further. A 30-candidate schema limit is not a promise that all 30 fit the call allowance.

Token use is the sum of the separate fixed instructions, labels, quotes and responses. Isolation avoids repeatedly sending full chapters to each audit, but adds per-request overhead and may cost more than one bundled review. The separately approved four-case synthetic pilot reported 1,533 prompt and 210 completion tokens (1,743 total), with individual request elapsed times of 1.38–2.11 seconds. These short fixed quotes do not estimate chapter-scale token use, cost or latency; currency cost is unmeasured. Failed/cancelled dispatched requests may consume allowance or provider work; absent usage stays unknown. No cap, model, credential or balance setting is changed.

## Alternatives deliberately deferred

- Atomic subclaims or multiple evidence spans could improve representation, but automatic decomposition can drop attribution, time, causality or a second assertion. A supported subset cannot silently validate the unchanged parent claim. This needs a separate migration and authoring design
- Literal quote records can prove exact textual presence, but do not provide the same compressed semantic memory or prove world truth
- Explicit author attestations require no extra model call, but move the judgment burden to the author and do not satisfy the failed automatic-support criterion
- An optional future batch would need explicit K-call budgeting, sequential admission, per-result checkpoints and stop-before-next-dispatch semantics. No such batch is part of the normal UI

## Required evidence before integration

Offline contracts must establish the exact two-field request, absence of forbidden context sentinels, fresh sessions, original-label preservation, fail-closed legacy migration, independent candidate progress, budget/cancel/stale-result safety, and compact/pretty backup compatibility under the unchanged 2 MiB limit. Hosted browser tests must exercise the visible one-call control and unchanged author/fact gates.

A separate preregistered live audit must retain the original failed label/quote unchanged, include a clear positive control so always-unknown is not a pass, and record all mismatches or timeouts without replacement samples. It requires separate explicit approval; it is not run as part of offline implementation. Isolation removes the demonstrated supplied-evidence borrowing channel, but cannot guarantee that the model will not hallucinate from a label, misread the quote or follow embedded instructions. Integration remains conditional on semantic acceptance evidence, independent review and final CI; model judgments still require explicit author decisions.

## 2026-10-03 bounded live result

The [separately approved isolated pilot](../../eval/ISOLATED-MEMORY-SUPPORT-RESULTS.md) completed four calls on source `e8cd9d6d568cb16e0d09d030de248d29746504a1`, with all four preregistered expectations matched and no retries. The unchanged combined claim was judged unsupported because the reply was absent from its own quote. The literal positive was supported; unproven character belief and explicit negation with an embedded instruction were unsupported. The amended harness stops immediately on semantic as well as transport/schema/persistence failure.

This establishes the narrow four-case acceptance condition, not general entailment accuracy, truth, reliability, literary quality or long-form performance. The first bundled audit remains a failure with its original evidence intact. Engineering checks use mocked judgments and are reported separately.
