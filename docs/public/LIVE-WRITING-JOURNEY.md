# Bounded real-browser writing journey

The manual `.github/workflows/live-smoke.yml` workflow now runs the three-chapter
browser milestone. The older standalone `scripts/live-smoke.mjs` and its offline
regressions remain available. Ordinary PR/push jobs do not receive provider secrets.

Dispatch the reviewed feature ref explicitly with `approve_live_smoke: true` and
`test_scope: journey` for the full browser test. The default scope is the one-call review probe; an omitted or unknown scope
runs neither test. A full journey always requires explicit scope selection.
The runner needs the repository's existing `NEXUS_API_KEY` secret. Never copy that
secret into source, browser storage, screenshots, reports or workflow inputs.
The approval includes confirmation that provider overage / Use balance is off.

## Accepted bounded milestone (2026-10-02)

[Real-browser run 37033463722](https://github.com/logan-suu/NexusScribe/actions/runs/37033463722)
passed on tested commit `0d664452e01182e78df97bc7543b62019186a9a4` with `journey PASS 9 3 3`.
[CI run 37032590299](https://github.com/logan-suu/NexusScribe/actions/runs/37032590299)
passed 163 unit/contract tests, DOM suites/build and 12 mocked Chromium scenarios.
The real-browser operational checks established:

- Nine actual provider calls, with no retries or mocked provider replies
- Three short synthetic chapters generated, reviewed and accepted by the test driver through UI controls
- An author-confirmed setting entered through chapter 1 editing/analysis and present in the actual chapter 2/3 request context
- Direct setting undo correctly blocked while later accepted chapters depended on it
- Three compensations through History: chapter 3 events, chapter 2 events, then the setting
- Tested state restored while manuscript/revisions/history were retained; reload verified
- Five UI milestone screenshots produced as temporary workflow artifacts and inspected for legibility/privacy

This establishes this single bounded integration path, not full-length chapter
quality, independent semantic correctness, repeated-run reliability or production
readiness. The target was roughly 100 Chinese characters per chapter; the harness
did not certify an exact length. Checking request context proves that the setting
was supplied, not that every literary consequence was independently evaluated.
The real-model browser run was desktop Chromium; mobile coverage remains mocked.

### Observed semantic failure despite operational completion

The confirmed setting was “小舟的纸灯是蓝色的。” Yet the generated chapter 2
contained “小红纸灯”. The model review itself raised the color conflict as an
advisory warning. It also noted causal/motivation gaps in chapter 3. The existing
acceptance gate blocks structural errors and model issues marked `error`, but
permits author acceptance of `warning` issues; the test driver exercised that
permitted path. Thus a finished workflow did not prevent this observed setting
contradiction, and the run is not a pass for precise setting inheritance.

All five screenshots were inspected as readable and privacy-clean. The chapter 3
capture shows its review section rather than the full chapter prose, so those
screenshots are not a complete manuscript-quality review.

Preserve the blue-setting/red-lamp case for the next scoped inheritance evaluation:
separate objectively source-backed author-fact contradictions from subjective style
advice, retain referent/evidence checks, and require an appropriate resolution path.
Do not simply turn every model warning into a blocker. The current milestone
makes no claim that this classification or resolution design is implemented.

Earlier manual diagnostics were not silently omitted: full journeys stopped after
6, 7 and 6 attempts; isolated review and generation probes used one attempt each.
Together with this successful 9-call journey, this milestone's reviewed runs used
30 provider attempts. Each run stopped on its first provider failure, with no
automatic retry. Actual currency cost was not measured. See the observations below.

## Fact-inheritance guard revision (offline milestone)

The subsequent implementation adds a separate per-author-fact assessment ledger.
Every confirmed explicit author fact is bound to its record version and original
revision evidence. Contradiction and unknown assessments block direct acceptance,
independent of generic issue severity; missing assessments become visible unknowns.
An assessed not_applicable permits scenes that simply do not involve the fact.
No lamp/color keyword rules infer these semantic classifications.

An explicit per-item author exception requires reviewing the evidence and supplying
a reason. It is bound to the current report, candidate, run, project and fact version,
recorded in acceptance history, and never changes Canon. Editing or re-reviewing
invalidates it. Correcting Canon still uses the existing explicit author patch flow.
General model errors and structural/paragraph-source guards remain independent.

The offline cases supply model classifications to prove binding and gate behavior;
they do not measure semantic accuracy. Referent, time, negation, dialogue and
hypothesis interpretation remain model-dependent. No new live result is claimed
by this section. The one-call review-probe now creates a synthetic source-backed
author fact through the domain patch API, supplies an intentionally contradictory
red-lamp candidate, and requires both a model contradiction assessment and a blocked
engine accept attempt. It never records an author exception or accepts the candidate.
Unknown, missing, consistent or not_applicable judgments fail this positive test
without retries; failure logs fixed reason codes only. This probe is distinct from
browser UI validation and is not an accuracy percentage. The earlier 9-call journey remains historical evidence of the
failure that motivated this revision; a current live journey may now stop on an
unresolved fact instead of accepting it as a warning.

## Remaining milestones

1. Precise inheritance: preserve the blue-setting/red-lamp regression case and distinguish source-backed contradictions from subjective warnings
2. Explicit event rejection/rebinding and valuable-draft recovery when evidence fails
3. Longer chapters, repeated multi-chapter trials, interruption/recovery cases, and independent author assessment of consistency and literary quality
4. Durable storage/import/backup, transactional safety, deployment and security review
5. Longer-form and baseline comparisons, plus measured cost per accepted chapter

These are future work, not additional completed acceptance claims.

## Bounded scope

- One entirely fictional short Chinese story, desktop Chromium at 1440×1000
- Live interview and three-chapter planning, then generate/review/accept chapter 1
- Edit chapter 1 prose through the editor, analyze it, explicitly confirm one setting
- Generate/review/accept chapters 2 and 3 with the edited setting in their actual context
- Verify that undoing the setting across dependent accepts is blocked
- Compensate the later event commits in reverse order, then compensate the setting
- Verify confirmed state restoration, preserved manuscript/history, and reload

All changes use visible UI controls. Browser storage is read only for assertions;
no test state is injected. The backend validates the actual continuation request's
fact and source context. Provider replies are neither mocked nor intercepted.
A model's semantic review is advice, not independent proof of literary quality or
correctness. A blocking review stops the journey instead of forcing acceptance.

Expected live calls: 9. Hard session cap: 12. Output cap: 3000 tokens per call.
Provider: OpenCode Go / `deepseek-v4.1-flash`, `thinking: {type: "disabled"}`;
`reasoning_effort` is omitted. Calls are spaced at least 11 seconds apart. There
are no retries or automatic reruns; the first provider error closes the session.
The entire manual job has an eight-minute limit. These request/token limits do
not establish a currency spending cap; provider billing controls remain necessary.

Both servers bind to 127.0.0.1. Credentials exist only in the execution step's
server environment. Browser egress is restricted to the loopback app. Logs are
fixed statuses and numeric counters; raw provider responses, reasoning, traces,
HTTP logs, console bodies, browser storage and HTML reports are not uploaded.
The sole artifact is successful synthetic UI milestone screenshots (seven-day
retention). Earlier screenshots may be present even when a later step fails;
only `journey PASS` establishes completion. No screenshot contains the API key,
which never enters the browser or model prompt.

## Offline validation

`npm run check` includes configuration, stop-on-error, budget, concurrency and
pacing tests for the guard. This does not contact a provider or execute the real
browser journey. `node --check scripts/live-writing-journey.mjs` checks syntax.
The Browser plugin is not available in the cloud task. Local browser socket use
is restricted, so real Chromium execution runs on GitHub-hosted CI only.

## First live observation and targeted follow-up

The first run passed interview, planning, chapter 1 generation/review/acceptance,
and setting interpretation. Chapter 2 generation failed strict output validation
on provider attempt 6; the runner stopped immediately. This is a partial result,
not a three-chapter pass. Raw model output was deliberately not retained, so the
specific failed field cannot be reconstructed from that run.

Offline inspection found an input ambiguity: outline targets use `chapter-2`
while manuscript source references use `ch2`. The backend now explicitly includes
the selected outline ID as `input.chapterId` and explains the distinction in the
model schema. Returned IDs and exact source quotes remain strictly checked;
nothing is silently normalized. Offline regressions cover the mixed-ID request
and rejection of wrong IDs. Future failures may log one allowlisted validation
reason (JSON, schema, target ID or exact quote), never field values or model text.

A second bounded run passed chapter 2 generation, including the edited-setting
context assertions, then stopped on chapter 2 review at attempt 7. Its aggregate
`OUTPUT_SCHEMA` reason does not establish which review field failed. Review
validation now distinguishes field shape, summary, issue shape/severity,
explanation, quote shape/exact candidate match, and checks. The prompt clarifies
that older/planned source text is reference material; issue evidence must quote
the candidate, and unsupported/global uncertainties belong in the summary as
review limitations. Blocking concerns remain blocking; validation is not relaxed.

For isolated investigation, dispatch `test_scope: review-probe`. This sends
exactly one invented `reviewChapter` request with prior accepted prose, an
explicit setting and current/future planning placeholders. It is not a replay of
the failed candidate (that raw response was not retained), and is not browser E2E.
It has hard cap 1, output cap 3000, disabled thinking and no retries. The probe
logs only contract status plus issue/error counts or an allowlisted failure reason;
even a schema-valid blocking review is reported faithfully. No dependencies,
browser, screenshots or story payload artifacts are needed for this probe.

A later full run stopped on attempt 6 with `STAGING_QUOTE_MISMATCH`: a proposed
event quote did not occur in that response's generated prose. This is a precise
failure observation; it does not prove that earlier generic failures had the same
cause. The new generation wire format returns `paragraphs[]` plus zero-based event
`sourceParagraphIndex` references into those newly generated paragraphs. The
server validates bounded single-paragraph strings and integer/range constraints,
joins them with newlines, and derives exact quotes verbatim. Unsupported proposals
belong in review notes, not invented references. Legacy text/quote responses still
undergo the original exact-match check. No punctuation normalization, fuzzy
matching, fabricated quote or automatic event removal is performed. A paragraph
reference does not prove that its event label is semantically true.

`test_scope: generation-probe` performs one synthetic chapter-2 generation with
competing previous/planned sources and an explicit setting. It has cap 1, output
cap 3000, disabled thinking, no retries, no raw response logging and no artifacts.
It is not a replay of a discarded live response or proof of the complete UI flow.

The generation probe logs attempt count, proposed event count, paragraph-anchored
event count and review-note count. A zero-event result provides no positive evidence
of anchor use. Accepted paragraph references retain revision-local paragraph IDs.
If subsequent editing removes an event quote or moves its anchored paragraph,
structural review and acceptance now block instead of silently dropping that event.
The author may restore the evidence/paragraph position or reject and regenerate;
individual event rejection/rebinding and draft quarantine UI remain future work.
