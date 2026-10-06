# Causal writing quality trial: retired after one delivery-count stop

## Observed result

[Run 37545250479](https://github.com/logan-suu/NexusScribe/actions/runs/37545250479) used exact source `b40a2735d590665d77d9126b955e1f091d9b3b55` after [CI 37544379125](https://github.com/logan-suu/NexusScribe/actions/runs/37544379125). The separately approved one-run allowance was reserved before provider credential access. It made **one attempt, F1 baseline A**, then stopped without retry or continuation.

The response was HTTP 200, `finish_reason: stop`, nonempty, parseable and retained as exact safe prose. There was no reported transport, parsing, UTF-8, truncation, refusal, hidden-reasoning or credential-safety failure. Deterministic counts were **472 Han characters**, within the 450–600 target, and **11 paragraphs**, outside the required 4–7. The executed harness therefore emitted `DELIVERY_FAILED`. This records the harness's preregistered delivery-count decision; it is not a literary quality verdict.

Provider-reported usage was 1,557 prompt tokens, 424 completion tokens, 1,981 total tokens and zero reasoning tokens. These values were complete, consistent and within the configured token caps. Monetary cost remains **unknown**. The recorded billing prerequisite is the user's prior confirmation that Use balance was off, with no fresh provider-console verification.

There are **zero B outputs and zero complete A/B pairs**. The other five slots were not attempted and are retired. They cannot be resumed, retried, replaced or reassigned. The current workflow has no enabled job; the CLI fails `RETIRED` before environment, credential, API or evidence access. Only explicitly opted-in injected-fake replay remains available for regression tests.

## Methodological limitation

A complete baseline response was retained. Our overly strict preregistered paragraph gate ended the batch before the comparison arm; it did not make the prose unevaluable or show a transport failure.

The executed protocol treated paragraph-target noncompliance as fatal, which was **over-strict for collecting a writing-quality comparison**. It cut off the B condition before any causal effect could be observed. Following that frozen stop rule preserves execution integrity; it does not make the rule scientifically preferable or support blaming the model for a transport failure.

For any future design, safe, complete assistant text with wrong language, Han/length/paragraph targets, Markdown or JSON wrappers, repetitive or weak fiction, or literary/voice/constraint problems should be retained and scored as nonfatal instruction adherence and content quality. Fatal malformed-output stops should mean an invalid envelope or UTF-8, or no usable assistant content, rather than a content-style error. Explicit refusal/content filtering, hidden reasoning or credential/security concerns remain fatal, as do transport failures, truncation, persistence uncertainty and budget uncertainty. Universal resource bounds such as 128 KiB envelopes and 30,000 UTF-16 code units remain separate from soft writing targets.

Any future implementation would need tests showing that all six safe target-miss/wrapper/weak samples continue and that each fatal class stops at each possible position. This is a methodological recommendation only. No revised live workflow or additional call is authorized or created here. The retired fake replay deliberately preserves the original count-stop behavior for auditability.

The observed baseline cannot establish improvement, no improvement, regression, or general incapability of the unobserved causal instruction. No prompt adoption, new trial, accepted-output chain, model change or release follows automatically.

## Masked close reading

The separate [individual judgment](history/causal-quality-20261006/masked-individual.json) is now locked and archived unchanged with a [reconstructed neutral reader packet](history/causal-quality-20261006/masked-candidate.json). After the workspace replacement, that packet was reconstructed from the unchanged frozen story input, original retained output and previously recorded neutral ID. Its input/output hashes were verified; the archived packet is not claimed to be a surviving original packet or evidence that the full mapping survived. The locked judgment was not altered. No pairwise judgment was made.

The reader found scene progression, temporal/causal sequence, motivation and voice acceptable: a modest clue is discovered, the administrator is a plausible next step, and the restrained dialogue has character. Physical custody and knowledge/ear attribution were judged **needs-edit/uncertain**, not proven contradictions:

- The pocket contact with the envelope is described using its under-the-repair-mat placement. A mundane prior transfer is plausible; the wording does not clearly mark that earlier location
- A phone light becomes a “flashlight,” then 阿陶 switches his phone light off. Informal naming and an ordinary unmentioned handoff are possible, but the references are rough
- “右耳朝向他，左耳那边…闷响” can identify where the sound is located rather than which ear hears it. The attribution is ambiguous rather than a demonstrated violation of left-ear deafness

The reader's `deliveryStatus: clear_failure` refers to the historical rubric's paragraph-target noncompliance. It does not mean the prose is inaccessible, malformed or unevaluable, and does not overturn the methodological criticism above. The overall individual literary assessment is needs-edit/uncertain. None of these observations can establish the effect of an absent B arm.

The full private six-candidate mapping file became unavailable after an execution-workspace replacement after the reading had started. Its pre-call commitment hash remains in the durable reservation and executed source; the full mapping has not been reconstructed or reverified. The observed neutral ID is preserved in the coordinator's prior packet/handoff and reader record, supporting the sole candidate's individual provenance, but not recovery of the complete committed mapping. This limits the verifiable masking claim. The locked judgment is preserved exactly, and no fabricated mapping or pair assessment is supplied.

## Exact evidence and source archive

[Artifact index](history/causal-quality-20261006/artifact-index.json) records SHA-256 hashes for all eight original evidence files and the exact executed runner, workflow, protocol, manifest and focused tests, plus the later locked individual judgment and reconstructed neutral reader packet. The original [result](history/causal-quality-20261006/result.json), [prose bytes](history/causal-quality-20261006/raw-prose-01.bin), [text/counts](history/causal-quality-20261006/completed-01.json), [reservation](history/causal-quality-20261006/reservation.json) and [execution inventory](history/causal-quality-20261006/index.json) are preserved byte-for-byte. The separately uploaded reservation matches the evidence copy.

- Evidence artifact: `11450875724`; ZIP SHA-256 `94f50e3e934dd4b632d48caddda3dbe50e3b2edb0c13cbb3727a67278bf99194`
- Reservation artifact: `11450835685`; ZIP SHA-256 `658bb4f5a23ef77a4614608811434cfbd6e41bd459fb4b94a5ed0373aab10c17`
- Retained exact prose SHA-256: `75a24e4f346bf57c3775c8d3180074334544ea9f1a5b0773f4beffaf9233dbf3`

Historical evidence and the executed source remain unchanged. The earlier causal-continuity trial and compatibility probe also remain retired and untouched.
