# NexusScribe acceptance walkthrough

[English](DEMO-WALKTHROUGH.md) · [简体中文](DEMO-WALKTHROUGH.zh-CN.md)

This walkthrough demonstrates the current prototype's author decisions, version safeguards and local recovery. It has two separate routes: a manual chapter accepted with zero model calls, and an automated replay of the model-assisted UI using synthetic replies. Both use fictional manuscripts. A completed demo establishes the stated workflow checks only; it does not establish live-agent literary quality, general semantic reliability or production durability.

## Start in offline mode

Use Node.js 22.12+ and npm in the repository checkout containing these demo commands:

```sh
npm ci
npm start
```

Open **http://127.0.0.1:5173** in a browser on the machine running the app. The frontend and API bind to loopback; the API uses port `8787`. Keep the default offline-template mode. No account or provider key is needed. If this shell was previously configured for live use, disable `NEXUS_LIVE_ENABLED` and `NEXUS_OVERAGE_CONFIRMED_OFF` before starting it. The app does not automatically load `.env` files.

“Offline” here means no external model calls during the demonstration. Installing npm packages or the Playwright browser may need a network connection unless already cached. Running the app does not publish it or create cloud backup.

In a second terminal, explicitly prepare the fictional samples:

```sh
npm run demo:prepare
```

This writes local files under `demo-output/`:

- `sample-start.json`: **窗边的信 · 离线验收样例**, a custom novel with saved sample author text awaiting classification and no confirmed Canon
- `sample-canon-blocked.json`: **窗边的信 · 设定阻塞样例**, a separate project with one confirmed fact and contradictory, locally classified prose

These are generated samples, not user manuscripts. Preparation does not import anything into your browser. Neither `demo-output/` nor generated screenshots or workspace checkpoints should be committed. Use a separate browser profile for the demo if you already write in this app, and export your own work first.

## Route A Accept an author chapter with zero model calls

The interface is Chinese; the bold labels below match its controls. Do not select real-model mode for this route.

1. Choose **导入备份** and select `demo-output/sample-start.json`. Read **备份导入预览**, then click **确认作为新项目导入**. Import creates a new project; it does not overwrite an existing one.
2. Open the first chapter and inspect **章节正文**. Keep the supplied fictional text unchanged for this first pass.
3. Click **作者分类保存 · 不调用模型**. In **确认改文类型**, choose **仅局部表达，不更新设定**. Inspect the proposed patch, then click **确认并提交状态**. This is the author's classification; the app has not inferred that the prose is semantically harmless. Saving and committing this classification alone do not accept the chapter.
4. Click **准备手写稿 · 不提取记忆**. The candidate must preserve the exact saved prose and identify its author origin and source revision. It starts with an explicit extraction skip and zero candidate memories. Preparing it does not accept it.
5. Click **审查候选稿**. With no confirmed Canon, this performs local structural and version checks. Expect a clear statement that semantics were not evaluated. It is not a model review.
6. Click **接受此版本**. In **确认接受候选稿与已选记忆**, check the chapter, source revision, candidate revision, text checksum and zero-memory choice. Click **返回核对** once to verify that opening and dismissing the dialog does not accept anything. Open it again, then click **确认接受正文与所选记忆**.
7. Reload. The chapter should remain accepted with the same prose. The original source revision and acceptance history remain available; no new event memory or Canon fact was created.

**Pass for this route:** the exact author text survives classification, preparation, explicit acceptance and reload; the chapter is accepted only at the final confirmation; there are zero model calls. Local structural success leaves semantics and literary quality unevaluated.

If preparation or acceptance is blocked, check for pending editor changes, an uncommitted patch, a storage warning, an unaccepted earlier chapter or a changed source version. Do not clear browser storage to force a pass. If you edit the saved source after preparing a manual candidate, reject the obsolete candidate and prepare a new one after classification. Old review or skip decisions cannot authorize new text.

## Export and import recovery check

1. After Route A, click **导出项目备份** and keep the downloaded JSON outside browser storage.
2. Select it through **导入备份**. Inspect the preview, click **取消导入** once, and verify that the current project is unchanged.
3. Import the same file again and click **确认作为新项目导入**. The new project should preserve the accepted chapter, exact prose, source revisions and acceptance history. Use **切换项目** to verify that the earlier project remains available.
4. Reload and check the imported accepted chapter again.

An already accepted backup and a pending draft have different authority. Importing a pending draft retains its evidence but revokes old review, extraction-skip and adoption authorizations. Choose the extraction path again and obtain the required fresh review before acceptance. Import is not a new semantic endorsement.

If **尚未安全保存** appears, keep the window open, export **导出当前内容（含暂存编辑）**, and use **重试保存** after resolving the storage problem. A successful retry-save does not replay a failed acceptance confirmation. The automated storage suite separately injects quota failure and corrupt-primary recovery; do not damage real browser data to reproduce those cases. See [local backup and recovery](BACKUP-RECOVERY.md) for limits, including the shared 2 MiB workspace bound and the fact that clearing site data removes all local copies.

## Canon must block the offline shortcut

1. Import `demo-output/sample-canon-blocked.json` through the preview as another new project.
2. Inspect the confirmed fact **陆遥从未见过寄信人。** and the contradictory prose **陆遥认出寄信人的脸，说：“我们昨天见过。”** The sample has already been locally classified and synchronized. Click **准备手写稿 · 不提取记忆** to create its author-origin candidate.
3. Stay in offline-template mode and click **审查候选稿**. Confirm that the candidate cannot be finally accepted without a fresh model review and the existing per-fact gates. The original confirmed fact must remain unchanged.
4. Stop this manual scenario at the block. No live review is part of this walkthrough.

**Pass for this route:** a missing current model review cannot be bypassed by manual origin or zero-memory selection. The block alone is not evidence that a model has recognized the contradiction. In separately enabled live use, review is an explicit model request and can cost a call; conflict or unknown judgments still need resolution. A model judgment remains fallible advice.

## Route B Replay the model-assisted UI with synthetic replies

This route uses Playwright to replay the visible authoring controls. Its model transport is mocked, and nonlocal browser traffic is blocked. The UI may display real-model-mode labels because the replay exercises that branch; no live provider is contacted and no API key is required.

Install Chromium once if needed, then run the curated acceptance replay from the repository root:

```sh
npx playwright install chromium
npm run demo:acceptance
```

Linux runners also need Chromium's system dependencies; a maintained CI image or `npx playwright install --with-deps chromium` can provide them. Browser launch or installation failure is an environment blocker, not a successful demo.

The replay covers these checkpoints:

1. Fictional story idea → interview → editable story agreement and chapter plan → explicit confirmation
2. Synthetic generated prose retained as a candidate, without automatic acceptance
3. Explicit revision request → independent proposal → comparison with preserved original model text
4. Local edit in **待采用正文** → **确认采用并使旧审阅失效**; the adopted version is recorded as `explicit_author_edit`, while the raw model result remains unchanged
5. **不提取记忆 · 仅保留正文** → version-bound **确认不提取记忆**; zero new memories are an author decision, not a fabricated successful extraction
6. Fresh mocked whole-chapter review of the exact edited candidate → explicit final acceptance
7. Next-chapter generation request containing that accepted prose as `accepted_manuscript`, even with zero new event memories

Named screenshots, `acceptance-receipt.json` and `accepted-backup.json` are written in the relevant Playwright test directories under `test-results/`. Review the command's result and the artifacts together. A screenshot of an early step is not proof that later acceptance passed. Keep these files as local test evidence; do not commit screenshots, exported projects or browser workspaces.

**Pass for this route:** all scripted assertions complete, required current-version confirmations remain enforced, original model evidence is preserved, the accepted text reaches the next request, and no live calls occur. The synthetic review response is predetermined test data. This replay does not evaluate the model's ability to write, revise, detect a contradiction or judge quote support.

For broader offline checks, run `npm run check` and `npm run test:e2e`. The focused [manual](../../e2e/manual-chapter.spec.js), [prose-only](../../e2e/prose-only.spec.js), [revision](../../e2e/author-revision.spec.js) and [storage](../../e2e/storage.spec.js) suites cover additional stale-state, cancellation, import and save-failure boundaries. Automated pass counts are scoped to their exact tested source and do not replace inspection of the generated screenshots.

## Real quality failures remain failures

The retained [author-directed revision trial](../../eval/AUTHOR-REVISION-RESULTS.md) stopped after one call. It reached 396 Han characters and five paragraphs and repaired the opaque-box problem, but added the adjacent “did not knock / knocked three times” contradiction. Its close-read gate failed; no subsequent extraction or review was run. A simulated author correction in an offline replay does not change that model output or the failed result.

The retained [multi-chapter trial](../../eval/MULTICHAPTER-RESULTS.md) stopped after eight calls. Chapter 1 received a false `supported` judgment for a detail absent from its own quote. Chapter 2's first-candidate mismatch was correctly rejected, and neither a completed three-chapter chain nor literary-quality acceptance was established. Both generated chapters also missed the requested length and paragraph bounds. The original reports and evidence remain unchanged; some historical recommendations describe the product at the time of those trials.

## Feature freeze and the next evaluation boundary

This package makes the existing workflow reproducible. It adds no runtime feature or new live trial. Feature work stays frozen while acceptance evidence is checked.

The next useful work is a preregistered **causal-continuity and quote-support evaluation design**, before any separately authorized execution. Freeze the exact source, fictional inputs, request scope, call cap, stop rules and evidence retention first. Define causal checks for action order, physical access, custody and whether a targeted revision introduces a new contradiction. Define quote-support checks for the entire claim using only its own quote, including missing detail, attribution, negation and time scope; retain the known false positive and clear positive/negative controls.

Keep transport/schema success, deterministic counts, author decisions, semantic judgments and literary assessment separate. Preserve failures instead of rerunning until something passes. Any live trial needs its own explicit authorization and recorded execution evidence; this document and the demo commands do not grant it. General semantic reliability, long-form continuity and live-agent literary quality remain unresolved.
