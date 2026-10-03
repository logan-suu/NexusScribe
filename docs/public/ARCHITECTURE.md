# Runtime architecture

NexusScribe separates creative proposals from authoritative story state.

## Boundaries

1. The browser stores a single-author workspace: chapters, immutable revision history, proposals, drafts, reviews and commits
2. The domain runtime validates exact project, state version, text revision and evidence before changing authoritative state
3. The server adapter owns credentials and outbound calls. It exposes bounded authoring actions, not arbitrary URL fetching
4. A provider proposes text, plans, facts and review issues; it never commits Canon
5. A draft is isolated until the author accepts its current reviewed revision

## Implemented flow

Idea → interview → proposed constitution/outline → author confirmation → context snapshot → raw candidate prose saved → explicit independent memory extraction → structural checks + model advisory → author acceptance → state commit → next chapter.

Edits save independently, then become proposed memory updates. The author explicitly confirms generic fact excerpts; fixed demo edits have deterministic interpretation. Candidate plans are not world truth, and writer context preserves role-specific knowledge boundaries in the demo fixture.

## Model gateway

`POST /api/agent` accepts `{action,input}` and returns `{output}`. Supported actions: interview, planStory, generateProse, extractMemory, interpretRevision, reviewChapter; the legacy generateChapter action remains available for compatibility and independent comparison. `GET /api/status` exposes configuration status and nonsecret call limits only.

The gateway validates request and response shape, exact evidence excerpts, bounded sizes, local Host/Origin, HTTPS configuration, timeout, concurrency and per-process call count. Upstream redirects and silent template fallbacks are prohibited. This is a local developer gateway, not a production multiuser API.

A model review remains an advisory, even if it reports no issues. It is bound to the current state, draft revision, target chapter and staging hash. Error-level issues block live-draft acceptance; warnings remain visible. No finite excerpt or schema check proves arbitrary semantic correctness.

## Persistence and concurrency

Browser localStorage is a prototype persistence layer. Exported JSON includes state and history. Revision checks and stale-window detection avoid common accidental overwrites, but are not atomic database transactions or multiuser authorization. A production backend requires ownership/authentication, short database transactions, migrations, durable jobs and tested backup recovery.

## Verification

Unit tests cover version guards, idempotence, compensation, selective dependencies, alternative/time-bound evidence, draft isolation, author-confirmed excerpts and review binding. DOM tests exercise the three-chapter workflow and a mocked prose-first live-provider path. Provider tests inject fake fetch and verify failure, schema, budget and privacy boundaries.

Real provider connectivity, semantic quality, long-form evaluation, production security and browser visual QA remain separate acceptance gates.

See [the full product blueprint](NexusScribe-blueprint.md) for planned architecture and evaluation criteria. Design goals there must not be confused with completed implementation.

## Prose-first generation and extraction

The normal live UI uses `generateProse`: the model returns plain prose, not a chapter JSON envelope. After a complete bounded provider response, the exact string is saved as an isolated draft before any extraction call. The runtime supplies chapter/draft/run IDs, revision, immutable `proseVersions`, paragraph IDs and offsets. It does not normalize blank lines, CRLF or whitespace. A paragraph is a nonblank CR/LF-delimited line; `start`/`end` are half-open JavaScript UTF-16 offsets. The 30,000-code-unit cap is a safety boundary, not a target length or proof of literary validity.

The author separately clicks **提取候选记忆**. `extractMemory` receives the exact saved prose and context; the gateway labels paragraphs deterministically and requests only event labels plus paragraph indices and review notes. Server and domain independently derive/check exact quotes and offsets. Extracted labels remain unverified semantic proposals. The UI displays each event and its evidence; an empty valid extraction is allowed but is not completeness evidence.

Each attempt binds project, draft/run, target chapter, draft revision, exact text snapshot, state/source revisions, context and attempt identity. Failure, cancellation and malformed output preserve saved prose and block review/acceptance. Re-extraction clears old reviews; edits append an immutable draft revision and invalidate staging, extraction, review and fact decisions. Imports invalidate unfinished candidates' old extraction and approvals. Exact-quote, explicit-author-fact, contradiction/unknown and author-acceptance gates remain in place. Historical legacy drafts retain their original contract.

A failed local save keeps newly returned prose in memory with the existing export/retry warning; it is not reported as durably saved and extraction waits for successful saving. Closing/crashing before recovery can still lose in-memory-only work.

This path adds a model call: writing + extraction + review is three calls per successful chapter instead of two. It does not claim lower cost or latency. Per-task reported usage remains distinct; the bounded architecture experiment measures attempted calls, provider usage and elapsed time by stage, including failed outputs, in [its frozen protocol](../../eval/PROSE-PIPELINE-PROTOCOL.md). Wire-format success is separate from literary quality. The old strict `generateChapter` comparator is not weakened or silently routed through the new path.
