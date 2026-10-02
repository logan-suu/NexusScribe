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

The current manual smoke workflow is fixed to planning-only: one attempted request, a 3000-token ceiling, no retries. A new real invocation still requires the applicable task authorization; publishing or passing CI does not itself start the smoke.
