# Runtime architecture

NexusScribe separates creative proposals from authoritative story state.

## Boundaries

1. The browser stores a single-author workspace: chapters, immutable revision history, proposals, drafts, reviews and commits
2. The domain runtime validates exact project, state version, text revision and evidence before changing authoritative state
3. The server adapter owns credentials and outbound calls. It exposes only five bounded authoring actions, not arbitrary URL fetching
4. A provider proposes text, plans, facts and review issues; it never commits Canon
5. A draft is isolated until the author accepts its current reviewed revision

## Implemented flow

Idea → interview → proposed constitution/outline → author confirmation → context snapshot → candidate chapter → structural checks + optional model advisory → author acceptance → state commit → next chapter.

Edits save independently, then become proposed memory updates. The author explicitly confirms generic fact excerpts; fixed demo edits have deterministic interpretation. Candidate plans are not world truth, and writer context preserves role-specific knowledge boundaries in the demo fixture.

## Model gateway

`POST /api/agent` accepts `{action,input}` and returns `{output}`. Supported actions: interview, planStory, generateChapter, interpretRevision, reviewChapter. `GET /api/status` exposes configuration status and nonsecret call limits only.

The gateway validates request and response shape, exact evidence excerpts, bounded sizes, local Host/Origin, HTTPS configuration, timeout, concurrency and per-process call count. Upstream redirects and silent template fallbacks are prohibited. This is a local developer gateway, not a production multiuser API.

A model review remains an advisory, even if it reports no issues. It is bound to the current state, draft revision, target chapter and staging hash. Error-level issues block live-draft acceptance; warnings remain visible. No finite excerpt or schema check proves arbitrary semantic correctness.

## Persistence and concurrency

Browser localStorage is a prototype persistence layer. Exported JSON includes state and history. Revision checks and stale-window detection avoid common accidental overwrites, but are not atomic database transactions or multiuser authorization. A production backend requires ownership/authentication, short database transactions, migrations, durable jobs and tested backup recovery.

## Verification

Unit tests cover version guards, idempotence, compensation, selective dependencies, alternative/time-bound evidence, draft isolation, author-confirmed excerpts and review binding. DOM tests exercise the three-chapter workflow and a mocked five-action live-provider path. Provider tests inject fake fetch and verify failure, schema, budget and privacy boundaries.

Real provider connectivity, semantic quality, long-form evaluation, production security and browser visual QA remain separate acceptance gates.

See [the full product blueprint](NexusScribe-blueprint.md) for planned architecture and evaluation criteria. Design goals there must not be confused with completed implementation.
