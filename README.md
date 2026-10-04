# NexusScribe

**Start with an idea. Shape the story, one chapter at a time.**

[English](README.md) · [简体中文](README.zh-CN.md)

NexusScribe is an author-guided fiction-writing workspace built around **versioned narrative memory**. Develop an idea into a story agreement and chapter plan, review candidate prose, and decide which changes become part of the story. Confirmed revisions can then inform what comes next.

The current prototype focuses on Chinese fiction and has a Chinese-language interface. It runs locally with an offline template mode and an opt-in, server-side model adapter.

> **Project status:** working prototype. Historical bounded live tests apply to their recorded revisions. The current prose-first path saves prose before independent extraction; its verification is recorded separately. Literary quality, general semantic reliability and billed cost remain unproven. See the [acceptance record](docs/public/ACCEPTANCE.md).

## Why narrative memory?

A small edit can change a relationship, invalidate a future scene, or alter what a character knows. NexusScribe keeps manuscript text, proposed changes, and confirmed story state separate so that these decisions remain visible and reviewable.

- **Traceable changes:** versioned text and memory patches tied to exact source excerpts
- **Author-controlled commits:** proposed facts and candidate chapters require explicit acceptance
- **Selective review:** the included story demonstrates dependency checks and alternative sources of knowledge
- **Draft isolation:** rejected drafts never become confirmed story facts, or *Canon*
- **Revision-aware safeguards:** stale proposals and reviews cannot be applied to changed source material
- **Compensating undo:** undo creates a new history entry; dependent later changes can block an unsafe reversal

## The writing workflow

1. **Explore an idea.** Answer focused interview questions about characters, tone, perspective, goals, and boundaries.
2. **Agree on the story.** Edit the proposed story agreement and three-chapter outline before confirming them.
3. **Write a chapter.** Save raw candidate prose first, then explicitly extract proposed memories or choose to skip extraction. Review before final acceptance. Editing invalidates the extraction choice and review.
4. **Select memory, then accept.** Explicitly keep or reject every proposed memory. A separately requested, isolated one-candidate audit judges the label against only its own quote. Unknown/unsupported items require a reasoned author override to keep. Final confirmation commits only selected memories. Rejecting all extracted candidates or explicitly skipping extraction permits zero-memory acceptance after current review.
5. **Revise with evidence.** Save manuscript edits, inspect proposed memory updates and their source excerpts, then explicitly confirm the changes.
6. **Continue and preserve.** Move between chapters and projects, inspect version history, and export manuscript text or a JSON backup.

Offline mode supports the three-chapter template workflow. The normal live flow uses interview, planning, prose generation, independent memory extraction, revision interpretation, chapter review and separately requested isolated candidate audits. The strict legacy chapter action remains available as a comparator. Writing + chapter review uses two base model calls; optional extraction adds a third, and every explicitly requested candidate audit adds another call. Choosing to skip extraction does not undo prior calls or guarantee zero cost. No cost or latency savings are promised. Model output remains a proposal throughout.

## Quick start

Use the development checkout on `dev_v1.0` after integration, or the reviewed PR head while changes are under review. `main` is reserved for releases; no public hosted app is created by cloning this repository.

Requires **Node.js 22.12+** and npm. From a checkout containing this demo:

```sh
npm ci
npm start
```

Open **http://127.0.0.1:5173** on the machine running the app. The frontend and API bind to loopback; the API uses port `8787`. No account, API key, or external model call is needed for offline mode.

For a guided zero-model manual path and a separate synthetic UI replay, see the [acceptance demo walkthrough](docs/public/DEMO-WALKTHROUGH.md).

### Try a revision that matters

Open the included story **「雾港来信」**:

1. In chapter two, choose **「插入设定修改」**, then **「保存并分析」**.
2. Inspect the relationship change, its source evidence, and affected plans before confirming it.
3. See the stranger-relationship premise become invalid while unrelated plans, such as the storm, are evaluated separately.
4. Generate a candidate and review it before accepting or rejecting it.
5. In chapter one, remove the telephone source: the remaining valid note can still support the character's knowledge.
6. Inspect version history and compensating undo, including guards against reversing changes with later dependencies.

This fixture demonstrates specific mechanisms. New projects have structural safeguards and model-assisted proposals, but do not inherit a general-purpose proof of story consistency.

## Optional model connection

The browser calls a same-origin API; the **server process owns credentials and outbound requests**. Live mode transmits the selected action's inputs, including relevant manuscript text and story context, to the configured provider. Check that provider's terms and data handling before using private manuscripts.

The tracked [`.env.example`](.env.example) contains this nonsecret reference configuration:

```dotenv
NEXUS_API_BASE_URL=https://opencode.ai/zen/go/v1
NEXUS_API_MODEL=deepseek-v4.1-flash
NEXUS_LIVE_ENABLED=false
NEXUS_OVERAGE_CONFIRMED_OFF=false
NEXUS_MAX_OUTPUT_TOKENS=1200
NEXUS_MAX_CALLS=10
```

This OpenCode Go endpoint/model pair is a configuration example, **not a claim of account eligibility or production acceptance**. One bounded synthetic planning check passed with explicit `NEXUS_REASONING_EFFORT=low` and a 3000-token limit; a later low-effort run still truncated. A separate five-action synthetic smoke subsequently passed with requested `NEXUS_THINKING_MODE=disabled`, no effort field and the same output ceiling, including domain staging, rejection, acceptance and compensation. This is bounded fixture evidence, not a general quality guarantee. See [model compatibility evidence](docs/public/MODEL-COMPATIBILITY.md). The app does not automatically load `.env` files.

To enable live mode:

1. Verify the provider endpoint, model access, applicable terms, and account allowance. Check that balance/overage charging is disabled in the provider account.
2. Supply the configuration and `NEXUS_API_KEY` securely through the **server process environment**. Set `NEXUS_LIVE_ENABLED=true` and `NEXUS_OVERAGE_CONFIRMED_OFF=true` only after those checks.
3. Start or restart the API, then select live mode under **「模型」** in the interface.

Never put a key in `VITE_` variables, the browser, chat, source code, shared files, or shell history. The app has no browser key field and cannot verify or change the provider's overage setting.

### Request and cost boundaries

- Default output limit: `1200` tokens; configurable up to `3000`
- Optional `NEXUS_REASONING_EFFORT=low` or separately `NEXUS_THINKING_MODE=disabled`; never both. Unset preserves provider defaults. The thinking-disabled Go request profile passed the bounded synthetic smoke; this does not prove zero internal reasoning. Unsupported values are rejected
- Default call allowance: `10` attempts per server process; configurable up to `30`
- At most two concurrent requests and six attempts per minute
- Thirty-second default timeout; request and response bodies limited to 128 KiB each
- No automatic retries, upstream redirects, or silent fallback to templates

Failed provider calls also consume the process allowance. Restarting the server resets it. **These limits are not a monetary budget or a provider billing cap.** The API does not log manuscript text or keys, and does not forward raw upstream error details.

## Acceptance safeguards

- Proposals are bound to their project, state version, and manuscript revision.
- Exact source excerpts must match current text before a memory update can be confirmed.
- Authors can explicitly replace an existing fact while preserving its stable ID and earlier versions.
- Live-model drafts need both structural checks and a model review of the current revision. Error-level issues block acceptance; warnings remain visible for the author.
- Each memory decision is bound to the exact draft, extraction and review; edits, re-extraction and re-review invalidate old approval. Original candidates and decisions remain auditable. A supported judgment is a fallible model assessment, not truth.
- Missing candidate judgments fail closed. An explicit override records the original judgment, evidence and author reason without rewriting the claim or bypassing fact-conflict and generic-error gates.
- Saving prose and updating narrative memory are separate steps. Unsupported semantic changes must not silently appear synchronized.

## Architecture

```text
Chinese writing workspace (React + Vite)
  ├─ Authoring workflow: interview → agreement → outline → candidate
  ├─ Narrative runtime: evidence, versions, dependencies, review, commits
  ├─ Local persistence: workspace, history, manuscript / JSON export
  └─ Same-origin model client
       └─ Node.js gateway: validation, credentials, request limits
            └─ HTTPS OpenAI-compatible provider (opt-in)
```

| Location | Responsibility |
| --- | --- |
| `src/domain/` | Story state, patches, evidence, dependencies, draft isolation, review guards |
| `src/authoring/` | Interview, story agreement, outline, template and live workflows |
| `src/adapters/` | Browser-side model boundary |
| `src/components/` | Chinese-language writing workspace |
| `src/storage.js` | Local persistence and export |
| `server/` | Provider protocol, schemas, timeouts, and request limits |
| `tests/` and `scripts/` | Runtime, provider, and UI workflow checks |

See the [acceptance record](docs/public/ACCEPTANCE.md), [launch checklist](docs/public/LAUNCH.md), and [runtime architecture](docs/public/ARCHITECTURE.md) for boundaries and the [product blueprint](docs/public/NexusScribe-blueprint.md) for the broader design. The blueprint includes planned capabilities.

## Development and verification

```sh
npm run dev           # Frontend only, port 5173
npm run server        # API only, port 8787
npm test              # Domain, contract, and mocked-provider tests
npm run test:ui       # Offline DOM workflow checks
npm run test:ui:live  # Mocked five-action model UI workflow
npm run test:ui:race  # In-flight cross-project review regression
npm run check         # Above checks plus production build
npm run build
npm run preview       # Production preview, port 4173; start API separately
```

Run the separate Playwright suite after installing its Chromium browser:

```sh
npx playwright install chromium
npm run test:e2e
```

The browser suite targets desktop and mobile-sized Chromium viewports. It uses offline content and mocked API responses; it is separate from `npm run check`. On Linux CI, browser system dependencies are also required (`npx playwright install --with-deps chromium`).

These automated suites do not make paid model calls. Passing them does not demonstrate live-provider availability, semantic quality, cross-browser compatibility, or visual acceptance. Real-service smoke testing is a separate, explicitly enabled check, and a GitHub repository secret does not configure a locally running or deployed app.

## Current limits and next steps

- **Single-author local storage.** No server database, authentication, cloud backup, or multiuser concurrency guarantees. Stale-window detection is not a database transaction.
- **Bounded backup recovery.** JSON backups can be previewed and explicitly imported as new projects. Failed text saves remain in memory with export/retry controls. A previous-good local copy can recover a corrupt primary after confirmation and preservation of damaged bytes. Clearing browser site data still erases all local copies; export regularly. See [backup and recovery limits](docs/public/BACKUP-RECOVERY.md).
- **Bounded narrative reasoning.** General semantic conflict/replacement reasoning and knowledge-transfer proofs remain incomplete.
- **Further validation needed.** A bounded real-provider/domain fixture has passed; broader provider reliability, long-form evaluation, baseline comparisons, cross-browser coverage, and production security review remain acceptance work.

The development direction is to validate provider behavior and writing quality, broaden revision and evidence handling beyond the fixture, and strengthen persistence and recovery. These are goals, not shipped features or delivery commitments.

## Contributing

Bug reports should include reproducible steps and fictional sample text. Keep private manuscripts, project exports, and credentials out of public issues.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the review checklist and branch flow: feature branch → `dev_v1.0` → `main`. Changes go through reviewed pull requests; publication does not imply merge approval.

**License:** no project license has been selected. Public visibility alone does not grant an open-source license.

### Request controls and usage

Model actions show the action being performed and a waiting/result/failure status, without invented completion percentages. Cancel stops the browser wait and asks the local gateway to abort its upstream request; disconnects and wizard close also abort. Cancellation does **not** guarantee that the provider stops work or billing. Requests are never automatically retried. Use the original action button to retry deliberately after checking an error.

Results are bound to the initiating request and exact project, manuscript/draft state, pending edits, chapter selection, and mode. If these change, the response is discarded. Cancelling an older request cannot clear or apply a newer request. Reload does not resume a model request; saved text and pending edits retain their existing persistence behavior. Failure/cancellation never accepts candidate prose or commits story memory.

The task panel displays only numeric token counters reported by the provider through the server. Missing counters, including unavailable usage after cancellation or failure, are shown as unknown. No total is inferred, and no currency cost or billing cap is estimated. These controls and their fake-provider tests do not establish real-model quality or actual billing behavior.

## Prose survives extraction failures

The runtime owns raw draft versions, paragraph IDs, exact offsets and evidence quotes. A separate extractor proposes events; it cannot rewrite prose or accept memories. Failed/cancelled extraction preserves the saved draft and blocks acceptance until the author explicitly retries extraction or chooses to skip it, then completes current review. Author-confirmed fact conflict/unknown gates remain enforced. A local save failure retains a new draft in memory with export/retry controls, without claiming durable storage.

The earlier writing-quality pilot still has zero complete pairs. A new [nine-call architecture protocol](eval/PROSE-PIPELINE-PROTOCOL.md) compares the unchanged legacy action with prose + extraction using the same synthetic story input. Protocol success and literary quality are separate outcomes.

The first prose-first architecture pilot stopped at request six with one complete pair. Both new prose/extraction cases passed structure; the second legacy comparator failed JSON parsing. A saved extraction label also overreached its quoted paragraph. See the [full outcome and measured usage/latency](eval/PROSE-PIPELINE-RESULTS.md); no literary superiority or cost saving is established.

## Candidate memory review

The default author choice now keeps a program-derived full-paragraph excerpt with exact offsets and adjacent context. This proves textual presence only, not world truth or support for the original model label. Keeping any free paraphrase requires a separate informed author acknowledgment and reason, even after a `supported` audit. Old accepted choices remain visibly historical and unverified; original labels, quotes and judgments are preserved. See [quote-grounded memory and migration](docs/public/QUOTE-GROUNDED-MEMORY.md).

Prose + chapter review uses two base calls; optional extraction adds a third. Explicitly auditing K candidates adds K optional calls; excerpt selection, attestation and reject-all add zero calls. All-rejected memory permits final prose-only acceptance without hidden retries. Existing call limits, cancellation, stale binding, budget checks and paid-result storage recovery remain. Exact excerpts, author decisions and model advice are distinct; no general semantic or literary-quality guarantee is claimed.

The [first live support audit](eval/MEMORY-SUPPORT-RESULTS.md) missed the retained quote-mismatch case, then stopped on request two after a timeout. A false supported judgment enabled ordinary keep at that audited revision. The correction revokes that bundled authority and adds hard request isolation. A separately approved four-call pilot caught the unchanged counterexample and matched all four fixed expectations, including a literal positive control; this is not a general accuracy guarantee. Explicit author selection remains essential. See the [isolated pilot evidence](eval/ISOLATED-MEMORY-SUPPORT-RESULTS.md) and [corrective design](docs/public/ISOLATED-MEMORY-REVIEW.md).


## Multi-chapter continuation and recovery

Author-selected current event memory now accompanies exact manuscript sources, with explicit planning roles and stale-source exclusions. Custom candidate cards are chapter-local. Paid extraction/review results survive a failed storage write in the current window, and older candidates can explicitly refresh context without regenerating prose. See the [behavior and limits](docs/public/MULTICHAPTER-CONTINUITY.md) and the [non-blind reading of retained prose](eval/RETAINED-PROSE-CLOSE-READING.md). These improvements do not establish literary superiority or complete long-form continuity.


The [first real multi-chapter run](eval/MULTICHAPTER-RESULTS.md) stopped at call eight: chapter 2's first candidate was correctly rejected, but chapter 1 had already received a false positive that admitted a missing location detail. Two retained prose outputs also missed length/paragraph targets. The isolated four-case pilot is not a general support guarantee; no three-chapter or literary-quality pass is claimed. Model judgments remain advisory, and the consumed live protocol cannot be rerun through its old CLI.

## Accept your own chapter without regenerating it

In a custom project, use **作者分类保存 · 不调用模型** to classify and save your manuscript locally, then review and commit its patch. **准备手写稿 · 不提取记忆** copies that exact synchronized revision into an immutable author-origin candidate, explicitly choosing zero candidate memories. It does not generate, extract, review with a model, or accept on your behalf. Saving/classifying alone still does not mark a chapter accepted.

- With **no confirmed Canon**, **审查候选稿** performs local structural/version checks. The final confirmation names the chapter, source revision, candidate revision and text checksum. Acceptance can complete with zero model calls; semantics and literary quality remain unevaluated.
- With **confirmed Canon**, the existing model-review and per-fact conflict/unknown gates remain required. Choose real-model mode and explicitly click review to request it; it can cost a model call and remains fallible advice. Preparing or skipping extraction does not waive these gates. There is no universal zero-call acceptance claim.
- Memory extraction is optional for these author-origin candidates and requires its own explicit action in real-model mode. If used, all existing excerpt/paraphrase choices apply. Choosing **不提取记忆 · 仅保留正文** archives the prior extraction/choices and requires fresh review; it is recorded as skipped, not as a successful empty model result.
- Pending edits, unresolved patches, unsafe storage, an unaccepted earlier chapter or a changed confirmation block acceptance. Editing an accepted manual chapter revokes acceptance for the new version, including after local classification; accept it again before continuing. A newer saved target manuscript cannot be overwritten by refreshing an old manual candidate: edit/classify the chapter, reject the old candidate and prepare a new one. Other context changes can be explicitly refreshed and re-reviewed.
- Reload and accepted backup imports preserve origin, classification, manuscript revisions and acceptance history. Pending imports revoke skip/review authority and require a new explicit choice. Legacy classifications without the new exact-source audit need one fresh local classification. The next chapter receives the accepted manuscript and only eligible explicitly selected memories; zero selected memories does not erase the prose.

The manual workflow has offline domain, storage, DOM and mocked-browser regressions. These demonstrate workflow safety, not semantic correctness or real-model writing quality. No new live-model experiment or release accompanies this change.

## Revise a pending model draft from your feedback

For a pending live-model prose draft, enter **改稿意见** and explicitly click **按意见生成改稿建议 · 1 次模型请求**. This sends the exact draft, your instruction and its current story context to the configured server model. It first checks the remaining process call budget, then makes one revision request. Offline templates, accepted drafts and immutable author-origin snapshots are not revision targets.

- The result is a separate proposal with the complete before/after text. Han counts use Unicode `Script=Han`, character counts include all Unicode code points (including whitespace/newlines), and paragraphs are nonblank physical lines. Counts demonstrate adherence, not writing quality
- Adopt only through a fresh confirmation. Adoption appends a candidate revision and archives the old extraction, reviews, Canon exceptions and memory choices; it does not automatically extract, review, accept a chapter or commit memory. Original prose and provider provenance remain available in the backup
- Discard keeps the original and the proposal history. Source/context/instruction changes invalidate adoption, including changing an instruction away and back. Cancelled/failed requests never retry automatically. A late result on a changed workspace is retained as stale when received, with no adoption authority
- Budget exhaustion/unknown budget and unsafe storage block dispatch. A received result whose save fails stays in the current window for export or retry-save without another paid request. Closing the window before recovery can lose that unsaved result. Reload preserves valid completed advice; an interrupted request needs an explicit **取消中断的改稿请求** before a new request. Backup import makes pending advice stale

This action is distinct from **局部润色**, which remains two deterministic demo replacements, and `interpretRevision`, which interprets edits the author already made. The unchanged configured model may still introduce defects. The [new fixed revision trial](eval/AUTHOR-REVISION-PROTOCOL.md) was preregistered with a separately gated three-stage runner; that one-shot live entrypoint is now retired. Workflow tests do not claim live quality improvement or author acceptance.

The [first author-directed revision trial](eval/AUTHOR-REVISION-RESULTS.md) stopped after one call. It met the requested bounds (396 Han, five paragraphs) and repaired the opaque box, but introduced an immediate “did not knock / knocked three times” contradiction. Extraction/review were not run; the live entrypoint is retired. This is a targeted improvement with a failed close-read gate, not a literary-quality pass. Original output and the failed assessment are retained.

### Edit the proposal locally before adoption

The confirmation dialog now has an editable **待采用正文** buffer. Correct or reshape the proposal locally, compare the immutable raw model text, and confirm once to append the exact final text as a new candidate version. If it differs from the raw response, the adoption records `explicit_author_edit`; otherwise it records `explicit_model_adoption`. The result's provider/usage, raw text and original counts are never relabelled as author output. The final adoption record points to its exact prose revision and retains its checksum and counts, plus a separate raw-result checksum for structural consistency checking (not authenticated provenance), including after later edits or backup import.

Optional **汉字下限 / 汉字上限 / 段数下限 / 段数上限** fields provide deterministic under/over reminders. Blank means no bound; values must be nonnegative safe integers with minimum no greater than maximum. They are local author-entered criteria, never inferred from the freeform instruction or sent to a model. Out-of-range text can still be explicitly adopted. These counts do not validate meaning, causality or literary quality.

The buffer and bounds are unsaved until successful confirmation. Return, close, Escape or reload discards the buffer; reopening starts from the preserved model proposal. **导出待采用正文** saves the current buffer as text. If adoption hits a quota/security save failure, the dialog retains the buffer and offers a reachable local retry-save; this restores workspace storage only, followed by fresh adoption confirmation. No new model call occurs. The existing clean-workspace, stale binding, immutable paid-result, import and review-invalidation safeguards still apply.

Offline regression coverage uses the retained contradictory trial response, removes its “没再敲，” phrase as a simulated author edit, and checks distinct provenance. That demonstrates the author-editing workflow only. The [failed trial report](eval/AUTHOR-REVISION-RESULTS.md), raw output and historical evidence remain unchanged; no model-quality success, new live call, chapter acceptance, release or deployment is claimed.


### Explicit prose-only acceptance for model-origin drafts

Pending prose-first candidates, including locally edited revision proposals, now offer **不提取记忆 · 仅保留正文**. A version-bound confirmation explains the current extraction status and candidate count before clearing current candidates. Confirming records an explicit author skip, archives prior extraction, quotes, decisions and reviews, and revokes every old review and Canon exception. Active requests must be cancelled first; cancellation cannot promise to stop provider billing. Failures never silently become successful empty extractions.

The path is **save/adopt candidate → explicitly skip extraction → request fresh chapter review → resolve Canon gates → confirm acceptance → next chapter**. Model-origin prose still requires the existing model review, even with zero memories. Final acceptance records the exact candidate revision/text and the skip decision without calling the model, changing its origin to handwritten, or changing existing story facts. Accepted prose still enters later manuscript context; zero new event memories is not zero context or zero calls.

Edits and context refresh revoke the skip; pending backup imports require a fresh choice and review. Returning or closing the confirmation changes nothing. Storage conflicts or failures block commitment. Reopening or compensating a prose-only accepted chapter removes its current accepted-manuscript role while preserving earlier text, raw revision proposals and audit evidence.

Offline/domain and hosted desktop/mobile regressions exercise the retained failed revision, a simulated author correction, fresh mocked review, zero-memory acceptance and the next chapter's context without an extraction request. This establishes operational acceptance only. The [historical one-call revision trial](eval/AUTHOR-REVISION-RESULTS.md), raw output and failed close-read remain unchanged; real writing quality is unresolved. No new live call, release or deployment is part of this change.
