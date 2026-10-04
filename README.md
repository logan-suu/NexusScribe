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
3. **Write a chapter.** Save raw candidate prose first, then explicitly extract proposed memories, inspect their exact evidence, and review. Editing invalidates extraction and review.
4. **Select memory, then accept.** Explicitly keep or reject every proposed memory. A separately requested, isolated one-candidate audit judges the label against only its own quote. Unknown/unsupported items require a reasoned author override to keep. Final confirmation commits only selected memories; rejecting all is allowed after a successful extraction.
5. **Revise with evidence.** Save manuscript edits, inspect proposed memory updates and their source excerpts, then explicitly confirm the changes.
6. **Continue and preserve.** Move between chapters and projects, inspect version history, and export manuscript text or a JSON backup.

Offline mode supports the three-chapter template workflow. The normal live flow uses interview, planning, prose generation, independent memory extraction, revision interpretation, chapter review and separately requested isolated candidate audits. The strict legacy chapter action remains available as a comparator. Writing + extraction + chapter review requires three base model calls per successful chapter, one more than the original structured-writing path; every explicitly requested candidate audit adds another call. No cost or latency savings are promised. Model output remains a proposal throughout.

## Quick start

Use the development checkout on `dev_v1.0` after integration, or the reviewed PR head while changes are under review. `main` is reserved for releases; no public hosted app is created by cloning this repository.

Requires **Node.js 22.12+** and npm. From a checkout containing this demo:

```sh
npm ci
npm start
```

Open **http://127.0.0.1:5173** on the machine running the app. The frontend and API bind to loopback; the API uses port `8787`. No account, API key, or external model call is needed for offline mode.

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

The runtime owns raw draft versions, paragraph IDs, exact offsets and evidence quotes. A separate extractor proposes events; it cannot rewrite prose or accept memories. Failed/cancelled extraction preserves the saved draft and blocks acceptance until a current extraction and review complete. Author-confirmed fact conflict/unknown gates remain enforced. A local save failure retains a new draft in memory with export/retry controls, without claiming durable storage.

The earlier writing-quality pilot still has zero complete pairs. A new [nine-call architecture protocol](eval/PROSE-PIPELINE-PROTOCOL.md) compares the unchanged legacy action with prose + extraction using the same synthetic story input. Protocol success and literary quality are separate outcomes.

The first prose-first architecture pilot stopped at request six with one complete pair. Both new prose/extraction cases passed structure; the second legacy comparator failed JSON parsing. A saved extraction label also overreached its quoted paragraph. See the [full outcome and measured usage/latency](eval/PROSE-PIPELINE-RESULTS.md); no literary superiority or cost saving is established.

## Candidate memory review

The default author choice now keeps a program-derived full-paragraph excerpt with exact offsets and adjacent context. This proves textual presence only, not world truth or support for the original model label. Keeping any free paraphrase requires a separate informed author acknowledgment and reason, even after a `supported` audit. Old accepted choices remain visibly historical and unverified; original labels, quotes and judgments are preserved. See [quote-grounded memory and migration](docs/public/QUOTE-GROUNDED-MEMORY.md).

Prose + extraction + chapter review remains three base calls. Explicitly auditing K candidates adds K optional calls; excerpt selection, attestation and reject-all add zero calls. All-rejected memory permits final prose-only acceptance without hidden retries. Existing call limits, cancellation, stale binding, budget checks and paid-result storage recovery remain. Exact excerpts, author decisions and model advice are distinct; no general semantic or literary-quality guarantee is claimed.

The [first live support audit](eval/MEMORY-SUPPORT-RESULTS.md) missed the retained quote-mismatch case, then stopped on request two after a timeout. A false supported judgment enabled ordinary keep at that audited revision. The correction revokes that bundled authority and adds hard request isolation. A separately approved four-call pilot caught the unchanged counterexample and matched all four fixed expectations, including a literal positive control; this is not a general accuracy guarantee. Explicit author selection remains essential. See the [isolated pilot evidence](eval/ISOLATED-MEMORY-SUPPORT-RESULTS.md) and [corrective design](docs/public/ISOLATED-MEMORY-REVIEW.md).


## Multi-chapter continuation and recovery

Author-selected current event memory now accompanies exact manuscript sources, with explicit planning roles and stale-source exclusions. Custom candidate cards are chapter-local. Paid extraction/review results survive a failed storage write in the current window, and older candidates can explicitly refresh context without regenerating prose. See the [behavior and limits](docs/public/MULTICHAPTER-CONTINUITY.md) and the [non-blind reading of retained prose](eval/RETAINED-PROSE-CLOSE-READING.md). These improvements do not establish literary superiority or complete long-form continuity.


The [first real multi-chapter run](eval/MULTICHAPTER-RESULTS.md) stopped at call eight: chapter 2's first candidate was correctly rejected, but chapter 1 had already received a false positive that admitted a missing location detail. Two retained prose outputs also missed length/paragraph targets. The isolated four-case pilot is not a general support guarantee; no three-chapter or literary-quality pass is claimed. Model judgments remain advisory, and the consumed live protocol cannot be rerun through its old CLI.
