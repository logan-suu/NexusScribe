# Causal continuity comparison: stopped at HTTP 400, no prose evaluated

4 October 2026. The first frozen baseline request received HTTP 400. The approved “failure stops” rule ended the trial immediately after one attempt. There was no retry, intervention-arm request, second pair, model judge, prompt adoption, manuscript acceptance, or production change.

**This is an operational failure, not a literary-quality result.** No prose output was retained or available for evaluation; zero A/B comparisons were completed. The causal instruction remains untested. Usage and currency cost are unknown, not zero.

## Execution and evidence

- Actual source: [`ac2ada602243623db4a002fe346c86d92cab7cf2`](https://github.com/logan-suu/NexusScribe/commit/ac2ada602243623db4a002fe346c86d92cab7cf2)
- Trial: [run 37221574803](https://github.com/logan-suu/NexusScribe/actions/runs/37221574803), first attempt only, F1 baseline A
- Same-source prerequisite: [CI 37221072369](https://github.com/logan-suu/NexusScribe/actions/runs/37221072369), completed successfully before dispatch
- Draft PR [#21](https://github.com/logan-suu/NexusScribe/pull/21) head `0c3547fbe5a72a09cc9dfe75821eaf63ff0b4fef` passed independent adversarial review, 32 focused tests, 711 total tests, all 12 DOM scripts, build and PR CI 37220531202. The merged source has the identical Git tree
- Exact request body SHA-256: `2b598fa0db1271b0024150b80afab36bf2bb86ae7573dedb5bbe3bb9c664241c`
- Frozen six-request file SHA-256 remains `5701b71bf86b7db9675095872606234b324a0e6e39930f6484000a45dff3fe73`
- Artifact ZIP SHA-256: `481bee8884854f2a0020a66c19501e45ebd87aab8064e2562faa62757bb072c1`
- Exact retained five-file inventory: [index-01.json](history/causal-continuity-v1/index-01.json), independently verified; index SHA-256 `38519c7817d8bb8e01a09644848e21e907c45b157e7eff2350b8e5d38cdcb1b7`

The [intent](history/causal-continuity-v1/intent-01.json), [pretransport reservation](history/causal-continuity-v1/dispatch-01.json), [response metadata](history/causal-continuity-v1/response-meta-01.json), [ledger](history/causal-continuity-v1/ledger-01.json) and original index are copied byte-for-byte. The ledger records one dispatched attempt, HTTP 400, `UPSTREAM_ERROR`, 195 response bytes and 174 ms. All four token-usage categories remain missing. There is no completed-prose or raw-prose file.

The runner deliberately retained only whitelisted status/finish/usage/size metadata, not the raw provider envelope or its error message. This protected credentials and hidden reasoning but also discarded potentially useful error diagnostics. The error body is unavailable; job logs contain only the safe error code. Do not infer a provider error description from body size or status alone. No prose output was retained or available for evaluation. Because the response envelope was discarded before content extraction, its exact contents and any provider-side generation remain unknown.

The separately masked reader received no candidate and performed no individual or pairwise assessment. No blinded preference or quality judgment is claimed. The before-dispatch mapping hash was `15b7d25649f534758cdc9a03c6abcee34948f875a3d909d651990737abea87ca`; no output was selected, relabeled or replaced.

## Offline compatibility diagnosis

A credential-free, injected-fake transport comparison found a concrete discrepancy in the new trial harness. The successful existing provider transport explicitly sent:

- `User-Agent: NexusScribe-demo/0.1`
- `x-opencode-session: <UUID>`

The new runner omitted both explicit headers. Node fetch may have supplied its own default User-Agent; this is not evidence that no User-Agent reached the wire. The existing isolated-memory harness also explicitly validated a unique UUID session header. The provider file used for the successful revision is byte-identical to the current provider (`e11257d7df77552c7325d0778f8c328984a3e15954f99464655209333b9604e7`). This was a transport-parity gap in the new harness and its preflight review.

The endpoint, POST method, redirect rejection, JSON content type, model `deepseek-v4.1-flash`, max output 3,000, thinking disabled and temperature 0.7 match the prior successful revision. No `reasoning_effort`, seed or alternative model was introduced. The task and system/user messages necessarily differ: prior `reviseProse` versus frozen `generateProse`; prior body 14,797 UTF-8 bytes versus this request 6,713. The story input for this A/B diagnostic remained exactly frozen.

[transport-compatibility.json](history/causal-continuity-v1/transport-compatibility.json) records the diff. Reproduce without credentials or network:

```sh
node scripts/inspect-causal-transport.mjs
node --test tests/causal-transport-compatibility.test.js
```

The missing session metadata is a plausible compatibility cause. **It is not established as the cause of this HTTP 400**, because the error body was not retained and no corrective request was attempted. A model retirement, account restriction, unsupported parameter, balance problem or different cause is also not established. This result is not evidence that a stronger model or larger prompt is needed.

## Retirement and next bounded step

The workflow has no runnable job or secret reference. The live CLI fails before environment/credential access, and exported execution helpers require an explicitly injected fake transport. Historical workflow history and the terminal ledger remain; a new directory or old-source rerun cannot restore allowance. The unused five slots are retired.

The useful next step is a separate transport-parity repair and offline verification: preserve the established session/User-Agent behavior and predefine a narrowly safe error-category retention policy, without retaining arbitrary response text. This report already adds a regression diagnostic that reproduces the omitted-header discrepancy with two fake calls and zero network calls. A new live compatibility probe would require a fresh, explicit one-call approval and preregistration; it is not authorized or scheduled here. Do not restart the six-call literary comparison automatically.

No conclusion about the intervention, autonomous novel writing, long-form memory, revision reliability or model literary capability follows from this failed transport attempt. The existing application and production prompt remain unchanged; no main release or deployment occurred.
