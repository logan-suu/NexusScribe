# Author-directed revision: one call, stopped at close read

## Erratum — 4 October 2026

This source-based correction supersedes two interpretations in the [original report at `e898f67`](https://github.com/logan-suu/NexusScribe/blob/e898f67f44d3da7777ed6b28ec39f3e8c32091c9/eval/AUTHOR-REVISION-RESULTS.md). The analysis below is updated openly; the raw responses, request bodies, normalized prose, checkpoints, locked close read, terminal outcome, artifact index and their hashes are unchanged.

1. **Occupational-detail attribution:** The tweezers and the box formerly used for a hairspring occur in [chapter 1, paragraph 3](history/multichapter-v1/completed-01.json) (`/output/text`), including `右手从工具袋里取出一把镊子，又摸出一只装过游丝的空纸盒`. Neither reference appears in [the original chapter 2](history/multichapter-v1/completed-05.json) (`/output/text`), which is the revision target. Their absence from the revised chapter cannot establish detail lost during this revision. The revised scene adds little occupation-specific detail, but repeating chapter-1 props is not itself a quality requirement.
2. **Knocking-sequence interpretation:** The original chapter 2, paragraphs 2–3, separates `许宁没去敲门。` from `“他应该在里屋。”许宁说。` with inspection of the note and window before he knocks. The [revision, paragraph 2](history/author-revision-v1/revised-chapter-2.txt), compresses the sequence to `许宁没再敲，退后半步，用指节在铁门下半部敲了三下。` This is an apparent contradiction and an unclear transition, not incontrovertible proof of a logical contradiction: a charitable reader can infer a brief pause or a changed knocking position. The original report overstated the certainty of this interpretation.

The historical `compression_without_flattening` failure and stop remain valid at the trial's acceptance threshold: the [frozen first-stage rule](history/author-revision-v1/source-manifest.json) stops on a failed **or uncertain** close read. The current reading is a causal-clarity/needs-edit judgment, not a semantic proof or a literary-quality pass. The stronger wording in [`close-read.json`](history/author-revision-v1/close-read.json) (`voice_and_professional_detail` and `compression_without_flattening`) and [`outcome.json`](history/author-revision-v1/outcome.json) (`qualityConclusion`) is retained as the original assessment and must be read with this erratum. No new model request, replacement sample, extraction, review or acceptance was performed for this correction.

## Result

The one-shot `author-revision-v1` trial stopped after its first model request. It repaired the opaque-box action and met the requested length/paragraph bounds, but left the compressed knocking sequence causally unclear. **No literary-quality pass.** Extraction and review were not run, no second draft was requested, and neither the chapter nor any memory was accepted.

| Measure | Original | Revised | Target |
| --- | ---: | ---: | --- |
| Unicode Han characters | 691 | 396 | 350–500 |
| Unicode codepoints, including whitespace | 833 | 483 | Reported separately |
| Nonblank physical-line paragraphs | 8 | 5 | 4–7 |

The [exact revised text](history/author-revision-v1/revised-chapter-2.txt) is unchanged. The [original chapter](history/multichapter-v1/completed-05.json), [original accepted context](history/multichapter-v1/request-05.json), [complete close-read record](history/author-revision-v1/close-read.json) and [terminal outcome](history/author-revision-v1/outcome.json) retain the evidence. A successful GitHub stage means transport/objective checks completed; its original `awaiting_close_read` ledger remains untouched. The later failed reading is recorded separately.

## What improved, and what failed

- The paper box is explicitly opened before Old Zhou sees the scraps, then closed, re-banded and returned to Xu Ning's bag. Four scraps, cabinet seventeen, the locked cabinet and tomorrow's nine-o'clock appointment remain
- Compression creates an apparent contradiction in `许宁没再敲，退后半步，用指节在铁门下半部敲了三下。` The sentence does not clearly bridge refraining from knocking and then knocking three times. A pause or changed knocking position is inferable, so this remains a blocking causal-clarity/needs-edit judgment under the frozen threshold, not proof of an impossible action
- The previous weak delay explanation, `去年的封箱了，今天翻不出来`, remains without explaining why tomorrow changes availability. Meeting the numeric bounds did not repair this weakness
- The non-blind assistant reading found no added left-ear hearing, working broken bell, old-ticket disclosure or identified sender. This is a fallible whole-text reading, not independent proof of semantic consistency
- Concrete box handling still serves the scene and dialogue remains economical. The revision adds little occupation-specific detail. The tweezers/hairspring-box references belong to chapter 1, not the original chapter 2; their absence is not evidence of detail removed by this revision

The preregistered compression/causal-continuity item remains a recorded failure; the revised interpretation above still does not meet its pass threshold. No later model self-review was used to override it, and no keyword or schema check was treated as semantic truth.

## Exact execution and retention

- Source commit: [`780b0b576b66869b3f9b3cd52bebe642a14ca4ad`](https://github.com/logan-suu/NexusScribe/commit/780b0b576b66869b3f9b3cd52bebe642a14ca4ad), after [post-merge CI 37183364576](https://github.com/logan-suu/NexusScribe/actions/runs/37183364576)
- Trial: [run 37183679916](https://github.com/logan-suu/NexusScribe/actions/runs/37183679916), first attempt, `reviseProse` only. One of a lifetime maximum three attempted calls; unused slots are not permission to retry or continue after failure
- Same OpenCode Go `deepseek-v4.1-flash`, thinking disabled, temperature 0.7, 3,000 output-token ceiling. No key/billing change, more expensive model, fallback or retry
- Provider-reported usage: 3,455 prompt tokens, 369 completion tokens, 3,824 total, zero reasoning tokens. Stage elapsed time: about 3.26 seconds. Monetary cost is unknown; output limits are not a currency budget
- Exact raw response, request body without headers, normalized prose, dispatch intent, stage ledger and file index are retained under `history/author-revision-v1/`. [The artifact index](history/author-revision-v1/artifact-index.json) verifies their bytes; raw content equals normalized prose exactly
- Original source-manifest file SHA-256: `bf9124403214583274a2527ec9a704656e98e7cff809d0a844e615c9c51bee1b`. Its parsed-object `JSON.stringify` hash in the runtime ledger is a different quantity: `061ae16da854ca476f80a8fd03e90f00f3dafaa68191ff154593fcb5f83170fb`
- Original prose UTF-8 SHA-256: `6a58486c108fe32ac376f3d4f5bbd96483b7367300fa61c549aa5fca30142046`; revised prose UTF-8 SHA-256: `71dffb6a68d42c2fee674fc4d64019e678f5bf730173e9cc75ea6925e2195ce3`

The consumed live entrypoint is retired. Credential-free replay tests remain available. The trial did not generate chapter three or establish multi-chapter quality, general revision reliability, blind human preference, or author acceptance.

## Historical design consequence

Keep revision as a proposal requiring an author decision. One tightly specified full-chapter rewrite can meet counts and fix a named defect while leaving another action transition in need of editing; adding another broad model judge would not make this case reliable.

At the time of this trial, the proposal panel offered compare/adopt/discard, but no author edit before adoption. The following recommendation records the response to that trial, not the current implementation state. The recommendation at that time was a local author-edit layer on the proposal: keep the exact model output immutable, show author changes and fresh counts, then confirm adoption of that edited text with all existing downstream invalidation. Length targets should produce transparent deterministic warnings, not a quality badge. That recommendation would let an author fix this sentence directly without another paid request. It did not describe a capability shipped at the time or authorize a new model batch.
