# Launch and acceptance checklist

## What exists

- A React writing workbench and a loopback-only Node.js model gateway
- Reproducible unit, DOM and Chromium desktop/mobile tests
- Separately enabled, bounded synthetic provider smoke tests

A GitHub Actions run is temporary test infrastructure. It does not create a persistent, publicly reachable application. A repository Actions secret is available to the approved job only; it is not a secret store for a separately launched app.

## Run the offline demo on an approved Node.js machine

Use the integrated `dev_v1.0` checkout (or an explicitly reviewed PR revision), with Node.js 22.12 or newer in the environment you have chosen and authorized. Starting these commands does not deploy a public website.

```sh
npm ci
npm run check
npm start
```

On that same machine, open http://127.0.0.1:5173. The gateway listens on 127.0.0.1:8787. With no model configuration, offline templates remain available and no external provider call is made. Stop both services with Ctrl+C.

For a built frontend, use `npm run build` then `npm run preview`, and run `npm run server` separately. Preview uses port 4173.

These localhost addresses are not remote sharing links. Use only an environment's supported private preview mechanism if it has one; do not bypass a blocked port or expose an unauthenticated gateway to the internet.

## Enable a live provider deliberately

The operator must inject `NEXUS_API_KEY` into the server process using an approved secure method in that environment. Do not copy it into source, Vite variables, chat, public logs or command history. This application does not automatically retrieve repository secrets or load `.env` files.

The nonsecret configuration is:

- `NEXUS_API_BASE_URL` and `NEXUS_API_MODEL`: the approved provider route/model
- `NEXUS_LIVE_ENABLED=true`: explicit permission to attempt external requests
- `NEXUS_OVERAGE_CONFIRMED_OFF=true`: the operator's confirmation that account overage is off; the app does not change or verify the account setting
- `NEXUS_MAX_OUTPUT_TOKENS` and `NEXUS_MAX_CALLS`: bounded per-request output and per-process attempt limits
- At most one optional compatibility control: `NEXUS_REASONING_EFFORT=low` or `NEXUS_THINKING_MODE=disabled`; never both

The Go/DeepSeek route and the evidence for requested controls are described in [model compatibility](MODEL-COMPATIBILITY.md). The bounded successful profile used `NEXUS_THINKING_MODE=disabled`, no effort field and a 3000-token output ceiling; other routes retain their defaults unless explicitly configured. Do not treat a requested setting as proof of the provider's internal token accounting.

Start or restart the server, open 「模型」, inspect configuration status and select live mode. Configuration status alone is not a connectivity test. The next chosen authoring action makes the external request. There are no automatic retries or template fallbacks. A server restart resets its call counter, so it is not a persistent financial budget.

## First user journey

1. Create a fictional sample project from an idea
2. Review the interview, agreement and three-chapter outline
3. Generate one candidate and inspect the visible provider/mode
4. Edit, review and explicitly accept or reject that revision
5. Check the memory evidence and revision log
6. Export a backup before using longer or important manuscripts

Review state and world truth separately. A model advisory is not independent proof of semantic correctness, and rejection or compensation must remain available without silently erasing history.

## Before any hosted deployment

A persistent hosted demo requires a separately chosen runtime and its secure key setup. Public deployment also requires authentication, ownership isolation, persistent storage/recovery, meaningful abuse protection and a reviewed request budget. Those are not supplied by simply publishing `dist/` or forwarding a port.

Hosting and secret transmission to a new environment require explicit authorization and an assessment of cost and access. No hosted deployment is created by this checklist.
