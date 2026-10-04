# Demo acceptance record

> Historical design and validation record. Current selection authority is defined by [quote-grounded memory](QUOTE-GROUNDED-MEMORY.md): model support never authorizes a new paraphrase; explicit informed author attestation is required. Original experiment results below remain unchanged.

Date: 2026-10-02. This is a bounded prototype acceptance record, not a production or literary-quality certification.

## Real provider and domain checkpoint

[Live run 36979109822](https://github.com/logan-suu/NexusScribe/actions/runs/36979109822) used commit [`9650ec3531ab18fe19837c1f7ea5844c18b0de37`](https://github.com/logan-suu/NexusScribe/commit/9650ec3531ab18fe19837c1f7ea5844c18b0de37), OpenCode Go `deepseek-v4.1-flash`, requested `thinking.type=disabled`, and no reasoning-effort field.

- Exactly five synthetic requests: interview, planning, chapter generation, revision interpretation and review
- Each limited to 3000 output tokens; no retries, fallback or cap increase
- All five provider/schema actions passed
- Real generated output was staged without changing Canon; an isolated rejected branch remained uncommitted
- The edited draft was reviewed with exact version bindings, accepted, then compensated
- Safe domain summary: 2 staged events, 2 promoted events, 1 accepted chapter, `ACCEPTED_THEN_COMPENSATED`
- Compensation restored the tested Canon/events while retaining manuscript and history

Only the fixture, status codes and safe aggregate metadata are documented. Raw reasoning, provider output, prompts and credentials were not published. A successful request with a requested switch does not by itself prove zero internal reasoning tokens.

That earlier checkpoint proved a real provider-to-domain path for one synthetic chapter. The later bounded browser milestone below is separate evidence; neither proves general semantic correctness, independent factual review, long-form quality or production reliability.

## Browser and offline evidence

[CI run 36978756206](https://github.com/logan-suu/NexusScribe/actions/runs/36978756206) passed 132 unit/contract tests, the DOM workflows, production build and eight desktop/mobile Chromium scenarios at that checkpoint. Browser scenarios used offline or mocked provider data; they were not a browser session connected to the live model.

Actual Chromium screenshots were inspected against the design reference. Follow-up polish corrected technical patch presentation, model-mode labels and fixed-overlay screenshot capture. Desktop and mobile-sized layouts had no observed blocking display issue in the inspected states. This is not a cross-browser, physical-device or accessibility certification.

Subsequent deterministic coverage includes exact author boundaries in critic requests after project switching, and an in-flight review race. The current integration gate is `npm run check` plus `npm run test:e2e`; development integration must wait for the exact revision's green CI.

## Real browser plus real model: three short chapters

[Run 37033463722](https://github.com/logan-suu/NexusScribe/actions/runs/37033463722)
passed on tested commit `0d664452e01182e78df97bc7543b62019186a9a4` with nine real provider requests. The single
synthetic story completed interview/planning, chapter 1 generation/review/accept,
author setting edit/analysis/confirmation, and chapter 2/3 generation/review/accept.
Every mutation used visible browser controls; browser storage was read for
assertions, never injected to produce a passing result.

The actual continuation requests carried the confirmed setting and edited chapter
source. History correctly refused to undo the setting across dependent later
accepts. Reversing chapter 3/2 event commits and then the setting created three
compensations, restored the tested state, and preserved manuscript and revision
history through reload. The final aggregate was `journey PASS 9 3 3`.

Generation now uses validated paragraph references for deterministic exact quote
anchoring; legacy quote output remains strict. Editing away or moving event
evidence blocks acceptance instead of silently filtering the event. The tested
revision also passed [CI run 37032590299](https://github.com/logan-suu/NexusScribe/actions/runs/37032590299):
163 unit/contract tests, the DOM suites/build and 12 mocked desktop/mobile Chromium scenarios.

**Observed semantic limitation, not merely an untested claim:** the author-confirmed
setting said “小舟的纸灯是蓝色的。” but chapter 2 generated “小红纸灯”. The
model review flagged the color discrepancy as a warning, and also raised causal/
motivation concerns in chapter 3. Current gates block structural failures and
model `error` issues, while allowing explicit acceptance of `warning` issues. The
test driver accepted through that allowed UI path. Consequently this is an
operational integration pass with an observed setting-inheritance failure, not
semantic adherence certification.

All five synthetic screenshots were inspected as legible and privacy-clean. The
chapter 3 screenshot displays review rather than complete prose. Preserve the
blue-setting/red-lamp case for a separate inheritance regression and classification
design: verified author-fact contradiction versus subjective writing advice, with
explicit resolution. Promoting all model warnings to errors is not the chosen fix.

This is one desktop-Chromium integration trial with a target of roughly 100 Chinese
characters per chapter, not a normal-length novel or quality benchmark. The
model's own review is advisory; valid paragraph references prove location, not
semantic entailment. Longer prose, repeated reliability trials, independent
literary evaluation and production persistence remain unverified. Five synthetic
UI screenshots were generated; temporary artifacts are not durable manuscript
storage. See [full scope, diagnostic history and next milestones](LIVE-WRITING-JOURNEY.md).

## Source-review correction

A scoped source review found that equal-looking drafts in different projects could receive the wrong in-flight semantic report. The correction binds each review to its originating project, draft, run, target chapter, state, text, staging, source revisions and request context. Old incomplete bindings require re-review. Offline UI and browser regressions switch projects while the response is pending and ensure the target project retains its own blocking review.

This correction does not change the provider request protocol. It was validated with deterministic and mocked tests rather than another paid model call. No third-party audit or production security certification is claimed.

## Delivery boundary

Development source is integrated into `dev_v1.0` after its checks and review; `main` remains the release boundary. See [launch instructions](LAUNCH.md).

There is no deployed public or persistent online application endpoint in this acceptance. Localhost belongs to the machine running the app. GitHub Actions is temporary test infrastructure, and its repository secret does not configure another runtime.

Still outside this demo: authentication, database transactions, multiuser isolation, durable hosted deployment, backup import, comprehensive semantic inference, long-form evaluation, comparative benchmarks and measured financial cost per accepted chapter.


## Subsequent fact-review guard (2026-10-02)

The blue/red regression is now a policy-contract fixture: a model-supplied
contradiction with exact evidence blocks independently of warning severity.
Missing/unknown per-fact checks stay unresolved; explicit not_applicable is distinct.
Per-item author exceptions require rationale and current evidence/report binding,
are audited, and leave Canon unchanged. General errors and event anchors still block.
Fixtures for negation, dialogue and hypotheses test preservation of supplied
classifications, not automatic semantic understanding. No new provider accuracy,
long-form consistency or live-browser pass is asserted by these offline tests.


Exact tested source `5a65e74b64b371fe135df4ad67807c0e8dfbe684` passed
[CI 37038776898](https://github.com/logan-suu/NexusScribe/actions/runs/37038776898):
190 unit/contract tests, four DOM suites, build and 14 mocked desktop/mobile
Chromium scenarios. Four inspected screenshots show readable exact evidence,
revisions and author-rationale/Canon-retention state; overflow assertions passed.
The new reload fixture now seeds only absent storage, preserving the real persistence
check rather than overwriting accepted state during navigation.

[Probe 37039268803](https://github.com/logan-suu/NexusScribe/actions/runs/37039268803)
used one real provider call and returned one generic error plus one fact contradiction.
The engine rejected acceptance with `FACT_DECISION_REQUIRED`; no exception or
acceptance was inserted. This one positive synthetic case is separate from the
mocked browser exception UI test and is not an accuracy benchmark. No new full
live writing journey was run, and the prior journey belongs to its older revision.

## Subsequent local backup/recovery guard (2026-10-02)

Exact source `771c3497a7c3fad1ca2e642423288f993ddc8e49` passed
[CI 37042160359](https://github.com/logan-suu/NexusScribe/actions/runs/37042160359):
231 unit/contract tests, five DOM suites, build and 20 desktop/mobile Chromium
scenarios. Six inspected backup-specific screenshots show readable import preview
and explicit confirmation, corrupt-primary recovery warnings, and quota-failure
export/retry controls; overflow checks passed. An initial runner dependency-install
timeout was resolved by rerunning on a fresh hosted runner without source changes.

The increment preserves original project audit when importing into a new namespace,
invalidates pending approvals, avoids startup writes, and keeps failed text saves
in memory for export/retry. Testing was entirely offline with fictional data and no
live model calls. Local browser startup remained blocked by a socket permission;
the visual evidence comes from hosted CI. See [backup/recovery boundaries](BACKUP-RECOVERY.md)
for size limits, last-good lag, quota sharing, and remaining crash/concurrency risks.
This is bounded local recovery protection, not a production durability guarantee.

## Subsequent generation controls (2026-10-02)

Exact source `61fed3369795870369bf2db10bb12aa44ed25606` passed
[CI 37051765813](https://github.com/logan-suu/NexusScribe/actions/runs/37051765813):
251 unit/contract tests, all DOM suites, production build and 30 mocked
desktop/mobile Chromium cases. The first [run 37051275580](https://github.com/logan-suu/NexusScribe/actions/runs/37051275580)
passed 28/30 browser cases: both failures were the existing cross-project review
test expecting the former notification text. One assertion was updated to the
new cancellation status; request-source, blocking-review, project-state and
acceptance protections were retained, with no runtime behavior change.

Eight inspected screenshots from that first run, where all new controls cases
passed, show desktop/mobile waiting, cancellation, successful reported token
counts (12 input, 7 output, 19 total; reasoning unknown), and failure with author
edits retained. Status panels and billing caveats were readable; overflow checks
passed. Local Chromium startup was blocked by socket permissions, so rendered
verification used hosted CI.

The increment adds request-specific cancellation, duplicate-request protection,
exact authoring-snapshot guards against late results, and explicit manual retry.
Failure, cancellation, project changes, wizard close/reopen and reload were tested
with fictional providers; this increment made zero live model calls. Cancellation
propagates to the gateway/upstream where supported but remains best effort and
does not guarantee that provider processing or billing stops. Only provider-reported
numeric token counters are displayed; missing usage is unknown, totals are not
inferred, and no price estimate is made. These tests do not establish real-model
quality, actual billing behavior, or production durability.

## Prose-first implementation checkpoint (2026-10-03)

Source `77def9cb3a49cd6285e1dac116dace3ffea7f9b3`, initially opened as draft
[PR #8](https://github.com/logan-suu/NexusScribe/pull/8), passed
[CI 37096242786](https://github.com/logan-suu/NexusScribe/actions/runs/37096242786):
325 unit/contract tests, seven simulated DOM workflow suites, production build,
and 32 Chromium scenarios across desktop and mobile. Independent code review
found and reproduced one evaluation persistence/timeout race; the fix was
independently rechecked before publication. CodeRabbit was unavailable in the
files-only cloud workspace, so no CodeRabbit result is claimed.

The new tests cover exact raw prose preservation, deterministic Unicode/CRLF
paragraph offsets, immutable edited versions, separate extraction, malformed
and missing extraction, explicit retries, cancelled and stale completions,
source/context changes, import invalidation, faulted browser storage, model
review and existing author-fact conflict gates. The unchanged legacy generation
contract remains independently tested. Desktop/mobile screenshots were inspected
for the evidence cards and failure status; controls and quotes were readable,
buttons wrapped on mobile, and the tested overflow assertions passed.

These are engineering checks with synthetic/fake providers. They do not prove
literary quality, general extraction accuracy, billing behavior, cross-browser
reliability, production durability or a real-provider end-to-end authoring UI.
The new bounded live architecture experiment is recorded separately; earlier
real journeys apply only to their original revisions.

The separately bounded [live architecture pilot](../../eval/PROSE-PIPELINE-RESULTS.md) stopped at request six: five stages succeeded, one of three pairs completed, and legacy warm-fantasy generation failed JSON parsing. Both new prose/extraction cases passed structure; one inspected label overreached its quoted paragraph. No literary score, general semantic accuracy, or cost-saving claim is made.

Semantic acceptance boundary at the prose-first pilot revision: the model reviewer received candidate prose and confirmed facts, not extracted event labels. It does not automatically flag a label that exceeds an otherwise valid paragraph quote. The UI now explicitly tells the author that accepting the version commits the displayed memory proposals and requires their own label/quote inspection. Per-event keep/reject and candidate-specific support review were open work at that checkpoint; the subsequent increment below addresses the workflow gap, without an automated semantic guarantee.

## Candidate-selection increment (2026-10-03)

The existing review now receives the original memory labels and quotes. Explicit per-candidate keep/reject decisions and a final selected-count confirmation control promotion. Missing/unsupported judgments block ordinary keep; a reasoned author override preserves the original judgment and evidence. Existing fact-conflict and general error gates remain. Re-review, edits, re-extraction and pending imports invalidate old authority; original candidates and decisions remain auditable.

Independent review caught incomplete/error review envelopes, interrupted-audit accounting ambiguity, repeated full-snapshot storage amplification, a rejected-draft message that implied successful empty extraction, and an offline same-text re-review that failed to invalidate an open override dialog. All five findings were fixed and independently rechecked before integration. Audit snapshots now use shared immutable references without raising the 2 MiB cap. Offline tests cover exact dereferenced bindings, tampering, rejection/cancellation archives, import compatibility and realistic compact/pretty-export sizes. Verification for the final hosted source and separate bounded live support audit is recorded separately; earlier counts are not inherited as proof for this increment.


Exact source `c139ce3a8bfbbbe7c169c2387a109a2668215acb` passed [CI 37143679048](https://github.com/logan-suu/NexusScribe/actions/runs/37143679048): 391 unit/contract tests, eight DOM suites, build and 54 desktop/mobile Chromium scenarios. Six rendered screenshots were inspected; evidence, reasoned override, reject-all confirmation and cancelled/rejected state were readable. The initial browser run's four failures were an empty-container visibility assumption in test setup; the corrected helper checks visible prose, attachment and exact candidate count without weakening product gates.

The separate [live support audit](../../eval/MEMORY-SUPPORT-RESULTS.md) did **not** pass its key semantic case: the model called the retained combined label supported while acknowledging its own quote omitted part of the claim and borrowing another candidate's evidence. Request two then timed out; the batch stopped at 2/4 with one completed fixture, no retry and unknown second-call usage. Ordinary keep still becomes available for a false supported judgment. Draft PR #9 remains unmerged pending a decision on this failed live criterion; engineering success is not semantic success.

## Isolated corrective draft: no live semantic acceptance yet

The corrective draft revokes bundled-review support authority and introduces a strict label+own-quote-only request with a fresh session. The UI makes each extra request explicit, checks the unchanged process budget, and keeps per-candidate progress separate. Old reports remain historical rather than being relabeled as isolated. See the [design and cost boundary](ISOLATED-MEMORY-REVIEW.md) and the [future preregistered four-case audit](../../eval/ISOLATED-MEMORY-SUPPORT-PROTOCOL.md).

Offline regressions cover exact wire isolation, legacy denial, per-candidate replay/stale binding, cancellation, budget refusal, independent choices, backup migration and realistic 2 MiB exports. Independent review additionally found a cross-tab update during budget preflight and loss of a completed paid judgment on local save failure; the correction checks synchronous storage health before dispatch and retains valid returned results in memory for export/retry. Storage failure is never reported as a durable save, and retrying a save must not call the model again. Hosted results for the exact corrective head are recorded in [PR #9](https://github.com/logan-suu/NexusScribe/pull/9).

The completed v1 CLI is retired before any live dispatch, with its exact original provider/harness/test sources and hashes archived. The new isolated protocol is prepared only; no additional live call, semantic success, merge or deployment is claimed. Positive controls are required, so an always-unknown evaluator cannot count as a successful semantic correction.
