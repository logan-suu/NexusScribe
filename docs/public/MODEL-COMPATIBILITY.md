# Model compatibility and planning limits

Checked: 2026-10-02. This document separates observations, documented controls and unverified assumptions.

## Observed failure

Two bounded synthetic connectivity runs reached the provider successfully. Interview validation passed; planning returned `finish_reason: length` under respective output limits of 900 and 3000, then the application stopped. No retry or fallback was performed. No raw model output was retained.

This establishes truncation, not its precise cause. The retained evidence does not show whether the output budget was spent on reasoning, final JSON, or both. A larger limit is not by itself a diagnosis. Successful interview calls also do not establish complete application compatibility or novel quality.

## Compact planning transport

The original model response repeated author-supplied values, UI field labels/statuses, stable chapter IDs and per-chapter copies of the global POV. These are deterministic presentation/state metadata, not additional creative work.

The revised transport asks for only missing author proposals and the creative plan. Server normalization expands it into the existing application contract. It must preserve explicit author values, keep model suggestions proposed, retain all required creative fields, and reject missing or malformed content. It does not invent a plan when generation fails and does not lower acceptance requirements.

Character-count comparisons in tests quantify JSON redundancy only; they are not model-token measurements or evidence that a future live request will succeed.

## Thinking and effort controls

The [DeepSeek thinking guide](https://api-docs.deepseek.com/guides/thinking_mode/) documents thinking enabled by default for the direct API and a `thinking.type` switch. The [direct Chat Completions reference](https://api-docs.deepseek.com/api/create-chat-completion/) separately defines output limits and reasoning controls.

The [OpenCode Go endpoint documentation](https://opencode.ai/docs/go/#endpoints) identifies an OpenAI-compatible route for DeepSeek V4.1 Flash. It does not document passthrough semantics for the direct DeepSeek thinking switch. The [OpenCode client transformation source](https://github.com/anomalyco/opencode/blob/dev/packages/opencode/src/provider/transform.ts) contains effort mappings for compatible DeepSeek models, but client support is not proof of the behavior of a particular hosted gateway/account.

NexusScribe therefore does not send an assumed thinking-disable parameter or silently change reasoning effort. Any future provider-specific option requires a verified contract and a separately approved bounded test. Upstream behavior and defaults can change; review the linked primary sources before changing integration settings.

## Retained safeguards

Server-only credentials, explicit live enablement, declared output/call bounds, no automatic retries, strict response validation, evidence binding and author confirmation remain required. Model self-review is still advisory. Repository secrets configure a CI job only; they do not automatically configure a deployed application.

## Safe diagnostics for a future authorized run

A truncated response may now emit an allowlisted diagnostic record: finish reason, whether final/reasoning content was returned, and numeric token counters only when supplied by the provider. It never logs either text, prompts, request bodies or credentials. Missing reasoning counters remain unknown; absence of a returned reasoning field does not prove that thinking was disabled. These diagnostics cannot reconstruct the two earlier runs.

The planning-only mode enforces one attempted request; full-flow mode enforces at most five. Both retain the selected 3000-token ceiling and prohibit retries. A new real invocation still requires the applicable task authorization; publishing or passing CI does not itself start the smoke.

## Bounded low-effort compatibility check

A later planning-only request reported 3000 completion tokens, including 3000 reasoning tokens, with no final content. This is provider-reported evidence for that request only; it does not reconstruct earlier failures or prove that every provider handles the budget identically.

The adapter now permits an explicit `NEXUS_REASONING_EFFORT=low` opt-in, serialized as `reasoning_effort: "low"`. If unset, neither reasoning nor thinking controls are sent. Other values are rejected rather than guessed. The manual planning-only workflow selects low for a one-request compatibility check while keeping the same model and 3000-token ceiling. This is not a claim that the hosted route has already passed the test.

The [OpenCode gateway's variant parser](https://github.com/anomalyco/opencode/blob/dev/packages/console/app/src/routes/zen/util/variant.ts) recognizes `reasoning_effort`, and its client code defines compatible DeepSeek effort mappings. Direct `thinking.type=disabled` remains a separate, untested option and is not combined with low in this check. No raw reasoning content is logged or exposed.

A bounded planning-only call with explicit low effort subsequently passed the compact schema contract. This verifies that specific synthetic request on the selected route; it does not establish literary quality or full workflow acceptance. A later low-effort full-flow check again stopped in planning: the provider reported 2818 reasoning tokens out of 3000 completion tokens, with incomplete final content. Thus the earlier single planning success was not reliable full-workflow completion. Domain assertions were prepared but were not reached in that failed run.


## Isolated thinking-disabled probe

The adapter also permits explicit `NEXUS_THINKING_MODE=disabled`, sending only `thinking: {type: "disabled"}`. It is mutually exclusive with `NEXUS_REASONING_EFFORT`; supplying both or an unsupported value blocks configuration before any request. Unset controls leave provider defaults unchanged.

This parameter is documented for the direct DeepSeek API. The current Go check is still a compatibility probe, not an assumption of passthrough semantics. Its manual workflow is fixed to one planning request, 3000 output tokens, and no retry, with the low-effort field omitted to isolate the variable. A returned response and usage metadata must establish what happened; code serialization alone does not prove that thinking was disabled.

## Author-context completeness

Custom projects now provide a separate `context.constitution` containing the exact saved idea, protagonist, tone, narrative perspective, goal, boundaries and contract metadata. Explicitly emptied author fields do not fall back to older contract values. This is author intent, not promoted Canon. Deterministic UI tests capture the actual critic request after switching away from and back to a project, verifying the author boundary and other fields survive intact. This mapping test does not require a live provider call.
