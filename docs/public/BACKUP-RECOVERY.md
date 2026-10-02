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
