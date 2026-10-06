# One-call transport compatibility protocol, 6 October 2026

Protocol identity: `transport-compatibility-20261006`. The user explicitly approved
one compatibility request on 6 October after the transport repair. This is a new,
one-attempt authorization, not the old six-call literary experiment. That old
experiment and its five unused slots remain retired. Do not retry this protocol,
including after timeout, network failure, refusal, malformed output, or HTTP error.

## Preregistered request and scope

- Endpoint: `https://opencode.ai/zen/go/v1/chat/completions`
- Frozen request: first F1 baseline A in `causal-continuity-requests.json`
- File SHA-256: `5701b71bf86b7db9675095872606234b324a0e6e39930f6484000a45dff3fe73`
- Exact compact request SHA-256: `2b598fa0db1271b0024150b80afab36bf2bb86ae7573dedb5bbe3bb9c664241c`
- Body preserved byte-for-byte: `deepseek-v4.1-flash`, `max_tokens:3000`,
  `thinking:{type:'disabled'}`, `temperature:0.7`, frozen system/user messages
- No seed, reasoning_effort, new context or additional messages, alternate model,
  B arm, quality comparison, model judge, adoption, retry or continuation
- Shared `buildProviderRequest`: honest `NexusScribe-demo/0.1` User-Agent,
  fresh UUID `x-opencode-session`, JSON content type, server-only Bearer credential,
  POST and redirect rejection. Session ID and headers are never retained
- Total transport deadline: 120 seconds, including stream consumption
- Success envelope: maximum 128 KiB retained in memory; error reader: 16 KiB.
  Oversized chunks are rejected before retention; network buffers can be larger
- Existing Actions `NEXUS_API_KEY` secret only. Never read/export/reveal it
- The user's existing confirmation that Use balance is off is carried forward.
  No fresh provider-console check is claimed and this harness cannot independently
  enforce that account setting. Missing cost or usage is unknown, not zero

## Exact source, offline review and durable reservation

The new manifest freezes the runner, shared transport, workflow, protocol, request
file and offline tests. It is checked before execution. Independent review and
passing full CI must precede dispatch on dev_v1.0. The actual merged SHA and exact
successful CI run ID are supplied as immutable workflow-dispatch inputs and checked
against the current run and CI API before request execution. This records the
source without a circular self-referential commit hash inside the source files.

The Actions run is the global durable one-attempt reservation: the workflow accepts
only one recorded run in its entire history, first attempt only, correct workflow,
identity, ref and exact source. A failed preflight also prevents another dispatch;
ask for fresh approval if no request occurred. Workflow concurrency is serialized,
not cancel-and-replace. Deleted history or an old-source rerun does not grant new
authorization and must never be used to bypass these guards.

The prepare step writes and fsyncs an exclusive reservation containing source SHA,
CI ID, run ID, request hash, manifest hash, bounds and zero remaining attempts. A
pinned upload-artifact action durably stores it before the provider credential is
introduced in the subsequent step. The execute step rechecks history, CI, source
freeze and reservation. An exclusive fsynced local dispatch record precedes the
single fetch. No transport is allowed before successful reservation upload.

## Evidence and interpretation

Retain only reservation, dispatch, safe result and hashed index JSON artifacts.
No raw response, prose text, reasoning, response headers, request/session IDs,
provider free-text error messages or credentials are persisted. Success records
whitelisted HTTP status, finish reason, elapsed time, bounded bytes, content hash
and character count, and provider-reported nonnegative integer token usage.
Errors retain only the shared reader's status and allowlisted diagnostic enums.
No arbitrary exception text is logged. Raw error-body size and usage are not known.

A 2xx envelope containing one nonempty assistant content response, finish_reason
stop, no refusal/tool call/hidden reasoning and valid bounds is labeled
`compatible_response`. Other outcomes are stopped, with safe categories. A length
finish can still mean the request was accepted but is not called a completed
compatible response. This is transport evidence at the time of the request, not
proof that the old missing headers caused HTTP 400. It establishes no literary
quality or long-form-memory improvement. No manuscript or prompt is accepted.

After the single run: report immediately, preserve safe artifacts byte-for-byte,
retire the executable workflow and live CLI, review changes and verify exact-source
CI. Keep main at its initialization commit; no release or deployment.

Offline checks: `node --test tests/compatibility-probe.test.js`, `npm run check`,
plus repository Chromium CI. All test provider transports are injected fakes.
