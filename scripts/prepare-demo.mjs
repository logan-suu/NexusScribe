// Creates ONLY fictional demo inputs in a fixed, ignored output directory.
// Never reads credentials, browser state, user manuscripts or the network.
import {mkdir, writeFile} from 'node:fs/promises';
import {demoStart, demoCanonBlocked} from '../demo/fictional-project.mjs';
import {parseBackup} from '../src/storage.js';
const directory = new URL('../demo-output/', import.meta.url);
await mkdir(directory, {recursive:true});
for (const [name, value] of [['sample-start.json', demoStart()], ['sample-canon-blocked.json', demoCanonBlocked()]]) {
  const text = JSON.stringify(value, null, 2)+'\n';
  parseBackup(text);
  await writeFile(new URL(name, directory), text, {mode:0o600});
  console.log(`Prepared demo-output/${name}: fictional offline import, no model calls.`);
}
