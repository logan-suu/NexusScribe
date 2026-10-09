/** Current maintenance source identity and exact historical dependency access. No execution or network. */
import {readFileSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const CURRENT_RUNTIME_PATHS = Object.freeze([
  "server/index.ts",
  "server/provider-transport.ts",
  "server/provider.ts",
  "server/types.ts",
  "src/App.tsx",
  "src/adapters/provider.ts",
  "src/adapters/types.ts",
  "src/authoring/index.ts",
  "src/authoring/live-provider.ts",
  "src/authoring/types.ts",
  "src/components/DraftPanel.tsx",
  "src/components/Editor.tsx",
  "src/components/HistoryView.tsx",
  "src/components/Inspector.tsx",
  "src/components/ModelTaskStatus.tsx",
  "src/components/PatchPanel.tsx",
  "src/components/ProjectWizard.tsx",
  "src/components/ProviderPanel.tsx",
  "src/components/RevisionAdoptionDialog.tsx",
  "src/components/RevisionPanel.tsx",
  "src/components/SceneIntent.tsx",
  "src/components/Sidebar.tsx",
  "src/domain/author-revision.ts",
  "src/domain/engine.ts",
  "src/domain/fact-review.ts",
  "src/domain/generation-intent.ts",
  "src/domain/memory-review.ts",
  "src/domain/prose.ts",
  "src/domain/review-types.ts",
  "src/domain/scene-intent.ts",
  "src/domain/types.ts",
  "src/hooks/useModelTask.ts",
  "src/main.tsx",
  "src/storage-types.ts",
  "src/storage.ts",
  "type-tests/contracts.ts",
  "scripts/verify-typescript-runtime.mjs",
  "tsconfig.json",
  "tsconfig.server.json",
  "package.json",
  "package-lock.json",
  "vite.config.js",
  "scripts/eval-source-inventory.mjs"
]);

/** Current runtime source paths, including every implementation/type/build dependency. */
export function currentMaintenancePaths(paths) {
  return [...new Set([...paths.map(path => /^(?:src|server)\//.test(path)
    ? path.replace(/\.jsx$/, '.tsx').replace(/\.js$/, '.ts') : path), ...CURRENT_RUNTIME_PATHS])];
}

const digest = bytes => createHash('sha256').update(bytes).digest('hex');
function historicalPath(path, sha256, root) {
  if (typeof path !== 'string' || path.startsWith('/') || path.split('/').some(part => part === '..') || !/^[a-f0-9]{64}$/.test(sha256)) throw Error('HISTORICAL_SOURCE_IDENTITY_INVALID');
  const manifest = JSON.parse(readFileSync(resolve(root, 'eval/executed-source-dependencies/manifest.json'), 'utf8'));
  const source = manifest.sources.find(item => item.originalPath === path && item.sha256 === sha256);
  const archived = `eval/executed-source-dependencies/${sha256}/${path}`;
  if (source && source.archivePath !== archived) throw Error('HISTORICAL_SOURCE_IDENTITY_INVALID');
  return resolve(root, source ? archived : path);
}

/** Read original bytes by original path AND expected historical hash; never substitute TS. */
export function readHistoricalSourceSync(path, sha256, {root = ROOT} = {}) {
  const bytes = readFileSync(historicalPath(path, sha256, root));
  if (digest(bytes) !== sha256) throw Error(`HISTORICAL_SOURCE_MISMATCH: ${path}`);
  return bytes;
}
export async function readHistoricalSource(path, sha256, {root = ROOT} = {}) {
  const bytes = await readFile(historicalPath(path, sha256, root));
  if (digest(bytes) !== sha256) throw Error(`HISTORICAL_SOURCE_MISMATCH: ${path}`);
  return bytes;
}
