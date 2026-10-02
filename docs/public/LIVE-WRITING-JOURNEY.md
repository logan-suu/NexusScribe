# Bounded real-browser writing journey

The manual `.github/workflows/live-smoke.yml` workflow now runs the three-chapter
browser milestone. The older standalone `scripts/live-smoke.mjs` and its offline
regressions remain available. Ordinary PR/push jobs do not receive provider secrets.

Dispatch the reviewed feature ref explicitly with `approve_live_smoke: true`.
The runner needs the repository's existing `NEXUS_API_KEY` secret. Never copy that
secret into source, browser storage, screenshots, reports or workflow inputs.
The approval includes confirmation that provider overage / Use balance is off.

## Bounded scope

- One entirely fictional short Chinese story, desktop Chromium at 1440×1000
- Live interview and three-chapter planning, then generate/review/accept chapter 1
- Edit chapter 1 prose through the editor, analyze it, explicitly confirm one setting
- Generate/review/accept chapters 2 and 3 with the edited setting in their actual context
- Verify that undoing the setting across dependent accepts is blocked
- Compensate the later event commits in reverse order, then compensate the setting
- Verify confirmed state restoration, preserved manuscript/history, and reload

All changes use visible UI controls. Browser storage is read only for assertions;
no test state is injected. The backend validates the actual continuation request's
fact and source context. Provider replies are neither mocked nor intercepted.
A model's semantic review is advice, not independent proof of literary quality or
correctness. A blocking review stops the journey instead of forcing acceptance.

Expected live calls: 9. Hard session cap: 12. Output cap: 3000 tokens per call.
Provider: OpenCode Go / `deepseek-v4.1-flash`, `thinking: {type: "disabled"}`;
`reasoning_effort` is omitted. Calls are spaced at least 11 seconds apart. There
are no retries or automatic reruns; the first provider error closes the session.
The entire manual job has an eight-minute limit. These request/token limits do
not establish a currency spending cap; provider billing controls remain necessary.

Both servers bind to 127.0.0.1. Credentials exist only in the execution step's
server environment. Browser egress is restricted to the loopback app. Logs are
fixed statuses and numeric counters; raw provider responses, reasoning, traces,
HTTP logs, console bodies, browser storage and HTML reports are not uploaded.
The sole artifact is successful synthetic UI milestone screenshots (seven-day
retention). Earlier screenshots may be present even when a later step fails;
only `journey PASS` establishes completion. No screenshot contains the API key,
which never enters the browser or model prompt.

## Offline validation

`npm run check` includes configuration, stop-on-error, budget, concurrency and
pacing tests for the guard. This does not contact a provider or execute the real
browser journey. `node --check scripts/live-writing-journey.mjs` checks syntax.
The Browser plugin is not available in the cloud task. Local browser socket use
is restricted, so real Chromium execution runs on GitHub-hosted CI only.
