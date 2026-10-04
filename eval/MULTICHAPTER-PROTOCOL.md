# Synthetic three-chapter browser validation, version 1

**Concluded:** [the one-shot result](MULTICHAPTER-RESULTS.md) stopped at eight calls and retained a false positive. The live CLI is retired; only credential-free CI replay remains enabled. The original frozen specification is at `eb7b8826aa9a0ab360073bdaf69fe1c07000531b`; the historical protocol below grants no new execution permission.

## Question and limits

Can the current application carry one wholly synthetic story through three successive real prose generations, visible memory decisions and chapter acceptance, while sending current accepted prose, a newly confirmed author fact and selected current-source memory into later requests?

This is a **single bounded workflow and continuity observation**, not a paired architecture experiment, blinded literary comparison, statistical benchmark or whole-book quality claim. It does not complete or amend any previous pilot. Historical inputs, outputs and failures remain unchanged. Prior fixture builders now call the current context implementation; an old manifest does not authorize rerunning them as if their effective inputs were unchanged.

The [retained-prose close reading](RETAINED-PROSE-CLOSE-READING.md) supplies the motivation: readable small scenes do not prove continuation quality, and paragraph/length counts do not measure literary merit.

## Frozen synthetic setup

The exact fixture is [multichapter-fixtures.mjs](multichapter-fixtures.mjs). A fresh isolated browser context is seeded once, before the app loads, with its confirmed synthetic project, three fixed chapter plans, the short reference passage, and two explicit author facts. This deliberate setup bypasses interview and planning calls; it is not evidence that those flows work. No existing user workspace or manuscript is read, uploaded or overwritten.

The fixture concerns 许宁, 阿青, paper fragments and a locked cabinet. It asks for 350–500 Han characters and 4–7 paragraphs per chapter, restrained voices, causal small-scene development, a limited viewpoint, preserved hearing and knowledge boundaries, and an unresolved sender. The three goals are frozen before dispatch. No creative replacement, best-of selection, prompt amendment or reroll is permitted.

After setup, every story mutation occurs through visible browser UI: generate, extract, review, independently audit, keep/reject, accept, edit accepted text, confirm an author fact, and change model mode. Programmatic reads of saved state and pure verification helpers are allowed. The live path uses Chromium against the actual Vite application and guarded local HTTP service. It does not mock browser responses or replace the domain acceptance flow.

## Exactly twelve possible paid stages

The fixed order is four calls for chapter 1, then chapter 2, then chapter 3:

1. Generate prose with the current saved workspace context
2. Extract proposed memory from that exact saved prose
3. Review the whole chapter and all confirmed author facts
4. Independently audit **the first extracted candidate in returned order**, using only its original label and its own exact source quote

The fourth result must be `supported`. The UI then keeps that first candidate, rejects every other candidate without additional model calls, and explicitly confirms acceptance of the prose and selected memory. This is a fixed sampling/selection rule, not a claim that the other candidates are false or that the first is important. Rejected labels do not erase facts expressed by the accepted prose. Selecting a model-supported candidate remains a fallible synthetic author choice, not independent semantic validation. No override, candidate substitution or second audit is permitted.

Immediately after chapter 1 is accepted, the UI switches to offline-template mode, appends the exact fixed sentence “寄存室的铜铃已经损坏，不能发出声音。” to the accepted chapter, selects it as a new author fact and confirms the patch. These steps make **zero model calls**. The UI then switches back to server mode. This is a local text/fact-confirmation test; it does not test live model interpretation of a revision.

The amendment intentionally creates a new source revision. Chapter-1 memory remains in history but is excluded from current context because its provenance points at the earlier revision. Checks must establish that the original prose version and memory history survive, the new fact reaches chapters 2 and 3, and chapter 3 receives the selected chapter-2 memory with its current exact-source provenance. All preceding accepted prose, including content whose proposed labels were rejected, must remain in later context.

## Authorization, provider and cost controls

- Manual dispatch only, in the existing live workflow's distinct `multichapter` scope
- A single batch; `GITHUB_ACTIONS=true` and `GITHUB_RUN_ATTEMPT=1` are mandatory
- Explicit `NEXUS_MULTICHAPTER_APPROVED`, live-enabled and Use balance OFF confirmation flags must all be true
- Endpoint: `https://opencode.ai/zen/go/v1/chat/completions`
- Model: `deepseek-v4.1-flash`; thinking disabled; no `reasoning_effort`
- Temperature 0.7, applied in the guarded transport wrapper; no seed claimed
- At most 12 outbound requests, 3,000 maximum output tokens each: 36,000 is a ceiling, not actual usage, price or billing
- Sequential calls with an 11-second minimum inter-stage throttle; no retries, provider fallback, top-up, extra judge calls, model switches or automatic restart
- Only the existing `NEXUS_API_KEY` Actions Secret enters the selected live step; never read, display, copy or persist credentials
- The script cannot independently verify the provider's Use balance setting; the separate manual confirmation remains necessary

The output directory must be new. An interrupted or failed batch remains terminal. Another dispatch requires a new explicit decision and a separately identified protocol; neither an Actions rerun nor deleting evidence to restart is authorized.

## Hard stops and descriptive literary failures

Stop the entire batch immediately on provider/transport failure, timeout, truncation, refusal, malformed output, protocol/order/budget violation, persistence failure, browser/UI failure, empty extraction, unknown/unsupported first-candidate audit, blocking whole-chapter review, or any failed propagation/provenance assertion. No next throttle, next paid stage, silent fallback or attempt to repair the result follows a hard stop. UI-action/receipt waiting is bounded at 60 seconds, allowing the 11-second throttle, existing provider deadline and evidence writes; a missing request cannot hang indefinitely. Current domain fact gates must also be clear before the audit proceeds.

Length and paragraph misses are recorded as **literary-contract failures**, rather than transport or semantic hard stops. The chain may continue within the same budget so continuity can still be observed. No padding, truncation, automatic prose editing or extra calls are permitted. Any such miss prevents a fully compliant quality verdict; workflow completion does not make the writing acceptable. Other prose judgments are made afterward through explicitly non-blind assistant close reading, with quoted evidence and uncertainty separated from contradiction. No aggregate literary score, win rate or superiority claim is computed.

## Evidence and accounting

`inputs.json` is saved before the first possible call and contains the fixed fixture, exact synthetic initial workspace and verified source manifest. Each outbound call requires a durable `request-NN.json` and prepared diagnostics before dispatch. Requests are checked against the browser stage's expected action/input, fixed provider settings and independent transport ceiling. Each validated result is immediately written to immutable `completed-NN.json` before a subsequent call can be armed. Prose is independently saved by the UI before extraction.

Checkpoints contain exact synthetic inputs and normalized validated outputs, hashes, descriptive prose counts, bounded safe diagnostics and provider-reported usage. Never save raw upstream bodies, provider reasoning, headers, session tokens, credentials, unfiltered exception messages or stack traces. Malformed output is not reconstructed as a completed sample. A valid but blocking assessment is preserved before stopping.

Diagnostics distinguish prepared, actually dispatched, responded and validated stages. They include safe HTTP/finish/content-presence indicators, service/transport elapsed time, total elapsed time and usage completeness. Missing usage remains unknown, including late responses that cannot be safely incorporated after termination. A prepared checkpoint left by hard interruption may already have dispatched; it never proves the call was free or unused. The combined token ceiling is not actual usage. Timing includes harness/telemetry overhead and is not a performance comparison.

Diagnostic writes are serialized, revisioned and terminal-aware. Each evidence write has a five-second deadline and an abort signal. A hung write fails closed and releases the queue so stopped diagnostics can be attempted; if all storage is unavailable, that missing terminal record remains a disclosed limitation. The file saver uses unique temporary paths, checks cancellation/latest-write identity, and synchronously renames atomically without an asynchronous gap after the check. Temporary files are excluded from uploads. Timeout during delayed preparation dispatches nothing. Terminal state is rechecked after awaited persistence and transport work; late results must not append a successful stage, replace stopped accounting or unlock another call.

The fixed artifact allowlist exported by the harness is:

- `inputs.json`, `diagnostics.json`, `author-fact-checkpoint.json`, `final-workspace.json`
- `request-01.json` through `request-12.json`
- `completed-01.json` through `completed-12.json`
- `chapter-1.png`, `chapter-2.png`, `chapter-3.png`, `stopped.png`

Screenshots show the accepted synthetic chapter states or the stopping screen. Final workspace capture is a read of this fresh synthetic browser context, including partial state on failure. No recursive artifact globs, traces, videos, console dumps or arbitrary directories are uploaded. A missing final artifact after a hard interruption remains missing evidence. Existing workflow retention applies; later durable publication requires separate authorization.

## Freeze and credential-free preflight

`eval/multichapter-manifest.json` freezes every path exported as `FROZEN_PATHS` by the harness: fixture, protocol, harness, tests, all effective application source files/styles, server, HTML entrypoint, Vite configuration, package metadata/lock and live workflow. Verify exact SHA-256 hashes before dispatch. The reviewed commit additionally fixes the complete repository. Generate the final manifest only after all these files settle; do not claim an old hash set covers later runtime changes.

Offline unit tests use a deliberately fake credential and injected fake transport only, with no sockets or browser launch. They test order/caps, blocked dispatch, missing usage, semantic stops, delayed persistence, cancellation/timeout and late-result immutability.

Hosted CI additionally runs `node scripts/multichapter-eval.mjs --offline-smoke`. It uses the **same browser journey and guarded HTTP service**, but constructs an isolated fake environment, fixed fake upstream responses and a synthetic clock. It never reads the real API key or delegates to real network fetch. Its artifacts are written to `multichapter-offline-evidence` and explicitly marked `offline_mock`. It proves UI wiring and failure controls, not real model behavior or writing quality. Local socket/browser execution is not part of this task's permitted route. The live CLI writes to the separate fresh `multichapter-evidence` directory.

Only after offline tests, hosted browser preflight, independent review, manifest verification and CI succeed may the parent perform the separately authorized single live dispatch. This file and harness do not themselves authorize execution.
