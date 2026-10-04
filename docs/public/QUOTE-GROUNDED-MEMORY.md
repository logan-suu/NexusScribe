# Quote-grounded memory: presence is not truth

## Why this boundary changed

Issue [#12](https://github.com/logan-suu/NexusScribe/issues/12) follows the retained [multi-chapter failure](../../eval/MULTICHAPTER-RESULTS.md). A single-candidate auditor acknowledged that a location detail was missing, yet returned `supported`. The earlier four-case isolated pilot did not establish general entailment accuracy. Its prompt, result and original candidate remain unchanged. A model verdict can no longer authorize a new paraphrase selection.

## Three explicit choices

1. **Keep the source excerpt**: the program derives the complete source paragraph, its immediately preceding/following paragraphs and exact revision-local UTF-16 offsets. The author selects this card, not the model label. The accepted record has a neutral excerpt title; the original model label is retained separately. Repeated unanchored quotations are ambiguous and cannot produce a card. Modern segmented paragraph IDs and legacy physical-line IDs are interpreted separately.
2. **Author-attest the unverified paraphrase**: the original label stays unchanged and unverified. The author must inspect the label, quote and context, enter a reason, and check the explicit versioned acknowledgment. This is required for every model status, including `supported`, and when no audit ran. It does not become world Canon or inferred character knowledge.
3. **Reject**: one item or all items may be rejected without a model request. Final confirmation can accept the unchanged prose with zero selected memories. Rejection does not erase information from the manuscript or pretend the extractor found nothing.

A matching excerpt proves only textual presence. Speech, lies, beliefs, uncertainty, negation and future intentions remain text with their original scope. A character saying “锁没动过” does not establish that the lock was never opened. Even the complete adjacent paragraphs are only local context, not exhaustive interpretation or a correctness certificate. The full accepted manuscript remains available in writer context.

## Advice, review and cost

Whole-chapter review and existing fact/error gates still apply. Single-candidate model audits are optional, advisory and isolated to the original label plus its own original quote. They cannot choose an item, fill the attestation, rewrite a label, or bypass the author's decision. A newly started audit invalidates that candidate's old active decision; failed or canceled attempts remain auditable and late responses cannot restore authority.

The prose-first live workflow still has three base operations: prose, extraction, chapter review. Explicitly auditing K candidates adds K requests. Excerpt selection, author attestation, rejection and acceptance add zero requests. Existing cancellation, pre-dispatch storage/budget checks, capped calls and paid-result save recovery remain. No new live calls, new credentials, increased budget, retries or model changes were part of this increment.

## Migration and persistence

Original labels, quotes, model judgments, attempts, author choices, prose versions and commit history are retained. Old accepted `keep` and `override_keep` choices remain historical unverified paraphrases; the UI and writer context say so without changing their stored assessments or silently rewriting Canon. Old active decisions cannot satisfy the new selection protocol. Pending prose drafts using older context must explicitly refresh their context and re-extract/review; saved prose is not regenerated automatically.

A new decision stores a versioned selection protocol and either compact excerpt anchors or the complete author acknowledgment. Shared review bindings retain exact source text and candidate snapshots. Quote cards are recomputed from these anchors, not trusted from imported redundant text. Editing, re-extraction, re-review, source revision changes, import and relevant state changes invalidate active decisions. Historical records stay readable. Importing a pending draft does not inherit its old approval.

Writer context schema 3 distinguishes `textual_excerpt`, `author_attested_paraphrase` and `legacy_unverified_paraphrase`, each with an explicit trust label. Full source text is already present, so excerpts and neighboring context use offsets rather than repeating paragraphs. Stale-source selections are excluded and counted. The existing 100-entry/16-KiB auxiliary projection cap omits entire records with an explicit count; it never truncates negation or silently deletes the manuscript. The 2-MiB backup limit is unchanged.

## Verification boundary

Offline domain, DOM and desktop/mobile browser regressions exercise the unchanged false-positive and correct-negative real counterexamples. A three-chapter replay reuses the two actual retained prose outputs and marks the third continuation as synthetic: no real chapter 3 exists. Tests cover model-positive paraphrase denial, exact excerpts and adjacent context, repeated quotes, Unicode offsets, attestation, rejection, stale/imported decisions, history preservation and cancellation/budget/storage protections.

The current credential-free twelve-stage harness deliberately exercises optional audits with fake transport and selects excerpts. It is a maintenance replay, not the original live selection protocol and not a fresh quality measurement. The original live freeze, eight responses and failure report remain unchanged in history. Passing deterministic workflow tests does not establish semantic accuracy, writing quality, recall completeness, calibrated model judgments or long-form continuity. See the PR for exact-head test counts and CI evidence.
