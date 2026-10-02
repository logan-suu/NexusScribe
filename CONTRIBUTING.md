# Contributing to NexusScribe

## Development

Use Node.js 22.12 or newer and npm. From the repository root:

```sh
npm ci
npm run check
npm start
```

`npm run check` runs domain/server tests, simulated DOM workflows, mocked live-provider UI tests, and the production build. These checks do not contact a paid provider and do not prove real-model quality or browser visual correctness. See the README for configuration and capability limits.

Never add provider credentials to source, frontend environment variables, issue reports, or pull requests. Keep real credentials in the server process environment. Use fictional test content and redact private manuscripts and project exports.

## Branches, commits, and pull requests

1. Start from up-to-date `dev_v1.0` and create a focused branch, for example `feat/chapter-navigation` or `fix/stale-review`. Do not develop directly on `main`.
2. Keep changes small and add regression tests for behavior changes.
3. Use Conventional Commit messages: `feat: ...`, `fix: ...`, `test: ...`, `docs: ...`, `refactor: ...`, or `chore: ...`. An optional scope is welcome, for example `fix(provider): reject invalid output`.
4. Run `npm ci` and `npm run check` before requesting review. Include the exact commands and results in the PR. Report skipped checks and visual verification separately.
5. Open the feature pull request into `dev_v1.0` as a **draft** first. Explain the change, link its issue, and describe risks and limits.
6. Mark it ready for review once implementation and validation are complete. Address review feedback, rerun affected checks, and ensure the latest commit passes CI.
7. Merge feature work into `dev_v1.0` only after review is complete, checks are green, and a maintainer approves the merge. Prefer squash merges with a Conventional Commit title. Do not enable auto-merge.
8. Promote an approved development version with a separate release pull request from `dev_v1.0` into `main`. Review the release diff and rerun checks for the current commit before an explicitly authorized merge.

Branch flow: `feat/*` or `fix/*` → feature PR → `dev_v1.0` → release PR → `main`. CI runs for pushes and pull requests targeting either long-lived branch.

This is the contribution process, not a claim that GitHub branch protection, required reviewers, or required checks are configured. Those settings must be configured and verified separately by the repository owner. Publishing a PR does not authorize a merge or deployment.

## Review checklist

- Preserve the distinction between manuscript text, proposed changes, and committed story state
- Preserve author confirmation and stale-review protection
- Do not describe templates, mocks, structural validation, or model self-review as proof of semantic correctness
- Keep live-provider calls opt-in; document new data transmission and cost behavior
- Avoid unrelated refactors and generated artifacts
- Update public documentation when behavior or limits change

## Repository hygiene

Do not commit `node_modules`, `dist`, real `.env` files, credential files, project backups, test recordings, screenshots, or machine-specific logs. Publish source and sanitized documentation deliberately; an ignore file is not a substitute for inspecting a commit diff.

No project license has been selected. Public visibility alone does not establish an open-source license; do not add a license or make redistribution claims without the owner's decision.
