# Writing-quality pilot: measurement blocked

## Result

**Zero completed pairs out of three planned; no writing-quality comparison or superiority conclusion is available.** The pilot was stopped by output-protocol failures, not evaluated to a literary-quality result. Neither failure should be silently excluded to obtain a favorable comparison. No third live batch or automatic retry was performed.

These attempts test a tiny synthetic scenario set and cannot establish general quality even if completed. No blinded literary review took place because there was no complete review corpus. All reported token counts are provider diagnostics, not billed-cost claims.

## Preserved attempts

### Version 1: stopped on request 1

- Source commit prefix: `d389976`
- [Actions run 37047153813](https://github.com/logan-suu/NexusScribe/actions/runs/37047153813)
- Mystery / direct-reference baseline failed `INVALID_MODEL_OUTPUT`, reason `STAGING_REFERENCE_SCHEMA`
- Provider usage: 1,819 prompt + 365 completion = 2,184 total tokens
- No validated prose or completed pair survived

This reason groups invalid staging-array shape/count and invalid event fields/label/index type. It does not identify which case occurred. The raw body was deliberately not retained, so no exact cause can be reconstructed. It is not evidence that the proposed event was semantically wrong, and is not a writing-quality judgment.

### Version 2: stopped on request 2

- Source commit: `fab85ef55c2861d245989a65df83b945faa68e4a`
- [Actions run 37048386575](https://github.com/logan-suu/NexusScribe/actions/runs/37048386575)
- Separately preregistered prose-only contract required empty staging and reviewNotes in both arms, while leaving production validation unchanged
- Mystery / direct-reference baseline passed structural validation: 504 Han characters, 611 total Unicode characters, seven paragraphs, one exact sentence repeat according to the mechanical counter
- Baseline usage: 1,871 prompt + 488 completion = 2,359 total tokens
- Mystery / Nexus context then failed `INVALID_MODEL_OUTPUT`, reason `CHAPTER_PARAGRAPHS`
- Nexus usage: 1,702 prompt + 486 completion = 2,188 total tokens
- Both responses had parsed-object structure and empty staging/reviewNotes

`CHAPTER_PARAGRAPHS` means the `paragraphs` property existed but was not an array containing 1–60 valid strings, or a string was blank, over 4,000 JavaScript characters, or contained CR/LF. The diagnostic did not distinguish these cases. There is no direct conflict between the scene's 4–7 paragraph request and the schema's one paragraph per string rule. Claims that embedded newlines specifically caused the failure would be speculation.

The earlier checkpoint design only saved prose after all pairs completed. Consequently the validated baseline prose was discarded when request 2 failed. Only its counts and SHA-256 remain. It has not been recovered, reconstructed or scored; one repeated sentence count does not establish redundant prose or a quality flaw. There is no completed mystery pair, and warm fantasy and slice of life were never called.

Across both attempts: three provider requests, 5,392 prompt + 1,339 completion = 6,731 reported total tokens. Requested caps were 3,000 output tokens per request; no retry or top-up was executed.

## What can and cannot be inferred

The evidence establishes that these bounded runs did not reliably satisfy the strict response contract. It does not establish which context packaging writes better, whether one arm is less reliable in general, or any literary preference. The v2 observed input prompt-token difference (1,871 versus 1,702) is disclosed; equal model/settings/caps do not imply equal token counts. The trials also differ in protocol version and cannot be pooled into a comparative score.

Versioned metadata is preserved under `eval/history/`. The original v1/v2 preregistration and fixture semantics remain frozen; this report is an outcome record, not a retrospective protocol rewrite.

## Concrete priorities

1. **Structured-output reliability before further literary evaluation.** Pinpoint paragraph shape failures with fixed, non-content diagnostics. Reproduce each schema failure offline. Do not loosen provenance, indexing or content validation to force completion. If provider-supported constrained output is later investigated, verify actual support and make it a separately reviewed change rather than assume support.
2. **Retain completed evidence incrementally.** The harness now checkpoints each validated synthetic output immediately to one of six exact allowlisted files (`completed-01.json` through `completed-06.json`). This is a future-run safeguard; it cannot recover either historical response. Arm-labeled checkpoints are kept away from a blinded reviewer and never treated as a completed pair.
3. **Only resume quality evaluation under a new approved, frozen protocol.** A fresh sample must not be selected until a flattering comparison appears. Keep the failed runs visible, report all attempted calls, and retain the same-information control, blinded evidence rubric and stochastic limitations. No additional live run is part of this result.

The no-call follow-up adds diagnostic regression tests for paragraph array/type/length/newline failures and a simulated first-success/second-failure persistence test. Production validation remains unchanged. These offline passes are infrastructure evidence, not model quality evidence.
