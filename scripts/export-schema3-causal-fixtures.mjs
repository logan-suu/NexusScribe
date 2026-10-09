/** Credential-free export/check. Capture the real App input; never run a provider. */
import {JSDOM} from 'jsdom';
import {build} from 'esbuild';
import {readFile, readdir, mkdtemp, symlink, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve, join} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {CURRENT_RUNTIME_PATHS, readHistoricalSource} from './eval-source-inventory.mjs';
import {fixtureSetId, baselineCommit, sourcePaths, sha256, buildSchema3FixtureStates, describeFixture}
  from '../eval/schema3-causal-fixtures.mjs';
import {getContext} from '../src/domain/engine.js';
import {KEY} from '../src/storage.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const outputPath = join(root, 'eval/schema3-causal-fixtures.json');
export const MAINTENANCE_MANIFEST_PATH = 'eval/schema3-causal-maintenance-manifest.json';

async function sourceHashes() {
  const paths = [...sourcePaths, ...CURRENT_RUNTIME_PATHS.filter(path => !path.startsWith('server/') && path !== 'tsconfig.server.json'), 'eval/schema3-causal-fixtures.mjs',
    'scripts/export-schema3-causal-fixtures.mjs', 'tests/schema3-causal-fixtures.test.js'];
  async function walk(path) {
    for (const entry of await readdir(join(root, path), {withFileTypes:true})) {
      const child = path+'/'+entry.name;
      if (entry.isDirectory()) await walk(child); else paths.push(child);
    }
  }
  await walk('src');
  return Object.fromEntries(await Promise.all([...new Set(paths)].sort().map(async path =>
    [path, sha256(await readFile(join(root, path)))])));
}

// These modules are used only by the fixture test's current-input validator.
// They are not imported or executed by the App capture/export runtime.
async function validationOnlyHashes() {
  return Object.fromEntries(await Promise.all(['server/provider.ts', 'server/provider-transport.ts', 'server/types.ts', 'tsconfig.server.json']
    .map(async path => [path, sha256(await readFile(join(root, path)))])));
}

export async function exportSchema3Fixtures() {
  const out = await mkdtemp(join(tmpdir(), 'nexusscribe-schema3-fixtures-'));
  const savedGlobals = new Map();
  function install(key, value) {
    savedGlobals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, {value, configurable:true, writable:true});
  }
  let dom, cleanup;
  try {
    await symlink(join(root, 'node_modules'), join(out, 'node_modules'));
    await build({absWorkingDir:root, entryPoints:['src/App.tsx'], bundle:true,
      packages:'external', format:'esm', outfile:join(out, 'App.mjs'),
      loader:{'.css':'empty'}, jsx:'automatic', logLevel:'silent'});
    dom = new JSDOM('<!doctype html><html><body></body></html>', {url:'http://localhost/'});
    for (const key of ['window','document','HTMLElement','Element','Node','MutationObserver',
      'localStorage','getComputedStyle','File','navigator']) install(key, dom.window[key]);
    install('IS_REACT_ACT_ENVIRONMENT', true);
    dom.window.HTMLElement.prototype.scrollIntoView = function() {};
    const React = await import('react');
    const testing = await import('@testing-library/react');
    cleanup = testing.cleanup;
    const {render, within, fireEvent, waitFor} = testing;
    const {default:App} = await import(pathToFileURL(join(out, 'App.mjs')).href);
    const calls = [];
    // Capture then fail closed before a server/provider can execute. No native
    // fetch reference, credentials, network fallback or positive model output.
    install('fetch', async (url, options) => {
      assert.equal(url, '/api/agent');
      assert.equal(options.method, 'POST');
      const body = JSON.parse(options.body);
      assert.equal(body.action, 'generateProse');
      calls.push(body);
      throw Error('OFFLINE_FIXTURE_CAPTURE_ONLY');
    });
    const fixtures = [];
    for (const fixture of buildSchema3FixtureStates()) {
      cleanup(); localStorage.clear();
      localStorage.setItem(KEY, JSON.stringify({format:1, serial:0,
        state:fixture.state, editing:{}, patch:null, providerMode:'server'}));
      const view = render(React.createElement(App));
      const navigation = within(view.container).getByRole('navigation', {name:'章节'});
      fireEvent.click(within(navigation).getAllByRole('button')[1]);
      const before = calls.length;
      fireEvent.click(within(view.container).getByRole('button', {name:'生成当前章', exact:true}));
      await waitFor(() => assert.equal(calls.length, before+1));
      await waitFor(() => assert.match(view.container.textContent, /OFFLINE_FIXTURE_CAPTURE_ONLY/));
      const input = calls.at(-1).input;
      assert.deepEqual(input.context, getContext(fixture.state));
      assert.equal(input.project.outline[input.chapterIndex].id, fixture.chapterId);
      assert.deepEqual(JSON.parse(localStorage.getItem(KEY)).state, fixture.state);
      fixtures.push(describeFixture(fixture, input));
    }
    assert.equal(calls.length, 3);
    return {id:fixtureSetId, formatVersion:1, contextSchemaVersion:3,
      status:'OFFLINE FUTURE-EVALUATION FIXTURES; NO LIVE AUTHORIZATION OR ENTRYPOINT',
      baselineCommit, capture:'App-to-gateway input, before server-injected chapterId, model messages and settings',
      authority:'Synthetic offline reconstruction only; no new model judgments, story facts or real author acceptance',
      providerCalls:0, sha256:await sourceHashes(),
      validationOnlySha256:await validationOnlyHashes(), fixtures,
      maintenance:{scope:'current TypeScript implementation; not original executed JavaScript sources',
        manifest:MAINTENANCE_MANIFEST_PATH, frozenArtifact:'eval/schema3-causal-fixtures.json',
        frozenArtifactSha256:sha256(await readFile(outputPath))}};
  } finally {
    cleanup?.(); dom?.window.close();
    for (const [key, descriptor] of savedGlobals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
    }
    await rm(out, {recursive:true, force:true});
  }
}

export const serializeFixtures = value => JSON.stringify(value, null, 2)+'\n';
/** Compare all frozen data/metadata, while keeping current implementation hashes separate. */
export async function verifySchema3FixtureParity(current) {
  const frozenBytes = await readFile(outputPath), frozen = JSON.parse(frozenBytes);
  const {sha256:oldSources, validationOnlySha256:oldValidation, ...oldContent} = frozen;
  const {sha256:currentSources, validationOnlySha256:currentValidation, maintenance, ...currentContent} = current;
  assert.deepEqual(currentContent, oldContent, 'Schema-3 fixture content drift');
  assert.equal(maintenance.frozenArtifactSha256, sha256(frozenBytes));
  for (const [path, hash] of Object.entries({...oldSources, ...oldValidation})) {
    await readHistoricalSource(path, hash);
  }
  const manifest = JSON.parse(await readFile(join(root, MAINTENANCE_MANIFEST_PATH), 'utf8'));
  assert.equal(manifest.protocol, 'schema3-causal-typescript-maintenance-v1');
  assert.equal(manifest.frozenArtifactSha256, sha256(frozenBytes));
  assert.deepEqual(manifest.sha256, currentSources, 'Current TypeScript fixture source drift');
  assert.deepEqual(manifest.validationOnlySha256, currentValidation, 'Current TypeScript validator drift');
  for (const [path, hash] of Object.entries({...currentSources, ...currentValidation})) {
    assert.equal(sha256(await readFile(join(root, path))), hash, path);
  }
  return true;
}


if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length && !['--check','--write'].includes(args[0]))) {
    console.error('Only --check (default) or --write is supported; no live mode.');
    process.exitCode = 1;
  } else {
    const current = await exportSchema3Fixtures();
    await verifySchema3FixtureParity(current);
    // --write is retained as a compatibility alias for verification. Frozen evidence is immutable.
    console.log(`Verified 3 unchanged schema-3 fictional fixtures against current TypeScript sources; 0 provider calls; frozen SHA-256 ${current.maintenance.frozenArtifactSha256}`);
  }
}
