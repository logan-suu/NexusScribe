# Demo acceptance record

Date: 2026-10-02. This is a bounded prototype acceptance record, not a production or literary-quality certification.

## Real provider and domain checkpoint

[Live run 36979109822](https://github.com/logan-suu/NexusScribe/actions/runs/36979109822) used commit [`9650ec3531ab18fe19837c1f7ea5844c18b0de37`](https://github.com/logan-suu/NexusScribe/commit/9650ec3531ab18fe19837c1f7ea5844c18b0de37), OpenCode Go `deepseek-v4.1-flash`, requested `thinking.type=disabled`, and no reasoning-effort field.

- Exactly five synthetic requests: interview, planning, chapter generation, revision interpretation and review
- Each limited to 3000 output tokens; no retries, fallback or cap increase
- All five provider/schema actions passed
- Real generated output was staged without changing Canon; an isolated rejected branch remained uncommitted
- The edited draft was reviewed with exact version bindings, accepted, then compensated
- Safe domain summary: 2 staged events, 2 promoted events, 1 accepted chapter, `ACCEPTED_THEN_COMPENSATED`
- Compensation restored the tested Canon/events while retaining manuscript and history

Only the fixture, status codes and safe aggregate metadata are documented. Raw reasoning, provider output, prompts and credentials were not published. A successful request with a requested switch does not by itself prove zero internal reasoning tokens.

That earlier checkpoint proved a real provider-to-domain path for one synthetic chapter. The later bounded browser milestone below is separate evidence; neither proves general semantic correctness, independent factual review, long-form quality or production reliability.

## Browser and offline evidence

[CI run 36978756206](https://github.com/logan-suu/NexusScribe/actions/runs/36978756206) passed 132 unit/contract tests, the DOM workflows, production build and eight desktop/mobile Chromium scenarios at that checkpoint. Browser scenarios used offline or mocked provider data; they were not a browser session connected to the live model.

Actual Chromium screenshots were inspected against the design reference. Follow-up polish corrected technical patch presentation, model-mode labels and fixed-overlay screenshot capture. Desktop and mobile-sized layouts had no observed blocking display issue in the inspected states. This is not a cross-browser, physical-device or accessibility certification.

Subsequent deterministic coverage includes exact author boundaries in critic requests after project switching, and an in-flight review race. The current integration gate is `npm run check` plus `npm run test:e2e`; development integration must wait for the exact revision's green CI.

## Real browser plus real model: three short chapters

[Run 37033463722](https://github.com/logan-suu/NexusScribe/actions/runs/37033463722)
passed on tested commit `0d664452e01182e78df97bc7543b62019186a9a4` with nine real provider requests. The single
synthetic story completed interview/planning, chapter 1 generation/review/accept,
author setting edit/analysis/confirmation, and chapter 2/3 generation/review/accept.
Every mutation used visible browser controls; browser storage was read for
assertions, never injected to produce a passing result.

The actual continuation requests carried the confirmed setting and edited chapter
source. History correctly refused to undo the setting across dependent later
accepts. Reversing chapter 3/2 event commits and then the setting created three
compensations, restored the tested state, and preserved manuscript and revision
history through reload. The final aggregate was `journey PASS 9 3 3`.

Generation now uses validated paragraph references for deterministic exact quote
anchoring; legacy quote output remains strict. Editing away or moving event
evidence blocks acceptance instead of silently filtering the event. The tested
revision also passed [CI run 37032590299](https://github.com/logan-suu/NexusScribe/actions/runs/37032590299):
163 unit/contract tests, the DOM suites/build and 12 mocked desktop/mobile Chromium scenarios.

**Observed semantic limitation, not merely an untested claim:** the author-confirmed
setting said “小舟的纸灯是蓝色的。” but chapter 2 generated “小红纸灯”. The
model review flagged the color discrepancy as a warning, and also raised causal/
motivation concerns in chapter 3. Current gates block structural failures and
model `error` issues, while allowing explicit acceptance of `warning` issues. The
test driver accepted through that allowed UI path. Consequently this is an
operational integration pass with an observed setting-inheritance failure, not
semantic adherence certification.

All five synthetic screenshots were inspected as legible and privacy-clean. The
chapter 3 screenshot displays review rather than complete prose. Preserve the
blue-setting/red-lamp case for a separate inheritance regression and classification
design: verified author-fact contradiction versus subjective writing advice, with
explicit resolution. Promoting all model warnings to errors is not the chosen fix.

This is one desktop-Chromium integration trial with a target of roughly 100 Chinese
characters per chapter, not a normal-length novel or quality benchmark. The
model's own review is advisory; valid paragraph references prove location, not
semantic entailment. Longer prose, repeated reliability trials, independent
literary evaluation and production persistence remain unverified. Five synthetic
UI screenshots were generated; temporary artifacts are not durable manuscript
storage. See [full scope, diagnostic history and next milestones](LIVE-WRITING-JOURNEY.md).

## Source-review correction

A scoped source review found that equal-looking drafts in different projects could receive the wrong in-flight semantic report. The correction binds each review to its originating project, draft, run, target chapter, state, text, staging, source revisions and request context. Old incomplete bindings require re-review. Offline UI and browser regressions switch projects while the response is pending and ensure the target project retains its own blocking review.

This correction does not change the provider request protocol. It was validated with deterministic and mocked tests rather than another paid model call. No third-party audit or production security certification is claimed.

## Delivery boundary

Development source is integrated into `dev_v1.0` after its checks and review; `main` remains the release boundary. See [launch instructions](LAUNCH.md).

There is no deployed public or persistent online application endpoint in this acceptance. Localhost belongs to the machine running the app. GitHub Actions is temporary test infrastructure, and its repository secret does not configure another runtime.

Still outside this demo: authentication, database transactions, multiuser isolation, durable hosted deployment, backup import, comprehensive semantic inference, long-form evaluation, comparative benchmarks and measured financial cost per accepted chapter.
