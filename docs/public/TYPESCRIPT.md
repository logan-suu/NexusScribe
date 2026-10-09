# TypeScript implementation / TypeScript 实现

## Scope / 范围

All production implementation under `src/` and `server/` is TypeScript: React TSX, hooks, authoring/browser adapters, storage, domain state/review/intent logic and the HTTP/model gateway. Shared interfaces and discriminated unions describe story state, patches, chapters, review bindings, provider actions and component props. `strict: true` is enabled; there is no production `any`, `@ts-nocheck` or `@ts-ignore` migration shortcut. Compile-time negative tests fail if those contracts become permissive.

生产 `src/`、`server/` 代码全部使用 TypeScript；包括 React 界面、Hook、创作与模型适配器、存储、领域逻辑及 HTTP 网关。开启严格检查，并通过编译期反例防止类型约束被无意放宽。

Tests, build/configuration scripts and archived executed sources may remain JavaScript. These are deliberate scope boundaries, not a claim that every file in the repository is TypeScript.

测试、配置与工具脚本、历史实际执行源码可以保留 JavaScript；不会把全仓库宣称为纯 TypeScript。

## Run and verify / 运行与验证

- `npm ci`: install the lockfile, including TypeScript, React/Node type definitions and `tsx`
- `npm run typecheck`: strict compiler checks plus compile-time contract tests
- `npm start`: source frontend and gateway, with the gateway using `tsx`
- `npm run build`: typecheck, Vite frontend build and compiled gateway output in `dist-server/`
- `npm run server:built`: run the compiled gateway with plain Node
- `npm run check`: compiler, domain/storage/provider tests, DOM workflows, production build and a loader-free compiled-gateway smoke check
- `npm run test:e2e`: separate desktop/mobile Chromium regressions

Existing JavaScript test imports retain `.js` specifiers and use `node --import tsx` to resolve the migrated `.ts` implementation. For a current maintenance script invoked directly, use `node --import tsx scripts/<name>.mjs`; the frozen historical executed sources are independently preserved. The `tsx` loader is for execution; only `tsc` supplies static checking.

现有 JavaScript 测试通过 `node --import tsx` 解析迁移后的实现；直接执行当前维护脚本时也使用该前缀。`tsx` 负责执行，真正的静态检查由 `tsc` 完成。编译后的网关不依赖 TypeScript loader。

## Compatibility and trust / 兼容与可信边界

No storage schema or backup version is changed. Manuscripts, revisions, source quotes, optional provenance, original imported history, recovery/quarantine behavior and author-controlled acceptance remain governed by the existing runtime checks. External JSON and model output are `unknown` until validated. Legacy v1 imports intentionally retain their supported flexible shape; a documented boundary assertion follows the existing complete import validation rather than inventing or deleting fields.

不更改存储或备份版本，不迁移、补写或删除作者数据。导入、恢复、审阅与接受仍遵循原有运行时检查。旧版 v1 的兼容结构继续保留；静态类型不能证明导入记录真实、语义正确或模型输出可靠。

Historical output/evidence files and executed sources remain byte-identical. Exact old dependency bytes are stored separately under `eval/executed-source-dependencies/` and read by original path plus SHA-256. Current maintenance inventories explicitly name the TS implementation and its build/type dependencies. The frozen schema-3 fixture data stays unchanged; current fixture replay checks the same content with a separate current-source inventory. No historical model trial is rerun, reopened or relabeled as a TypeScript trial, and no new live-model permission is implied.

历史输出、证据及实际执行源码保持原字节；旧依赖按原路径与 SHA-256 校验。当前维护清单真实记录 TS 实现和类型/构建依赖；冻结的 schema-3 样例内容不变。历史模型实验不重跑、不重新开放，也不被改称为 TypeScript 实验。

The migration also tightens malformed planning-proposal handling: non-string chapter IDs get deterministic draft-plan IDs, invalid optional exit-state/description values are not promoted into the typed saved configuration, and proposal field names cannot overwrite structural contract metadata or use inherited object-map keys. The original field list remains available for review; valid planning inputs retain their behavior. These checks affect new external proposals, not historical backups.

迁移同时收紧损坏的规划提案边界：非字符串章节 ID 使用确定性草案 ID，不把错误类型的可选退出状态/描述提升为已保存配置；字段名不能覆盖约定结构元数据或读取对象原型键。原字段列表保留供审阅；有效输入行为不变，旧备份不受影响。
