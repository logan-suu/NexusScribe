/** Credential-free export/check. Capture the real App input; never run a provider. */
import {JSDOM} from 'jsdom';
import {build} from 'esbuild';
import {readFile, readdir, writeFile, mkdtemp, symlink, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve, join} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {fixtureSetId, baselineCommit, sourcePaths, sha256, buildSchema3FixtureStates, describeFixture}
  from '../eval/schema3-causal-fixtures.mjs';
import {getContext} from '../src/domain/engine.js';
import {KEY} from '../src/storage.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const outputPath = join(root, 'eval/schema3-causal-fixtures.json');

async function sourceHashes() {
  const paths = [...sourcePaths, 'package.json', 'package-lock.json', 'eval/schema3-causal-fixtures.mjs',
    'scripts/export-schema3-causal-fixtures.mjs', 'tests/schema3-causal-fixtures.test.js'];
  async function walk(path) {
    for (const entry of await readdir(join(root, path), {withFileTypes:true})) {
      const child = path+'/'+entry.name;
      if (entry.isDirectory()) await walk(child); else paths.push(child);
    }
  }
  await walk('src');
  return Object.fromEntries(await Promise.all(paths.sort().map(async path =>
    [path, sha256(await readFile(join(root, path)))])));
}

// These modules are used only by the fixture test's current-input validator.
// They are not imported or executed by the App capture/export runtime.
async function validationOnlyHashes() {
  return Object.fromEntries(await Promise.all(['server/provider.js', 'server/provider-transport.js']
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
    await build({absWorkingDir:root, entryPoints:['src/App.jsx'], bundle:true,
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
      validationOnlySha256:await validationOnlyHashes(), fixtures};
  } finally {
    cleanup?.(); dom?.window.close();
    for (const [key, descriptor] of savedGlobals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
    }
    await rm(out, {recursive:true, force:true});
  }
}

export const serializeFixtures = value => JSON.stringify(value, null, 2)+'\n';

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length && !['--check','--write'].includes(args[0]))) {
    console.error('Only --check (default) or --write is supported; no live mode.');
    process.exitCode = 1;
  } else {
    const bytes = serializeFixtures(await exportSchema3Fixtures());
    if (args[0] === '--write') await writeFile(outputPath, bytes);
    else assert.equal(await readFile(outputPath, 'utf8'), bytes, 'Schema-3 fixture export drift');
    console.log(`${args[0] === '--write' ? 'Wrote' : 'Verified'} 3 schema-3 fictional fixtures; 0 provider calls; SHA-256 ${sha256(bytes)}`);
  }
}
