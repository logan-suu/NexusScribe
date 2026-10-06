> Update, 6 October 2026: the separately approved one-call compatibility probe returned HTTP 200 and is now retired. See [result and limits](../eval/COMPATIBILITY-PROBE-RESULTS.md). The proposal below records the earlier offline repair design; it does not authorize another request.

# Provider transport contract and safe failure diagnostics

This repair is offline only. It does not authorize or schedule a provider call,
restore a retired experiment, change normal model settings, or establish the
cause of the [stopped HTTP-400 trial](../eval/CAUSAL-CONTINUITY-RESULTS.md).
There is no new live CLI, workflow, secret, retry or literary-quality result.

## Shared request construction

`server/provider-transport.js` exports the pure `buildProviderRequest` builder.
The application uses it; future independently approved harnesses should use the
same builder instead of hand-copying fetch headers. It never accesses the
environment or invokes fetch. It returns `{url, options}` with this contract:

- HTTPS endpoint supplied by the caller, without URL credentials, query or hash
- `method: 'POST'` and `redirect: 'error'`
- Exactly four explicit headers: `Content-Type: application/json`,
  `User-Agent: NexusScribe-demo/0.1`, `x-opencode-session: <v4 UUID>`, and
  server-only `Authorization: Bearer <existing credential>`
- A fresh UUID per builder invocation by default. Independent fixtures/arms and
  isolated memory audits must not pass a shared session. Ordinary application
  calls explicitly retain the existing process-session behavior; this patch does
  not change that behavior or promise provider-side context isolation
- The caller's serialized body passes through byte-for-byte. No model, prompt,
  temperature, thinking, reasoning-effort, token limit, stream setting, seed or
  message-history field is added or removed
- The caller supplies an AbortSignal and owns its timeout, authorization, input
  validation, call/token limits, durable attempt reservation and output handling

The User-Agent identifies NexusScribe honestly. The session header preserves an
established transport convention; it does not claim to be an official OpenCode
client. The normal application still defaults to 1,200 output tokens, a 30-second
deadline, no explicit temperature/thinking/reasoning-effort, and the existing
opt-in environment gates. Existing explicit settings retain their prior meaning.
The builder is not a stand-alone policy or authorization boundary.

## Narrow safe error diagnostics

For non-2xx responses, the application now attaches `transportDiagnostics` to
the server-side `ApiError`; the browser HTTP response remains the existing
generic code/message. No diagnostic is logged or persisted automatically.
`readProviderError` can also be reused by a future approved harness. It reads at
most 16 KiB of error-body content into retained chunks, uses the supplied abort
deadline while reading, and cancels the reader on completion/failure. An
oversized incoming chunk is rejected before retention; the network stack may
already have delivered more than the limit. There is no unbounded `text()`
fallback, retry, response-header logging or error-message extraction.

Only these four fields leave the helper:

- `httpStatus`: integer 100–599 or null
- `httpCategory`: `invalid_request`, `authentication`, `payment_required`,
  `permission`, `not_found`, `timeout`, `request_too_large`, `rate_limit`,
  `upstream_unavailable`, or `unknown`, derived only from HTTP status
- `providerCategory`: `authentication`, `permission`, `quota`, `rate_limit`,
  `model_unavailable`, `unsupported_parameter`, `context_limit`,
  `invalid_request`, `upstream_unavailable`, or `unknown`
- `bodyState`: `json`, `invalid_json`, `too_large`, `unavailable`, or `aborted`

Provider categories come only from exact allowlisted `error.code` and
`error.type` values in the module. Conflicting known code/type categories remain
unknown. Free-text messages, parameter names, identifiers, nested fields, URLs,
credentials, prose and reasoning never become diagnostics. Unrecognized shapes,
malformed JSON and unknown codes do not receive guessed semantic categories.
HTTP observations and provider claims are separate; neither proves an underlying
cause. A generic HTTP 400 still means only `invalid_request` unless an exact
recognized provider code/type supplies additional evidence. These fields do not
measure token usage or currency cost; absent usage remains unknown.

The existing `REQUEST_CANCELLED`, `UPSTREAM_TIMEOUT` and `UPSTREAM_ERROR` public
codes remain unchanged. Cancellation or timeout during error-body reading wins
over partially read diagnostics. No stack, raw response or arbitrary provider
text is attached to those errors.

## Offline verification and historical integrity

Run `node --test tests/provider-transport.test.js` and `npm run check`.
All provider transports in these tests are injected fakes. Tests cover exact
headers, historical successful-body bytes, all six frozen future-body shapes,
fresh independent UUIDs, preserved ordinary sessions and isolated input,
unchanged normal settings, error enums/redaction, oversized or malformed error
bodies, stalled readers, timeout, cancellation, cleanup and one-attempt limits.
This validates construction and safeguards, not provider compatibility.

The old diagnostic still reproduces the old runner's missing headers. The
workflows, request freeze, result report and every file under `eval/history/`
remain byte-identical. Four current runners add only the shared module to their
freeze inventories; their retired execution guards are unchanged. The four
current offline-replay manifests refresh those dependency hashes, including the
shared transport module, so changing it invalidates the current source freeze.
Historical source manifests and failed-request evidence are not rewritten.

## Minimum separate one-call probe proposal (not approved or implemented)

1. Obtain fresh explicit approval for exactly one transport compatibility
   request, with overage/balance spending disabled and no automatic retry or
   continuation. A previous six-call allowance is consumed and retired
2. Preregister a new protocol identity, exact source commit and passing CI, one
   immutable dispatch reservation, and the exact F1 baseline A body from
   `eval/causal-continuity-requests.json`. Its compact JSON request SHA-256 is
   `2b598fa0db1271b0024150b80afab36bf2bb86ae7573dedb5bbe3bb9c664241c`
3. Send to `https://opencode.ai/zen/go/v1/chat/completions` using the shared
   builder, honest User-Agent and one fresh UUID. Body: `deepseek-v4.1-flash`,
   `max_tokens: 3000`, `thinking: {type: 'disabled'}`, `temperature: 0.7`, and
   exactly the frozen system/user messages. No seed, reasoning_effort, alternate
   model, extra messages or prompt changes. Use a 120-second total deadline and
   128-KiB success-envelope ceiling, matching the retired trial's limits; the
   new error reader has its separate 16-KiB cap
4. Reserve the single attempt durably before dispatch. Use only the existing
   separately supplied credential, never include it in the preregistration,
   logs or artifact files. A timeout, network failure, malformed response,
   refusal or HTTP error consumes that attempt and stops
5. Retain only approved request/prose artifacts with credential/hidden-reasoning
   safeguards, plus whitelisted status, enums, elapsed time, finish reason and
   provider-reported numeric usage. Missing usage/cost stays unknown. Do not
   retain raw envelopes, free-text errors, headers or request/session IDs
6. Stop after that one request even on success. Report transport observations;
   no intervention arm, retry, model judge, manuscript acceptance or literary
   improvement claim. A successful response would support compatibility of
   this contract at that time, not prove what caused the previous HTTP 400

Any executable probe or secret-bearing workflow would be separate work after
that approval. This document is only a proposal and creates no dispatch path.
