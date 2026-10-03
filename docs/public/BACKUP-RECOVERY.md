# Local backup and recovery

## Delivered behavior

- Export includes active and archived projects, manuscript revisions, pending edits, commits, and fact-exception audit. Plain-text manuscript export now includes pending chapter edits.
- Import reads a local JSON file, validates it, and shows project/chapter/revision/commit/exception counts before explicit confirmation. Cancel and invalid files do not write storage.
- Import creates fresh project namespaces, archives the current project with its pending edits, and preserves the source project snapshot in `state.importOrigin.original`. Local chapter/record IDs remain project-scoped. Existing projects are never overwritten.
- Project-ID fields in working copies are remapped. Pending patches and active candidate reviews/exception approvals are invalidated, because their original hash bindings cannot authorize a new project. Original audit remains in the source snapshot, available through JSON export; import is not a semantic re-review.
- Every normal save first preserves the previous validated primary in one last-good slot, then replaces primary. A failed backup write stops the save. A failed primary write leaves primary untouched. These are separate browser writes, not a database transaction.
- Startup never writes. An unreadable primary opens a valid last-good workspace when available, otherwise a clearly marked temporary workspace. Recovery stays blocked until author confirmation; current in-memory text edits are included. Damaged raw bytes must be preserved successfully before replacing primary. A different existing preserved sample is never overwritten automatically.
- Quota, security and stale-window failures show persistent unsaved status. Text edits stay in memory, with current-content export, raw-storage export, retry and an unload warning. Exporting does not itself repair storage or authorize clearing it. Failed domain actions do not claim to have committed.

## Boundaries

Supported format: workspace format 1 and project schema 1. Maximum serialized workspace/import: 2 MiB UTF-8, 50 projects, 2,000 chapters per project, 20,000 entries per array, traversal depth 60 and 150,000 JSON nodes. Future schemas, invalid structures, duplicate entity IDs, duplicate project IDs and prototype-pollution keys are rejected. History may repeat a logical fact ID across versions. Import provenance consumes additional storage, so a valid source can still be refused if the combined workspace exceeds limits or browser quota.

Validation is structural, not authentication, semantic truth, or independent validation of a model report. Keep the original export file. Repeated imports preserve nested provenance and can reach size/depth limits. No migrations, compression, encryption, cloud upload, external model call, database, login, or server backup is added.

The last-good slot can lag the latest edit. All slots share the same origin and quota: clearing site data removes them all. Serial checks catch already-observed stale writes but are not a cross-tab atomic lock; avoid concurrent editing in multiple windows. Browser storage restrictions or a full quota can prevent recovery; export what is readable before changing browser settings yourself. In-memory edits can be lost if the process crashes or is forcibly closed before export or successful save.

## Verification

`npm run check` includes pure storage tests and DOM failure/recovery tests. `e2e/storage.spec.js` covers desktop/mobile preview/cancel/import/reload, corrupt-primary confirmation and preservation, and quota-failure export/retry/reload. All fixtures are fictional and external network requests are blocked. Browser tests run in the standard CI browser environment; a local environment unable to start Chromium does not count as a visual pass. No live-provider quality or production durability claim follows from these tests.

### Verified milestone (2026-10-02)

Exact source `771c3497a7c3fad1ca2e642423288f993ddc8e49` passed
[CI 37042160359](https://github.com/logan-suu/NexusScribe/actions/runs/37042160359):
231 unit/contract tests (including 41 storage tests), five DOM suites, the production
build, and 20 desktop/mobile Chromium scenarios. Six inspected backup-specific
screenshots cover import preview, corrupt-primary recovery warnings, and quota-failure
export/retry controls at both viewport sizes. Preview counts and cancel/confirm
controls were readable; the scenarios' overflow checks passed.

The first CI attempt timed out during Ubuntu package installation. A fresh hosted
runner rerun passed without changing the source. Local Chromium could not start
because its socket operation was denied; local browser verification remains unclaimed.
All milestone tests used fictional fixtures without live model calls. These bounded
checks do not establish cross-browser behavior, resilience to every process/storage
failure, cloud backup, atomic multi-window transactions, or production durability.

## Prose-first draft checkpoints

New live drafts include immutable prose versions and deterministic paragraph text/offsets. Import validates those snapshots, extraction attempts/bindings and exact staging evidence. Pending imported drafts lose prior extraction, reviews and author exceptions and require explicit re-extraction. Original history remains in the import audit. New generated prose is retained in memory when storage writes fail; extraction waits for a successful save. This is still bounded localStorage, not durable server persistence.

## Candidate selection audit

Candidate support reports, per-item decisions and original-candidate history are included in backups. New active decisions are bound to exact draft/extraction/review snapshots; pending imports cannot reuse those approvals. Older backups without this feature remain readable, but unfinished drafts require fresh current review and explicit selections before promotion. Accepted historical records are retained without inventing new support judgments. Retaining candidate/audit snapshots consumes more of the unchanged 2 MiB limit; export and local storage remain bounded, unsigned prototype storage.


Isolated support attempts use a separate application-owned scope and shared snapshot references. Old bundled assessments and accepted histories are preserved verbatim; they are not relabeled as isolated. Pending bundled-only keep decisions lose ordinary-keep authority. Re-auditing one candidate preserves unrelated completed audits, while imports and changed review/source generations revoke pending authority. Failed/cancelled attempts remain distinct from a model-returned unknown judgment.
