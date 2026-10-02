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
