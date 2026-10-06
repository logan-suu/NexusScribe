# Causal writing quality diagnostic, 6 October 2026

Protocol: `causal-quality-20261006`. This is a new, separately authorized allowance of **at most six attempts in one run**. The HTTP-400 causal-continuity trial and the one-call HTTP-200 compatibility probe stay consumed and retired. No unused historical slots are restored. This document does not itself dispatch requests. The new harness must undergo independent review and exact-source green CI before the approved live dispatch.

## Question and preregistration

Does the frozen concise causal instruction improve fixed-context continuation quality with the existing Go model? This is a small diagnostic, not whole-novel generation, a memory-retrieval test, an accepted-output chain, a model ranking, or evidence of general capability.

Baseline cloud mirror was reconciled against all 248 tracked blobs at source `7235df0` before additions. Actual reviewed source SHA and successful CI run ID are immutable dispatch inputs checked against GitHub. Commit SHA is not embedded in its own manifest. All runtime local dependencies, workflow, CI definition, protocol, request packet and focused tests are independently SHA-256 frozen by `causal-quality-manifest.json`; runtime needs only Node built-ins and the listed frozen modules. Third-party Actions are pinned by full commit SHA.

Unchanged request file: `causal-continuity-requests.json`, SHA-256 `5701b71bf86b7db9675095872606234b324a0e6e39930f6484000a45dff3fe73`. Its historical proposal metadata remains unchanged; this new protocol governs this separate trial. Exact order is **F1 A, F1 B, F2 B, F2 A, F3 A, F3 B**. The six compact body hashes are fixed in the runner, manifest, reservation and dispatch records. Each pair uses byte-identical story user input; only B appends the existing frozen causal paragraph. No story input, prompt, setting, order or target changes during execution.

- Endpoint: `https://opencode.ai/zen/go/v1/chat/completions`
- Model: `deepseek-v4.1-flash`; temperature 0.7; thinking disabled; no seed or reasoning_effort
- At most 6 provider attempts; each requests at most 3,000 output tokens; aggregate requested output ceiling 18,000, plus the six fixed inputs
- Shared repaired transport: honest `NexusScribe-demo/0.1` User-Agent, a fresh UUID `x-opencode-session` per request, JSON content type, Bearer credential, POST, no redirects
- Sequential requests only; at least 11 seconds after each completed/persisted call before the next dispatch
- 120-second total transport deadline per request, including stream reads; 128 KiB success envelope and 16 KiB error envelope limits in memory
- Existing Actions `NEXUS_API_KEY` secret only; no secret retrieval/export, new credential, account change, overage, top-up, fallback, paid judge, upgrade or model switch

The user's existing confirmation that **Use balance is off** is carried forward without a new account check. This is user-provided evidence, not a fresh console observation; the harness cannot independently enforce the provider account setting. Missing monetary cost remains **unknown**, not zero and not by itself a stop. Token usage must be complete and consistent on every response: nonnegative integer prompt/completion/total/reasoning tokens, zero reasoning, total equal to prompt plus completion, completion at most 3,000 and cumulative completion at most 18,000. Missing, invalid, inconsistent or over-cap billable usage stops as budget uncertainty. This ceiling is not a currency estimate or authority for additional spend.

## Global one-run reservation and failure rules

The dedicated workflow's complete recorded history must contain exactly one run: the current run, first attempt, manual dispatch, correct identity, repository, dev_v1.0 branch and exact source SHA. The supplied CI run must be completed/successful on that exact branch/source and be the repository CI workflow. Workflow concurrency serializes without cancellation or replacement. Reruns, fresh directories, new dispatches, historical-source attempts and extra/missing history cannot restore authorization. Do not delete history or artifacts to evade the guards. A failed preflight conservatively consumes this run's allowance even if no provider request occurred.

The credential-free prepare step writes an exclusive file and fsyncs both the file and directory. It reserves all six attempts, binds every body hash, manifest, source, CI ID, run ID, limits and masked-map hash, and leaves zero allowance for another run. The pinned upload step must successfully persist this reservation before a subsequent step introduces the existing provider secret. Execute repeats the gates, verifies the uploaded artifact's identity, owner run, exact source and non-expiry, then validates the exclusive local reservation. Any other local evidence blocks re-entry. Each call additionally requires its own exclusive fsynced attempted-or-uncertain dispatch record before transport. Never retry a call or resume an interrupted batch.

Stop on transport errors, timeout, refusal, malformed/oversized/unsafe output, hidden reasoning, credential-echo suspicion, missing or inconsistent token accounting, persistence/artifact uncertainty, truncation, or deterministic delivery-contract failure. Safety failures withhold affected text. Safe complete or truncated prose with a delivery/budget failure is retained when extractable, then execution stops. Unattempted arms stay missing; never replace a candidate or finish a partial pair after stopping.

**There is no literary acceptability gate between requests.** A structurally valid, safely delivered, within-budget but weak, repetitive, causally confused, constraint-breaking or otherwise poor story is retained and the next frozen call proceeds. Literary judgments happen only afterward and cannot select candidates or change the six-call order. The earlier any-arm literary stop is not inherited by this new protocol. F1/F3 delivery is 450–600 Unicode Script=Han characters and 4–7 nonblank physical-line paragraphs; F2 is 350–500 Han and 4–7 paragraphs. These mechanical targets are separate from literary merit.

## Safe evidence

Retain only the reservation, per-call dispatch records, exact final prose bytes, matching text JSON with hash and deterministic counts, allowlisted response metadata, cumulative ledgers, terminal result and SHA-256 inventory. The frozen source packet supplies the exact requests and story inputs. Preserve all observed valid samples, including weak ones. Unknown usage stays unknown rather than being summed as zero.

Never retain arbitrary envelopes, response headers, session/request IDs, hidden reasoning, provider free-text errors or arbitrary exception messages. Error diagnostics contain only bounded allowlisted categories. Credential-echo scans cover both provider and GitHub tokens, nested JSON escaping, and common base64/base64url/hex/URL encodings; this is a conservative guard, not proof against every conceivable encoding. Invalid UTF-8 and uncertain escape decoding stop. Retention is 90 days; after inspection, archive the safe terminal synthetic evidence and exact executed source before retirement. An upload failure or runner loss is an uncertain consumed trial, not permission to restart. Console output contains only protocol, status, attempts and safe error code, never prose.

## Masked reading after execution

Before any call, the coordinator froze a private randomized candidate-ID mapping with SHA-256 `00618555ff112bf760b93660740fd038c7078bfd02a3049f96680d38b72a895f`. Publish only its hash until all judgments lock. The masked reader gets neutral candidate IDs, exact story user input, exact retained prose, hashes, delivery targets and the rubric below. Exclude system instructions, arm labels, sequence, filenames, run IDs, this mapping and arm-aware repository material. Individual packets are presented in ascending lexicographic neutral-ID order. Pair membership is derived from identical frozen story input; candidates within each pair are also presented in ascending lexicographic neutral-ID order. Pair packets are prepared only after all individual judgments lock. No additional provider judge request is allowed.

Read all available outputs completely, lock hash-bound individual judgments first, then lock pairwise judgments before unmasking. Record each dimension as acceptable, needs-edit/uncertain, clear failure or not applicable with explanation, exact UTF-16 output quote spans, relevant source evidence and strongest plausible alternative reading for every failure. A judgment never determines whether another call occurs. Incomplete pairs remain incomplete. If masking was compromised or a separate reader unavailable, disclose non-blind evaluation and do not claim the preregistered masked result.

Required individual dimensions:
1. New scene change: meaningful advance from the prior ending; reused dialogue/actions need a new dramatic function
2. Physical prerequisites and custody: object state, access, perception and actions that change state
3. Temporal and causal sequence: actor, negation scope, intent, trigger and effect, beyond keyword matching
4. Motivation and obligation: earn obstacles/delays, distinguish promises from fulfilled actions
5. Knowledge, POV and attribution: distinguish question, inference, speech and fact; ordinary sound does not itself imply left-ear hearing
6. Voice, economy and agency: character-specific concrete writing, purposeful indirectness, no checklist exposition or padding
7. Delivery contract: deterministic Han/paragraph counts, separately from literary assessment

For each complete pair, lock overall preference, substantive causal/continuation difference, voice/agency regression and checklist padding, using quote spans from both outputs and allowing ties/neither. No overlap is not proof of no replay; overlap is not automatically failure. A closed opaque box cannot provide a view of its contents, but ordinary implicit bridges are not necessarily impossible. An action sequence can fail clarity without a formal contradiction. F3: one broken needle does not establish all needles broken; an ordinary intact hand needle can be implicit at a working repair stall. No invented machine, specialist tool, helper, black thread or other resource may erase the difficulty; the repair must stay temporary.

## Locked interpretation and limits

A narrow diagnostic go requires all three B outputs acceptable on the required literary/constraint dimensions; at least two complete pairs showing substantive causal/continuation improvement; no material voice/agency regression or checklist padding; and F3 resource, knowledge and temporary-repair compliance. Weak A prose is evidence, not an execution stop. Counts-only improvement is insufficient. If both arms are acceptable with no clear preference, keep the simpler instruction and call the result inconclusive. A missing or stopped comparison cannot establish a benefit or disprove an unobserved arm. Keep all failures rather than selecting winners.

Even a go is only a recommendation bounded to these three fixed contexts, never automatic production adoption, new features, merge/release or deployment. Retire this entrypoint after its one terminal run. The report separates transport/retention observations from literary judgments, discloses uncertainty and offers one evidence-bounded next recommendation. Any further paid trial requires a new decision and authorization.
