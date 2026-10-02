# Synthetic writing-quality pilot, version 1

## Question and scope

Does NexusScribe's current structured context packaging change short scene continuation quality compared with a same-information direct-writing reference brief? This is an exploratory n=3 paired pilot, not a statistical benchmark or proof that NexusScribe improves writing. One sample per arm per genre cannot separate treatment effects from sampling variation. Results do not establish whole-book continuity, product usability, general semantic correctness, or superiority over ordinary chat tools.

The three fixtures are wholly synthetic Chinese mystery, warm fantasy and slice-of-life scenes. Each asks for 450–600 Chinese characters, 4–7 paragraphs, one small scene; supplied prior prose, voices and constraints are fixed before generation. The task is continuation, not ideation or full chapters. No private manuscript, user identity, API credential or external project context appears in a prompt.

## Arms and information parity

Both arms use the existing `createAgentService().run('generateChapter', input)` and identical generation system prompt/output schema, project, scene goal, length instruction, POV, voice, prior source prose, confirmed author facts and restrictions. Nexus uses actual, unmodified `getContext()` after deterministic explicit-author fact commits. No inference or model review calls build memory.

The direct-writing control receives that same context rendered as an indented plain reference brief, in `context.referenceBrief`; its minimal transport context has empty structured `sources`. Flattening retains all context scalar values, their labels, hierarchy, duplicates, source status and metadata. This intentionally isolates structured JSON placement versus a plain brief, rather than rewarding Nexus for information withheld from a baseline. It is a conservative packaging ablation, not a representative free-form chat baseline, and does not isolate every component of the broader Nexus workflow. Empty arrays and objects are retained. Both arms retain the normal generateChapter output schema, so schema/staging overhead is shared. Evaluate prose only.

Exact input byte/character counts and request SHA-256 are reported. An offline assertion keeps serialized input bytes within 15% in each pair; exact token parity cannot be guaranteed because tokenization depends on formatting. Safe provider prompt/completion/total token counts are saved when supplied, without claiming billed cost. Do not add meaningless padding. Context serialization, syntax and instruction location are unavoidable differences and possible confounders.

## Locked generation protocol

- Endpoint: `https://opencode.ai/zen/go/v1/chat/completions`
- Model: `deepseek-v4.1-flash`; thinking disabled; no reasoning-effort override
- Temperature: 0.7 for both arms via evaluation-only transport wrapper. Production adapter normally omits temperature, so this pilot does not test an asserted production-default temperature
- Maximum output: 3000 tokens per request; maximum six requests / 18,000 output-token ceiling, not an actual usage claim
- No model judge calls, selection of best samples, regeneration, repair calls, adaptive prompt changes, retries, fallback model or purchases
- One pair per genre, fixed order mystery / warm fantasy / slice of life; arm request order baseline-first / Nexus-first / baseline-first. This partially counterbalances order but is not fully balanced with three pairs
- At least 11 seconds between calls; stop on first upstream error, timeout, truncation or invalid output. A failed/incomplete pilot is reported as such; do not rerun it without new approval
- Blinded A/B mapping chosen independently per pair after generation and saved separately. No model seed is asserted or supported; reproducible means versioned procedure and inputs, not identical prose on rerun
- Live execution requires explicit approval and confirmation that provider Use balance is OFF. The harness cannot independently verify that account setting
- GitHub Actions receives the existing repository secret only in the generation step; do not read/display its value. Same concurrency group as other live probes, no re-run job (`run_attempt == 1`), manual dispatch only, no CI-triggered live calls

## Freeze and evidence

Commit protocol, fixtures, manifest, runner and offline tests before dispatch. Manifest checksums freeze this protocol and fixture source; record source commit and Actions run URL with results. `inputs.json` is written before the first request. Artifacts allow only synthetic input, synthetic generated prose, separate A/B mapping and safe diagnostics. Raw upstream response bodies, HTTP headers, credentials, reasoning, stack traces and full error messages are never written. Token counts, request/output hashes, character/paragraph counts and exact sentence-repeat counts are diagnostics, never literary quality scores. Incomplete pairs are not presented as completed evidence. Artifact retention is seven days; approved synthetic evidence can subsequently be committed for durable review.

## Blinded review procedure

Give a reviewer only `blind-pairs.json` plus the rubric below, not inputs, diagnostics, source/arm mapping or this protocol's arm ordering. Ask them to review all pairs and lock judgments before unblinding. The reviewer can see each scene brief, previous prose, desired voice and constraints. Blinding may still be imperfect if output style reveals treatment. If a human has not reviewed it, explicitly label observations assistant qualitative review; another assistant is not independent human evidence. Never use the generation model's self-judgment as the sole evaluator. No additional paid judge API call is authorized.

For each pair and each dimension, record A / B / tie / uncertain, one or more exact short quotes from each output, and a specific explanation. A single stronger dimension does not establish an overall winner. Do not calculate an aggregate score, win rate, significance or overall quality ranking.

1. Character voice: distinguishable speech and choices consistent with the supplied voice; preferences must be supported by textual evidence, not ornament or fluency alone
2. Pacing: comprehensible causal sequence, appropriate attention to the scene's turn and ending, no rushed unearned resolution or exposition detour
3. Repetition: unnecessary repeated wording, beats or explanation; deliberate motifs and natural dialogue repetition are not automatic flaws
4. Constraint inheritance: distinguish established world facts from belief/dialogue, check POV and character knowledge, physical limits, unresolved reveals and required ending. Missing a fact is not a contradiction. Quote an actual incompatible assertion for a contradiction; use uncertain for ambiguity

Also note requested-length adherence and prose defects descriptively, without substituting these for quality. Desired priorities should follow observed concrete failures or an explicit lack of evidence, not a fabricated improvement claim. Report each pair's caveats; preserve mixed/tied judgments. If no reliable quality advantage emerges, say so and recommend the smallest next experiment rather than optimizing a score or expanding features.

## Blank reviewer record

Pair ID:
Character voice: A / B / tie / uncertain; A evidence; B evidence; explanation
Pacing: A / B / tie / uncertain; A evidence; B evidence; explanation
Repetition: A / B / tie / uncertain; A evidence; B evidence; explanation
Constraint inheritance: A / B / tie / uncertain; A evidence; B evidence; explanation
Ambiguities / length adherence / other defects:
Concrete next priority and evidence:
Reviewer type and whether judgment was locked before unblinding:
